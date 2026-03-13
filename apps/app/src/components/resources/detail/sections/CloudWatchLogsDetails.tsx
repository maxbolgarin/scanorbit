import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipBadge } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractCloudWatchLogsData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import { formatBytes } from '@/lib/rawDataUtils';
import type { Resource } from '@/types';

interface CloudWatchLogsDetailsProps {
  resource: Resource;
}

export function CloudWatchLogsDetails({ resource }: CloudWatchLogsDetailsProps) {
  const data = extractCloudWatchLogsData(resource.raw);

  const hasNoRetention = data.retentionDays === null || data.retentionDays === 0;

  return (
    <div className="space-y-4">
      {hasNoRetention && (
        <div className="flex items-center gap-2 p-3 bg-status-high/10 border border-status-high/20 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-status-high shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-high">No Retention Policy</p>
            <p className="text-sm text-muted-foreground">
              Logs are retained indefinitely. Consider setting a retention policy to manage costs.
            </p>
          </div>
        </div>
      )}

      <DetailSection title="Log Group Configuration">
        <DetailGrid>
          <DetailRow label="Log Group Name" value={data.logGroupName} mono />
          <DetailRow label="ARN" value={data.arn} mono copyable />
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Retention</span>
            <Badge variant={hasNoRetention ? 'secondary' : 'default'}>
              {data.retentionDays ? `${data.retentionDays} days` : 'Never expire'}
            </Badge>
          </div>
          <DetailRow
            label="Stored Data"
            value={formatBytes(data.storedBytes)}
          />
          <DetailRow label="Metric Filters" value={data.metricFilterCount} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Encryption">
        <DetailGrid>
          <div className="py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">KMS Key</span>
            {data.kmsKeyId ? (
              <ResourceRelationshipBadge resourceId={data.kmsKeyId} />
            ) : (
              <span className="text-sm text-muted-foreground">Default (CloudWatch service key)</span>
            )}
          </div>
          {data.dataProtection && (
            <DetailRow label="Data Protection" value={data.dataProtection} />
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Lifecycle">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.creationTime ? formatDateTime(data.creationTime) : null}
          />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
