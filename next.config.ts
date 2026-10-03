import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Lets next/image (see src/components/app-image.tsx) resize and convert
    // images uploaded to Supabase Storage public buckets.
    remotePatterns: [
      {
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
