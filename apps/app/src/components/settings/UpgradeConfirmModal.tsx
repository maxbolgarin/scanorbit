import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SubscriptionTier } from "@/types";

interface UpgradeConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTier: SubscriptionTier;
  onConfirm: () => void;
  isLoading?: boolean;
  stripeEnabled?: boolean;
}

const tierLabels: Record<SubscriptionTier, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

export const UpgradeConfirmModal = memo(function UpgradeConfirmModal({
  open,
  onOpenChange,
  targetTier,
  onConfirm,
  isLoading,
  stripeEnabled,
}: UpgradeConfirmModalProps) {
  const isDowngrade = targetTier === "free";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDowngrade
              ? "Downgrade to Free"
              : `Upgrade to ${tierLabels[targetTier]}`}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {isDowngrade
              ? "Are you sure you want to downgrade to the Free plan? You will lose access to paid features."
              : stripeEnabled
                ? `Your organization will be upgraded to the ${tierLabels[targetTier]} tier.`
                : `This will activate the ${tierLabels[targetTier]} tier for your organization.`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isDowngrade ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Resource and finding lists will be locked</li>
              <li>- Infrastructure map will be unavailable</li>
              <li>- Scanning will be limited to one successful scan</li>
              {stripeEnabled && (
                <li>- Your subscription will be canceled at the end of the billing period</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              All features associated with the{" "}
              <strong>{tierLabels[targetTier]}</strong> tier will be unlocked
              immediately.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={isDowngrade ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? isDowngrade
                ? "Downgrading..."
                : "Upgrading..."
              : isDowngrade
                ? "Confirm Downgrade"
                : `Upgrade to ${tierLabels[targetTier]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
