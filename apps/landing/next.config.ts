import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shared workspace packages ship TypeScript source.
  transpilePackages: ["@fluxo/copy", "@fluxo/tokens", "@fluxo/ui-web"],
};

export default nextConfig;
