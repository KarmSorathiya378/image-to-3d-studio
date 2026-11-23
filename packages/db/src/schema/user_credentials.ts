import { pgTable, uuid, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { aiProviders } from "./ai_providers";
import { credentialStatusEnum } from "./enums";

export const userCredentials = pgTable(
  "user_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: varchar("provider_id", { length: 100 })
      .notNull()
      .references(() => aiProviders.id, { onDelete: "restrict" }),
    nickname: varchar("nickname", { length: 100 }).notNull(),
    keyMask: varchar("key_mask", { length: 30 }).notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    secretNonce: text("secret_nonce").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    status: credentialStatusEnum("status").notNull().default("untested"),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_user_credentials_user_id").on(table.userId),
    index("idx_user_credentials_provider_id").on(table.providerId),
    index("idx_user_credentials_user_provider").on(table.userId, table.providerId),
  ]
);

export type UserCredential = typeof userCredentials.$inferSelect;
export type NewUserCredential = typeof userCredentials.$inferInsert;
