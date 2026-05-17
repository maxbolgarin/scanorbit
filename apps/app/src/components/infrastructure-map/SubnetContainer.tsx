import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubnetContainerNode, SubnetContainerNodeData } from '@/types/graph';

interface SubnetContainerProps extends NodeProps<SubnetContainerNode> {
  onToggleCollapse?: (subnetId: string) => void;
}

/**
 * Subnet container node component for network topology view
 * Displays a rectangle inside a VPC containing resources
 */
function SubnetContainerInner({ data, selected }: SubnetContainerProps) {
  const nodeData = data as SubnetContainerNodeData;
  const { subnetId, availabilityZone, resourceCount, isCollapsed } = nodeData;

  // Extract short subnet ID for display
  const shortSubnetId = subnetId.startsWith('subnet-')
    ? `...${subnetId.slice(-8)}`
    : subnetId;

  return (
    <div
      className={cn(
        'h-full w-full rounded-md border bg-blue-50/50 dark:bg-blue-950/20',
        'border-blue-400/50 dark:border-blue-500/30',
        selected && 'ring-2 ring-primary ring-offset-1',
        isCollapsed && 'cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-b border-blue-400/30',
          'bg-blue-100/50 dark:bg-blue-900/30 rounded-t-md cursor-pointer',
          'hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition-colors'
        )}
        data-subnet-toggle={subnetId}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        )}

        <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />

        <div className="flex-1 min-w-0">
          <span className="font-medium text-xs text-blue-900 dark:text-blue-100">
            Subnet
          </span>
          <span className="ml-1.5 font-mono text-[10px] text-blue-700 dark:text-blue-300 truncate">
            {shortSubnetId}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {availabilityZone && (
            <span className="text-[10px] bg-blue-200/50 dark:bg-blue-800/50 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300">
              {availabilityZone}
            </span>
          )}
          <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded font-medium text-blue-700 dark:text-blue-300">
            {resourceCount}
          </span>
        </div>
      </div>

      {/* Content area - only shown when expanded */}
      {!isCollapsed && (
        <div className="p-2 min-h-[60px]">
          {/* Resource nodes are rendered as children */}
        </div>
      )}
    </div>
  );
}

export const SubnetContainer = memo(SubnetContainerInner);
