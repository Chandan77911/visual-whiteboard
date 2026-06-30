import { useGetMindMap } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  GitBranch,
  Loader2,
  Maximize,
  Minus,
  Move,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";

interface MindNode {
  id: string;
  label: string;
  note?: string;
  type?: string;
  tags?: string[];
  position?: { x: number; y: number };
  collapsed?: boolean;
  children?: MindNode[];
}

interface FlatNode extends MindNode {
  depth: number;
  parentId?: string;
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  parent: FlatNode;
  child: FlatNode;
}

const NODE_W = 230;
const NODE_H = 76;
const COL_GAP = 190;
const ROW_GAP = 112;
const DEPTH_COLORS = [
  "#8b5cf6",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
];

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "node"
  );
}

function makeNodeId(label = "node") {
  return `${slug(label)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function cloneNode<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function assignMissingPositions(root: MindNode): MindNode {
  const next = cloneNode(root);
  let leaf = 0;

  function walk(node: MindNode, depth: number): number {
    const children = node.children ?? [];
    const childYs = children.map((child) => walk(child, depth + 1));
    const y =
      childYs.length > 0
        ? (childYs[0] + childYs[childYs.length - 1]) / 2
        : leaf++ * ROW_GAP;

    if (!node.position) {
      node.position = {
        x: depth * (NODE_W + COL_GAP),
        y,
      };
    }
    if (!Array.isArray(node.children)) node.children = [];
    return node.position.y;
  }

  walk(next, 0);
  return next;
}

function flattenVisible(root: MindNode) {
  const nodes: FlatNode[] = [];
  const edges: Edge[] = [];

  function visit(node: MindNode, depth: number, parent?: FlatNode) {
    const item: FlatNode = {
      ...node,
      depth,
      parentId: parent?.id,
      position: node.position ?? { x: 0, y: 0 },
      children: node.children ?? [],
    };
    nodes.push(item);
    if (parent)
      edges.push({ id: `${parent.id}-${item.id}`, parent, child: item });
    if (node.collapsed) return;
    (node.children ?? []).forEach((child) => visit(child, depth + 1, item));
  }

  visit(root, 0);
  return { nodes, edges };
}

function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function updateNode(
  root: MindNode,
  id: string,
  updater: (node: MindNode) => MindNode,
): MindNode {
  if (root.id === id) return updater(root);
  return {
    ...root,
    children: (root.children ?? []).map((child) =>
      updateNode(child, id, updater),
    ),
  };
}

function deleteNode(root: MindNode, id: string): MindNode {
  return {
    ...root,
    children: (root.children ?? [])
      .filter((child) => child.id !== id)
      .map((child) => deleteNode(child, id)),
  };
}

function countChildren(node?: MindNode | null) {
  return node?.children?.length ?? 0;
}

function toMarkdown(node: MindNode, depth = 0): string {
  const prefix = `${"  ".repeat(depth)}- ${node.label}`;
  const note = node.note ? `: ${node.note}` : "";
  const children = (node.children ?? [])
    .map((child) => toMarkdown(child, depth + 1))
    .join("\n");
  return `${prefix}${note}${children ? `\n${children}` : ""}`;
}

function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function MindMapDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading } = useGetMindMap(id!, {
    query: { enabled: !!id },
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const readyToSave = useRef(false);
  const loadedMapId = useRef<string | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);

  const [root, setRoot] = useState<MindNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pan, setPan] = useState({ x: 220, y: 230 });
  const [scale, setScale] = useState(0.9);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [isExpanding, setIsExpanding] = useState(false);

  useEffect(() => {
    if (!map || loadedMapId.current === map.id) return;
    const positioned = assignMissingPositions(
      (map.rootNode as MindNode) ?? {
        id: "root",
        label: map.title,
        note: "",
        children: [],
      },
    );
    readyToSave.current = false;
    loadedMapId.current = map.id;
    setRoot(positioned);
    setSelectedId(positioned.id);
    setPan({ x: 220, y: 230 });
    setScale(0.9);
    setSaveStatus("saved");
    window.setTimeout(() => {
      readyToSave.current = true;
    }, 0);
  }, [map]);

  const { nodes, edges } = useMemo(() => {
    if (!root) return { nodes: [] as FlatNode[], edges: [] as Edge[] };
    return flattenVisible(root);
  }, [root]);

  const selectedNode = root && selectedId ? findNode(root, selectedId) : root;
  const query = search.trim().toLowerCase();
  const matches = new Set(
    query
      ? nodes
          .filter((node) =>
            `${node.label} ${node.note ?? ""}`.toLowerCase().includes(query),
          )
          .map((node) => node.id)
      : [],
  );

  useEffect(() => {
    if (!root || !id || !readyToSave.current) return;
    setSaveStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/mindmaps/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootNode: root }),
        });
        if (!response.ok) throw new Error("Save failed");
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 650);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [root, id]);

  const mutateSelected = useCallback(
    (updater: (node: MindNode) => MindNode) => {
      if (!selectedId) return;
      setRoot((prev) => (prev ? updateNode(prev, selectedId, updater) : prev));
    },
    [selectedId],
  );

  const addChild = useCallback(
    (parentId?: string | null) => {
      const targetId = parentId ?? selectedId;
      if (!targetId) return;

      const childId = makeNodeId("new-node");
      setRoot((prev) => {
        if (!prev) return prev;
        const parent = findNode(prev, targetId);
        if (!parent) return prev;
        const childIndex = parent.children?.length ?? 0;
        const child: MindNode = {
          id: childId,
          label: "New Node",
          note: "",
          type: "node",
          position: {
            x: (parent.position?.x ?? 0) + NODE_W + COL_GAP,
            y: (parent.position?.y ?? 0) + childIndex * ROW_GAP - ROW_GAP / 2,
          },
          children: [],
        };
        return updateNode(prev, targetId, (node) => ({
          ...node,
          collapsed: false,
          children: [...(node.children ?? []), child],
        }));
      });
      setSelectedId(childId);
    },
    [selectedId],
  );

  const removeSelected = useCallback(() => {
    if (!root || !selectedNode || selectedNode.id === root.id) return;
    if (
      countChildren(selectedNode) > 0 &&
      !window.confirm("Delete this node and all of its children?")
    ) {
      return;
    }
    setRoot((prev) => (prev ? deleteNode(prev, selectedNode.id) : prev));
    setSelectedId(root.id);
  }, [root, selectedNode]);

  const toggleCollapse = useCallback(
    (nodeId?: string) => {
      const idToToggle = nodeId ?? selectedId;
      if (!idToToggle) return;
      setRoot((prev) =>
        prev
          ? updateNode(prev, idToToggle, (node) => ({
              ...node,
              collapsed: !node.collapsed,
            }))
          : prev,
      );
    },
    [selectedId],
  );

  const handleNodePointerDown = (
    node: FlatNode,
    e: PointerEvent<HTMLDivElement>,
  ) => {
    e.stopPropagation();
    setSelectedId(node.id);
    dragRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
  };

  const handlePanStart = (e: PointerEvent<HTMLDivElement>) => {
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      x: pan.x,
      y: pan.y,
    };
  };

  useEffect(() => {
    const handleMove = (e: globalThis.PointerEvent) => {
      if (dragRef.current) {
        const drag = dragRef.current;
        const dx = (e.clientX - drag.startX) / scale;
        const dy = (e.clientY - drag.startY) / scale;
        setRoot((prev) =>
          prev
            ? updateNode(prev, drag.id, (node) => ({
                ...node,
                position: { x: drag.nodeX + dx, y: drag.nodeY + dy },
              }))
            : prev,
        );
        return;
      }

      if (panRef.current) {
        const active = panRef.current;
        setPan({
          x: active.x + e.clientX - active.startX,
          y: active.y + e.clientY - active.startY,
        });
      }
    };

    const handleUp = () => {
      dragRef.current = null;
      panRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [scale]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nextScale = clamp(scale * (e.deltaY > 0 ? 0.9 : 1.1), 0.35, 2.1);
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasX = (mouseX - pan.x) / scale;
    const canvasY = (mouseY - pan.y) / scale;

    setScale(nextScale);
    setPan({
      x: mouseX - canvasX * nextScale,
      y: mouseY - canvasY * nextScale,
    });
  };

  const zoom = (factor: number) =>
    setScale((value) => clamp(value * factor, 0.35, 2.1));

  const resetView = () => {
    setPan({ x: 220, y: 230 });
    setScale(0.9);
  };

  const aiExpandSelected = async () => {
    if (!id || !selectedNode || isExpanding) return;
    setIsExpanding(true);
    try {
      const response = await fetch(`/api/mindmaps/${id}/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: selectedNode.id }),
      });
      if (!response.ok) throw new Error("Expansion failed");
      const updated = await response.json();
      readyToSave.current = false;
      setRoot(assignMissingPositions(updated.rootNode as MindNode));
      setSelectedId(selectedNode.id);
      window.setTimeout(() => {
        readyToSave.current = true;
      }, 0);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      setIsExpanding(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isEditing) return;

      if (event.key === "Tab") {
        event.preventDefault();
        addChild(selectedId);
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addChild, removeSelected, selectedId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!map || !root) {
    return <div className="p-8 text-muted-foreground">Mind Map not found.</div>;
  }

  const visibleNodeCount = nodes.length;
  const selectedChildren = countChildren(selectedNode);

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <div className="flex-1 relative min-w-0">
        <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between gap-4 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link href="/mindmaps">
              <Button variant="outline" size="sm" className="bg-card/95">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
            <div className="bg-card/95 backdrop-blur border border-border px-4 py-2 rounded-lg shadow-sm min-w-56">
              <h1 className="font-bold text-sm line-clamp-1">{map.title}</h1>
              <p className="text-[10px] text-muted-foreground">
                {visibleNodeCount} visible nodes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes"
                className="pl-9 bg-card/95"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="bg-card/95"
              onClick={() => zoom(1.15)}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-card/95"
              onClick={() => zoom(0.85)}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-card/95"
              onClick={resetView}
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
          onPointerDown={handlePanStart}
          onWheel={handleWheel}
        >
          <div
            className="absolute left-0 top-0 overflow-visible"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            <svg className="absolute left-0 top-0 overflow-visible pointer-events-none">
              <defs>
                <pattern
                  id="mindmap-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth="0.4"
                    opacity="0.55"
                  />
                </pattern>
              </defs>
              <rect
                x="-2000"
                y="-2000"
                width="7000"
                height="5000"
                fill="url(#mindmap-grid)"
              />
              {edges.map((edge) => {
                const x1 = edge.parent.position.x + NODE_W;
                const y1 = edge.parent.position.y + NODE_H / 2;
                const x2 = edge.child.position.x;
                const y2 = edge.child.position.y + NODE_H / 2;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth="2"
                    opacity="0.75"
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const color =
                DEPTH_COLORS[Math.min(node.depth, DEPTH_COLORS.length - 1)];
              const isSelected = selectedId === node.id;
              const isMatch = matches.has(node.id);
              const isMuted = query && !isMatch;
              const childCount = countChildren(node);

              return (
                <div
                  key={node.id}
                  className={`absolute rounded-lg border bg-card shadow-sm transition-shadow select-none ${
                    isSelected ? "ring-2 ring-primary shadow-lg" : ""
                  } ${isMatch ? "ring-2 ring-accent" : ""}`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: NODE_W,
                    height: NODE_H,
                    borderColor: color,
                    opacity: isMuted ? 0.25 : 1,
                  }}
                  onPointerDown={(e) => handleNodePointerDown(node, e)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const next = window.prompt("Rename node", node.label);
                    if (next?.trim()) {
                      setRoot((prev) =>
                        prev
                          ? updateNode(prev, node.id, (item) => ({
                              ...item,
                              label: next.trim(),
                            }))
                          : prev,
                      );
                    }
                  }}
                >
                  <div
                    className="h-full rounded-lg px-3 py-2 text-left overflow-hidden"
                    style={{
                      background:
                        node.depth === 0
                          ? `linear-gradient(135deg, ${color}, #6d28d9)`
                          : undefined,
                      color: node.depth === 0 ? "white" : undefined,
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Move className="w-3 h-3 opacity-60 shrink-0" />
                      <span className="text-[10px] uppercase opacity-70 truncate">
                        {node.type ?? (node.depth === 0 ? "root" : "node")}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        {childCount > 0 && (
                          <button
                            className="w-5 h-5 rounded bg-background/20 grid place-items-center hover:bg-background/30"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(node.id);
                            }}
                          >
                            {node.collapsed ? (
                              <ChevronRight className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        <button
                          className="w-5 h-5 rounded bg-background/20 grid place-items-center hover:bg-background/30"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            addChild(node.id);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="font-semibold text-sm leading-tight mt-1 line-clamp-2">
                      {node.label}
                    </div>
                    {childCount > 0 && (
                      <div className="text-[10px] opacity-65 mt-1">
                        {childCount} child{childCount === 1 ? "" : "ren"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="w-[360px] border-l border-border bg-card/95 flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Node Notes
              </p>
              <h2 className="font-bold leading-tight mt-1 line-clamp-1">
                {selectedNode?.label ?? "No node selected"}
              </h2>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {saveStatus === "saving" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {saveStatus === "saved" && (
                <Save className="w-3 h-3 text-chart-3" />
              )}
              {saveStatus === "error" && (
                <Minus className="w-3 h-3 text-destructive" />
              )}
              {saveStatus}
            </div>
          </div>
        </div>

        {selectedNode ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Title
              </label>
              <Input
                value={selectedNode.label}
                onChange={(e) =>
                  mutateSelected((node) => ({ ...node, label: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Notes
              </label>
              <Textarea
                value={selectedNode.note ?? ""}
                onChange={(e) =>
                  mutateSelected((node) => ({ ...node, note: e.target.value }))
                }
                placeholder="Write detailed notes for this node..."
                className="min-h-48 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => addChild(selectedNode.id)}
              >
                <Plus className="w-4 h-4" /> Child
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={selectedChildren === 0}
                onClick={() => toggleCollapse(selectedNode.id)}
              >
                {selectedNode.collapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {selectedNode.collapsed ? "Expand" : "Collapse"}
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={isExpanding}
              onClick={aiExpandSelected}
            >
              {isExpanding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI Expand Selected Node
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2 text-destructive hover:text-destructive"
              disabled={selectedNode.id === root.id}
              onClick={removeSelected}
            >
              <Trash2 className="w-4 h-4" /> Delete Node
            </Button>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <GitBranch className="w-4 h-4 text-primary" />
                Map Actions
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!root) return;
                    setRoot(
                      updateNode(
                        root,
                        root.id,
                        function expandAll(node): MindNode {
                          return {
                            ...node,
                            collapsed: false,
                            children: (node.children ?? []).map(expandAll),
                          };
                        },
                      ),
                    );
                  }}
                >
                  Expand All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      `${map.title}.json`,
                      JSON.stringify(root, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download className="w-3 h-3 mr-1" /> JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2"
                  onClick={() =>
                    downloadText(
                      `${map.title}.md`,
                      toMarkdown(root),
                      "text/markdown",
                    )
                  }
                >
                  <Download className="w-3 h-3 mr-1" /> Markdown
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed">
              Use Tab to add a child to the selected node. Drag nodes to arrange
              the map. Mouse wheel zooms, and dragging empty canvas pans.
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            Select a node.
          </div>
        )}
      </aside>
    </div>
  );
}
