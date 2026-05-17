import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { SecurityRulesTable } from '../SecurityRulesTable';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractSecurityGroupData } from '@/types/rawData';
import type { Resource } from '@/types';

interface SecurityGroupDetailsProps {
  resource: Resource;
}

function hasOpenToWorld(rules: Array<{ cidrBlocks: string[]; ipv6Blocks: string[] }>): boolean {
  return rules.some(
    (rule) =>
      rule.cidrBlocks.includes('0.0.0.0/0') ||
      rule.ipv6Blocks.includes('::/0')
  );
}

export function SecurityGroupDetails({ resource }: SecurityGroupDetailsProps) {
  const data = extractSecurityGroupData(resource.raw);

  const isOpenToWorld = hasOpenToWorld(data.ingressRules);

  return (
    <div className="space-y-4">
      {isOpenToWorld && (
        <div className="flex items-center gap-2 p-3 bg-status-high/15 border border-status-high/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-status-high shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-high">Open to the Internet</p>
            <p className="text-sm text-muted-foreground">
              This security group has inbound rules that allow traffic from anywhere (0.0.0.0/0)
            </p>
          </div>
        </div>
      )}

      <DetailSection title="Security Group Configuration">
        <DetailGrid>
          <DetailRow label="Group ID" value={data.groupId} mono copyable />
          <DetailRow label="Group Name" value={data.groupName} />
          <DetailRow label="Description" value={data.description} />
          <DetailRow label="Owner ID" value={data.ownerId} mono />
        </DetailGrid>
        <div className="mt-4 pt-4 border-t">
          <DetailRow
            label="VPC"
            value={data.vpcId || 'EC2-Classic (no VPC)'}
            mono={!!data.vpcId}
            copyable={!!data.vpcId}
          />
        </div>
      </DetailSection>

      <Tabs defaultValue="inbound" className="w-full">
        <TabsList>
          <TabsTrigger value="inbound" className="gap-2">
            Inbound Rules
            <Badge variant="secondary" className="ml-1">{data.ingressRules.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="outbound" className="gap-2">
            Outbound Rules
            <Badge variant="secondary" className="ml-1">{data.egressRules.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="mt-4">
          <DetailSection
            title="Inbound Rules"
            description="Controls incoming traffic to resources associated with this security group"
          >
            <SecurityRulesTable
              rules={data.ingressRules}
              emptyText="No inbound rules (all incoming traffic is blocked)"
            />
          </DetailSection>
        </TabsContent>

        <TabsContent value="outbound" className="mt-4">
          <DetailSection
            title="Outbound Rules"
            description="Controls outgoing traffic from resources associated with this security group"
          >
            <SecurityRulesTable
              rules={data.egressRules}
              emptyText="No outbound rules"
            />
          </DetailSection>
        </TabsContent>
      </Tabs>

      <TagsSection tags={resource.tags} />
      <ResourceRawViewer raw={resource.raw} />
    </div>
  );
}
