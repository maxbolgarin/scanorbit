import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TierBadge } from "@/components/shared/TierBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { UpgradeConfirmModal } from "./UpgradeConfirmModal";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import {
  CreditCard,
  Check,
  Sparkles,
  Crown,
  Zap,
  Clock,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  XCircle
} from "lucide-react";
import type { SubscriptionTier } from "@/types";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanConfig {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  icon: typeof Sparkles;
  popular?: boolean;
}

const planConfigs: Record<SubscriptionTier, PlanConfig> = {
  free: {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out ScanOrbit",
    icon: Zap,
    features: [
      { text: "1 AWS account", included: true },
      { text: "1 successful scan (unlimited retries)", included: true },
      { text: "Dashboard statistics", included: true },
      { text: "Resource & finding lists", included: false },
      { text: "Infrastructure map", included: false },
    ],
  },
  pro: {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For individuals and small teams",
    icon: Sparkles,
    popular: true,
    features: [
      { text: "1 AWS account", included: true },
      { text: "Scans every hour", included: true },
      { text: "Dashboard statistics", included: true },
      { text: "Resource & finding lists", included: true },
      { text: "Infrastructure map", included: true },
    ],
  },
  team: {
    name: "Team",
    price: "$79",
    period: "per month",
    description: "For growing organizations",
    icon: Crown,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Multiple AWS accounts", included: true },
      { text: "Unlimited scans with priority", included: true },
      { text: "Team members", included: true },
      { text: "API access", included: true },
    ],
  },
};

function calcTrialRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

function formatTrialRemaining(r: { days: number; hours: number; minutes: number }): string {
  if (r.days > 0) {
    return `${r.days}d ${r.hours}h ${r.minutes}min`;
  }
  if (r.hours > 0) {
    return `${r.hours}h ${r.minutes}min`;
  }
  return `${r.minutes}min`;
}

function useTrialCountdown(trialEndsAt: string | null) {
  const [remaining, setRemaining] = useState(() => calcTrialRemaining(trialEndsAt));

  useEffect(() => {
    if (!trialEndsAt) return;
    const id = setInterval(() => setRemaining(calcTrialRemaining(trialEndsAt)), 60_000);
    return () => clearInterval(id);
  }, [trialEndsAt]);

  return remaining;
}

