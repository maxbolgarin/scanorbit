import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useAwsAccount, useScanHistory, useScanCompletionRefresh } from '@/hooks/use-aws-accounts';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { RefreshCw, Network, RotateCcw, Layout, Scan, Play, ArrowRight, Cloud } from 'lucide-react';
import type { Resource, ServiceType } from '@/types';
import type { MapFilters, ResourceNodeData, ResourceNode, LayoutPreset } from '@/types/graph';
import { ACTIVE_SCAN_STATUSES } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useTriggerScan } from '@/hooks/use-aws-accounts';

// Storage keys - per account
const getNodePositionsKey = (accountId: string) => `infrastructure-map:node-positions:${accountId}`;
const getLayoutPresetKey = (accountId: string) => `infrastructure-map:layout-preset:${accountId}`;

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

function applyPositionsToNodes<T extends Node>(nodes: T[], positions: NodePositions): T[] {
  return nodes.map((node) => {
    const savedPosition = positions[node.id];
    if (savedPosition) {
      return { ...node, position: savedPosition };
    }
    return node;
  });
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
};

export default function AccountInfrastructureMap() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  // Account-specific data
  const { data: account, isLoading: accountLoading } = useAwsAccount(accountId!);
  const { data: resourcesData, isLoading: resourcesLoading, refetch } = useAllResources({ awsAccountId: accountId });
  const { data: dependenciesData } = useAllDependencies();
  const { data: findingsData } = useFilteredFindings({ awsAccountId: accountId });
  const { data: scanHistory } = useScanHistory(accountId!);
  const triggerScan = useTriggerScan();

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
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Wrapper to save layout preset when changed
  const setLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutPresetState(preset);
    saveLayoutPreset(accountId!, preset);
  }, [accountId]);

  // Track saved positions - loaded once on mount
  const savedPositionsRef = useRef<NodePositions>(loadNodePositions(accountId!));
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
    saveNodePositions(accountId!, savedPositionsRef.current);
  }, [accountId]);

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

  const handleScan = async () => {
    if (!accountId) return;
    try {
      await triggerScan.mutateAsync(accountId);
      toast({
        title: "Scan started",
        description: "Your AWS account is being scanned.",
      });
    } catch {
      toast({
        title: "Scan failed",
        description: "Failed to start scan. Please try again.",
        type: "error",
      });
    }
  };

  const hasCompletedScan = scanHistory?.some(scan =>
    scan.status === "complete" || scan.status === "partial"
  );
  const hasScanInProgress = activeScans?.some(scan => scan.awsAccountId === accountId) ||
    scanHistory?.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  const baseUrl = `/accounts/${accountId}`;
  const isLoading = accountLoading || resourcesLoading;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Empty states
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
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Visualize your infrastructure</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Run a scan to discover your resources and visualize their relationships.
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={handleScan}
              disabled={triggerScan.isPending || hasScanInProgress}
            >
              <Play className="mr-2 h-5 w-5" />
              Start Scan
            </Button>
          </CardContent>
        </Card>
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
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Scanning your infrastructure...</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Resources will appear on the map once the scan completes.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-8"
              onClick={() => navigate(`${baseUrl}/scans`)}
            >
              View Scan Progress
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
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
        {/* Top Left Panel - Title and Filters */}
        <Panel position="top-left" className="flex items-center gap-2">
          <div className="bg-card/95 backdrop-blur-sm border rounded-lg px-4 py-2">
            <h1 className="text-lg font-semibold">Infrastructure Map</h1>
            <p className="text-xs text-muted-foreground">
              {account?.name} &bull; {stats.totalNodes} resources • {stats.totalEdges} connections
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
        findings={findings}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
