/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests to clean up servers started by globalSetup.
 */

import fs from "fs";
import path from "path";

const pidFile = path.join(__dirname, ".server-pids.json");

async function globalTeardown() {
  try {
    if (fs.existsSync(pidFile)) {
      const pids = JSON.parse(fs.readFileSync(pidFile, "utf-8"));

      // Kill API server process group
      if (pids.apiPid) {
        try {
          process.kill(-pids.apiPid, "SIGTERM");
        } catch {
          try {
            process.kill(pids.apiPid, "SIGTERM");
          } catch {
            // Process already dead
          }
        }
      }

      // Kill web server process group
      if (pids.webPid) {
        try {
          process.kill(-pids.webPid, "SIGTERM");
        } catch {
          try {
            process.kill(pids.webPid, "SIGTERM");
          } catch {
            // Process already dead
          }
        }
      }

      // Clean up pid file
      fs.unlinkSync(pidFile);
    }
  } catch (err) {
    // Ignore errors during cleanup
  }
}

export default globalTeardown;
