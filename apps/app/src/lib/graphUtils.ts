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
    case 'security_group':
      return { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5,5' };
    case 'attachment':
      return { stroke: '#6b7280', strokeWidth: 2 };
    case 'vpc':
    case 'subnet':
      return { stroke: '#10b981', strokeWidth: 1.5 };
    case 'kms':
      return { stroke: '#f59e0b', strokeWidth: 1.5 };
    case 'iam':
      return { stroke: '#8b5cf6', strokeWidth: 1.5 };
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
    description: 'Simple grid layout by service',
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
 * Apply grid layout
 */
function applyGridLayout(nodes: ResourceNode[]): ResourceNode[] {
  const GRID_COLS = 8;
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;

  // Group by service
  const serviceGroups = new Map<ServiceType, ResourceNode[]>();
  nodes.forEach((node) => {
    const group = serviceGroups.get(node.data.service) || [];
    group.push(node);
    serviceGroups.set(node.data.service, group);
  });

  const result: ResourceNode[] = [];
  let index = 0;

  serviceGroups.forEach((serviceNodes) => {
    serviceNodes.forEach((node) => {
      const row = Math.floor(index / GRID_COLS);
      const col = index % GRID_COLS;
      result.push({
        ...node,
        position: {
          x: col * NODE_WIDTH,
          y: row * NODE_HEIGHT,
        },
      });
      index++;
    });
  });

  return result;
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
  const result: ResourceNode[] = [];

  // Separate clusters by size (single-node clusters are orphans)
  const realClusters: string[][] = [];
  const orphanNodes: string[] = [];

  clusters.forEach((members) => {
    if (members.length === 1) {
      orphanNodes.push(members[0]);
    } else {
      realClusters.push(members);
    }
  });

  // Sort clusters by size (largest first)
  realClusters.sort((a, b) => b.length - a.length);

  // Layout connected clusters on the left
  let clusterX = 0;
  let maxY = 0;

  realClusters.forEach((members) => {
    const clusterCols = Math.min(4, Math.ceil(Math.sqrt(members.length)));
    let localMaxX = 0;

    members.forEach((nodeId, idx) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

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
      layoutedNodes = applyGridLayout(graph.nodes);
      break;
  }

  return {
    nodes: layoutedNodes,
    edges: graph.edges,
  };
}
