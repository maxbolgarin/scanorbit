import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { SecurityGroupsPanel } from '../SecurityGroupsPanel';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractALBData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface ALBDetailsProps {
  resource: Resource;
}

export function ALBDetails({ resource }: ALBDetailsProps) {
  const data = extractALBData(resource.raw);

  const hasNetworking = data.vpcId || data.availabilityZones.length > 0 || data.securityGroups.length > 0;

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {hasNetworking && <TabsTrigger value="networking">Networking</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <DetailSection title="Load Balancer Configuration">
          <DetailGrid>
            <DetailRow label="Name" value={data.loadBalancerName} />
            <DetailRow label="ARN" value={data.loadBalancerArn} mono copyable />
            <DetailRow label="DNS Name" value={data.dnsName} mono copyable />
            <div className="py-2 border-b flex items-center justify-between">
              <span className="text-sm text-muted-foreground">State</span>
              <Badge variant={data.state === 'active' ? 'default' : 'secondary'}>
                {data.state || 'Unknown'}
              </Badge>
            </div>
            <DetailRow label="Type" value={data.type} />
            <div className="py-2 border-b flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Scheme</span>
              <Badge variant={data.scheme === 'internet-facing' ? 'outline' : 'secondary'}>
                {data.scheme || 'Unknown'}
              </Badge>
            </div>
            <DetailRow label="IP Address Type" value={data.ipAddressType} />
            <DetailRow
              label="Created"
              value={data.createdTime ? formatDateTime(data.createdTime) : null}
            />
          </DetailGrid>
        </DetailSection>

        <TagsSection tags={resource.tags} />
        <ResourceRawViewer raw={resource.raw} />
      </TabsContent>

      {hasNetworking && (
        <TabsContent value="networking" className="mt-4 space-y-4">
          <DetailSection title="VPC Configuration">
            <DetailGrid>
              <DetailRow label="VPC" value={data.vpcId} mono copyable />
            </DetailGrid>
          </DetailSection>

          {data.availabilityZones.length > 0 && (
            <DetailSection title="Availability Zones">
              <div className="space-y-2">
                {data.availabilityZones.map((az, index) => (
                  <div
                    key={az.subnetId || index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="text-sm font-medium">{az.zoneName}</span>
                    <span className="text-sm font-mono text-muted-foreground">{az.subnetId}</span>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {data.securityGroups.length > 0 && (
            <SecurityGroupsPanel
              securityGroups={data.securityGroups.map((sg) => ({
                groupId: sg,
                groupName: sg, // ALB only provides group IDs
              }))}
            />
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}
