import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone (server + only the needed node_modules) so the
  // Docker runtime image stays small. Does not change app behaviour.
  output: "standalone",
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
