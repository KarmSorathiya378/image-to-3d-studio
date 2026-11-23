import { pgTable, uuid, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { generationJobs } from "./generation_jobs";
import { sceneSpecifications } from "./scene_specifications";
import { generatedAssets } from "./generated_assets";

export const modelVersions = pgTable(
  "model_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    generationJobId: uuid("generation_job_id").references(() => generationJobs.id, {
      onDelete: "set null",
    }),
    sceneSpecificationId: uuid("scene_specification_id").references(
      () => sceneSpecifications.id,
      { onDelete: "set null" }
    ),
    primaryAssetId: uuid("primary_asset_id").references(() => generatedAssets.id, {
      onDelete: "set null",
    }),
    thumbnailAssetId: uuid("thumbnail_asset_id").references(() => generatedAssets.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_model_versions_project_version").on(table.projectId, table.versionNumber),
    index("idx_model_versions_project_id").on(table.projectId),
    index("idx_model_versions_user_id").on(table.userId),
  ]
);

export type ModelVersion = typeof modelVersions.$inferSelect;
export type NewModelVersion = typeof modelVersions.$inferInsert;
