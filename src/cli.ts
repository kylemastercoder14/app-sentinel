#!/usr/bin/env node
import { appendFile, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { startRelay } from "./relay-server.js";

const [command, ...args] = process.argv.slice(2);
const arg = (name: string) => args[args.indexOf(name) + 1];

if (command === "relay") {
  const databaseUrl = process.env.APP_SENTINEL_RELAY_DATABASE_URL;
  const adminToken = process.env.APP_SENTINEL_RELAY_ADMIN_TOKEN;
  if (!databaseUrl || !adminToken) throw new Error("APP_SENTINEL_RELAY_DATABASE_URL and APP_SENTINEL_RELAY_ADMIN_TOKEN are required.");
  await startRelay({ databaseUrl, adminToken, smtp: { host: process.env.SMTP_HOST ?? "localhost", port: Number(process.env.SMTP_PORT ?? 1025), user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD }, port: Number(process.env.PORT ?? 4318) });
} else if (command === "init") {
  const relayUrl = arg("--relay-url"); const adminToken = process.env.APP_SENTINEL_RELAY_ADMIN_TOKEN; const appName = arg("--app-name");
  if (!relayUrl || !adminToken || !appName) throw new Error("Usage: APP_SENTINEL_RELAY_ADMIN_TOKEN=<token> app-sentinel init --relay-url <url> --app-name <name>");
  const readline = createInterface({ input, output });
  const recipient = await readline.question("Alert recipient email: "); readline.close();
  const response = await fetch(`${relayUrl.replace(/\/$/, "")}/v1/apps`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ appName, recipient }) });
  if (!response.ok) throw new Error(`Relay registration failed: ${await response.text()}`);
  const registered = await response.json() as { apiKey: string };
  let existing = ""; try { existing = await readFile(".env.local", "utf8"); } catch { /* create below */ }
  const values = `\nAPP_SENTINEL_RELAY_URL=${relayUrl}\nAPP_SENTINEL_APP_KEY=${registered.apiKey}\n`;
  if (existing.includes("APP_SENTINEL_APP_KEY=")) throw new Error(".env.local already has APP_SENTINEL_APP_KEY. Refusing to overwrite it.");
  await appendFile(".env.local", values);
  console.log("App Sentinel Relay configured in .env.local. Keep the generated app key private.");
} else {
  console.log("Usage: app-sentinel relay | APP_SENTINEL_RELAY_ADMIN_TOKEN=<token> app-sentinel init --relay-url <url> --app-name <name>");
}
