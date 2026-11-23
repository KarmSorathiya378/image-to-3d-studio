import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { uploadedAssets } from "./uploaded_assets";
import { generationModeEnum, generationStatusEnum } from "./enums";

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceAssetId: uuid("source_asset_id")
      .notNull()
      .references(() => uploadedAssets.id, { onDelete: "restrict" }),
    mode: generationModeEnum("mode").notNull().default("PROCEDURAL"),
    status: generationStatusEnum("status").notNull().default("CREATED"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    instructions: text("instructions"),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uniq_generation_jobs_user_idempotency").on(table.userId, table.idempotencyKey),
    index("idx_generation_jobs_user_id").on(table.userId),
    index("idx_generation_jobs_project_id").on(table.projectId),
    index("idx_generation_jobs_status").on(table.status),
  ]
);

export type GenerationJob = typeof generationJobs.$inferSelect;
export type NewGenerationJob = typeof generationJobs.$inferInsert;
