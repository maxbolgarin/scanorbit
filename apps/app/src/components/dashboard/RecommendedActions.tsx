import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ArrowRight, Lightbulb } from "lucide-react";
import type { Finding } from "@/types";

interface RecommendedActionsProps {
  findings: Finding[];
}

// Map finding types to human-readable titles
const findingTitles: Record<string, string> = {
  orphaned_volume: "Clean up orphaned EBS volume",
  orphaned_eip: "Release unused Elastic IP",
  orphaned_snapshot: "Delete orphaned snapshot",
  ssl_expiry: "Renew expiring SSL certificate",
  data_residency_violation: "Fix data residency violation",
};

export function RecommendedActions({ findings }: RecommendedActionsProps) {
  const navigate = useNavigate();

  if (findings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-status-warning" />
            Recommended Actions
          </CardTitle>
          <CardDescription>Quick wins to improve your infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recommended actions at this time. Great job!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-status-warning" />
          Recommended Actions
        </CardTitle>
        <CardDescription>Quick wins to improve your infrastructure</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {findings.map((finding) => (
            <div
              key={finding.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={finding.severity} />
                  <span className="font-medium">
                    {findingTitles[finding.type] || finding.type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {finding.summary}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/findings?id=${finding.id}`)}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
