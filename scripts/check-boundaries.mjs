#!/usr/bin/env node
// Enforces the monorepo's dependency rules (see README "Monorepo layout"):
//   - apps never import other apps; packages never import apps
//   - base packages stay platform-free: only the packages listed below, no React / Next / Supabase / React Native
// Run: node scripts/check-boundaries.mjs   (also in CI)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/** What each shared package may import (workspace packages + npm packages). */
const ALLOWED = {
  tokens: { workspace: [], npm: [] },
  copy: { workspace: [], npm: [] },
  forms: { workspace: [], npm: ["zod"] },
  api: { workspace: ["copy", "domain", "forms"], npm: ["@supabase/supabase-js", "zod"] },
  domain: { workspace: ["copy"], npm: ["zod"] },
  // The only shared package that may use React (web only; mobile has its own native kit).
  "ui-web": { workspace: ["copy", "tokens"], npm: ["react"] },
};

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    if (["node_modules", ".next", ".turbo", "dist"].includes(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : [];
  });

const importsOf = (file) => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/(?:from\s+|import\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);
};

const errors = [];

for (const [pkg, rule] of Object.entries(ALLOWED)) {
  for (const file of walk(join(ROOT, "packages", pkg))) {
    for (const spec of importsOf(file)) {
      const where = `${relative(ROOT, file)}: "${spec}"`;
      if (spec.startsWith(".") || spec.startsWith("node:")) continue; // relative paths stay inside; node built-ins are fine in tests/scripts
      if (spec.startsWith("@fluxo/")) {
        const target = spec.split("/")[1];
        if (target !== pkg && !rule.workspace.includes(target)) errors.push(`${where} (@fluxo/${pkg} may not depend on @fluxo/${target})`);
      } else {
        const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        const isTest = file.includes("/test/") || file.includes("/scripts/");
        if (!rule.npm.includes(name) && !(isTest && ["tsx"].includes(name))) errors.push(`${where} (@fluxo/${pkg} may not import "${name}")`);
      }
    }
  }
}

const apps = readdirSync(join(ROOT, "apps"));
for (const app of apps) {
  for (const file of walk(join(ROOT, "apps", app))) {
    for (const spec of importsOf(file)) {
      if (/^(\.\.\/)+apps\//.test(spec) || /^@fluxo\/(web|landing|mobile)\b/.test(spec)) errors.push(`${relative(ROOT, file)}: "${spec}" (apps may not import other apps)`);
    }
  }
}

if (errors.length) {
  console.error("Dependency rule violations:\n" + errors.map((e) => "  " + e).join("\n"));
  process.exit(1);
}
console.log("Dependency rules OK");
