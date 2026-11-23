import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { generationJobs } from "./generation_jobs";

export const sceneSpecifications = pgTable(
  "scene_specifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schemaVersion: varchar("schema_version", { length: 20 }).notNull().default("1.0"),
    objectName: varchar("object_name", { length: 150 }).notNull(),
    specJson: jsonb("spec_json").notNull(),
    plannerModelId: varchar("planner_model_id", { length: 150 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_scene_specifications_job_id").on(table.jobId),
    index("idx_scene_specifications_user_id").on(table.userId),
  ]
);

export type SceneSpecification = typeof sceneSpecifications.$inferSelect;
export type NewSceneSpecification = typeof sceneSpecifications.$inferInsert;
