import { PostgresDatabaseAdapter } from "@elizaos/adapter-postgres";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import Database from "better-sqlite3";
import path from "path";
import dotenv from "dotenv";
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

export function initializeDatabase(dataDir: string) {
  if (process.env.POSTGRES_URL) {
    const db = new PostgresDatabaseAdapter({
      connectionString: process.env.POSTGRES_URL,
    });
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    });
    db.db = pool;
    console.log("db after initializeDatabase", db);
    return db;
  } else {
    const filePath =
      process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
    // ":memory:";
    const db = new SqliteDatabaseAdapter(new Database(filePath));
    return db;
  }
}
