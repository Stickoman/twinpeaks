import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_BUCKETS = ["product-images", "delivery-proofs"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const BUCKET_CONFIG: Record<AllowedBucket, { pathPrefix: string }> = {
  "product-images": { pathPrefix: "products" },
  "delivery-proofs": { pathPrefix: "proofs" },
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { allowed } = await checkRateLimit(`upload:${auth.session.userId}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bucketParam = formData.get("bucket");
    const bucket: AllowedBucket =
      typeof bucketParam === "string" && ALLOWED_BUCKETS.includes(bucketParam as AllowedBucket)
        ? (bucketParam as AllowedBucket)
        : "product-images";

    if (
      typeof bucketParam === "string" &&
      !ALLOWED_BUCKETS.includes(bucketParam as AllowedBucket)
    ) {
      return NextResponse.json(
        { error: `Invalid bucket. Allowed: ${ALLOWED_BUCKETS.join(", ")}` },
        { status: 400 },
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 400 });
    }

    // Validate magic bytes: ensure the file is actually an image
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.format || !["jpeg", "png", "webp", "gif"].includes(metadata.format)) {
        return NextResponse.json(
          { error: "Invalid image content. File does not match a supported image format." },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid image content. File is not a valid image." },
        { status: 400 },
      );
    }

    // Process image: strip EXIF/GPS metadata, resize, convert to WebP
    const processed = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Generate unique filename and route to correct bucket
    const filename = `${crypto.randomUUID()}.webp`;
    const { pathPrefix } = BUCKET_CONFIG[bucket];
    const path = `${pathPrefix}/${filename}`;

    // Upload to Supabase Storage
    const supabase = createServiceClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, processed, {
      contentType: "image/webp",
      upsert: false,
    });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
  } catch (err) {
    console.error("Image processing error:", err);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}
