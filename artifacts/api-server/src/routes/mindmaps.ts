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
import { CreateMindMapBody } from "@workspace/api-zod";
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

type RichMindMapNode = {
  id: string;
  label: string;
  note?: string;
  position?: { x: number; y: number };
  collapsed?: boolean;
  type?: string;
  icon?: string;
  tags?: string[];
  relation?: string;
  children?: RichMindMapNode[];
};

function slugId(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return slug || fallback;
}

function normalizeNode(
  value: any,
  fallbackLabel: string,
  fallbackId = "root",
): RichMindMapNode {
  const label =
    typeof value?.label === "string" && value.label.trim()
      ? value.label.trim()
      : fallbackLabel;
  const id =
    typeof value?.id === "string" && value.id.trim()
      ? value.id.trim()
      : slugId(label, fallbackId);
  const children = Array.isArray(value?.children)
    ? value.children.map((child: any, index: number) =>
        normalizeNode(child, `Topic ${index + 1}`, `${id}-${index + 1}`),
      )
    : [];

  return {
    id,
    label,
    note:
      typeof value?.note === "string" ? value.note.slice(0, 800) : undefined,
    position:
      Number.isFinite(value?.position?.x) && Number.isFinite(value?.position?.y)
        ? { x: Number(value.position.x), y: Number(value.position.y) }
        : undefined,
    collapsed: typeof value?.collapsed === "boolean" ? value.collapsed : false,
    type: typeof value?.type === "string" ? value.type : undefined,
    icon: typeof value?.icon === "string" ? value.icon.slice(0, 4) : undefined,
    relation: typeof value?.relation === "string" ? value.relation : undefined,
    tags: Array.isArray(value?.tags)
      ? value.tags.filter((tag: any) => typeof tag === "string").slice(0, 6)
      : undefined,
    children,
  };
}

function ensureUniqueIds(
  node: RichMindMapNode,
  seen = new Set<string>(),
  prefix = "node",
): RichMindMapNode {
  const base = slugId(node.id || node.label, prefix);
  let id = base;
  let index = 2;
  while (seen.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  seen.add(id);

  return {
    ...node,
    id,
    children: (node.children ?? []).map((child, childIndex) =>
      ensureUniqueIds(child, seen, `${id}-${childIndex + 1}`),
    ),
  };
}

function parseRootNode(raw: unknown, fallbackLabel: string): RichMindMapNode {
  const parsed = typeof raw === "string" ? safeJsonParse(raw) : raw;
  const candidate =
    (parsed as any)?.rootNode ??
    (parsed as any)?.mindMap ??
    (parsed as any)?.map ??
    parsed;
  return ensureUniqueIds(normalizeNode(candidate, fallbackLabel));
}

function branch(
  id: string,
  label: string,
  note: string,
  children: Array<[string, string, string]>,
): RichMindMapNode {
  return {
    id,
    label,
    note,
    type: "branch",
    tags: [label],
    children: children.map(([childId, childLabel, childNote]) => ({
      id: childId,
      label: childLabel,
      note: childNote,
      type: "concept",
      children: [],
    })),
  };
}

function fallbackMindMap(note: any, blocks: any[]): RichMindMapNode {
  const topic = note.title || "Study Topic";
  const text = summarizeBlocks(blocks);
  const concepts = text
    .split(/[\n.;:]+/)
    .map((part) => part.replace(/^\d+\.\s*\w+\s+block:\s*/i, "").trim())
    .filter((part) => part.length > 6 && !part.startsWith("data:image/"))
    .slice(0, 6);

  const conceptChildren =
    concepts.length > 0
      ? concepts.map(
          (concept, index) =>
            [`concept-${index + 1}`, concept.slice(0, 52), concept] as [
              string,
              string,
              string,
            ],
        )
      : ([
          ["definition", "Definition", `Core meaning and purpose of ${topic}.`],
          [
            "terminology",
            "Important Terms",
            "Keywords, symbols, and short forms to remember.",
          ],
          [
            "rules",
            "Rules and Constraints",
            "Conditions, limits, and exceptions.",
          ],
        ] as Array<[string, string, string]>);

  return {
    id: "root",
    label: topic,
    note: `AI-ready study map for ${topic}. Add note blocks or images for more precise branches.`,
    type: "root",
    tags: [topic],
    children: [
      branch("overview", "Overview", `High-level mental model for ${topic}.`, [
        [
          "why-it-matters",
          "Why It Matters",
          "Purpose, motivation, and where it is used.",
        ],
        ["big-picture", "Big Picture", "How the main ideas fit together."],
        [
          "prerequisites",
          "Prerequisites",
          "Foundational ideas needed before studying this topic.",
        ],
      ]),
      branch(
        "core-concepts",
        "Core Concepts",
        "Most important concepts to master first.",
        conceptChildren,
      ),
      branch(
        "how-it-works",
        "How It Works",
        `Process or mechanism behind ${topic}.`,
        [
          [
            "steps",
            "Step-by-step Flow",
            "Sequential process from input to output.",
          ],
          ["components", "Components", "Parts involved and their roles."],
          ["edge-cases", "Edge Cases", "Common tricky cases and limitations."],
        ],
      ),
      branch(
        "examples",
        "Examples",
        "Concrete examples that make the idea memorable.",
        [
          [
            "simple-example",
            "Simple Example",
            "A minimal example to explain the topic.",
          ],
          [
            "real-world-use",
            "Real-world Use",
            "Where this appears in practice.",
          ],
          ["common-mistake", "Common Mistake", "A misconception to avoid."],
        ],
      ),
      branch(
        "applications",
        "Applications",
        "How the topic is applied in exams, projects, or systems.",
        [
          [
            "exam-angle",
            "Exam Angle",
            "Typical question patterns and scoring points.",
          ],
          [
            "project-angle",
            "Project Angle",
            "How this can be used in real implementations.",
          ],
          [
            "interview-angle",
            "Interview Angle",
            "Questions an interviewer may ask.",
          ],
        ],
      ),
      branch(
        "review-plan",
        "Review Plan",
        "Turn this map into active recall material.",
        [
          [
            "flashcards",
            "Flashcards",
            "Create basic, reverse, fill-blank, and MCQ cards.",
          ],
          [
            "weak-areas",
            "Weak Areas",
            "Track branches that need more revision.",
          ],
          [
            "next-steps",
            "Next Steps",
            "Expand branches with examples and practice questions.",
          ],
        ],
      ),
    ],
  };
}

function countNodes(node: RichMindMapNode): number {
  return (
    1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0)
  );
}

