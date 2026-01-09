import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { FindingStats } from "@/types";
import {
  AlertTriangle,
  Shield,
  DollarSign,
  Tag,
  Key,
  CheckCircle,
  Clock,
  EyeOff,
} from "lucide-react";

interface FindingStatsCardsProps {
  stats: FindingStats | undefined;
  isLoading?: boolean;
}

// Group finding types by category
const findingCategories: Record<string, { label: string; icon: React.ElementType; color: string; types: string[] }> = {
  security: {
    label: "Security",
    icon: Shield,
    color: "text-red-500",
    types: ["unencrypted_resource", "public_access", "permissive_security_group", "open_all_ports"],
  },
  cost: {
    label: "Cost",
    icon: DollarSign,
    color: "text-green-500",
    types: ["orphaned_volume", "orphaned_eip", "orphaned_snapshot", "unused_resource", "stopped_instance", "unused_log_group"],
  },
  compliance: {
    label: "Compliance",
    icon: CheckCircle,
    color: "text-blue-500",
    types: ["data_residency_violation", "ssl_expiry"],
  },
  iam: {
    label: "IAM",
    icon: Key,
    color: "text-purple-500",
    types: ["old_access_key", "unused_access_key", "unused_iam_role", "user_without_mfa"],
  },
  tagging: {
    label: "Tagging",
    icon: Tag,
    color: "text-orange-500",
    types: ["missing_tag"],
  },
};

export function FindingStatsCards({ stats, isLoading }: FindingStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="mt-2 h-8 w-16 rounded bg-muted" />
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

  // Calculate category counts
  const categoryCounts = Object.entries(findingCategories).map(([key, category]) => {
    const count = category.types.reduce((sum, type) => sum + (byType[type] || 0), 0);
    return { key, ...category, count };
  }).filter(c => c.count > 0);

  const openCount = byStatus["open"] || 0;
  const resolvedCount = byStatus["resolved"] || 0;
  const snoozedCount = byStatus["snoozed"] || 0;
  const ignoredCount = byStatus["ignored"] || 0;

  const highCount = bySeverity["high"] || 0;
  const mediumCount = bySeverity["medium"] || 0;
  const lowCount = bySeverity["low"] || 0;

  return (
    <div className="space-y-4">
      {/* Main stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open Findings */}
        <Card className={openCount > 0 ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Open Findings
                </p>
                <p className="mt-1 text-3xl font-bold">{openCount}</p>
              </div>
              <div className={`rounded-full p-3 ${openCount > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                <AlertTriangle className={`h-6 w-6 ${openCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* By Severity */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              By Severity
            </p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{highCount}</p>
                <p className="text-xs text-muted-foreground">High</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">{mediumCount}</p>
                <p className="text-xs text-muted-foreground">Medium</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{lowCount}</p>
                <p className="text-xs text-muted-foreground">Low</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolved */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Resolved
                </p>
                <p className="mt-1 text-3xl font-bold text-green-600">{resolvedCount}</p>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Snoozed & Ignored */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Deferred
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-xl font-bold">{snoozedCount}</p>
                  <p className="text-xs text-muted-foreground">Snoozed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xl font-bold">{ignoredCount}</p>
                  <p className="text-xs text-muted-foreground">Ignored</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories breakdown */}
      {categoryCounts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* By Category */}
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Findings by Category
              </h3>
              <div className="space-y-3">
                {categoryCounts.map((category) => {
                  const Icon = category.icon;
                  const percentage = stats.totalCount > 0
                    ? Math.round((category.count / stats.totalCount) * 100)
                    : 0;
                  return (
                    <div key={category.key} className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 flex-shrink-0 ${category.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {category.label}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {category.count}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              category.key === "security" ? "bg-red-500" :
                              category.key === "cost" ? "bg-green-500" :
                              category.key === "compliance" ? "bg-blue-500" :
                              category.key === "iam" ? "bg-purple-500" :
                              "bg-orange-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Finding Types */}
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Top Finding Types
              </h3>
              <div className="space-y-3">
                {Object.entries(byType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([type, count]) => {
                    const percentage = stats.totalCount > 0
                      ? Math.round((count / stats.totalCount) * 100)
                      : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium capitalize">
                              {type.replace(/_/g, " ")}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {count}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(byType).length === 0 && (
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
