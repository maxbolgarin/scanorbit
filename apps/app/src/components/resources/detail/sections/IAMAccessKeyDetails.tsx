import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractIAMAccessKeyData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface IAMAccessKeyDetailsProps {
  resource: Resource;
}

function getKeyAgeInDays(createDate: string | null): number | null {
  if (!createDate) return null;
  const created = new Date(createDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function IAMAccessKeyDetails({ resource }: IAMAccessKeyDetailsProps) {
  const data = extractIAMAccessKeyData(resource.raw);
  const keyAge = getKeyAgeInDays(data.createDate);
  const isOldKey = keyAge !== null && keyAge > 90;

  return (
    <div className="space-y-4">
      {isOldKey && (
        <div className="flex items-center gap-2 p-3 bg-status-high/10 border border-status-high/20 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-status-high shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-high">Old Access Key</p>
            <p className="text-sm text-muted-foreground">
              This access key is {keyAge} days old. Consider rotating it for security best practices.
            </p>
          </div>
        </div>
      )}

      <DetailSection title="Access Key Configuration">
        <DetailGrid>
          <DetailRow label="Access Key ID" value={data.accessKeyId} mono copyable />
          <DetailRow label="User Name" value={data.userName} />
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={data.status === 'Active' ? 'default' : 'secondary'}>
              {data.status || 'Unknown'}
            </Badge>
          </div>
          <DetailRow
            label="Age"
            value={keyAge !== null ? `${keyAge} days` : null}
          />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Activity">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.createDate ? formatDateTime(data.createDate) : null}
          />
          <DetailRow
            label="Last Used"
            value={data.lastUsedDate ? formatDateTime(data.lastUsedDate) : 'Never'}
          />
          <DetailRow
            label="Last Used Service"
            value={data.lastUsedService || (data.lastUsedDate ? 'Unknown' : '-')}
          />
          <DetailRow
            label="Last Used Region"
            value={data.lastUsedRegion || (data.lastUsedDate ? 'Unknown' : '-')}
          />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
