---
title: Cookie Policy
description: ScanOrbit cookie policy. Learn how we use cookies on our website and service.
lastUpdated: January 23, 2026
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
| `2fa_challenge` | Temporary 2FA challenge token during login | 10 minutes | Session | Conditional |

**What they do:**
- Allow you to log in and stay logged in
- Protect against unauthorized requests
- Maintain your authentication state
- Enable two-factor authentication verification (if 2FA is enabled)

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

## 3. Privacy-First Analytics (Plausible)

We use **Plausible Analytics** to understand how our website and application are used. Plausible is fundamentally different from traditional analytics tools because it is designed to be privacy-first and **completely cookie-free**.

### 3.1 Why Plausible is Different

| Feature | Google Analytics | Plausible (We Use) |
|---------|------------------|-------------------|
| **Cookies** | Uses multiple tracking cookies | ❌ No cookies at all |
| **Personal Data** | Collects IP, device fingerprint, user ID | ❌ No personal data |
| **Cross-Site Tracking** | Tracks across websites | ❌ No cross-site tracking |
| **Data Location** | USA (Google servers) | ✅ EU only |
| **Consent Required** | Yes (GDPR) | ❌ No consent needed |
| **Data Retention** | Indefinite | Aggregated only |

### 3.2 What Plausible Collects

Plausible collects **aggregated, anonymous data only:**
- Page URLs visited
- Referrer source (where you came from)
- Browser type (e.g., "Firefox" - not version or fingerprint)
- Operating system (e.g., "Windows" - not version)
- Device type (desktop, mobile, tablet)
- Country (derived from IP, then IP is immediately discarded)

### 3.3 What Plausible Does NOT Collect

- ❌ IP addresses (discarded after country lookup)
- ❌ Cookies or local storage
- ❌ User identifiers
- ❌ Session identifiers
- ❌ Cross-session tracking
- ❌ Device fingerprints
- ❌ Personal information of any kind

### 3.4 GDPR Compliance

Plausible is **GDPR compliant by design** and does not require cookie consent because:
- No cookies are used
- No personal data is processed
- No tracking across sites or sessions
- Data is processed in the EU only
- Legal basis: Legitimate interest (Article 6(1)(f)) - since no personal data is involved

Learn more: [Plausible Data Policy](https://plausible.io/data-policy)

### 3.5 Opting Out

Even though Plausible doesn't track you personally, you can still block it:
- Use browser extensions like uBlock Origin or Privacy Badger
- Enable "Do Not Track" in your browser
- Use a browser with built-in tracking protection (Firefox, Brave)

---

## 4. Cookies We Do NOT Use

ScanOrbit **does not use:**

- **Google Analytics** - No invasive tracking of pageviews or user behavior
- **Marketing Cookies** - No ads or behavioral tracking
- **Advertising Pixels** - No third-party advertising networks (Facebook, LinkedIn, etc.)
- **Heatmaps** - No session recording or user activity tracking
- **A/B Testing Cookies** - No experiment tracking cookies
- **Social Media Trackers** - No Facebook, LinkedIn, or Twitter pixels
- **Data Brokers** - No data sharing with third parties
- **Retargeting** - No advertising retargeting cookies

**Our principle:** We only use essential cookies for authentication. Analytics are handled by Plausible without any cookies.

---

## 5. How We Protect Your Cookies

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

## 6. Your Cookie Consent

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

## 7. Managing Your Cookies

### 6.1 Browser Settings

You can control cookies through your browser settings:

**Chrome/Edge:**
1. Settings → Privacy and Security → Cookies and other site data
2. Manage all cookies and site data
3. Search for "scanorbit.cloud" to see our cookies

**Firefox:**
1. Preferences → Privacy & Security → Cookies and Site Data
2. Manage Data
3. Search for "scanorbit.cloud"

**Safari:**
1. Preferences → Privacy → Manage Website Data
2. Find "scanorbit.cloud"
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

We plan to add a **Cookie Preferences Center** where you can:
- Toggle preference cookies on/off
- View all cookies in detail
- Withdraw consent anytime
- See expiration dates

---

## 8. Third-Party Services

ScanOrbit uses third-party services that respect your privacy:

| Service | Purpose | Sets Cookies? | Privacy |
|---------|---------|---------------|---------|
| **Plausible Analytics** | Website analytics | ❌ No cookies | EU-hosted, no personal data |
| **Scaleway** | Infrastructure | ❌ No cookies | EU-hosted |
| **AWS** | Cloud infrastructure | ❌ No cookies | - |
| **Stripe** | Payment processing | Essential only | PCI compliant |
| **Let's Encrypt** | SSL certificates | ❌ No cookies | - |

**We will never add:**
- Advertising networks
- Social media tracking pixels
- Behavioral analytics tools
- Data brokers or third-party data sharing

---

## 9. Cookie Duration Summary

| Cookie Type | Duration | Expires | When Cleared |
|------------|----------|---------|--------------|
| **session_token** | 24 hours | After 24 hours or logout | Session end or logout |
| **refresh_token** | 7 days | After 7 days | Session end or logout |
| **csrf_token** | Session | Browser close | Close browser |
| **2fa_challenge** | 10 minutes | After verification or timeout | After 2FA verification or 10 minutes |
| **theme_preference** | 1 year | After 1 year | Manual delete or browser clear |
| **language_preference** | 1 year | After 1 year | Manual delete or browser clear |

**Note:** Logging out will clear all authentication cookies immediately.

---

## 10. Cookies & Privacy

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

## 11. Legal Basis (GDPR)

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

## 12. Changes to This Policy

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

## 13. Questions About Cookies?

**Cookie-related questions:**
Email: support@scanorbit.cloud

**GDPR/privacy questions:**
Email: dpa@scanorbit.cloud

---

## 14. Quick Reference

**Remember:**
- We use only essential authentication cookies
- Analytics handled by Plausible (no cookies, no personal data)
- No marketing or advertising cookies
- All cookies encrypted and secure
- You can manage or delete cookies anytime
- Preference cookies are optional
- Session cookies expire automatically
- No personal data stored in cookies
- No consent banner needed (we don't track you)

---

**Version:** 1.1
**Effective Date:** January 21, 2026
