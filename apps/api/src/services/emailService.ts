import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../lib/config.js';

// Brand colors for ScanOrbit
const BRAND = {
  primary: '#0f766e', // Teal-700
  primaryDark: '#0d9488', // Teal-600
  primaryLight: '#14b8a6', // Teal-500
  background: '#f8fafc', // Slate-50
  surface: '#ffffff',
  text: '#1e293b', // Slate-800
  textSecondary: '#64748b', // Slate-500
  border: '#e2e8f0', // Slate-200
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Create reusable transporter
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  // Check if SMTP is configured
  if (!config.smtp.host || !config.smtp.user) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

// Base email template wrapper
function wrapInTemplate(content: string, previewText: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>ScanOrbit</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${BRAND.background};
    }
    a {
      color: ${BRAND.primary};
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content {
        padding: 24px 16px !important;
      }
      .code-box {
        font-size: 28px !important;
        letter-spacing: 6px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preview text -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${previewText}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Email container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main content card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="container" style="max-width: 560px; background-color: ${BRAND.surface}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px; border-bottom: 1px solid ${BRAND.border};">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <!-- Logo icon -->
                    <div style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); border-radius: 10px; text-align: center; line-height: 40px; margin-right: 12px; vertical-align: middle;">
                      <span style="color: white; font-size: 20px; font-weight: bold;">S</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; font-weight: 700; color: ${BRAND.text}; letter-spacing: -0.5px;">Scan<span style="color: ${BRAND.primary};">Orbit</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td class="content" style="padding: 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: ${BRAND.background}; border-radius: 0 0 12px 12px; border-top: 1px solid ${BRAND.border};">
              <p style="margin: 0; font-size: 13px; color: ${BRAND.textSecondary}; text-align: center; line-height: 1.6;">
                This email was sent by ScanOrbit.<br>
                If you have questions, contact us at <a href="mailto:support@scanorbit.io" style="color: ${BRAND.primary}; text-decoration: none;">support@scanorbit.io</a>
              </p>
            </td>
          </tr>
        </table>

        <!-- Bottom text -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;">
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.textSecondary};">
                &copy; ${new Date().getFullYear()} ScanOrbit. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Verification email HTML content
function getVerificationEmailHtml(code: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  const content = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: ${BRAND.text};">
      Verify your email address
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      ${greeting}<br><br>
      Thanks for signing up for ScanOrbit! Please use the verification code below to complete your registration.
    </p>

    <!-- Verification code box -->
    <div style="background: linear-gradient(135deg, ${BRAND.background} 0%, #f1f5f9 100%); border: 2px dashed ${BRAND.border}; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
      <p style="margin: 0 0 8px; font-size: 12px; color: ${BRAND.textSecondary}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        Verification Code
      </p>
      <p class="code-box" style="margin: 0; font-size: 36px; font-weight: 700; color: ${BRAND.primary}; letter-spacing: 8px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
        ${code}
      </p>
    </div>

    <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      <strong style="color: ${BRAND.text};">This code will expire in 5 minutes.</strong>
    </p>
    <p style="margin: 0; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      If you didn't create a ScanOrbit account, you can safely ignore this email.
    </p>
  `;

  return wrapInTemplate(content, `Your verification code is ${code}`);
}

// Verification email plain text
function getVerificationEmailText(code: string, name?: string): string {
  const greeting = name ? `Hi ${name}` : 'Hi there';

  return `
${greeting},

Thanks for signing up for ScanOrbit! Please use the verification code below to complete your registration.

Your verification code: ${code}

This code will expire in 5 minutes.

If you didn't create a ScanOrbit account, you can safely ignore this email.

---
ScanOrbit
https://scanorbit.io
  `.trim();
}

// Password reset email HTML content
function getPasswordResetEmailHtml(resetUrl: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  const content = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: ${BRAND.text};">
      Reset your password
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      ${greeting}<br><br>
      We received a request to reset your password. Click the button below to create a new password.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(15, 118, 110, 0.3);">
        Reset Password
      </a>
    </div>

    <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 24px; font-size: 13px; color: ${BRAND.primary}; word-break: break-all; background-color: ${BRAND.background}; padding: 12px; border-radius: 6px;">
      ${resetUrl}
    </p>

    <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      <strong style="color: ${BRAND.text};">This link will expire in 1 hour.</strong>
    </p>
    <p style="margin: 0; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  `;

  return wrapInTemplate(content, 'Reset your ScanOrbit password');
}

// Password reset email plain text
function getPasswordResetEmailText(resetUrl: string, name?: string): string {
  const greeting = name ? `Hi ${name}` : 'Hi there';

  return `
${greeting},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
ScanOrbit
https://scanorbit.io
  `.trim();
}

// Log email in development
function logEmail(to: string, subject: string, text: string): void {
  console.log('\n========== EMAIL (DEV MODE) ==========');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('---------------------------------------');
  console.log(text);
  console.log('=======================================\n');
}

export const emailService = {
  /**
   * Send verification email with 6-digit code
   */
  async sendVerificationEmail(
    email: string,
    code: string,
    name?: string
  ): Promise<EmailResult> {
    const subject = 'Verify your ScanOrbit email';
    const html = getVerificationEmailHtml(code, name);
    const text = getVerificationEmailText(code, name);

    // Check if SMTP is enabled and configured
    const transport = config.smtp.enabled ? getTransporter() : null;

    if (!transport) {
      // Fallback to console logging
      logEmail(email, subject, text);
      return { success: true, messageId: `console-${Date.now()}` };
    }

    // Send via SMTP
    try {
      const info = await transport.sendMail({
        from: config.smtp.from,
        to: email,
        subject,
        text,
        html,
      });

      console.log(`Email sent to ${email}, messageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    name?: string
  ): Promise<EmailResult> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    const subject = 'Reset your ScanOrbit password';
    const html = getPasswordResetEmailHtml(resetUrl, name);
    const text = getPasswordResetEmailText(resetUrl, name);

    // Check if SMTP is enabled and configured
    const transport = config.smtp.enabled ? getTransporter() : null;

    if (!transport) {
      // Fallback to console logging
      logEmail(email, subject, text);
      return { success: true, messageId: `console-${Date.now()}` };
    }

    // Send via SMTP
    try {
      const info = await transport.sendMail({
        from: config.smtp.from,
        to: email,
        subject,
        text,
        html,
      });

      console.log(`Email sent to ${email}, messageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Verify SMTP connection (useful for health checks)
   */
  async verifyConnection(): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) return false;

    try {
      await transport.verify();
      return true;
    } catch {
      return false;
    }
  },
};
