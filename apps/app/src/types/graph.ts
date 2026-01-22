import type { Node, Edge } from '@xyflow/react';
import type { Resource, ServiceType } from './index';

/**
 * Relationship types between resources
 */
export type RelationshipType =
  | 'vpc'            // Resource is in a VPC (legacy)
  | 'subnet'         // Resource is in a subnet (legacy)
  | 'security_group' // Resource uses a security group (legacy)
  | 'attachment'     // Resource is attached (EBS to EC2, etc.) (legacy)
  | 'dependency'     // Generic dependency relationship (legacy)
  | 'kms'            // Encrypted with KMS key (legacy)
  | 'iam'            // Uses IAM role/user (legacy)
  // New DB-backed relationship types
  | 'uses_role'      // Lambda/EC2 → IAM Role
  | 'in_vpc'         // EC2/RDS/Lambda → VPC
  | 'in_subnet'      // EC2/RDS/ENI → Subnet
  | 'uses_sg'        // EC2/RDS/Lambda/ENI → Security Group
  | 'attached_to'    // EBS/ENI → EC2
  | 'targets'        // Target Group → EC2/Lambda
  | 'owns'           // ALB → Target Group
  | 'uses_layer'     // Lambda → Lambda Layer
  | 'encrypted_by';  // EBS/RDS/S3 → KMS Key

/**
 * Criticality level for visual highlighting
 */
export type CriticalityLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Data associated with each resource node
 * Uses index signature to satisfy React Flow's requirements
 */
export interface ResourceNodeData {
  [key: string]: unknown;
  resource: Resource;
  label: string;
  service: ServiceType;
  findingsCount: number;
  criticalityLevel: CriticalityLevel;
  region: string | null;
}

/**
 * A node representing a resource in the infrastructure graph
 */
export type ResourceNode = Node<ResourceNodeData, 'resource'>;

/**
 * Data associated with each edge
 * Uses index signature to satisfy React Flow's requirements
 */
export interface RelationshipEdgeData {
  [key: string]: unknown;
  type: RelationshipType;
  label?: string;
  sourceService: ServiceType;
  targetService: ServiceType;
}

/**
 * An edge representing a relationship between resources
 */
export type RelationshipEdge = Edge<RelationshipEdgeData>;

/**
 * Complete graph data structure
 */
export interface GraphData {
  nodes: ResourceNode[];
  edges: RelationshipEdge[];
}

/**
 * Filter options for the infrastructure map
 */
export interface MapFilters {
  services: ServiceType[];
  regions: string[];
  relationshipTypes: RelationshipType[];
  showOrphans: boolean;
  minFindingsCount: number;
}

/**
 * Layout preset options for the graph
 */
export type LayoutPreset =
  | 'grid'              // Simple grid layout
  | 'clustered'         // Group connected nodes into clusters, orphans to the right
  | 'service-grouped'   // Group by service type
  | 'connections-first';// Connected nodes in center, orphans around the edge

/**
 * Layout preset metadata for UI
 */
export interface LayoutPresetInfo {
  id: LayoutPreset;
  name: string;
  description: string;
}

/**
 * Statistics about the current graph
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByService: Record<ServiceType, number>;
  nodesByRegion: Record<string, number>;
  nodesWithFindings: number;
  orphanNodes: number;
}

/**
 * View mode for infrastructure map
 */
export type MapViewMode = 'graph' | 'network';

/**
 * Information about a subnet in the network topology
 */
export interface SubnetInfo {
  subnetId: string;
  availabilityZone?: string;
  resourceIds: string[];
}

/**
 * Information about a VPC in the network topology
 */
export interface VPCInfo {
  vpcId: string;
  subnets: Map<string, SubnetInfo>;
  // Resources that span multiple subnets (e.g., ALBs)
  multiSubnetResourceIds: string[];
}

/**
 * Network topology extracted from resources
 */
export interface NetworkTopology {
  vpcs: Map<string, VPCInfo>;
  // Resources without VPC (global services like IAM, S3, etc.)
  globalResourceIds: string[];
}

/**
 * Container node types for network view
 */
export type ContainerNodeType = 'vpcContainer' | 'subnetContainer' | 'globalContainer';

/**
 * Data for VPC container node
 */
export interface VPCContainerNodeData {
  [key: string]: unknown;
  vpcId: string;
  resourceCount: number;
  subnetCount: number;
  isCollapsed: boolean;
}

/**
 * Data for subnet container node
 */
export interface SubnetContainerNodeData {
  [key: string]: unknown;
  subnetId: string;
  availabilityZone?: string;
  resourceCount: number;
  isCollapsed: boolean;
}

/**
 * Data for global resources container node
 */
export interface GlobalContainerNodeData {
  [key: string]: unknown;
  resourceCount: number;
  isCollapsed: boolean;
}

/**
 * Container node types
 */
export type VPCContainerNode = Node<VPCContainerNodeData, 'vpcContainer'>;
export type SubnetContainerNode = Node<SubnetContainerNodeData, 'subnetContainer'>;
export type GlobalContainerNode = Node<GlobalContainerNodeData, 'globalContainer'>;

/**
 * All node types for network view
 */
export type NetworkNode = ResourceNode | VPCContainerNode | SubnetContainerNode | GlobalContainerNode;

/**
 * Collapsed state for containers (stored in localStorage)
 */
export interface ContainerCollapsedState {
  vpcs: Record<string, boolean>;
  subnets: Record<string, boolean>;
  global: boolean;
}

/**
 * Network view settings
 */
export interface NetworkViewSettings {
  showGlobalResources: boolean;
}
