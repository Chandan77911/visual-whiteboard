import { useGetMindMap } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useCallback } from "react";

interface MindNode {
  id: string;
  label: string;
  children?: MindNode[];
}

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
  parentId?: string;
}

interface LayoutEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const DEPTH_COLORS = [
  "#8b5cf6", // violet - root
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
];

const BOX_W = 150;
const BOX_H = 36;
const COL_GAP = 200;
const ROW_GAP = 52;

function computeLayout(root: MindNode): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const parentCoords: Record<string, { x: number; y: number }> = {};

  // First pass: count leaves for each subtree
  function countLeaves(node: MindNode): number {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce((acc, c) => acc + countLeaves(c), 0);
  }

  // Second pass: assign y positions
  let leafY = 0;

  function assignPositions(node: MindNode, depth: number, parentId?: string) {
    const leaves = countLeaves(node);
    const x = depth * (BOX_W + COL_GAP);

    let y: number;
    if (!node.children || node.children.length === 0) {
      y = leafY * ROW_GAP;
      leafY++;
    } else {
      // Process children first
      const childStartLeaf = leafY;
      node.children.forEach((child) => assignPositions(child, depth + 1, node.id));
      // Center over children
      const childEndLeaf = leafY;
      y = ((childStartLeaf + childEndLeaf - 1) / 2) * ROW_GAP;
    }

    nodes.push({ id: node.id, label: node.label, x, y, depth, parentId });
    parentCoords[node.id] = { x, y };

    // Add edge to parent
    if (parentId && parentCoords[parentId]) {
      const px = parentCoords[parentId].x;
      const py = parentCoords[parentId].y;
      edges.push({
        id: `${parentId}-${node.id}`,
        x1: px + BOX_W,
        y1: py,
        x2: x,
        y2: y,
      });
    }
  }

  // We need a two-pass approach: children first then parent y-coord
  // Let's use a different strategy: build layout recursively returning the y range

  nodes.length = 0;
  edges.length = 0;
  leafY = 0;

  function layout(node: MindNode, depth: number, parentId?: string): number {
    const x = depth * (BOX_W + COL_GAP);

    if (!node.children || node.children.length === 0) {
      const y = leafY * ROW_GAP;
      leafY++;
      nodes.push({ id: node.id, label: node.label, x, y, depth, parentId });
      if (parentId) {
        const p = nodes.find((n) => n.id === parentId);
        if (p) {
          edges.push({ id: `${parentId}-${node.id}`, x1: p.x + BOX_W, y1: p.y, x2: x, y2: y });
        }
      }
      return y;
    }

    // Process children, collecting their y positions
    const childYs: number[] = [];
    node.children.forEach((child) => {
      childYs.push(layout(child, depth + 1, node.id));
    });

    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    nodes.push({ id: node.id, label: node.label, x, y, depth, parentId });

    if (parentId) {
      const p = nodes.find((n) => n.id === parentId);
      if (p) {
        edges.push({ id: `${parentId}-${node.id}`, x1: p.x + BOX_W, y1: p.y, x2: x, y2: y });
      }
    }

    // Fix edges that were added before parent position was known
    for (const child of node.children) {
      const edge = edges.find((e) => e.id === `${node.id}-${child.id}`);
      if (edge) {
        edge.x1 = x + BOX_W;
        edge.y1 = y;
      }
    }

    return y;
  }

  layout(root, 0);

  return { nodes, edges };
}

