# ScanOrbit React SPA – Complete Feature & UX Guide

## 1. Architecture Overview

### 1.1 Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| **Framework** | React + TypeScript | 19.x |
| **Router** | React Router | 7.x |
| **State Management** | Zustand (global) + TanStack Query (server) | 5.x, 5.x |
| **HTTP Client** | Axios | 1.x |
| **UI Components** | Radix UI + Tailwind CSS | Latest |
| **Form Handling** | React Hook Form + Zod | 7.x, 3.x |
| **Build** | Vite | 6.x |
| **Icons** | Lucide React | Latest |

**Project structure:**
```
apps/app/src/
├── components/
│   ├── ui/              (button, input, card, dialog - Radix primitives)
│   ├── common/          (Layout, Header, Sidebar)
│   ├── auth/            (LoginForm, SignupForm, ProtectedRoute)
│   ├── onboarding/      (AwsAccountForm, PolicyGuide, TestConnection)
│   ├── dashboard/       (SummaryCards, RecentFindings, AccountStatus)
│   ├── resources/       (ResourcesTable, ResourceFilters)
│   ├── findings/        (FindingsTable, FindingFilters, FindingDetailModal)
│   ├── accounts/        (AccountsTable, ScanHistory)
│   ├── settings/        (ProfileSettings, OrgSettings, SecuritySettings)
│   └── shared/          (MetricCard, SeverityBadge, StatusBadge, EmptyState)
├── pages/
│   ├── Dashboard.tsx
│   ├── Overview.tsx       (Organization overview with metrics)
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── Profile.tsx        (User profile management)
│   ├── Resources.tsx
│   ├── ResourceDetail.tsx
│   ├── Findings.tsx
│   ├── Scans.tsx          (Scan history and management)
│   ├── Accounts.tsx
│   ├── Settings.tsx
│   ├── InfrastructureMap.tsx     (Visual resource graph)
│   ├── Docs.tsx           (In-app documentation)
│   ├── accounts/          (Account-scoped pages)
│   │   ├── AccountDashboard.tsx
│   │   ├── AccountResources.tsx
│   │   ├── AccountFindings.tsx
│   │   ├── AccountScans.tsx
│   │   └── AccountInfrastructureMap.tsx
│   └── onboarding/        (CreateOrg, AwsSetup, Scanning)
├── hooks/
│   ├── use-auth.ts
│   ├── use-aws-accounts.ts
│   ├── use-resources.ts
│   ├── use-findings.ts
│   ├── use-dashboard.ts
│   └── use-toast.ts
├── stores/
│   ├── auth-store.ts    (Zustand - user/org state)
│   └── aws-store.ts     (Zustand - AWS accounts state)
├── lib/
│   ├── api.ts           (Axios client)
│   └── utils.ts         (cn helper, formatters)
├── types/
│   └── index.ts         (TypeScript interfaces)
├── styles/
│   └── globals.css      (Tailwind base styles)
├── App.tsx              (React Router routes)
└── main.tsx             (Entry point)
```

### 1.2 State Management Strategy

- **Auth + Org**: **Zustand** store (`stores/auth-store.ts`) - persists auth state globally
- **AWS Accounts**: **Zustand** store (`stores/aws-store.ts`) - selected account, account list
- **Findings, Resources**: **TanStack Query** (server state, caching, automatic refetching)
- **Form state**: **React Hook Form** (local component scope)
- **UI state** (modals, tabs): Local `useState` per component

---

## 2. Core User Flows

### 2.1 Onboarding Flow (First-Time User)

**Path**: Unauthenticated → Sign Up → Create Org → Connect AWS → First Scan → Dashboard

**Step-by-step:**

1. **Landing → Sign Up** (`/signup`)
   - Email + password form (React Hook Form + Zod)
   - CTA: "Create Account"
   - Validation: email format, password strength (8+ chars, mixed case, number)
   - Error states: email taken, network error

2. **Create Organization** (`/onboarding/create-org`)
   - Form: "Organization Name"
   - Auto-filled from email domain (optional, e.g., "Acme Corp")
   - CTA: "Create Organization"
   - Redirects to AWS onboarding

