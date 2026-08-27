/* eslint-disable @next/next/no-img-element */

import type { SyntheticEvent } from "react";

const productImagePlaceholder = "/product-placeholder.svg";

const sizeClassNames = {
  card: "h-44 w-full",
  lg: "h-24 w-24",
  md: "h-20 w-20",
  sm: "h-14 w-14",
};

function handleProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith(productImagePlaceholder)) {
    return;
  }

  image.src = productImagePlaceholder;
  image.alt = "รูปสินค้าสำรอง";
}

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
    <img
      alt={alt}
      className={`${sizeClassNames[size]} shrink-0 rounded-md border border-[var(--line)] bg-slate-50 object-cover ${className}`}
      onError={handleProductImageError}
      src={src || productImagePlaceholder}
    />
  );
}
