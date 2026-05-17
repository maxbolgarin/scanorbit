import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractKMSKeyData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface KMSKeyDetailsProps {
  resource: Resource;
}

function getKeyStateVariant(state: string | null): 'default' | 'secondary' | 'destructive' {
  switch (state) {
    case 'Enabled':
      return 'default';
    case 'Disabled':
      return 'secondary';
    case 'PendingDeletion':
    case 'PendingImport':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function KMSKeyDetails({ resource }: KMSKeyDetailsProps) {
  const data = extractKMSKeyData(resource.raw);

  return (
    <div className="space-y-4">
      {data.keyState === 'PendingDeletion' && (
        <div className="flex items-center gap-2 p-3 bg-status-critical/15 border border-status-critical/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-status-critical shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-critical">Pending Deletion</p>
            <p className="text-sm text-muted-foreground">
              This key is scheduled for deletion
              {data.deletionDate && ` on ${formatDateTime(data.deletionDate)}`}
            </p>
          </div>
        </div>
      )}

      {data.keyRotationEnabled === false && data.keyState === 'Enabled' && (
        <div className="flex items-center gap-2 p-3 bg-status-high/15 border border-status-high/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-status-high shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-high">Key Rotation Disabled</p>
            <p className="text-sm text-muted-foreground">
              Automatic key rotation is not enabled for this key
            </p>
          </div>
        </div>
      )}

      <DetailSection title="Key Configuration">
        <DetailGrid>
          <DetailRow label="Key ID" value={data.keyId} mono copyable />
          <DetailRow label="Key ARN" value={data.keyArn} mono copyable />
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">State</span>
            <Badge variant={getKeyStateVariant(data.keyState)}>
              {data.keyState || 'Unknown'}
            </Badge>
          </div>
          <DetailRow label="Key Usage" value={data.keyUsage} />
          <DetailRow label="Key Spec" value={data.keySpec} />
          <DetailRow label="Origin" value={data.origin} />
          <DetailRow label="Key Manager" value={data.keyManager} />
          {data.description && (
            <div className="sm:col-span-2 py-2 border-b">
              <span className="text-sm text-muted-foreground block mb-1">Description</span>
              <span className="text-sm">{data.description}</span>
            </div>
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Security Settings">
        <DetailGrid>
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Key Rotation</span>
            <Badge variant={data.keyRotationEnabled ? 'default' : 'secondary'}>
              {data.keyRotationEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Multi-Region</span>
            <Badge variant={data.multiRegion ? 'default' : 'secondary'}>
              {data.multiRegion ? 'Yes' : 'No'}
            </Badge>
          </div>
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Lifecycle">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.creationDate ? formatDateTime(data.creationDate) : null}
          />
          {data.deletionDate && (
            <DetailRow
              label="Scheduled Deletion"
              value={formatDateTime(data.deletionDate)}
            />
          )}
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
