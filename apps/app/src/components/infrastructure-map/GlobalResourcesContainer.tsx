import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GlobalContainerNode, GlobalContainerNodeData } from '@/types/graph';

interface GlobalResourcesContainerProps extends NodeProps<GlobalContainerNode> {
  onToggleCollapse?: () => void;
}

/**
 * Global resources container node component for network topology view
 * Displays resources that don't belong to any VPC (IAM, S3, etc.)
 */
function GlobalResourcesContainerInner({ data, selected }: GlobalResourcesContainerProps) {
  const nodeData = data as GlobalContainerNodeData;
  const { resourceCount, isCollapsed } = nodeData;

  return (
    <div
      className={cn(
        'h-full w-full rounded-lg border-2 bg-gray-50/50 dark:bg-gray-900/20',
        'border-gray-400/50 dark:border-gray-500/30 border-dashed',
        selected && 'ring-2 ring-primary ring-offset-2',
        isCollapsed && 'cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-900/30'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 border-b border-gray-400/30 border-dashed',
          'bg-gray-100/50 dark:bg-gray-800/30 rounded-t-lg cursor-pointer',
          'hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors'
        )}
        data-global-toggle="true"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400 shrink-0" />
        )}

        <Globe className="h-4 w-4 text-gray-600 dark:text-gray-400 shrink-0" />

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Global Resources
          </span>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            (no VPC)
          </span>
        </div>

        <span className="text-xs bg-gray-500/20 px-2 py-0.5 rounded font-medium text-gray-700 dark:text-gray-300 shrink-0">
          {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content area - only shown when expanded */}
      {!isCollapsed && (
        <div className="p-4 min-h-[100px]">
          {/* Resource nodes are rendered as children */}
        </div>
      )}
    </div>
  );
}

export const GlobalResourcesContainer = memo(GlobalResourcesContainerInner);
