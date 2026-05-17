import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipBadge } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractSecretsData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface SecretsDetailsProps {
  resource: Resource;
}

export function SecretsDetails({ resource }: SecretsDetailsProps) {
  const data = extractSecretsData(resource.raw);

  return (
    <div className="space-y-4">
      <DetailSection title="Secret Configuration">
        <DetailGrid>
          <DetailRow label="Name" value={data.name} />
          <DetailRow label="ARN" value={data.arn} mono copyable />
          {data.description && (
            <div className="sm:col-span-2 py-2 border-b">
              <span className="text-sm text-muted-foreground block mb-1">Description</span>
              <span className="text-sm">{data.description}</span>
            </div>
          )}
          <DetailRow label="Primary Region" value={data.primaryRegion} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Encryption">
        <DetailGrid>
          <div className="py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">KMS Key</span>
            {data.kmsKeyId ? (
              <ResourceRelationshipBadge resourceId={data.kmsKeyId} />
            ) : (
              <span className="text-sm text-muted-foreground">Default (aws/secretsmanager)</span>
            )}
          </div>
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Rotation">
        <DetailGrid>
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rotation Status</span>
            <Badge variant={data.rotationEnabled ? 'default' : 'secondary'}>
              {data.rotationEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          {data.rotationEnabled && (
            <>
              <DetailRow
                label="Last Rotated"
                value={data.lastRotatedDate ? formatDateTime(data.lastRotatedDate) : 'Never'}
              />
              <DetailRow
                label="Next Rotation"
                value={data.nextRotationDate ? formatDateTime(data.nextRotationDate) : null}
              />
            </>
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Activity">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.createdDate ? formatDateTime(data.createdDate) : null}
          />
          <DetailRow
            label="Last Accessed"
            value={data.lastAccessedDate ? formatDateTime(data.lastAccessedDate) : 'Never'}
          />
          <DetailRow
            label="Last Changed"
            value={data.lastChangedDate ? formatDateTime(data.lastChangedDate) : null}
          />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
