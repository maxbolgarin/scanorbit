/**
 * Utilities for building infrastructure graph from resource data
 */

import type { Resource, ServiceType, Finding } from '@/types';
import type {
  GraphData,
  ResourceNode,
  RelationshipEdge,
  RelationshipType,
  CriticalityLevel,
  GraphStats,
  MapFilters,
  LayoutPreset,
  LayoutPresetInfo,
  NetworkTopology,
  VPCInfo,
  SubnetInfo,
  VPCContainerNode,
  SubnetContainerNode,
  GlobalContainerNode,
  ContainerCollapsedState,
  NetworkNode,
  NetworkViewSettings,
} from '@/types/graph';
import {
  extractEC2Data,
  extractEBSData,
  extractRDSData,
  extractALBData,
  extractSecurityGroupData,
  extractEIPData,
  extractRDSSnapshotData,
  extractSecretsData,
  extractCloudWatchLogsData,
} from '@/types/rawData';

// Counter for unique edge IDs
let edgeIdCounter = 0;

/**
 * Reset edge ID counter (useful for tests)
 */
export function resetEdgeIdCounter(): void {
  edgeIdCounter = 0;
}

/**
 * Calculate criticality level based on findings count and severity
 */
function calculateCriticality(
  findingsCount: number,
  hasHigh: boolean
): CriticalityLevel {
  if (hasHigh && findingsCount >= 3) return 'critical';
  if (hasHigh) return 'high';
  if (findingsCount >= 3) return 'medium';
  if (findingsCount > 0) return 'low';
  return 'none';
}

/**
 * Create a resource node from a resource
 */
function createResourceNode(
  resource: Resource,
  findings: Finding[],
  position: { x: number; y: number }
): ResourceNode {
  const resourceFindings = findings.filter(
    (f) => f.resourceId === resource.id && f.status === 'open'
  );
  const findingsCount = resourceFindings.length;
  const hasHigh = resourceFindings.some((f) => f.severity === 'high');

  return {
    id: resource.resourceId,
    type: 'resource',
    position,
    data: {
      resource,
      label: resource.name || resource.resourceId,
      service: resource.service,
      findingsCount,
      criticalityLevel: calculateCriticality(findingsCount, hasHigh),
      region: resource.region,
    },
  };
}

/**
 * Create an edge between two resources
 */
function createEdge(
  sourceId: string,
  targetId: string,
  type: RelationshipType,
  sourceService: ServiceType,
  targetService: ServiceType,
  label?: string
): RelationshipEdge {
  return {
    id: `edge-${edgeIdCounter++}`,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: type === 'security_group',
    style: getEdgeStyle(type),
    data: {
      type,
      label,
      sourceService,
      targetService,
    },
  };
}

/**
 * Get edge style based on relationship type
 */
function getEdgeStyle(type: RelationshipType): React.CSSProperties {
  switch (type) {
    // Legacy types
    case 'security_group':
    case 'uses_sg':
      return { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5,5' };
    case 'attachment':
    case 'attached_to':
      return { stroke: '#6b7280', strokeWidth: 2 };
    case 'vpc':
    case 'subnet':
    case 'in_vpc':
    case 'in_subnet':
      return { stroke: '#10b981', strokeWidth: 1.5 };
    case 'kms':
    case 'encrypted_by':
      return { stroke: '#f59e0b', strokeWidth: 1.5 };
    case 'iam':
    case 'uses_role':
      return { stroke: '#8b5cf6', strokeWidth: 1.5 };
    case 'targets':
      return { stroke: '#ec4899', strokeWidth: 2 };
    case 'owns':
      return { stroke: '#06b6d4', strokeWidth: 2 };
    case 'uses_layer':
      return { stroke: '#84cc16', strokeWidth: 1.5 };
    default:
      return { stroke: '#9ca3af', strokeWidth: 1 };
  }
}

/**
 * Extract relationships from EC2 instance
 */
function extractEC2Relationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractEC2Data(resource.raw as Record<string, unknown>);

  // EC2 → Security Groups
  data.securityGroups.forEach((sg) => {
    if (sg.groupId && resourceMap.has(sg.groupId)) {
      edges.push(
        createEdge(resource.resourceId, sg.groupId, 'security_group', 'ec2', 'security_group')
      );
    }
  });

  // EC2 → EBS Volumes (reverse - volumes attached to this instance)
  // This relationship is captured from EBS side

  return edges;
}

/**
 * Extract relationships from EBS volume
 */
function extractEBSRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractEBSData(resource.raw as Record<string, unknown>);

  // EBS → EC2 attachments
  data.attachments.forEach((att) => {
    if (att.instanceId && resourceMap.has(att.instanceId)) {
      edges.push(
        createEdge(resource.resourceId, att.instanceId, 'attachment', 'ebs', 'ec2', att.device)
      );
    }
  });

  return edges;
}

/**
 * Extract relationships from RDS instance
 */
function extractRDSRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractRDSData(resource.raw as Record<string, unknown>);

  // RDS → Security Groups
  data.vpcSecurityGroups.forEach((sg) => {
    if (sg.id && resourceMap.has(sg.id)) {
      edges.push(createEdge(resource.resourceId, sg.id, 'security_group', 'rds', 'security_group'));
    }
  });

  return edges;
}

/**
 * Extract relationships from ALB
 */
function extractALBRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractALBData(resource.raw as Record<string, unknown>);

  // ALB → Security Groups
  data.securityGroups.forEach((sgId) => {
    if (sgId && resourceMap.has(sgId)) {
      edges.push(createEdge(resource.resourceId, sgId, 'security_group', 'alb', 'security_group'));
    }
  });

  return edges;
}

/**
 * Extract relationships from Security Group
 */
function extractSecurityGroupRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractSecurityGroupData(resource.raw as Record<string, unknown>);

  // Security Group → referenced Security Groups in rules
  const allRules = [...data.ingressRules, ...data.egressRules];
  const referencedSGs = new Set<string>();

  allRules.forEach((rule) => {
    rule.securityGroupIds.forEach((sgId) => {
      if (sgId && sgId !== resource.resourceId && resourceMap.has(sgId)) {
        referencedSGs.add(sgId);
      }
    });
  });

  referencedSGs.forEach((sgId) => {
    edges.push(
      createEdge(resource.resourceId, sgId, 'security_group', 'security_group', 'security_group')
    );
  });

  return edges;
}

/**
 * Extract relationships from EIP
 */
function extractEIPRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractEIPData(resource.raw as Record<string, unknown>);

  // EIP → EC2 instance
  if (data.instanceId && resourceMap.has(data.instanceId)) {
    edges.push(createEdge(resource.resourceId, data.instanceId, 'attachment', 'eip', 'ec2'));
  }

  return edges;
}

