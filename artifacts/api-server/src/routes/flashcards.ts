import { Router } from "express";
import {
  createDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  listDocs,
  COLLECTIONS,
  Query,
  toISO,
} from "@workspace/appwrite";
import { CreateFlashcardDeckBody, ReviewCardBody } from "@workspace/api-zod";
import {
  buildUserContent,
  generateGeminiJson,
  getBlockText,
  getOptionalOpenAI,
  hasGeminiKey,
  safeJsonParse,
  summarizeBlocks,
} from "../lib/ai";

const router = Router();

type GeneratedQaCard = {
  front?: string;
  question?: string;
  topic?: string;
  back?: string;
  answer?: string;
};

type StudyBlock = {
  index: number;
  type: string;
  text: string;
};

const MIN_FLASHCARD_QUESTIONS = 8;
const MAX_FLASHCARD_QUESTIONS = 20;

const fmtCard = (c: any) => ({
  id: c.$id,
  deckId: c.deckId,
  front: c.front,
  back: c.back,
  interval: c.interval,
  easeFactor: c.easeFactor,
  dueAt: toISO(c.dueAt),
  reviewCount: c.reviewCount,
});

const byCreatedAt = (cards: any[]) =>
  [...cards].sort(
    (a, b) =>
      new Date(a.$createdAt ?? 0).getTime() -
      new Date(b.$createdAt ?? 0).getTime(),
  );

function cleanText(value = ""): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripCardPrefix(value = ""): string {
  return cleanText(value)
    .replace(/^\[[^\]]+\]\s*/i, "")
    .replace(/^(question|q|front|topic)\s*[:.-]\s*/i, "")
    .trim();
}

function shortText(value = "", max = 420): string {
  const clean = cleanText(value);
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max);
  const lastSentence = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
  );
  if (lastSentence > 120) return slice.slice(0, lastSentence + 1).trim();
  return `${slice.replace(/\s+\S*$/, "").trim()}...`;
}

function formatQuestion(value = "", topic = "this topic"): string {
  const clean = stripCardPrefix(value);
  const fallback = `What is ${topic}?`;
  if (!clean) return fallback;
  if (clean.endsWith("?")) return clean.slice(0, 4900);

  const bare = clean.replace(/[.!]+$/, "");
  if (/^(what|why|how|when|where|which|who)\b/i.test(bare)) {
    return `${bare}?`.slice(0, 4900);
  }
  if (/^(define|explain|describe|compare|list)\b/i.test(bare)) {
    return `${bare}?`.slice(0, 4900);
  }
  if (bare.split(/\s+/).length <= 8) {
    return `What is ${bare}?`.slice(0, 4900);
  }
  return `What is the key idea here: ${shortText(bare, 120)}?`.slice(0, 4900);
}

function formatAnswer(value = "", topic = "this topic"): string {
  const clean = cleanText(value)
    .replace(/^(answer|a|back)\s*[:.-]\s*/i, "")
    .trim();
  return (
    shortText(clean, 520) ||
    `Review the source note to recall the short answer for ${topic}.`
  ).slice(0, 4900);
}

function addCard(
  cards: { front: string; back: string }[],
  front: string,
  back: string,
  topic: string,
) {
  if (cards.length >= MAX_FLASHCARD_QUESTIONS) return;

  const card = {
    front: formatQuestion(front, topic),
    back: formatAnswer(back, topic),
  };
  const key = card.front.toLowerCase();
  if (
    !card.front ||
    !card.back ||
    cards.some((item) => item.front.toLowerCase() === key)
  ) {
    return;
  }
  cards.push(card);
}

function mergeCards(
  primary: { front: string; back: string }[],
  fallback: { front: string; back: string }[],
): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = [];
  [...primary, ...fallback].forEach((card) => {
    const front = cleanText(card.front);
    const back = cleanText(card.back);
    if (!front || !back) return;
    const key = front.toLowerCase();
    if (cards.some((item) => item.front.toLowerCase() === key)) return;
    cards.push({ front, back });
  });
  return cards.slice(0, MAX_FLASHCARD_QUESTIONS);
}

function isCoaContent(value: string): boolean {
  return /\bcoa\b|computer organization|computer architecture/i.test(value);
}

