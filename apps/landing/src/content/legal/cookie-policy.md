---
title: Cookie Policy
description: ScanOrbit cookie policy. Learn how we use cookies on our website and service.
lastUpdated: March 15, 2026
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

### 2.1 Authentication Cookie

| Cookie Name | Purpose | Duration | Type | Required |
|-------------|---------|----------|------|----------|
| `refresh_token` | Refresh your authentication session | 7 days | Persistent | Yes |

**What it does:**
- Allows you to stay logged in across browser sessions
- Used to obtain new short-lived access tokens
- Access tokens are stored in browser memory only (not as cookies)
- Two-factor authentication challenges are handled via temporary JWT tokens, not cookies

**Technical details:**
- Stored securely with `HttpOnly` flag (inaccessible to JavaScript)
- Transmitted only over HTTPS/TLS 1.3
- `SameSite=None` attribute with `Secure` flag (required for cross-subdomain authentication between app.scanorbit.cloud and api.scanorbit.cloud)
- `Secure` flag enabled (HTTPS only)

### 2.2 Local Storage (Not Cookies)

ScanOrbit uses browser Local Storage for UI preferences. These are **not cookies** and are never sent to our servers:

| Key | Purpose | Persistence |
|-----|---------|-------------|
| `auth-storage` | Remember authentication state | Persistent |
| `scanorbit:account-context` | Remember selected AWS account | Persistent |
| `scanorbit:viewing-settings` | Remember finding filter preferences | Persistent |

**Note:** These are stored only in your browser and are never transmitted to our servers.

---

## 3. Privacy-First Analytics (Umami)

We use **Umami Analytics** (self-hosted) to understand how our website and application are used. Umami is fundamentally different from traditional analytics tools because it is designed to be privacy-first and **completely cookie-free**.

### 3.1 Why Umami is Different

| Feature | Google Analytics | Umami (We Use) |
|---------|------------------|-------------------|
| **Cookies** | Uses multiple tracking cookies | No cookies at all |
| **Personal Data** | Collects IP, device fingerprint, user ID | No personal data |
| **Cross-Site Tracking** | Tracks across websites | No cross-site tracking |
| **Data Location** | USA (Google servers) | EU only (self-hosted on our infrastructure) |
| **Consent Required** | Yes (GDPR) | No consent needed |
| **Data Retention** | Indefinite | Aggregated only |
| **Data Sharing** | Shared with Google | No third-party data sharing |

### 3.2 What Umami Collects

Umami collects **aggregated, anonymous data only:**
- Page URLs visited
- Referrer source (where you came from)
- Browser type (e.g., "Firefox" - not version or fingerprint)
- Operating system (e.g., "Windows" - not version)
- Device type (desktop, mobile, tablet)
- Country (derived from IP, then IP is immediately discarded)

### 3.3 What Umami Does NOT Collect

- IP addresses (discarded after country lookup)
- Cookies or local storage
- User identifiers
- Session identifiers
- Cross-session tracking
- Device fingerprints
- Personal information of any kind

### 3.4 GDPR Compliance

Umami is **GDPR compliant by design** and does not require cookie consent because:
- No cookies are used
- No personal data is processed
- No tracking across sites or sessions
- Data is processed on our own EU infrastructure (no third-party access)
- Legal basis: Legitimate interest (Article 6(1)(f)) - since no personal data is involved

Learn more: [Umami](https://umami.is)

### 3.5 Opting Out

Even though Umami doesn't track you personally, you can still block it:
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

**Our principle:** We only use essential cookies for authentication. Analytics are handled by Umami (self-hosted) without any cookies.

---

## 5. How We Protect Your Cookies

### 5.1 Security Measures

**Encryption:**
- All cookies transmitted over TLS 1.3 (encrypted connection)
- Session tokens encrypted in transit
- Authentication tokens use JWT (signed, tamper-proof)

**Cookie Flags:**
- `Secure` - Only sent over HTTPS, never over plain HTTP
- `HttpOnly` - Cannot be accessed by JavaScript (prevents XSS attacks)
- `SameSite=None` with `Secure` - Required for cross-subdomain authentication

**Expiration:**
- Persistent cookies expire after their duration (7 days max)
- Expired tokens are rejected by the server

### 5.2 Server-Side Security

- Tokens validated on every request
- Invalid or expired tokens rejected
- Suspicious activity triggers re-authentication
- Tokens cannot be reused after expiration

---

## 6. Your Cookie Consent

### 6.1 Essential Cookies (Auto-Consent)

The authentication cookie is **essential** to the service working. Under EDPB (European Data Protection Board) guidelines, essential cookies can be stored without explicit consent before use.

**This means:**
- You're already consenting by using ScanOrbit
- The service cannot work without this cookie
- You can manage it in your browser settings

---

## 7. Managing Your Cookies

### 7.1 Browser Settings

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

### 7.2 Clear Cookies Anytime

You can delete our cookies from your browser anytime:
- **Clear browsing data** option in your browser
- Select "Cookies and other site data"
- Choose time range (or "All time")
- Click "Clear data"

You'll need to log in again after clearing cookies.

---

## 8. Third-Party Services

ScanOrbit uses third-party services that respect your privacy:

| Service | Purpose | Sets Cookies? | Privacy |
|---------|---------|---------------|---------|
| **Umami Analytics** | Website analytics (self-hosted) | No cookies | EU-hosted on our infrastructure, no personal data |
| **Scaleway** | Infrastructure | No cookies | EU-hosted |
| **AWS** | Cloud infrastructure | No cookies | - |
| **Stripe** | Payment processing | Essential only | PCI compliant |
| **Let's Encrypt** | SSL certificates | No cookies | - |

**We will never add:**
- Advertising networks
- Social media tracking pixels
- Behavioral analytics tools
- Data brokers or third-party data sharing

---

## 9. Cookie Summary

| Cookie | Duration | When Cleared |
|--------|----------|--------------|
| **refresh_token** | 7 days | Logout or browser clear |

All other client-side data (authentication state, UI preferences) is stored in browser Local Storage and is never transmitted to our servers.

**Note:** Logging out will clear the authentication cookie immediately.

---

## 10. Cookies & Privacy

### 10.1 What Cookies Don't Store

Our cookies do **NOT** contain:
- Your password
- Your email address
- Your AWS credentials
- Payment information
- Personal identification
- Behavioral data
- Location information
- Tracking identifiers

### 10.2 Data Protection

Cookies are protected under our [Privacy Policy](/privacy):
- All data encrypted at rest
- Session tokens are signed and cannot be forged
- Tokens are specific to your session only
- Cannot be reused across accounts

For details on how we handle all your data, see our [Privacy Policy](/privacy).

---

## 11. Legal Basis (GDPR)

### 11.1 Cookie Consent

Under GDPR and EDPB guidelines:

**Essential Cookies (authentication):**
- Legal basis: Necessary to provide the service (Contract)
- Consent: Implied when you use ScanOrbit
- No explicit opt-in needed before use

### 11.2 Your GDPR Rights

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
- We use only one essential authentication cookie (`refresh_token`)
- Analytics handled by Umami (self-hosted, no cookies, no personal data)
- No marketing or advertising cookies
- All cookies encrypted and secure
- You can manage or delete cookies anytime
- No personal data stored in cookies
- No consent banner needed (we don't track you)

---

**Version:** 1.2
**Effective Date:** March 15, 2026