3. **AWS Account Connection** (`/onboarding/aws`)
   - Wizard (3 steps):
     - **Step 1**: "Enter AWS Details"
       - Fields: Account name, AWS account ID
       - CTA: "Next"
     - **Step 2**: "Create IAM Role"
       - Show copy-paste IAM policy + trust relationship (code block with copy button)
       - Instructions: "Go to IAM Console → Create Role → Paste this policy"
       - CTA: "I've created the role"
     - **Step 3**: "Connect Role"
       - Field: Role ARN
       - CTA: "Test Connection" → calls `POST /aws/accounts/:id/test`
       - Shows: ✓ "Connected" or ✗ "Failed, check role ARN"
       - On success: "Next" → triggers initial scan

4. **First Scan** (`/onboarding/scanning`)
   - Progress indicator: "Scanning your AWS account..."
   - Shows estimated time (usually 5–10 min)
   - Polls `GET /scans/:scan_id/status` for progress
   - Displays: "Discovering EC2 instances...", "Scanning EBS volumes...", etc.
   - On completion: auto-redirects to dashboard

### 2.2 Login Flow (Returning User)

**Path**: `/login` → Dashboard

1. **Login Page** (`/login`)
   - Email + password form
   - "Forgot password?" link (future: password reset)
   - "Sign up" link
   - CTA: "Sign In"
   - Post-login: redirect to `/dashboard` or last visited page

### 2.2.1 Two-Factor Authentication (2FA)

**Path**: `/settings/security` → "Enable 2FA"

**Setup Flow:**
1. User clicks "Enable 2FA" button
2. API returns QR code and secret via `POST /auth/2fa/setup/init`
3. Display QR code for authenticator app (Google Authenticator, Authy)
4. User enters 6-digit code to verify
5. Show recovery codes (one-time use backup codes)
6. User confirms they've saved recovery codes
7. 2FA is enabled

**Login with 2FA:**
1. User enters email/password → `POST /auth/login`
2. If 2FA enabled, response includes `requiresTwoFactor: true`
3. Redirect to 2FA challenge page
4. User enters 6-digit code → `POST /auth/2fa/verify`
5. On success, receive JWT tokens

**Recovery Flow:**
1. If user can't access authenticator, click "Use recovery code"
2. Enter recovery code → `POST /auth/2fa/verify-recovery`
3. Recovery code is consumed (one-time use)

### 2.2.2 OAuth Login (Google/GitHub)

**Components:**
- `OAuthButtons` - Google/GitHub sign-in buttons
- `OAuthCallback` - Handles OAuth callback redirects

**Flow:**
1. User clicks "Sign in with Google" or "Sign in with GitHub"
2. Redirect to OAuth provider → `GET /auth/google` or `GET /auth/github`
3. User authenticates with provider
4. Callback to `/auth/google/callback` or `/auth/github/callback`
5. API links account and returns JWT tokens
6. Redirect to dashboard

### 2.3 Main Dashboard Flow

**Path**: `/dashboard` (authenticated, default view after login)

**Layout**:
- **Header** (top): Logo, org selector, user menu (account, logout)
- **Sidebar** (left): Navigation menu
  - Dashboard
  - Resources
  - Findings
  - AWS Accounts
  - Settings
- **Main content area**: Dynamic based on route

### 2.4 Dashboard Page (`/dashboard`)

**Purpose**: High-level overview + quick wins

**Sections**:

1. **Summary Cards** (4 metrics):
   - "Resources Discovered": total count with ↑/↓ trend
   - "Orphaned Resources": count + estimated savings (e.g., "Save €500/month")
   - "Expiring Certificates": count + urgency color (red if <7 days)
   - "Residency Violations": count (EU/non-EU resources)

2. **Recent Findings Table** (mini-version):
   - Columns: Type, Severity, Resource, Account, Date
   - Sortable, clickable (drill down to findings detail)
   - CTA: "View all findings"

3. **Recommended Actions** (static list or AI-generated):
   - "Delete orphaned EBS volumes (vol-xxx, vol-yyy) → Save €245/month"
   - "SSL cert expiring in 5 days for api.example.com → Renew now"
   - etc.

4. **Account Status Widget**:
   - Shows all connected AWS accounts
   - Last scan time per account
   - CTA: "Rescan now" button per account

### 2.5 Findings Page (`/findings`)

**Purpose**: Browse all detected issues, filter, resolve

**Features**:

1. **Filter/Search Bar**:
   - By type: Orphaned resources, SSL expiry, Data residency
   - By severity: Low, Medium, High
   - By account
   - By resource ID or domain
   - Search box (text search on summary + details)

