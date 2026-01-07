---
title: Cookie Policy
description: ScanOrbit cookie policy. Learn how we use cookies on our website and service.
lastUpdated: January 7, 2026
---

This Cookie Policy explains how ScanOrbit uses cookies and similar technologies on our website and service. By using ScanOrbit, you consent to our use of cookies as described in this policy.

---

## 1. What Are Cookies?

Cookies are small text files stored on your device (computer, tablet, or mobile phone) when you visit a website. They help websites remember information about you and your preferences.

**Types of cookies:**
- **Session cookies** - Deleted when you close your browser
- **Persistent cookies** - Remain on your device for a set period
- **First-party cookies** - Set by ScanOrbit directly
- **Third-party cookies** - Set by other services (we don't use these)

---

## 2. Cookies We Use

ScanOrbit uses **only essential cookies** necessary for the service to function. We do **NOT** use tracking, analytics, or marketing cookies.

### 2.1 Session & Authentication Cookies

| Cookie Name | Purpose | Duration | Type | Required |
|-------------|---------|----------|------|----------|
| `session_token` | Keep you logged into your account | 24 hours | Session | Yes |
| `refresh_token` | Refresh your authentication session | 7 days | Persistent | Yes |
| `csrf_token` | Prevent cross-site request forgery attacks | Session | Session | Yes |

**What they do:**
- Allow you to log in and stay logged in
- Protect against unauthorized requests
- Maintain your authentication state

**Technical details:**
- Stored securely with `httpOnly` flag (inaccessible to JavaScript)
- Transmitted only over HTTPS/TLS 1.3
- `SameSite=Strict` attribute enabled (prevents cross-site attacks)
- `Secure` flag enabled (HTTPS only)

### 2.2 User Preference Cookies

| Cookie Name | Purpose | Duration | Type | Required |
|-------------|---------|----------|------|----------|
| `theme_preference` | Remember your dark/light mode choice | 1 year | Persistent | No |
| `language_preference` | Remember your language selection | 1 year | Persistent | No |
| `sidebar_state` | Remember if sidebar is collapsed/expanded | Session | Session | No |

**What they do:**
- Save your UI preferences so you don't have to set them every visit
- Improve your user experience
- No personal information stored

---

## 3. Cookies We Do NOT Use

ScanOrbit **does not use:**

- **Google Analytics** - No tracking of pageviews or user behavior
- **Marketing Cookies** - No ads or behavioral tracking
- **Advertising Pixels** - No third-party advertising networks
- **Heatmaps** - No session recording or user activity tracking
- **A/B Testing Cookies** - No experiment tracking
- **Social Media Trackers** - No Facebook, LinkedIn, or Twitter pixels
- **Data Brokers** - No data sharing with third parties

**Our principle:** We only use cookies to serve you the service, not to profile you.

---

## 4. How We Protect Your Cookies

### 4.1 Security Measures

**Encryption:**
- All cookies transmitted over TLS 1.3 (encrypted connection)
- Session tokens encrypted in transit
- Authentication tokens use JWT (signed, tamper-proof)

**Cookie Flags:**
- `Secure` - Only sent over HTTPS, never over plain HTTP
- `HttpOnly` - Cannot be accessed by JavaScript (prevents XSS attacks)
- `SameSite=Strict` - Cannot be sent in cross-site requests (prevents CSRF)

**Expiration:**
- Session cookies automatically deleted when you close your browser
- Persistent cookies expire after their duration (7 days max)
- Expired tokens are rejected by the server

### 4.2 Server-Side Security

- Tokens validated on every request
- Invalid or expired tokens rejected
- Suspicious activity triggers re-authentication
- Tokens cannot be reused after expiration

---

## 5. Your Cookie Consent

### 5.1 Essential Cookies (Auto-Consent)

The session and authentication cookies are **essential** to the service working. Under EDPB (European Data Protection Board) guidelines, essential cookies can be stored without explicit consent before use.

**This means:**
- You're already consenting by using ScanOrbit
- The service cannot work without these cookies
- You can manage them in your browser settings

### 5.2 Preference Cookies (Optional)

The theme and language preference cookies are optional and improve your experience.

**You can:**
- Accept all cookies (recommended for best experience)
- Disable preference cookies (your browser settings will not be remembered)
- Clear cookies anytime in your browser

---

## 6. Managing Your Cookies

### 6.1 Browser Settings

You can control cookies through your browser settings:

**Chrome/Edge:**
1. Settings → Privacy and Security → Cookies and other site data
2. Manage all cookies and site data
3. Search for "scanorbit.io" to see our cookies

**Firefox:**
1. Preferences → Privacy & Security → Cookies and Site Data
2. Manage Data
3. Search for "scanorbit.io"

**Safari:**
1. Preferences → Privacy → Manage Website Data
2. Find "scanorbit.io"
3. Click Remove or Remove All

**Note:** Disabling essential cookies may prevent ScanOrbit from working properly.

### 6.2 Clear Cookies Anytime

You can delete our cookies from your browser anytime:
- **Clear browsing data** option in your browser
- Select "Cookies and other site data"
- Choose time range (or "All time")
- Click "Clear data"

You'll need to log in again after clearing session cookies.

### 6.3 Cookie Preferences (Future)

Coming in Q1 2026, we'll add a **Cookie Preferences Center** where you can:
- Toggle preference cookies on/off
- View all cookies in detail
- Withdraw consent anytime
- See expiration dates

---

## 7. Third-Party Services (Future)

Currently, ScanOrbit does not use any third-party services that set cookies.

When we add services in the future (such as email providers or payment processors), we will:
- Update this policy
- Only use essential third-party cookies
- Ensure they comply with GDPR
- Provide you with control over them

**Currently trusted third parties:**
- AWS (infrastructure) - No cookies
- Let's Encrypt (certificates) - No cookies
- GitHub (code repository) - No cookies

---

## 8. Cookie Duration Summary

| Cookie Type | Duration | Expires | When Cleared |
|------------|----------|---------|--------------|
| **session_token** | 24 hours | After 24 hours or logout | Session end or logout |
| **refresh_token** | 7 days | After 7 days | Session end or logout |
| **csrf_token** | Session | Browser close | Close browser |
| **theme_preference** | 1 year | After 1 year | Manual delete or browser clear |
| **language_preference** | 1 year | After 1 year | Manual delete or browser clear |

**Note:** Logging out will clear all authentication cookies immediately.

---

## 9. Cookies & Privacy

### 9.1 What Cookies Don't Store

Our cookies do **NOT** contain:
- Your password
- Your email address
- Your AWS credentials
- Payment information
- Personal identification
- Behavioral data
- Location information
- Tracking identifiers

### 9.2 Data Protection

Cookies are protected under our [Privacy Policy](/privacy):
- All data encrypted at rest
- Session tokens are signed and cannot be forged
- Tokens are specific to your session only
- Cannot be reused across accounts

For details on how we handle all your data, see our [Privacy Policy](/privacy).

---

## 10. Legal Basis (GDPR)

### 10.1 Cookie Consent

Under GDPR and EDPB guidelines:

**Essential Cookies (session, auth, CSRF):**
- Legal basis: Necessary to provide the service (Contract)
- Consent: Implied when you use ScanOrbit
- No explicit opt-in needed before use

**Preference Cookies:**
- Legal basis: Legitimate interest (improve user experience)
- Consent: Given when you use the service
- Can be disabled in browser settings

### 10.2 Your GDPR Rights

You have the right to:
- Know what cookies we use (this policy)
- Access cookie data about you
- Delete cookies anytime (browser or contact us)
- Withdraw consent anytime
- Lodge a complaint with your data protection authority

See our [Privacy Policy](/privacy) for full GDPR rights information.

---

## 11. Changes to This Policy

We may update this Cookie Policy to:
- Reflect changes in our cookie use
- Add new services or cookies
- Improve clarity
- Comply with legal requirements

**When we change it:**
- Major changes: We'll notify you by email
- Minor changes: Posted here with updated date
- Your continued use means acceptance

---

## 12. Questions About Cookies?

**Cookie-related questions:**
Email: privacy@scanorbit.io

**Technical cookie issues:**
Email: support@scanorbit.io

**GDPR/privacy questions:**
Email: dpa@scanorbit.io

---

## 13. Quick Reference

**Remember:**
- We use only essential authentication cookies
- No tracking or analytics cookies
- No marketing or advertising cookies
- All cookies encrypted and secure
- You can manage or delete cookies anytime
- Preference cookies are optional
- Session cookies expire automatically
- No personal data stored in cookies

---

**Version:** 1.0
**Effective Date:** January 7, 2026
