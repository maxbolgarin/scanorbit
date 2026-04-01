import type { DigestData } from '../services/digestService.js';

// Brand colors (keep in sync with emailService.ts)
const BRAND = {
  primary: '#6b46c1',
  primaryDark: '#5b37a8',
  primaryLight: '#7c5acc',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

// Escape HTML entities to prevent XSS in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Severity badge styling
function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return BRAND.error;
    case 'high': return '#f97316';
    case 'medium': return BRAND.warning;
    case 'low': return '#3b82f6';
    default: return BRAND.textSecondary;
  }
}

function severityBgColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#fef2f2';
    case 'high': return '#fff7ed';
    case 'medium': return '#fffbeb';
    case 'low': return '#eff6ff';
    default: return BRAND.background;
  }
}

// Base email template wrapper (matches emailService.ts pattern)
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
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="container" style="max-width: 600px; background-color: ${BRAND.surface}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px; border-bottom: 1px solid ${BRAND.border};">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
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
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
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

export function buildDigestEmailHtml(
  orgName: string,
  digestData: DigestData,
  period: string,
  dashboardUrl: string,
): string {
  const safeOrgName = escapeHtml(orgName);
  const { findingsBySeverity, newFindings, resolvedFindings, topActionableItems, estimatedCostSavings, scansRun } = digestData;

  const totalOpen = findingsBySeverity.critical + findingsBySeverity.high + findingsBySeverity.medium + findingsBySeverity.low + findingsBySeverity.trivial;

  // Severity rows for the summary table
  const severityRows = [
    { label: 'Critical', key: 'critical', value: findingsBySeverity.critical },
    { label: 'High', key: 'high', value: findingsBySeverity.high },
    { label: 'Medium', key: 'medium', value: findingsBySeverity.medium },
    { label: 'Low', key: 'low', value: findingsBySeverity.low },
    { label: 'Trivial', key: 'trivial', value: findingsBySeverity.trivial },
  ].filter(r => r.value > 0);

  // Top actionable items HTML
  const topItemsHtml = topActionableItems.length > 0
    ? topActionableItems.map(item => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.border}; vertical-align: top;">
            <span style="display: inline-block; background-color: ${severityBgColor(item.severity)}; color: ${severityColor(item.severity)}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 4px; margin-right: 8px; white-space: nowrap;">${escapeHtml(item.severity)}</span>
            <span style="font-size: 14px; color: ${BRAND.text};">${escapeHtml(item.summary)}</span>
          </td>
        </tr>`).join('')
    : `<tr><td style="padding: 12px 0; font-size: 14px; color: ${BRAND.textSecondary};">No open findings — great work!</td></tr>`;

  // Cost savings callout (only if there are savings)
  const costSavingsHtml = estimatedCostSavings > 0
    ? `
      <!-- Cost savings callout -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #166534;">Potential Monthly Savings</p>
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #15803d;">$${estimatedCostSavings.toFixed(2)}</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #166534;">Based on open cost optimization findings</p>
      </div>`
    : '';

  const content = `
    <!-- Period header -->
    <h1 style="margin: 0 0 4px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">
      ${period} Digest
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${BRAND.textSecondary};">
      ${safeOrgName}
    </p>

    <!-- Stats bar -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px; background-color: ${BRAND.background}; border-radius: 10px; border: 1px solid ${BRAND.border};">
      <tr>
        <td style="padding: 16px; text-align: center; border-right: 1px solid ${BRAND.border}; width: 33%;">
          <p style="margin: 0 0 4px; font-size: 26px; font-weight: 700; color: ${newFindings > 0 ? BRAND.error : BRAND.text};">${newFindings}</p>
          <p style="margin: 0; font-size: 12px; color: ${BRAND.textSecondary}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">New Findings</p>
        </td>
        <td style="padding: 16px; text-align: center; border-right: 1px solid ${BRAND.border}; width: 33%;">
          <p style="margin: 0 0 4px; font-size: 26px; font-weight: 700; color: ${resolvedFindings > 0 ? BRAND.success : BRAND.text};">${resolvedFindings}</p>
          <p style="margin: 0; font-size: 12px; color: ${BRAND.textSecondary}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Resolved</p>
        </td>
        <td style="padding: 16px; text-align: center; width: 33%;">
          <p style="margin: 0 0 4px; font-size: 26px; font-weight: 700; color: ${BRAND.text};">${scansRun}</p>
          <p style="margin: 0; font-size: 12px; color: ${BRAND.textSecondary}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Scans Run</p>
        </td>
      </tr>
    </table>

    ${costSavingsHtml}

    <!-- Findings by severity -->
    ${severityRows.length > 0 ? `
    <h2 style="margin: 0 0 12px; font-size: 15px; font-weight: 700; color: ${BRAND.text}; text-transform: uppercase; letter-spacing: 0.5px;">
      Open Findings by Severity
    </h2>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px; border: 1px solid ${BRAND.border}; border-radius: 8px; overflow: hidden;">
      ${severityRows.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? BRAND.surface : BRAND.background};">
        <td style="padding: 10px 16px; font-size: 14px; color: ${BRAND.text}; font-weight: 500;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${severityColor(row.key)}; margin-right: 8px; vertical-align: middle;"></span>
          ${row.label}
        </td>
        <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: ${severityColor(row.key)}; text-align: right;">${row.value}</td>
      </tr>`).join('')}
      <tr style="background-color: ${BRAND.background}; border-top: 2px solid ${BRAND.border};">
        <td style="padding: 10px 16px; font-size: 14px; color: ${BRAND.textSecondary}; font-weight: 600;">Total Open</td>
        <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: ${BRAND.text}; text-align: right;">${totalOpen}</td>
      </tr>
    </table>` : `
    <div style="background-color: ${BRAND.background}; border: 1px solid ${BRAND.border}; border-radius: 8px; padding: 16px; margin: 0 0 28px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: ${BRAND.textSecondary};">No new open findings this period.</p>
    </div>`}

    <!-- Top actionable items -->
    <h2 style="margin: 0 0 12px; font-size: 15px; font-weight: 700; color: ${BRAND.text}; text-transform: uppercase; letter-spacing: 0.5px;">
      Top Actionable Items
    </h2>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px;">
      ${topItemsHtml}
    </table>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 0 0 8px;">
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(107, 70, 193, 0.3);">
        View Dashboard
      </a>
    </div>
  `;

  const previewText = `${period} digest for ${orgName}: ${newFindings} new finding${newFindings !== 1 ? 's' : ''}, ${resolvedFindings} resolved`;
  return wrapInTemplate(content, previewText);
}

