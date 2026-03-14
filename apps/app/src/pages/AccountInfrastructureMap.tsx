import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import { useAwsAccount, useScanHistory, useScanCompletionRefresh } from '@/hooks/use-aws-accounts';
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
import { ConnectionErrorState } from '@/components/shared/ConnectionErrorState';
import { NoScanState } from '@/components/shared/NoScanState';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { RefreshCw, Network, RotateCcw, Layout, Cloud, GitBranch, Waypoints, Globe, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import type { Resource, ServiceType } from '@/types';
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
import { ACTIVE_SCAN_STATUSES, TIER_LIMITS } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Storage keys - per account
const getNodePositionsKey = (accountId: string) => `infrastructure-map:node-positions:${accountId}`;
const getLayoutPresetKey = (accountId: string) => `infrastructure-map:layout-preset:${accountId}`;
const getViewModeKey = (accountId: string) => `infrastructure-map:view-mode:${accountId}`;
const getCollapsedStateKey = (accountId: string) => `infrastructure-map:collapsed-state:${accountId}`;
const getNetworkSettingsKey = (accountId: string) => `infrastructure-map:network-settings:${accountId}`;
const getControlsVisibleKey = (accountId: string) => `infrastructure-map:controls-visible:${accountId}`;

type NodePositions = Record<string, XYPosition>;

function loadNodePositions(accountId: string): NodePositions {
  try {
    const saved = localStorage.getItem(getNodePositionsKey(accountId));
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveNodePositions(accountId: string, positions: NodePositions): void {
  try {
    localStorage.setItem(getNodePositionsKey(accountId), JSON.stringify(positions));
  } catch {}
}

function loadLayoutPreset(accountId: string): LayoutPreset {
  try {
    const saved = localStorage.getItem(getLayoutPresetKey(accountId));
    if (saved && ['grid', 'clustered', 'service-grouped', 'connections-first'].includes(saved)) {
      return saved as LayoutPreset;
    }
  } catch {}
  return 'grid';
}

function saveLayoutPreset(accountId: string, preset: LayoutPreset): void {
  try {
    localStorage.setItem(getLayoutPresetKey(accountId), preset);
  } catch {}
}

function loadViewMode(accountId: string): MapViewMode {
  try {
    const saved = localStorage.getItem(getViewModeKey(accountId));
    if (saved && ['graph', 'network'].includes(saved)) {
      return saved as MapViewMode;
    }
  } catch {}
  return 'graph';
}

function saveViewMode(accountId: string, mode: MapViewMode): void {
  try {
    localStorage.setItem(getViewModeKey(accountId), mode);
  } catch {}
}

function loadCollapsedState(accountId: string): ContainerCollapsedState {
  try {
    const saved = localStorage.getItem(getCollapsedStateKey(accountId));
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return getDefaultCollapsedState();
}

function saveCollapsedState(accountId: string, state: ContainerCollapsedState): void {
  try {
    localStorage.setItem(getCollapsedStateKey(accountId), JSON.stringify(state));
  } catch {}
}

function loadNetworkSettings(accountId: string): NetworkViewSettings {
  try {
    const saved = localStorage.getItem(getNetworkSettingsKey(accountId));
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return getDefaultNetworkViewSettings();
}

function saveNetworkSettings(accountId: string, settings: NetworkViewSettings): void {
  try {
    localStorage.setItem(getNetworkSettingsKey(accountId), JSON.stringify(settings));
  } catch {}
}

function loadControlsVisible(accountId: string): boolean {
  try {
    const saved = localStorage.getItem(getControlsVisibleKey(accountId));
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {}
  return true;
}

function saveControlsVisible(accountId: string, visible: boolean): void {
  try {
    localStorage.setItem(getControlsVisibleKey(accountId), String(visible));
  } catch {}
}

function applyPositionsToNodes<T extends Node>(nodes: T[], positions: NodePositions): T[] {
  return nodes.map((node) => {
    const savedPosition = positions[node.id];
    if (savedPosition) {
      return { ...node, position: savedPosition };
    }
    return node;
  });
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

const nodeTypes = {
  resource: ResourceNodeComponent,
  vpcContainer: VPCContainer,
  subnetContainer: SubnetContainer,
  globalContainer: GlobalResourcesContainer,
};

export default function AccountInfrastructureMap() {
  const { accountId } = useParams<{ accountId: string }>();
  const { org } = useAuthStore();

  // Check tier-based access
  const tier = org?.tier || 'free';
  const canViewInfrastructureMap = TIER_LIMITS[tier].canViewInfrastructureMap;

  // Account-specific data
  const { data: account, isLoading: accountLoading } = useAwsAccount(accountId!);
  // Only fetch data if user has permission to view infrastructure map
  const { data: resourcesData, isLoading: resourcesLoading, refetch } = useAllResources(
    { awsAccountId: accountId },
    { enabled: canViewInfrastructureMap }
  );
  const { data: dependenciesData } = useAllDependencies({ enabled: canViewInfrastructureMap });
  const { data: findingsData } = useFilteredFindings(
    { awsAccountId: accountId },
    { enabled: canViewInfrastructureMap }
  );
  const { data: scanHistory } = useScanHistory(accountId!);

  const { activeScans } = useScanCompletionRefresh();

  // Extract resources array
  const resources = resourcesData?.data || [];
  const findings = findingsData?.data || [];

  // Filter dependencies for this account's resources
  const resourceIds = useMemo(() => new Set(resources.map(r => r.id)), [resources]);
  const accountDependencies = useMemo(() =>
    (dependenciesData || []).filter(d => resourceIds.has(d.sourceResourceId) || resourceIds.has(d.targetResourceId)),
    [dependenciesData, resourceIds]
  );

  const [filters, setFilters] = useState<MapFilters>(getDefaultFilters);
  const [layoutPreset, setLayoutPresetState] = useState<LayoutPreset>(() => loadLayoutPreset(accountId!));
  const [viewMode, setViewModeState] = useState<MapViewMode>(() => loadViewMode(accountId!));
  const [collapsedState, setCollapsedStateState] = useState<ContainerCollapsedState>(() => loadCollapsedState(accountId!));
  const [networkSettings, setNetworkSettingsState] = useState<NetworkViewSettings>(() => loadNetworkSettings(accountId!));
  const [controlsVisible, setControlsVisibleState] = useState<boolean>(() => loadControlsVisible(accountId!));
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Wrapper to save layout preset when changed
  const setLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutPresetState(preset);
    saveLayoutPreset(accountId!, preset);
  }, [accountId]);

  // Wrapper to save view mode when changed
  const setViewMode = useCallback((mode: MapViewMode) => {
    setViewModeState(mode);
    saveViewMode(accountId!, mode);
  }, [accountId]);

  // Wrapper to save collapsed state when changed (supports functional updates)
  const setCollapsedState = useCallback((stateOrUpdater: ContainerCollapsedState | ((prev: ContainerCollapsedState) => ContainerCollapsedState)) => {
    setCollapsedStateState((prev) => {
      const newState = typeof stateOrUpdater === 'function' ? stateOrUpdater(prev) : stateOrUpdater;
      saveCollapsedState(accountId!, newState);
      return newState;
    });
  }, [accountId]);

  // Wrapper to save network settings when changed
  const setNetworkSettings = useCallback((settings: NetworkViewSettings) => {
    setNetworkSettingsState(settings);
    saveNetworkSettings(accountId!, settings);
  }, [accountId]);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setControlsVisibleState((prev) => {
      const next = !prev;
      saveControlsVisible(accountId!, next);
      return next;
    });
  }, [accountId]);

  // Toggle global resources visibility
  const toggleGlobalResources = useCallback(() => {
    setNetworkSettings({
      ...networkSettings,
      showGlobalResources: !networkSettings.showGlobalResources,
    });
  }, [networkSettings, setNetworkSettings]);

  // Track saved positions - loaded once on mount
  const savedPositionsRef = useRef<NodePositions>(loadNodePositions(accountId!));
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
      saveNodePositions(accountId!, savedPositionsRef.current);
    }
  }, [accountId, viewMode]);

  // Reset all positions to default layout
  const handleResetPositions = useCallback(() => {
    savedPositionsRef.current = {};
    localStorage.removeItem(getNodePositionsKey(accountId!));
    setPositionsVersion((v) => v + 1);
  }, [accountId]);

  // Build full graph from resources with DB dependencies
  const fullGraph = useMemo(() => {
    if (resources.length === 0) return { nodes: [], edges: [] };
    return buildInfrastructureGraphWithDependencies(
      resources,
      findings,
      accountDependencies
    );
  }, [resources, findings, accountDependencies]);

  // Extract network topology for network view
  const networkTopology = useMemo(() => {
    if (resources.length === 0) return null;
    return extractNetworkTopology(resources);
  }, [resources]);

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
    // Skip if user doesn't have permission - prevents infinite loop with empty data
    if (!canViewInfrastructureMap) return;
    // Use a setTimeout to break the synchronous update cycle that can cause infinite loops
    const timeoutId = setTimeout(() => {
      setNodes(filteredGraph.nodes as NetworkNode[]);
      setEdges(filteredGraph.edges);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [filteredGraph, setNodes, setEdges, canViewInfrastructureMap]);

  const hasCompletedScan = scanHistory?.some(scan =>
    scan.status === "complete" || scan.status === "partial"
  );
  const hasScanInProgress = activeScans?.some(scan => scan.awsAccountId === accountId) ||
    scanHistory?.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  const isLoading = accountLoading || resourcesLoading;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Paywall for free tier
  if (hasCompletedScan && !canViewInfrastructureMap) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
            <p className="text-muted-foreground">
              {account?.name} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        <PaywallBlocker feature="infrastructure-map" />
      </div>
    );
  }

  // Account error state
  if (account?.status === "error") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
            <p className="text-muted-foreground">
              {account?.name} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        <ConnectionErrorState
          accountId={accountId}
          accountName={account.name}
          errorMessage={account.lastError}
        />
      </div>
    );
  }

  // Empty states - redirect to Scans page
  if (!hasCompletedScan && !hasScanInProgress && account?.status === "ok") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
            <p className="text-muted-foreground">
              {account?.name} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        <NoScanState
          accountId={accountId!}
          title="Visualize your infrastructure"
          description="Go to the Scans page to start discovering your resources and visualize their relationships."
        />
      </div>
    );
  }

  if (hasScanInProgress && !hasCompletedScan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
            <p className="text-muted-foreground">
              {account?.name} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        <NoScanState
          accountId={accountId!}
          isScanning={true}
        />
      </div>
    );
  }

  if (resources.length === 0 && hasCompletedScan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure Map</h1>
            <p className="text-muted-foreground">
              {account?.name} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        <div className="flex h-[calc(100vh-300px)] items-center justify-center rounded-lg border bg-muted/30">
          <div className="text-center">
            <Network className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No resources found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No resources were discovered in this account.
            </p>
          </div>
        </div>
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
        {/* Keyboard navigation handler */}
        <KeyboardControls />

        {/* Top Left Panel - Title and Filters */}
        <Panel position="top-left" className="flex items-center gap-2 flex-wrap">
          <div className="bg-card/95 backdrop-blur-sm border rounded-lg px-4 py-2">
            <h1 className="text-lg font-semibold">Infrastructure Map</h1>
            <p className="text-xs text-muted-foreground">
              {account?.name} &bull; {stats.totalNodes} resources • {stats.totalEdges} connections
            </p>
          </div>

          {/* Controls visibility toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleControls}
            className="h-7 w-7 p-0 bg-card/95 backdrop-blur-sm border rounded-lg"
            title={controlsVisible ? 'Hide toolbar' : 'Show toolbar'}
          >
            {controlsVisible ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {controlsVisible && (<>
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
              className="gap-1.5 h-7"
              title="Graph View - shows resources with connections"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Graph
            </Button>
            <Button
              variant={viewMode === 'network' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('network')}
              className="gap-1.5 h-7"
              title="Network View - shows VPC/Subnet hierarchy"
            >
              <Waypoints className="h-3.5 w-3.5" />
              Network
            </Button>
          </div>

          {/* Global Resources Toggle - only show in network view */}
          {viewMode === 'network' && (
            <Button
              variant={networkSettings.showGlobalResources ? 'outline' : 'secondary'}
              size="sm"
              onClick={toggleGlobalResources}
              className="gap-1.5"
              title={networkSettings.showGlobalResources ? 'Hide global resources (IAM, S3, etc.)' : 'Show global resources'}
            >
              {networkSettings.showGlobalResources ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide Global
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  Show Global
                </>
              )}
            </Button>
          )}

          {/* Layout Dropdown - only show in graph view */}
          {viewMode === 'graph' && (
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
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {viewMode === 'graph' && (
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
          )}
          </>)}
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
        {resourcesData?.truncated && (
          <Panel position="bottom-center">
            <div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2 text-xs text-yellow-800 dark:text-yellow-200">
              Showing first {resources.length} resources. Use filters to narrow results.
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Resource Preview Modal */}
      <ResourcePreviewModal
        resource={selectedResource}
        findings={findings}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