export default function MindMapDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading } = useGetMindMap(id!, {
    query: { enabled: !!id, queryKey: ["/api/mindmaps", id] },
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

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
      if (!prev) return prev;
      const [x, y, w, h] = prev.split(" ").map(Number);
      const scaleX = w / (svgRef.current?.clientWidth || 1000);
      const scaleY = h / (svgRef.current?.clientHeight || 800);
      return `${x - dx * scaleX} ${y - dy * scaleY} ${w} ${h}`;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((prev) => {
      if (!prev) return prev;
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

  if (!map) return <div className="p-8 text-muted-foreground">Mind Map not found.</div>;

  const { nodes, edges } = computeLayout(map.rootNode as MindNode);

  const minX = Math.min(...nodes.map((n) => n.x)) - 40;
  const minY = Math.min(...nodes.map((n) => n.y)) - BOX_H;
  const maxX = Math.max(...nodes.map((n) => n.x)) + BOX_W + 40;
  const maxY = Math.max(...nodes.map((n) => n.y)) + BOX_H;
  const defaultVB = `${minX} ${minY} ${maxX - minX} ${maxY - minY + BOX_H}`;
  const currentVB = viewBox ?? defaultVB;

  const handleZoomIn = () => {
    const [x, y, w, h] = currentVB.split(" ").map(Number);
    setViewBox(`${x + w * 0.1} ${y + h * 0.1} ${w * 0.8} ${h * 0.8}`);
  };
  const handleZoomOut = () => {
    const [x, y, w, h] = currentVB.split(" ").map(Number);
    setViewBox(`${x - w * 0.125} ${y - h * 0.125} ${w * 1.25} ${h * 1.25}`);
  };
  const handleReset = () => setViewBox(defaultVB);

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Top bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <Link href="/mindmaps">
          <Button variant="outline" size="sm" className="bg-card/80 backdrop-blur">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </Link>
        <div className="bg-card/90 backdrop-blur border border-border px-4 py-2 rounded-xl shadow-sm">
          <h1 className="font-bold text-sm">{map.title}</h1>
          <p className="text-[10px] text-muted-foreground">{nodes.length} concepts</p>
        </div>
      </div>

      {/* Zoom controls */}
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

      <svg
        ref={svgRef}
        viewBox={currentVB}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Background grid */}
        <pattern id="mm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.4" />
        </pattern>
        <rect x={minX - 500} y={minY - 500} width={maxX - minX + 1000} height={maxY - minY + 1000} fill="url(#mm-grid)" />

        {/* Edges - bezier curves */}
        <g>
          {edges.map((edge) => {
            const mx = (edge.x1 + edge.x2) / 2;
            return (
              <path
                key={edge.id}
                d={`M ${edge.x1} ${edge.y1} C ${mx} ${edge.y1}, ${mx} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="2"
                opacity="0.6"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node) => {
            const color = DEPTH_COLORS[Math.min(node.depth, DEPTH_COLORS.length - 1)];
            const isHovered = hoveredId === node.id;
            const isRoot = node.depth === 0;
            const boxH = isRoot ? BOX_H + 8 : BOX_H;
            const boxW = isRoot ? BOX_W + 20 : BOX_W;
            const rx = isRoot ? node.x - 10 : node.x;
            const ry = isRoot ? node.y - boxH / 2 - 4 : node.y - boxH / 2;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "default" }}
              >
                {/* Shadow */}
                {isHovered && (
                  <rect
                    x={rx - 2}
                    y={ry - 2}
                    width={boxW + 4}
                    height={boxH + 4}
                    rx="10"
                    fill={color}
                    opacity="0.2"
                  />
                )}
                {/* Box */}
                <rect
                  x={rx}
                  y={ry}
                  width={boxW}
                  height={boxH}
                  rx="8"
                  fill={isRoot ? color : isHovered ? color + "33" : "hsl(var(--card))"}
                  stroke={color}
                  strokeWidth={isRoot ? 0 : isHovered ? 2 : 1.5}
                  opacity={isHovered ? 1 : 0.9}
                />
                {/* Label */}
                <text
                  x={rx + boxW / 2}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontSize: isRoot ? "13px" : "11px",
                    fontWeight: isRoot ? "700" : "600",
                    fill: isRoot ? "#fff" : isHovered ? color : "hsl(var(--foreground))",
                    fontFamily: "inherit",
                  }}
                >
                  {node.label.length > 18 ? node.label.slice(0, 18) + "…" : node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
