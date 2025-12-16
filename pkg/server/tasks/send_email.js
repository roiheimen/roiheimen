/**
 * Graphile Worker task for sending emails
 *
 * This task is triggered by database functions when email needs to be sent.
 * It handles verification emails and password reset emails.
 *
 * Payload format:
 * - type: "verification" | "password_reset"
 * - email: recipient email address
 * - token: verification or reset token
 * - name: (optional) user's name for personalization
 */

const { sendVerificationEmail, sendPasswordResetEmail } = require("../email.js");

module.exports = async (payload, helpers) => {
  const { type, email, token, name } = payload;

  helpers.logger.info(`Sending ${type} email to ${email}`);

  try {
    switch (type) {
      case "verification":
        await sendVerificationEmail(email, token, name);
        helpers.logger.info(`Verification email sent to ${email}`);
        break;

      case "password_reset":
        await sendPasswordResetEmail(email, token);
        helpers.logger.info(`Password reset email sent to ${email}`);
        break;

      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  } catch (error) {
    helpers.logger.error(`Failed to send ${type} email to ${email}: ${error.message}`);
    throw error; // Re-throw to mark job as failed for retry
  }
};
