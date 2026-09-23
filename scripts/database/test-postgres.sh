#!/usr/bin/env bash
set -euo pipefail
# Always creates an isolated cluster; does not read .env or contact Supabase.
if command -v pg_config >/dev/null; then export PATH="$(pg_config --bindir):$PATH"; fi
for binary in initdb pg_ctl; do command -v "$binary" >/dev/null || { echo "Install PostgreSQL to run integration tests."; exit 1; }; done
cluster="$(mktemp -d /tmp/kuruttina-postgres.XXXXXXXX)"
cleanup() {
  pg_ctl -D "$cluster/data" -m immediate -w stop >/dev/null 2>&1 || true
  case "$cluster" in /tmp/kuruttina-postgres.*) rm -rf -- "$cluster";; esac
}
trap cleanup EXIT
initdb -D "$cluster/data" -U postgres --auth=trust --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$cluster/data" -l "$cluster/server.log" -o "-k $cluster -h '' -p 5432" -w start >/dev/null
KURUTTINA_TEST_POSTGRES_HOST="$cluster" npx vitest run tests/database.integration.test.ts
