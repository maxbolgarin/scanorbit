import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { useAuthStore } from "@/stores/auth-store";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { Layout } from "@/components/common/Layout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Lazy load pages for code splitting
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));
const CreateOrg = lazy(() => import("@/pages/onboarding/CreateOrg"));
const AwsSetup = lazy(() => import("@/pages/onboarding/AwsSetup"));
const Scanning = lazy(() => import("@/pages/onboarding/Scanning"));
const TrialCheckout = lazy(() => import("@/pages/TrialCheckout"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));

// Overview pages (Organization-wide merged view)
const Overview = lazy(() => import("@/pages/Overview"));
const Resources = lazy(() => import("@/pages/Resources"));
const ResourceDetail = lazy(() => import("@/pages/ResourceDetail"));
const Findings = lazy(() => import("@/pages/Findings"));
const Scans = lazy(() => import("@/pages/Scans"));
const InfrastructureMap = lazy(() => import("@/pages/InfrastructureMap"));

// Account-specific pages
const AccountDashboard = lazy(() => import("@/pages/AccountDashboard"));
const AccountResources = lazy(() => import("@/pages/AccountResources"));
const AccountFindings = lazy(() => import("@/pages/AccountFindings"));
const AccountScans = lazy(() => import("@/pages/AccountScans"));
const AccountInfrastructureMap = lazy(() => import("@/pages/AccountInfrastructureMap"));

// Other pages
const Accounts = lazy(() => import("@/pages/Accounts"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const Api = lazy(() => import("@/pages/Api"));
const Docs = lazy(() => import("@/pages/Docs"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function PageError() {
  return (
    <div className="flex h-96 flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-muted-foreground text-sm">An error occurred loading this page.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Refresh Page
      </button>
    </div>
  );
}

// Redirect component that properly handles route parameters
function ResourceRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/overview/resources/${id}`} replace />;
}

function App() {
  const { hasOrg } = useAuthStore();

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />

          {/* OAuth consent page for new users (not protected - user isn't authenticated yet) */}
          <Route path="/oauth-consent" element={<OAuthConsent />} />

          {/* Team invitation acceptance (handles both logged-in and logged-out) */}
          <Route path="/invite/:token" element={<AcceptInvite />} />

          {/* Onboarding routes */}
          {/* OAuth callback route - NOT protected to avoid auth race conditions */}
          <Route
            path="/onboarding/org"
            element={hasOrg ? <Navigate to="/overview" replace /> : <CreateOrg />}
          />
          <Route
            path="/onboarding/aws"
            element={
              <ProtectedRoute>
                <AwsSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/scan/:scanId"
            element={
              <ProtectedRoute>
                <Scanning />
              </ProtectedRoute>
            }
          />

          {/* Trial checkout — redirects to Stripe */}
          <Route
            path="/trial-checkout"
            element={
              <ProtectedRoute>
                <TrialCheckout />
              </ProtectedRoute>
            }
          />

          {/* Protected routes with layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Root redirect to overview */}
            <Route index element={<Navigate to="/overview" replace />} />

            {/* Organization Overview routes (merged data from all accounts) */}
            <Route path="overview" element={<ErrorBoundary fallback={<PageError />}><Overview /></ErrorBoundary>} />
            <Route path="overview/resources" element={<ErrorBoundary fallback={<PageError />}><Resources /></ErrorBoundary>} />
            <Route path="overview/resources/:id" element={<ErrorBoundary fallback={<PageError />}><ResourceDetail /></ErrorBoundary>} />
            <Route path="overview/infrastructure-map" element={<ErrorBoundary fallback={<PageError />}><InfrastructureMap /></ErrorBoundary>} />
            <Route path="overview/findings" element={<ErrorBoundary fallback={<PageError />}><Findings /></ErrorBoundary>} />
            <Route path="overview/scans" element={<ErrorBoundary fallback={<PageError />}><Scans /></ErrorBoundary>} />

            {/* Per-account routes */}
            <Route path="accounts/:accountId" element={<ErrorBoundary fallback={<PageError />}><AccountDashboard /></ErrorBoundary>} />
            <Route path="accounts/:accountId/resources" element={<ErrorBoundary fallback={<PageError />}><AccountResources /></ErrorBoundary>} />
            <Route path="accounts/:accountId/resources/:id" element={<ErrorBoundary fallback={<PageError />}><ResourceDetail /></ErrorBoundary>} />
            <Route path="accounts/:accountId/infrastructure-map" element={<ErrorBoundary fallback={<PageError />}><AccountInfrastructureMap /></ErrorBoundary>} />
            <Route path="accounts/:accountId/findings" element={<ErrorBoundary fallback={<PageError />}><AccountFindings /></ErrorBoundary>} />
            <Route path="accounts/:accountId/scans" element={<ErrorBoundary fallback={<PageError />}><AccountScans /></ErrorBoundary>} />

            {/* Account management page */}
            <Route path="accounts" element={<ErrorBoundary fallback={<PageError />}><Accounts /></ErrorBoundary>} />

            {/* Global routes */}
            <Route path="settings" element={<ErrorBoundary fallback={<PageError />}><Settings /></ErrorBoundary>} />
            <Route path="profile" element={<ErrorBoundary fallback={<PageError />}><Profile /></ErrorBoundary>} />
            <Route path="api" element={<ErrorBoundary fallback={<PageError />}><Api /></ErrorBoundary>} />
            <Route path="docs" element={<ErrorBoundary fallback={<PageError />}><Docs /></ErrorBoundary>} />
            <Route path="docs/:articleId" element={<ErrorBoundary fallback={<PageError />}><Docs /></ErrorBoundary>} />

            {/* Legacy redirects for backward compatibility */}
            <Route path="dashboard" element={<Navigate to="/overview" replace />} />
            <Route path="resources" element={<Navigate to="/overview/resources" replace />} />
            <Route path="resources/:id" element={<ResourceRedirect />} />
            <Route path="infrastructure-map" element={<Navigate to="/overview/infrastructure-map" replace />} />
            <Route path="findings" element={<Navigate to="/overview/findings" replace />} />
            <Route path="scans" element={<Navigate to="/overview/scans" replace />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
