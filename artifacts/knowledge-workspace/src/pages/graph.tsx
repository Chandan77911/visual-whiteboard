import { useGetGraph } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ZoomIn, ZoomOut, Maximize, Network } from "lucide-react";
import { Button } from "@/components/ui/button";

type NodePos = { x: number; y: number; vx: number; vy: number };

function computeForceLayout(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
  iterations = 200
): Record<string, { x: number; y: number }> {
  const n = nodes.length;
  if (n === 0) return {};

  const pos: Record<string, NodePos> = {};
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = Math.max(120, n * 35);
    pos[node.id] = {
      x: Math.cos(angle) * r + (Math.random() - 0.5) * 20,
      y: Math.sin(angle) * r + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
    };
  });

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[nodes[i].id];
        const b = pos[nodes[j].id];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (4000 / (dist * dist)) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = pos[edge.source];
      const b = pos[edge.target];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = 180;
      const force = ((dist - ideal) / dist) * 0.3 * alpha;
      const fx = dx * force;
      const fy = dy * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Centre gravity
    for (const id of Object.keys(pos)) {
      pos[id].vx -= pos[id].x * 0.01 * alpha;
      pos[id].vy -= pos[id].y * 0.01 * alpha;
    }

    // Apply velocities with damping
    for (const id of Object.keys(pos)) {
      pos[id].x += pos[id].vx * 0.5;
      pos[id].y += pos[id].vy * 0.5;
      pos[id].vx *= 0.6;
      pos[id].vy *= 0.6;
    }
  }

  const result: Record<string, { x: number; y: number }> = {};
  for (const id of Object.keys(pos)) {
    result[id] = { x: pos[id].x, y: pos[id].y };
  }
  return result;
}

export default function GraphView() {
  const { data: graph, isLoading } = useGetGraph();
  const [, setLocation] = useLocation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [viewBox, setViewBox] = useState("-500 -400 1000 800");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Pan state
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;
    const computed = computeForceLayout(graph.nodes, graph.edges);
    setPositions(computed);
  }, [graph]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true;
    lastPan.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPan.current.x;
    const dy = e.clientY - lastPan.current.y;
    lastPan.current = { x: e.clientX, y: e.clientY };
    setViewBox((prev) => {
      const [x, y, w, h] = prev.split(" ").map(Number);
      const scaleX = w / (svgRef.current?.clientWidth || 1000);
      const scaleY = h / (svgRef.current?.clientHeight || 800);
      return `${x - dx * scaleX} ${y - dy * scaleY} ${w} ${h}`;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleZoomIn = () => {
    setViewBox((prev) => {
      const [x, y, w, h] = prev.split(" ").map(Number);
      return `${x + w * 0.1} ${y + h * 0.1} ${w * 0.8} ${h * 0.8}`;
    });
  };

  const handleZoomOut = () => {
    setViewBox((prev) => {
      const [x, y, w, h] = prev.split(" ").map(Number);
      return `${x - w * 0.125} ${y - h * 0.125} ${w * 1.25} ${h * 1.25}`;
    });
  };

  const handleReset = () => setViewBox("-500 -400 1000 800");

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((prev) => {
      const [x, y, w, h] = prev.split(" ").map(Number);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const nw = w * factor;
      const nh = h * factor;
      return `${cx - nw / 2} ${cy - nh / 2} ${nw} ${nh}`;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <Network className="w-16 h-16 opacity-20" />
        <p className="text-lg font-medium">No nodes to graph yet</p>
        <p className="text-sm">Create notes and link blocks between them to see your knowledge graph.</p>
      </div>
    );
  }

  const COLORS: Record<string, string> = {
    note: "hsl(var(--primary))",
  };

  const connectedEdges = (nodeId: string) =>
    graph.edges.filter((e) => e.source === nodeId || e.target === nodeId);

  return (
    <div className="relative h-full w-full bg-background overflow-hidden">
      <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur border border-border p-4 rounded-xl shadow-lg">
        <h1 className="text-lg font-bold tracking-tight mb-1">Knowledge Graph</h1>
        <p className="text-xs text-muted-foreground">
          {graph.nodes.length} notes · {graph.edges.length} connections
        </p>
        <p className="text-xs text-muted-foreground mt-1 opacity-70">Drag to pan · Scroll to zoom · Click node to open</p>
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" className="bg-card/80 backdrop-blur" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="bg-card/80 backdrop-blur" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="bg-card/80 backdrop-blur" onClick={handleReset}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {hoveredNode && (
        <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur border border-border px-4 py-2 rounded-lg text-sm">
          <p className="font-semibold">{graph.nodes.find((n) => n.id === hoveredNode)?.label}</p>
          <p className="text-xs text-muted-foreground">{connectedEdges(hoveredNode).length} connections</p>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid pattern */}
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.4" />
        </pattern>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)" />

        {/* Edges */}
        <g>
          {graph.edges.map((edge) => {
            const src = positions[edge.source];
            const tgt = positions[edge.target];
            if (!src || !tgt) return null;
            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <line
                key={edge.id}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={isHighlighted ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth={isHighlighted ? 2 : 1}
                opacity={isHighlighted ? 0.8 : 0.3}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {graph.nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const r = Math.max(18, (node.size ?? 1) * 8);
            const isHovered = hoveredNode === node.id;
            const connCount = connectedEdges(node.id).length;
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/notes/${node.id}`);
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {isHovered && (
                  <circle r={r + 8} fill="hsl(var(--primary))" opacity="0.15" />
                )}
                <circle
                  r={r}
                  fill={isHovered ? "hsl(var(--accent))" : "url(#nodeGrad)"}
                  stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                  strokeWidth="2"
                  filter={isHovered ? "url(#glow)" : undefined}
                />
                {connCount > 0 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ fontSize: "10px", fontWeight: "bold", fill: "white" }}
                  >
                    {connCount}
                  </text>
                )}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    fill: isHovered ? "hsl(var(--accent))" : "hsl(var(--foreground))",
                    paintOrder: "stroke",
                    stroke: "hsl(var(--background))",
                    strokeWidth: "3px",
                    strokeLinejoin: "round",
                  }}
                >
                  {node.label.length > 20 ? node.label.slice(0, 20) + "…" : node.label}
                </text>
                {node.tags && node.tags.length > 0 && (
                  <text
                    y={r + 28}
                    textAnchor="middle"
                    style={{ fontSize: "9px", fill: "hsl(var(--muted-foreground))" }}
                  >
                    {node.tags.slice(0, 2).join(" · ")}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
