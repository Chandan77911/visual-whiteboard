import { Router } from "express";
import {
  createDoc, getDoc, updateDoc, deleteDoc, listDocs,
  COLLECTIONS, Query, toISO
} from "@workspace/appwrite";
import { CreateNoteBody, UpdateNoteBody, ListNotesQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /notes
router.get("/", async (req, res) => {
  try {
    const query = ListNotesQueryParams.safeParse(req.query);
    const { search, tag } = query.success ? query.data : {} as any;

    const queries: string[] = [];
    if (tag) queries.push(Query.search("tags", tag));

    let notes = await listDocs(COLLECTIONS.notes, queries);
    if (search) {
      const s = search.toLowerCase();
      notes = notes.filter((n: any) =>
        n.title.toLowerCase().includes(s) || (n.summary ?? "").toLowerCase().includes(s)
      );
    }

    const blocks = await listDocs(COLLECTIONS.blocks);
    const countMap: Record<string, number> = {};
    blocks.forEach((b: any) => { if (b.noteId) countMap[b.noteId] = (countMap[b.noteId] ?? 0) + 1; });

    notes.sort((a: any, b: any) => toISO(b.updatedAt).localeCompare(toISO(a.updatedAt)));

    res.json(notes.map((n: any) => ({
      id: n.$id, title: n.title, summary: n.summary ?? null,
      tags: n.tags ?? [], blockCount: countMap[n.$id] ?? 0,
      createdAt: toISO(n.$createdAt), updatedAt: toISO(n.updatedAt ?? n.$updatedAt),
    })));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /notes
router.post("/", async (req, res) => {
  try {
    const body = CreateNoteBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }
    const now = new Date().toISOString();
    const doc = await createDoc(COLLECTIONS.notes, {
      title: body.data.title,
      summary: body.data.summary ?? null,
      tags: body.data.tags ?? [],
      updatedAt: now,
    });
    res.status(201).json({ id: doc.$id, title: doc.title, summary: doc.summary ?? null, tags: doc.tags ?? [], blockCount: 0, createdAt: toISO(doc.$createdAt), updatedAt: toISO(doc.updatedAt) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /notes/:id
router.get("/:id", async (req, res) => {
  try {
    const note = await getDoc(COLLECTIONS.notes, req.params.id);
    const blocks = await listDocs(COLLECTIONS.blocks, [Query.equal("noteId", req.params.id), Query.orderAsc("position")]);
    res.json({
      id: note.$id, title: note.title, summary: note.summary ?? null, tags: note.tags ?? [],
      blocks: blocks.map((b: any) => ({
        id: b.$id, type: b.type, content: b.content,
        audioUrl: b.audioUrl ?? null, imageUrl: b.imageUrl ?? null,
        transcript: b.transcript ?? null, tags: b.tags ?? [],
        noteId: b.noteId ?? null, position: b.position ?? null,
        createdAt: toISO(b.$createdAt), updatedAt: toISO(b.$updatedAt),
      })),
      createdAt: toISO(note.$createdAt), updatedAt: toISO(note.updatedAt ?? note.$updatedAt),
    });
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /notes/:id
router.patch("/:id", async (req, res) => {
  try {
    const body = UpdateNoteBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }
    const updates: any = { updatedAt: new Date().toISOString() };
    if (body.data.title != null) updates.title = body.data.title;
    if (body.data.summary != null) updates.summary = body.data.summary;
    if (body.data.tags != null) updates.tags = body.data.tags;
    const doc = await updateDoc(COLLECTIONS.notes, req.params.id, updates);
    const blocks = await listDocs(COLLECTIONS.blocks, [Query.equal("noteId", req.params.id)]);
    res.json({ id: doc.$id, title: doc.title, summary: doc.summary ?? null, tags: doc.tags ?? [], blockCount: blocks.length, createdAt: toISO(doc.$createdAt), updatedAt: toISO(doc.updatedAt) });
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /notes/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteDoc(COLLECTIONS.notes, req.params.id);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
