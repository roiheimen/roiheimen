/**
 * Main fixtures export
 *
 * Combines all fixtures and handles server lifecycle.
 * Import { test, expect } from this file in all tests.
 */

import { test as base, mergeTests, expect } from "@playwright/test";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import path from "path";

import { authFixtures, AuthFixtures } from "./auth";
import { orgFixtures, OrgFixtures } from "./org";
import { meetingFixtures, MeetingFixtures } from "./meeting";

// Re-export everything tests might need
export { expect } from "@playwright/test";
export { GraphQLClient, setJwt, getJwt, clearJwt, decodeJwtClaims } from "./api";
export {
  query,
  queryRows,
  uniqueEmail,
  uniqueSlug,
  uniqueMeetingId,
  getUserId,
  getVerificationToken,
  getPasswordResetToken,
  isEmailVerified,
  getOrganization,
  getOrganizationMember,
  getMeeting,
  getInviteFromDb,
} from "./db";
export {
  createVerifiedUser,
  loginUser,
  createAndLoginUser,
  registerUserViaUI,
  loginUserViaUI,
  createVerifiedUserViaUI,
} from "./auth";
export type { UserCredentials, AuthenticatedUser } from "./auth";
export type { Organization, OrgOwnerFixture } from "./org";
export type {
  Meeting,
  MeetingInvite,
  Sak,
  MeetingAdminFixture,
  MeetingWithInviteFixture,
  MeetingWithSakFixture,
  ParticipantFixture,
} from "./meeting";

// ============================================================================
// Server Management
// ============================================================================

const execAsync = promisify(exec);
const projectRoot = path.resolve(__dirname, "../..");
const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";

let apiServer: ChildProcess | null = null;
let webServer: ChildProcess | null = null;
let setupDone = false;

function log(...args: unknown[]) {
  if (DEBUG) console.log("[fixtures]", ...args);
}

function logError(...args: unknown[]) {
  if (DEBUG) console.error("[fixtures]", ...args);
}

async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
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

async function setupServers() {
  if (setupDone) return;

  // Step 1: Setup test database
  console.log("Setting up test database...");
  await execAsync(`bash ${projectRoot}/scripts/setup-test-db.sh`, {
    env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
  });
  console.log("Test database ready.");

  // Step 2: Start API server
  log("Starting API server...");
  apiServer = spawn("node", ["server.js"], {
    cwd: path.join(projectRoot, "pkg/server"),
    env: {
      ...process.env,
      DATABASE_URL: "postgres://roiheimen_postgraphile:xyz@localhost/roiheimen_test",
      OWNER_DATABASE_URL: "postgres:///roiheimen_test",
      NODE_ENV: "test",
    },
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  apiServer.stderr?.on("data", (d) => logError("[API]", d.toString().trim()));
  apiServer.stdout?.on("data", (d) => log("[API]", d.toString().trim()));

  // Step 3: Start web server
  log("Starting web server...");
  webServer = spawn("npx", ["es-dev-server"], {
    cwd: path.join(projectRoot, "pkg/web"),
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  webServer.stderr?.on("data", (d) => logError("[WEB]", d.toString().trim()));
  webServer.stdout?.on("data", (d) => log("[WEB]", d.toString().trim()));

  // Wait for both servers
  await Promise.all([
    waitForServer("http://localhost:3000/graphiql"),
    waitForServer("http://localhost:8080"),
  ]);
  log("Servers ready.");

  setupDone = true;
}

function teardownServers() {
  if (apiServer?.pid) {
    try {
      process.kill(-apiServer.pid, "SIGTERM");
    } catch {
      apiServer.kill("SIGTERM");
    }
    apiServer = null;
  }
  if (webServer?.pid) {
    try {
      process.kill(-webServer.pid, "SIGTERM");
    } catch {
      webServer.kill("SIGTERM");
    }
    webServer = null;
  }
  setupDone = false;
}

// Cleanup on process exit
process.on("exit", teardownServers);
process.on("SIGINT", () => {
  teardownServers();
  process.exit();
});
process.on("SIGTERM", () => {
  teardownServers();
  process.exit();
});

// ============================================================================
// Combined Fixtures
// ============================================================================

type ServerFixtures = {
  /** Ensures servers are running before test */
  servers: void;
};

const serverFixtures = base.extend<ServerFixtures>({
  servers: [
    async ({}, use) => {
      await setupServers();
      await use();
    },
    { auto: true },
  ],
});

// Merge all fixtures together
// Note: mergeTests creates a new test function that includes all fixtures
type AllFixtures = ServerFixtures & AuthFixtures & OrgFixtures & MeetingFixtures;

export const test = mergeTests(serverFixtures, authFixtures, orgFixtures, meetingFixtures) as ReturnType<
  typeof base.extend<AllFixtures>
>;
