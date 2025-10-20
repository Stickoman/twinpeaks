"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface PhotoCaptureProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload to our API
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", "delivery-proofs");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch {
      // Fall back to local preview
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (value) {
    return (
      <div className="relative">
        <Image
          src={value}
          alt="Delivery photo"
          width={400}
          height={300}
          className="w-full rounded-lg object-cover"
        />
        <Button
          variant="destructive"
          size="icon-sm"
          className="absolute right-2 top-2"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="Take a delivery photo"
      onClick={() => inputRef.current?.click()}
      className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      <Camera className="size-8" />
      <span className="text-sm">Tap to take a photo</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
    </button>
  );
}
