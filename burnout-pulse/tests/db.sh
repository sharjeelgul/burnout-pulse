#!/usr/bin/env bash
# Runs the schema and the attack replay against a throwaway Postgres.
# Usage: PGHOST=/path/to/socket PGPORT=5433 PGUSER=postgres bash tests/db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -q -f tests/db_shim.sql >/dev/null
psql -q -d bp -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -v NOTICE || true
out=$(psql -d bp -f tests/db_attack.sql 2>&1)
echo "$out"
if echo "$out" | grep -q "FAIL"; then echo "DB TESTS FAILED"; exit 1; fi
n=$(echo "$out" | grep -c "NOTICE:  PASS")
[ "$n" -ge 5 ] || { echo "DB TESTS INCOMPLETE ($n passes)"; exit 1; }
echo "DB TESTS PASSED ($n assertions)"
