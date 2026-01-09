import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// Note: Organization is created automatically during signup in the backend.
// This page redirects to AWS setup if user has an org, otherwise shows error.
export default function CreateOrg() {
  const navigate = useNavigate();
  const { hasOrg, org, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (hasOrg && org) {
        // Org already exists, go to AWS setup
        navigate("/onboarding/aws", { replace: true });
      }
    }
  }, [hasOrg, org, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If no org, show message (this shouldn't happen normally as org is created during signup)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md text-center">
        <p className="text-muted-foreground">
          Setting up your organization...
        </p>
        <LoadingSpinner size="lg" className="mt-4 mx-auto" />
      </div>
    </div>
  );
}
