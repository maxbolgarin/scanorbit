import { memo } from "react";
import { Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/types";

interface TierBadgeProps {
  tier: SubscriptionTier;
  size?: "sm" | "md";
}

const tierConfig: Record<SubscriptionTier, {
  label: string;
  className: string;
  icon?: typeof Sparkles;
}> = {
  free: {
    label: "Free",
    className: "border-border bg-transparent text-muted-foreground",
  },
  pro: {
    label: "Pro",
    className: "border-transparent bg-gradient-to-r from-blue-500 to-purple-500 text-white",
    icon: Sparkles,
  },
  team: {
    label: "Team",
    className: "border-transparent bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    icon: Crown,
  },
};

export const TierBadge = memo(function TierBadge({ tier, size = "sm" }: TierBadgeProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-semibold transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        config.className
      )}
    >
      {Icon && <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      {config.label}
    </div>
  );
});
