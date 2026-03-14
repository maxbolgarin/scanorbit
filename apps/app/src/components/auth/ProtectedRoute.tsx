import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useEffect, useState } from "react";

function isValidInternalPath(path: string | null): path is string {
  if (!path || typeof path !== "string") return false;
  return path.startsWith("/") && !path.includes("://") && !path.startsWith("//");
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, hasOrg, isLoading, checkAuth } = useAuthStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Always check auth on mount to validate persisted state
    const doCheck = async () => {
      try {
        await checkAuth();
        // After successful auth, handle pending OAuth redirect (e.g. invite link)
        if (searchParams.get("oauth") === "success") {
          const pendingRedirect = sessionStorage.getItem("oauthPendingRedirect");
          if (isValidInternalPath(pendingRedirect)) {
            sessionStorage.removeItem("oauthPendingRedirect");
            navigate(pendingRedirect, { replace: true });
            return;
          }
        }
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
