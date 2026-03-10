import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, hasOrg, isLoading, checkAuth } = useAuthStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Always check auth on mount to validate persisted state
    const doCheck = async () => {
      try {
        await checkAuth();
      } catch {
        // checkAuth already handles errors internally by clearing auth state
        // Any error here means auth failed, which is handled by the redirect below
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

  if (!isAuthenticated) {
    // Preserve query params (like ?oauth=success) in the redirect
    const redirectTo = `/login${location.search}`;
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!hasOrg) {
    return <Navigate to="/signup" replace />;
  }

  return <>{children}</>;
}