/**
 * Extract relationships from RDS Snapshot
 */
function extractRDSSnapshotRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractRDSSnapshotData(resource.raw as Record<string, unknown>);

  // RDS Snapshot → Source RDS instance
  if (data.dbInstanceIdentifier) {
    // Find the RDS instance by identifier (need to search by name)
    const rdsInstance = Array.from(resourceMap.values()).find(
      (r) => r.service === 'rds' && r.name === data.dbInstanceIdentifier
    );
    if (rdsInstance) {
      edges.push(
        createEdge(resource.resourceId, rdsInstance.resourceId, 'dependency', 'rds_snapshot', 'rds')
      );
    }
  }

  // RDS Snapshot → KMS key
  if (data.kmsKeyId && resourceMap.has(data.kmsKeyId)) {
    edges.push(
      createEdge(resource.resourceId, data.kmsKeyId, 'kms', 'rds_snapshot', 'kms_key')
    );
  }

  return edges;
}

/**
 * Extract relationships from Secrets Manager
 */
function extractSecretsRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractSecretsData(resource.raw as Record<string, unknown>);

  // Secret → KMS key
  if (data.kmsKeyId) {
    // KMS key ID might be an ARN or just the key ID
    const kmsKeyId = data.kmsKeyId;
    const kmsKey = Array.from(resourceMap.values()).find(
      (r) => r.service === 'kms_key' && (r.resourceId === kmsKeyId || r.resourceId.includes(kmsKeyId))
    );
    if (kmsKey) {
      edges.push(
        createEdge(resource.resourceId, kmsKey.resourceId, 'kms', 'secret', 'kms_key')
      );
    }
  }

  return edges;
}

/**
 * Extract relationships from CloudWatch Logs
 */
function extractCloudWatchLogsRelationships(
  resource: Resource,
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const data = extractCloudWatchLogsData(resource.raw as Record<string, unknown>);

  // Log Group → KMS key
  if (data.kmsKeyId) {
    const kmsKeyId = data.kmsKeyId;
    const kmsKey = Array.from(resourceMap.values()).find(
      (r) => r.service === 'kms_key' && (r.resourceId === kmsKeyId || r.resourceId.includes(kmsKeyId))
    );
    if (kmsKey) {
      edges.push(
        createEdge(resource.resourceId, kmsKey.resourceId, 'kms', 'cloudwatch_logs', 'kms_key')
      );
    }
  }

  return edges;
}

/**
 * Main function to extract all relationships and build graph
 */
export function buildInfrastructureGraph(
  resources: Resource[],
  findings: Finding[]
): GraphData {
  // Reset edge counter
  edgeIdCounter = 0;

  const nodes: ResourceNode[] = [];
  const edges: RelationshipEdge[] = [];

  // Build lookup map by resourceId
  const resourceMap = new Map<string, Resource>();
  resources.forEach((r) => resourceMap.set(r.resourceId, r));

  // Simple grid layout - will be improved with dagre
  const GRID_COLS = 8;
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;

  // Group resources by service for better initial layout
  const serviceGroups = new Map<ServiceType, Resource[]>();
  resources.forEach((r) => {
    const group = serviceGroups.get(r.service) || [];
    group.push(r);
    serviceGroups.set(r.service, group);
  });

  // Create nodes with simple grid positions
  let index = 0;
  serviceGroups.forEach((serviceResources) => {
    serviceResources.forEach((resource) => {
      const row = Math.floor(index / GRID_COLS);
      const col = index % GRID_COLS;
      const position = {
        x: col * NODE_WIDTH + Math.random() * 50,
        y: row * NODE_HEIGHT + Math.random() * 30,
      };
      nodes.push(createResourceNode(resource, findings, position));
      index++;
    });
  });

  // Extract relationships from each resource
  resources.forEach((resource) => {
    let resourceEdges: RelationshipEdge[] = [];

    switch (resource.service) {
      case 'ec2':
        resourceEdges = extractEC2Relationships(resource, resourceMap);
        break;
      case 'ebs':
        resourceEdges = extractEBSRelationships(resource, resourceMap);
        break;
      case 'rds':
        resourceEdges = extractRDSRelationships(resource, resourceMap);
        break;
      case 'alb':
        resourceEdges = extractALBRelationships(resource, resourceMap);
        break;
      case 'security_group':
        resourceEdges = extractSecurityGroupRelationships(resource, resourceMap);
        break;
      case 'eip':
        resourceEdges = extractEIPRelationships(resource, resourceMap);
        break;
      case 'rds_snapshot':
        resourceEdges = extractRDSSnapshotRelationships(resource, resourceMap);
        break;
      case 'secret':
        resourceEdges = extractSecretsRelationships(resource, resourceMap);
        break;
      case 'cloudwatch_logs':
        resourceEdges = extractCloudWatchLogsRelationships(resource, resourceMap);
        break;
      // Other services don't have relationships we can extract yet
    }

    edges.push(...resourceEdges);
  });

  // Deduplicate edges (same source-target pair)
  const uniqueEdges = new Map<string, RelationshipEdge>();
  edges.forEach((edge) => {
    const edgeType = edge.data?.type || 'unknown';
    const key = `${edge.source}-${edge.target}-${edgeType}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.set(key, edge);
    }
  });

  return {
    nodes,
    edges: Array.from(uniqueEdges.values()),
  };
}

/**
 * Database dependency type from API
 */
export interface DBDependency {
  id: string;
  orgId: string;
  sourceResourceId: string;
  targetResourceId: string;
  targetService: string;
  relationshipType: string;
  createdAt: string;
}

/**
 * Build graph edges from database dependencies
 * This is the preferred method when dependencies are available from the API
 */
export function buildEdgesFromDependencies(
  dependencies: DBDependency[],
  resourceMap: Map<string, Resource>
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  edgeIdCounter = 0;

  dependencies.forEach((dep) => {
    // Find source resource by DB ID
    const sourceResource = Array.from(resourceMap.values()).find(
      (r) => r.id === dep.sourceResourceId
    );
    if (!sourceResource) return;

    // Check if target exists in our resources (by AWS resource ID)
    const targetResource = resourceMap.get(dep.targetResourceId);

    // Only create edges where both endpoints are in our resource map
    // (for now, to keep the graph clean)
    if (targetResource) {
      const edge = createEdge(
        sourceResource.resourceId,
        targetResource.resourceId,
        dep.relationshipType as RelationshipType,
        sourceResource.service,
        targetResource.service
      );
      edges.push(edge);
    }
  });

  // Deduplicate edges
  const uniqueEdges = new Map<string, RelationshipEdge>();
  edges.forEach((edge) => {
    const edgeType = edge.data?.type || 'unknown';
    const key = `${edge.source}-${edge.target}-${edgeType}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.set(key, edge);
    }
  });

  return Array.from(uniqueEdges.values());
}

