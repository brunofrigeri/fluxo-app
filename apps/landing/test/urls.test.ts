import assert from "node:assert/strict";
import { test } from "node:test";
import { landing } from "@fluxo/copy";
import { icons } from "@fluxo/tokens";

test("CTA links point at the app's signup and login, without double slashes", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com///";
  const { signInUrl, signUpUrl } = await import("../src/lib/urls");
  assert.equal(signUpUrl, "https://app.example.com/signup");
  assert.equal(signInUrl, "https://app.example.com/login");
});

test("every feature icon exists in the design tokens", () => {
  for (const f of landing.features.items) assert.ok(f.icon in icons, f.icon);
});
