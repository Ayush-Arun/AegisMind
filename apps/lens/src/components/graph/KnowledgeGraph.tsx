import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listGraphNodes, listGraphEdges, getGraphStats, type GraphNode, type GraphEdge } from "@/lib/api";
import {
  Network,
  RefreshCw,
  Users,
  FolderKanban,
  Lightbulb,
  GitBranch,
  CircleDot,
  ArrowRight,
} from "lucide-react";

const entityTypeIcons: Record<string, React.ReactNode> = {
  person: <Users className="h-4 w-4 text-blue-400" />,
  project: <FolderKanban className="h-4 w-4 text-emerald-400" />,
  concept: <Lightbulb className="h-4 w-4 text-amber-400" />,
  decision: <GitBranch className="h-4 w-4 text-purple-400" />,
  tool: <CircleDot className="h-4 w-4 text-sky-400" />,
};

const entityTypeColors: Record<string, string> = {
  person: "blue",
  project: "emerald",
  concept: "amber",
  decision: "purple",
  tool: "sky",
};

export function KnowledgeGraph() {
  const [nodes, setNodes] = React.useState<GraphNode[]>([]);
  const [edges, setEdges] = React.useState<GraphEdge[]>([]);
  const [stats, setStats] = React.useState<{ total_nodes: number; total_edges: number; node_types: Record<string, number> } | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [filterType, setFilterType] = React.useState<string>("all");

  const fetchGraph = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [nodeData, edgeData, statsData] = await Promise.all([
        listGraphNodes(),
        listGraphEdges(),
        getGraphStats(),
      ]);
      setNodes(nodeData.nodes || []);
      setEdges(edgeData.edges || []);
      setStats(statsData);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const filteredNodes = filterType === "all" ? nodes : nodes.filter(n => n.entity_type === filterType);
  const filteredEdges = edges.filter(e => filteredNodes.some(n => n.id === e.source) && filteredNodes.some(n => n.id === e.target));

  // Simple SVG-based graph visualization
  const svgWidth = 700;
  const svgHeight = 450;
  const nodePositions = React.useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const cols = Math.ceil(Math.sqrt(filteredNodes.length));
    filteredNodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[node.id] = { x: 80 + col * (svgWidth - 160) / Math.max(cols - 1, 1), y: 60 + row * (svgHeight - 120) / Math.max(Math.ceil(filteredNodes.length / cols) - 1, 1) };
    });
    return positions;
  }, [filteredNodes]);

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Network className="h-6 w-6 text-primary" />
              Knowledge Graph
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              Live
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Entity relationships between people, projects, concepts, and decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchGraph} disabled={isLoading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          <Card className="border-border/70 bg-card/40">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground">{stats.total_nodes}</div>
              <div className="text-[10px] text-muted-foreground">Total Nodes</div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/40">
            <CardContent className="p-3">
              <div className="text-2xl font-bold text-foreground">{stats.total_edges}</div>
              <div className="text-[10px] text-muted-foreground">Connections</div>
            </CardContent>
          </Card>
          {Object.entries(stats.node_types).map(([type, count]) => (
            <Card key={type} className="border-border/70 bg-card/40">
              <CardContent className="p-3">
                <div className="text-lg font-bold" style={{ color: `var(--color-${entityTypeColors[type] || "gray"}-400)` }}>{count}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{type}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-1.5">
        {["all", "person", "project", "concept", "decision"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilterType(type)}
            className={`text-[11px] px-3 py-1 rounded-full border capitalize transition-colors ${
              filterType === type ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {type === "all" ? "All" : type}
          </button>
        ))}
      </div>

      {/* Graph Visualization */}
      <div className="rounded-xl border border-border/80 bg-card/30 overflow-hidden">
        <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-background/20">
          {/* Edges */}
          {filteredEdges.map((edge, i) => {
            const src = nodePositions[edge.source];
            const tgt = nodePositions[edge.target];
            if (!src || !tgt) return null;
            return (
              <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="rgba(100,116,139,0.3)" strokeWidth="1" />
            );
          })}
          {/* Nodes */}
          {filteredNodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const isSelected = selectedNode?.id === node.id;
            return (
              <g key={node.id} onClick={() => setSelectedNode(node)} style={{ cursor: "pointer" }}>
                <circle cx={pos.x} cy={pos.y} r={isSelected ? 18 : 14} fill={isSelected ? "rgba(59,130,246,0.3)" : "rgba(30,41,59,0.8)"} stroke={isSelected ? "#3b82f6" : "rgba(100,116,139,0.5)"} strokeWidth="2" />
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{node.name.substring(0, 8)}</text>
                <text x={pos.x} y={pos.y + 26} textAnchor="middle" fill="#94a3b8" fontSize="7">{node.entity_type}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <Card className="border-border/70 bg-card/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {entityTypeIcons[selectedNode.entity_type] || <CircleDot className="h-5 w-5 text-primary" />}
                <div>
                  <h3 className="font-bold text-sm text-foreground">{selectedNode.name}</h3>
                  <Badge variant="outline" className="capitalize">{selectedNode.entity_type}</Badge>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedNode(null)} className="text-xs text-muted-foreground">✕</button>
            </div>
            <p className="text-xs text-muted-foreground">Created: {selectedNode.created_at}</p>
            {selectedNode.connections.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground mb-1">Connections ({selectedNode.connections.length}):</div>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.connections.map((connId, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{connId}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function useMemo<T>(factory: () => T, deps: any[]): T {
  return React.useMemo(factory, deps);
}
