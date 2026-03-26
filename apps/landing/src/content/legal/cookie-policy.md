---
title: Cookie Policy
description: ScanOrbit cookie policy. Learn how we use cookies on our website and service.
lastUpdated: March 26, 2026
---

This Cookie Policy explains what cookies and similar storage technologies ScanOrbit uses, why we use them, and how you can control them.

ScanOrbit is a trade name of Maria Elina, registered as a sole proprietorship (eenmanszaak) at the Dutch Chamber of Commerce (KVK) under number 99611252, with BTW-ID NL005398711B41, with registered address at Keizersgracht 241, Amsterdam, 1016EA Netherlands.

---

## 1. What Are Cookies?

Cookies are small text files that a website stores on your device when you visit. They serve various purposes: some are needed for the website to function, others track your behavior across the internet. Not all cookies are equal, and the law treats them differently depending on their purpose.

Browser Local Storage is a similar technology that stores data in your browser, but unlike cookies, this data is not sent to the server with each request.

---

## 2. Cookies We Use

ScanOrbit uses a single cookie. It is strictly necessary for the service to function.

### Authentication Cookie

| Name | Purpose | Duration | Flags |
|------|---------|----------|-------|
| `refresh_token` | Maintains your login session across browser visits. Used to obtain short-lived access tokens, which are held in browser memory only. | 7 days | `HttpOnly`, `Secure`, `SameSite=None` |

**Security details:**

- `HttpOnly` means JavaScript on the page cannot read the cookie, which protects against cross-site scripting (XSS) attacks.
- `Secure` means the cookie is only sent over encrypted HTTPS connections.
- In production, we set `SameSite=None` so the refresh cookie is sent reliably in our cross-origin app/API authentication flow (`app.scanorbit.cloud` <-> `api.scanorbit.cloud`). The `Secure` and `HttpOnly` flags still protect the cookie despite the less restrictive SameSite setting.

The cookie does not contain your password, email address, AWS credentials, or payment information. It contains only a signed refresh token with a pseudonymous user/session identifier.

**Legal basis:** This cookie is strictly necessary to provide the service you requested (logging in and staying logged in). Under Article 5(3) of the ePrivacy Directive and the Dutch Telecommunicatiewet, strictly necessary cookies are exempt from the consent requirement.

---

## 3. Browser Local Storage

ScanOrbit stores data in your browser's Local Storage. Local Storage data stays in your browser unless your browser sends it explicitly in a request (which our application does not do for the keys listed below).

| Key | Purpose | Content |
|-----|---------|---------|
| `auth-storage` | Remembers authentication context on page reload | Authentication state (`isAuthenticated`, `hasOrg`) and selected organization context. Access tokens are not stored in Local Storage. |
| `scanorbit:account-context` | Remembers which AWS account you last viewed | AWS account identifier |
| `scanorbit:viewing-settings` | Remembers your filter and display preferences in the dashboard | UI preference values (e.g., severity filter, sort order) |

Under the ePrivacy Directive, Local Storage is subject to the same rules as cookies. The items listed above are strictly necessary for the service to function or store user-requested preferences, and are therefore exempt from the consent requirement.

---

## 4. Analytics

We use Umami, an open-source analytics tool that we host on our own EU infrastructure. Umami runs on both the marketing website (scanorbit.cloud) and the ScanOrbit application (app.scanorbit.cloud). Umami does not use cookies, does not use Local Storage, and does not collect personal data.

**What Umami collects:** page URLs, referrer, general browser type (e.g., "Firefox"), general operating system (e.g., "macOS"), device category (desktop/mobile/tablet), and country (derived from your IP address, which is then immediately discarded and not stored).

**What Umami does not collect:** IP addresses, user identifiers, session identifiers, device fingerprints, cross-site tracking data, or any personal information.

Because Umami processes no personal data and sets no cookies, it does not require consent under GDPR or the ePrivacy Directive. Our legal basis is legitimate interest (GDPR Article 6(1)(f)).

You can still block Umami using browser extensions such as uBlock Origin, or by enabling Do Not Track in your browser settings.

For more information: [umami.is](https://umami.is)

---

## 5. What We Do Not Use

ScanOrbit does not currently use any of the following:

- Advertising or marketing cookies
- Social media tracking pixels (Facebook, LinkedIn, Twitter, etc.)
- Google Analytics or similar third-party analytics
- Session recording or heatmap tools
- A/B testing cookies
- Retargeting or behavioral advertising
- Data broker integrations

If we ever add non-essential cookies or tracking technologies, we will update this policy, notify users, and implement a consent mechanism before activating them.

---

## 6. Third-Party Cookies

ScanOrbit itself sets only the one cookie described in Section 2. However, when you interact with third-party services through ScanOrbit, those services may set their own cookies on their own domains:

**Stripe** (payment processing): When you visit the Stripe checkout page or billing portal, Stripe may set cookies on the stripe.com domain. These are essential for payment processing and fraud prevention. They are governed by [Stripe's Cookie Policy](https://stripe.com/cookies-policy/legal), not ours.

**Google and GitHub** (OAuth login): If you choose to sign in with Google or GitHub, those providers may set cookies on their own domains during the authentication flow. These are governed by their respective cookie policies.

We do not control or have access to cookies set by third parties on their own domains.

---

## 7. Managing and Deleting Cookies

You can view and delete the ScanOrbit cookie through your browser settings:

**In most browsers:** go to Settings, then Privacy or Security, then Cookies or Site Data, and search for "scanorbit.cloud."

You can also clear all cookies through your browser's "Clear browsing data" function. If you delete the authentication cookie, you will need to log in again.

**Logging out** of ScanOrbit clears the authentication cookie immediately.

Blocking essential cookies entirely will prevent ScanOrbit from functioning, since the service cannot maintain your login session without the refresh token cookie.

---

## 8. Changes to This Policy

We may update this policy to reflect changes in our cookie usage or legal requirements.

**If we add new non-essential cookies or tracking technologies**, we will notify users by email before the changes take effect and implement a consent mechanism.

**For other changes** (clarifications, updated technical details), we will update the "last updated" date at the top of this page.

---

## Contact

**General support:**
Email: support@scanorbit.cloud

For full details on how we handle your personal data, see our [Privacy Policy](/privacy).

---

**Version:** 2.0
**Effective Date:** March 26, 2026