/**
 * Build infrastructure graph using database dependencies (preferred)
 * Falls back to raw data extraction if dependencies are not provided
 */
export function buildInfrastructureGraphWithDependencies(
  resources: Resource[],
  findings: Finding[],
  dependencies?: DBDependency[]
): GraphData {
  // Reset edge counter
  edgeIdCounter = 0;

  const nodes: ResourceNode[] = [];

  // Build lookup map by resourceId
  const resourceMap = new Map<string, Resource>();
  resources.forEach((r) => resourceMap.set(r.resourceId, r));

  // Simple grid layout - will be improved with dagre
  const GRID_COLS = 8;
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;

  // Group resources by service for better initial layout
  const serviceGroups = new Map<ServiceType, Resource[]>();
  resources.forEach((r) => {
    const group = serviceGroups.get(r.service) || [];
    group.push(r);
    serviceGroups.set(r.service, group);
  });

  // Create nodes with simple grid positions
  let index = 0;
  serviceGroups.forEach((serviceResources) => {
    serviceResources.forEach((resource) => {
      const row = Math.floor(index / GRID_COLS);
      const col = index % GRID_COLS;
      const position = {
        x: col * NODE_WIDTH + Math.random() * 50,
        y: row * NODE_HEIGHT + Math.random() * 30,
      };
      nodes.push(createResourceNode(resource, findings, position));
      index++;
    });
  });

  // Build edges from DB dependencies if available, otherwise fall back to raw data extraction
  let edges: RelationshipEdge[];
  if (dependencies && dependencies.length > 0) {
    edges = buildEdgesFromDependencies(dependencies, resourceMap);
  } else {
    // Fall back to legacy raw data extraction
    edges = [];
    resources.forEach((resource) => {
      let resourceEdges: RelationshipEdge[] = [];

      switch (resource.service) {
        case 'ec2':
          resourceEdges = extractEC2Relationships(resource, resourceMap);
          break;
        case 'ebs':
          resourceEdges = extractEBSRelationships(resource, resourceMap);
          break;
        case 'rds':
          resourceEdges = extractRDSRelationships(resource, resourceMap);
          break;
        case 'alb':
          resourceEdges = extractALBRelationships(resource, resourceMap);
          break;
        case 'security_group':
          resourceEdges = extractSecurityGroupRelationships(resource, resourceMap);
          break;
        case 'eip':
          resourceEdges = extractEIPRelationships(resource, resourceMap);
          break;
        case 'rds_snapshot':
          resourceEdges = extractRDSSnapshotRelationships(resource, resourceMap);
          break;
        case 'secret':
          resourceEdges = extractSecretsRelationships(resource, resourceMap);
          break;
        case 'cloudwatch_logs':
          resourceEdges = extractCloudWatchLogsRelationships(resource, resourceMap);
          break;
      }

      edges.push(...resourceEdges);
    });

    // Deduplicate edges
    const uniqueEdges = new Map<string, RelationshipEdge>();
    edges.forEach((edge) => {
      const edgeType = edge.data?.type || 'unknown';
      const key = `${edge.source}-${edge.target}-${edgeType}`;
      if (!uniqueEdges.has(key)) {
        uniqueEdges.set(key, edge);
      }
    });
    edges = Array.from(uniqueEdges.values());
  }

  return {
    nodes,
    edges,
  };
}

/**
 * Filter graph based on filter options
 */
export function filterGraph(graph: GraphData, filters: MapFilters): GraphData {
  // Filter nodes
  let filteredNodes = graph.nodes;

  if (filters.services.length > 0) {
    filteredNodes = filteredNodes.filter((n) => filters.services.includes(n.data.service));
  }

  if (filters.regions.length > 0) {
    filteredNodes = filteredNodes.filter(
      (n) => n.data.region && filters.regions.includes(n.data.region)
    );
  }

  if (filters.minFindingsCount > 0) {
    filteredNodes = filteredNodes.filter((n) => n.data.findingsCount >= filters.minFindingsCount);
  }

  // Get filtered node IDs
  const nodeIds = new Set(filteredNodes.map((n) => n.id));

  // Filter edges - only keep edges where both source and target are in filtered nodes
  let filteredEdges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  if (filters.relationshipTypes.length > 0) {
    filteredEdges = filteredEdges.filter((e) => e.data && filters.relationshipTypes.includes(e.data.type));
  }

  // Handle orphan filtering
  if (!filters.showOrphans) {
    const connectedNodes = new Set<string>();
    filteredEdges.forEach((e) => {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    });
    filteredNodes = filteredNodes.filter((n) => connectedNodes.has(n.id));
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

/**
 * Calculate graph statistics
 */
export function calculateGraphStats(graph: GraphData): GraphStats {
  const nodesByService: Record<string, number> = {};
  const nodesByRegion: Record<string, number> = {};
  let nodesWithFindings = 0;

  // Count connected nodes
  const connectedNodes = new Set<string>();
  graph.edges.forEach((e) => {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  });

  graph.nodes.forEach((node) => {
    // Count by service
    nodesByService[node.data.service] = (nodesByService[node.data.service] || 0) + 1;

    // Count by region
    const region = node.data.region || 'Global';
    nodesByRegion[region] = (nodesByRegion[region] || 0) + 1;

    // Count nodes with findings
    if (node.data.findingsCount > 0) {
      nodesWithFindings++;
    }
  });

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    nodesByService: nodesByService as Record<ServiceType, number>,
    nodesByRegion,
    nodesWithFindings,
    orphanNodes: graph.nodes.length - connectedNodes.size,
  };
}

/**
 * Get default filters
 */
export function getDefaultFilters(): MapFilters {
  return {
    services: [],
    regions: [],
    relationshipTypes: [],
    showOrphans: true,
    minFindingsCount: 0,
  };
}

/**
 * Layout preset definitions
 */
export const LAYOUT_PRESETS: LayoutPresetInfo[] = [
  {
    id: 'grid',
    name: 'Grid',
    description: 'Connected nodes placed close together',
  },
  {
    id: 'clustered',
    name: 'Clustered',
    description: 'Connected nodes grouped, orphans on right',
  },
  {
    id: 'service-grouped',
    name: 'By Service',
    description: 'Group by service type in rows',
  },
  {
    id: 'connections-first',
    name: 'Connected First',
    description: 'Connected in center, orphans around edge',
  },
];

/**
 * Union-Find data structure for clustering connected nodes
 */
class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor(nodes: string[]) {
    this.parent = new Map();
    this.rank = new Map();
    nodes.forEach((node) => {
      this.parent.set(node, node);
      this.rank.set(node, 0);
    });
  }

  find(x: string): string {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    this.parent.forEach((_, node) => {
      const root = this.find(node);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(node);
    });
    return clusters;
  }
}

