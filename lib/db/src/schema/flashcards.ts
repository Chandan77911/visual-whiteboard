import { pgTable, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flashcardDecksTable = pgTable("flashcard_decks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  noteId: text("note_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const flashcardsTable = pgTable("flashcards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  deckId: text("deck_id").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  interval: integer("interval").notNull().default(1),
  easeFactor: real("ease_factor").notNull().default(2.5),
  dueAt: timestamp("due_at").notNull().defaultNow(),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FlashcardDeck = typeof flashcardDecksTable.$inferSelect;
export type Flashcard = typeof flashcardsTable.$inferSelect;
