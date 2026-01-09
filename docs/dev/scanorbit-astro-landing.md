# ScanOrbit Brand & Landing Page Design Guide

## Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| **Framework** | Astro | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Icons** | astro-icon + Lucide | Latest |
| **Build** | Vite (via Astro) | Latest |

```
apps/landing/
├── src/
│   ├── components/       (Astro components)
│   ├── layouts/
│   │   └── Layout.astro  (Base layout with head/body)
│   ├── pages/
│   │   ├── index.astro   (Home page)
│   │   ├── privacy.astro
│   │   ├── security.astro
│   │   ├── terms.astro
│   │   ├── cookies.astro
│   │   └── contact.astro
│   ├── styles/
│   │   └── global.css    (Tailwind imports)
│   └── content/          (Content collections, if any)
├── public/               (Static assets)
├── astro.config.mjs
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 1. Color Palette

For a **cloud infra monitoring/scanner tool targeting EU IT/DevOps**, use a **dark mode‑first palette** with **blue‑purple gradients** (trust + tech sophistication) and **neon/cyan accents** (modern, scanning/radar vibe). This follows 2025 B2B SaaS trends: dark themes (80%+ of dev tools), minimalism, and high contrast for dashboards.

### Primary Palette

| Color | Hex | Use |
|-------|-----|-----|
| **Deep Space** (Primary BG) | `#0a0f1e` | Main backgrounds, cards. |
| **Midnight Blue** (Secondary BG) | `#1a1f3a` | Secondary surfaces, navbars. |
| **Orbit Purple** (Primary) | `#6b46c1` | Buttons, links, primary elements. |
| **Cyber Cyan** (Accent) | `#00d4ff` | Highlights, borders, active states, “scan” buttons. |
| **Neon Green** (Success) | `#10b981` | Savings found, resolved issues. |
| **Warning Orange** | `#f59e0b` | Expiring SSL, medium risks. |
| **Alert Red** | `#ef4444` | Critical violations, errors. |
| **Cloud Gray** (Text) | `#e2e8f0` | Primary text. |
| **Slate Gray** (Secondary Text) | `#94a3b8` | Subtle text, labels. |
| **Pure White** | `#ffffff` | Key highlights, stats. |

### Palette Preview
```
Background: #0a0f1e
Cards: #1a1f3a
Primary: #6b46c1
Accent: #00d4ff (neon glow effect)
```

**Why this palette?**
- **Blue‑purple**: Trust, tech, enterprise (like Datadog, New Relic).[6][1]
- **Cyan accent**: Modern “scanning” / radar feel, stands out on dark BG.[7][8]
- **Dark first**: DevOps prefer dark themes (95% conversion boost).[2][1]
- **High contrast**: WCAG AA+ compliant for dashboards.[9][2]

**CSS Variables** (for Astro/React):
```css
:root {
  --bg-primary: #0a0f1e;
  --bg-secondary: #1a1f3a;
  --primary: #6b46c1;
  --accent: #00d4ff;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
}
```

**Gradient examples**:
- Hero: `linear-gradient(135deg, #1a1f3a 0%, #0a0f1e 100%)`
- Button hover: `linear-gradient(135deg, #6b46c1 0%, #00d4ff 100%)`

## 2. Typography

- **Primary**: Inter or SF Pro (free, optimized for code/UI).[1][2]
  - Weights: 400 (body), 500 (medium), 600 (semibold), 700 (bold).
  - Sizes:
    | Type | Size | Use |
    |------|------|-----|
    | H1 Hero | 4rem / 64px | Main headlines |
    | H2 Section | 2.5rem / 40px | Section headers |
    | H3 Feature | 1.75rem / 28px | Feature titles |
    | Body | 1rem / 16px | Paragraphs |
    | Small | 0.875rem / 14px | Labels, metadata |

- **Monospace fallback**: JetBrains Mono for code snippets, metrics.[8]

## 3. Landing Page Structure

**Single‑scroll page** (modern B2B SaaS standard), ~5–7 sections.[10][11][12][13][6][1]

### 3.1 Hero Section (Above the Fold)

```
[Orbit graphic / scanner animation in background]

"ScanOrbit"
"Agentless AWS Infrastructure Scanner"
"Discover orphaned resources, expiring SSL certificates, and GDPR residency violations in minutes."

[3‑4 key metrics or screenshots]
"€12,456 saved" "47 certs expiring" "3 residency issues"

Primary CTA: "Connect AWS Account (Free)"
Secondary: "Watch Demo (1min)"

[Trust badges: "Read‑only access" "GDPR compliant" "EU hosted"]
```

**Design notes**:
- Full‑width gradient BG with subtle animated “scan lines” or orbiting particles.[7][8]
- Large H1, benefit‑focused subhead.
- Stats from your MVP (or placeholder).

