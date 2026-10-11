import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import * as schema from "../drizzle/schema";
import { env } from "./env";

export const pool = mysql.createPool({
  uri: env.databaseUrl,
  connectionLimit: 10,
  waitForConnections: true,
  enableKeepAlive: true,
  timezone: "Z",
});

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };

/** Aplica las migraciones pendientes en cada arranque. */
export async function runMigrations() {
  const folder = path.resolve(process.cwd(), "drizzle/migrations");
  await migrate(db, { migrationsFolder: folder });
}
