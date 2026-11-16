#!/usr/bin/env bash
# Runs the e2e tests on your machine against a THROWAWAY local Supabase (Docker), never your hosted project.
#
#   npm run e2e:local            # all tests
#   npm run e2e:local -- tests/auth.e2e.ts
#
# Needs Docker running. The first run downloads the Supabase images (a few GB).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=3000
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Stop whatever is running there first: it could be pointing at a real database." >&2
  exit 1
fi

SUPABASE="npx --yes supabase"
$SUPABASE start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor >/dev/null
eval "$($SUPABASE status -o env)"

# These override anything in .env.local, so the app can only talk to the local database.
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
echo "App database: $NEXT_PUBLIC_SUPABASE_URL"

npm run build
npm run start -- -p $PORT >.e2e-app.log 2>&1 &
APP_PID=$!
trap 'kill $APP_PID 2>/dev/null || true; rm -f .e2e-app.log' EXIT

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login" && break
  sleep 1
done

APP_URL="http://127.0.0.1:$PORT" E2E_TELEMETRY_DISABLED=1 npx e2e run --reporter list,junit "$@"