2. **Findings List** (table or cards):
   - Columns: Severity (color-coded), Type, Summary, Resource, Account, Created, Actions
   - Severity colors:
     - Red: High (data residency violations, SSL expiring <7 days)
     - Orange: Medium (SSL expiring 7–60 days, orphaned>30 days)
     - Blue: Low (orphaned <30 days)
   - Hover row: "View details" CTA
   - Batch actions: "Mark as resolved" / "Ignore"

3. **Findings Detail Modal/Page**:
   - Header: Type + severity badge + resource link
   - **Details Panel**:
     - Description: human-readable explanation
     - Resource info: ARN, region, tags, cost
     - Timeline: when detected, last seen
   - **Recommendation Panel**:
     - Action steps (e.g., "Delete this volume", "Renew cert via ACM")
     - Links to relevant AWS console (one-click deep links)
   - **Audit Trail**:
     - When marked resolved, by whom, reason (optional)
   - CTA buttons:
     - "Mark as Resolved"
     - "Snooze for 7 days"
     - "Open in AWS Console"
     - "View related resources"

4. **Pagination / Infinite Scroll**:
   - Load 20–50 at a time, lazy load on scroll

### 2.6 Resources Page (`/resources`)

**Purpose**: Browse all discovered infrastructure, understand dependencies

**Features**:

1. **Filter/Search**:
   - By service: EC2, EBS, RDS, S3, ALB, ACM, etc.
   - By region
   - By account
   - By tag key-value
   - Search: resource ID or name

2. **Resources Table**:
   - Columns: Service, Name/ID, Region, State, Tags, Last Seen, Cost (est. monthly)
   - Sortable headers
   - Clickable row → detail view

3. **Resource Detail Page** (`/resources/:resourceId`):
   - **Header**: Service icon, resource name, ARN
   - **Info Panel**:
     - Region, state, created date, last modified
     - Tags (editable, with API call to save)
     - Cost estimate
   - **Related Findings**:
     - If orphaned, SSL expiry, etc., shows associated findings
     - "View finding" CTA
   - **Metadata**:
     - Service-specific fields (e.g., DB size for RDS, storage for EBS)
   - **Network/Dependencies** (future):
     - Incoming/outgoing connections from flow logs

4. **Bulk Actions** (future):
   - Tag multiple resources
   - Export list (CSV)

### 2.7 AWS Accounts Page (`/accounts`)

**Purpose**: Manage connected AWS accounts, view scan history

**Features**:

1. **Accounts List**:
   - Table: Account name, AWS Account ID, Status (✓ Connected / ✗ Error), Last scan, Actions
   - Row actions:
     - Edit (rename)
     - Rescan (enqueue new scan)
     - View scan history
     - Disconnect

2. **Add Account** (modal or page):
   - Same as onboarding AWS flow (wizard)
   - CTA: "Add Another Account"

3. **Scan History** (per account):
   - Timeline: scan start → completion
   - Resources discovered
   - Findings summary
   - Scan logs (if any errors)

### 2.8 Settings Page (`/settings`)

**Purpose**: User preferences, organization management, security

**Tabs**:

1. **Profile**:
   - Email, name
   - Change password

2. **Organization**:
   - Org name, logo
   - Members (future: invite teammates)
   - Subscription tier and billing
   - Audit logs

3. **Integrations** (future):
   - Slack notifications
   - PagerDuty / email alerts
   - Webhooks for findings

4. **Security**:
   - 2FA setup (enable/disable, regenerate recovery codes)
   - OAuth connections (Google, GitHub)
   - Connected AWS accounts
   - Session management

### 2.9 Infrastructure Map (`/infrastructure-map`)

**Purpose**: Visual representation of AWS resources and their relationships

**Tech Stack**: Uses `@xyflow/react` for graph visualization

**Features**:

1. **Node Types**:
   - EC2 instances
   - EBS volumes (connected to EC2)
   - Security groups
   - ALBs and target groups
   - RDS instances
   - S3 buckets

2. **Relationships Visualized**:
   - EC2 → EBS (attached volumes)
   - EC2 → Security Groups (network rules)
   - ALB → EC2 (target groups)
   - EC2 → RDS (database connections)

3. **Interactivity**:
   - Click node to view resource details
   - Filter by resource type
   - Filter by account
   - Highlight findings (color-coded by severity)
   - Zoom/pan controls

