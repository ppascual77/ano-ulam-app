#!/bin/bash
# Builds a throwaway PostgreSQL from every migration and runs the security
# checks against it. Nothing touches the live project.
#
#   bash supabase/security-tests/run.sh
#
# Needs PostgreSQL 15+ installed (initdb, pg_ctl, psql; e.g. `brew install
# postgresql@16`). Set PG_BIN to its bin folder if those aren't on your PATH.
# Run as your normal user: PostgreSQL refuses to run as root (as root, the
# server commands run as the `postgres` user instead).
#
# Exits non-zero if a migration fails to apply or any check fails.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"

PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || command -v initdb 2>/dev/null || true)")}"
if [ ! -x "$PG_BIN/initdb" ]; then
  for dir in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
    [ -x "$dir/initdb" ] && PG_BIN="$dir"
  done
fi
if [ ! -x "$PG_BIN/initdb" ]; then
  echo "PostgreSQL not found: install it, or set PG_BIN to the folder with initdb and pg_ctl." >&2
  exit 2
fi

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
as_db_user() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK"

cleanup() {
  as_db_user "'$PG_BIN/pg_ctl' -D '$WORK/data' -m immediate stop" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "Starting a temporary PostgreSQL ($("$PG_BIN/postgres" --version 2>/dev/null))..."
as_db_user "'$PG_BIN/initdb' -D '$WORK/data' -A trust -U postgres >/dev/null" || exit 1
as_db_user "'$PG_BIN/pg_ctl' -D '$WORK/data' -o \"-p $PORT -k '$WORK' -c listen_addresses=''\" -l '$WORK/log' -w start >/dev/null" || { cat "$WORK/log"; exit 1; }

export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
psql -X -q -v ON_ERROR_STOP=1 -f "$HERE/stub.sql" || exit 1

echo "Applying migrations..."
failed=0
for f in "$MIGRATIONS"/*.sql; do
  # pg_cron and pg_net are stood in for by stub.sql.
  if ! sed -E '/^create extension if not exists pg_(cron|net)/Id' "$f" | psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>"$WORK/err"; then
    echo "FAIL $(basename "$f")"; cat "$WORK/err"; failed=1
  fi
done
[ "$failed" = 0 ] || exit 1

psql -X -q -v ON_ERROR_STOP=1 -f "$HERE/seed.sql" || exit 1

echo "Running checks..."
bash "$HERE/security.test.sh" > "$WORK/results.txt"
status=$?
# Every failure, then the section headers and the total.
grep -v '^PASS' "$WORK/results.txt"
[ "${VERBOSE:-0}" = 1 ] && cat "$WORK/results.txt"
exit $status
