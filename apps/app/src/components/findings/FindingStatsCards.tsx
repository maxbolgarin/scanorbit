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
    color: "text-status-critical",
    types: ["unencrypted_resource", "public_access", "permissive_security_group", "open_all_ports", "publicly_accessible_rds", "public_snapshot", "insecure_tls"],
  },
  cost: {
    label: "Cost",
    icon: DollarSign,
    color: "text-status-success",
    types: ["orphaned_volume", "orphaned_eip", "orphaned_snapshot", "unused_resource", "stopped_instance", "unused_log_group", "idle_nat_gateway", "oversized_instance"],
  },
  compliance: {
    label: "Compliance",
    icon: CheckCircle,
    color: "text-status-info",
    types: ["data_residency_violation", "ssl_expiry", "cloudtrail_disabled", "vpc_flow_logs_disabled", "backup_not_configured"],
  },
  iam: {
    label: "IAM",
    icon: Key,
    color: "text-primary",
    types: ["old_access_key", "unused_access_key", "unused_iam_role", "user_without_mfa", "root_account_usage", "overly_permissive_policy", "cross_account_trust"],
  },
  tagging: {
    label: "Tagging",
    icon: Tag,
    color: "text-status-high",
    types: ["missing_tag"],
  },
};

// Map finding types to resource type labels for aggregation
const findingTypeToResourceLabel: Record<string, string> = {
  orphaned_volume: "EBS",
  orphaned_eip: "EIP",
  orphaned_snapshot: "EBS Snapshot",
  orphaned_eni: "ENI",
  idle_load_balancer: "Load Balancer",
  idle_nat_gateway: "NAT Gateway",
  unused_security_group: "Security Group",
  unencrypted_resource: "EC2",
  public_access: "S3",
  permissive_security_group: "Security Group",
  open_all_ports: "Security Group",
  publicly_accessible_rds: "RDS",
  public_snapshot: "RDS",
  insecure_tls: "ACM",
  unused_resource: "EC2",
  stopped_instance: "EC2",
  unused_log_group: "CloudWatch",
  oversized_instance: "EC2",
  ebs_optimization: "EBS",
  old_gen_instance: "EC2",
  oversized_lambda: "Lambda",
  data_residency_violation: "S3",
  ssl_expiry: "ACM",
  cloudtrail_disabled: "CloudTrail",
  vpc_flow_logs_disabled: "VPC",
  backup_not_configured: "RDS",
  old_access_key: "IAM",
  unused_access_key: "IAM",
  unused_iam_role: "IAM",
  user_without_mfa: "IAM",
  root_account_usage: "IAM",
  overly_permissive_policy: "IAM",
  cross_account_trust: "IAM",
  missing_tag: "EC2",
};

const SEVERITY_COLORS = {
  critical: "hsl(var(--status-critical))",
  high: "hsl(var(--status-high))",
  medium: "hsl(var(--status-warning))",
  low: "hsl(var(--status-info))",
  trivial: "hsl(var(--status-trivial))",
};

const SEVERITY_DOT_CLASSES = {
  critical: "bg-status-critical",
  high: "bg-status-high",
  medium: "bg-status-warning",
  low: "bg-status-info",
  trivial: "bg-status-trivial",
};

interface DonutSegment {
  value: number;
  color: string;
  key: string;
}

function DonutChart({ segments, total, size = 88, thickness = 13 }: { segments: DonutSegment[]; total: number; size?: number; thickness?: number }) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="hsl(var(--foreground))">
          0
        </text>
      </svg>
    );
  }

  const paths: React.ReactNode[] = [];
  let startAngle = -Math.PI / 2;

  segments.forEach((seg, i) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    paths.push(
      <path key={seg.key ?? i} d={d} fill="none" stroke={seg.color} strokeWidth={thickness} strokeLinecap="butt" />
    );
    startAngle = endAngle;
  });

  return (
    <svg width={size} height={size}>
      {paths}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="hsl(var(--foreground))">
        {total}
      </text>
    </svg>
  );
}

const ITEMS_PER_PAGE = 5;

