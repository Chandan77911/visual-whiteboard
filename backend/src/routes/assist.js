const express = require("express");
const router = express.Router();

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function dataUrlToInlineData(url) {
  const match = /^data:(image\/[^;]+);base64,(.+)$/i.exec(url || "");
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function analyzeWithGemini(prompt, imageDataUrl) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const parts = [{ text: prompt }];
  const inlineData = dataUrlToInlineData(imageDataUrl);
  if (inlineData) parts.push({ inlineData });

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText;
    throw new Error(`Gemini request failed: ${message}`);
  }

  return safeJsonParse(extractGeminiText(payload));
}

async function analyzeWithOpenAI(prompt, imageDataUrl) {
  if (!process.env.OPENAI_API_KEY) return null;

  const OpenAI = require("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: imageDataUrl
          ? [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageDataUrl, detail: "high" },
              },
            ]
          : prompt,
      },
    ],
    response_format: { type: "json_object" },
  });

  return safeJsonParse(completion.choices[0].message.content);
}

/**
 * POST /api/assist/analyze
 * Analyzes a diagram description and returns architectural suggestions.
 * Uses Gemini/OpenAI if an API key is present, otherwise returns mock suggestions.
 */
router.post("/analyze", async (req, res) => {
  const { diagramDescription, objects, imageDataUrl } = req.body;

  if (
    !diagramDescription &&
    (!objects || objects.length === 0) &&
    !imageDataUrl
  ) {
    return res.status(400).json({
      error: "Provide a diagram description, objects, or canvas image",
    });
  }

  const objectSummary = objects
    ? objects
        .map((o) => `${o.type || "shape"}: "${o.text || o.label || ""}"`)
        .join(", ")
    : "";

  const prompt = `
You are an expert software architect reviewing a system design diagram.
The diagram contains: ${diagramDescription || objectSummary || "an uploaded canvas image"}

If a canvas image is attached, read it as the source of truth. Identify visible chart labels,
nodes, arrows, groupings, and relationships before making recommendations.

Provide structured architectural suggestions in JSON format with these keys:
- apis: array of suggested APIs/services (name + reason)
- dbms: recommended database(s) with reasoning
- missing: components or patterns that are missing
- scalability: tips to improve scalability
- performance: performance optimization suggestions
- summary: one-paragraph overall feedback

Respond ONLY with valid JSON, no markdown.
`;

  try {
    const suggestions =
      (await analyzeWithGemini(prompt, imageDataUrl)) ||
      (await analyzeWithOpenAI(prompt, imageDataUrl));

    if (suggestions) {
      return res.json({
        suggestions,
        provider: process.env.GEMINI_API_KEY ? "gemini" : "openai",
      });
    }

    const fallback = generateMockSuggestions(
      diagramDescription || objectSummary,
    );
    res.json({ suggestions: fallback, mock: true });
  } catch (err) {
    console.error("[Assist] Error:", err.message);
    res.status(500).json({ error: "Failed to analyze diagram" });
  }
});

function generateMockSuggestions(description) {
  const desc = description.toLowerCase();
  const isAuth =
    desc.includes("auth") || desc.includes("login") || desc.includes("user");
  const isPayment =
    desc.includes("payment") ||
    desc.includes("stripe") ||
    desc.includes("billing");
  const isStorage =
    desc.includes("storage") ||
    desc.includes("upload") ||
    desc.includes("file");

  return {
    apis: [
      {
        name: "REST API Gateway",
        reason:
          "Central entry point for all client requests with rate limiting",
      },
      isAuth
        ? {
            name: "Auth0 / JWT",
            reason: "Handles authentication & authorization securely",
          }
        : {
            name: "GraphQL API",
            reason: "Flexible data fetching for complex client requirements",
          },
      isPayment
        ? { name: "Stripe API", reason: "PCI-compliant payment processing" }
        : { name: "SendGrid", reason: "Transactional email delivery" },
      isStorage
        ? {
            name: "AWS S3",
            reason: "Scalable object storage for files and media",
          }
        : { name: "Cloudflare CDN", reason: "Edge caching for static assets" },
    ],
    dbms: isPayment
      ? "PostgreSQL for transactional data integrity + Redis for session/cache"
      : "MongoDB for flexible document storage + Redis for caching hot data",
    missing: [
      "Load balancer / reverse proxy (e.g., Nginx)",
      "Message queue for async tasks (e.g., BullMQ, RabbitMQ)",
      "Centralized logging (e.g., ELK Stack or Datadog)",
      "CI/CD pipeline in the architecture",
      !isAuth
        ? "Authentication & authorization layer"
        : "Multi-factor authentication (MFA)",
    ],
    scalability: [
      "Introduce horizontal scaling with container orchestration (Kubernetes)",
      "Add a CDN layer to serve static assets from the edge",
      "Use read replicas for your primary database to distribute read load",
      "Implement circuit breakers between microservices to prevent cascade failures",
    ],
    performance: [
      "Add Redis caching for frequently accessed data (target <10ms response)",
      "Use database indexing on all foreign keys and search fields",
      "Implement pagination and cursor-based navigation for large datasets",
      "Consider WebSockets or SSE for real-time features instead of polling",
    ],
    summary:
      "Your architecture shows a solid foundation. The main areas to address are adding load balancing, async task processing, and observability through logging and monitoring.",
  };
}

module.exports = router;
