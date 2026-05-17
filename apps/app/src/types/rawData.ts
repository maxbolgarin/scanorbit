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

// S3 Bucket
export interface S3Data {
  name: string | null;
  creationDate: string | null;
}

export function extractS3Data(raw: Record<string, unknown> | null): S3Data {
  // S3 uses PascalCase from AWS SDK JSON marshal
  return {
    name: getString(raw, 'Name'),
    creationDate: getString(raw, 'CreationDate'),
  };
}

// ALB (Application Load Balancer)
export interface ALBData {
  loadBalancerArn: string | null;
  loadBalancerName: string | null;
  state: string | null;
  scheme: string | null;
  type: string | null;
  vpcId: string | null;
  availabilityZones: Array<{ zoneName: string; subnetId: string }>;
  securityGroups: string[];
  createdTime: string | null;
  ipAddressType: string | null;
  dnsName: string | null;
}

export function extractALBData(raw: Record<string, unknown> | null): ALBData {
  // ALB uses PascalCase from AWS SDK JSON marshal
  return {
    loadBalancerArn: getString(raw, 'LoadBalancerArn'),
    loadBalancerName: getString(raw, 'LoadBalancerName'),
    state: getNestedString(raw, 'State', 'Code'),
    scheme: getString(raw, 'Scheme'),
    type: getString(raw, 'Type'),
    vpcId: getString(raw, 'VpcId'),
    availabilityZones: getArray<Record<string, unknown>>(raw, 'AvailabilityZones').map((az) => ({
      zoneName: getString(az, 'ZoneName') || '',
      subnetId: getString(az, 'SubnetId') || '',
    })),
    securityGroups: getArray<string>(raw, 'SecurityGroups'),
    createdTime: getString(raw, 'CreatedTime'),
    ipAddressType: getString(raw, 'IpAddressType'),
    dnsName: getString(raw, 'DNSName'),
  };
}

// IAM User
export interface IAMUserData {
  userName: string | null;
  userId: string | null;
  arn: string | null;
  path: string | null;
  createDate: string | null;
  mfaEnabled: boolean | null;
  passwordLastUsed: string | null;
}

export function extractIAMUserData(raw: Record<string, unknown> | null): IAMUserData {
  // IAM uses snake_case from Go worker custom struct
  return {
    userName: getString(raw, 'user_name'),
    userId: getString(raw, 'user_id'),
    arn: getString(raw, 'arn'),
    path: getString(raw, 'path'),
    createDate: getString(raw, 'create_date'),
    mfaEnabled: getBoolean(raw, 'mfa_enabled'),
    passwordLastUsed: getString(raw, 'password_last_used'),
  };
}

// IAM Role
export interface IAMRoleData {
  roleName: string | null;
  roleId: string | null;
  arn: string | null;
  path: string | null;
  createDate: string | null;
  description: string | null;
  maxSessionDuration: number | null;
  lastUsedDate: string | null;
  lastUsedRegion: string | null;
}

export function extractIAMRoleData(raw: Record<string, unknown> | null): IAMRoleData {
  // IAM uses snake_case from Go worker custom struct
  return {
    roleName: getString(raw, 'role_name'),
    roleId: getString(raw, 'role_id'),
    arn: getString(raw, 'arn'),
    path: getString(raw, 'path'),
    createDate: getString(raw, 'create_date'),
    description: getString(raw, 'description'),
    maxSessionDuration: getNumber(raw, 'max_session_duration'),
    lastUsedDate: getString(raw, 'last_used_date'),
    lastUsedRegion: getString(raw, 'last_used_region'),
  };
}

// IAM Access Key
export interface IAMAccessKeyData {
  accessKeyId: string | null;
  userName: string | null;
  status: string | null;
  createDate: string | null;
  lastUsedDate: string | null;
  lastUsedService: string | null;
  lastUsedRegion: string | null;
}

