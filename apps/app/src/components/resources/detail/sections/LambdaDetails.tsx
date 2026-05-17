import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractLambdaData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import { formatBytes, formatMiB, formatSeconds } from '@/lib/rawDataUtils';
import type { Resource } from '@/types';

interface LambdaDetailsProps {
  resource: Resource;
}

export function LambdaDetails({ resource }: LambdaDetailsProps) {
  const data = extractLambdaData(resource.raw);

  return (
    <div className="space-y-4">
      <DetailSection title="Function Configuration">
        <DetailGrid>
          <DetailRow label="Function Name" value={data.functionName} />
          <DetailRow label="ARN" value={data.functionArn} mono copyable />
          <DetailRow label="Runtime" value={data.runtime} />
          <DetailRow label="Handler" value={data.handler} mono />
          <DetailRow label="Package Type" value={data.packageType} />
          {data.description && (
            <div className="sm:col-span-2 py-2 border-b">
              <span className="text-sm text-muted-foreground block mb-1">Description</span>
              <span className="text-sm">{data.description}</span>
            </div>
          )}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Compute Settings">
        <DetailGrid>
          <DetailRow label="Memory" value={formatMiB(data.memorySize)} />
          <DetailRow label="Timeout" value={formatSeconds(data.timeout)} />
          <DetailRow label="Ephemeral Storage" value={formatMiB(data.ephemeralStorageSize)} />
          <div className="py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">Architecture</span>
            <div className="flex gap-2 mt-1">
              {data.architectures.length > 0 ? (
                data.architectures.map((arch) => (
                  <Badge key={arch} variant="secondary">
                    {arch}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </div>
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Code">
        <DetailGrid>
          <DetailRow label="Code Size" value={formatBytes(data.codeSize)} />
          <DetailRow
            label="Last Modified"
            value={data.lastModified ? formatDateTime(data.lastModified) : null}
          />
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
