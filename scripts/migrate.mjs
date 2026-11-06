import { readFile } from "node:fs/promises";
import { Client } from "pg";

if (!process.env.APP_SENTINEL_DATABASE_URL) {
  throw new Error("APP_SENTINEL_DATABASE_URL is required to run migrations.");
}

const client = new Client({ connectionString: process.env.APP_SENTINEL_DATABASE_URL });
await client.connect();
try {
  await client.query(await readFile(new URL("../migrations/001_initial_schema.sql", import.meta.url), "utf8"));
  console.log("App Sentinel migration completed.");
} finally {
  await client.end();
}
