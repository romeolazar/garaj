import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Backup archives include uploaded photos and invoices.
      bodySizeLimit: "200mb"
    }
  }
};

export default nextConfig;