export function extractIAMAccessKeyData(raw: Record<string, unknown> | null): IAMAccessKeyData {
  // IAM uses snake_case from Go worker custom struct
  return {
    accessKeyId: getString(raw, 'access_key_id'),
    userName: getString(raw, 'user_name'),
    status: getString(raw, 'status'),
    createDate: getString(raw, 'create_date'),
    lastUsedDate: getString(raw, 'last_used_date'),
    lastUsedService: getString(raw, 'last_used_service'),
    lastUsedRegion: getString(raw, 'last_used_region'),
  };
}

// KMS Key
export interface KMSKeyData {
  keyId: string | null;
  keyArn: string | null;
  description: string | null;
  keyState: string | null;
  keyUsage: string | null;
  keySpec: string | null;
  origin: string | null;
  keyManager: string | null;
  creationDate: string | null;
  enabled: boolean | null;
  multiRegion: boolean | null;
  keyRotationEnabled: boolean | null;
  deletionDate: string | null;
}

export function extractKMSKeyData(raw: Record<string, unknown> | null): KMSKeyData {
  // KMS uses snake_case from Go worker custom struct
  return {
    keyId: getString(raw, 'key_id'),
    keyArn: getString(raw, 'key_arn'),
    description: getString(raw, 'description'),
    keyState: getString(raw, 'key_state'),
    keyUsage: getString(raw, 'key_usage'),
    keySpec: getString(raw, 'key_spec'),
    origin: getString(raw, 'origin'),
    keyManager: getString(raw, 'key_manager'),
    creationDate: getString(raw, 'creation_date'),
    enabled: getBoolean(raw, 'enabled'),
    multiRegion: getBoolean(raw, 'multi_region'),
    keyRotationEnabled: getBoolean(raw, 'key_rotation_enabled'),
    deletionDate: getString(raw, 'deletion_date'),
  };
}

// Secrets Manager Secret
export interface SecretsData {
  name: string | null;
  arn: string | null;
  description: string | null;
  kmsKeyId: string | null;
  rotationEnabled: boolean | null;
  createdDate: string | null;
  primaryRegion: string | null;
  lastAccessedDate: string | null;
  lastChangedDate: string | null;
  lastRotatedDate: string | null;
  nextRotationDate: string | null;
}

export function extractSecretsData(raw: Record<string, unknown> | null): SecretsData {
  // Secrets Manager uses snake_case from Go worker custom struct
  return {
    name: getString(raw, 'name'),
    arn: getString(raw, 'arn'),
    description: getString(raw, 'description'),
    kmsKeyId: getString(raw, 'kms_key_id'),
    rotationEnabled: getBoolean(raw, 'rotation_enabled'),
    createdDate: getString(raw, 'created_date'),
    primaryRegion: getString(raw, 'primary_region'),
    lastAccessedDate: getString(raw, 'last_accessed_date'),
    lastChangedDate: getString(raw, 'last_changed_date'),
    lastRotatedDate: getString(raw, 'last_rotated_date'),
    nextRotationDate: getString(raw, 'next_rotation_date'),
  };
}

// CloudWatch Log Group
export interface CloudWatchLogsData {
  logGroupName: string | null;
  arn: string | null;
  creationTime: string | null;
  retentionDays: number | null;
  storedBytes: number | null;
  metricFilterCount: number | null;
  kmsKeyId: string | null;
  dataProtection: string | null;
}

export function extractCloudWatchLogsData(raw: Record<string, unknown> | null): CloudWatchLogsData {
  // CloudWatch uses snake_case from Go worker custom struct
  return {
    logGroupName: getString(raw, 'log_group_name'),
    arn: getString(raw, 'arn'),
    creationTime: getString(raw, 'creation_time'),
    retentionDays: getNumber(raw, 'retention_days'),
    storedBytes: getNumber(raw, 'stored_bytes'),
    metricFilterCount: getNumber(raw, 'metric_filter_count'),
    kmsKeyId: getString(raw, 'kms_key_id'),
    dataProtection: getString(raw, 'data_protection'),
  };
}

