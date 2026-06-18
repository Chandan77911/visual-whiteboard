import { Router } from "express";
import { listDocs, COLLECTIONS, toISO, Query } from "@workspace/appwrite";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [notes, blocks, decks, maps] = await Promise.all([
      listDocs(COLLECTIONS.notes),
      listDocs(COLLECTIONS.blocks),
      listDocs(COLLECTIONS.flashcardDecks),
      listDocs(COLLECTIONS.mindMaps),
    ]);

    const countMap: Record<string, number> = {};
    const blocksByType: Record<string, number> = {};
    blocks.forEach((b: any) => {
      if (b.noteId) countMap[b.noteId] = (countMap[b.noteId] ?? 0) + 1;
      blocksByType[b.type] = (blocksByType[b.type] ?? 0) + 1;
    });

    const recentNotes = [...notes]
      .sort((a: any, b: any) => toISO(b.updatedAt ?? b.$updatedAt).localeCompare(toISO(a.updatedAt ?? a.$updatedAt)))
      .slice(0, 5)
      .map((n: any) => ({
        id: n.$id, title: n.title, summary: n.summary ?? null, tags: n.tags ?? [],
        blockCount: countMap[n.$id] ?? 0,
        createdAt: toISO(n.$createdAt), updatedAt: toISO(n.updatedAt ?? n.$updatedAt),
      }));

    res.json({ totalNotes: notes.length, totalBlocks: blocks.length, totalFlashcardDecks: decks.length, totalMindMaps: maps.length, recentNotes, blocksByType });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