function isMemoryAddressingContent(value: string): boolean {
  return /memory address|memory addressing|addressing mode|operand address/i.test(
    value,
  );
}

function overviewAnswer(topic: string, note: any, content: string): string {
  const source = `${topic}\n${note.summary ?? ""}\n${content}`;
  if (isCoaContent(source) && isMemoryAddressingContent(source)) {
    return "COA stands for Computer Organization and Architecture. In this note, it focuses on how instructions use memory addresses so the CPU can find operands and execute operations.";
  }
  if (isCoaContent(source)) {
    return "COA stands for Computer Organization and Architecture. It explains how computer instructions, memory, CPU, and input/output systems are organized and work together.";
  }
  return (
    shortText(note.summary, 260) ||
    `${topic} is the main topic of this note. It covers the key meaning, purpose, and practical ideas needed for quick revision.`
  );
}

function extractFacts(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+|\n+|;+/)
    .map((part) =>
      part
        .replace(/^\d+\.\s*\w+\s+block:\s*/i, "")
        .replace(/^[-*]\s*/, "")
        .trim(),
    )
    .filter((part) => part.length > 18 && !part.startsWith("data:image/"))
    .slice(0, 30);
}

function studyBlocks(blocks: any[]): StudyBlock[] {
  return blocks
    .map((block, index) => ({
      index: index + 1,
      type: block.type || "text",
      text: cleanText(getBlockText(block)),
    }))
    .filter((block) => block.text && !block.text.startsWith("data:image/"));
}

function conceptFromFact(fact: string, topic: string): string {
  const text = fact
    .replace(/^image\/chart note:\s*/i, "")
    .replace(/^\d+\.\s*\w+\s+block:\s*/i, "")
    .trim();

  const acronym = text.match(/\b[A-Z][A-Z0-9]{1,6}\b/);
  if (acronym) return acronym[0];

  const definition = text.match(
    /^(.{3,80}?)\s+(?:is|are|means|refers to|stands for|describes|defines|contains|uses)\b/i,
  );
  if (definition) return shortText(definition[1], 60);

  const beforeColon = text.match(/^(.{3,70}?):/);
  if (beforeColon) return shortText(beforeColon[1], 60);

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "about",
    "when",
    "where",
    "which",
  ]);
  const words = text
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()))
    .slice(0, 5)
    .join(" ");

  return words || topic;
}

function questionFromFact(fact: string, topic: string, blockIndex: number) {
  if (/\bcoa\b\s+(?:stands for|means|is known as)/i.test(fact)) {
    return "What does COA stand for?";
  }
  if (isMemoryAddressingContent(fact)) {
    return "What is memory addressing in COA?";
  }

  const concept = conceptFromFact(fact, topic);
  if (concept.toLowerCase() === topic.toLowerCase()) {
    return `What is the key point of block ${blockIndex}?`;
  }
  return `What does block ${blockIndex} explain about ${concept}?`;
}

function fallbackCards(
  note: any,
  blocks: any[],
): { front: string; back: string }[] {
  const topic = note.title || "Study Topic";
  const text = summarizeBlocks(blocks);
  const source = `${topic}\n${note.summary ?? ""}\n${text}`;
  const blocksForStudy = studyBlocks(blocks);
  const facts = extractFacts([note.summary, text].filter(Boolean).join("\n"));

  const cards: { front: string; back: string }[] = [];
  addCard(cards, `What is ${topic}?`, overviewAnswer(topic, note, text), topic);

  if (isMemoryAddressingContent(source)) {
    addCard(
      cards,
      "What is memory addressing in COA?",
      "Memory addressing is the way a CPU identifies where data or instructions are stored in memory. It lets an instruction locate the operand it needs for execution.",
      topic,
    );
    addCard(
      cards,
      "Why are addressing modes important?",
      "Addressing modes tell the CPU how to find an operand, such as directly from an address, through a register, or by calculating an effective address.",
      topic,
    );
  }

  blocksForStudy.forEach((block) => {
    addCard(
      cards,
      `What is the main idea of block ${block.index}?`,
      shortText(block.text, 360),
      topic,
    );

    extractFacts(block.text)
      .slice(0, 3)
      .forEach((fact) => {
        addCard(
          cards,
          questionFromFact(fact, topic, block.index),
          shortText(fact, 320),
          topic,
        );
      });
  });

  facts.forEach((fact) => {
    addCard(
      cards,
      questionFromFact(fact, topic, 1),
      shortText(fact, 320),
      topic,
    );
  });

  while (cards.length < MIN_FLASHCARD_QUESTIONS) {
    const prompts = [
      {
        front: `Why is ${topic} important?`,
        back: `${topic} is important because it helps connect the definition, purpose, and practical use of the concept during revision.`,
      },
      {
        front: `What is the main purpose of ${topic}?`,
        back: `The main purpose is to explain the central idea clearly and show how it is used in related examples or problems.`,
      },
      {
        front: `How should you revise ${topic}?`,
        back: `Revise it by remembering the definition, one clear example, and the reason the concept matters.`,
      },
    ];
    const next = prompts[cards.length % prompts.length];
    if (cards.some((card) => card.front === next.front)) break;
    addCard(cards, next.front, next.back, topic);
  }

  return cards.slice(0, MAX_FLASHCARD_QUESTIONS);
}

