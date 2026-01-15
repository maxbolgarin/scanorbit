import type { Node, Edge } from '@xyflow/react';
import type { Resource, ServiceType } from './index';

/**
 * Relationship types between resources
 */
export type RelationshipType =
  | 'vpc'            // Resource is in a VPC
  | 'subnet'         // Resource is in a subnet
  | 'security_group' // Resource uses a security group
  | 'attachment'     // Resource is attached (EBS to EC2, etc.)
  | 'dependency'     // Generic dependency relationship
  | 'kms'            // Encrypted with KMS key
  | 'iam';           // Uses IAM role/user

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
