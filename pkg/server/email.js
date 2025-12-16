/**
 * Email service for Roiheimen
 *
 * In dev mode (NODE_ENV !== 'production'), emails are logged to console instead of sent.
 * In production, uses SMTP via Nodemailer.
 *
 * Environment variables (production only):
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 * - SMTP_FROM: From address (default: "Roiheimen <noreply@roiheimen.no>")
 * - APP_URL: Base URL for the application (default: http://localhost:8080)
 */

const nodemailer = require("nodemailer");
const { DEV } = require("./config.js");

// Email configuration from environment
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "Roiheimen <noreply@roiheimen.no>";
const APP_URL = process.env.APP_URL || "http://localhost:8080";

// Create transporter - null in dev mode (we'll log instead)
let transporter = null;

if (!DEV && SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Send an email (or log it in dev mode)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional)
 */
async function sendEmail({ to, subject, text, html }) {
  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject,
    text,
    html: html || text,
  };

  if (DEV || !transporter) {
    // Dev mode: log to console
    console.log("\n" + "=".repeat(60));
    console.log("EMAIL (dev mode - not sent)");
    console.log("=".repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("-".repeat(60));
    console.log(text);
    console.log("=".repeat(60) + "\n");
    return { messageId: `dev-${Date.now()}` };
  }

  // Production: send via SMTP
  return await transporter.sendMail(mailOptions);
}

/**
 * Send email verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {string} [name] - User's name (optional)
 */
async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${APP_URL}/stadfest-epost.html?token=${token}`;
  const greeting = name ? `Hei ${name}!` : "Hei!";

  const text = `${greeting}

Velkomen til Roiheimen!

Klikk på lenkja under for å stadfeste e-postadressa di:

${verifyUrl}

Lenkja er gyldig i 24 timar.

Om du ikkje har registrert deg på Roiheimen, kan du sjå bort frå denne e-posten.

Med venleg helsing,
Roiheimen`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2b2c3a;">Velkomen til Roiheimen!</h1>
  <p>${greeting}</p>
  <p>Klikk på knappen under for å stadfeste e-postadressa di:</p>
  <p style="margin: 30px 0;">
    <a href="${verifyUrl}" style="background-color: #2b2c3a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Stadfest e-post
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">
    Eller kopier denne lenkja til nettlesaren din:<br>
    <a href="${verifyUrl}">${verifyUrl}</a>
  </p>
  <p style="color: #666; font-size: 14px;">Lenkja er gyldig i 24 timar.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Om du ikkje har registrert deg på Roiheimen, kan du sjå bort frå denne e-posten.
  </p>
</body>
</html>`;

  return await sendEmail({
    to: email,
    subject: "Stadfest e-postadressa di - Roiheimen",
    text,
    html,
  });
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 */
async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${APP_URL}/nullstill-passord.html?token=${token}`;

  const text = `Hei!

Vi har fått ein førespurnad om å nullstille passordet ditt på Roiheimen.

Klikk på lenkja under for å velje eit nytt passord:

${resetUrl}

Lenkja er gyldig i 1 time.

Om du ikkje har bedt om å nullstille passordet, kan du sjå bort frå denne e-posten. Passordet ditt blir ikkje endra.

Med venleg helsing,
Roiheimen`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2b2c3a;">Nullstill passord</h1>
  <p>Hei!</p>
  <p>Vi har fått ein førespurnad om å nullstille passordet ditt på Roiheimen.</p>
  <p>Klikk på knappen under for å velje eit nytt passord:</p>
  <p style="margin: 30px 0;">
    <a href="${resetUrl}" style="background-color: #2b2c3a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Nullstill passord
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">
    Eller kopier denne lenkja til nettlesaren din:<br>
    <a href="${resetUrl}">${resetUrl}</a>
  </p>
  <p style="color: #666; font-size: 14px;">Lenkja er gyldig i 1 time.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Om du ikkje har bedt om å nullstille passordet, kan du sjå bort frå denne e-posten.
    Passordet ditt blir ikkje endra.
  </p>
</body>
</html>`;

  return await sendEmail({
    to: email,
    subject: "Nullstill passord - Roiheimen",
    text,
    html,
  });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  APP_URL,
  DEV,
};
