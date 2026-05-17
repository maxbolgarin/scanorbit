import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractCloudWatchAlarmData } from '@/types/rawData';
import type { Resource } from '@/types';

interface CloudWatchAlarmDetailsProps {
  resource: Resource;
}

function getAlarmStateConfig(state: string | null): {
  variant: 'default' | 'destructive' | 'secondary';
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  textClass: string;
} {
  switch (state) {
    case 'ALARM':
      return {
        variant: 'destructive',
        icon: <AlertTriangle className="h-5 w-5 text-status-critical shrink-0" />,
        bgClass: 'bg-status-critical/15',
        borderClass: 'border-status-critical/30',
        textClass: 'text-status-critical',
      };
    case 'OK':
      return {
        variant: 'default',
        icon: <CheckCircle className="h-5 w-5 text-status-success shrink-0" />,
        bgClass: 'bg-status-success/15',
        borderClass: 'border-status-success/30',
        textClass: 'text-status-success',
      };
    case 'INSUFFICIENT_DATA':
    default:
      return {
        variant: 'secondary',
        icon: <HelpCircle className="h-5 w-5 text-status-warning shrink-0" />,
        bgClass: 'bg-status-warning/15',
        borderClass: 'border-status-warning/30',
        textClass: 'text-status-warning',
      };
  }
}

function formatComparisonOperator(op: string | null): string {
  switch (op) {
    case 'GreaterThanThreshold':
      return '>';
    case 'GreaterThanOrEqualToThreshold':
      return '>=';
    case 'LessThanThreshold':
      return '<';
    case 'LessThanOrEqualToThreshold':
      return '<=';
    default:
      return op || '';
  }
}

export function CloudWatchAlarmDetails({ resource }: CloudWatchAlarmDetailsProps) {
  const data = extractCloudWatchAlarmData(resource.raw);
  const stateConfig = getAlarmStateConfig(data.stateValue);

  return (
    <div className="space-y-4">
      {/* State Banner */}
      <div className={`flex items-start gap-2 p-3 ${stateConfig.bgClass} border ${stateConfig.borderClass} rounded-lg`}>
        {stateConfig.icon}
        <div>
          <p className={`text-sm font-medium ${stateConfig.textClass}`}>
            {data.stateValue === 'ALARM' ? 'In Alarm State' :
             data.stateValue === 'OK' ? 'OK' : 'Insufficient Data'}
          </p>
          {data.stateReason && (
            <p className="text-sm text-muted-foreground mt-1">{data.stateReason}</p>
          )}
        </div>
      </div>

      <DetailSection title="Alarm Configuration">
        <DetailGrid>
          <DetailRow label="Alarm Name" value={data.alarmName} />
          <DetailRow label="ARN" value={data.alarmArn} mono copyable />
          {data.description && (
            <div className="sm:col-span-2 py-2 border-b">
              <span className="text-sm text-muted-foreground block mb-1">Description</span>
              <span className="text-sm">{data.description}</span>
            </div>
          )}
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">State</span>
            <Badge variant={stateConfig.variant}>
              {data.stateValue || 'Unknown'}
            </Badge>
          </div>
          <div className="py-2 border-b flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Actions</span>
            <Badge variant={data.actionsEnabled ? 'default' : 'secondary'}>
              {data.actionsEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Metric Configuration">
        <DetailGrid>
          <DetailRow label="Metric Name" value={data.metricName} />
          <DetailRow label="Namespace" value={data.namespace} />
          <DetailRow label="Statistic" value={data.statistic} />
          <DetailRow
            label="Period"
            value={data.period ? `${data.period} seconds` : null}
          />
          <DetailRow label="Evaluation Periods" value={data.evaluationPeriods} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Threshold">
        <DetailGrid>
          <div className="sm:col-span-2 py-2 border-b">
            <span className="text-sm text-muted-foreground block mb-1">Condition</span>
            <code className="text-sm font-mono">
              {data.metricName} {formatComparisonOperator(data.comparisonOperator)} {data.threshold}
            </code>
          </div>
        </DetailGrid>
      </DetailSection>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
