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

const ITEMS_PER_PAGE = 5;

export function FindingStatsCards({ stats, isLoading, onFilterSelect }: FindingStatsCardsProps) {
  const [categoryPage, setCategoryPage] = useState(0);
  const [typePage, setTypePage] = useState(0);

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

  // Calculate category counts and sort by count descending
  const categoryCounts = Object.entries(findingCategories).map(([key, category]) => {
    const count = category.types.reduce((sum, type) => sum + (byType[type] || 0), 0);
    return { key, ...category, count };
  }).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  const openCount = byStatus["open"] || 0;
  const resolvedCount = byStatus["resolved"] || 0;
  const snoozedCount = byStatus["snoozed"] || 0;
  const ignoredCount = byStatus["ignored"] || 0;

  const highCount = bySeverity["high"] || 0;
  const mediumCount = bySeverity["medium"] || 0;
  const lowCount = bySeverity["low"] || 0;

  // Calculate max counts for progress bar scaling
  const maxCategoryCount = Math.max(...categoryCounts.map(c => c.count), 1);
  const maxTypeCount = Math.max(...Object.values(byType), 1);

  // Pagination calculations
  const categoryTotalPages = Math.ceil(categoryCounts.length / ITEMS_PER_PAGE);
  const paginatedCategories = categoryCounts.slice(
    categoryPage * ITEMS_PER_PAGE,
    (categoryPage + 1) * ITEMS_PER_PAGE
  );

  const allTypes = Object.entries(byType).sort(([, a], [, b]) => b - a);
  const typeTotalPages = Math.ceil(allTypes.length / ITEMS_PER_PAGE);
  const paginatedTypes = allTypes.slice(
    typePage * ITEMS_PER_PAGE,
    (typePage + 1) * ITEMS_PER_PAGE
  );

  // Click handlers
  const handleCategoryClick = (categoryKey: string) => {
    const category = findingCategories[categoryKey];
    if (category && category.types.length > 0) {
      onFilterSelect?.({ type: category.types[0] as FindingType });
    }
  };

  const handleTypeClick = (type: string) => {
    onFilterSelect?.({ type: type as FindingType });
  };

  return (
    <div className="space-y-4">
      {/* Main stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open Findings */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Open Findings
                </p>
                <p className="mt-1 text-3xl font-bold">{openCount}</p>
              </div>
              <div className="rounded-full bg-muted p-3">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Findings by Category
                </h3>
                {categoryTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCategoryPage(p => Math.max(0, p - 1))}
                      disabled={categoryPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      {categoryPage + 1}/{categoryTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCategoryPage(p => Math.min(categoryTotalPages - 1, p + 1))}
                      disabled={categoryPage === categoryTotalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {paginatedCategories.map((category) => {
                  const Icon = category.icon;
                  // Use relative percentage based on max count for better visualization
                  const percentage = Math.round((category.count / maxCategoryCount) * 100);
                  return (
                    <div
                      key={category.key}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleCategoryClick(category.key)}
                    >
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
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
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
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Finding Types */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Top Finding Types
                </h3>
                {typeTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setTypePage(p => Math.max(0, p - 1))}
                      disabled={typePage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      {typePage + 1}/{typeTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setTypePage(p => Math.min(typeTotalPages - 1, p + 1))}
                      disabled={typePage === typeTotalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {paginatedTypes.map(([type, count]) => {
                  // Use relative percentage based on max count for better visualization
                  const percentage = Math.round((count / maxTypeCount) * 100);
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleTypeClick(type)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">
                            {type.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {count}
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full bg-primary transition-all duration-300"
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
