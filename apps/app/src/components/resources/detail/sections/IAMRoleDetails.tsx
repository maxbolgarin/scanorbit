import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractIAMRoleData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface IAMRoleDetailsProps {
  resource: Resource;
}

export function IAMRoleDetails({ resource }: IAMRoleDetailsProps) {
  const data = extractIAMRoleData(resource.raw);

  return (
    <div className="space-y-4">
      <DetailSection title="Role Configuration">
        <DetailGrid>
          <DetailRow label="Role Name" value={data.roleName} />
          <DetailRow label="Role ID" value={data.roleId} mono />
          <DetailRow label="ARN" value={data.arn} mono copyable />
          <DetailRow label="Path" value={data.path} mono />
          {data.description && (
            <div className="sm:col-span-2 py-2 border-b">
              <span className="text-sm text-muted-foreground block mb-1">Description</span>
              <span className="text-sm">{data.description}</span>
            </div>
          )}
          <DetailRow
            label="Max Session Duration"
            value={data.maxSessionDuration ? `${Math.floor(data.maxSessionDuration / 3600)} hours` : null}
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
