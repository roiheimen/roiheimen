/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to:
 * 1. Set up the test database
 * 2. Start the API server
 * 3. Start the web server
 *
 * Server PIDs are stored in environment variables for globalTeardown.
 */

import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);
const projectRoot = path.resolve(__dirname, "..");
const CI = process.env.CI === "true";
const pidFile = path.join(__dirname, ".server-pids.json");

// In CI, we need TCP connections. Locally, Unix socket with peer auth works.
const DATABASE_URL = "postgres://roiheimen_postgraphile:xyz@localhost/roiheimen_test";
const OWNER_DATABASE_URL = CI
  ? "postgres://roiheimen_postgraphile:xyz@localhost/roiheimen_test"
  : "postgres:///roiheimen_test";

async function waitForServer(url: string, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start in time`);
}

async function globalSetup() {
  // Step 1: Setup test database
  console.log("Setting up test database...");
  try {
    await execAsync(`bash ${projectRoot}/scripts/setup-test-db.sh`, {
      env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
    });
    console.log("Test database ready.");
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    console.error("Database setup failed!");
    if (error.stdout) console.error("stdout:", error.stdout);
    if (error.stderr) console.error("stderr:", error.stderr);
    throw new Error(`Database setup failed: ${error.message || err}`);
  }

  // Step 2: Start API server
  console.log("Starting API server...");
  const apiServer = spawn("node", ["server.js"], {
    cwd: path.join(projectRoot, "pkg/server"),
    env: {
      ...process.env,
      DATABASE_URL,
      OWNER_DATABASE_URL,
      NODE_ENV: "test",
    },
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });

  // Only log errors
  apiServer.stderr?.on("data", (d) => {
    const msg = d.toString().trim();
    // Filter out expected retry messages
    if (!msg.includes("We'll try again")) {
      console.error("[API]", msg);
    }
  });

  // Step 3: Start web server
  console.log("Starting web server...");
  const webServer = spawn("npx", ["es-dev-server"], {
    cwd: path.join(projectRoot, "pkg/web"),
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });

  webServer.stderr?.on("data", (d) => {
    const msg = d.toString().trim();
    // Filter out noisy messages
    if (!msg.includes("Disconnected from es-dev-server") && !msg.includes("premature close")) {
      console.error("[WEB]", msg);
    }
  });

  // Store PIDs for teardown
  fs.writeFileSync(
    pidFile,
    JSON.stringify({
      apiPid: apiServer.pid,
      webPid: webServer.pid,
    })
  );

  // Wait for both servers to be ready
  console.log("Waiting for servers...");
  await Promise.all([
    waitForServer("http://localhost:3000/graphiql"),
    waitForServer("http://localhost:8080"),
  ]);
  console.log("Servers ready.");

  // Unref the processes so they don't block Node from exiting
  apiServer.unref();
  webServer.unref();
}

export default globalSetup;
