import { Router } from "express";
import { createDoc, getDoc, updateDoc, deleteDoc, listDocs, COLLECTIONS, Query, toISO } from "@workspace/appwrite";
import OpenAI from "openai";
import { CreateFlashcardDeckBody, ReviewCardBody } from "@workspace/api-zod";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fmtCard = (c: any) => ({
  id: c.$id, deckId: c.deckId, front: c.front, back: c.back,
  interval: c.interval, easeFactor: c.easeFactor,
  dueAt: toISO(c.dueAt), reviewCount: c.reviewCount,
});

// GET /flashcards
router.get("/", async (req, res) => {
  try {
    const decks = await listDocs(COLLECTIONS.flashcardDecks);
    const now = new Date();
    const result = await Promise.all(decks.map(async (deck: any) => {
      const cards = await listDocs(COLLECTIONS.flashcards, [Query.equal("deckId", deck.$id)]);
      const dueCount = cards.filter((c: any) => c.reviewCount === 0 || new Date(toISO(c.dueAt)) <= now).length;
      return { id: deck.$id, title: deck.title, noteId: deck.noteId ?? null, cardCount: cards.length, dueCount, createdAt: toISO(deck.$createdAt) };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /flashcards
router.post("/", async (req, res) => {
  try {
    const body = CreateFlashcardDeckBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

    const note = await getDoc(COLLECTIONS.notes, body.data.noteId).catch(() => null);
    if (!note) { res.status(404).json({ error: "Note not found" }); return; }

    const blocks = await listDocs(COLLECTIONS.blocks, [Query.equal("noteId", body.data.noteId)]);
    const content = blocks.map((b: any) => b.transcript ?? b.content).filter(Boolean).join("\n\n");

    let cards: { front: string; back: string }[] = [];
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 2048,
        messages: [{ role: "user", content: `Generate 5-8 spaced repetition flashcards from:\n\n${content || note.title}\n\nRespond with JSON: { "cards": [{ "front": "Q", "back": "A" }] }` }],
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
      cards = Array.isArray(parsed) ? parsed : (parsed.cards ?? []);
    } catch {
      cards = [{ front: `What is "${note.title}" about?`, back: note.summary ?? note.title }];
    }

    const deck = await createDoc(COLLECTIONS.flashcardDecks, { title: body.data.title ?? `${note.title} Flashcards`, noteId: body.data.noteId });
    const now = new Date().toISOString();
    const insertedCards = await Promise.all(cards.map((c) =>
      createDoc(COLLECTIONS.flashcards, { deckId: deck.$id, front: c.front, back: c.back, interval: 1, easeFactor: 2.5, dueAt: now, reviewCount: 0 })
    ));

    res.status(201).json({ id: deck.$id, title: deck.title, noteId: deck.noteId ?? null, cards: insertedCards.map(fmtCard), createdAt: toISO(deck.$createdAt) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /flashcards/:id
router.get("/:id", async (req, res) => {
  try {
    const deck = await getDoc(COLLECTIONS.flashcardDecks, req.params.id);
    const cards = await listDocs(COLLECTIONS.flashcards, [Query.equal("deckId", deck.$id)]);
    res.json({ id: deck.$id, title: deck.title, noteId: deck.noteId ?? null, cards: cards.map(fmtCard), createdAt: toISO(deck.$createdAt) });
  } catch (err: any) {
    if (err?.code === 404) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /flashcards/:id
router.delete("/:id", async (req, res) => {
  try {
    const cards = await listDocs(COLLECTIONS.flashcards, [Query.equal("deckId", req.params.id)]);
    await Promise.all(cards.map((c: any) => deleteDoc(COLLECTIONS.flashcards, c.$id)));
    await deleteDoc(COLLECTIONS.flashcardDecks, req.params.id);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /flashcards/:id/review — SM-2
router.post("/:id/review", async (req, res) => {
  try {
    const body = ReviewCardBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

    const card = await getDoc(COLLECTIONS.flashcards, body.data.cardId).catch(() => null);
    if (!card) { res.status(404).json({ error: "Card not found" }); return; }

    const q = body.data.quality;
    let { interval, easeFactor } = card;
    if (q < 3) { interval = 1; }
    else {
      if (card.reviewCount === 0) interval = 1;
      else if (card.reviewCount === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
    }
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + interval);

    const updated = await updateDoc(COLLECTIONS.flashcards, card.$id, { interval, easeFactor, dueAt: dueAt.toISOString(), reviewCount: card.reviewCount + 1 });
    res.json(fmtCard(updated));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
