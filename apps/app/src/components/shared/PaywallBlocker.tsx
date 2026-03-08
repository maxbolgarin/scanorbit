import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/stores/auth-store";
import { useSubscriptionStatus } from "@/hooks/use-subscription";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";

function isAllowedStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      (parsed.hostname === 'checkout.stripe.com' ||
       parsed.hostname === 'billing.stripe.com');
  } catch {
    return false;
  }
}

interface PaywallBlockerProps {
  feature: "resources" | "findings" | "infrastructure-map";
  children?: ReactNode;
}

const featureConfig: Record<string, { title: string; description: string }> = {
  resources: {
    title: "Resource List",
    description: "View detailed information about all your AWS resources including configuration, tags, and cost estimates.",
  },
  findings: {
    title: "Finding List",
    description: "Access detailed security findings, compliance issues, and recommendations for your infrastructure.",
  },
  "infrastructure-map": {
    title: "Infrastructure Map",
    description: "Visualize your AWS infrastructure with an interactive dependency graph showing resource relationships.",
  },
};

export function PaywallBlocker({ feature, children }: PaywallBlockerProps) {
  const config = featureConfig[feature];
  const { org } = useAuthStore();
  const { status } = useSubscriptionStatus();

  const canStartTrial =
    status?.stripeEnabled &&
    status?.subscriptionStatus === "none" &&
    status?.tier === "free";

  const checkoutMutation = useMutation({
    mutationFn: () => api.createCheckoutSession(org!.id, "pro"),
    onSuccess: (data) => {
      if (isAllowedStripeUrl(data.url)) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: "Invalid redirect URL", type: "error" });
      }
    },
    onError: (error) => {
      toast({
        title: "Checkout Failed",
        description:
          error instanceof Error ? error.message : "Failed to start checkout",
        type: "error",
      });
    },
  });

  return (
    <div className="space-y-6">
      {children}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">{config.title}</h3>
          <p className="mb-6 max-w-md text-muted-foreground">
            {config.description}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            This feature is available on Pro and Team plans.
          </p>
          {canStartTrial ? (
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? (
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Start 7-Day Free Trial
              </Button>
              <Button variant="link" size="sm" asChild>
                <Link to="/settings?tab=subscription">
                  View all plans
                </Link>
              </Button>
            </div>
          ) : (
            <Button asChild>
              <Link to="/settings?tab=subscription" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