export function buildDigestEmailText(
  orgName: string,
  digestData: DigestData,
  period: string,
  dashboardUrl: string,
): string {
  const { findingsBySeverity, newFindings, resolvedFindings, topActionableItems, estimatedCostSavings, scansRun } = digestData;

  const lines: string[] = [
    `${period} Digest — ${orgName}`,
    '='.repeat(50),
    '',
    `New Findings:   ${newFindings}`,
    `Resolved:       ${resolvedFindings}`,
    `Scans Run:      ${scansRun}`,
  ];

  if (estimatedCostSavings > 0) {
    lines.push(`Potential Monthly Savings: $${estimatedCostSavings.toFixed(2)}`);
  }

  lines.push('');
  lines.push('Open Findings by Severity:');
  lines.push('-'.repeat(30));

  const severities: Array<[string, number]> = [
    ['Critical', findingsBySeverity.critical],
    ['High', findingsBySeverity.high],
    ['Medium', findingsBySeverity.medium],
    ['Low', findingsBySeverity.low],
    ['Trivial', findingsBySeverity.trivial],
  ];
  for (const [label, count] of severities) {
    if (count > 0) {
      lines.push(`  ${label.padEnd(10)} ${count}`);
    }
  }

  if (topActionableItems.length > 0) {
    lines.push('');
    lines.push('Top Actionable Items:');
    lines.push('-'.repeat(30));
    for (const item of topActionableItems) {
      lines.push(`  [${item.severity.toUpperCase()}] ${item.summary}`);
    }
  }

  lines.push('');
  lines.push(`View your dashboard: ${dashboardUrl}`);
  lines.push('');
  lines.push('---');
  lines.push('ScanOrbit');
  lines.push('https://scanorbit.io');

  return lines.join('\n');
}
