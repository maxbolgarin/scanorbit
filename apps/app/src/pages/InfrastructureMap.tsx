import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/styles/infrastructure-map.css';
import { useAllResources, useAllDependencies } from '@/hooks/use-resources';
import { useFilteredFindings } from '@/hooks/use-findings';
import { useAuthStore } from '@/stores/auth-store';
import {
  buildInfrastructureGraphWithDependencies,
  filterGraph,
  calculateGraphStats,
  getDefaultFilters,
  applyLayout,
  LAYOUT_PRESETS,
} from '@/lib/graphUtils';
import { ResourceNodeComponent } from '@/components/infrastructure-map/ResourceNodeComponent';
import { ResourcePreviewModal } from '@/components/infrastructure-map/ResourcePreviewModal';
import { MapFiltersComponent } from '@/components/infrastructure-map/MapFilters';
import { MapLegend } from '@/components/infrastructure-map/MapLegend';
import { PaywallBlocker } from '@/components/shared/PaywallBlocker';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { RefreshCw, Network, RotateCcw, Layout } from 'lucide-react';
import type { ServiceType, Resource } from '@/types';
import { TIER_LIMITS } from '@/types';
import type { MapFilters, ResourceNodeData, ResourceNode, LayoutPreset } from '@/types/graph';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Storage keys
const NODE_POSITIONS_KEY = 'infrastructure-map:node-positions';
const LAYOUT_PRESET_KEY = 'infrastructure-map:layout-preset';

// Type for stored positions
type NodePositions = Record<string, XYPosition>;

