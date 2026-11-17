// Guards what the Supabase CLI relies on when it applies migrations: files are named NNNN_description.sql, the
// numbers are unique and have no gaps. The CLI orders by that number and keeps a history of applied ones, so two files
// with the same number, or a number slipped in before an applied one, would break `supabase db push` in production.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => !f.startsWith(".")).sort();
const problems = [];

files.forEach((f, i) => {
  const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) return problems.push(`${f}: name must look like 0014_short_description.sql (lowercase, digits and underscores)`);
  const expected = String(i + 1).padStart(4, "0");
  if (m[1] !== expected) problems.push(`${f}: expected number ${expected} (numbers must be unique and without gaps)`);
});

if (problems.length) {
  console.error(`Migration naming problems:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Migrations OK (${files.length}).`);
