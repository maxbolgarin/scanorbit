import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';
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

// Mask email for logging (PII protection)
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***@***';
  const masked = localPart.length > 2
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : '***';
  return `${masked}@${domain}`;
}

// Create reusable SMTP transporter
let smtpTransporter: Transporter | null = null;

// Create reusable Resend client
let resendClient: Resend | null = null;

function getSmtpTransporter(): Transporter | null {
  if (smtpTransporter) return smtpTransporter;

  // Check if SMTP is configured
  if (!config.email.smtp.host || !config.email.smtp.user) {
    console.warn('SMTP not configured: missing host or user');
    return null;
  }

  if (!config.email.smtp.pass) {
    console.warn('SMTP not configured: missing password');
    return null;
  }

  // Configure transporter with TLS options for Scaleway and other providers
  smtpTransporter = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: config.email.smtp.user,
      pass: config.email.smtp.pass,
    },
    tls: {
      // Don't reject unauthorized certificates (some providers use self-signed certs)
      // For production, you might want to set this to true and add proper CA certs
      rejectUnauthorized: false,
      // Minimum TLS version
      minVersion: 'TLSv1.2',
      // Server name for TLS certificate validation (required when using IP addresses)
      servername: config.email.smtp.host,
    },
    // Debug mode (set to true for detailed logging)
    debug: process.env.NODE_ENV === 'development',
    // Log level for debugging
    logger: process.env.NODE_ENV === 'development',
  });

  return smtpTransporter;
}

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;

  if (!config.email.resend.apiKey) {
    console.warn('Resend not configured: missing API key');
    return null;
  }

  resendClient = new Resend(config.email.resend.apiKey);
  return resendClient;
}

