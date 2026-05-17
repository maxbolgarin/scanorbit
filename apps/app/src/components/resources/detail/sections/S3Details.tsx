import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractS3Data } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface S3DetailsProps {
  resource: Resource;
}

export function S3Details({ resource }: S3DetailsProps) {
  const data = extractS3Data(resource.raw);

  return (
    <div className="space-y-4">
      <DetailSection title="Bucket Configuration">
        <DetailGrid>
          <DetailRow label="Bucket Name" value={data.name || resource.name} />
          <DetailRow
            label="Created"
            value={data.creationDate ? formatDateTime(data.creationDate) : null}
          />
          <DetailRow label="Region" value={resource.region || 'us-east-1'} />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
