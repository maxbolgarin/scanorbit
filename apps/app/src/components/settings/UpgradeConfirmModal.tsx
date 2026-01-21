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
}: UpgradeConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Upgrade to {tierLabels[targetTier]}</DialogTitle>
          <DialogDescription className="pt-2">
            This is a demo upgrade. In a production environment, this would redirect you to a payment flow.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Your organization will be upgraded to the <strong>{tierLabels[targetTier]}</strong> tier immediately.
            All features associated with this tier will be unlocked.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Upgrading..." : `Upgrade to ${tierLabels[targetTier]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
