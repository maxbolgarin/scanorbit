import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

export const PaywallBlocker = memo(function PaywallBlocker({ feature, children }: PaywallBlockerProps) {
  const config = featureConfig[feature];

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
          <Button asChild>
            <Link to="/settings?tab=subscription" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});