export function SubscriptionSettings() {
  const { org, refreshAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("pro");

  // Handle checkout success/canceled URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({
        title: "Subscription Started",
        description: "Your free trial has started. Welcome to ScanOrbit!",
        type: "success",
      });
      // Remove the query params
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
      // Refresh auth to get updated org tier
      refreshAuth();
      // Invalidate subscription query
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } else if (canceled === 'true') {
      toast({
        title: "Checkout Canceled",
        description: "You can start your trial anytime.",
        type: "default",
      });
      searchParams.delete('canceled');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshAuth, queryClient]);

  const { data: status, isLoading } = useQuery({
    queryKey: ["subscription", org?.id],
    queryFn: () => api.getSubscriptionStatus(org!.id),
    enabled: !!org?.id,
  });

  // Legacy upgrade mutation (for direct tier change without Stripe)
  const upgradeMutation = useMutation({
    mutationFn: (targetTier: SubscriptionTier) =>
      api.upgradeSubscription(org!.id, targetTier),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      await refreshAuth();
      setUpgradeModalOpen(false);
      toast({
        title: "Subscription Updated",
        description: `Your plan has been upgraded to ${planConfigs[selectedTier].name}.`,
        type: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Upgrade Failed",
        description: error instanceof Error ? error.message : "Failed to upgrade subscription",
        type: "error",
      });
    },
  });

  // Stripe checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: (targetTier: SubscriptionTier) =>
      api.createCheckoutSession(org!.id, targetTier),
    onSuccess: (data) => {
      // Validate Stripe URL before redirect
      try {
        const parsed = new URL(data.url);
        if (parsed.protocol === 'https:' && (parsed.hostname === 'checkout.stripe.com' || parsed.hostname === 'billing.stripe.com')) {
          window.location.href = data.url;
          return;
        }
      } catch { /* invalid URL */ }
      toast({ title: "Error", description: "Invalid redirect URL", type: "error" });
    },
    onError: (error) => {
      toast({
        title: "Checkout Failed",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        type: "error",
      });
    },
  });

  // Stripe portal mutation
  const portalMutation = useMutation({
    mutationFn: () => api.createPortalSession(org!.id),
    onSuccess: (data) => {
      // Validate Stripe URL before opening
      try {
        const parsed = new URL(data.url);
        if (parsed.protocol === 'https:' && (parsed.hostname === 'billing.stripe.com' || parsed.hostname === 'checkout.stripe.com')) {
          window.open(data.url, '_blank');
          return;
        }
      } catch { /* invalid URL */ }
      toast({ title: "Error", description: "Invalid redirect URL", type: "error" });
    },
    onError: (error) => {
      toast({
        title: "Portal Failed",
        description: error instanceof Error ? error.message : "Failed to open billing portal",
        type: "error",
      });
    },
  });

  // Switch plan mutation (preserves trial)
  const switchPlanMutation = useMutation({
    mutationFn: (targetTier: SubscriptionTier) =>
      api.switchPlan(org!.id, targetTier),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      await refreshAuth();
      toast({
        title: "Plan Switched",
        description: `Your plan has been switched to ${planConfigs[selectedTier].name}. Your trial period remains unchanged.`,
        type: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Switch Failed",
        description: error instanceof Error ? error.message : "Failed to switch plan",
        type: "error",
      });
    },
  });

  const handleUpgradeClick = (tier: SubscriptionTier) => {
    setSelectedTier(tier);

    // Stripe disabled - use direct upgrade flow
    if (!status?.stripeEnabled) {
      setUpgradeModalOpen(true);
      return;
    }

    // If trialing and not pending cancellation, switch plan directly (preserves trial period)
    if (status?.subscriptionStatus === 'trialing' && tier !== 'free' && !status?.subscriptionEndsAt) {
      switchPlanMutation.mutate(tier);
      return;
    }

    // If user has an active subscription, use portal to change plan
    if (status?.subscriptionStatus === 'active' || status?.subscriptionStatus === 'trialing') {
      portalMutation.mutate();
      return;
    }

    // For new subscriptions, use Stripe checkout
    if (tier !== 'free') {
      checkoutMutation.mutate(tier);
    } else {
      // Downgrading to free - open modal for confirmation
      setUpgradeModalOpen(true);
    }
  };

  const handleConfirmUpgrade = () => {
    upgradeMutation.mutate(selectedTier);
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  const currentTier = (status?.tier || org?.tier || "free") as SubscriptionTier;
  const subscriptionStatus = status?.subscriptionStatus || 'none';
  const trialCountdown = useTrialCountdown(status?.trialEndsAt || null);
  const trialTimeRemaining = trialCountdown ? formatTrialRemaining(trialCountdown) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trial Status Alert - only show when Stripe is enabled and not pending cancellation */}
      {status?.stripeEnabled && subscriptionStatus === 'trialing' && trialTimeRemaining && !status?.subscriptionEndsAt && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Free Trial Active</AlertTitle>
          <AlertDescription>
            Your trial ends in {trialTimeRemaining}. Your subscription will automatically renew after the trial.
          </AlertDescription>
        </Alert>
      )}

      {/* Past Due Alert - only show when Stripe is enabled */}
      {status?.stripeEnabled && subscriptionStatus === 'past_due' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Please update your payment method to avoid service interruption.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={portalMutation.isPending}
            >
              Update Payment
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Canceling Alert - subscription is active or trialing but will end */}
      {status?.stripeEnabled && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && status?.subscriptionEndsAt && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Subscription Ending</AlertTitle>
          <AlertDescription>
            Your {planConfigs[currentTier].name} subscription will end on {new Date(status.subscriptionEndsAt).toLocaleDateString()}.
            After that, your account will be downgraded to the Free plan. You can resubscribe from the Manage Subscription portal.
          </AlertDescription>
        </Alert>
      )}

      {/* Canceled Alert - only show when Stripe is enabled */}
      {status?.stripeEnabled && subscriptionStatus === 'canceled' && status?.subscriptionEndsAt && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Subscription Canceled</AlertTitle>
          <AlertDescription>
            Your subscription will end on {new Date(status.subscriptionEndsAt).toLocaleDateString()}.
            After that, your account will be downgraded to the Free plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Your organization's current subscription tier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TierBadge tier={currentTier} size="md" />
              <div>
                <p className="font-medium">
                  {planConfigs[currentTier].name} Plan
                  {status?.stripeEnabled && subscriptionStatus === 'trialing' && (
                    <span className="ml-2 text-sm text-muted-foreground">(Trial)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {planConfigs[currentTier].description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {status?.tierUpgradedAt && (
                <p className="text-sm text-muted-foreground">
                  {status?.stripeEnabled && subscriptionStatus === 'trialing' ? 'Trial started' : 'Upgraded'}{' '}
                  {new Date(status.tierUpgradedAt).toLocaleDateString()}
                </p>
              )}
              {status?.stripeEnabled && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'past_due') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={portalMutation.isPending}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Subscription
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Available Plans</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.entries(planConfigs) as [SubscriptionTier, PlanConfig][]).map(
            ([tier, config]) => {
              const Icon = config.icon;
              const tierOrder: Record<SubscriptionTier, number> = { free: 0, pro: 1, team: 2 };
              const isCurrent = tier === currentTier;
              const isHigherTier = tierOrder[tier] > tierOrder[currentTier];
              const canStartTrial = tier !== 'free' && currentTier === 'free' && subscriptionStatus === 'none';

              return (
                <Card
                  key={tier}
                  className={`relative ${
                    config.popular
                      ? "border-primary shadow-lg"
                      : isCurrent
                      ? "border-muted-foreground/50"
                      : ""
                  }`}
                >
                  {config.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle>{config.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{config.price}</span>
                      <span className="text-muted-foreground">/{config.period}</span>
                    </div>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-6 space-y-2">
                      {config.features.map((feature, index) => (
                        <li
                          key={index}
                          className={`flex items-center gap-2 text-sm ${
                            feature.included
                              ? "text-foreground"
                              : "text-muted-foreground line-through"
                          }`}
                        >
                          <Check
                            className={`h-4 w-4 ${
                              feature.included
                                ? "text-green-500"
                                : "text-muted-foreground/50"
                            }`}
                          />
                          {feature.text}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Button className="w-full" variant="outline" disabled>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Current Plan
                      </Button>
                    ) : canStartTrial && status?.stripeEnabled ? (
                      <Button
                        className="w-full"
                        variant={config.popular ? "default" : "outline"}
                        onClick={() => handleUpgradeClick(tier)}
                        disabled={checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending && selectedTier === tier ? (
                          <LoadingSpinner className="h-4 w-4 mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Start 7-Day Free Trial
                      </Button>
                    ) : isHigherTier ? (
                      <Button
                        className="w-full"
                        variant={config.popular ? "default" : "outline"}
                        onClick={() => handleUpgradeClick(tier)}
                        disabled={checkoutMutation.isPending || portalMutation.isPending || switchPlanMutation.isPending}
                      >
                        {(checkoutMutation.isPending || switchPlanMutation.isPending) && selectedTier === tier ? (
                          <LoadingSpinner className="h-4 w-4 mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Upgrade to {config.name}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      </div>

      {/* Upgrade Modal (for downgrade confirmation) */}
      <UpgradeConfirmModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        targetTier={selectedTier}
        onConfirm={handleConfirmUpgrade}
        isLoading={upgradeMutation.isPending}
        stripeEnabled={!!status?.stripeEnabled}
      />
    </div>
  );
}
