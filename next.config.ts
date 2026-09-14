import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core запускает браузер из файловой системы — собирать его
  // в бандл нельзя.
  serverExternalPackages: ["@prisma/client", "playwright-core"],
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "storage.yandexcloud.net",
      },
    ],
  },
};

export default nextConfig;
