import OpenAI from "openai";

type AppBlock = {
  type?: string;
  content?: string | null;
  transcript?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
};

type TextPart = { type: "text"; text: string };
type ImagePart = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};

export type UserContentPart = TextPart | ImagePart;
type JsonValue = Record<string, any> | any[];

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set in .env");
  return key;
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set in .env");
  return new OpenAI({ apiKey: key });
}

export function getOptionalOpenAI(): OpenAI | null {
  try {
    return getOpenAI();
  } catch {
    return null;
  }
}

function dataUrlToGeminiInlineData(url: string) {
  const match = /^data:(image\/[^;]+);base64,(.+)$/i.exec(url);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function geminiPartFromImageUrl(url: string) {
  const inlineData = dataUrlToGeminiInlineData(url);
  if (inlineData) return { inlineData };
  return { fileData: { fileUri: url } };
}

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function generateGeminiText(
  prompt: string,
  blocks: AppBlock[] = [],
  options: {
    systemInstruction?: string;
    maxImages?: number;
    json?: boolean;
  } = {},
): Promise<string> {
  const key = getGeminiKey();
  const model = getGeminiModel();
  const images = blocks
    .map(getImageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, options.maxImages ?? 4);

  const body: any = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...images.map((url) => geminiPartFromImageUrl(url)),
        ],
      },
    ],
  };

  if (options.json) {
    body.generationConfig = { responseMimeType: "application/json" };
  }
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const payload: any = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText;
    throw new Error(`Gemini request failed: ${message}`);
  }

  return extractGeminiText(payload);
}

export async function generateGeminiJson<T extends JsonValue = JsonValue>(
  prompt: string,
  blocks: AppBlock[] = [],
  options: { systemInstruction?: string; maxImages?: number } = {},
): Promise<T> {
  const text = await generateGeminiText(prompt, blocks, {
    ...options,
    json: true,
  });
  const parsed = safeJsonParse(text);
  if (!parsed) throw new Error("Gemini returned invalid JSON");
  return parsed as T;
}

export function getBlockText(block: AppBlock): string {
  if (block.type === "voice") return block.transcript || block.content || "";
  if (block.type === "image") {
    const caption = block.transcript || "";
    return caption
      ? `Image/chart note: ${caption}`
      : "Image/chart block attached.";
  }
  return block.content || block.transcript || "";
}

export function summarizeBlocks(blocks: AppBlock[]): string {
  return blocks
    .map((block, index) => {
      const text = getBlockText(block).trim();
      const label = `${index + 1}. ${block.type || "text"} block`;
      if (block.type === "image")
        return `${label}: ${text || "uploaded image/chart"}`;
      return `${label}: ${text}`;
    })
    .filter((line) => !line.endsWith(": "))
    .join("\n\n");
}

export function getImageUrl(block: AppBlock): string | null {
  const url = block.imageUrl || (block.type === "image" ? block.content : null);
  if (!url) return null;
  if (
    url.startsWith("data:image/") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }
  return null;
}

export function buildUserContent(
  prompt: string,
  blocks: AppBlock[],
  maxImages = 4,
): UserContentPart[] {
  const parts: UserContentPart[] = [{ type: "text", text: prompt }];
  const images = blocks
    .map(getImageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, maxImages);

  images.forEach((url) => {
    parts.push({ type: "image_url", image_url: { url, detail: "high" } });
  });

  return parts;
}

export function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
      } catch {
        return null;
      }
    }

    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}
