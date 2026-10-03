"use client";

import { AppImage } from "@/components/app-image";

const productImagePlaceholder = "/product-placeholder.svg";

// Rendered size in CSS pixels, so the browser downloads a matching image.
const imageSizes = {
  card: "(max-width: 640px) 100vw, 320px",
  lg: "96px",
  md: "80px",
  sm: "56px",
};

const sizeClassNames = {
  card: "h-44 w-full",
  lg: "h-24 w-24",
  md: "h-20 w-20",
  sm: "h-14 w-14",
};

export function ProductImageThumb({
  alt,
  className = "",
  size = "md",
  src,
}: {
  alt: string;
  className?: string;
  size?: keyof typeof sizeClassNames;
  src?: string | null;
}) {
  return (
    <AppImage
      alt={alt}
      className={`${sizeClassNames[size]} shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover ${className}`}
      fallbackSrc={productImagePlaceholder}
      height={320}
      sizes={imageSizes[size]}
      src={src}
      width={320}
    />
  );
}
