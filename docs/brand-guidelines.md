# ScanOrbit Brand Guidelines

> Complete brand identity documentation for ScanOrbit - Agentless AWS Infrastructure Scanner

---

## Table of Contents

1. [Brand Identity](#brand-identity)
2. [Visual Identity](#visual-identity)
3. [Key Messaging Framework](#key-messaging-framework)
4. [Writing Guidelines](#writing-guidelines)
5. [Do's and Don'ts](#dos-and-donts)

---

## Brand Identity

### Mission Statement

**"Empowering teams to maintain secure, compliant, and cost-efficient AWS infrastructure through effortless, agentless scanning."**

### Brand Values

| Value | Description |
|-------|-------------|
| **Security-First** | We protect your data as if it were our own |
| **Transparency** | Read-only access, clear pricing, honest communication |
| **Simplicity** | Complex cloud security made accessible |
| **Privacy** | EU-hosted, GDPR-compliant by design |
| **Efficiency** | Save time and money with automated discovery |

### Brand Personality

- **Professional yet approachable** - We speak with authority but remain friendly
- **Technical but not intimidating** - We explain complex concepts clearly
- **Confident without arrogance** - We know our product is good, but we let results speak
- **Trustworthy and dependable** - We deliver on our promises
- **Innovative and forward-thinking** - We stay ahead of cloud security challenges

### Brand Voice

| Aspect | Guideline |
|--------|-----------|
| **Tone** | Helpful, knowledgeable, direct |
| **Style** | Clear, concise, action-oriented |
| **Avoid** | Jargon overload, fear-mongering, hype |

---

## Visual Identity

### Color Palette

| Color | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| Primary | Cyber Cyan | `#00D4FF` | 0, 212, 255 | CTAs, accents, interactive elements |
| Secondary | Orbit Purple | `#6B46C1` | 107, 70, 193 | Buttons, gradients, brand emphasis |
| Background | Deep Space | `#0A0F1E` | 10, 15, 30 | Main background |
| Cards | Midnight | `#1A1F3A` | 26, 31, 58 | Card backgrounds, sections |
| Success | Neon Green | `#10B981` | 16, 185, 129 | Success states, trust badges |
| Warning | Orange | `#F59E0B` | 245, 158, 11 | Warning states |
| Error | Alert Red | `#EF4444` | 239, 68, 68 | Error states |
| Text Primary | Cloud Gray | `#E2E8F0` | 226, 232, 240 | Main text |
| Text Secondary | Slate Gray | `#94A3B8` | 148, 163, 184 | Secondary text |

### Color Usage Examples

```css
/* Primary gradient for CTAs and emphasis */
background: linear-gradient(to right, #6B46C1, #00D4FF);

/* Card with border hover effect */
border-color: rgba(0, 212, 255, 0.2); /* cyber-cyan/20 */

/* Text gradient for headings */
background: linear-gradient(to right, #6B46C1, #00D4FF);
-webkit-background-clip: text;
color: transparent;
```

### Typography

| Element | Font | Weight | Notes |
|---------|------|--------|-------|
| **Primary** | Geist | - | System-ui fallback |
| **Monospace** | Geist Mono | - | Code, technical content |
| **Headings** | Geist | Bold (700) | Gradient treatments allowed |
| **Body** | Geist | Regular (400) | 1.6 line-height |
| **Buttons** | Geist | Medium (500) | Uppercase optional for CTAs |

### Logo Usage

**Primary Logo**
- Full "ScanOrbit" wordmark with orbit icon
- Use on dark backgrounds

**Icon-Only**
- For small applications (favicons, social avatars)
- Minimum size: 32x32px

**Gradient Text Treatment**
- Purple-to-cyan gradient for emphasis
- Use sparingly on key headings

**Clear Space**
- Minimum clear space: 50% of logo height on all sides
- Never crowd the logo with other elements

### Logo Don'ts

- Don't rotate or skew the logo
- Don't change the colors outside brand palette
- Don't add effects (shadows, glows, outlines)
- Don't place on busy backgrounds without sufficient contrast

---

## Key Messaging Framework

### Primary Tagline

**"See your actual waste and compliance risks. No agents. No modifications. EU-hosted."**

### Secondary Taglines (Use Cases)

| Context | Tagline |
|---------|---------|
| Cost Focus | "Stop paying for resources you forgot existed" |
| Security Focus | "Read-only visibility into your AWS infrastructure" |
| Compliance Focus | "GDPR-ready AWS scanning, hosted in the EU" |
| Speed Focus | "5-minute setup. Complete visibility." |

### Value Propositions

| Value Prop | Description | Supporting Points |
|------------|-------------|-------------------|
| **5-minute setup** | No agents, no SSH, just IAM | Single read-only IAM role, guided setup wizard |
| **Find orphaned resources** | Stop paying for unused infrastructure | EBS volumes, Elastic IPs, snapshots, stopped instances |
| **Track SSL expiry** | Never miss a certificate renewal | ACM + endpoint scanning, multi-stage alerts |
| **GDPR compliance** | EU-hosted, data residency checks | Frankfurt data center, automatic region flagging |

### Key Differentiators

| Differentiator | What It Means | Why It Matters |
|----------------|---------------|----------------|
| **Agentless architecture** | Zero footprint on your infrastructure | No maintenance, no security surface expansion |
| **EU-first approach** | GDPR native by design | Data sovereignty, compliance-ready |
| **Read-only access** | Security by design | Technically cannot modify your infrastructure |
| **Unified dashboard** | All findings in one place | Single source of truth for infrastructure health |

### Elevator Pitches

**30-second version:**
> "ScanOrbit is an agentless AWS scanner that finds orphaned resources, expiring SSL certificates, and compliance issues in your infrastructure. Setup takes 5 minutes with a read-only IAM role - we can't modify anything. Everything is hosted in the EU for GDPR compliance."

**10-second version:**
> "ScanOrbit finds what's wasting money and creating risk in your AWS account. 5-minute setup, read-only access, EU-hosted."

---

## Writing Guidelines

### Headlines

- Lead with benefits, not features
- Use active voice
- Keep under 10 words when possible
- Gradient treatment for key phrases

**Good:** "Find orphaned resources in 5 minutes"
**Bad:** "Our scanning technology discovers unused infrastructure"

### Body Copy

- Short paragraphs (2-3 sentences max)
- Bullet points for lists of 3+ items
- Concrete numbers over vague claims
- Technical accuracy without jargon overload

**Good:** "Scans complete in under 60 seconds for most accounts."
**Bad:** "Lightning-fast scanning powered by cutting-edge technology."

### CTAs (Calls to Action)

| Context | Primary CTA | Secondary CTA |
|---------|-------------|---------------|
| Homepage | "Start Free Today" | "See How It Works" |
| Pricing | "Start Free" | "Contact Sales" |
| Feature Page | "Try It Free" | "View Documentation" |
| Blog Post | "Get Started Free" | "Read More" |

### Technical Writing

- Use precise terminology
- Link to AWS documentation when referencing services
- Include code examples in monospace
- Specify versions and regions when relevant

---

## Do's and Don'ts

### Do's

- **Do** emphasize "read-only" and "agentless" - these are key trust builders
- **Do** mention EU hosting for European audiences
- **Do** use specific numbers (5 minutes, 60 seconds, $3.65/IP)
- **Do** show empathy for DevOps pain points
- **Do** highlight what we can't do (can't modify, can't delete)
- **Do** maintain technical accuracy
- **Do** use the gradient treatment for key product name mentions

### Don'ts

- **Don't** use fear-based marketing ("Your AWS is vulnerable!")
- **Don't** promise features we don't have
- **Don't** use hyperbolic language ("revolutionary", "game-changing")
- **Don't** overuse technical jargon
- **Don't** compare negatively to competitors by name
- **Don't** make unverified claims about savings
- **Don't** use emojis excessively in professional contexts

---

## Competitor Positioning

### How We Differ

| Aspect | ScanOrbit | Traditional Tools |
|--------|-----------|-------------------|
| Setup | 5 minutes, IAM only | Hours, agents required |
| Access | Read-only, can't modify | Often requires write permissions |
| Hosting | EU-based, GDPR compliant | Often US-hosted |
| Scope | Focused scanner | Feature-bloated suites |
| Pricing | Transparent tiers | Complex enterprise pricing |

### Approved Comparisons

When comparing to alternatives, focus on our strengths without naming competitors:

- "Unlike agent-based solutions..."
- "Where others require complex setup..."
- "While traditional tools need write access..."

---

## Contact & Resources

- **Website:** [scanorbit.cloud](https://scanorbit.cloud)
- **Email:** hello@scanorbit.cloud
- **Support:** support@scanorbit.cloud

---

*Last updated: January 2025*
