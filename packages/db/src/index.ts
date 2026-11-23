import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export * from "./schema";

export function createDbClient(connectionString?: string) {
  const pool = new Pool({
    connectionString:
      connectionString ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/image_to_3d",
  });
  return drizzle(pool, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
