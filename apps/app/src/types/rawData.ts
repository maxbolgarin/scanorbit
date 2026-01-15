/**
 * Type definitions for AWS resource raw data extracted from API responses.
 * These types represent the parsed/extracted data used for display, not the full AWS response.
 */

import {
  getString,
  getNumber,
  getBoolean,
  getArray,
  getNestedString,
  getNestedNumber,
  getNestedBoolean,
} from '@/lib/rawDataUtils';

// EC2 Instance
export interface EC2Data {
  instanceType: string | null;
  architecture: string | null;
  imageId: string | null;
  keyName: string | null;
  platform: string | null;
  publicIpAddress: string | null;
  privateIpAddress: string | null;
  publicDnsName: string | null;
  privateDnsName: string | null;
  vpcId: string | null;
  subnetId: string | null;
  availabilityZone: string | null;
  launchTime: string | null;
  securityGroups: Array<{ groupId: string; groupName: string }>;
  blockDeviceMappings: Array<{ deviceName: string; volumeId: string; deleteOnTermination: boolean }>;
  iamInstanceProfile: string | null;
  monitoring: string | null;
  enaSupport: boolean | null;
  ebsOptimized: boolean | null;
  hypervisor: string | null;
  virtualizationType: string | null;
  coreCount: number | null;
  threadsPerCore: number | null;
}

export function extractEC2Data(raw: Record<string, unknown> | null): EC2Data {
  return {
    instanceType: getString(raw, 'InstanceType'),
    architecture: getString(raw, 'Architecture'),
    imageId: getString(raw, 'ImageId'),
    keyName: getString(raw, 'KeyName'),
    platform: getString(raw, 'Platform') || getString(raw, 'PlatformDetails'),
    publicIpAddress: getString(raw, 'PublicIpAddress'),
    privateIpAddress: getString(raw, 'PrivateIpAddress'),
    publicDnsName: getString(raw, 'PublicDnsName'),
    privateDnsName: getString(raw, 'PrivateDnsName'),
    vpcId: getString(raw, 'VpcId'),
    subnetId: getString(raw, 'SubnetId'),
    availabilityZone: getNestedString(raw, 'Placement', 'AvailabilityZone'),
    launchTime: getString(raw, 'LaunchTime'),
    securityGroups: getArray<Record<string, unknown>>(raw, 'SecurityGroups').map((sg) => ({
      groupId: getString(sg, 'GroupId') || '',
      groupName: getString(sg, 'GroupName') || '',
    })),
    blockDeviceMappings: getArray<Record<string, unknown>>(raw, 'BlockDeviceMappings').map((bd) => ({
      deviceName: getString(bd, 'DeviceName') || '',
      volumeId: getNestedString(bd, 'Ebs', 'VolumeId') || '',
      deleteOnTermination: getNestedBoolean(bd, 'Ebs', 'DeleteOnTermination') ?? true,
    })),
    iamInstanceProfile: getNestedString(raw, 'IamInstanceProfile', 'Arn'),
    monitoring: getNestedString(raw, 'Monitoring', 'State'),
    enaSupport: getBoolean(raw, 'EnaSupport'),
    ebsOptimized: getBoolean(raw, 'EbsOptimized'),
    hypervisor: getString(raw, 'Hypervisor'),
    virtualizationType: getString(raw, 'VirtualizationType'),
    coreCount: getNestedNumber(raw, 'CpuOptions', 'CoreCount'),
    threadsPerCore: getNestedNumber(raw, 'CpuOptions', 'ThreadsPerCore'),
  };
}

// EBS Volume
export interface EBSData {
  volumeId: string | null;
  size: number | null;
  volumeType: string | null;
  state: string | null;
  encrypted: boolean | null;
  iops: number | null;
  throughput: number | null;
  availabilityZone: string | null;
  createTime: string | null;
  attachments: Array<{
    instanceId: string;
    device: string;
    state: string;
    deleteOnTermination: boolean;
  }>;
  unattachedSince: string | null;
}

export function extractEBSData(raw: Record<string, unknown> | null): EBSData {
  // EBS volumes use snake_case from Go worker
  return {
    volumeId: getString(raw, 'volume_id'),
    size: getNumber(raw, 'size'),
    volumeType: getString(raw, 'volume_type'),
    state: getString(raw, 'state'),
    encrypted: getBoolean(raw, 'encrypted'),
    iops: getNumber(raw, 'iops'),
    throughput: getNumber(raw, 'throughput'),
    availabilityZone: getString(raw, 'availability_zone'),
    createTime: getString(raw, 'create_time'),
    attachments: getArray<Record<string, unknown>>(raw, 'attachments').map((att) => ({
      instanceId: getString(att, 'InstanceId') || getString(att, 'instance_id') || '',
      device: getString(att, 'Device') || getString(att, 'device') || '',
      state: getString(att, 'State') || getString(att, 'state') || '',
      deleteOnTermination: getBoolean(att, 'DeleteOnTermination') ?? getBoolean(att, 'delete_on_termination') ?? true,
    })),
    unattachedSince: getString(raw, 'unattached_since'),
  };
}

