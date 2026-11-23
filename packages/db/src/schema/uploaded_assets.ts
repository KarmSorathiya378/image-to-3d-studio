import { pgTable, uuid, varchar, text, bigint, integer, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

export const uploadedAssets = pgTable(
  "uploaded_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 100 }).notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_uploaded_assets_user_id").on(table.userId),
    index("idx_uploaded_assets_project_id").on(table.projectId),
  ]
);

export type UploadedAsset = typeof uploadedAssets.$inferSelect;
export type NewUploadedAsset = typeof uploadedAssets.$inferInsert;
