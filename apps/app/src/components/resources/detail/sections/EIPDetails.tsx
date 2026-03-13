import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipBadge } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractEIPData } from '@/types/rawData';
import type { Resource } from '@/types';

interface EIPDetailsProps {
  resource: Resource;
}

export function EIPDetails({ resource }: EIPDetailsProps) {
  const data = extractEIPData(resource.raw);

  const isUnattached = !data.instanceId && !data.networkInterfaceId;

  return (
    <div className="space-y-4">
      {isUnattached && (
        <div className="flex items-center gap-2 p-3 bg-status-high/10 border border-status-high/20 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-status-high shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-high">Unattached Elastic IP</p>
            <p className="text-sm text-muted-foreground">
              This Elastic IP is not associated with any instance or network interface. You are being charged for it.
            </p>
          </div>
        </div>
      )}

      <DetailSection title="IP Configuration">
        <DetailGrid>
          <DetailRow label="Public IP" value={data.publicIp} mono copyable />
          <DetailRow label="Allocation ID" value={data.allocationId} mono copyable />
          <DetailRow label="Domain" value={data.domain} />
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isUnattached ? 'destructive' : 'default'}>
              {isUnattached ? 'Unattached' : 'Associated'}
            </Badge>
          </div>
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Association">
        <DetailGrid>
          <div className="py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">Instance</span>
            {data.instanceId ? (
              <ResourceRelationshipBadge resourceId={data.instanceId} />
            ) : (
              <span className="text-sm text-muted-foreground">Not attached</span>
            )}
          </div>
          <DetailRow label="Association ID" value={data.associationId} mono />
          <div className="py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">Network Interface</span>
            {data.networkInterfaceId ? (
              <ResourceRelationshipBadge resourceId={data.networkInterfaceId} />
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <DetailRow label="Private IP" value={data.privateIpAddress} mono />
          <DetailRow label="Network Interface Owner" value={data.networkInterfaceOwnerId} mono />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
