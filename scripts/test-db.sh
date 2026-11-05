#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres database and runs the SQL tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
# Needs a Postgres 15+ server you can create databases on. Never point this at Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="lodgelock_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql_q() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
psql_q -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "migrate: $f"
  psql_q -1 -f "$f"
done
psql_q -1 -f supabase/seed.sql
for t in supabase/tests/*_paths.sql supabase/tests/test_*.sql; do
  [ -e "$t" ] || continue
  echo "test: $t"
  psql_q -f "$t" 2>&1 | grep -v '^$'
done
