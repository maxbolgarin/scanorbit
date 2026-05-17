import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useEffect, useState } from "react";

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute component for public pages (login, signup).
 * Redirects authenticated users to the dashboard.
 * Shows the public page only if the user is not authenticated.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, hasOrg, isLoading, checkAuth } = useAuthStore();
  const [hasChecked, setHasChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check auth on mount to validate persisted state
    const doCheck = async () => {
      try {
        await checkAuth();
      } catch {
        // Not authenticated, which is fine for public routes
      } finally {
        setHasChecked(true);
      }
    };
    doCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !hasChecked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If authenticated, redirect to dashboard (or let signup page handle org creation)
  if (isAuthenticated) {
    // Allow signup page to handle authenticated users without org (profile step)
    if (!hasOrg && location.pathname === "/signup") {
      return <>{children}</>;
    }
    if (hasOrg) {
      return <Navigate to="/overview" replace />;
    }
    return <Navigate to="/signup" replace />;
  }

  return <>{children}</>;
}
