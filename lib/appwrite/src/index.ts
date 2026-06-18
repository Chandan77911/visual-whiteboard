import { Client, Databases, ID, Query } from "node-appwrite";

// ─── Environment validation ───────────────────────────────────────────────────
function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env variable: ${key}. See .env.example`);
  return val;
}

// ─── Appwrite client (lazy init) ──────────────────────────────────────────────
let _client: Client | null = null;
let _db: Databases | null = null;

export function getClient(): Client {
  if (_client) return _client;
  _client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "http://localhost/v1")
    .setProject(getEnv("APPWRITE_PROJECT_ID"))
    .setKey(getEnv("APPWRITE_API_KEY"));
  return _client;
}

export function getDb(): Databases {
  if (_db) return _db;
  _db = new Databases(getClient());
  return _db;
}

export function getDatabaseId(): string {
  return getEnv("APPWRITE_DATABASE_ID");
}

// ─── Collection IDs ───────────────────────────────────────────────────────────
export const COLLECTIONS = {
  notes:          "notes",
  blocks:         "blocks",
  blockLinks:     "blockLinks",
  flashcardDecks: "flashcardDecks",
  flashcards:     "flashcards",
  mindMaps:       "mindMaps",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function newId(): string {
  return ID.unique();
}

export function toISO(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

// ─── Generic CRUD helpers ─────────────────────────────────────────────────────

export async function createDoc(
  collection: string,
  data: Record<string, any>,
  id?: string
) {
  const db = getDb();
  const dbId = getDatabaseId();
  return db.createDocument(dbId, collection, id ?? ID.unique(), data);
}

export async function getDoc(collection: string, id: string) {
  const db = getDb();
  const dbId = getDatabaseId();
  return db.getDocument(dbId, collection, id);
}

export async function updateDoc(
  collection: string,
  id: string,
  data: Record<string, any>
) {
  const db = getDb();
  const dbId = getDatabaseId();
  return db.updateDocument(dbId, collection, id, data);
}

export async function deleteDoc(collection: string, id: string) {
  const db = getDb();
  const dbId = getDatabaseId();
  return db.deleteDocument(dbId, collection, id);
}

export async function listDocs(
  collection: string,
  queries: string[] = []
) {
  const db = getDb();
  const dbId = getDatabaseId();
  // Appwrite max per page is 100
  const res = await db.listDocuments(dbId, collection, [
    ...queries,
    Query.limit(100),
  ]);
  return res.documents;
}

export { Query, ID };
