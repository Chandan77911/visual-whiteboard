import { Router } from "express";
import { createDoc, getDoc, deleteDoc, listDocs, COLLECTIONS, toISO } from "@workspace/appwrite";
import OpenAI from "openai";
import { CreateMindMapBody } from "@workspace/api-zod";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MindMapNode { id: string; label: string; children?: MindMapNode[]; }
const fmt = (node: MindMapNode): MindMapNode => ({ id: node.id, label: node.label, children: (node.children ?? []).map(fmt) });

// GET /mindmaps
router.get("/", async (req, res) => {
  try {
    const docs = await listDocs(COLLECTIONS.mindMaps);
    res.json(docs.map((m: any) => ({ id: m.$id, title: m.title, noteId: m.noteId ?? null, rootNode: fmt(JSON.parse(m.rootNode)), createdAt: toISO(m.$createdAt) })));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /mindmaps
router.post("/", async (req, res) => {
  try {
    const body = CreateMindMapBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

    const note = await getDoc(COLLECTIONS.notes, body.data.noteId).catch(() => null);
    if (!note) { res.status(404).json({ error: "Note not found" }); return; }

    const blocks = await listDocs(COLLECTIONS.mindMaps);
    const content = (await listDocs(COLLECTIONS.blocks)).filter((b: any) => b.noteId === body.data.noteId).map((b: any) => b.transcript ?? b.content).filter(Boolean).join("\n\n");

    let rootNode: MindMapNode;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 2048,
        messages: [{ role: "user", content: `Generate a mind map from:\n\nTitle: ${note.title}\nContent: ${content || note.summary || note.title}\n\nRespond with JSON: { "id": "root", "label": "Main Topic", "children": [{ "id": "n1", "label": "Subtopic", "children": [] }] }\n\nCreate 3-5 main branches each with 2-4 children. Keep labels short.` }],
        response_format: { type: "json_object" },
      });
      rootNode = JSON.parse(response.choices[0]?.message?.content ?? "{}") as MindMapNode;
    } catch {
      rootNode = { id: "root", label: note.title, children: [{ id: "n1", label: "Key Concepts", children: [] }, { id: "n2", label: "Main Ideas", children: [] }] };
    }

    const doc = await createDoc(COLLECTIONS.mindMaps, {
      title: body.data.title ?? `${note.title} Mind Map`,
      noteId: body.data.noteId,
      rootNode: JSON.stringify(rootNode),
    });
    res.status(201).json({ id: doc.$id, title: doc.title, noteId: doc.noteId ?? null, rootNode: fmt(rootNode), createdAt: toISO(doc.$createdAt) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /mindmaps/:id
router.get("/:id", async (req, res) => {
  try {
    const doc = await getDoc(COLLECTIONS.mindMaps, req.params.id);
    res.json({ id: doc.$id, title: doc.title, noteId: doc.noteId ?? null, rootNode: fmt(JSON.parse(doc.rootNode)), createdAt: toISO(doc.$createdAt) });
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /mindmaps/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteDoc(COLLECTIONS.mindMaps, req.params.id);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