// CloudWatch Alarm
export interface CloudWatchAlarmData {
  alarmName: string | null;
  alarmArn: string | null;
  description: string | null;
  stateValue: string | null;
  stateReason: string | null;
  metricName: string | null;
  namespace: string | null;
  statistic: string | null;
  period: number | null;
  evaluationPeriods: number | null;
  threshold: number | null;
  comparisonOperator: string | null;
  actionsEnabled: boolean | null;
}

export function extractCloudWatchAlarmData(raw: Record<string, unknown> | null): CloudWatchAlarmData {
  // CloudWatch uses snake_case from Go worker custom struct
  return {
    alarmName: getString(raw, 'alarm_name'),
    alarmArn: getString(raw, 'alarm_arn'),
    description: getString(raw, 'alarm_description'),
    stateValue: getString(raw, 'state_value'),
    stateReason: getString(raw, 'state_reason'),
    metricName: getString(raw, 'metric_name'),
    namespace: getString(raw, 'namespace'),
    statistic: getString(raw, 'statistic'),
    period: getNumber(raw, 'period'),
    evaluationPeriods: getNumber(raw, 'evaluation_periods'),
    threshold: getNumber(raw, 'threshold'),
    comparisonOperator: getString(raw, 'comparison_operator'),
    actionsEnabled: getBoolean(raw, 'actions_enabled'),
  };
}

// EIP (Elastic IP)
export interface EIPData {
  allocationId: string | null;
  publicIp: string | null;
  domain: string | null;
  instanceId: string | null;
  associationId: string | null;
  networkInterfaceId: string | null;
  networkInterfaceOwnerId: string | null;
  privateIpAddress: string | null;
}

export function extractEIPData(raw: Record<string, unknown> | null): EIPData {
  // EIP uses PascalCase from AWS SDK JSON marshal
  return {
    allocationId: getString(raw, 'AllocationId'),
    publicIp: getString(raw, 'PublicIp'),
    domain: getString(raw, 'Domain'),
    instanceId: getString(raw, 'InstanceId'),
    associationId: getString(raw, 'AssociationId'),
    networkInterfaceId: getString(raw, 'NetworkInterfaceId'),
    networkInterfaceOwnerId: getString(raw, 'NetworkInterfaceOwnerId'),
    privateIpAddress: getString(raw, 'PrivateIpAddress'),
  };
}

// RDS Snapshot
export interface RDSSnapshotData {
  dbSnapshotIdentifier: string | null;
  dbInstanceIdentifier: string | null;
  snapshotCreateTime: string | null;
  allocatedStorage: number | null;
  status: string | null;
  port: number | null;
  availabilityZone: string | null;
  vpcId: string | null;
  engine: string | null;
  engineVersion: string | null;
  masterUsername: string | null;
  snapshotType: string | null;
  encrypted: boolean | null;
  kmsKeyId: string | null;
  percentProgress: number | null;
}

export function extractRDSSnapshotData(raw: Record<string, unknown> | null): RDSSnapshotData {
  // RDS Snapshot uses PascalCase from AWS SDK JSON marshal
  return {
    dbSnapshotIdentifier: getString(raw, 'DBSnapshotIdentifier'),
    dbInstanceIdentifier: getString(raw, 'DBInstanceIdentifier'),
    snapshotCreateTime: getString(raw, 'SnapshotCreateTime'),
    allocatedStorage: getNumber(raw, 'AllocatedStorage'),
    status: getString(raw, 'Status'),
    port: getNumber(raw, 'Port'),
    availabilityZone: getString(raw, 'AvailabilityZone'),
    vpcId: getString(raw, 'VpcId'),
    engine: getString(raw, 'Engine'),
    engineVersion: getString(raw, 'EngineVersion'),
    masterUsername: getString(raw, 'MasterUsername'),
    snapshotType: getString(raw, 'SnapshotType'),
    encrypted: getBoolean(raw, 'Encrypted'),
    kmsKeyId: getString(raw, 'KmsKeyId'),
    percentProgress: getNumber(raw, 'PercentProgress'),
  };
}
