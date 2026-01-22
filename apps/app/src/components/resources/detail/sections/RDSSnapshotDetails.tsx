import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipBadge } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractRDSSnapshotData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import { formatGiB } from '@/lib/rawDataUtils';
import type { Resource } from '@/types';

interface RDSSnapshotDetailsProps {
  resource: Resource;
}

export function RDSSnapshotDetails({ resource }: RDSSnapshotDetailsProps) {
  const data = extractRDSSnapshotData(resource.raw);

  return (
    <div className="space-y-4">
      <DetailSection title="Snapshot Configuration">
        <DetailGrid>
          <DetailRow label="Snapshot ID" value={data.dbSnapshotIdentifier} mono copyable />
          <div className="py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">Source DB Instance</span>
            {data.dbInstanceIdentifier ? (
              <ResourceRelationshipBadge resourceId={data.dbInstanceIdentifier} />
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={data.status === 'available' ? 'default' : 'secondary'}>
              {data.status || 'Unknown'}
            </Badge>
          </div>
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Snapshot Type</span>
            <Badge variant={data.snapshotType === 'manual' ? 'default' : 'secondary'}>
              {data.snapshotType || 'Unknown'}
            </Badge>
          </div>
          {data.percentProgress !== null && data.percentProgress < 100 && (
            <DetailRow label="Progress" value={`${data.percentProgress}%`} />
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Database Information">
        <DetailGrid>
          <DetailRow label="Engine" value={data.engine} />
          <DetailRow label="Engine Version" value={data.engineVersion} />
          <DetailRow label="Master Username" value={data.masterUsername} />
          <DetailRow label="Port" value={data.port} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Storage">
        <DetailGrid>
          <DetailRow label="Allocated Storage" value={formatGiB(data.allocatedStorage)} />
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Encryption</span>
            <Badge variant={data.encrypted ? 'default' : 'secondary'}>
              {data.encrypted ? 'Encrypted' : 'Not Encrypted'}
            </Badge>
          </div>
          {data.kmsKeyId && (
            <div className="py-2 border-b">
              <span className="text-sm text-muted-foreground block mb-1">KMS Key</span>
              <ResourceRelationshipBadge resourceId={data.kmsKeyId} />
            </div>
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Location">
        <DetailGrid>
          <DetailRow label="Availability Zone" value={data.availabilityZone} />
          <DetailRow label="VPC" value={data.vpcId} mono copyable />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Lifecycle">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.snapshotCreateTime ? formatDateTime(data.snapshotCreateTime) : null}
          />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
