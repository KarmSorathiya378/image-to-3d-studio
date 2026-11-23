import { pgTable, uuid, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { generatedAssets } from "./generated_assets";

export const exportRecords = pgTable(
  "export_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => generatedAssets.id, { onDelete: "cascade" }),
    exportFormat: varchar("export_format", { length: 50 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    downloadCount: integer("download_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_export_records_user_id").on(table.userId),
    index("idx_export_records_asset_id").on(table.assetId),
  ]
);

export type ExportRecord = typeof exportRecords.$inferSelect;
export type NewExportRecord = typeof exportRecords.$inferInsert;
