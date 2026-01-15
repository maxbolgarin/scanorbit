import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DetailSection } from '../DetailSection';
import { DetailRow, DetailGrid } from '../DetailRow';
import { ResourceRelationshipList } from '../ResourceRelationshipBadge';
import { TagsSection } from '../TagsSection';
import { ResourceRawViewer } from '../ResourceRawViewer';
import { extractRDSData } from '@/types/rawData';
import { formatDateTime } from '@/lib/utils';
import { formatGiB } from '@/lib/rawDataUtils';
import type { Resource } from '@/types';

interface RDSDetailsProps {
  resource: Resource;
}

export function RDSDetails({ resource }: RDSDetailsProps) {
  const data = extractRDSData(resource.raw);

  const hasNetworking = data.endpoint || data.vpcSecurityGroups.length > 0 || data.dbSubnetGroupName;
  const hasBackup = data.backupRetentionPeriod !== null || data.preferredBackupWindow || data.preferredMaintenanceWindow;

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="storage">Storage</TabsTrigger>
        {hasNetworking && <TabsTrigger value="networking">Networking</TabsTrigger>}
        {hasBackup && <TabsTrigger value="backup">Backup & Maintenance</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <DetailSection title="Database Configuration">
          <DetailGrid>
            <DetailRow label="DB Instance ID" value={data.dbInstanceIdentifier} mono />
            <DetailRow label="Instance Class" value={data.dbInstanceClass} />
            <DetailRow label="Engine" value={data.engine} />
            <DetailRow label="Engine Version" value={data.engineVersion} />
            <DetailRow label="Database Name" value={data.dbName} />
            <DetailRow label="Master Username" value={data.masterUsername} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Availability">
          <DetailGrid>
            <div className="py-2 border-b flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Multi-AZ</span>
              <Badge variant={data.multiAZ ? 'default' : 'secondary'}>
                {data.multiAZ ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <DetailRow label="Availability Zone" value={data.availabilityZone} />
            <div className="py-2 border-b flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Publicly Accessible</span>
              <Badge variant={data.publiclyAccessible ? 'destructive' : 'secondary'}>
                {data.publiclyAccessible ? 'Yes' : 'No'}
              </Badge>
            </div>
            <DetailRow
              label="Created"
              value={data.instanceCreateTime ? formatDateTime(data.instanceCreateTime) : null}
            />
          </DetailGrid>
        </DetailSection>

        <TagsSection tags={resource.tags} />
        <ResourceRawViewer raw={resource.raw} />
      </TabsContent>

      <TabsContent value="storage" className="mt-4 space-y-4">
        <DetailSection title="Storage Configuration">
          <DetailGrid>
            <DetailRow label="Allocated Storage" value={formatGiB(data.allocatedStorage)} />
            <DetailRow label="Storage Type" value={data.storageType} />
            <DetailRow label="Provisioned IOPS" value={data.iops} />
            <div className="py-2 border-b flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Encryption</span>
              <Badge variant={data.storageEncrypted ? 'default' : 'secondary'}>
                {data.storageEncrypted ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </DetailGrid>
        </DetailSection>
      </TabsContent>

      {hasNetworking && (
        <TabsContent value="networking" className="mt-4 space-y-4">
          <DetailSection title="Connectivity">
            <DetailGrid>
              <DetailRow label="Endpoint" value={data.endpoint} copyable mono />
              <DetailRow label="Port" value={data.port} />
              <DetailRow label="Subnet Group" value={data.dbSubnetGroupName} />
            </DetailGrid>
          </DetailSection>

          {data.vpcSecurityGroups.length > 0 && (
            <DetailSection title="Security Groups">
              <ResourceRelationshipList
                items={data.vpcSecurityGroups.map((sg) => ({
                  id: sg.id,
                  label: `${sg.id} (${sg.status})`,
                }))}
              />
            </DetailSection>
          )}
        </TabsContent>
      )}

      {hasBackup && (
        <TabsContent value="backup" className="mt-4 space-y-4">
          <DetailSection title="Backup Configuration">
            <DetailGrid>
              <DetailRow
                label="Retention Period"
                value={data.backupRetentionPeriod ? `${data.backupRetentionPeriod} days` : null}
              />
              <DetailRow label="Backup Window" value={data.preferredBackupWindow} />
              <div className="py-2 border-b flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Auto Minor Upgrade</span>
                <Badge variant={data.autoMinorVersionUpgrade ? 'default' : 'secondary'}>
                  {data.autoMinorVersionUpgrade ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Maintenance">
            <DetailGrid>
              <DetailRow label="Maintenance Window" value={data.preferredMaintenanceWindow} />
            </DetailGrid>
          </DetailSection>
        </TabsContent>
      )}
    </Tabs>
  );
}
