import { pgTable, varchar, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const aiProviders = pgTable("ai_providers", {
  id: varchar("id", { length: 100 }).primaryKey(),
  displayName: varchar("display_name", { length: 150 }).notNull(),
  baseUrl: varchar("base_url", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  capabilities: jsonb("capabilities").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AIProvider = typeof aiProviders.$inferSelect;
export type NewAIProvider = typeof aiProviders.$inferInsert;
