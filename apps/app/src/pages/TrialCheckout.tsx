import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createCheckoutSession } from "@/lib/api";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { Orbit } from "lucide-react";
import type { SubscriptionTier } from "@/types";

const VALID_PLANS: SubscriptionTier[] = ["pro", "team"];

export default function TrialCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { org } = useAuthStore();
  const hasTriggered = useRef(false);

  const plan = searchParams.get("plan") as SubscriptionTier | null;

  const checkoutMutation = useMutation({
    mutationFn: () => createCheckoutSession(org!.id, plan!),
    onSuccess: (data) => {
      try {
        const parsed = new URL(data.url);
        if (
          parsed.protocol === "https:" &&
          (parsed.hostname === "checkout.stripe.com" ||
            parsed.hostname === "billing.stripe.com")
        ) {
          window.location.href = data.url;
          return;
        }
      } catch {
        // Invalid URL
      }
      toast({
        title: "Error",
        description: "Received an invalid checkout URL. Please try again.",
        type: "error",
      });
      navigate("/settings?tab=subscription", { replace: true });
    },
    onError: () => {
      toast({
        title: "Checkout failed",
        description:
          "Could not start the checkout process. Please try again from settings.",
        type: "error",
      });
      navigate("/settings?tab=subscription", { replace: true });
    },
  });

  useEffect(() => {
    if (!hasTriggered.current && org && plan && VALID_PLANS.includes(plan)) {
      hasTriggered.current = true;
      checkoutMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, plan]);

  // Invalid plan — redirect to overview
  if (!plan || !VALID_PLANS.includes(plan)) {
    return <Navigate to="/overview" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Orbit className="h-10 w-10 text-cyber-cyan" />
        <span className="text-2xl font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent">
          ScanOrbit
        </span>
      </div>
      <LoadingSpinner size="lg" />
      <p className="text-muted-foreground">Redirecting to checkout...</p>
    </div>
  );
}
