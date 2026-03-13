import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipBadge } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractEBSData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import { formatGiB } from '@/lib/rawDataUtils';
import type { Resource } from '@/types';

interface EBSDetailsProps {
  resource: Resource;
}

export function EBSDetails({ resource }: EBSDetailsProps) {
  const data = extractEBSData(resource.raw);

  const hasAttachments = data.attachments.length > 0;

  return (
    <div className="space-y-4">
      <DetailSection title="Volume Configuration">
        <DetailGrid>
          <DetailRow label="Volume ID" value={data.volumeId} mono copyable />
          <DetailRow label="Size" value={formatGiB(data.size)} />
          <DetailRow label="Volume Type" value={data.volumeType?.toUpperCase()} />
          <DetailRow label="State" value={data.state} />
          <DetailRow label="Encrypted" value={data.encrypted} />
          <DetailRow label="Availability Zone" value={data.availabilityZone} />
        </DetailGrid>
      </DetailSection>

      {(data.iops || data.throughput) && (
        <DetailSection title="Performance">
          <DetailGrid>
            <DetailRow label="IOPS" value={data.iops} />
            <DetailRow label="Throughput" value={data.throughput ? `${data.throughput} MiB/s` : null} />
          </DetailGrid>
        </DetailSection>
      )}

      <DetailSection title="Lifecycle">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.createTime ? formatDateTime(data.createTime) : null}
          />
          {data.unattachedSince && (
            <DetailRow
              label="Unattached Since"
              value={formatDateTime(data.unattachedSince)}
            />
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Attachments"
        description={hasAttachments ? `Attached to ${data.attachments.length} instance(s)` : 'Not attached to any instance'}
      >
        {hasAttachments ? (
          <div className="space-y-2">
            {data.attachments.map((att, index) => (
              <div
                key={att.instanceId || index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Instance:</span>
                    <ResourceRelationshipBadge resourceId={att.instanceId} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Device: <code className="font-mono">{att.device}</code></span>
                    <span>•</span>
                    <span>State: {att.state}</span>
                  </div>
                </div>
                <Badge variant={att.deleteOnTermination ? 'destructive' : 'secondary'} className="text-xs">
                  {att.deleteOnTermination ? 'Delete on termination' : 'Persist'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <Badge variant="outline" className="text-status-high border-status-high">
              Unattached
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              This volume is not attached to any EC2 instance
            </p>
          </div>
        )}
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
