import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export interface MindMapNodeData {
  id: string;
  label: string;
  children?: MindMapNodeData[];
}

export const mindMapsTable = pgTable("mind_maps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  noteId: text("note_id"),
  rootNode: jsonb("root_node").$type<MindMapNodeData>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MindMap = typeof mindMapsTable.$inferSelect;
