import { memo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowRight, Shield } from "lucide-react";
import type { SubscriptionTier } from "@/types";

interface WithdrawalWaiverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTier: SubscriptionTier;
  onConfirm: () => void;
  isLoading: boolean;
  isTrial?: boolean;
}

const tierLabels: Record<SubscriptionTier, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

const tierPrices: Record<SubscriptionTier, string> = {
  free: "$0",
  pro: "$19/month",
  team: "$79/month",
};

export const WithdrawalWaiverModal = memo(function WithdrawalWaiverModal({
  open,
  onOpenChange,
  targetTier,
  onConfirm,
  isLoading,
  isTrial = true,
}: WithdrawalWaiverModalProps) {
  const [waiverChecked, setWaiverChecked] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setWaiverChecked(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isTrial ? "Start Your Free Trial" : `Upgrade to ${tierLabels[targetTier]}`}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {tierLabels[targetTier]} Plan &mdash; {tierPrices[targetTier]}
            {isTrial && " after 7-day free trial"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {isTrial ? (
              <p>Your trial begins immediately. You won&apos;t be charged until the trial ends. Subscriptions renew automatically each month. Cancel anytime.</p>
            ) : (
              <p>Your plan will be changed immediately. Subscriptions renew automatically each month. Cancel anytime.</p>
            )}
          </div>

          <Checkbox
            id="withdrawal-waiver-modal"
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            disabled={!waiverChecked || isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="h-4 w-4 mr-2" />
                Processing...
              </>
            ) : (
              <>
                Continue to Checkout
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Secure checkout powered by Stripe</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});
