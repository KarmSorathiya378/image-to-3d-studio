import { pgTable, uuid, varchar, boolean, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { aiProviders } from "./ai_providers";
import { userCredentials } from "./user_credentials";
import { modelStageEnum } from "./enums";

export const modelConfigurations = pgTable(
  "model_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stage: modelStageEnum("stage").notNull(),
    providerId: varchar("provider_id", { length: 100 })
      .notNull()
      .references(() => aiProviders.id, { onDelete: "restrict" }),
    modelId: varchar("model_id", { length: 150 }).notNull(),
    credentialId: uuid("credential_id").references(() => userCredentials.id, {
      onDelete: "set null",
    }),
    parameters: jsonb("parameters").default({}),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_model_configurations_user_id").on(table.userId),
    index("idx_model_configurations_user_stage").on(table.userId, table.stage),
    uniqueIndex("uniq_model_configurations_user_stage_model").on(
      table.userId,
      table.stage,
      table.modelId
    ),
  ]
);

export type ModelConfiguration = typeof modelConfigurations.$inferSelect;
export type NewModelConfiguration = typeof modelConfigurations.$inferInsert;