export function FindingStatsCards({ stats, isLoading, onFilterSelect, filteredOpenCount }: FindingStatsCardsProps) {
  const [typePage, setTypePage] = useState(0);
  const [resourcePage, setResourcePage] = useState(0);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
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

  // Build donut chart segments (only non-zero)
  const donutSegments: DonutSegment[] = [
    { key: "critical", value: criticalCount, color: SEVERITY_COLORS.critical },
    { key: "high", value: highCount, color: SEVERITY_COLORS.high },
    { key: "medium", value: mediumCount, color: SEVERITY_COLORS.medium },
    { key: "low", value: lowCount, color: SEVERITY_COLORS.low },
    { key: "trivial", value: trivialCount, color: SEVERITY_COLORS.trivial },
  ].filter(s => s.value > 0);

  const donutLegend = [
    { key: "critical", label: "Critical", count: criticalCount, dotClass: SEVERITY_DOT_CLASSES.critical },
    { key: "high", label: "High", count: highCount, dotClass: SEVERITY_DOT_CLASSES.high },
    { key: "medium", label: "Medium", count: mediumCount, dotClass: SEVERITY_DOT_CLASSES.medium },
    { key: "low", label: "Low", count: lowCount, dotClass: SEVERITY_DOT_CLASSES.low },
    { key: "trivial", label: "Trivial", count: trivialCount, dotClass: SEVERITY_DOT_CLASSES.trivial },
  ].filter(s => s.count > 0);

  // Map finding types to resource type labels and aggregate
  const byResourceType: Record<string, number> = {};
  for (const [type, count] of Object.entries(byType)) {
    const label = findingTypeToResourceLabel[type] ?? type;
    byResourceType[label] = (byResourceType[label] || 0) + count;
  }

  // Map finding types to their default severity for coloring
  const typeSeverityMap: Record<string, { barColor: string }> = {
    // Critical
    ssl_expiry: { barColor: "bg-status-critical" },
    publicly_accessible_rds: { barColor: "bg-status-critical" },
    public_snapshot: { barColor: "bg-status-critical" },
    root_account_usage: { barColor: "bg-status-critical" },
    // High
    user_without_mfa: { barColor: "bg-status-high" },
    public_access: { barColor: "bg-status-high" },
    permissive_security_group: { barColor: "bg-status-high" },
    open_all_ports: { barColor: "bg-status-high" },
    data_residency_violation: { barColor: "bg-status-high" },
    overly_permissive_policy: { barColor: "bg-status-high" },
    cloudtrail_disabled: { barColor: "bg-status-high" },
    cross_account_trust: { barColor: "bg-status-high" },
    // Medium
    unencrypted_resource: { barColor: "bg-status-warning" },
    old_access_key: { barColor: "bg-status-warning" },
    orphaned_volume: { barColor: "bg-status-warning" },
    insecure_tls: { barColor: "bg-status-warning" },
    vpc_flow_logs_disabled: { barColor: "bg-status-warning" },
    backup_not_configured: { barColor: "bg-status-warning" },
    // Low
    orphaned_eip: { barColor: "bg-status-info" },
    orphaned_snapshot: { barColor: "bg-status-info" },
    unused_access_key: { barColor: "bg-status-info" },
    unused_iam_role: { barColor: "bg-status-info" },
    unused_resource: { barColor: "bg-status-info" },
    stopped_instance: { barColor: "bg-status-info" },
    idle_nat_gateway: { barColor: "bg-status-info" },
    oversized_instance: { barColor: "bg-status-info" },
    // Trivial
    missing_tag: { barColor: "bg-status-trivial" },
    unused_log_group: { barColor: "bg-status-trivial" },
  };

  const getTypeSeverity = (type: string) => {
    return typeSeverityMap[type] || { barColor: "bg-primary" };
  };

  // Pagination calculations for types
  const allTypes = Object.entries(byType).sort(([, a], [, b]) => b - a);
  const typeTotalPages = Math.ceil(allTypes.length / ITEMS_PER_PAGE);
  const paginatedTypes = allTypes.slice(
    typePage * ITEMS_PER_PAGE,
    (typePage + 1) * ITEMS_PER_PAGE
  );

  // Pagination calculations for resource types
  const allResources = Object.entries(byResourceType).sort(([, a], [, b]) => b - a);
  const resourceTotalPages = Math.ceil(allResources.length / ITEMS_PER_PAGE);
  const paginatedResources = allResources.slice(
    resourcePage * ITEMS_PER_PAGE,
    (resourcePage + 1) * ITEMS_PER_PAGE
  );
  const maxResourceCount = Math.max(...allResources.map(([, c]) => c), 1);

  // Click handlers
  const handleTypeClick = (type: string) => {
    onFilterSelect?.({ type: type as FindingType });
  };

  const hasBottomSection = allResources.length > 0 || allTypes.length > 0;

  return (
    <div className="space-y-3">
      {/* Main stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Open Findings — donut chart */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Open Findings
              </p>
            </div>
            <div className="flex items-center gap-4">
              <DonutChart segments={donutSegments} total={openCount} />
              {donutLegend.length > 0 && (
                <div className="space-y-1 min-w-0">
                  {donutLegend.map(item => (
                    <div key={item.key} className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${item.dotClass}`} />
                      <span className="text-xs text-muted-foreground truncate">{item.label}</span>
                      <span className="text-xs font-semibold tabular-nums ml-auto pl-2">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              By Category
            </p>
            <div className="flex items-baseline gap-1">
              {categoryCounts.slice(0, 5).map((category) => (
                <div key={category.key} className="flex-1 text-center">
                  <p className={`text-2xl font-bold ${category.color}`}>{category.count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{category.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Status
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-status-warning shrink-0" />
                <div>
                  <p className="text-xl font-bold leading-none">{openCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Open</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-status-success shrink-0" />
                <div>
                  <p className="text-xl font-bold text-status-success leading-none">{resolvedCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Resolved</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xl font-bold leading-none">{snoozedCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Snoozed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xl font-bold leading-none">{ignoredCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ignored</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource type and Finding type breakdown */}
      {hasBottomSection && (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* By Resource Type */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Findings by Resource Type
                </h3>
                {resourceTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setResourcePage(p => Math.max(0, p - 1))}
                      disabled={resourcePage === 0}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums px-0.5">
                      {resourcePage + 1}/{resourceTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setResourcePage(p => Math.min(resourceTotalPages - 1, p + 1))}
                      disabled={resourcePage === resourceTotalPages - 1}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2.5">
                {paginatedResources.map(([label, count]) => {
                  const percentage = Math.max(Math.round((count / maxResourceCount) * 100), 2);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-sm font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full transition-all duration-300 bg-primary/70"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {allResources.length === 0 && (
                  <p className="text-sm text-muted-foreground">No findings discovered</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Findings by Type */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Findings by Type
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
                  const maxTypeCount = Math.max(...Object.values(byType), 1);
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
