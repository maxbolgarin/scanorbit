import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon: Icon,
  iconColor = "text-primary",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 text-sm">
                {trend >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-status-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-status-critical" />
                )}
                <span
                  className={cn(
                    trend >= 0 ? "text-status-success" : "text-status-critical"
                  )}
                >
                  {trend >= 0 ? "+" : ""}
                  {trend}
                </span>
                {trendLabel && (
                  <span className="text-muted-foreground">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("rounded-lg bg-muted p-2", iconColor)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
