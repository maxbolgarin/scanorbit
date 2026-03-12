import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FindingStats, FindingType } from "@/types";
import {
  AlertTriangle,
  Shield,
  DollarSign,
  Tag,
  Key,
  CheckCircle,
  Clock,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface FindingStatsCardsProps {
  stats: FindingStats | undefined;
  isLoading?: boolean;
  onFilterSelect?: (filter: { type?: FindingType }) => void;
  filteredOpenCount?: number;  // Override open count with filtered value
}

// Group finding types by category
const findingCategories: Record<string, { label: string; icon: React.ElementType; color: string; types: string[] }> = {
  security: {
    label: "Security",
    icon: Shield,
    color: "text-red-500",
    types: ["unencrypted_resource", "public_access", "permissive_security_group", "open_all_ports", "publicly_accessible_rds", "public_snapshot", "insecure_tls"],
  },
  cost: {
    label: "Cost",
    icon: DollarSign,
    color: "text-green-500",
    types: ["orphaned_volume", "orphaned_eip", "orphaned_snapshot", "unused_resource", "stopped_instance", "unused_log_group", "idle_nat_gateway", "oversized_instance"],
  },
  compliance: {
    label: "Compliance",
    icon: CheckCircle,
    color: "text-blue-500",
    types: ["data_residency_violation", "ssl_expiry", "cloudtrail_disabled", "vpc_flow_logs_disabled", "backup_not_configured"],
  },
  iam: {
    label: "IAM",
    icon: Key,
    color: "text-purple-500",
    types: ["old_access_key", "unused_access_key", "unused_iam_role", "user_without_mfa", "root_account_usage", "overly_permissive_policy", "cross_account_trust"],
  },
  tagging: {
    label: "Tagging",
    icon: Tag,
    color: "text-orange-500",
    types: ["missing_tag"],
  },
};

const ITEMS_PER_PAGE = 5;

export function FindingStatsCards({ stats, isLoading, onFilterSelect, filteredOpenCount }: FindingStatsCardsProps) {
  const [typePage, setTypePage] = useState(0);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="mt-2 h-7 w-14 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const byStatus = stats.byStatus || {};
  const bySeverity = stats.bySeverity || {};
  const byType = stats.byType || {};

  // Calculate category counts and sort by count descending
  const categoryCounts = Object.entries(findingCategories).map(([key, category]) => {
    const count = category.types.reduce((sum, type) => sum + (byType[type] || 0), 0);
    return { key, ...category, count };
  }).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  const openCount = filteredOpenCount ?? (byStatus["open"] || 0);
  const resolvedCount = byStatus["resolved"] || 0;
  const snoozedCount = byStatus["snoozed"] || 0;
  const ignoredCount = byStatus["ignored"] || 0;

  const criticalCount = bySeverity["critical"] || 0;
  const highCount = bySeverity["high"] || 0;
  const mediumCount = bySeverity["medium"] || 0;
  const lowCount = bySeverity["low"] || 0;
  const trivialCount = bySeverity["trivial"] || 0;

  // Severity items for the progress bar display
  const severityItems = [
    { key: "critical", label: "Critical", count: criticalCount, textColor: "text-red-600", barColor: "bg-red-600" },
    { key: "high", label: "High", count: highCount, textColor: "text-red-500", barColor: "bg-red-500" },
    { key: "medium", label: "Medium", count: mediumCount, textColor: "text-yellow-500", barColor: "bg-yellow-500" },
    { key: "low", label: "Low", count: lowCount, textColor: "text-blue-500", barColor: "bg-blue-500" },
    { key: "trivial", label: "Trivial", count: trivialCount, textColor: "text-muted-foreground", barColor: "bg-muted-foreground" },
  ];

  // Calculate max counts for progress bar scaling
  const maxSeverityCount = Math.max(criticalCount, highCount, mediumCount, lowCount, trivialCount, 1);
  const maxTypeCount = Math.max(...Object.values(byType), 1);

  // Map finding types to their default severity for coloring
  const typeSeverityMap: Record<string, { barColor: string }> = {
    // Critical
    ssl_expiry: { barColor: "bg-red-600" },
    publicly_accessible_rds: { barColor: "bg-red-600" },
    public_snapshot: { barColor: "bg-red-600" },
    root_account_usage: { barColor: "bg-red-600" },
    // High
    user_without_mfa: { barColor: "bg-red-500" },
    public_access: { barColor: "bg-red-500" },
    permissive_security_group: { barColor: "bg-red-500" },
    open_all_ports: { barColor: "bg-red-500" },
    data_residency_violation: { barColor: "bg-red-500" },
    overly_permissive_policy: { barColor: "bg-red-500" },
    cloudtrail_disabled: { barColor: "bg-red-500" },
    cross_account_trust: { barColor: "bg-red-500" },
    // Medium
    unencrypted_resource: { barColor: "bg-yellow-500" },
    old_access_key: { barColor: "bg-yellow-500" },
    orphaned_volume: { barColor: "bg-yellow-500" },
    insecure_tls: { barColor: "bg-yellow-500" },
    vpc_flow_logs_disabled: { barColor: "bg-yellow-500" },
    backup_not_configured: { barColor: "bg-yellow-500" },
    // Low
    orphaned_eip: { barColor: "bg-blue-500" },
    orphaned_snapshot: { barColor: "bg-blue-500" },
    unused_access_key: { barColor: "bg-blue-500" },
    unused_iam_role: { barColor: "bg-blue-500" },
    unused_resource: { barColor: "bg-blue-500" },
    stopped_instance: { barColor: "bg-blue-500" },
    idle_nat_gateway: { barColor: "bg-blue-500" },
    oversized_instance: { barColor: "bg-blue-500" },
    // Trivial
    missing_tag: { barColor: "bg-muted-foreground" },
    unused_log_group: { barColor: "bg-muted-foreground" },
  };

  const getTypeSeverity = (type: string) => {
    return typeSeverityMap[type] || { barColor: "bg-primary" };
  };

  // Pagination calculations
  const allTypes = Object.entries(byType).sort(([, a], [, b]) => b - a);
  const typeTotalPages = Math.ceil(allTypes.length / ITEMS_PER_PAGE);
  const paginatedTypes = allTypes.slice(
    typePage * ITEMS_PER_PAGE,
    (typePage + 1) * ITEMS_PER_PAGE
  );

  // Click handlers
  const handleTypeClick = (type: string) => {
    onFilterSelect?.({ type: type as FindingType });
  };

  return (
    <div className="space-y-3">
      {/* Main stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open Findings */}
        <Card className="border-l-2 border-l-yellow-500">
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Open Findings
              </p>
            </div>
            <p className="text-2xl font-bold">{openCount}</p>
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              By Category
            </p>
            <div className="flex items-baseline gap-1">
              {categoryCounts.slice(0, 5).map((category, i) => (
                <div key={category.key} className="flex-1 text-center">
                  <p className={`text-2xl font-bold ${category.color}`}>{category.count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{category.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resolved */}
        <Card className="border-l-2 border-l-green-500">
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Resolved
              </p>
            </div>
            <p className="text-2xl font-bold text-green-500">{resolvedCount}</p>
          </CardContent>
        </Card>

        {/* Snoozed & Ignored */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Deferred
            </p>
            <div className="flex items-baseline gap-5">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{snoozedCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Snoozed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{ignoredCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ignored</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity and Types breakdown */}
      {(criticalCount > 0 || highCount > 0 || mediumCount > 0 || lowCount > 0 || trivialCount > 0 || allTypes.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* By Severity */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Findings by Severity
              </h3>
              <div className="space-y-2.5">
                {severityItems.map((item) => {
                  if (item.count === 0) return null;
                  const percentage = Math.max(Math.round((item.count / maxSeverityCount) * 100), 2);
                  return (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${item.textColor}`}>
                          {item.label}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {item.count}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${item.barColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Finding Types */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Top Finding Types
                </h3>
                {typeTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setTypePage(p => Math.max(0, p - 1))}
                      disabled={typePage === 0}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums px-0.5">
                      {typePage + 1}/{typeTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setTypePage(p => Math.min(typeTotalPages - 1, p + 1))}
                      disabled={typePage === typeTotalPages - 1}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2.5">
                {paginatedTypes.map(([type, count]) => {
                  const percentage = Math.max(Math.round((count / maxTypeCount) * 100), 2);
                  const severityInfo = getTypeSeverity(type);
                  return (
                    <div
                      key={type}
                      className="cursor-pointer rounded-md p-1.5 -mx-1.5 hover:bg-muted/50 transition-colors"
                      onClick={() => handleTypeClick(type)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">
                          {type.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${severityInfo.barColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {allTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No findings discovered</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
