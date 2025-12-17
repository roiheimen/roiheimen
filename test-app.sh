#!/bin/bash
# Quick test script for roiheimen
# Usage: ./test-app.sh [--check-only]

set -e

# Check PostgreSQL
if ! pg_isready -q; then
    echo "PostgreSQL not running. Start it first."
    exit 1
fi

# Check database schema exists
if ! psql -c "SELECT 1 FROM roiheimen.meeting LIMIT 1" &>/dev/null; then
    echo "Database not set up. Run: yarn setup"
    exit 1
fi

if [[ "$1" == "--check-only" ]]; then
    echo "All checks passed. Ready to start."
    exit 0
fi

# Check if already running
if lsof -i :8080 &>/dev/null; then
    echo "Server already running on :8080"
    echo "Open http://localhost:8080"
    echo "Login: num=1000, password=test"
    exit 0
fi

echo "Starting server..."
echo "Login: num=1000, password=test"
echo ""
yarn start
