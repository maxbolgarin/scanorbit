import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipBadge, ResourceRelationshipList } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractEC2Data } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import type { Resource } from '@/types';

interface EC2DetailsProps {
  resource: Resource;
}

export function EC2Details({ resource }: EC2DetailsProps) {
  const data = extractEC2Data(resource.raw);

  const hasNetworking = data.vpcId || data.subnetId || data.publicIpAddress || data.privateIpAddress;
  const hasSecurity = data.securityGroups.length > 0 || data.iamInstanceProfile;
  const hasStorage = data.blockDeviceMappings.length > 0;

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {hasNetworking && <TabsTrigger value="networking">Networking</TabsTrigger>}
        {hasSecurity && <TabsTrigger value="security">Security</TabsTrigger>}
        {hasStorage && <TabsTrigger value="storage">Storage</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <DetailSection title="Instance Configuration">
          <DetailGrid>
            <DetailRow label="Instance Type" value={data.instanceType} />
            <DetailRow label="Architecture" value={data.architecture} />
            <DetailRow label="AMI ID" value={data.imageId} mono />
            <DetailRow label="Key Pair" value={data.keyName} />
            <DetailRow label="Platform" value={data.platform || 'Linux/UNIX'} />
            <DetailRow label="Virtualization" value={data.virtualizationType} />
            <DetailRow label="Hypervisor" value={data.hypervisor} />
            <DetailRow label="Availability Zone" value={data.availabilityZone} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Compute">
          <DetailGrid>
            <DetailRow label="vCPUs" value={data.coreCount && data.threadsPerCore ? data.coreCount * data.threadsPerCore : null} />
            <DetailRow label="Core Count" value={data.coreCount} />
            <DetailRow label="Threads per Core" value={data.threadsPerCore} />
            <DetailRow label="EBS Optimized" value={data.ebsOptimized} />
            <DetailRow label="ENA Support" value={data.enaSupport} />
            <DetailRow label="Monitoring" value={data.monitoring} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Lifecycle">
          <DetailGrid>
            <DetailRow
              label="Launch Time"
              value={data.launchTime ? formatDateTime(data.launchTime) : null}
            />
          </DetailGrid>
        </DetailSection>

        <TagsSection tags={resource.tags} />
        <ResourceRawViewer raw={resource.raw} />
      </TabsContent>

      {hasNetworking && (
        <TabsContent value="networking" className="mt-4 space-y-4">
          <DetailSection title="VPC & Subnet">
            <DetailGrid>
              <div className="py-2 border-b">
                <span className="text-sm text-muted-foreground block mb-1">VPC</span>
                {data.vpcId ? (
                  <ResourceRelationshipBadge resourceId={data.vpcId} />
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
              <div className="py-2 border-b">
                <span className="text-sm text-muted-foreground block mb-1">Subnet</span>
                {data.subnetId ? (
                  <ResourceRelationshipBadge resourceId={data.subnetId} />
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
              <DetailRow label="Availability Zone" value={data.availabilityZone} />
            </DetailGrid>
          </DetailSection>

          <DetailSection title="IP Addresses">
            <DetailGrid>
              <DetailRow label="Public IP" value={data.publicIpAddress} copyable mono />
              <DetailRow label="Private IP" value={data.privateIpAddress} copyable mono />
              <DetailRow label="Public DNS" value={data.publicDnsName} copyable mono />
              <DetailRow label="Private DNS" value={data.privateDnsName} copyable mono />
            </DetailGrid>
          </DetailSection>
        </TabsContent>
      )}

      {hasSecurity && (
        <TabsContent value="security" className="mt-4 space-y-4">
          <DetailSection title="Security Groups">
            <ResourceRelationshipList
              items={data.securityGroups.map((sg) => ({
                id: sg.groupId,
                label: sg.groupName || sg.groupId,
              }))}
              emptyText="No security groups attached"
            />
          </DetailSection>

          {data.iamInstanceProfile && (
            <DetailSection title="IAM Instance Profile">
              <p className="text-sm font-mono break-all">{data.iamInstanceProfile}</p>
            </DetailSection>
          )}
        </TabsContent>
      )}

      {hasStorage && (
        <TabsContent value="storage" className="mt-4 space-y-4">
          <DetailSection title="Block Device Mappings">
            <div className="space-y-2">
              {data.blockDeviceMappings.map((bd) => (
                <div
                  key={bd.deviceName}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <span className="font-mono text-sm">{bd.deviceName}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {bd.deleteOnTermination ? '(Delete on termination)' : '(Persist)'}
                    </span>
                  </div>
                  {bd.volumeId && (
                    <ResourceRelationshipBadge resourceId={bd.volumeId} />
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        </TabsContent>
      )}
    </Tabs>
  );
}
