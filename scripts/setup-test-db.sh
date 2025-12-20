#!/bin/bash
set -e

TEST_DB="roiheimen_test"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Resetting test database: $TEST_DB"

# Determine how to run psql:
# - If running as root: use sudo -u postgres psql
# - If in CI (GitHub Actions): use sudo -u postgres psql (runner user can't connect directly)
# - Otherwise: use plain psql (local dev with peer auth)
if [ "$(id -u)" = "0" ]; then
    PSQL="sudo -u postgres psql"
elif [ -n "$CI" ]; then
    PSQL="sudo -u postgres psql"
else
    PSQL="psql"
fi

# Terminate any existing connections to the test database
$PSQL -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

# Drop and recreate database
$PSQL -q -c "DROP DATABASE IF EXISTS $TEST_DB;" > /dev/null 2>&1
$PSQL -q -c "CREATE DATABASE $TEST_DB;" > /dev/null 2>&1

# Drop roles that db.sql will recreate (they exist globally, not per-database)
# This ensures db.sql can run cleanly even if roles exist from previous runs
$PSQL -q -c "DROP ROLE IF EXISTS roiheimen_user;" > /dev/null 2>&1 || true
$PSQL -q -c "DROP ROLE IF EXISTS roiheimen_person;" > /dev/null 2>&1 || true
$PSQL -q -c "DROP ROLE IF EXISTS roiheimen_anonymous;" > /dev/null 2>&1 || true
$PSQL -q -c "DROP ROLE IF EXISTS roiheimen_postgraphile;" > /dev/null 2>&1 || true

# Apply schema (includes test data: meeting meet20, users with password 'test')
# Redirect all output (psql -q only suppresses status messages, not query results)
cd "$PROJECT_ROOT/pkg/server" && $PSQL -q -d "$TEST_DB" -f db.sql > /dev/null 2>&1

# Grant replication permission to roiheimen_postgraphile for live subscriptions (wal2json)
# This is needed in CI where we need TCP connections instead of peer auth
if [ -n "$CI" ]; then
    $PSQL -q -c "ALTER ROLE roiheimen_postgraphile WITH REPLICATION;" > /dev/null 2>&1
fi

echo "Test database $TEST_DB is ready."
