import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VPCContainerNode, VPCContainerNodeData } from '@/types/graph';

interface VPCContainerProps extends NodeProps<VPCContainerNode> {
  onToggleCollapse?: (vpcId: string) => void;
}

/**
 * VPC container node component for network topology view
 * Displays a large rectangle containing subnets and resources
 */
function VPCContainerInner({ data, selected }: VPCContainerProps) {
  const nodeData = data as VPCContainerNodeData;
  const { vpcId, resourceCount, subnetCount, isCollapsed } = nodeData;

  // Extract short VPC ID for display
  const shortVpcId = vpcId.startsWith('vpc-') ? vpcId : `vpc-${vpcId}`;

  return (
    <div
      className={cn(
        'h-full w-full rounded-lg border-2 bg-emerald-50/50 dark:bg-emerald-950/20',
        'border-emerald-500/50 dark:border-emerald-500/30',
        selected && 'ring-2 ring-primary ring-offset-2',
        isCollapsed && 'cursor-pointer hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 border-b border-emerald-500/30',
          'bg-emerald-100/50 dark:bg-emerald-900/30 rounded-t-lg cursor-pointer',
          'hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 transition-colors'
        )}
        data-vpc-toggle={vpcId}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        )}

        <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
            VPC
          </span>
          <span className="ml-2 font-mono text-xs text-emerald-700 dark:text-emerald-300 truncate">
            {shortVpcId}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCollapsed && subnetCount > 0 && (
            <span className="text-xs bg-emerald-200/50 dark:bg-emerald-800/50 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
              {subnetCount} subnet{subnetCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded font-medium text-emerald-700 dark:text-emerald-300">
            {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content area - only shown when expanded */}
      {!isCollapsed && (
        <div className="p-4 min-h-[100px]">
          {/* Multi-AZ resources section header (shown if there are multi-subnet resources) */}
          {/* The actual content is rendered as child nodes */}
        </div>
      )}
    </div>
  );
}

export const VPCContainer = memo(VPCContainerInner);
