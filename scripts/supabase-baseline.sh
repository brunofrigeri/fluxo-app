#!/usr/bin/env bash
# One-time step before CI can apply migrations: tells the production database that the migrations you already ran by
# hand in the SQL editor are applied, so `supabase db push` only runs the ones after them.
#
#   supabase login
#   supabase link --project-ref <your project ref>
#   scripts/supabase-baseline.sh 0013        # the LAST migration already applied in production
#
# It only writes the migration history table (supabase_migrations.schema_migrations). It never runs a migration.
# Check first with `supabase migration list`: the Remote column should be empty before, and filled up to the number after.
set -euo pipefail
LAST="${1:-}"
if ! [[ "$LAST" =~ ^[0-9]{4}$ ]]; then
  echo "Usage: $0 <last applied migration number, e.g. 0013>" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
versions=()
for f in "$ROOT"/supabase/migrations/*.sql; do
  v="$(basename "$f")"; v="${v%%_*}"
  [[ "$v" > "$LAST" ]] && continue
  versions+=("$v")
done
if [ "${#versions[@]}" -eq 0 ]; then echo "No migration up to $LAST." >&2; exit 1; fi
echo "Marking as applied in production: ${versions[*]}"
read -r -p "Is every one of these already applied there? Type yes to continue: " answer
[ "$answer" = "yes" ] || { echo "Cancelled."; exit 1; }
supabase migration repair --status applied "${versions[@]}"
supabase migration list
