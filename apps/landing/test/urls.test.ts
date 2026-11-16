import assert from "node:assert/strict";
import { test } from "node:test";
import { landing } from "@fluxo/copy";
import { icons } from "@fluxo/tokens";

import { readUrls } from "../src/lib/urls";

test("CTA links point at the app's signup and login, without double slashes", () => {
  const u = readUrls({ NEXT_PUBLIC_APP_URL: "https://app.example.com///" });
  assert.equal(u.signUpUrl, "https://app.example.com/signup");
  assert.equal(u.signInUrl, "https://app.example.com/login");
});

test("footer links are hidden until the business provides them, never a placeholder", () => {
  const off = readUrls({ NEXT_PUBLIC_CONTACT_EMAIL: "  ", NEXT_PUBLIC_TERMS_URL: "" });
  assert.equal(off.termsUrl, null);
  assert.equal(off.privacyUrl, null);
  assert.equal(off.contact, null);

  const on = readUrls({ NEXT_PUBLIC_TERMS_URL: "https://example.com/termos", NEXT_PUBLIC_CONTACT_EMAIL: "oi@example.com" });
  assert.equal(on.termsUrl, "https://example.com/termos");
  assert.deepEqual(on.contact, { label: "oi@example.com", href: "mailto:oi@example.com" });
});

test("every icon the landing uses exists in the design tokens", () => {
  const used = [...landing.audience, ...landing.features.extras, ...landing.trial.items].map((i) => i.icon);
  for (const name of used) assert.ok(name in icons, name);
});

test("the plans are consistent: one highlighted, annual is 10 months of the monthly price", () => {
  const { plans } = landing.pricing;
  assert.equal(plans.filter((p) => p.highlight).length, 1);
  const n = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", "."));
  for (const p of plans) assert.equal(n(p.annual.price), n(p.monthly.price) * 10, p.name);
});

test("no placeholder text ships in the page copy", () => {
  assert.doesNotMatch(JSON.stringify(landing), /\[[A-ZÀ-Ú\s-]+\]|\blorem\b|\bTODO\b/);
});