// Load saved positions from localStorage
function loadNodePositions(): NodePositions {
  try {
    const saved = localStorage.getItem(NODE_POSITIONS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save positions to localStorage
function saveNodePositions(positions: NodePositions): void {
  try {
    localStorage.setItem(NODE_POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

// Load saved layout preset from localStorage
function loadLayoutPreset(): LayoutPreset {
  try {
    const saved = localStorage.getItem(LAYOUT_PRESET_KEY);
    if (saved && ['grid', 'clustered', 'service-grouped', 'connections-first'].includes(saved)) {
      return saved as LayoutPreset;
    }
  } catch {
    // Ignore storage errors
  }
  return 'grid';
}

// Save layout preset to localStorage
function saveLayoutPreset(preset: LayoutPreset): void {
  try {
    localStorage.setItem(LAYOUT_PRESET_KEY, preset);
  } catch {
    // Ignore storage errors
  }
}

// Apply saved positions to nodes
function applyPositionsToNodes<T extends Node>(nodes: T[], positions: NodePositions): T[] {
  return nodes.map((node) => {
    const savedPosition = positions[node.id];
    if (savedPosition) {
      return { ...node, position: savedPosition };
    }
    return node;
  });
}

// Define custom node types
const nodeTypes = {
  resource: ResourceNodeComponent,
};

// Get color for minimap nodes based on criticality
function getMinimapNodeColor(node: Node): string {
  const data = node.data as ResourceNodeData | undefined;
  switch (data?.criticalityLevel) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#eab308';
    default:
      return '#6b7280';
  }
}

export default function InfrastructureMap() {
  const { org } = useAuthStore();

  // Check tier-based access
  const tier = org?.tier || 'free';
  const canViewInfrastructureMap = TIER_LIMITS[tier].canViewInfrastructureMap;

  const { data: resourcesData, isLoading: resourcesLoading, refetch } = useAllResources();
  const { data: findingsData, isLoading: findingsLoading } = useFilteredFindings();
  const { data: dependenciesData } = useAllDependencies();

  // Show paywall for free tier
  if (!canViewInfrastructureMap) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
          <p className="text-muted-foreground">
            Visualize your AWS infrastructure and dependencies
          </p>
        </div>
        <PaywallBlocker feature="infrastructure-map" />
      </div>
    );
  }

  const [filters, setFilters] = useState<MapFilters>(getDefaultFilters);
  const [layoutPreset, setLayoutPresetState] = useState<LayoutPreset>(loadLayoutPreset);

  // Wrapper to save layout preset when changed
  const setLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutPresetState(preset);
    saveLayoutPreset(preset);
  }, []);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Track saved positions - loaded once on mount
  const savedPositionsRef = useRef<NodePositions>(loadNodePositions());
  const [positionsVersion, setPositionsVersion] = useState(0);

  // Handle node click to open preview modal
  const onNodeClick: NodeMouseHandler<ResourceNode> = useCallback((_, node) => {
    const nodeData = node.data as ResourceNodeData;
    if (nodeData.resource) {
      setSelectedResource(nodeData.resource);
      setIsModalOpen(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedResource(null);
  }, []);

  // Handle node drag end - save position
  const onNodeDragStop: OnNodeDrag<ResourceNode> = useCallback((_, node) => {
    savedPositionsRef.current[node.id] = node.position;
    saveNodePositions(savedPositionsRef.current);
  }, []);

  // Reset all positions to default layout
  const handleResetPositions = useCallback(() => {
    savedPositionsRef.current = {};
    localStorage.removeItem(NODE_POSITIONS_KEY);
    setPositionsVersion((v) => v + 1);
  }, []);

  // Build full graph from resources with DB dependencies
  const fullGraph = useMemo(() => {
    if (!resourcesData?.data) return { nodes: [], edges: [] };
    return buildInfrastructureGraphWithDependencies(
      resourcesData.data,
      findingsData?.data || [],
      dependenciesData
    );
  }, [resourcesData, findingsData, dependenciesData]);

  // Apply filters and layout to graph, then restore saved positions
  const filteredGraph = useMemo(() => {
    const filtered = filterGraph(fullGraph, filters);
    // Apply layout preset
    const layouted = applyLayout(filtered, layoutPreset);
    // Apply saved positions to nodes (overrides layout)
    return {
      ...layouted,
      nodes: applyPositionsToNodes(layouted.nodes, savedPositionsRef.current),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGraph, filters, layoutPreset, positionsVersion]);

  // Calculate stats for legend
  const stats = useMemo(() => {
    return calculateGraphStats(filteredGraph);
  }, [filteredGraph]);

  // Get available services and regions for filters
  const availableServices = useMemo(() => {
    const services = new Set<ServiceType>();
    fullGraph.nodes.forEach((n) => {
      const data = n.data as ResourceNodeData;
      services.add(data.service);
    });
    return Array.from(services).sort();
  }, [fullGraph]);

  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    fullGraph.nodes.forEach((n) => {
      const data = n.data as ResourceNodeData;
      if (data.region) regions.add(data.region);
    });
    return Array.from(regions).sort();
  }, [fullGraph]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(filteredGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredGraph.edges);

  // Update nodes/edges when filtered graph changes
  useEffect(() => {
    setNodes(filteredGraph.nodes);
    setEdges(filteredGraph.edges);
  }, [filteredGraph, setNodes, setEdges]);

  const isLoading = resourcesLoading || findingsLoading;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!resourcesData?.data || resourcesData.data.length === 0) {
    return (
      <div className="flex h-[calc(100vh-120px)] flex-col items-center justify-center gap-4">
        <Network className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">No Resources Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Connect an AWS account and run a scan to see your infrastructure map.
        </p>
        <Button variant="outline" onClick={() => window.location.href = '/accounts'}>
          Connect AWS Account
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Top Left Panel - Title and Filters */}
        <Panel position="top-left" className="flex items-center gap-2">
          <div className="bg-card/95 backdrop-blur-sm border rounded-lg px-4 py-2">
            <h1 className="text-lg font-semibold">Infrastructure Map</h1>
            <p className="text-xs text-muted-foreground">
              {stats.totalNodes} resources • {stats.totalEdges} connections
            </p>
          </div>
          <MapFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            availableServices={availableServices}
            availableRegions={availableRegions}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Layout className="h-4 w-4" />
                {LAYOUT_PRESETS.find((p) => p.id === layoutPreset)?.name || 'Layout'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {LAYOUT_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => {
                    setLayoutPreset(preset.id);
                    handleResetPositions();
                  }}
                  className={layoutPreset === preset.id ? 'bg-accent' : ''}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetPositions}
            className="gap-2"
            title="Reset all node positions to default layout"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Layout
          </Button>
        </Panel>

        {/* Top Right Panel - Legend */}
        <Panel position="top-right">
          <MapLegend
            stats={stats}
            isCollapsed={legendCollapsed}
            onToggle={() => setLegendCollapsed(!legendCollapsed)}
          />
        </Panel>

        {/* Controls */}
        <Controls showInteractive={false} />

        {/* MiniMap */}
        <MiniMap
          nodeColor={getMinimapNodeColor}
          maskColor="hsl(var(--background) / 0.7)"
          nodeStrokeColor="hsl(var(--border))"
          nodeBorderRadius={4}
        />

        {/* Background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.2)"
        />
      </ReactFlow>

      {/* Resource Preview Modal */}
      <ResourcePreviewModal
        resource={selectedResource}
        findings={findingsData?.data || []}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