// Send email via Resend HTTP API (bypasses SMTP port blocks)
async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<EmailResult> {
  const client = getResendClient();
  if (!client) {
    return { success: false, error: 'Resend client not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: config.email.from,
      to,
      subject,
      text,
      html,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email sent via Resend to ${maskEmail(to)}, id: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send email via Resend:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Send email via SMTP (existing implementation)
async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<EmailResult> {
  const transport = config.email.smtp.enabled ? getSmtpTransporter() : null;

  if (!transport) {
    // Fallback to console logging
    logEmail(to, subject, text);
    return { success: true, messageId: `console-${Date.now()}` };
  }

  try {
    const info = await transport.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html,
    });

    console.log(`Email sent via SMTP to ${maskEmail(to)}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('Failed to send email via SMTP:', {
      error: errorMessage,
      details: errorDetails,
      smtpHost: config.email.smtp.host,
      smtpPort: config.email.smtp.port,
      smtpUser: config.email.smtp.user ? '***configured***' : 'missing',
    });
    return { success: false, error: errorMessage };
  }
}

// Route email based on configured provider
async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<EmailResult> {
  if (config.email.provider === 'resend') {
    return sendViaResend(to, subject, text, html);
  }
  return sendViaSmtp(to, subject, text, html);
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

// Trial ending email HTML
function getTrialEndingEmailHtml(trialEndsAt: Date, tier: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const endDate = trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const settingsUrl = `${config.frontendUrl}/settings?tab=subscription`;

  const content = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: ${BRAND.text};">
      Your trial is ending soon
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      ${greeting}<br><br>
      Your free trial of the <strong style="color: ${BRAND.text};">${tier}</strong> plan ends on <strong style="color: ${BRAND.text};">${endDate}</strong>.
      Your subscription will automatically continue and your card on file will be charged. No action needed if you'd like to keep your plan.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${settingsUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(15, 118, 110, 0.3);">
        Manage Subscription
      </a>
    </div>

    <p style="margin: 0; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      If you'd like to cancel, you can do so from your subscription settings before the trial ends. Your account will be downgraded to the Free plan.
    </p>
  `;

  return wrapInTemplate(content, 'Your ScanOrbit trial is ending soon');
}

function getTrialEndingEmailText(trialEndsAt: Date, tier: string, name?: string): string {
  const greeting = name ? `Hi ${name}` : 'Hi there';
  const endDate = trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
${greeting},

Your free trial of the ${tier} plan ends on ${endDate}. Your subscription will automatically continue and your card on file will be charged. No action needed if you'd like to keep your plan.

Manage your subscription: ${config.frontendUrl}/settings?tab=subscription

If you'd like to cancel, you can do so from your subscription settings before the trial ends. Your account will be downgraded to the Free plan.

---
ScanOrbit
https://scanorbit.io
  `.trim();
}

// Payment failed email HTML
function getPaymentFailedEmailHtml(tier: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const settingsUrl = `${config.frontendUrl}/settings?tab=subscription`;

  const content = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: ${BRAND.text};">
      Payment failed
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      ${greeting}<br><br>
      We were unable to process your payment for the <strong style="color: ${BRAND.text};">${tier}</strong> plan.
      Please update your payment method to avoid losing access to paid features.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${settingsUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(15, 118, 110, 0.3);">
        Update Payment Method
      </a>
    </div>

    <p style="margin: 0; font-size: 14px; color: ${BRAND.textSecondary}; line-height: 1.6;">
      If this issue persists, your subscription may be canceled and your account downgraded to the Free plan.
    </p>
  `;

  return wrapInTemplate(content, 'Your ScanOrbit payment failed');
}

function getPaymentFailedEmailText(tier: string, name?: string): string {
  const greeting = name ? `Hi ${name}` : 'Hi there';

  return `
${greeting},

We were unable to process your payment for the ${tier} plan. Please update your payment method to avoid losing access to paid features.

Manage your subscription: ${config.frontendUrl}/settings?tab=subscription

If this issue persists, your subscription may be canceled and your account downgraded to the Free plan.

---
ScanOrbit
https://scanorbit.io
  `.trim();
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

    return sendEmail(email, subject, text, html);
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

    return sendEmail(email, subject, text, html);
  },

  /**
   * Send trial ending soon notification
   */
  async sendTrialEndingEmail(
    email: string,
    trialEndsAt: Date,
    tier: string,
    name?: string
  ): Promise<EmailResult> {
    const subject = 'Your ScanOrbit trial is ending soon';
    const html = getTrialEndingEmailHtml(trialEndsAt, tier, name);
    const text = getTrialEndingEmailText(trialEndsAt, tier, name);

    return sendEmail(email, subject, text, html);
  },

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(
    email: string,
    tier: string,
    name?: string
  ): Promise<EmailResult> {
    const subject = 'Your ScanOrbit payment failed';
    const html = getPaymentFailedEmailHtml(tier, name);
    const text = getPaymentFailedEmailText(tier, name);

    return sendEmail(email, subject, text, html);
  },

  /**
   * Verify email provider connection (useful for health checks)
   * Note: Only SMTP supports connection verification
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string; provider: string }> {
    if (config.email.provider === 'resend') {
      // Resend doesn't have a verify endpoint - check if API key is configured
      if (!config.email.resend.apiKey) {
        return {
          success: false,
          error: 'Resend API key not configured',
          provider: 'resend',
        };
      }
      console.log('Resend API configured (API key present)');
      return { success: true, provider: 'resend' };
    }

    // SMTP verification
    const transport = getSmtpTransporter();
    if (!transport) {
      return {
        success: false,
        error: 'SMTP transporter not configured (missing host, user, or password)',
        provider: 'smtp',
      };
    }

    try {
      await transport.verify();
      console.log('SMTP connection verified successfully');
      return { success: true, provider: 'smtp' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('SMTP connection verification failed:', {
        error: errorMessage,
        smtpHost: config.email.smtp.host,
        smtpPort: config.email.smtp.port,
      });
      return {
        success: false,
        error: errorMessage,
        provider: 'smtp',
      };
    }
  },
};