4. **Account-Scoped View**:
   - `/accounts/:accountId/infrastructure-map` - single account view
   - `/infrastructure-map` - organization-wide view

### 2.10 Profile Page (`/profile`)

**Purpose**: User profile management

**Features**:
- View/edit name and email
- Change password
- View connected OAuth accounts
- GDPR data export/deletion options

---

## 3. Key Components & Patterns

### 3.1 Auth Store (Zustand)

```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  org: Org | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, org: Org, token: string) => void;
  clearAuth: () => void;
  setOrg: (org: Org) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, org, token) =>
        set({ user, org, token, isAuthenticated: true }),
      clearAuth: () =>
        set({ user: null, org: null, token: null, isAuthenticated: false }),
      setOrg: (org) => set({ org }),
    }),
    { name: 'auth-storage' }
  )
);
```

- Uses Zustand with `persist` middleware for localStorage persistence
- Access tokens (5 min) stored in memory, refresh tokens (7 days) in httpOnly cookie
- `useAuthStore` hook provides direct access to state

### 3.2 AWS Account Store (Zustand)

```typescript
// stores/aws-store.ts
import { create } from 'zustand';

interface AwsAccount {
  id: string;
  name: string;
  awsAccountId: string;
  status: 'pending' | 'ok' | 'error';
  lastScanAt?: string;
}

interface AwsState {
  accounts: AwsAccount[];
  selectedAccountId: string | null;
  setAccounts: (accounts: AwsAccount[]) => void;
  selectAccount: (id: string | null) => void;
  addAccount: (account: AwsAccount) => void;
  updateAccount: (id: string, updates: Partial<AwsAccount>) => void;
}

export const useAwsStore = create<AwsState>((set) => ({
  accounts: [],
  selectedAccountId: null,
  setAccounts: (accounts) => set({ accounts }),
  selectAccount: (id) => set({ selectedAccountId: id }),
  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),
  updateAccount: (id, updates) =>
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
}));
```

- Stores list of connected AWS accounts + selected account
- Used to filter resources/findings by account

### 3.3 Shared Components

**Header**:
- Logo, breadcrumb, org/user dropdown

**Sidebar**:
- Navigation links (Dashboard, Resources, Findings, Accounts, Settings)
- Org switcher (future: multi-org support)

**Tables** (reusable):
- Findings table, Resources table, Accounts table
- Features: sorting, filtering, pagination, row selection

**Modals**:
- Confirm delete, mark resolved, add account

**Alert/Toast**:
- Success, error, info messages (use react-hot-toast or built-in)

### 3.4 Data Fetching with TanStack Query

```typescript
// hooks/useFindings.ts
export const useFindings = (filters: FindingFilters) => {
  return useQuery({
    queryKey: ["findings", filters],
    queryFn: () => api.get("/findings", { params: filters }),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
    refetchInterval: 60 * 1000, // auto-refetch every 60s
  });
};

// components/FindingsList.tsx
const { data, isLoading, error } = useFindings(filters);
```

- Use query keys consistently for cache management
- Enable background refetching for real-time updates

---

## 4. UX Flows & Key Interactions

### 4.1 Onboarding AWS Account (Wizard)

**Visual pattern**: Step indicator + form validation

```
Step 1/3: Account Details
  ┌─────────────────┐
  │ Account Name    │
  │ AWS Account ID  │
  └─────────────────┘
  [Back] [Next]

Step 2/3: Create IAM Role
  [Copy policy to clipboard]
  [Paste trust policy]
  [Instructions link]
  [Back] [I've created the role]

Step 3/3: Connect Role
  ┌──────────────────┐
  │ Role ARN         │ (paste here)
  └──────────────────┘
  [Test Connection] → spinner → "✓ Connected!"
  [Back] [Finish]
```

### 4.2 Resolving a Finding

**User clicks finding row**:
- Modal opens (or page navigates to detail)
- Shows context + recommendation
- User chooses action:
  - "Mark as Resolved" → modal confirms reason
  - "Snooze" → dropdown for duration (7 days, 30 days, custom)
  - "Ignore" → excluded from counts (but visible in history)
  - "Open in AWS" → opens new tab to AWS console

### 4.3 Real-Time Scan Status

While scan is running:
- Poll `GET /scans/:id/status` every 2–3 seconds
- Show progress bar + current step
- Cancel button (optional)
- On completion: auto-navigate to dashboard with toast "Scan complete! 23 resources discovered, 5 new findings"

