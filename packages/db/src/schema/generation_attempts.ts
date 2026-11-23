import { pgTable, uuid, integer, varchar, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { generationJobs } from "./generation_jobs";
import { attemptStatusEnum } from "./enums";

export const generationAttempts = pgTable(
  "generation_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    stage: varchar("stage", { length: 50 }).notNull(),
    status: attemptStatusEnum("status").notNull().default("PENDING"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    sanitizedSummary: text("sanitized_summary"),
    errorDetails: jsonb("error_details"),
  },
  (table) => [
    uniqueIndex("uniq_generation_attempts_job_attempt").on(table.jobId, table.attemptNumber),
    index("idx_generation_attempts_job_id").on(table.jobId),
  ]
);

export type GenerationAttempt = typeof generationAttempts.$inferSelect;
export type NewGenerationAttempt = typeof generationAttempts.$inferInsert;
