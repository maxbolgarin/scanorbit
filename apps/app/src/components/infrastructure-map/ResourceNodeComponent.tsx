import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ServiceIcon, getServiceLabel } from '@/components/shared/ServiceIcon';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ResourceNodeData, CriticalityLevel, ResourceNode } from '@/types/graph';

/**
 * Get border color class based on criticality level
 */
function getCriticalityBorderClass(criticality: CriticalityLevel): string {
  switch (criticality) {
    case 'critical':
      return 'border-status-critical border-2';
    case 'high':
      return 'border-status-high border-2';
    case 'medium':
      return 'border-status-warning';
    case 'low':
      return 'border-status-info';
    default:
      return 'border-border';
  }
}

/**
 * Get background glow class based on criticality level
 */
function getCriticalityGlowClass(criticality: CriticalityLevel): string {
  switch (criticality) {
    case 'critical':
      return 'shadow-red-500/30 shadow-lg';
    case 'high':
      return 'shadow-orange-500/20 shadow-md';
    default:
      return '';
  }
}

/**
 * Custom node component for rendering resources in the infrastructure map
 */
function ResourceNodeComponentInner({ data, selected }: NodeProps<ResourceNode>) {
  const nodeData = data as ResourceNodeData;

  const borderClass = getCriticalityBorderClass(nodeData.criticalityLevel);
  const glowClass = getCriticalityGlowClass(nodeData.criticalityLevel);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'px-3 py-2 rounded-lg bg-card border cursor-pointer transition-all',
              'hover:bg-accent/50 min-w-[140px] max-w-[180px]',
              borderClass,
              glowClass,
              selected && 'ring-2 ring-primary ring-offset-2'
            )}
            // Click handled by onNodeClick in ReactFlow
          >
            {/* Top handle for incoming connections */}
            <Handle
              type="target"
              position={Position.Top}
              className="!bg-primary !w-2 !h-2"
            />

            <div className="flex items-center gap-2">
              <ServiceIcon service={nodeData.service} className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate" title={nodeData.label}>
                  {nodeData.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {getServiceLabel(nodeData.service)}
                </div>
              </div>
              {nodeData.findingsCount > 0 && (
                <Badge
                  variant={nodeData.criticalityLevel === 'critical' ? 'destructive' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {nodeData.findingsCount}
                </Badge>
              )}
            </div>

            {/* Region badge */}
            {nodeData.region && (
              <div className="mt-1.5 text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded inline-block">
                {nodeData.region}
              </div>
            )}

            {/* Bottom handle for outgoing connections */}
            <Handle
              type="source"
              position={Position.Bottom}
              className="!bg-primary !w-2 !h-2"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-[9999] max-w-sm p-4 bg-popover border-2 border-border shadow-xl"
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <ServiceIcon service={nodeData.service} className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">{nodeData.label}</p>
                <p className="text-xs text-muted-foreground">
                  {getServiceLabel(nodeData.service)} • {nodeData.region || 'Global'}
                </p>
              </div>
            </div>

            {/* Resource ID */}
            <div className="bg-muted/50 rounded px-2 py-1.5">
              <p className="text-[11px] font-mono text-foreground/80 break-all">
                {nodeData.resource.resourceId}
              </p>
            </div>

            {/* State */}
            {nodeData.resource.state && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">State:</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {nodeData.resource.state}
                </Badge>
              </div>
            )}

            {/* Findings */}
            {nodeData.findingsCount > 0 && (
              <div className="flex items-center gap-2 bg-status-high/15 rounded px-2 py-1.5">
                <span className="text-sm font-medium text-status-high">
                  ⚠ {nodeData.findingsCount} open finding{nodeData.findingsCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Footer */}
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              Click to view details
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const ResourceNodeComponent = memo(ResourceNodeComponentInner);