### 3.2 Problem Section

```
"How much are you wasting on zombie infrastructure?"

Bullet points with icons:
• Orphaned EBS volumes draining €5–15/month each.
• SSL certs expiring silently, causing outages.
• Data flowing to non‑EU regions, risking GDPR fines.
• Untagged resources hiding true cloud costs.

[Chart showing typical waste: €10k–100k/year]
```

**Visual**: Simple bar chart or infographic.[6][1]

### 3.3 Solution / Features (3‑column cards)

```
[Card 1: Orphaned Resources]
"AI‑powered detection of idle EBS, EIPs, snapshots"
[Icon + screenshot of findings list]

[Card 2: SSL Certificates]
"Full coverage: ACM + endpoint scans"
"Alerts at 60/30/14/7 days"

[Card 3: Data Residency]
"EU‑only compliance checks"
"Flag resources in US/Asia regions"

[Card 4: Inventory]
"Complete AWS resource catalog"
"EC2, RDS, S3, ALB, and more"
```

**Design**: Dark cards with cyan borders on hover.[5][12][1]

### 3.4 How It Works (3‑step process)

```
1. Connect AWS (IAM Role, read‑only)
   [Screenshot: IAM policy snippet]

2. Automatic scan (5–10 minutes)
   [Animated scan progress]

3. Get actionable findings
   [Screenshot: dashboard with findings]
```

**CTA**: “Start Free Scan”

### 3.5 Social Proof / Trust

```
"Built for EU compliance"
- EU‑hosted data
- Read‑only APIs only
- No agents, no SSH

[Later: customer logos, testimonials]
```

### 3.6 Pricing (Simple)

```
"Free to start"
- 1 AWS account
- Unlimited scans
- All features

"Pro €99/month"
- 5 accounts
- Priority support
- Custom policies

CTA: "Start Free"
```

### 3.7 Footer

```
Product | Pricing | Security | Privacy | Contact
© 2026 ScanOrbit – GDPR Compliant Cloud Scanner
```

## 4. Visual Style & Micro‑Interactions

- **Icons**: Line icons in cyan/orange (Heroicons, Lucide).[5]
- **Animations**:
  - Subtle scan lines across hero.
  - Cards lift/scale on hover.
  - Progress bars for scan status.[8][1]
- **Dark mode only** (no toggle needed for MVP).[4][2][1]
- **Borders**: Subtle cyan glows (`box-shadow: 0 0 20px rgba(0,212,255,0.1)`) on focus/active.[5][7]
- **Spacing**: Generous whitespace, 120px+ section padding.

## 5. Astro 5 Implementation

### Development Commands

```bash
# From monorepo root
pnpm install

# Run dev server
pnpm --filter @scanorbit/landing dev

# Build for production
pnpm --filter @scanorbit/landing build

# Preview production build
pnpm --filter @scanorbit/landing preview

# Type check
pnpm --filter @scanorbit/landing typecheck
```

### Astro Configuration

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
```

### Tailwind 4 Setup

Tailwind CSS 4 uses the new Vite plugin approach:

```css
/* src/styles/global.css */
@import 'tailwindcss';

/* Custom CSS variables */
@theme {
  --color-deep-space: #0a0f1e;
  --color-midnight-blue: #1a1f3a;
  --color-orbit-purple: #6b46c1;
  --color-cyber-cyan: #00d4ff;
}
```

### Icons with astro-icon

```astro
---
import { Icon } from 'astro-icon/components';
---

<Icon name="lucide:shield-check" class="w-6 h-6 text-cyber-cyan" />
<Icon name="lucide:cloud" class="w-8 h-8" />
```

### Example Hero Component

```astro
---
// src/components/Hero.astro
import { Icon } from 'astro-icon/components';
---

<section class="min-h-screen bg-gradient-to-br from-midnight-blue to-deep-space relative overflow-hidden">
  <div class="container mx-auto px-6 py-32 text-center relative z-10">
    <h1 class="text-6xl md:text-7xl font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent mb-6">
      ScanOrbit
    </h1>
    <p class="text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
      Agentless AWS Infrastructure Scanner
    </p>
    <div class="flex gap-4 justify-center">
      <a href="/app" class="px-8 py-4 bg-orbit-purple hover:bg-orbit-purple/90 text-white rounded-lg font-semibold">
        Get Started Free
      </a>
      <a href="#features" class="px-8 py-4 border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/10 rounded-lg font-semibold">
        Learn More
      </a>
    </div>
  </div>
</section>
```

### Static Pages

All landing pages are static (no client-side JavaScript unless using islands):

- `/` - Home page
- `/privacy` - Privacy policy
- `/security` - Security information
- `/terms` - Terms of service
- `/cookies` - Cookie policy
- `/contact` - Contact form