import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blocksTable = pgTable("blocks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(), // text | voice | image | whiteboard
  content: text("content").notNull().default(""),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  transcript: text("transcript"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  noteId: text("note_id"),
  position: integer("position"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const blockLinksTable = pgTable("block_links", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  relation: text("relation").notNull().default("related"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBlockSchema = createInsertSchema(blocksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;
export type BlockLink = typeof blockLinksTable.$inferSelect;
