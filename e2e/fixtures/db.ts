/**
 * Database helpers for E2E tests
 *
 * Low-level database access for setup and verification.
 * These are pure functions, not fixtures.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Run SQL query against the test database, returns first row
 */
export async function query(sql: string): Promise<string> {
  const { stdout } = await execAsync(
    `PSQLRC=/dev/null psql -d roiheimen_test -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" } }
  );
  const lines = stdout
    .trim()
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("Pager") &&
        !line.startsWith("Expanded") &&
        !line.startsWith("Null")
    );
  return lines[0] || "";
}

/**
 * Run SQL query that returns multiple rows
 */
export async function queryRows(sql: string): Promise<string[]> {
  const { stdout } = await execAsync(
    `PSQLRC=/dev/null psql -d roiheimen_test -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" } }
  );
  return stdout
    .trim()
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("Pager") &&
        !line.startsWith("Expanded") &&
        !line.startsWith("Null")
    );
}

// ============================================================================
// Unique ID Generators
// ============================================================================

export function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export function uniqueSlug(): string {
  return `test-org-${Date.now()}-${Math.random().toString(36).slice(2)}`.toLowerCase();
}

export function uniqueMeetingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `m-${timestamp}-${random}`.toLowerCase();
}

// ============================================================================
// Database Lookup Helpers
// ============================================================================

export async function getUserId(email: string): Promise<number> {
  const result = await query(
    `SELECT id FROM roiheimen.user_account WHERE lower(email) = lower('${email}')`
  );
  return parseInt(result, 10);
}

export async function getVerificationToken(email: string): Promise<string | null> {
  const result = await query(`
    SELECT ev.token FROM roiheimen_private.email_verification ev
    JOIN roiheimen.user_account ua ON ev.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
    AND ev.used_at IS NULL
    ORDER BY ev.created_at DESC LIMIT 1
  `);
  return result || null;
}

export async function getPasswordResetToken(email: string): Promise<string | null> {
  const result = await query(`
    SELECT pr.token FROM roiheimen_private.password_reset pr
    JOIN roiheimen.user_account ua ON pr.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
    AND pr.used_at IS NULL
    ORDER BY pr.created_at DESC LIMIT 1
  `);
  return result || null;
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const result = await query(`
    SELECT uc.email_verified FROM roiheimen_private.user_credentials uc
    JOIN roiheimen.user_account ua ON uc.user_id = ua.id
    WHERE lower(ua.email) = lower('${email}')
  `);
  return result === "t";
}

export async function getOrganization(
  slug: string
): Promise<{ id: number; name: string; slug: string } | null> {
  const result = await query(
    `SELECT id, name, slug FROM roiheimen.organization WHERE slug = '${slug}'`
  );
  if (!result) return null;
  const [id, name, slug_] = result.split("|");
  return { id: parseInt(id, 10), name, slug: slug_ };
}

export async function getOrganizationMember(
  orgId: number,
  userId: number
): Promise<{ role: string } | null> {
  const result = await query(
    `SELECT role FROM roiheimen.organization_member WHERE organization_id = ${orgId} AND user_id = ${userId}`
  );
  if (!result) return null;
  return { role: result };
}

export async function getMeeting(
  meetingId: string
): Promise<{ id: string; title: string; organizationId: number } | null> {
  const result = await query(
    `SELECT id, title, organization_id FROM roiheimen.meeting WHERE id = '${meetingId}'`
  );
  if (!result) return null;
  const [id, title, orgId] = result.split("|");
  return { id, title, organizationId: parseInt(orgId, 10) };
}

export async function getInviteFromDb(
  code: string
): Promise<{ id: number; meetingId: string; maxUses: number | null; usesCount: number } | null> {
  const result = await query(
    `SELECT id, meeting_id, max_uses, uses_count FROM roiheimen.meeting_invite WHERE code = '${code}'`
  );
  if (!result) return null;
  const [id, meetingId, maxUses, usesCount] = result.split("|");
  return {
    id: parseInt(id, 10),
    meetingId,
    maxUses: maxUses ? parseInt(maxUses, 10) : null,
    usesCount: parseInt(usesCount, 10),
  };
}
