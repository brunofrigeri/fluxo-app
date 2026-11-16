import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { gateway } from "ai";

/**
 * Where the app under test runs:
 * - CI starts the production build itself and sets APP_URL (see .github/workflows/ci.yml).
 * - Locally, with no APP_URL, the runner starts `npm run dev` (or reuses one already on :3000).
 * Tests live in tests/**\/*.e2e.ts. Run them with `npm run test:e2e`.
 */
const appUrl = process.env.APP_URL;

export default {
  // Only needed by `agent.act/assert` steps (natural-language goals). Deterministic tests need no key.
  // The Vercel AI Gateway reads AI_GATEWAY_API_KEY.
  ...(process.env.AI_GATEWAY_API_KEY
    ? { agents: { default: { model: gateway("openai/gpt-6-luna-fast"), system: "You are a thorough QA agent. Verify every outcome." } } }
    : {}),
  targets: [
    {
      engine: web(),
      app: appUrl
        ? { url: appUrl }
        : { url: "http://localhost:3000", command: { executable: "npm", args: ["run", "dev"], reuseExisting: true } },
    },
  ],
} satisfies E2EConfig;
