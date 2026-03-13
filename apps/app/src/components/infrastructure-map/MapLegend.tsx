import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceIcon } from '@/components/shared/ServiceIcon';
import type { ServiceType } from '@/types';
import type { GraphStats } from '@/types/graph';

interface MapLegendProps {
  stats: GraphStats;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const EDGE_TYPES = [
  { label: 'Security Group', color: '#3b82f6', dashed: true },
  { label: 'Attachment', color: '#6b7280', dashed: false },
  { label: 'KMS Encryption', color: '#f59e0b', dashed: false },
  { label: 'Dependency', color: '#9ca3af', dashed: false },
];

const CRITICALITY_LEVELS = [
  { label: 'Critical', color: 'border-status-critical', bg: 'bg-status-critical/10' },
  { label: 'High', color: 'border-status-high', bg: 'bg-status-high/10' },
  { label: 'Medium', color: 'border-status-warning', bg: 'bg-status-warning/10' },
  { label: 'Low', color: 'border-status-info', bg: 'bg-status-info/10' },
];

export function MapLegend({ stats, isCollapsed, onToggle }: MapLegendProps) {
  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="bg-card border rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
      >
        Show Legend
      </button>
    );
  }

  return (
    <Card className="w-64 bg-card/95 backdrop-blur-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Legend</CardTitle>
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-0 px-4 pb-4 space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/50 rounded px-2 py-1.5">
            <div className="text-muted-foreground">Resources</div>
            <div className="font-semibold">{stats.totalNodes}</div>
          </div>
          <div className="bg-muted/50 rounded px-2 py-1.5">
            <div className="text-muted-foreground">Connections</div>
            <div className="font-semibold">{stats.totalEdges}</div>
          </div>
          {stats.nodesWithFindings > 0 && (
            <div className="bg-status-high/10 rounded px-2 py-1.5 col-span-2">
              <div className="text-status-high">With Findings</div>
              <div className="font-semibold text-status-high">{stats.nodesWithFindings}</div>
            </div>
          )}
        </div>

        {/* Edge Types */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Connection Types</div>
          {EDGE_TYPES.map((type) => (
            <div key={type.label} className="flex items-center gap-2">
              <div
                className="w-6 h-0"
                style={{
                  borderTop: type.dashed
                    ? `2px dashed ${type.color}`
                    : `2px solid ${type.color}`,
                }}
              />
              <span className="text-xs">{type.label}</span>
            </div>
          ))}
        </div>

        {/* Criticality Levels */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Finding Severity</div>
          {CRITICALITY_LEVELS.map((level) => (
            <div key={level.label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-2 ${level.color} ${level.bg}`} />
              <span className="text-xs">{level.label}</span>
            </div>
          ))}
        </div>

        {/* Service Breakdown */}
        {Object.keys(stats.nodesByService).length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Resources by Type</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats.nodesByService)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([service, count]) => (
                  <Badge key={service} variant="secondary" className="text-[10px] gap-1 px-1.5">
                    <ServiceIcon service={service as ServiceType} className="h-3 w-3" />
                    {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
