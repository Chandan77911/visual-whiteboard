import { Router } from "express";
import {
  listDocs,
  createDoc,
  updateDoc,
  getDoc,
  COLLECTIONS,
  Query,
  toISO,
} from "@workspace/appwrite";
import {
  SynthesizeNoteBody,
  TranscribeAudioBody,
  ChatWithNotesBody,
} from "@workspace/api-zod";
import {
  buildUserContent,
  generateGeminiJson,
  generateGeminiText,
  getOpenAI,
  hasGeminiKey,
  summarizeBlocks,
} from "../lib/ai";

const router = Router();

// POST /ai/synthesize
router.post("/synthesize", async (req, res) => {
  try {
    const body = SynthesizeNoteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const note = await getDoc(COLLECTIONS.notes, body.data.noteId).catch(
      () => null,
    );
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    const [blocks, allNotes] = await Promise.all([
      listDocs(COLLECTIONS.blocks, [Query.equal("noteId", body.data.noteId)]),
      listDocs(COLLECTIONS.notes),
    ]);

    const content = summarizeBlocks(blocks as any[]);
    const otherNotes = (allNotes as any[])
      .filter((n) => n.$id !== (note as any).$id)
      .map(
        (n) => `ID: ${n.$id} | Title: ${n.title} | Summary: ${n.summary ?? ""}`,
      )
      .join("\n");

    const prompt = `Analyze this note, including any attached image/chart blocks. If an image is a chart, diagram, table, or screenshot, read the visible labels, trends, values, relationships, and notable takeaways.

Title: ${(note as any).title}
Content:
${content || "(empty)"}

Other notes:
${otherNotes || "(none)"}

Respond with JSON:
{"summary":"...","actionItems":["..."],"suggestedLinks":[{"noteId":"...","noteTitle":"...","reason":"..."}],"keyThemes":["..."]}`;

    let parsed: any;
    if (hasGeminiKey()) {
      parsed = await generateGeminiJson(prompt, blocks as any[], {
        maxImages: 6,
      });
    } else {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: buildUserContent(prompt, blocks as any[], 6) as any,
          },
        ],
        response_format: { type: "json_object" },
      });
      parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    }

    const summary: string = parsed.summary ?? "";
    const keyThemes: string[] = parsed.keyThemes ?? [];
    const actionItems: string[] = parsed.actionItems ?? [];
    const suggestedLinks: any[] = parsed.suggestedLinks ?? [];

    await updateDoc(COLLECTIONS.notes, (note as any).$id, {
      summary,
      tags: keyThemes,
      updatedAt: new Date().toISOString(),
    });

    if (suggestedLinks.length > 0 && (blocks as any[]).length > 0) {
      const sourceBlock = (blocks as any[])[0];
      for (const link of suggestedLinks) {
        const targetExists = (allNotes as any[]).find(
          (n) => n.$id === link.noteId,
        );
        if (!targetExists) continue;
        const targetBlocks = await listDocs(COLLECTIONS.blocks, [
          Query.equal("noteId", link.noteId),
        ]);
        if ((targetBlocks as any[]).length === 0) continue;
        const targetBlock = (targetBlocks as any[])[0];
        const existing = await listDocs(COLLECTIONS.blockLinks, [
          Query.equal("sourceId", sourceBlock.$id),
          Query.equal("targetId", targetBlock.$id),
        ]);
        if ((existing as any[]).length === 0) {
          await createDoc(COLLECTIONS.blockLinks, {
            sourceId: sourceBlock.$id,
            targetId: targetBlock.$id,
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
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const openai = getOpenAI();
    const audioBuffer = Buffer.from(body.data.audioBase64, "base64");
    const blob = new Blob([audioBuffer], {
      type: body.data.mimeType ?? "audio/webm",
    });
    const file = new File([blob], "audio.webm", {
      type: body.data.mimeType ?? "audio/webm",
    });
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "json",
    });
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
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

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
      const allBlocks = (await listDocs(COLLECTIONS.blocks)) as any[];
      const words = body.data.question
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3);
      const wantsVisualContext = [
        "chart",
        "graph",
        "image",
        "screenshot",
        "diagram",
        "picture",
        "table",
        "plot",
        "read",
      ].some((word) => body.data.question.toLowerCase().includes(word));

      if (words.length > 0) {
        contextBlocks = allBlocks.filter((b) => {
          const text = (
            (b.transcript ?? "") +
            " " +
            (b.content ?? "")
          ).toLowerCase();
          return words.some((w: string) => text.includes(w));
        });
      }

      if (contextBlocks.length === 0) {
        contextBlocks = allBlocks.slice(-20);
      }

      if (wantsVisualContext) {
        const seen = new Set(contextBlocks.map((b) => b.$id));
        const imageBlocks = allBlocks
          .filter((b) => b.type === "image" && !seen.has(b.$id))
          .slice(-6);
        contextBlocks = [...contextBlocks, ...imageBlocks];
      }

      contextBlocks = contextBlocks.slice(0, 30);

      if (contextBlocks.length > 0) {
        const noteIds = [
          ...new Set(contextBlocks.map((b) => b.noteId).filter(Boolean)),
        ];
        if (noteIds.length > 0) {
          const allNotes = (await listDocs(COLLECTIONS.notes)) as any[];
          sources = allNotes
            .filter((n) => noteIds.includes(n.$id))
            .map((n) => n.title);
        }
      }
    }

    const context = summarizeBlocks(contextBlocks);
    const userPrompt = `Notes context:\n${context || "(no relevant notes found)"}\n\nQuestion: ${body.data.question}`;
    const systemInstruction =
      "You are an intelligent assistant helping users understand their personal notes. Answer based on the provided context. Be concise and helpful. If the answer is not in the notes, say so honestly.";

    let answer: string;
    if (hasGeminiKey()) {
      answer = await generateGeminiText(userPrompt, contextBlocks, {
        systemInstruction,
        maxImages: 6,
      });
    } else {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemInstruction },
          {
            role: "user",
            content: buildUserContent(userPrompt, contextBlocks, 6) as any,
          },
        ],
      });
      answer = response.choices[0]?.message?.content ?? "No answer generated.";
    }

    res.json({ answer: answer || "No answer generated.", sources });
  } catch (err: any) {
    req.log?.error({ err }, "Chat error");
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

export default router;
