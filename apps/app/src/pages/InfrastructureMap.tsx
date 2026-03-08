import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
  extractNetworkTopology,
  applyNetworkLayout,
  getDefaultCollapsedState,
  getDefaultNetworkViewSettings,
} from '@/lib/graphUtils';
import {
  ResourceNodeComponent,
  VPCContainer,
  SubnetContainer,
  GlobalResourcesContainer,
} from '@/components/infrastructure-map';
import { ResourcePreviewModal } from '@/components/infrastructure-map/ResourcePreviewModal';
import { MapFiltersComponent } from '@/components/infrastructure-map/MapFilters';
import { MapLegend } from '@/components/infrastructure-map/MapLegend';
import { PaywallBlocker } from '@/components/shared/PaywallBlocker';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { RefreshCw, Network, RotateCcw, Layout, GitBranch, Waypoints, Globe, EyeOff } from 'lucide-react';
import type { ServiceType, Resource } from '@/types';
import { TIER_LIMITS } from '@/types';
import type {
  MapFilters,
  ResourceNodeData,
  ResourceNode,
  LayoutPreset,
  MapViewMode,
  ContainerCollapsedState,
  NetworkNode,
  NetworkViewSettings,
} from '@/types/graph';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Storage keys
const NODE_POSITIONS_KEY = 'infrastructure-map:node-positions';
const LAYOUT_PRESET_KEY = 'infrastructure-map:layout-preset';
const VIEW_MODE_KEY = 'infrastructure-map:view-mode';
const COLLAPSED_STATE_KEY = 'infrastructure-map:collapsed-state';
const NETWORK_SETTINGS_KEY = 'infrastructure-map:network-settings';

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

// Load saved view mode from localStorage
function loadViewMode(): MapViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved && ['graph', 'network'].includes(saved)) {
      return saved as MapViewMode;
    }
  } catch {
    // Ignore storage errors
  }
  return 'graph';
}

