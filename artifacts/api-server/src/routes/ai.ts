import { Router } from "express";
import { listDocs, createDoc, updateDoc, getDoc, COLLECTIONS, Query, toISO } from "@workspace/appwrite";
import OpenAI from "openai";
import { SynthesizeNoteBody, TranscribeAudioBody, ChatWithNotesBody } from "@workspace/api-zod";

const router = Router();

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error("OPENAI_API_KEY is not set in .env");
  }
  return new OpenAI({ apiKey: key.trim() });
}

// POST /ai/synthesize
router.post("/synthesize", async (req, res) => {
  try {
    const body = SynthesizeNoteBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

    const note = await getDoc(COLLECTIONS.notes, body.data.noteId).catch(() => null);
    if (!note) { res.status(404).json({ error: "Note not found" }); return; }

    const [blocks, allNotes] = await Promise.all([
      listDocs(COLLECTIONS.blocks, [Query.equal("noteId", body.data.noteId)]),
      listDocs(COLLECTIONS.notes),
    ]);

    const content = (blocks as any[]).map((b) => b.transcript ?? b.content).filter(Boolean).join("\n\n");
    const otherNotes = (allNotes as any[]).filter((n) => n.$id !== (note as any).$id)
      .map((n) => `ID: ${n.$id} | Title: ${n.title} | Summary: ${n.summary ?? ""}`)
      .join("\n");

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", max_tokens: 1024,
      messages: [{ role: "user", content: `Analyze this note.\n\nTitle: ${(note as any).title}\nContent:\n${content || "(empty)"}\n\nOther notes:\n${otherNotes || "(none)"}\n\nRespond with JSON:\n{"summary":"...","actionItems":["..."],"suggestedLinks":[{"noteId":"...","noteTitle":"...","reason":"..."}],"keyThemes":["..."]}` }],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    const summary: string = parsed.summary ?? "";
    const keyThemes: string[] = parsed.keyThemes ?? [];
    const actionItems: string[] = parsed.actionItems ?? [];
    const suggestedLinks: any[] = parsed.suggestedLinks ?? [];

    await updateDoc(COLLECTIONS.notes, (note as any).$id, { summary, tags: keyThemes, updatedAt: new Date().toISOString() });

    if (suggestedLinks.length > 0 && (blocks as any[]).length > 0) {
      const sourceBlock = (blocks as any[])[0];
      for (const link of suggestedLinks) {
        const targetExists = (allNotes as any[]).find((n) => n.$id === link.noteId);
        if (!targetExists) continue;
        const targetBlocks = await listDocs(COLLECTIONS.blocks, [Query.equal("noteId", link.noteId)]);
        if ((targetBlocks as any[]).length === 0) continue;
        const targetBlock = (targetBlocks as any[])[0];
        const existing = await listDocs(COLLECTIONS.blockLinks, [
          Query.equal("sourceId", sourceBlock.$id),
          Query.equal("targetId", targetBlock.$id),
        ]);
        if ((existing as any[]).length === 0) {
          await createDoc(COLLECTIONS.blockLinks, {
            sourceId: sourceBlock.$id, targetId: targetBlock.$id,
            relation: link.reason.slice(0, 100),
          });
        }
      }
    }

    res.json({ summary, actionItems, suggestedLinks, keyThemes });
  } catch (err: any) {
    req.log?.error({ err }, "Synthesize error");
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /ai/transcribe
router.post("/transcribe", async (req, res) => {
  try {
    const body = TranscribeAudioBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }
    const openai = getOpenAI();
    const audioBuffer = Buffer.from(body.data.audioBase64, "base64");
    const blob = new Blob([audioBuffer], { type: body.data.mimeType ?? "audio/webm" });
    const file = new File([blob], "audio.webm", { type: body.data.mimeType ?? "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({ model: "whisper-1", file, response_format: "json" });
    res.json({ transcript: transcription.text });
  } catch (err: any) {
    req.log?.error({ err }, "Transcribe error");
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /ai/chat
router.post("/chat", async (req, res) => {
  try {
    const body = ChatWithNotesBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

    const openai = getOpenAI();

    let contextBlocks: any[] = [];
    let sources: string[] = [];

    if (body.data.noteId) {
      const [noteBlocksRes, noteRes] = await Promise.all([
        listDocs(COLLECTIONS.blocks, [Query.equal("noteId", body.data.noteId)]),
        getDoc(COLLECTIONS.notes, body.data.noteId).catch(() => null),
      ]);
      contextBlocks = noteBlocksRes as any[];
      if (noteRes) sources = [(noteRes as any).title];
    } else {
      const allBlocks = await listDocs(COLLECTIONS.blocks) as any[];
      const words = body.data.question.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

      if (words.length > 0) {
        contextBlocks = allBlocks.filter((b) => {
          const text = ((b.transcript ?? "") + " " + (b.content ?? "")).toLowerCase();
          return words.some((w: string) => text.includes(w));
        });
      }

      // Fallback to recent blocks if no keyword match
      if (contextBlocks.length === 0) {
        contextBlocks = allBlocks.slice(-20);
      }

      // Limit to 30 blocks max
      contextBlocks = contextBlocks.slice(0, 30);

      if (contextBlocks.length > 0) {
        const noteIds = [...new Set(contextBlocks.map((b) => b.noteId).filter(Boolean))];
        if (noteIds.length > 0) {
          const allNotes = await listDocs(COLLECTIONS.notes) as any[];
          sources = allNotes
            .filter((n) => noteIds.includes(n.$id))
            .map((n) => n.title);
        }
      }
    }

    const context = contextBlocks
      .map((b) => b.transcript ?? b.content)
      .filter(Boolean)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "You are an intelligent assistant helping users understand their personal notes. Answer based on the provided context. Be concise and helpful. If the answer is not in the notes, say so honestly.",
        },
        {
          role: "user",
          content: `Notes context:\n${context || "(no relevant notes found)"}\n\nQuestion: ${body.data.question}`,
        },
      ],
    });

    res.json({
      answer: response.choices[0]?.message?.content ?? "No answer generated.",
      sources,
    });
  } catch (err: any) {
    req.log?.error({ err }, "Chat error");
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

export default router;