function ensureUsefulMindMap(
  root: RichMindMapNode,
  note: any,
  blocks: any[],
): RichMindMapNode {
  const mainBranches = root.children ?? [];
  const hasExpandableBranches =
    mainBranches.length >= 4 &&
    mainBranches.every((branch) => (branch.children?.length ?? 0) >= 2);

  if (countNodes(root) >= 12 && hasExpandableBranches) return root;
  return fallbackMindMap(note, blocks);
}

function findNode(
  root: RichMindMapNode,
  nodeId: string,
): RichMindMapNode | null {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function updateNodeById(
  root: RichMindMapNode,
  nodeId: string,
  updater: (node: RichMindMapNode) => RichMindMapNode,
): RichMindMapNode {
  if (root.id === nodeId) return updater(root);
  return {
    ...root,
    children: (root.children ?? []).map((child) =>
      updateNodeById(child, nodeId, updater),
    ),
  };
}

function normalizeGeneratedChildren(
  raw: unknown,
  fallbackLabel: string,
  parentId: string,
): RichMindMapNode[] {
  const parsed = typeof raw === "string" ? safeJsonParse(raw) : raw;
  const rawChildren =
    (parsed as any)?.children ??
    (parsed as any)?.nodes ??
    (parsed as any)?.cards ??
    (Array.isArray(parsed) ? parsed : undefined);

  if (Array.isArray(rawChildren)) {
    return rawChildren
      .map((child, index) =>
        normalizeNode(
          child,
          `${fallbackLabel} ${index + 1}`,
          `${parentId}-${index + 1}`,
        ),
      )
      .slice(0, 8);
  }

  const root = parseRootNode(parsed, fallbackLabel);
  return (root.children ?? []).slice(0, 8);
}

function fallbackExpandChildren(
  target: RichMindMapNode,
  blocks: any[],
): RichMindMapNode[] {
  const source = blocks
    .map((block: any) => getBlockText(block))
    .join("\n")
    .toLowerCase();
  const label = target.label;
  const base = slugId(label, target.id);

  const children: RichMindMapNode[] = [
    {
      id: `${base}-definition`,
      label: "Definition",
      note: `${label} means the core concept, term, or topic represented by this branch.`,
      type: "concept",
      children: [],
    },
    {
      id: `${base}-purpose`,
      label: "Purpose",
      note: `This explains why ${label} matters and where it is used.`,
      type: "concept",
      children: [],
    },
    {
      id: `${base}-example`,
      label: "Example",
      note: `Add a concrete example that makes ${label} easier to remember.`,
      type: "example",
      children: [],
    },
    {
      id: `${base}-revision`,
      label: "Revision Points",
      note: `Important points, formulas, or questions to revise for ${label}.`,
      type: "review",
      children: [],
    },
  ];

  if (/\bcoa\b|computer organization|computer architecture/.test(source)) {
    children.push(
      {
        id: `${base}-cpu-memory`,
        label: "CPU and Memory",
        note: "How the processor communicates with memory to fetch instructions and operands.",
        type: "concept",
        children: [],
      },
      {
        id: `${base}-addressing`,
        label: "Addressing",
        note: "How instructions specify the location of data using direct, indirect, register, or indexed addressing.",
        type: "concept",
        children: [],
      },
    );
  }

  return children;
}

function mergeChildren(
  existing: RichMindMapNode[] = [],
  generated: RichMindMapNode[],
): RichMindMapNode[] {
  const merged = [...existing];
  generated.forEach((child) => {
    if (
      merged.some(
        (item) => item.label.toLowerCase() === child.label.toLowerCase(),
      )
    ) {
      return;
    }
    merged.push(child);
  });
  return merged.slice(0, 12);
}

function fmtMindMap(doc: any, fallbackTitle?: string) {
  return {
    id: doc.$id,
    title: doc.title,
    noteId: doc.noteId ?? null,
    rootNode: parseRootNode(doc.rootNode, fallbackTitle ?? doc.title),
    createdAt: toISO(doc.$createdAt),
  };
}

// GET /mindmaps
router.get("/", async (req, res) => {
  try {
    const docs = await listDocs(COLLECTIONS.mindMaps);
    res.json(docs.map((m: any) => fmtMindMap(m)));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /mindmaps
router.post("/", async (req, res) => {
  try {
    const body = CreateMindMapBody.safeParse(req.body);
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

    let rootNode: RichMindMapNode = fallbackMindMap(note, blocks as any[]);
    const prompt = `Create a production-quality study mind map for a whiteboard + note-taking app.

Topic/title: ${note.title}
Available note content, OCR, voice transcript, image/chart notes:
${content || note.summary || "No detailed blocks yet. Use your domain knowledge for this topic and make the map useful for learning."}

Requirements:
- Generate a deep hierarchical concept map, not a short summary.
- Use 6 to 8 main branches.
- Every main branch must have 3 to 5 children. Do not return empty main branches.
- Add 1 to 3 grandchildren under important children so branches can be expanded.
- Summarize every note block individually and convert the important facts into nodes.
- Include branches like Overview, Core Concepts, How It Works, Examples, Applications, Common Mistakes, Interview/Exam Questions, and Review Plan when relevant.
- If the note is sparse, infer helpful educational branches from the title.
- If images/charts are attached, read visible labels, values, trends, and relationships.
- Keep node labels short, but add a useful note for every node.
- Return JSON only, no markdown.

JSON shape:
{
  "id": "root",
  "label": "Main Topic",
  "note": "one sentence summary",
  "type": "root",
  "tags": ["tag"],
  "children": [
    {
      "id": "overview",
      "label": "Overview",
      "note": "what this branch covers",
      "type": "branch",
      "tags": ["overview"],
      "children": [
        { "id": "definition", "label": "Definition", "note": "short explanation", "type": "concept", "children": [] }
      ]
    }
  ]
}`;

    if (hasGeminiKey()) {
      try {
        rootNode = parseRootNode(
          await generateGeminiJson(prompt, blocks as any[], { maxImages: 6 }),
          note.title,
        );
        rootNode = ensureUsefulMindMap(rootNode, note, blocks as any[]);
      } catch (err) {
        console.error("[MindMaps] Gemini generation failed:", err);
        rootNode = fallbackMindMap(note, blocks as any[]);
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
          rootNode = parseRootNode(
            response.choices[0]?.message?.content,
            note.title,
          );
          rootNode = ensureUsefulMindMap(rootNode, note, blocks as any[]);
        } catch (err) {
          console.error("[MindMaps] OpenAI generation failed:", err);
          rootNode = fallbackMindMap(note, blocks as any[]);
        }
      }
    }

    const doc = await createDoc(COLLECTIONS.mindMaps, {
      title: body.data.title ?? `${note.title} Mind Map`,
      noteId: body.data.noteId,
      rootNode: JSON.stringify(rootNode),
    });
    res.status(201).json(fmtMindMap(doc, note.title));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /mindmaps/:id
router.get("/:id", async (req, res) => {
  try {
    const doc = await getDoc(COLLECTIONS.mindMaps, req.params.id);
    res.json(fmtMindMap(doc));
  } catch (err: any) {
    if (err?.code === 404) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /mindmaps/:id
router.patch("/:id", async (req, res) => {
  try {
    const doc = await getDoc(COLLECTIONS.mindMaps, req.params.id);
    const updates: any = {};

    if (typeof req.body?.title === "string" && req.body.title.trim()) {
      updates.title = req.body.title.trim();
    }

    if (req.body?.rootNode != null) {
      const rootNode = parseRootNode(
        req.body.rootNode,
        updates.title ?? doc.title,
      );
      updates.rootNode = JSON.stringify(rootNode);
    }

    if (Object.keys(updates).length === 0) {
      res.json(fmtMindMap(doc));
      return;
    }

    const updated = await updateDoc(
      COLLECTIONS.mindMaps,
      req.params.id,
      updates,
    );
    res.json(fmtMindMap(updated));
  } catch (err: any) {
    if (err?.code === 404) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(500).json({ error: String(err) });
  }
});

// POST /mindmaps/:id/expand
router.post("/:id/expand", async (req, res) => {
  try {
    const doc = await getDoc(COLLECTIONS.mindMaps, req.params.id);
    const nodeId = String(req.body?.nodeId ?? "");
    const rootNode = parseRootNode(doc.rootNode, doc.title);
    const target = findNode(rootNode, nodeId);

    if (!target) {
      res.status(404).json({ error: "Node not found" });
      return;
    }

    const blocks = doc.noteId
      ? await listDocs(COLLECTIONS.blocks, [
          Query.equal("noteId", doc.noteId),
          Query.orderAsc("position"),
        ])
      : [];
    const content = summarizeBlocks(blocks as any[]);
    let children = fallbackExpandChildren(target, blocks as any[]);
    const prompt = `Expand one selected mind-map node into useful child nodes.

Full map title: ${doc.title}
Selected node: ${target.label}
Selected node note: ${target.note || "No note yet."}
Available note blocks:
${content || "No detailed blocks are available. Use general educational structure for this node."}

Requirements:
- Return 4 to 8 child nodes for the selected node.
- Each child must have a short label and a useful note.
- Add grandchildren where a child naturally has subtopics.
- Do not repeat existing children: ${(target.children ?? []).map((child) => child.label).join(", ") || "none"}.
- Return JSON only, no markdown.

JSON shape:
{
  "children": [
    {
      "id": "short-stable-id",
      "label": "Child Topic",
      "note": "short useful note",
      "type": "concept",
      "children": []
    }
  ]
}`;

    if (hasGeminiKey()) {
      try {
        children = normalizeGeneratedChildren(
          await generateGeminiJson(prompt, blocks as any[], { maxImages: 4 }),
          target.label,
          target.id,
        );
      } catch (err) {
        console.error("[MindMaps] Gemini node expansion failed:", err);
      }
    } else {
      const openai = getOptionalOpenAI();
      if (openai) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: buildUserContent(prompt, blocks as any[], 4) as any,
              },
            ],
            response_format: { type: "json_object" },
          });
          children = normalizeGeneratedChildren(
            response.choices[0]?.message?.content,
            target.label,
            target.id,
          );
        } catch (err) {
          console.error("[MindMaps] OpenAI node expansion failed:", err);
        }
      }
    }

    if (children.length === 0)
      children = fallbackExpandChildren(target, blocks as any[]);

    const expandedRoot = ensureUniqueIds(
      updateNodeById(rootNode, target.id, (node) => ({
        ...node,
        collapsed: false,
        children: mergeChildren(node.children, children),
      })),
    );
    const updated = await updateDoc(COLLECTIONS.mindMaps, req.params.id, {
      rootNode: JSON.stringify(expandedRoot),
    });

    res.json(fmtMindMap(updated));
  } catch (err: any) {
    if (err?.code === 404) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /mindmaps/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteDoc(COLLECTIONS.mindMaps, req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
