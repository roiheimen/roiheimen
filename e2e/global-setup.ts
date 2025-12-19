/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to set up the test database.
 * The web servers are started by Playwright's webServer config.
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const projectRoot = path.resolve(__dirname, "..");

async function globalSetup() {
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
}

export default globalSetup;
