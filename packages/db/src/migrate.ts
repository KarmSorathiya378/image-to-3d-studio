import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

export async function runMigrations(connectionString?: string) {
  const url =
    connectionString ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/image_to_3d";

  const pool = new Pool({ connectionString: url });
  const migrationPath = path.join(__dirname, "../migrations/0000_initial_schema.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log(`[DB Migration] Applying initial schema migration to ${url.split("@")[1] || "configured DB"}...`);
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[DB Migration] Initial schema applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[DB Migration] Error applying migration:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
