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
const CreateOrg = lazy(() => import("@/pages/onboarding/CreateOrg"));
const AwsSetup = lazy(() => import("@/pages/onboarding/AwsSetup"));
const Scanning = lazy(() => import("@/pages/onboarding/Scanning"));

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
const Docs = lazy(() => import("@/pages/Docs"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
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
            <Route path="overview" element={<Overview />} />
            <Route path="overview/resources" element={<Resources />} />
            <Route path="overview/resources/:id" element={<ResourceDetail />} />
            <Route path="overview/infrastructure-map" element={<InfrastructureMap />} />
            <Route path="overview/findings" element={<Findings />} />
            <Route path="overview/scans" element={<Scans />} />

            {/* Per-account routes */}
            <Route path="accounts/:accountId" element={<AccountDashboard />} />
            <Route path="accounts/:accountId/resources" element={<AccountResources />} />
            <Route path="accounts/:accountId/resources/:id" element={<ResourceDetail />} />
            <Route path="accounts/:accountId/infrastructure-map" element={<AccountInfrastructureMap />} />
            <Route path="accounts/:accountId/findings" element={<AccountFindings />} />
            <Route path="accounts/:accountId/scans" element={<AccountScans />} />

            {/* Account management page */}
            <Route path="accounts" element={<Accounts />} />

            {/* Global routes */}
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="docs" element={<Docs />} />
            <Route path="docs/:articleId" element={<Docs />} />

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
