import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, ShieldAlert, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { EnhancedDashboardSummary } from "@/types";

interface CriticalAlertBannerProps {
  summary: EnhancedDashboardSummary | undefined;
  accountId?: string;
  onDismiss?: () => void;
}

interface AlertItem {
  id: string;
  type: "critical_findings" | "urgent_certs";
  icon: typeof AlertCircle;
  title: string;
  description: string;
  link: string;
  linkText: string;
}

export function CriticalAlertBanner({ summary, accountId, onDismiss }: CriticalAlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!summary) return null;

  const alerts: AlertItem[] = [];

  // Critical findings alert
  if (summary.findingCounts.critical > 0) {
    const basePath = accountId ? `/accounts/${accountId}` : "";
    alerts.push({
      id: "critical_findings",
      type: "critical_findings",
      icon: ShieldAlert,
      title: `${summary.findingCounts.critical} Critical Security Issue${summary.findingCounts.critical > 1 ? "s" : ""}`,
      description: "Immediate attention required. Critical findings may indicate active security risks.",
      link: `${basePath}/findings?severity=critical&status=open`,
      linkText: "View Critical Issues",
    });
  }

  // Urgent certificates (expiring in < 7 days)
  if (summary.certificateInsights.urgent > 0) {
    const basePath = accountId ? `/accounts/${accountId}` : "";
    const days = summary.certificateInsights.nearestExpiryDays;
    const daysText = days !== null
      ? days <= 0
        ? "already expired"
        : days === 1
          ? "expires tomorrow"
          : `expires in ${days} days`
      : "expiring soon";

    alerts.push({
      id: "urgent_certs",
      type: "urgent_certs",
      icon: Clock,
      title: `${summary.certificateInsights.urgent} Certificate${summary.certificateInsights.urgent > 1 ? "s" : ""} Expiring Soon`,
      description: `Certificate ${daysText}. Renew immediately to avoid service disruption.`,
      link: `${basePath}/findings?type=ssl_expiry&status=open`,
      linkText: "View Certificates",
    });
  }

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(alert => !dismissed.has(alert.id));

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (alertId: string) => {
    setDismissed(prev => new Set([...prev, alertId]));
    if (dismissed.size + 1 === alerts.length && onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="space-y-2">
      {visibleAlerts.map(alert => {
        const Icon = alert.icon;
        return (
          <Alert
            key={alert.id}
            variant="destructive"
            className={cn(
              "relative border-red-500/50 bg-red-500/10",
              "animate-in fade-in slide-in-from-top-2 duration-300"
            )}
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between pr-8">
              {alert.title}
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between mt-1">
              <span className="text-sm">{alert.description}</span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="ml-4 border-red-500/30 hover:bg-red-500/20"
              >
                <Link to={alert.link}>{alert.linkText}</Link>
              </Button>
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6 text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
              onClick={() => handleDismiss(alert.id)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </Alert>
        );
      })}
    </div>
  );
}
