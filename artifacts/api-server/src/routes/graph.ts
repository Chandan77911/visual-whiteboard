import { Router } from "express";
import { listDocs, COLLECTIONS, Query } from "@workspace/appwrite";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [notes, blocks, links] = await Promise.all([
      listDocs(COLLECTIONS.notes),
      listDocs(COLLECTIONS.blocks),
      listDocs(COLLECTIONS.blockLinks),
    ]);

    const countMap: Record<string, number> = {};
    blocks.forEach((b: any) => { if (b.noteId) countMap[b.noteId] = (countMap[b.noteId] ?? 0) + 1; });

    const nodes = notes.map((n: any) => ({
      id: n.$id, label: n.title, type: "note",
      size: Math.max(1, countMap[n.$id] ?? 1), tags: n.tags ?? [],
    }));

    const edges: any[] = [];
    const seen = new Set<string>();
    const blockNoteMap = new Map(blocks.map((b: any) => [b.$id, b.noteId]));

    // Edges from block links
    for (const link of links) {
      const src = blockNoteMap.get((link as any).sourceId);
      const tgt = blockNoteMap.get((link as any).targetId);
      if (src && tgt && src !== tgt) {
        const key = [src, tgt].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ id: (link as any).$id, source: src, target: tgt, relation: (link as any).relation });
        }
      }
    }

    // Auto-edges from shared tags
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i] as any;
        const b = notes[j] as any;
        const shared = (a.tags ?? []).filter((t: string) => (b.tags ?? []).includes(t));
        if (shared.length > 0) {
          const key = [a.$id, b.$id].sort().join("|");
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ id: `tag-${a.$id}-${b.$id}`, source: a.$id, target: b.$id, relation: `shared: ${shared.slice(0, 2).join(", ")}` });
          }
        }
      }
    }

    res.json({ nodes, edges });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
