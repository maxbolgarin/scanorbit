import { Info } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { getServiceLabel } from '@/components/shared/ServiceIcon';
import type { Resource } from '@/types';

interface GenericDetailsProps {
  resource: Resource;
}

/**
 * Generic fallback component for resource types that don't have dedicated detail views.
 * Shows basic information and suggests expanding the Raw JSON viewer for full details.
 */
export function GenericDetails({ resource }: GenericDetailsProps) {
  // Try to extract some common fields from raw data
  const raw = resource.raw || {};

  // Common fields that might exist across different resource types
  const possibleFields: Array<{ label: string; keys: string[]; mono?: boolean }> = [
    { label: 'ARN', keys: ['Arn', 'arn', 'ARN', 'FunctionArn', 'KeyArn', 'RoleArn', 'UserArn', 'LoadBalancerArn'], mono: true },
    { label: 'Name', keys: ['Name', 'name', 'FunctionName', 'KeyId', 'UserName', 'RoleName', 'GroupName', 'BucketName', 'LogGroupName'] },
    { label: 'Description', keys: ['Description', 'description'] },
    { label: 'Status', keys: ['Status', 'status', 'State', 'state', 'KeyState'] },
    { label: 'Created', keys: ['CreatedAt', 'created_at', 'CreateDate', 'create_date', 'CreationDate', 'creation_date', 'creation_time'] },
  ];

  const extractedFields: Array<{ label: string; value: string; mono?: boolean }> = [];

  for (const field of possibleFields) {
    for (const key of field.keys) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '') {
        extractedFields.push({
          label: field.label,
          value: String(value),
          mono: field.mono,
        });
        break; // Found a value for this field, move to next
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Limited detail view</p>
          <p className="text-muted-foreground mt-1">
            A dedicated detail view for {getServiceLabel(resource.service)} resources is not yet available.
            Expand the "Raw AWS API Response" section below to see all available data.
          </p>
        </div>
      </div>

      {extractedFields.length > 0 && (
        <DetailSection title="Extracted Information">
          <DetailGrid columns={1}>
            {extractedFields.map((field) => (
              <DetailRow
                key={field.label}
                label={field.label}
                value={field.value}
                mono={field.mono}
                copyable={field.mono}
              />
            ))}
          </DetailGrid>
        </DetailSection>
      )}

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
