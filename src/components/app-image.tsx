"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

// Images uploaded to Supabase Storage (public buckets) can be resized and
// converted to WebP/AVIF by Next.js, so phones download a small version
// instead of the full-size upload. Anything else (local SVG placeholders,
// other hosts) is shown as-is.
const supabasePublicImagePattern =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//;

function canOptimize(src: string) {
  return supabasePublicImagePattern.test(src);
}

type AppImageProps = Omit<ImageProps, "src" | "onError"> & {
  // Shown when `src` is empty or fails to load.
  fallbackSrc?: string;
  src?: string | null;
};

export function AppImage({ alt, fallbackSrc, src, ...props }: AppImageProps) {
  const primarySrc = src || fallbackSrc || "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const currentSrc =
    fallbackSrc && failedSrc === primarySrc ? fallbackSrc : primarySrc;

  if (!currentSrc) {
    return null;
  }

  return (
    <Image
      {...props}
      alt={alt}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setFailedSrc(primarySrc);
        }
      }}
      src={currentSrc}
      unoptimized={!canOptimize(currentSrc)}
    />
  );
}