/**
 * Find connected components (clusters) in the graph
 */
function findClusters(graph: GraphData): Map<string, string[]> {
  const nodeIds = graph.nodes.map((n) => n.id);
  const uf = new UnionFind(nodeIds);

  graph.edges.forEach((edge) => {
    uf.union(edge.source, edge.target);
  });

  return uf.getClusters();
}

/**
 * Get connected and orphan node sets
 */
function getConnectedAndOrphans(graph: GraphData): { connected: Set<string>; orphans: Set<string> } {
  const connected = new Set<string>();
  graph.edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });

  const orphans = new Set<string>();
  graph.nodes.forEach((n) => {
    if (!connected.has(n.id)) {
      orphans.add(n.id);
    }
  });

  return { connected, orphans };
}

/**
 * Build adjacency list from edges
 */
function buildAdjacencyList(edges: RelationshipEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  edges.forEach((edge) => {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source)!.add(edge.target);
    adj.get(edge.target)!.add(edge.source);
  });

  return adj;
}

/**
 * Apply connection-aware grid layout
 * Places connected nodes close together to minimize edge crossings
 */
function applyGridLayout(nodes: ResourceNode[], edges: RelationshipEdge[] = []): ResourceNode[] {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;
  const CLUSTER_GAP = 80;

  if (nodes.length === 0) return [];

  // Build adjacency list for quick neighbor lookup
  const adjacency = buildAdjacencyList(edges);

  // Find connected components using BFS
  const visited = new Set<string>();
  const clusters: ResourceNode[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Sort nodes by connection count (most connected first) to start BFS from hub nodes
  const nodesByConnections = [...nodes].sort((a, b) => {
    const aConns = adjacency.get(a.id)?.size || 0;
    const bConns = adjacency.get(b.id)?.size || 0;
    return bConns - aConns;
  });

  // Find connected components
  for (const startNode of nodesByConnections) {
    if (visited.has(startNode.id)) continue;

    const cluster: ResourceNode[] = [];
    const queue: string[] = [startNode.id];
    visited.add(startNode.id);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) cluster.push(node);

      const neighbors = adjacency.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId) && nodeMap.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    if (cluster.length > 0) {
      clusters.push(cluster);
    }
  }

  // Add any remaining orphan nodes (no connections)
  const orphans: ResourceNode[] = [];
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      orphans.push(node);
    }
  }

  // Sort clusters by size (largest first)
  clusters.sort((a, b) => b.length - a.length);

  const result: ResourceNode[] = [];
  let currentX = 0;
  let maxRowHeight = 0;
  let currentY = 0;
  const MAX_WIDTH = 1800; // Max width before wrapping to new row

  // Layout each connected cluster
  for (const cluster of clusters) {
    // Calculate cluster grid dimensions
    const clusterCols = Math.min(Math.ceil(Math.sqrt(cluster.length)), 5);
    const clusterRows = Math.ceil(cluster.length / clusterCols);
    const clusterWidth = clusterCols * NODE_WIDTH;
    const clusterHeight = clusterRows * NODE_HEIGHT;

    // Check if we need to wrap to next row
    if (currentX > 0 && currentX + clusterWidth > MAX_WIDTH) {
      currentX = 0;
      currentY += maxRowHeight + CLUSTER_GAP;
      maxRowHeight = 0;
    }

    // Order nodes within cluster to minimize edge length
    // Use BFS from the most connected node to place neighbors adjacently
    const orderedCluster = orderClusterByConnections(cluster, adjacency);

    // Place nodes in a grid within this cluster
    orderedCluster.forEach((node, idx) => {
      const col = idx % clusterCols;
      const row = Math.floor(idx / clusterCols);
      result.push({
        ...node,
        position: {
          x: currentX + col * NODE_WIDTH,
          y: currentY + row * NODE_HEIGHT,
        },
      });
    });

    currentX += clusterWidth + CLUSTER_GAP;
    maxRowHeight = Math.max(maxRowHeight, clusterHeight);
  }

  // Layout orphans at the end (grouped by service)
  if (orphans.length > 0) {
    // Group orphans by service
    const serviceGroups = new Map<ServiceType, ResourceNode[]>();
    orphans.forEach((node) => {
      const group = serviceGroups.get(node.data.service) || [];
      group.push(node);
      serviceGroups.set(node.data.service, group);
    });

    // Start orphans section
    const orphanStartY = currentY + maxRowHeight + CLUSTER_GAP * 2;
    const ORPHAN_COLS = 8;
    let orphanIndex = 0;

    serviceGroups.forEach((serviceNodes) => {
      serviceNodes.forEach((node) => {
        const col = orphanIndex % ORPHAN_COLS;
        const row = Math.floor(orphanIndex / ORPHAN_COLS);
        result.push({
          ...node,
          position: {
            x: col * NODE_WIDTH,
            y: orphanStartY + row * NODE_HEIGHT,
          },
        });
        orphanIndex++;
      });
    });
  }

  return result;
}

/**
 * Order nodes within a cluster to place connected nodes adjacently
 * Uses BFS from the most connected node
 */
function orderClusterByConnections(
  cluster: ResourceNode[],
  adjacency: Map<string, Set<string>>
): ResourceNode[] {
  if (cluster.length <= 1) return cluster;

  const clusterIds = new Set(cluster.map((n) => n.id));
  const nodeMap = new Map(cluster.map((n) => [n.id, n]));

  // Find the node with most connections within this cluster
  let maxConnections = -1;
  let startNodeId = cluster[0].id;

  for (const node of cluster) {
    const neighbors = adjacency.get(node.id) || new Set();
    const clusterNeighbors = [...neighbors].filter((id) => clusterIds.has(id));
    if (clusterNeighbors.length > maxConnections) {
      maxConnections = clusterNeighbors.length;
      startNodeId = node.id;
    }
  }

  // BFS to order nodes by proximity
  const ordered: ResourceNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];
  visited.add(startNodeId);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (node) ordered.push(node);

    // Get neighbors within this cluster, sorted by their connection count
    const neighbors = adjacency.get(nodeId) || new Set();
    const unvisitedNeighbors = [...neighbors]
      .filter((id) => clusterIds.has(id) && !visited.has(id))
      .sort((a, b) => {
        const aConns = adjacency.get(a)?.size || 0;
        const bConns = adjacency.get(b)?.size || 0;
        return bConns - aConns;
      });

    for (const neighborId of unvisitedNeighbors) {
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }

  // Add any remaining unvisited nodes (shouldn't happen in connected component)
  for (const node of cluster) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}

/**
 * Apply clustered layout - group connected nodes, orphans on right
 */
