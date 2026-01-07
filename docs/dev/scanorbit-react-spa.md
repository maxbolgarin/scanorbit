# ScanOrbit React SPA – Complete Feature & UX Guide

## 1. Architecture Overview

### 1.1 Tech Stack

- **Framework**: React 18+ with TypeScript
- **Router**: TanStack Router (v1+) or React Router v6+ with data loaders
- **State Management**: React Context API + useReducer for global auth/org state; TanStack Query for server state
- **HTTP Client**: Axios or React Query (TanStack Query)
- **UI Components**: shadcn/ui (headless) + Tailwind CSS
- **Form Handling**: React Hook Form + Zod validation
- **Build**: Vite
- **Code Splitting**: Lazy loading for dashboard sections

**Project structure:**
```
src/
├── components/
│   ├── common/          (Header, Sidebar, Breadcrumb)
│   ├── auth/            (LoginForm, SignupForm, MfaSetup)
│   ├── onboarding/      (AwsAccountForm, PolicyGuide, TestConnection)
│   ├── dashboard/       (MetricCards, FindingsList, ResourcesTable)
│   └── shared/          (Modals, Alerts, Tables, Charts)
├── pages/               (page components for routes)
├── hooks/               (useAuth, useAwsAccount, useFindingsQuery, etc)
├── context/             (AuthContext, OrgContext)
├── services/            (api.ts, awsService.ts)
├── lib/                 (utils, formatters, helpers)
├── types/               (TypeScript interfaces)
└── App.tsx + main.tsx
```

### 1.2 State Management Strategy

- **Auth + Org**: React Context (changes infrequently, needed globally)
- **Findings, Resources, Certificates**: TanStack Query / React Query (server state, caching, automatic refetching)
- **Form state**: React Hook Form (local component scope)
- **UI state** (modals, tabs, drawer): Zustand or useState per component (optional, keep minimal)

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

2. **Optional**: 2FA / MFA setup during signup (later MVP iteration)

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
   - Audit logs (future)

3. **Integrations** (future):
   - Slack notifications
   - PagerDuty / email alerts
   - Webhooks for findings

4. **Security**:
   - 2FA setup
   - Connected accounts (AWS roles)
   - Session management

---

## 3. Key Components & Patterns

### 3.1 Auth Context

```typescript
// contexts/AuthContext.tsx
interface User {
  id: string;
  email: string;
  name: string;
}

interface Org {
  id: string;
  name: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  org: Org | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  createOrg: (name: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => useContext(AuthContext);
```

- Persists JWT in secure httpOnly cookie (handled by backend)
- Fetches user/org on app mount via `GET /me`
- Handles session expiry gracefully

### 3.2 AWS Account Context

```typescript
interface AwsAccount {
  id: string;
  name: string;
  account_id: string;
  status: "pending" | "ok" | "error";
  last_scan_at?: string;
}

interface AwsAccountContextType {
  accounts: AwsAccount[];
  selectedAccountId: string | null;
  isLoading: boolean;
  selectAccount: (id: string) => void;
  refetchAccounts: () => Promise<void>;
}
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
npm create vite@latest scanorbit-app -- --template react-ts
cd scanorbit-app
npm install react-router-dom @tanstack/react-query axios zod react-hook-form tailwindcss
npm run dev
```

### Build Process
```bash
npm run build  # production build
npm run preview  # test production build locally
```

### Testing (Future)
- Unit: Jest + React Testing Library
- E2E: Playwright or Cypress

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
