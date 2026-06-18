/**
 * K-Space Appwrite Setup Script
 * Run: node scripts/setup-appwrite.cjs
 */

const path = require("path");
const fs = require("fs");

// Load node-appwrite from the workspace node_modules
const appwritePath = path.join(__dirname, "../node_modules/node-appwrite");
if (!fs.existsSync(appwritePath)) {
  console.error("❌ node-appwrite not found. Run: pnpm install first");
  process.exit(1);
}
const { Client, Databases, ID } = require(appwritePath);

// Load .env
const envPath = path.join(__dirname, "../artifacts/api-server/.env");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env not found at", envPath);
  console.error("   Run: copy artifacts\\api-server\\.env.example artifacts\\api-server\\.env");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const ENDPOINT = env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT = env.APPWRITE_PROJECT_ID;
const API_KEY = env.APPWRITE_API_KEY;
const DB_ID = env.APPWRITE_DATABASE_ID || "kspace";

if (!PROJECT || PROJECT === "your_project_id") {
  console.error("❌ APPWRITE_PROJECT_ID not set in .env");
  process.exit(1);
}
if (!API_KEY || API_KEY === "your_api_key") {
  console.error("❌ APPWRITE_API_KEY not set in .env");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const db = new Databases(client);

const delay = ms => new Promise(r => setTimeout(r, ms));

async function createAttr(dbId, colId, type, key, opts = {}) {
  try {
    if (type === "string") await db.createStringAttribute(dbId, colId, key, opts.size || 5000, opts.required || false, opts.default ?? null, opts.array || false);
    if (type === "float") await db.createFloatAttribute(dbId, colId, key, opts.required || false, undefined, undefined, opts.default ?? null);
    if (type === "integer") await db.createIntegerAttribute(dbId, colId, key, opts.required || false, undefined, undefined, opts.default ?? null);
    if (type === "boolean") await db.createBooleanAttribute(dbId, colId, key, opts.required || false, opts.default ?? null);
    process.stdout.write(`   ✅ ${key}\n`);
  } catch (e) {
    if (String(e).includes("already exists") || String(e).includes("409")) {
      process.stdout.write(`   ⏭  ${key} (exists)\n`);
    } else {
      process.stdout.write(`   ⚠  ${key}: ${e.message}\n`);
    }
  }
  await delay(500);
}

async function createCollection(dbId, id, name) {
  try {
    await db.createCollection(dbId, id, name);
    console.log(`\n📁 Created: ${name}`);
  } catch (e) {
    if (String(e).includes("already exists") || String(e).includes("409")) {
      console.log(`\n📁 Exists: ${name}`);
    } else throw e;
  }
  await delay(500);
}

async function main() {
  console.log("🚀 K-Space Appwrite Setup");
  console.log("   Endpoint:", ENDPOINT);
  console.log("   Project:", PROJECT);
  console.log("   Database:", DB_ID);

  console.log("\n✅ Using existing database:", DB_ID);

  // notes
  await createCollection(DB_ID, "notes", "notes");
  await createAttr(DB_ID, "notes", "string", "title", { required: true, size: 500 });
  await createAttr(DB_ID, "notes", "string", "summary", { size: 5000 });
  await createAttr(DB_ID, "notes", "string", "tags", { size: 100, array: true });
  await createAttr(DB_ID, "notes", "string", "updatedAt", { size: 50 });

  // blocks
  await createCollection(DB_ID, "blocks", "blocks");
  await createAttr(DB_ID, "blocks", "string", "type", { required: true, size: 20 });
  await createAttr(DB_ID, "blocks", "string", "content", { size: 100000 });
  await createAttr(DB_ID, "blocks", "string", "audioUrl", { size: 2000 });
  await createAttr(DB_ID, "blocks", "string", "imageUrl", { size: 2000 });
  await createAttr(DB_ID, "blocks", "string", "transcript", { size: 50000 });
  await createAttr(DB_ID, "blocks", "string", "tags", { size: 100, array: true });
  await createAttr(DB_ID, "blocks", "string", "noteId", { size: 50 });
  await createAttr(DB_ID, "blocks", "integer", "position", { default: 0 });

  // blockLinks
  await createCollection(DB_ID, "blockLinks", "blockLinks");
  await createAttr(DB_ID, "blockLinks", "string", "sourceId", { required: true, size: 50 });
  await createAttr(DB_ID, "blockLinks", "string", "targetId", { required: true, size: 50 });
  await createAttr(DB_ID, "blockLinks", "string", "relation", { size: 200 });

  // flashcardDecks
  await createCollection(DB_ID, "flashcardDecks", "flashcardDecks");
  await createAttr(DB_ID, "flashcardDecks", "string", "title", { required: true, size: 500 });
  await createAttr(DB_ID, "flashcardDecks", "string", "noteId", { size: 50 });

  // flashcards
  await createCollection(DB_ID, "flashcards", "flashcards");
  await createAttr(DB_ID, "flashcards", "string", "deckId", { required: true, size: 50 });
  await createAttr(DB_ID, "flashcards", "string", "front", { required: true, size: 5000 });
  await createAttr(DB_ID, "flashcards", "string", "back", { required: true, size: 5000 });
  await createAttr(DB_ID, "flashcards", "integer", "interval", { default: 1 });
  await createAttr(DB_ID, "flashcards", "float", "easeFactor", { default: 2.5 });
  await createAttr(DB_ID, "flashcards", "string", "dueAt", { size: 50 });
  await createAttr(DB_ID, "flashcards", "integer", "reviewCount", { default: 0 });

  // mindMaps
  await createCollection(DB_ID, "mindMaps", "mindMaps");
  await createAttr(DB_ID, "mindMaps", "string", "title", { required: true, size: 500 });
  await createAttr(DB_ID, "mindMaps", "string", "noteId", { size: 50 });
  await createAttr(DB_ID, "mindMaps", "string", "rootNode", { required: true, size: 100000 });

  console.log("\n✅ All collections created successfully!");
  console.log("\nNext:");
  console.log("  Terminal 1: pnpm --filter @workspace/api-server run dev:win");
  console.log("  Terminal 2: pnpm --filter @workspace/knowledge-workspace run dev");
}

main().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