function applyClusteredLayout(graph: GraphData): ResourceNode[] {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;
  const CLUSTER_GAP = 100;
  const ORPHAN_SECTION_GAP = 300;

  const clusters = findClusters(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const adjacency = buildAdjacencyList(graph.edges);
  const result: ResourceNode[] = [];

  // Separate clusters by size (single-node clusters are orphans)
  const realClusters: ResourceNode[][] = [];
  const orphanNodes: string[] = [];

  clusters.forEach((members) => {
    if (members.length === 1) {
      orphanNodes.push(members[0]);
    } else {
      // Convert string IDs to nodes and order by connections
      const clusterNodes = members.map((id) => nodeMap.get(id)).filter(Boolean) as ResourceNode[];
      const orderedCluster = orderClusterByConnections(clusterNodes, adjacency);
      realClusters.push(orderedCluster);
    }
  });

  // Sort clusters by size (largest first)
  realClusters.sort((a, b) => b.length - a.length);

  // Layout connected clusters on the left
  let clusterX = 0;
  let maxY = 0;

  realClusters.forEach((clusterNodes) => {
    const clusterCols = Math.min(4, Math.ceil(Math.sqrt(clusterNodes.length)));
    let localMaxX = 0;

    clusterNodes.forEach((node, idx) => {
      const row = Math.floor(idx / clusterCols);
      const col = idx % clusterCols;
      const x = clusterX + col * NODE_WIDTH;
      const y = row * NODE_HEIGHT;

      result.push({
        ...node,
        position: { x, y },
      });

      localMaxX = Math.max(localMaxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    });

    clusterX = localMaxX + CLUSTER_GAP;
  });

  // Layout orphans on the right
  const orphanStartX = clusterX + ORPHAN_SECTION_GAP;
  const ORPHAN_COLS = 3;

  orphanNodes.forEach((nodeId, idx) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const row = Math.floor(idx / ORPHAN_COLS);
    const col = idx % ORPHAN_COLS;

    result.push({
      ...node,
      position: {
        x: orphanStartX + col * NODE_WIDTH,
        y: row * NODE_HEIGHT,
      },
    });
  });

  return result;
}

/**
 * Apply service-grouped layout - each service in its own row
 */
function applyServiceGroupedLayout(graph: GraphData): ResourceNode[] {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;
  const ROW_GAP = 60;

  const { connected, orphans } = getConnectedAndOrphans(graph);

  // Group by service, separating connected from orphans within each service
  const serviceConnected = new Map<ServiceType, ResourceNode[]>();
  const serviceOrphans = new Map<ServiceType, ResourceNode[]>();

  graph.nodes.forEach((node) => {
    const service = node.data.service;
    if (connected.has(node.id)) {
      const group = serviceConnected.get(service) || [];
      group.push(node);
      serviceConnected.set(service, group);
    } else {
      const group = serviceOrphans.get(service) || [];
      group.push(node);
      serviceOrphans.set(service, group);
    }
  });

  const result: ResourceNode[] = [];
  let currentY = 0;

  // Layout connected nodes by service
  const connectedServices = Array.from(serviceConnected.keys()).sort();
  connectedServices.forEach((service) => {
    const nodes = serviceConnected.get(service)!;
    nodes.forEach((node, idx) => {
      result.push({
        ...node,
        position: {
          x: idx * NODE_WIDTH,
          y: currentY,
        },
      });
    });
    currentY += NODE_HEIGHT + ROW_GAP;
  });

  // Add a larger gap before orphans
  if (orphans.size > 0) {
    currentY += 150;
  }

  // Layout orphan nodes by service
  const orphanServices = Array.from(serviceOrphans.keys()).sort();
  orphanServices.forEach((service) => {
    const nodes = serviceOrphans.get(service)!;
    nodes.forEach((node, idx) => {
      result.push({
        ...node,
        position: {
          x: idx * NODE_WIDTH,
          y: currentY,
        },
      });
    });
    currentY += NODE_HEIGHT + ROW_GAP;
  });

  return result;
}

/**
 * Apply connections-first layout - connected nodes in center, orphans in a ring around
 */
function applyConnectionsFirstLayout(graph: GraphData): ResourceNode[] {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;

  const { connected, orphans } = getConnectedAndOrphans(graph);
  const connectedNodes = graph.nodes.filter((n) => connected.has(n.id));
  const orphanNodes = graph.nodes.filter((n) => orphans.has(n.id));

  const result: ResourceNode[] = [];

  // Layout connected nodes in a grid in the center
  const centerCols = Math.max(4, Math.ceil(Math.sqrt(connectedNodes.length)));
  const centerRows = Math.ceil(connectedNodes.length / centerCols);
  const centerWidth = centerCols * NODE_WIDTH;
  const centerHeight = centerRows * NODE_HEIGHT;

  // Calculate center offset to position in the middle area
  const centerOffsetX = 400;
  const centerOffsetY = 200;

  connectedNodes.forEach((node, idx) => {
    const row = Math.floor(idx / centerCols);
    const col = idx % centerCols;
    result.push({
      ...node,
      position: {
        x: centerOffsetX + col * NODE_WIDTH,
        y: centerOffsetY + row * NODE_HEIGHT,
      },
    });
  });

  // Layout orphans around the perimeter
  if (orphanNodes.length > 0) {
    const margin = 150;
    const totalOrphans = orphanNodes.length;

    // Calculate positions around the center area
    // Top row
    const topCount = Math.ceil(totalOrphans * 0.3);
    // Bottom row
    const bottomCount = Math.ceil(totalOrphans * 0.3);
    // Left column
    const leftCount = Math.ceil((totalOrphans - topCount - bottomCount) / 2);
    // Right column
    const rightCount = totalOrphans - topCount - bottomCount - leftCount;

    let idx = 0;

    // Top row (above center)
    for (let i = 0; i < topCount && idx < orphanNodes.length; i++, idx++) {
      const spacing = centerWidth / Math.max(1, topCount - 1);
      result.push({
        ...orphanNodes[idx],
        position: {
          x: centerOffsetX + i * spacing,
          y: centerOffsetY - NODE_HEIGHT - margin,
        },
      });
    }

    // Bottom row (below center)
    for (let i = 0; i < bottomCount && idx < orphanNodes.length; i++, idx++) {
      const spacing = centerWidth / Math.max(1, bottomCount - 1);
      result.push({
        ...orphanNodes[idx],
        position: {
          x: centerOffsetX + i * spacing,
          y: centerOffsetY + centerHeight + margin,
        },
      });
    }

    // Left column
    for (let i = 0; i < leftCount && idx < orphanNodes.length; i++, idx++) {
      const spacing = centerHeight / Math.max(1, leftCount);
      result.push({
        ...orphanNodes[idx],
        position: {
          x: centerOffsetX - NODE_WIDTH - margin,
          y: centerOffsetY + i * spacing,
        },
      });
    }

    // Right column
    for (let i = 0; i < rightCount && idx < orphanNodes.length; i++, idx++) {
      const spacing = centerHeight / Math.max(1, rightCount);
      result.push({
        ...orphanNodes[idx],
        position: {
          x: centerOffsetX + centerWidth + margin,
          y: centerOffsetY + i * spacing,
        },
      });
    }
  }

  return result;
}

/**
 * Apply a layout preset to the graph
 */
export function applyLayout(graph: GraphData, preset: LayoutPreset): GraphData {
  let layoutedNodes: ResourceNode[];

  switch (preset) {
    case 'clustered':
      layoutedNodes = applyClusteredLayout(graph);
      break;
    case 'service-grouped':
      layoutedNodes = applyServiceGroupedLayout(graph);
      break;
    case 'connections-first':
      layoutedNodes = applyConnectionsFirstLayout(graph);
      break;
    case 'grid':
    default:
      layoutedNodes = applyGridLayout(graph.nodes, graph.edges);
      break;
  }

  return {
    nodes: layoutedNodes,
    edges: graph.edges,
  };
}

// ============================================================================
// NETWORK TOPOLOGY VIEW
// ============================================================================

/**
 * Global services that don't belong to any VPC
 */
const GLOBAL_SERVICES: ServiceType[] = [
  'iam_user',
  'iam_role',
  'iam_policy',
  'iam_access_key',
  's3',
  'cloudwatch_logs',
  'cloudwatch_alarm',
  'secret',
  'kms_key',
  'acm',
];

/**
 * Extract network topology (VPC/Subnet structure) from resources
 */
export function extractNetworkTopology(resources: Resource[]): NetworkTopology {
  const vpcs = new Map<string, VPCInfo>();
  const globalResourceIds: string[] = [];

  for (const resource of resources) {
    const raw = resource.raw as Record<string, unknown> | null;

    // Check if this is a global service
    if (GLOBAL_SERVICES.includes(resource.service)) {
      globalResourceIds.push(resource.resourceId);
      continue;
    }

    // Extract VPC and subnet info based on service type
    let vpcId: string | undefined;
    let subnetId: string | undefined;
    let availabilityZone: string | undefined;
    let isMultiSubnet = false;
    const subnetIds: string[] = [];

    switch (resource.service) {
      case 'ec2': {
        const data = extractEC2Data(raw);
        vpcId = data.vpcId || undefined;
        subnetId = data.subnetId || undefined;
        availabilityZone = data.availabilityZone || undefined;
        break;
      }
      case 'rds': {
        const data = extractRDSData(raw);
        // RDS instances are in a VPC via their subnet group
        // Extract VPC ID from the raw data if available
        vpcId = raw?.['VpcId'] as string || undefined;
        // RDS doesn't have a single subnet, it's in a subnet group
        availabilityZone = data.availabilityZone || undefined;
        break;
      }
      case 'alb': {
        const data = extractALBData(raw);
        vpcId = data.vpcId || undefined;
        // ALBs span multiple availability zones/subnets
        if (data.availabilityZones && data.availabilityZones.length > 1) {
          isMultiSubnet = true;
          data.availabilityZones.forEach((az) => {
            if (az.subnetId) subnetIds.push(az.subnetId);
          });
        } else if (data.availabilityZones && data.availabilityZones.length === 1) {
          subnetId = data.availabilityZones[0].subnetId;
          availabilityZone = data.availabilityZones[0].zoneName;
        }
        break;
      }
      case 'ebs': {
        const data = extractEBSData(raw);
        availabilityZone = data.availabilityZone || undefined;
        // EBS volumes don't directly have VPC/subnet, but we can try to get VPC from attached instance
        // For now, treat them as global if no VPC info
        break;
      }
      case 'eip': {
        // EIPs can be in a VPC or EC2-Classic
        const domain = raw?.['Domain'] as string;
        if (domain === 'vpc') {
          // Try to get VPC info - EIPs don't directly store VPC ID
          // They're associated with instances or network interfaces
        }
        break;
      }
      case 'security_group': {
        const data = extractSecurityGroupData(raw);
        vpcId = data.vpcId || undefined;
        break;
      }
      case 'lambda': {
        // Lambda can have VPC config
        const vpcConfig = raw?.['VpcConfig'] as Record<string, unknown> | undefined;
        if (vpcConfig) {
          vpcId = vpcConfig['VpcId'] as string || undefined;
          const lambdaSubnetIds = vpcConfig['SubnetIds'] as string[] || [];
          if (lambdaSubnetIds.length > 1) {
            isMultiSubnet = true;
            subnetIds.push(...lambdaSubnetIds);
          } else if (lambdaSubnetIds.length === 1) {
            subnetId = lambdaSubnetIds[0];
          }
        }
        break;
      }
      case 'rds_snapshot': {
        // Snapshots don't have VPC info directly, treat as global
        globalResourceIds.push(resource.resourceId);
        continue;
      }
      default:
        // Unknown service type, treat as global
        globalResourceIds.push(resource.resourceId);
        continue;
    }

    // If no VPC, treat as global
    if (!vpcId) {
      globalResourceIds.push(resource.resourceId);
      continue;
    }

    // Get or create VPC entry
    let vpcInfo = vpcs.get(vpcId);
    if (!vpcInfo) {
      vpcInfo = {
        vpcId,
        subnets: new Map(),
        multiSubnetResourceIds: [],
      };
      vpcs.set(vpcId, vpcInfo);
    }

    // Handle multi-subnet resources (ALBs, Lambdas with multiple subnets)
    if (isMultiSubnet) {
      vpcInfo.multiSubnetResourceIds.push(resource.resourceId);
      // Still create subnet entries for reference
      subnetIds.forEach((sid) => {
        if (!vpcInfo!.subnets.has(sid)) {
          vpcInfo!.subnets.set(sid, {
            subnetId: sid,
            resourceIds: [],
          });
        }
      });
    } else if (subnetId) {
      // Add to specific subnet
      let subnetInfo = vpcInfo.subnets.get(subnetId);
      if (!subnetInfo) {
        subnetInfo = {
          subnetId,
          availabilityZone,
          resourceIds: [],
        };
        vpcInfo.subnets.set(subnetId, subnetInfo);
      }
      subnetInfo.resourceIds.push(resource.resourceId);
      // Update AZ if we have it
      if (availabilityZone && !subnetInfo.availabilityZone) {
        subnetInfo.availabilityZone = availabilityZone;
      }
    } else {
      // Resource is in VPC but no specific subnet (e.g., Security Groups)
      // Add to multi-subnet section
      vpcInfo.multiSubnetResourceIds.push(resource.resourceId);
    }
  }

  return { vpcs, globalResourceIds };
}

/**
 * Layout constants for network view
 */
const NETWORK_LAYOUT = {
  VPC_PADDING: 40,
  VPC_HEADER_HEIGHT: 50,
  VPC_GAP: 60,
  SUBNET_PADDING: 20,
  SUBNET_HEADER_HEIGHT: 40,
  SUBNET_GAP: 30,
  NODE_WIDTH: 180,
  NODE_HEIGHT: 80,
  NODE_GAP: 20,
  MULTI_SUBNET_SECTION_HEIGHT: 120,
  GLOBAL_CONTAINER_MIN_WIDTH: 400,
};

/**
 * Create a VPC container node
 */
function createVPCContainerNode(
  vpcId: string,
  position: { x: number; y: number },
  width: number,
  height: number,
  resourceCount: number,
  subnetCount: number,
  isCollapsed: boolean
): VPCContainerNode {
  return {
    id: `vpc-${vpcId}`,
    type: 'vpcContainer',
    position,
    style: { width, height },
    data: {
      vpcId,
      resourceCount,
      subnetCount,
      isCollapsed,
    },
  };
}

/**
 * Create a subnet container node
 */
function createSubnetContainerNode(
  subnetId: string,
  vpcId: string,
  position: { x: number; y: number },
  width: number,
  height: number,
  availabilityZone: string | undefined,
  resourceCount: number,
  isCollapsed: boolean
): SubnetContainerNode {
  return {
    id: `subnet-${subnetId}`,
    type: 'subnetContainer',
    position,
    parentId: `vpc-${vpcId}`,
    extent: 'parent',
    style: { width, height },
    data: {
      subnetId,
      availabilityZone,
      resourceCount,
      isCollapsed,
    },
  };
}

/**
 * Create a global resources container node
 */
function createGlobalContainerNode(
  position: { x: number; y: number },
  width: number,
  height: number,
  resourceCount: number,
  isCollapsed: boolean
): GlobalContainerNode {
  return {
    id: 'global-container',
    type: 'globalContainer',
    position,
    style: { width, height },
    data: {
      resourceCount,
      isCollapsed,
    },
  };
}

/**
 * Calculate dimensions for a grid of nodes
 */
function calculateGridDimensions(
  nodeCount: number,
  maxCols: number = 4
): { cols: number; rows: number; width: number; height: number } {
  if (nodeCount === 0) {
    return { cols: 0, rows: 0, width: 0, height: 0 };
  }
  const cols = Math.min(nodeCount, maxCols);
  const rows = Math.ceil(nodeCount / cols);
  const width = cols * (NETWORK_LAYOUT.NODE_WIDTH + NETWORK_LAYOUT.NODE_GAP) - NETWORK_LAYOUT.NODE_GAP;
  const height = rows * (NETWORK_LAYOUT.NODE_HEIGHT + NETWORK_LAYOUT.NODE_GAP) - NETWORK_LAYOUT.NODE_GAP;
  return { cols, rows, width, height };
}

/**
 * Apply network topology layout to create hierarchical VPC/Subnet structure
 */
export function applyNetworkLayout(
  graph: GraphData,
  topology: NetworkTopology,
  collapsedState: ContainerCollapsedState,
  settings: NetworkViewSettings = { showGlobalResources: true }
): { nodes: NetworkNode[]; edges: RelationshipEdge[] } {
  const { NODE_WIDTH, NODE_HEIGHT, NODE_GAP, VPC_PADDING, VPC_HEADER_HEIGHT, VPC_GAP,
          SUBNET_PADDING, SUBNET_HEADER_HEIGHT, SUBNET_GAP, MULTI_SUBNET_SECTION_HEIGHT,
          GLOBAL_CONTAINER_MIN_WIDTH } = NETWORK_LAYOUT;

  const resultNodes: NetworkNode[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  let currentX = 0;
  let maxVpcHeight = 0;

  // Helper function to count total resources in a VPC
  const getVpcResourceCount = (vpcInfo: VPCInfo): number => {
    let count = vpcInfo.multiSubnetResourceIds.length;
    vpcInfo.subnets.forEach((subnet) => {
      count += subnet.resourceIds.length;
    });
    return count;
  };

  // Process each VPC - sort by resource count (largest first)
  const vpcEntries = Array.from(topology.vpcs.entries())
    .sort((a, b) => getVpcResourceCount(b[1]) - getVpcResourceCount(a[1]));

  for (const [vpcId, vpcInfo] of vpcEntries) {
    const isVpcCollapsed = collapsedState.vpcs[vpcId] ?? false;

    // Count total resources in this VPC
    let totalResourceCount = vpcInfo.multiSubnetResourceIds.length;
    vpcInfo.subnets.forEach((subnet) => {
      totalResourceCount += subnet.resourceIds.length;
    });

    if (isVpcCollapsed) {
      // Collapsed VPC - just show header
      const collapsedWidth = 300;
      const collapsedHeight = VPC_HEADER_HEIGHT + 20;

      const vpcNode = createVPCContainerNode(
        vpcId,
        { x: currentX, y: 0 },
        collapsedWidth,
        collapsedHeight,
        totalResourceCount,
        vpcInfo.subnets.size,
        true
      );
      resultNodes.push(vpcNode);

      currentX += collapsedWidth + VPC_GAP;
      maxVpcHeight = Math.max(maxVpcHeight, collapsedHeight);
      continue;
    }

    // Expanded VPC - calculate content dimensions
    let vpcContentHeight = 0;
    let vpcContentWidth = 0;
    const subnetsStartY = VPC_HEADER_HEIGHT + VPC_PADDING;

    // Multi-subnet resources section (if any)
    let multiSubnetHeight = 0;
    if (vpcInfo.multiSubnetResourceIds.length > 0) {
      const multiGrid = calculateGridDimensions(vpcInfo.multiSubnetResourceIds.length, 6);
      multiSubnetHeight = MULTI_SUBNET_SECTION_HEIGHT + multiGrid.height;
      vpcContentHeight += multiSubnetHeight;
      vpcContentWidth = Math.max(vpcContentWidth, multiGrid.width + VPC_PADDING * 2);
    }

    // Calculate subnet layout
    const subnetEntries = Array.from(vpcInfo.subnets.entries());
    let subnetX = VPC_PADDING;
    let subnetRowY = subnetsStartY + multiSubnetHeight;
    let currentRowHeight = 0;
    let currentRowWidth = 0;
    const maxSubnetsPerRow = 3;
    let subnetsInCurrentRow = 0;

    const subnetPositions: Array<{
      subnetId: string;
      info: SubnetInfo;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    for (const [subnetId, subnetInfo] of subnetEntries) {
      const isSubnetCollapsed = collapsedState.subnets[subnetId] ?? false;

      let subnetWidth: number;
      let subnetHeight: number;

      if (isSubnetCollapsed || subnetInfo.resourceIds.length === 0) {
        subnetWidth = 200;
        subnetHeight = SUBNET_HEADER_HEIGHT + 20;
      } else {
        const grid = calculateGridDimensions(subnetInfo.resourceIds.length, 3);
        subnetWidth = Math.max(200, grid.width + SUBNET_PADDING * 2);
        subnetHeight = SUBNET_HEADER_HEIGHT + SUBNET_PADDING + grid.height + SUBNET_PADDING;
      }

      // Check if we need to start a new row
      if (subnetsInCurrentRow >= maxSubnetsPerRow && subnetsInCurrentRow > 0) {
        subnetRowY += currentRowHeight + SUBNET_GAP;
        subnetX = VPC_PADDING;
        currentRowHeight = 0;
        subnetsInCurrentRow = 0;
      }

      subnetPositions.push({
        subnetId,
        info: subnetInfo,
        x: subnetX,
        y: subnetRowY,
        width: subnetWidth,
        height: subnetHeight,
      });

      subnetX += subnetWidth + SUBNET_GAP;
      currentRowWidth = Math.max(currentRowWidth, subnetX - SUBNET_GAP);
      currentRowHeight = Math.max(currentRowHeight, subnetHeight);
      subnetsInCurrentRow++;
    }

    // Final VPC dimensions
    vpcContentHeight = subnetRowY + currentRowHeight + VPC_PADDING - subnetsStartY + multiSubnetHeight;
    vpcContentWidth = Math.max(vpcContentWidth, currentRowWidth + VPC_PADDING);

    const vpcWidth = Math.max(400, vpcContentWidth);
    const vpcHeight = VPC_HEADER_HEIGHT + vpcContentHeight + VPC_PADDING;

    // Create VPC container node
    const vpcNode = createVPCContainerNode(
      vpcId,
      { x: currentX, y: 0 },
      vpcWidth,
      vpcHeight,
      totalResourceCount,
      vpcInfo.subnets.size,
      false
    );
    resultNodes.push(vpcNode);

    // Add multi-subnet resources directly inside VPC (not in any subnet)
    if (vpcInfo.multiSubnetResourceIds.length > 0) {
      const multiGrid = calculateGridDimensions(vpcInfo.multiSubnetResourceIds.length, 6);
      const startX = VPC_PADDING;
      const startY = VPC_HEADER_HEIGHT + 30; // Leave room for "Multi-AZ Resources" label

      vpcInfo.multiSubnetResourceIds.forEach((resourceId, idx) => {
        const node = nodeMap.get(resourceId);
        if (!node) return;

        const col = idx % multiGrid.cols;
        const row = Math.floor(idx / multiGrid.cols);

        const resourceNode: ResourceNode = {
          ...node,
          position: {
            x: startX + col * (NODE_WIDTH + NODE_GAP),
            y: startY + row * (NODE_HEIGHT + NODE_GAP),
          },
          parentId: `vpc-${vpcId}`,
          extent: 'parent',
        };
        resultNodes.push(resourceNode);
      });
    }

    // Create subnet nodes and their contained resources
    for (const { subnetId, info, x, y, width, height } of subnetPositions) {
      const isSubnetCollapsed = collapsedState.subnets[subnetId] ?? false;

      const subnetNode = createSubnetContainerNode(
        subnetId,
        vpcId,
        { x, y },
        width,
        height,
        info.availabilityZone,
        info.resourceIds.length,
        isSubnetCollapsed || info.resourceIds.length === 0
      );
      resultNodes.push(subnetNode);

      // Add resources inside subnet (if not collapsed and has resources)
      if (!isSubnetCollapsed && info.resourceIds.length > 0) {
        const grid = calculateGridDimensions(info.resourceIds.length, 3);

        info.resourceIds.forEach((resourceId, idx) => {
          const node = nodeMap.get(resourceId);
          if (!node) return;

          const col = idx % grid.cols;
          const row = Math.floor(idx / grid.cols);

          const resourceNode: ResourceNode = {
            ...node,
            position: {
              x: SUBNET_PADDING + col * (NODE_WIDTH + NODE_GAP),
              y: SUBNET_HEADER_HEIGHT + SUBNET_PADDING + row * (NODE_HEIGHT + NODE_GAP),
            },
            parentId: `subnet-${subnetId}`,
            extent: 'parent',
          };
          resultNodes.push(resourceNode);
        });
      }
    }

    currentX += vpcWidth + VPC_GAP;
    maxVpcHeight = Math.max(maxVpcHeight, vpcHeight);
  }

  // Add global resources container below VPCs (if enabled)
  if (settings.showGlobalResources && topology.globalResourceIds.length > 0) {
    const isGlobalCollapsed = collapsedState.global ?? false;
    const globalY = maxVpcHeight + VPC_GAP;

    if (isGlobalCollapsed) {
      const globalNode = createGlobalContainerNode(
        { x: 0, y: globalY },
        300,
        VPC_HEADER_HEIGHT + 20,
        topology.globalResourceIds.length,
        true
      );
      resultNodes.push(globalNode);
    } else {
      const grid = calculateGridDimensions(topology.globalResourceIds.length, 6);
      const globalWidth = Math.max(GLOBAL_CONTAINER_MIN_WIDTH, grid.width + VPC_PADDING * 2);
      const globalHeight = VPC_HEADER_HEIGHT + VPC_PADDING + grid.height + VPC_PADDING;

      const globalNode = createGlobalContainerNode(
        { x: 0, y: globalY },
        globalWidth,
        globalHeight,
        topology.globalResourceIds.length,
        false
      );
      resultNodes.push(globalNode);

      // Add global resources
      topology.globalResourceIds.forEach((resourceId, idx) => {
        const node = nodeMap.get(resourceId);
        if (!node) return;

        const col = idx % grid.cols;
        const row = Math.floor(idx / grid.cols);

        const resourceNode: ResourceNode = {
          ...node,
          position: {
            x: VPC_PADDING + col * (NODE_WIDTH + NODE_GAP),
            y: VPC_HEADER_HEIGHT + VPC_PADDING + row * (NODE_HEIGHT + NODE_GAP),
          },
          parentId: 'global-container',
          extent: 'parent',
        };
        resultNodes.push(resourceNode);
      });
    }
  }

  return {
    nodes: resultNodes,
    edges: graph.edges,
  };
}

/**
 * Get default collapsed state
 */
export function getDefaultCollapsedState(): ContainerCollapsedState {
  return {
    vpcs: {},
    subnets: {},
    global: false,
  };
}

/**
 * Get default network view settings
 */
export function getDefaultNetworkViewSettings(): NetworkViewSettings {
  return {
    showGlobalResources: true,
  };
}
