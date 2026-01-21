import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/shared/TierBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { UpgradeConfirmModal } from "./UpgradeConfirmModal";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { CreditCard, Check, Sparkles, Crown, Zap } from "lucide-react";
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

export function SubscriptionSettings() {
  const { org, refreshAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("pro");

  const { data: status, isLoading } = useQuery({
    queryKey: ["subscription", org?.id],
    queryFn: () => api.getSubscriptionStatus(org!.id),
    enabled: !!org?.id,
  });

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

  const handleUpgradeClick = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setUpgradeModalOpen(true);
  };

  const handleConfirmUpgrade = () => {
    upgradeMutation.mutate(selectedTier);
  };

  const currentTier = (status?.tier || org?.tier || "free") as SubscriptionTier;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <p className="font-medium">{planConfigs[currentTier].name} Plan</p>
                <p className="text-sm text-muted-foreground">
                  {planConfigs[currentTier].description}
                </p>
              </div>
            </div>
            {status?.tierUpgradedAt && (
              <p className="text-sm text-muted-foreground">
                Upgraded {new Date(status.tierUpgradedAt).toLocaleDateString()}
              </p>
            )}
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
              const isCurrent = tier === currentTier;

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
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={config.popular ? "default" : "outline"}
                        onClick={() => handleUpgradeClick(tier)}
                      >
                        {tier === "free" ? "Downgrade" : "Upgrade"} to {config.name}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      </div>

      {/* Scan Status */}
      {status?.scanStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status.scanStatus.canScan ? (
              <p className="text-green-500">Ready to scan</p>
            ) : (
              <div className="space-y-2">
                <p className="text-amber-500">{status.scanStatus.reason}</p>
                {status.scanStatus.cooldownEndsAt && (
                  <p className="text-sm text-muted-foreground">
                    Cooldown ends: {new Date(status.scanStatus.cooldownEndsAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upgrade Modal */}
      <UpgradeConfirmModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        targetTier={selectedTier}
        onConfirm={handleConfirmUpgrade}
        isLoading={upgradeMutation.isPending}
      />
    </div>
  );
}
