#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cleanup() {
  echo "Stopping servers..."
  kill $API_PID $WEB_PID 2>/dev/null || true
  wait $API_PID $WEB_PID 2>/dev/null || true
}
trap cleanup EXIT

# Step 1: Setup test database
echo "Setting up test database..."
bash "$SCRIPT_DIR/setup-test-db.sh"

# Step 2: Start API server with test database (in subshell to handle cd)
echo "Starting API server..."
(
  cd "$PROJECT_ROOT/pkg/server"
  PGHOST=localhost \
  DATABASE_URL=postgres://roiheimen_postgraphile:xyz@localhost/roiheimen_test \
  OWNER_DATABASE_URL=postgres:///roiheimen_test \
  exec node server.js
) &
API_PID=$!

# Step 3: Start web server (in subshell to handle cd)
echo "Starting web server..."
(
  cd "$PROJECT_ROOT/pkg/web"
  exec yarn start
) &
WEB_PID=$!

# Wait for servers to be ready
echo "Waiting for servers..."
for i in {1..20}; do
  if curl -s http://localhost:3000/graphiql > /dev/null 2>&1 && curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "Servers are ready!"
    break
  fi
  if [ $i -eq 20 ]; then
    echo "ERROR: Servers failed to start"
    exit 1
  fi
  echo "Waiting... ($i/20)"
  sleep 1
done

# Step 4: Run tests
echo "Running tests..."
cd "$PROJECT_ROOT/e2e"
npx playwright test --reporter=list "$@"
