import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// OAuth callback landing page.
// This page is NOT protected to avoid auth race conditions during OAuth redirect.
// It handles:
// 1. OAuth callback (?oauth=success) - authenticates user via refresh token
// 2. Redirects authenticated users based on org status
// 3. Redirects unauthenticated users (no oauth param) to login
export default function CreateOrg() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasOrg, org, isLoading, isAuthenticated, checkAuth } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  // Handle OAuth callback - trigger auth check when oauth=success
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");

    if (oauthStatus === "success") {
      // OAuth flow: authenticate using refresh token from cookie
      console.log('[CreateOrg] OAuth success detected, checking auth...');
      checkAuth().then(() => {
        console.log('[CreateOrg] Auth check complete');
        setAuthChecked(true);
        setSearchParams({}, { replace: true });
      }).catch(() => {
        console.log('[CreateOrg] Auth check failed, redirecting to login');
        setAuthChecked(true);
        navigate("/login", { replace: true });
      });
    } else {
      // Direct navigation (no OAuth) - check if already authenticated
      console.log('[CreateOrg] No OAuth param, checking existing auth...');
      checkAuth().then(() => {
        console.log('[CreateOrg] Existing auth check complete');
        setAuthChecked(true);
      }).catch(() => {
        console.log('[CreateOrg] Not authenticated, redirecting to login');
        setAuthChecked(true);
      });
    }
  }, []); // Only run once on mount

  // Handle redirects after auth is checked
  useEffect(() => {
    if (!authChecked || isLoading) {
      return; // Wait for auth check to complete
    }

    console.log('[CreateOrg] Deciding redirect:', { isAuthenticated, hasOrg, org: !!org });

    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    } else if (hasOrg && org) {
      navigate("/onboarding/aws", { replace: true });
    } else {
      navigate("/signup", { replace: true });
    }
  }, [authChecked, isLoading, isAuthenticated, hasOrg, org, navigate]);

  // Show loading while checking auth state
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