function sanitizeCards(
  value: unknown,
  fallback: { front: string; back: string }[],
  topic = "this topic",
): { front: string; back: string }[] {
  const rawCards = Array.isArray(value)
    ? value
    : ((value as any)?.cards ??
      (value as any)?.flashcards ??
      (value as any)?.questions);
  if (!Array.isArray(rawCards)) return fallback;

  const cards = rawCards
    .map((card: GeneratedQaCard) => ({
      front: formatQuestion(card.front || card.question || card.topic, topic),
      back: formatAnswer(card.back || card.answer, topic),
    }))
    .filter((card) => card.front.trim() && card.back.trim());

  const merged = mergeCards(cards, fallback);
  return merged.length > 0 ? merged : fallback;
}

// GET /flashcards
router.get("/", async (req, res) => {
  try {
    const decks = await listDocs(COLLECTIONS.flashcardDecks);
    const now = new Date();
    const result = await Promise.all(
      decks.map(async (deck: any) => {
        const cards = await listDocs(COLLECTIONS.flashcards, [
          Query.equal("deckId", deck.$id),
        ]);
        const dueCount = cards.filter(
          (c: any) => c.reviewCount === 0 || new Date(toISO(c.dueAt)) <= now,
        ).length;
        return {
          id: deck.$id,
          title: deck.title,
          noteId: deck.noteId ?? null,
          cardCount: cards.length,
          dueCount,
          createdAt: toISO(deck.$createdAt),
        };
      }),
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /flashcards
router.post("/", async (req, res) => {
  try {
    const body = CreateFlashcardDeckBody.safeParse(req.body);
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

    const blocks = await listDocs(COLLECTIONS.blocks, [
      Query.equal("noteId", body.data.noteId),
      Query.orderAsc("position"),
    ]);
    const content = summarizeBlocks(blocks as any[]);
    const desiredQuestions = Math.min(
      MAX_FLASHCARD_QUESTIONS,
      Math.max(MIN_FLASHCARD_QUESTIONS, (blocks as any[]).length * 2 + 2),
    );

    const fallback = fallbackCards(note, blocks as any[]);
    let cards: { front: string; back: string }[] = fallback;
    const prompt = `Create simple flashcard slides for a whiteboard + note-taking study app.

Topic/title: ${note.title}
Available note content, OCR, voice transcript, image/chart notes:
${content || note.summary || "No detailed blocks yet. Use your domain knowledge for this topic and make the deck useful for learning."}

Requirements:
- First summarize every numbered block individually, then create question/answer slides from those block summaries.
- Generate about ${desiredQuestions} questions. Minimum ${MIN_FLASHCARD_QUESTIONS}, maximum ${MAX_FLASHCARD_QUESTIONS}. 20 questions means 40 study sides: question side, then answer side.
- Create at least 1 useful question from every text, voice, image, or chart block. If a block contains several facts, create 2 or 3 questions from that block.
- Each card front must be a direct question or clear topic prompt.
- Each card back must be a short, effective answer in 1 to 3 sentences, under 45 words when possible.
- Do not generate multiple choice, fill-in-the-blank, reverse cards, type labels, tags, difficulty labels, markdown, or tables.
- Use the note and blocks as the main source. If the source is sparse, infer basic educational facts from the title without inventing very specific unsupported details.
- If images/charts are attached, read visible labels, values, trends, and relationships and turn them into short Q/A cards.
- Order cards from overview to important details.
- Example style: front "What is COA?", back "COA stands for Computer Organization and Architecture. It explains how computer instructions, memory, CPU, and input/output systems are organized and work together."
- Return JSON only, no markdown.

JSON shape:
{
  "summary": "Short study summary of the full note",
  "blockSummaries": [
    { "block": 1, "summary": "Short summary of this block" }
  ],
  "cards": [
    {
      "front": "Question text",
      "back": "Short answer text"
    }
  ]
}`;

    if (hasGeminiKey()) {
      try {
        cards = sanitizeCards(
          await generateGeminiJson(prompt, blocks as any[], { maxImages: 6 }),
          fallback,
          note.title,
        );
      } catch (err) {
        console.error("[Flashcards] Gemini generation failed:", err);
        cards = fallback;
      }
    } else {
      const openai = getOptionalOpenAI();
      if (openai) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: buildUserContent(prompt, blocks as any[], 6) as any,
              },
            ],
            response_format: { type: "json_object" },
          });
          const parsed = safeJsonParse(response.choices[0]?.message?.content);
          cards = sanitizeCards(parsed, fallback, note.title);
        } catch (err) {
          console.error("[Flashcards] OpenAI generation failed:", err);
          cards = fallback;
        }
      }
    }

    const deck = await createDoc(COLLECTIONS.flashcardDecks, {
      title: body.data.title ?? `${note.title} Flashcards`,
      noteId: body.data.noteId,
    });
    const now = new Date().toISOString();
    const insertedCards: any[] = [];
    for (const c of cards) {
      insertedCards.push(
        await createDoc(COLLECTIONS.flashcards, {
          deckId: deck.$id,
          front: c.front,
          back: c.back,
          interval: 1,
          easeFactor: 2.5,
          dueAt: now,
          reviewCount: 0,
        }),
      );
    }

    res.status(201).json({
      id: deck.$id,
      title: deck.title,
      noteId: deck.noteId ?? null,
      cards: insertedCards.map(fmtCard),
      createdAt: toISO(deck.$createdAt),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /flashcards/:id
router.get("/:id", async (req, res) => {
  try {
    const deck = await getDoc(COLLECTIONS.flashcardDecks, req.params.id);
    const cards = await listDocs(COLLECTIONS.flashcards, [
      Query.equal("deckId", deck.$id),
    ]);
    res.json({
      id: deck.$id,
      title: deck.title,
      noteId: deck.noteId ?? null,
      cards: byCreatedAt(cards).map(fmtCard),
      createdAt: toISO(deck.$createdAt),
    });
  } catch (err: any) {
    if (err?.code === 404) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /flashcards/:id
router.delete("/:id", async (req, res) => {
  try {
    const cards = await listDocs(COLLECTIONS.flashcards, [
      Query.equal("deckId", req.params.id),
    ]);
    await Promise.all(
      cards.map((c: any) => deleteDoc(COLLECTIONS.flashcards, c.$id)),
    );
    await deleteDoc(COLLECTIONS.flashcardDecks, req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /flashcards/:id/review - SM-2
router.post("/:id/review", async (req, res) => {
  try {
    const body = ReviewCardBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const card = await getDoc(COLLECTIONS.flashcards, body.data.cardId).catch(
      () => null,
    );
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    const q = body.data.quality;
    let interval = Number(card.interval ?? 1);
    let easeFactor = Number(card.easeFactor ?? 2.5);
    if (q < 3) {
      interval = 1;
    } else {
      if (card.reviewCount === 0) interval = 1;
      else if (card.reviewCount === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
    }
    easeFactor = Math.max(
      1.3,
      easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02),
    );
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + interval);

    const updated = await updateDoc(COLLECTIONS.flashcards, card.$id, {
      interval,
      easeFactor,
      dueAt: dueAt.toISOString(),
      reviewCount: card.reviewCount + 1,
    });
    res.json(fmtCard(updated));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
