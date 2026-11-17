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

import { destinationFor, platformOf } from "../src/lib/stores";

test("store links are optional and read from the environment", () => {
  assert.equal(readUrls({}).appStoreUrl, null);
  assert.equal(readUrls({ NEXT_PUBLIC_PLAY_STORE_URL: "https://play.google.com/x" }).playStoreUrl, "https://play.google.com/x");
});

test("each phone is sent to its own store, everything else to the web app", () => {
  const t = { appStoreUrl: "https://apps.apple.com/x", playStoreUrl: "https://play.google.com/x", webUrl: "https://app.example.com/login" };
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
  const pixel = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  assert.equal(destinationFor(platformOf(iphone), t), t.appStoreUrl);
  assert.equal(destinationFor(platformOf(pixel), t), t.playStoreUrl);
  assert.equal(destinationFor(platformOf(mac), t), t.webUrl);
  assert.equal(destinationFor(platformOf(null), t), t.webUrl);
  // A store that is not published yet falls back to the web app instead of a dead link.
  assert.equal(destinationFor("ios", { ...t, appStoreUrl: null }), t.webUrl);
});
