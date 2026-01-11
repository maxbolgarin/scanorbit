import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { useAuthStore } from "@/stores/auth-store";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Layout } from "@/components/common/Layout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Lazy load pages for code splitting
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const CreateOrg = lazy(() => import("@/pages/onboarding/CreateOrg"));
const AwsSetup = lazy(() => import("@/pages/onboarding/AwsSetup"));
const Scanning = lazy(() => import("@/pages/onboarding/Scanning"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Resources = lazy(() => import("@/pages/Resources"));
const ResourceDetail = lazy(() => import("@/pages/ResourceDetail"));
const Findings = lazy(() => import("@/pages/Findings"));
const Scans = lazy(() => import("@/pages/Scans"));
const Accounts = lazy(() => import("@/pages/Accounts"));
const Settings = lazy(() => import("@/pages/Settings"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function App() {
  const { isAuthenticated, hasOrg } = useAuthStore();

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to={hasOrg ? "/dashboard" : "/onboarding/org"} replace />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/signup"
            element={
              isAuthenticated && hasOrg ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Signup />
              )
            }
          />

          {/* Onboarding routes */}
          <Route
            path="/onboarding/org"
            element={
              <ProtectedRoute>
                {hasOrg ? <Navigate to="/dashboard" replace /> : <CreateOrg />}
              </ProtectedRoute>
            }
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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="resources" element={<Resources />} />
            <Route path="resources/:id" element={<ResourceDetail />} />
            <Route path="findings" element={<Findings />} />
            <Route path="scans" element={<Scans />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
