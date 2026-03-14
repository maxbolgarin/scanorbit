import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FindingStats, FindingType, FindingSeverity, FindingStatus } from "@/types";
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
  Network,
  Wrench,
} from "lucide-react";

interface StatsFilter {
  type?: FindingType;
  types?: FindingType[];
  severity?: FindingSeverity;
  status?: FindingStatus;
}

interface FindingStatsCardsProps {
  stats: FindingStats | undefined;
  isLoading?: boolean;
  onFilterSelect?: (filter: StatsFilter) => void;
  filteredOpenCount?: number;  // Override open count with filtered value
}

// Group finding types by category
const findingCategories: Record<string, { label: string; icon: React.ElementType; color: string; barColor: string; types: string[] }> = {
  security: {
    label: "Security",
    icon: Shield,
    color: "text-status-critical",
    barColor: "bg-status-critical/60",
    types: ["unencrypted_resource", "public_access", "permissive_security_group", "open_all_ports", "publicly_accessible_rds", "public_snapshot", "insecure_tls"],
  },
  cost: {
    label: "Cost",
    icon: DollarSign,
    color: "text-status-success",
    barColor: "bg-status-success/60",
    types: ["orphaned_volume", "orphaned_eip", "orphaned_snapshot", "unused_resource", "unused_log_group", "idle_nat_gateway", "unused_kms_key"],
  },
  compliance: {
    label: "Compliance",
    icon: CheckCircle,
    color: "text-status-info",
    barColor: "bg-status-info/60",
    types: ["data_residency_violation", "ssl_expiry", "cloudtrail_disabled", "backup_not_configured", "log_retention"],
  },
  iam: {
    label: "IAM",
    icon: Key,
    color: "text-primary",
    barColor: "bg-primary/60",
    types: ["old_access_key", "unused_access_key", "unused_iam_role", "user_without_mfa", "root_account_usage", "overly_permissive_policy", "cross_account_trust"],
  },
  network: {
    label: "Network",
    icon: Network,
    color: "text-cyan-500",
    barColor: "bg-cyan-500/60",
    types: ["orphaned_eni", "idle_load_balancer", "vpc_flow_logs_disabled", "unused_security_group"],
  },
  optimization: {
    label: "Optimization",
    icon: Wrench,
    color: "text-status-warning",
    barColor: "bg-status-warning/60",
    types: ["ebs_optimization", "old_gen_instance", "oversized_instance", "oversized_lambda", "stopped_instance", "rds_optimization", "old_gen_rds"],
  },
  tagging: {
    label: "Tagging",
    icon: Tag,
    color: "text-status-high",
    barColor: "bg-status-high/60",
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
  log_retention: "CloudWatch",
  unused_kms_key: "KMS",
  rds_optimization: "RDS",
  old_gen_rds: "RDS",
};

// Colors for resource type bars matching ServiceIcon colors
const resourceLabelBarColors: Record<string, string> = {
  "EC2": "bg-status-high/70",
  "EBS": "bg-status-info/70",
  "EBS Snapshot": "bg-status-info/50",
  "EIP": "bg-pink-500/70",
  "RDS": "bg-purple-500/70",
  "S3": "bg-status-success/70",
  "Load Balancer": "bg-cyan-500/70",
  "ACM": "bg-status-warning/70",
  "Lambda": "bg-status-warning/60",
  "CloudWatch": "bg-teal-500/70",
  "CloudTrail": "bg-teal-500/50",
  "IAM": "bg-indigo-500/70",
  "Security Group": "bg-emerald-500/70",
  "ENI": "bg-sky-500/70",
  "NAT Gateway": "bg-lime-500/70",
  "VPC": "bg-cyan-500/50",
  "KMS": "bg-status-trivial/70",
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

function DonutChart({ segments, total, size = 120, thickness = 16 }: { segments: DonutSegment[]; total: number; size?: number; thickness?: number }) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="700" fill="hsl(var(--foreground))">
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
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="700" fill="hsl(var(--foreground))">
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
  }).sort((a, b) => b.count - a.count);

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
  ];

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
    rds_optimization: { barColor: "bg-status-warning" },
    // Low
    orphaned_eip: { barColor: "bg-status-info" },
    orphaned_snapshot: { barColor: "bg-status-info" },
    orphaned_eni: { barColor: "bg-status-info" },
    unused_access_key: { barColor: "bg-status-info" },
    unused_iam_role: { barColor: "bg-status-info" },
    unused_resource: { barColor: "bg-status-info" },
    unused_security_group: { barColor: "bg-status-info" },
    stopped_instance: { barColor: "bg-status-info" },
    idle_nat_gateway: { barColor: "bg-status-info" },
    idle_load_balancer: { barColor: "bg-status-info" },
    oversized_instance: { barColor: "bg-status-info" },
    unused_kms_key: { barColor: "bg-status-info" },
    old_gen_rds: { barColor: "bg-status-info" },
    // Trivial
    missing_tag: { barColor: "bg-status-trivial" },
    unused_log_group: { barColor: "bg-status-trivial" },
    log_retention: { barColor: "bg-status-trivial" },
    ebs_optimization: { barColor: "bg-status-trivial" },
    old_gen_instance: { barColor: "bg-status-trivial" },
    oversized_lambda: { barColor: "bg-status-trivial" },
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

  const handleSeverityClick = (severity: string) => {
    onFilterSelect?.({ severity: severity as FindingSeverity });
  };

  const handleCategoryClick = (types: string[]) => {
    onFilterSelect?.({ types: types as FindingType[] });
  };

  const handleStatusClick = (status: string) => {
    onFilterSelect?.({ status: status as FindingStatus });
  };

  const handleResourceTypeClick = (resourceLabel: string) => {
    const types = Object.entries(findingTypeToResourceLabel)
      .filter(([, label]) => label === resourceLabel)
      .map(([type]) => type as FindingType);
    if (types.length === 1) {
      onFilterSelect?.({ type: types[0] });
    } else if (types.length > 1) {
      onFilterSelect?.({ types });
    }
  };

  const hasBottomSection = allResources.length > 0 || allTypes.length > 0;

  const maxCategoryCount = Math.max(...categoryCounts.map(c => c.count), 1);

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
            <div className="flex items-center gap-5">
              <DonutChart segments={donutSegments} total={openCount} />
              <div className="space-y-1.5 min-w-0">
                {donutLegend.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-muted/50 transition-colors"
                    onClick={() => handleSeverityClick(item.key)}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${item.dotClass}`} />
                    <span className="text-xs text-muted-foreground truncate">{item.label}</span>
                    <span className="text-sm font-semibold tabular-nums ml-auto pl-2">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              By Category
            </p>
            <div className="space-y-2">
              {categoryCounts.map((category) => {
                const Icon = category.icon;
                const percentage = category.count > 0 ? Math.max(Math.round((category.count / maxCategoryCount) * 100), 3) : 0;
                return (
                  <div
                    key={category.key}
                    className="flex items-center gap-2 cursor-pointer rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-muted/50 transition-colors"
                    onClick={() => handleCategoryClick(category.types)}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${category.color}`} />
                    <span className="text-xs font-medium w-20 truncate">{category.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted">
                      {percentage > 0 && (
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${category.barColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      )}
                    </div>
                    <span className={`text-xs font-bold tabular-nums w-6 text-right ${category.count > 0 ? category.color : 'text-muted-foreground'}`}>
                      {category.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Status
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-lg bg-status-warning/10 p-3 cursor-pointer hover:bg-status-warning/20 transition-colors"
                onClick={() => handleStatusClick("open")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-status-warning" />
                  <span className="text-xs font-medium text-muted-foreground">Open</span>
                </div>
                <p className="text-2xl font-bold text-status-warning">{openCount}</p>
              </div>
              <div
                className="rounded-lg bg-status-success/10 p-3 cursor-pointer hover:bg-status-success/20 transition-colors"
                onClick={() => handleStatusClick("resolved")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-status-success" />
                  <span className="text-xs font-medium text-muted-foreground">Resolved</span>
                </div>
                <p className="text-2xl font-bold text-status-success">{resolvedCount}</p>
              </div>
              <div
                className="rounded-lg bg-muted/50 p-3 cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleStatusClick("snoozed")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Snoozed</span>
                </div>
                <p className="text-2xl font-bold">{snoozedCount}</p>
              </div>
              <div
                className="rounded-lg bg-muted/50 p-3 cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleStatusClick("ignored")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Ignored</span>
                </div>
                <p className="text-2xl font-bold">{ignoredCount}</p>
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
                  const barColor = resourceLabelBarColors[label] || "bg-primary/70";
                  return (
                    <div
                      key={label}
                      className="cursor-pointer rounded-md p-1.5 -mx-1.5 hover:bg-muted/50 transition-colors"
                      onClick={() => handleResourceTypeClick(label)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-sm font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
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
