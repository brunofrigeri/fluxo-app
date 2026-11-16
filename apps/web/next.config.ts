import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shared workspace packages ship TypeScript source.
  transpilePackages: ["@fluxo/copy", "@fluxo/domain", "@fluxo/forms", "@fluxo/tokens", "@fluxo/ui-web"],
  experimental: {
    // Next 15 defaults dynamic pages to a 0s client router cache, so every revisit
    // refetches and re-shows the loading.tsx fallback, even right after you were there.
    // Bump it so a revisit within this window reuses the cached RSC payload instantly.
    // Mutations still bypass this: revalidatePath() (used by every create/update/delete
    // action in this app) explicitly expires the cache for that path.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
