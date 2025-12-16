#!/bin/bash
set -e

TEST_DB="roiheimen_test"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Resetting test database: $TEST_DB"

# Terminate any existing connections to the test database
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Drop and recreate database
psql -c "DROP DATABASE IF EXISTS $TEST_DB;"
psql -c "CREATE DATABASE $TEST_DB;"

# Apply schema (includes test data: meeting meet20, users with password 'test')
psql -d "$TEST_DB" < "$PROJECT_ROOT/pkg/server/db.sql"

echo "Test database $TEST_DB is ready."
