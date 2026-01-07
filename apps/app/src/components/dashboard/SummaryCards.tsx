import { MetricCard } from "@/components/shared/MetricCard";
import { Server, HardDrive, Shield, Globe } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardSummary } from "@/types";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Resources Discovered"
        value={summary.totalResources}
        trend={summary.resourcesTrend}
        trendLabel="from last scan"
        icon={Server}
        iconColor="text-blue-500"
      />
      <MetricCard
        title="Orphaned Resources"
        value={summary.orphanedResources}
        subtitle={`Save ${formatCurrency(summary.orphanedSavings)}/month`}
        icon={HardDrive}
        iconColor="text-orange-500"
      />
      <MetricCard
        title="Expiring Certificates"
        value={summary.expiringCertificates}
        subtitle={
          summary.urgentCertificates > 0
            ? `${summary.urgentCertificates} urgent (<7 days)`
            : "None urgent"
        }
        icon={Shield}
        iconColor={summary.urgentCertificates > 0 ? "text-red-500" : "text-green-500"}
      />
      <MetricCard
        title="Residency Violations"
        value={summary.residencyViolations}
        subtitle="Non-EU resources detected"
        icon={Globe}
        iconColor={summary.residencyViolations > 0 ? "text-red-500" : "text-green-500"}
      />
    </div>
  );
}
