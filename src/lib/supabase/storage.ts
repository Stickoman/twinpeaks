import { createServiceClient } from "./service";

/**
 * Delete a product image from Supabase Storage.
 * Extracts the storage path from the full public URL.
 */
export async function deleteProductImage(url: string): Promise<void> {
  // URL pattern: https://<project>.supabase.co/storage/v1/object/public/product-images/<path>
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);

  if (index === -1) return;

  const path = url.slice(index + marker.length);
  if (!path) return;

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from("product-images").remove([path]);

  if (error) {
    console.error("Failed to delete image:", error.message);
  }
}
