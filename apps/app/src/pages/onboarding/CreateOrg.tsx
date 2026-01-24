import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// Note: Organization is created during signup (ProfileStep).
// This page redirects to AWS setup if user has an org, or to signup if not.
export default function CreateOrg() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasOrg, org, isLoading, checkAuth } = useAuthStore();

  // Handle OAuth callback - trigger auth check when oauth=success
  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");
    if (oauthStatus === "success") {
      console.log('[CreateOrg] OAuth success detected, checking auth...');
      checkAuth().then(() => {
        console.log('[CreateOrg] Auth check complete');
        setSearchParams({}, { replace: true });
      });
    }
  }, [searchParams, checkAuth, setSearchParams]);

  useEffect(() => {
    // Only redirect when not loading AND not in OAuth flow
    const oauthStatus = searchParams.get("oauth");
    if (!isLoading && !oauthStatus) {
      if (hasOrg && org) {
        // Org already exists, go to AWS setup
        navigate("/onboarding/aws", { replace: true });
      } else {
        // No org yet, redirect to signup to complete profile step
        navigate("/signup", { replace: true });
      }
    }
  }, [hasOrg, org, isLoading, navigate, searchParams]);

  // Show loading while checking auth state
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
