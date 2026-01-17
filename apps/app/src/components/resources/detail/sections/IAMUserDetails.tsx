import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractIAMUserData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface IAMUserDetailsProps {
  resource: Resource;
}

export function IAMUserDetails({ resource }: IAMUserDetailsProps) {
  const data = extractIAMUserData(resource.raw);

  return (
    <div className="space-y-4">
      <DetailSection title="User Configuration">
        <DetailGrid>
          <DetailRow label="User Name" value={data.userName} />
          <DetailRow label="User ID" value={data.userId} mono />
          <DetailRow label="ARN" value={data.arn} mono copyable />
          <DetailRow label="Path" value={data.path} mono />
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">MFA Status</span>
            <Badge variant={data.mfaEnabled ? 'default' : 'destructive'}>
              {data.mfaEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Activity">
        <DetailGrid>
          <DetailRow
            label="Created"
            value={data.createDate ? formatDateTime(data.createDate) : null}
          />
          <DetailRow
            label="Password Last Used"
            value={data.passwordLastUsed ? formatDateTime(data.passwordLastUsed) : 'Never'}
          />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
