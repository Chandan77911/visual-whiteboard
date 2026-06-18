import { Router } from "express";
import { createDoc, getDoc, updateDoc, deleteDoc, listDocs, COLLECTIONS, Query, toISO } from "@workspace/appwrite";
import { CreateBlockBody, UpdateBlockBody, ListBlocksQueryParams, LinkBlocksBody } from "@workspace/api-zod";

const router = Router();

const fmt = (b: any) => ({
  id: b.$id, type: b.type, content: b.content,
  audioUrl: b.audioUrl ?? null, imageUrl: b.imageUrl ?? null,
  transcript: b.transcript ?? null, tags: b.tags ?? [],
  noteId: b.noteId ?? null, position: b.position ?? null,
  createdAt: toISO(b.$createdAt), updatedAt: toISO(b.$updatedAt),
});

// GET /blocks
router.get("/", async (req, res) => {
  try {
    const query = ListBlocksQueryParams.safeParse(req.query);
    const { noteId, type, search } = query.success ? query.data : {} as any;
    const queries: string[] = [];
    if (noteId) queries.push(Query.equal("noteId", noteId));
    if (type)   queries.push(Query.equal("type", type));
    let docs = await listDocs(COLLECTIONS.blocks, queries);
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter((b: any) => b.content.toLowerCase().includes(s) || (b.transcript ?? "").toLowerCase().includes(s));
    }
    res.json(docs.map(fmt));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /blocks
router.post("/", async (req, res) => {
  try {
    const body = CreateBlockBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }
    const doc = await createDoc(COLLECTIONS.blocks, {
      type: body.data.type, content: body.data.content,
      audioUrl: body.data.audioUrl ?? null, imageUrl: body.data.imageUrl ?? null,
      transcript: body.data.transcript ?? null, tags: body.data.tags ?? [],
      noteId: body.data.noteId ?? null, position: body.data.position ?? null,
    });
    res.status(201).json(fmt(doc));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /blocks/:id
router.get("/:id", async (req, res) => {
  try {
    const doc = await getDoc(COLLECTIONS.blocks, req.params.id);
    res.json(fmt(doc));
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /blocks/:id
router.patch("/:id", async (req, res) => {
  try {
    const body = UpdateBlockBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }
    const updates: any = {};
    if (body.data.content != null)    updates.content = body.data.content;
    if (body.data.tags != null)       updates.tags = body.data.tags;
    if (body.data.noteId != null)     updates.noteId = body.data.noteId;
    if (body.data.position != null)   updates.position = body.data.position;
    if (body.data.transcript != null) updates.transcript = body.data.transcript;
    const doc = await updateDoc(COLLECTIONS.blocks, req.params.id, updates);
    res.json(fmt(doc));
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /blocks/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteDoc(COLLECTIONS.blocks, req.params.id);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /blocks/:id/link
router.post("/:id/link", async (req, res) => {
  try {
    const body = LinkBlocksBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }
    const doc = await createDoc(COLLECTIONS.blockLinks, {
      sourceId: req.params.id, targetId: body.data.targetId, relation: body.data.relation,
    });
    res.json({ id: doc.$id, sourceId: doc.sourceId, targetId: doc.targetId, relation: doc.relation, createdAt: toISO(doc.$createdAt) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
