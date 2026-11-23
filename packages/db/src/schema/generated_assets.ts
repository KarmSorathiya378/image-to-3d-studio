import { pgTable, uuid, text, bigint, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { generationJobs } from "./generation_jobs";
import { assetFormatEnum, validationStateEnum } from "./enums";

export const generatedAssets = pgTable(
  "generated_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fileFormat: assetFormatEnum("file_format").notNull(),
    storageKey: text("storage_key").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    triangleCount: integer("triangle_count"),
    vertexCount: integer("vertex_count"),
    validationState: validationStateEnum("validation_state").notNull().default("PENDING"),
    validationReport: jsonb("validation_report"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_generated_assets_job_id").on(table.jobId),
    index("idx_generated_assets_user_id").on(table.userId),
    index("idx_generated_assets_project_id").on(table.projectId),
    index("idx_generated_assets_file_format").on(table.fileFormat),
  ]
);

export type GeneratedAsset = typeof generatedAssets.$inferSelect;
export type NewGeneratedAsset = typeof generatedAssets.$inferInsert;
