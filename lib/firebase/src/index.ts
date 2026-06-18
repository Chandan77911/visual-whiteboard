import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT env variable is not set.\n" +
      "1. Copy artifacts/api-server/.env.example → .env\n" +
      "2. Paste your Firebase service account JSON as one line"
    );
  }
  try {
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  } catch (e) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON. Make sure it is all on ONE line with no line breaks.\n" +
      "The private_key newlines should be written as \\n (backslash-n), not actual newlines."
    );
  }
}

export const db = getFirestore();

export function newId(): string {
  return crypto.randomUUID();
}

export function toISO(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts?.toDate) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

export const COLLECTIONS = {
  notes: "notes",
  blocks: "blocks",
  blockLinks: "blockLinks",
  flashcardDecks: "flashcardDecks",
  flashcards: "flashcards",
  mindMaps: "mindMaps",
} as const;

export { Timestamp, FieldValue };
