import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Trash2, HardDrive, Globe, Server, ExternalLink, Database, Cpu, Layers, Key, Clock, Lock, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { TIER_LIMITS } from "@/types";
import type { EnhancedDashboardSummary } from "@/types";

interface CostOptimizationCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

const categoryIcons: Record<string, typeof Trash2> = {
  orphaned_volume: HardDrive,
  orphaned_eip: Globe,
  orphaned_snapshot: HardDrive,
  orphaned_eni: Server,
  idle_load_balancer: Server,
  idle_nat_gateway: Server,
  unused_security_group: Server,
  stopped_instance: Server,
  unused_resource: Trash2,
  unused_log_group: Clock,
  // Cost optimization findings
  ebs_optimization: HardDrive,
  old_gen_instance: Cpu,
  oversized_lambda: Layers,
  log_retention: Clock,
  unused_kms_key: Key,
  rds_optimization: Database,
};

export function CostOptimizationCard({ summary, isLoading, accountId }: CostOptimizationCardProps) {
  const navigate = useNavigate();
  const { org } = useAuthStore();
  const tier = org?.tier || 'free';
  const canViewDetails = TIER_LIMITS[tier].canViewFindingList;

  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cost Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-32 bg-muted rounded" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { costInsights, orphanedResources } = summary;
  const totalSavings = costInsights.totalPotentialSavings;
  const hasOptimizations = totalSavings > 0 || orphanedResources > 0;
  const hasCostSavings = totalSavings > 0;
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";

  // Free tier: show locked state or efficient message
  if (!canViewDetails) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasOptimizations ? (
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
              <div className="rounded-full bg-amber-500/10 p-3">
                <Lock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Cost insights available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upgrade to Pro to see detailed cost optimization opportunities
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings?tab=subscription")}
              >
                Upgrade to Pro
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                No cost optimization opportunities found. Your infrastructure is efficient!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // All cost-related finding types for "View all" link
  const allCostTypes = [
    "orphaned_volume", "orphaned_eip", "orphaned_snapshot", "orphaned_eni",
    "idle_load_balancer", "idle_nat_gateway", "unused_security_group",
    "stopped_instance", "unused_resource", "unused_log_group",
    "ebs_optimization", "old_gen_instance", "oversized_lambda",
    "log_retention", "unused_kms_key", "rds_optimization"
  ].join(",");

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount.toFixed(0)}`;
  };

  // Get top 3 optimization opportunities
  const topOpportunities = costInsights.byCategory
    .filter(cat => cat.savings > 0 || cat.count > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 4);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Optimization
          </div>
          {hasOptimizations && (
            <Link
              to={`${baseFindingsUrl}?types=${allCostTypes}&status=open`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total potential savings */}
        <div className="flex items-center justify-between">
          <div>
            {hasCostSavings ? (
              <>
                <span className="text-2xl font-bold text-green-500">
                  {formatCurrency(totalSavings)}
                </span>
                <span className="text-sm text-muted-foreground ml-2">potential monthly savings</span>
              </>
            ) : hasOptimizations ? (
              <span className="text-sm text-muted-foreground">
                {orphanedResources} cleanup {orphanedResources === 1 ? "opportunity" : "opportunities"} found
              </span>
            ) : null}
          </div>
        </div>

        {/* Optimization opportunities */}
        {hasOptimizations ? (
          <div className="space-y-2">
            {topOpportunities.map((opportunity) => {
              const Icon = categoryIcons[opportunity.type] || Trash2;
              return (
                <Link
                  key={opportunity.type}
                  to={`${baseFindingsUrl}?type=${opportunity.type}&status=open`}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">
                        {opportunity.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({opportunity.count})
                      </span>
                    </div>
                  </div>
                  {opportunity.savings > 0 && (
                    <span className="text-sm font-medium text-green-500">
                      {formatCurrency(opportunity.savings)}/mo
                    </span>
                  )}
                </Link>
              );
            })}

            {costInsights.byCategory.length > 4 && (
              <Link
                to={`${baseFindingsUrl}?types=${allCostTypes}&status=open`}
                className="text-xs text-primary hover:underline block text-center mt-2"
              >
                +{costInsights.byCategory.length - 4} more opportunities
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No cost optimization opportunities found. Your infrastructure is efficient!
          </div>
        )}

        {/* Quick stats - only show if we have cost savings (otherwise it's redundant) */}
        {hasCostSavings && orphanedResources > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
            <Trash2 className="h-3 w-3" />
            <span>{orphanedResources} orphaned/unused resources detected</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