// Save view mode to localStorage
function saveViewMode(mode: MapViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

// Load collapsed state from localStorage
function loadCollapsedState(): ContainerCollapsedState {
  try {
    const saved = localStorage.getItem(COLLAPSED_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }
  return getDefaultCollapsedState();
}

// Save collapsed state to localStorage
function saveCollapsedState(state: ContainerCollapsedState): void {
  try {
    localStorage.setItem(COLLAPSED_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// Load network settings from localStorage
function loadNetworkSettings(): NetworkViewSettings {
  try {
    const saved = localStorage.getItem(NETWORK_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }
  return getDefaultNetworkViewSettings();
}

// Save network settings to localStorage
function saveNetworkSettings(settings: NetworkViewSettings): void {
  try {
    localStorage.setItem(NETWORK_SETTINGS_KEY, JSON.stringify(settings));
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
  vpcContainer: VPCContainer,
  subnetContainer: SubnetContainer,
  globalContainer: GlobalResourcesContainer,
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

// Keyboard navigation constants
const PAN_AMOUNT = 50;

/**
 * Component that handles keyboard navigation within React Flow
 * Must be rendered inside ReactFlow component to access useReactFlow hook
 */
function KeyboardControls() {
  const { setViewport, getViewport, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { x, y, zoom } = getViewport();

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setViewport({ x, y: y + PAN_AMOUNT, zoom });
          break;
        case 'ArrowDown':
          event.preventDefault();
          setViewport({ x, y: y - PAN_AMOUNT, zoom });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setViewport({ x: x + PAN_AMOUNT, y, zoom });
          break;
        case 'ArrowRight':
          event.preventDefault();
          setViewport({ x: x - PAN_AMOUNT, y, zoom });
          break;
        case '=':
        case '+':
          event.preventDefault();
          zoomIn({ duration: 200 });
          break;
        case '-':
        case '_':
          event.preventDefault();
          zoomOut({ duration: 200 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewport, getViewport, zoomIn, zoomOut]);

  return null;
}

export default function InfrastructureMap() {
  const { org } = useAuthStore();

  // Check tier-based access
  const tier = org?.tier || 'free';
  const canViewInfrastructureMap = TIER_LIMITS[tier].canViewInfrastructureMap;

  // All hooks MUST be called before any conditional return (Rules of Hooks)
  const { data: resourcesData, isLoading: resourcesLoading, refetch } = useAllResources(
    undefined, { enabled: canViewInfrastructureMap }
  );
  const { data: findingsData, isLoading: findingsLoading } = useFilteredFindings(
    undefined, { enabled: canViewInfrastructureMap }
  );
  const { data: dependenciesData } = useAllDependencies({ enabled: canViewInfrastructureMap });

  const [filters, setFilters] = useState<MapFilters>(getDefaultFilters);
  const [layoutPreset, setLayoutPresetState] = useState<LayoutPreset>(loadLayoutPreset);
  const [viewMode, setViewModeState] = useState<MapViewMode>(loadViewMode);
  const [collapsedState, setCollapsedStateState] = useState<ContainerCollapsedState>(loadCollapsedState);
  const [networkSettings, setNetworkSettingsState] = useState<NetworkViewSettings>(loadNetworkSettings);

  // Wrapper to save layout preset when changed
  const setLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutPresetState(preset);
    saveLayoutPreset(preset);
  }, []);

  // Wrapper to save view mode when changed
  const setViewMode = useCallback((mode: MapViewMode) => {
    setViewModeState(mode);
    saveViewMode(mode);
  }, []);

  // Wrapper to save collapsed state when changed (supports functional updates)
  const setCollapsedState = useCallback((stateOrUpdater: ContainerCollapsedState | ((prev: ContainerCollapsedState) => ContainerCollapsedState)) => {
    setCollapsedStateState((prev) => {
      const newState = typeof stateOrUpdater === 'function' ? stateOrUpdater(prev) : stateOrUpdater;
      saveCollapsedState(newState);
      return newState;
    });
  }, []);

  // Wrapper to save network settings when changed
  const setNetworkSettings = useCallback((settings: NetworkViewSettings) => {
    setNetworkSettingsState(settings);
    saveNetworkSettings(settings);
  }, []);

  // Toggle global resources visibility
  const toggleGlobalResources = useCallback(() => {
    setNetworkSettings({
      ...networkSettings,
      showGlobalResources: !networkSettings.showGlobalResources,
    });
  }, [networkSettings, setNetworkSettings]);

  // Default legend to collapsed on mobile (screen width < 640px)
  const [legendCollapsed, setLegendCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Track saved positions - loaded once on mount
  const savedPositionsRef = useRef<NodePositions>(loadNodePositions());
  const [positionsVersion, setPositionsVersion] = useState(0);

  // Handle node click to open preview modal or toggle container collapse
  const onNodeClick: NodeMouseHandler<NetworkNode> = useCallback((event, node) => {
    // Check if click was on a container header for collapse toggle
    const target = event.target as HTMLElement;
    const vpcToggle = target.closest('[data-vpc-toggle]');
    const subnetToggle = target.closest('[data-subnet-toggle]');
    const globalToggle = target.closest('[data-global-toggle]');

    if (vpcToggle) {
      const vpcId = vpcToggle.getAttribute('data-vpc-toggle');
      if (vpcId) {
        setCollapsedState((prev) => ({
          ...prev,
          vpcs: {
            ...prev.vpcs,
            [vpcId]: !prev.vpcs[vpcId],
          },
        }));
      }
      return;
    }

    if (subnetToggle) {
      const subnetId = subnetToggle.getAttribute('data-subnet-toggle');
      if (subnetId) {
        setCollapsedState((prev) => ({
          ...prev,
          subnets: {
            ...prev.subnets,
            [subnetId]: !prev.subnets[subnetId],
          },
        }));
      }
      return;
    }

    if (globalToggle) {
      setCollapsedState((prev) => ({
        ...prev,
        global: !prev.global,
      }));
      return;
    }

    // Regular resource node click
    if (node.type === 'resource') {
      const nodeData = node.data as ResourceNodeData;
      if (nodeData.resource) {
        setSelectedResource(nodeData.resource);
        setIsModalOpen(true);
      }
    }
  }, [setCollapsedState]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedResource(null);
  }, []);

  // Handle node drag end - save position (only for resource nodes in graph view)
  const onNodeDragStop: OnNodeDrag<NetworkNode> = useCallback((_, node) => {
    // Only save positions for resource nodes in graph view
    if (viewMode === 'graph' && node.type === 'resource') {
      savedPositionsRef.current[node.id] = node.position;
      saveNodePositions(savedPositionsRef.current);
    }
  }, [viewMode]);

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

  // Extract network topology for network view
  const networkTopology = useMemo(() => {
    if (!resourcesData?.data) return null;
    return extractNetworkTopology(resourcesData.data);
  }, [resourcesData]);

  // Apply filters and layout to graph, then restore saved positions
  const filteredGraph = useMemo(() => {
    const filtered = filterGraph(fullGraph, filters);

    if (viewMode === 'network' && networkTopology) {
      // Apply network layout
      return applyNetworkLayout(filtered, networkTopology, collapsedState, networkSettings);
    } else {
      // Apply standard layout preset
      const layouted = applyLayout(filtered, layoutPreset);
      // Apply saved positions to nodes (overrides layout)
      return {
        ...layouted,
        nodes: applyPositionsToNodes(layouted.nodes, savedPositionsRef.current),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGraph, filters, layoutPreset, positionsVersion, viewMode, networkTopology, collapsedState, networkSettings]);

  // Calculate stats for legend (filter out container nodes for stats)
  const stats = useMemo(() => {
    const resourceNodes = filteredGraph.nodes.filter(
      (n): n is ResourceNode => n.type === 'resource'
    );
    return calculateGraphStats({ nodes: resourceNodes, edges: filteredGraph.edges });
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

  // React Flow state - initialize with empty arrays to avoid issues with network view on first render
  const [nodes, setNodes, onNodesChange] = useNodesState<NetworkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredGraph.edges);

  // Update nodes/edges when filtered graph changes
  useEffect(() => {
    // Use a setTimeout to break the synchronous update cycle that can cause infinite loops
    const timeoutId = setTimeout(() => {
      setNodes(filteredGraph.nodes as NetworkNode[]);
      setEdges(filteredGraph.edges);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [filteredGraph, setNodes, setEdges]);

  const isLoading = resourcesLoading || findingsLoading;

  // Show paywall for free tier (after all hooks)
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
    <div className="h-[calc(100vh-180px)] sm:h-[calc(100vh-120px)] relative">
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
        {/* Keyboard navigation handler */}
        <KeyboardControls />
        {/* Top Left Panel - Title and Filters */}
        <Panel position="top-left" className="flex flex-col gap-2 max-w-[calc(100vw-80px)] sm:max-w-none">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-card/95 backdrop-blur-sm border rounded-lg px-3 py-1.5 sm:px-4 sm:py-2">
              <h1 className="text-base sm:text-lg font-semibold">Infrastructure Map</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {stats.totalNodes} resources • {stats.totalEdges} connections
              </p>
            </div>

            {/* Legend toggle - mobile only, moved from top-right */}
            <div className="sm:hidden">
              <MapLegend
                stats={stats}
                isCollapsed={legendCollapsed}
                onToggle={() => setLegendCollapsed(!legendCollapsed)}
              />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <MapFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              availableServices={availableServices}
              availableRegions={availableRegions}
            />

            {/* View Mode Toggle */}
            <div className="flex items-center bg-card/95 backdrop-blur-sm border rounded-lg p-0.5">
              <Button
                variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('graph')}
                className="gap-1 h-7 px-2 sm:px-3"
                title="Graph View - shows resources with connections"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Graph</span>
              </Button>
              <Button
                variant={viewMode === 'network' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('network')}
                className="gap-1 h-7 px-2 sm:px-3"
                title="Network View - shows VPC/Subnet hierarchy"
              >
                <Waypoints className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Network</span>
              </Button>
            </div>

            {/* Global Resources Toggle - only show in network view */}
            {viewMode === 'network' && (
              <Button
                variant={networkSettings.showGlobalResources ? 'outline' : 'secondary'}
                size="sm"
                onClick={toggleGlobalResources}
                className="gap-1 h-7 px-2 sm:px-3"
                title={networkSettings.showGlobalResources ? 'Hide global resources (IAM, S3, etc.)' : 'Show global resources'}
              >
                {networkSettings.showGlobalResources ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {networkSettings.showGlobalResources ? 'Hide Global' : 'Show Global'}
                </span>
              </Button>
            )}

            {/* Layout Dropdown - only show in graph view */}
            {viewMode === 'graph' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 px-2 sm:px-3">
                    <Layout className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {LAYOUT_PRESETS.find((p) => p.id === layoutPreset)?.name || 'Layout'}
                    </span>
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
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1 h-7 px-2 sm:px-3"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {viewMode === 'graph' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPositions}
                className="gap-1 h-7 px-2 sm:px-3"
                title="Reset all node positions to default layout"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
          </div>
        </Panel>

        {/* Top Right Panel - Legend (desktop only) */}
        <Panel position="top-right" className="hidden sm:block">
          <MapLegend
            stats={stats}
            isCollapsed={legendCollapsed}
            onToggle={() => setLegendCollapsed(!legendCollapsed)}
          />
        </Panel>

        {/* Controls */}
        <Controls showInteractive={false} />

        {/* MiniMap - hidden on mobile */}
        <MiniMap
          nodeColor={getMinimapNodeColor}
          maskColor="hsl(var(--background) / 0.7)"
          nodeStrokeColor="hsl(var(--border))"
          nodeBorderRadius={4}
          className="hidden sm:block"
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
