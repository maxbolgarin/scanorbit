import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// Note: Organization is created during signup (ProfileStep).
// This page redirects to AWS setup if user has an org, or to signup if not.
export default function CreateOrg() {
  const navigate = useNavigate();
  const { hasOrg, org, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (hasOrg && org) {
        // Org already exists, go to AWS setup
        navigate("/onboarding/aws", { replace: true });
      } else {
        // No org yet, redirect to signup to complete profile step
        navigate("/signup", { replace: true });
      }
    }
  }, [hasOrg, org, isLoading, navigate]);

  // Show loading while checking auth state
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
