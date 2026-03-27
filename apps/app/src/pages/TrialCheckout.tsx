import { useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createCheckoutSession } from "@/lib/api";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Orbit, ArrowRight, Shield } from "lucide-react";
import type { SubscriptionTier } from "@/types";

const VALID_PLANS: SubscriptionTier[] = ["pro", "team"];

const planInfo: Record<string, { name: string; price: string }> = {
  pro: { name: "Pro", price: "\u20AC19/month" },
  team: { name: "Team", price: "\u20AC79/month" },
};

export default function TrialCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { org } = useAuthStore();
  const [waiverChecked, setWaiverChecked] = useState(false);

  const plan = searchParams.get("plan") as SubscriptionTier | null;

  const checkoutMutation = useMutation({
    mutationFn: () => createCheckoutSession(org!.id, plan!, true),
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

  // Invalid plan — redirect to overview
  if (!plan || !VALID_PLANS.includes(plan)) {
    return <Navigate to="/overview" replace />;
  }

  const info = planInfo[plan];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex items-center gap-3">
        <Orbit className="h-10 w-10 text-cyber-cyan" />
        <span className="text-3xl font-bold bg-gradient-to-r from-cyber-cyan to-orbit-purple bg-clip-text text-transparent">
          ScanOrbit
        </span>
      </div>

      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Start Your Free Trial
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {info.name} Plan &mdash; {info.price} after 7-day free trial
        </p>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>Your trial begins immediately. You won&apos;t be charged until the trial ends.</p>
            <p className="mt-1">Subscriptions renew automatically each month. Cancel anytime.</p>
          </div>

          <Checkbox
            id="withdrawal-waiver"
            checked={waiverChecked}
            onChange={(e) => setWaiverChecked(e.target.checked)}
            label={
              <span className="text-sm text-foreground">
                I consent to immediate access to the service and acknowledge that I waive my{" "}
                <a
                  href="https://scanorbit.cloud/terms#withdrawal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary hover:text-primary/80"
                >
                  14-day right of withdrawal
                </a>.
              </span>
            }
          />

          <Button
            className="w-full"
            size="lg"
            disabled={!waiverChecked || checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? (
              <>
                <LoadingSpinner className="h-4 w-4 mr-2" />
                Redirecting...
              </>
            ) : (
              <>
                Continue to Checkout
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Secure checkout powered by Stripe</span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            By continuing you agree to our{" "}
            <a
              href="https://scanorbit.cloud/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://scanorbit.cloud/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