### 4.4 Empty States

- No resources yet: "Start your first scan → [Scan Now button]"
- No findings: "Great! No issues found in your AWS account 🎉"
- No accounts: "Connect your first AWS account → [Add Account button]"

### 4.5 Error Handling

- Form validation errors: inline, red text below field
- API errors: toast notification (top-right, auto-dismiss in 5s)
- Session expired: redirect to login with message
- Network offline: banner at top "You're offline. Some data may not update."

---

## 5. Responsive Design

**Breakpoints**:
- Mobile (< 768px): sidebar → hamburger menu, single column, compact tables
- Tablet (768–1024px): 2-column layout, smaller modals
- Desktop (> 1024px): 3-column (sidebar, main, detail panel), full tables

**Key responsive adjustments**:
- Tables → swipe-able cards on mobile
- Modals → full screen on mobile
- Sidebar → drawer on mobile

---

## 6. Performance Optimizations

1. **Code Splitting**:
   - Lazy load pages: `const Dashboard = lazy(() => import('./pages/Dashboard'))`
   - Suspense boundary with spinner

2. **Memoization**:
   - Use `React.memo` for resource tables, finding cards
   - `useMemo` for computed filters/totals

3. **Query Caching**:
   - TanStack Query caches findings for 5 min
   - Manual refetch on "Rescan" button

4. **Bundle Size**:
   - Tree-shake unused components
   - Dynamic imports for heavy libraries (e.g., charts)

---

## 7. Accessibility (a11y)

- **ARIA labels** on buttons, modals, form fields
- **Keyboard navigation**: Tab through menus, Enter to submit
- **Color contrast**: all text 4.5:1 WCAG AA+
- **Focus indicators**: visible outline on interactive elements
- **Loading states**: screen reader announces "loading" status

---

## 8. Development Workflow

### Quick Start
```bash
# From monorepo root
pnpm install

# Run dev server
pnpm --filter @scanorbit/app dev

# Type check
pnpm --filter @scanorbit/app typecheck

# Lint
pnpm --filter @scanorbit/app lint
```

### Build Process
```bash
# Production build
pnpm --filter @scanorbit/app build

# Preview production build
pnpm --filter @scanorbit/app preview
```

### package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist node_modules"
  }
}
```

### Testing (Future)
- Unit: Vitest + React Testing Library
- E2E: Playwright

---

## 9. API Integration Points

**Auth**:
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`

**AWS Accounts**:
- `GET /aws/accounts`
- `POST /aws/accounts`
- `POST /aws/accounts/:id/test`
- `GET /aws/accounts/:id/scans`

**Resources**:
- `GET /resources` (with filters)
- `GET /resources/:id`
- `PATCH /resources/:id` (edit tags)

**Findings**:
- `GET /findings` (with filters)
- `GET /findings/:id`
- `PATCH /findings/:id` (mark resolved, snooze)

**Scan Status**:
- `GET /scans/:id/status`
- `POST /aws/accounts/:id/scan` (manual trigger)

---

## 10. Future Enhancements (Post-MVP)

1. **Data flow visualization**: graph of service dependencies from flow logs
2. **Cost optimization**: AI suggestions based on utilization
3. **Kubernetes scanning**: add K8s cluster discovery + cost attribution
4. **Notifications**: Slack/email alerts for critical findings
5. **Audit logging**: who changed what, when
6. **Multi-team**: user roles, team billing, policies per team
7. **AI insights**: natural language report generation
8. **Webhook integrations**: trigger automations when findings occur

---

## Summary: UX Pathways

| User Goal | Entry Point | Pages Visited | Key Actions |
|-----------|------------|---------------|------------|
| First-time setup | `/signup` | Signup → Org → AWS wizard → Scanning | Connect AWS, trigger scan |
| Daily monitoring | `/dashboard` | Dashboard → Findings | Review findings, mark resolved |
| Cost analysis | `/resources` | Resources table → detail | Filter by cost, identify waste |
| Compliance review | `/findings` | Findings (filter residency) | Review, snooze, export |
| Account management | `/accounts` | Accounts list → history | Add account, rescan, disconnect |

This SPA provides a clean, fast, intuitive experience for DevOps/cloud engineers to monitor and optimize their AWS infrastructure without needing agents or SSH access.