// RDS Instance
export interface RDSData {
  dbInstanceIdentifier: string | null;
  dbInstanceClass: string | null;
  engine: string | null;
  engineVersion: string | null;
  masterUsername: string | null;
  dbName: string | null;
  allocatedStorage: number | null;
  storageType: string | null;
  iops: number | null;
  storageEncrypted: boolean | null;
  multiAZ: boolean | null;
  publiclyAccessible: boolean | null;
  endpoint: string | null;
  port: number | null;
  availabilityZone: string | null;
  backupRetentionPeriod: number | null;
  preferredBackupWindow: string | null;
  preferredMaintenanceWindow: string | null;
  autoMinorVersionUpgrade: boolean | null;
  vpcSecurityGroups: Array<{ id: string; status: string }>;
  dbSubnetGroupName: string | null;
  instanceCreateTime: string | null;
}

export function extractRDSData(raw: Record<string, unknown> | null): RDSData {
  return {
    dbInstanceIdentifier: getString(raw, 'DBInstanceIdentifier'),
    dbInstanceClass: getString(raw, 'DBInstanceClass'),
    engine: getString(raw, 'Engine'),
    engineVersion: getString(raw, 'EngineVersion'),
    masterUsername: getString(raw, 'MasterUsername'),
    dbName: getString(raw, 'DBName'),
    allocatedStorage: getNumber(raw, 'AllocatedStorage'),
    storageType: getString(raw, 'StorageType'),
    iops: getNumber(raw, 'Iops'),
    storageEncrypted: getBoolean(raw, 'StorageEncrypted'),
    multiAZ: getBoolean(raw, 'MultiAZ'),
    publiclyAccessible: getBoolean(raw, 'PubliclyAccessible'),
    endpoint: getNestedString(raw, 'Endpoint', 'Address'),
    port: getNestedNumber(raw, 'Endpoint', 'Port'),
    availabilityZone: getString(raw, 'AvailabilityZone'),
    backupRetentionPeriod: getNumber(raw, 'BackupRetentionPeriod'),
    preferredBackupWindow: getString(raw, 'PreferredBackupWindow'),
    preferredMaintenanceWindow: getString(raw, 'PreferredMaintenanceWindow'),
    autoMinorVersionUpgrade: getBoolean(raw, 'AutoMinorVersionUpgrade'),
    vpcSecurityGroups: getArray<Record<string, unknown>>(raw, 'VpcSecurityGroups').map((sg) => ({
      id: getString(sg, 'VpcSecurityGroupId') || '',
      status: getString(sg, 'Status') || '',
    })),
    dbSubnetGroupName: getString(raw, 'DBSubnetGroupName'),
    instanceCreateTime: getString(raw, 'InstanceCreateTime'),
  };
}

// Lambda Function
export interface LambdaData {
  functionName: string | null;
  functionArn: string | null;
  runtime: string | null;
  handler: string | null;
  codeSize: number | null;
  memorySize: number | null;
  timeout: number | null;
  lastModified: string | null;
  description: string | null;
  architectures: string[];
  packageType: string | null;
  ephemeralStorageSize: number | null;
}

export function extractLambdaData(raw: Record<string, unknown> | null): LambdaData {
  // Lambda uses snake_case from Go worker
  return {
    functionName: getString(raw, 'function_name'),
    functionArn: getString(raw, 'function_arn'),
    runtime: getString(raw, 'runtime'),
    handler: getString(raw, 'handler'),
    codeSize: getNumber(raw, 'code_size'),
    memorySize: getNumber(raw, 'memory_size'),
    timeout: getNumber(raw, 'timeout'),
    lastModified: getString(raw, 'last_modified'),
    description: getString(raw, 'description'),
    architectures: getArray<string>(raw, 'architectures'),
    packageType: getString(raw, 'package_type'),
    ephemeralStorageSize: getNestedNumber(raw, 'ephemeral_storage', 'Size'),
  };
}

// Security Group
export interface SecurityGroupRule {
  protocol: string;
  fromPort: number | null;
  toPort: number | null;
  cidrBlocks: string[];
  ipv6Blocks: string[];
  securityGroupIds: string[];
}

export interface SecurityGroupData {
  groupId: string | null;
  groupName: string | null;
  description: string | null;
  vpcId: string | null;
  ownerId: string | null;
  ingressRules: SecurityGroupRule[];
  egressRules: SecurityGroupRule[];
}

function parseSecurityGroupRules(rules: Record<string, unknown>[]): SecurityGroupRule[] {
  return rules.map((rule) => ({
    protocol: getString(rule, 'protocol') || 'all',
    fromPort: getNumber(rule, 'from_port'),
    toPort: getNumber(rule, 'to_port'),
    cidrBlocks: getArray<string>(rule, 'cidr_blocks'),
    ipv6Blocks: getArray<string>(rule, 'ipv6_blocks'),
    securityGroupIds: getArray<string>(rule, 'security_group_ids'),
  }));
}

export function extractSecurityGroupData(raw: Record<string, unknown> | null): SecurityGroupData {
  // Security groups use snake_case from Go worker
  return {
    groupId: getString(raw, 'group_id'),
    groupName: getString(raw, 'group_name'),
    description: getString(raw, 'description'),
    vpcId: getString(raw, 'vpc_id'),
    ownerId: getString(raw, 'owner_id'),
    ingressRules: parseSecurityGroupRules(getArray<Record<string, unknown>>(raw, 'ingress_rules')),
    egressRules: parseSecurityGroupRules(getArray<Record<string, unknown>>(raw, 'egress_rules')),
  };
}
