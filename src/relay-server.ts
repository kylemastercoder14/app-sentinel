import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Pool } from "pg";
import { nodemailerNotifier } from "./notifiers/nodemailer.js";
import { PostgresStore } from "./stores/postgres.js";
import type { MonitorEvent } from "./types.js";

type RelayOptions = {
  databaseUrl: string;
  adminToken: string;
  smtp: { host: string; port: number; user?: string; password?: string };
  port?: number;
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const appKey = () => `as_${randomBytes(32).toString("base64url")}`;

async function body(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) { raw += chunk; if (raw.length > 250_000) throw new Error("Payload too large"); }
  return raw ? JSON.parse(raw) : {};
}
function reply(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(payload));
}
function bearer(request: IncomingMessage) { return request.headers.authorization?.replace(/^Bearer\s+/i, ""); }
function isEvent(value: unknown): value is MonitorEvent {
  const event = value as Partial<MonitorEvent>;
  return Boolean(event && typeof event.id === "string" && typeof event.appName === "string" && typeof event.message === "string" && ["error", "log", "trace"].includes(event.type ?? ""));
}

export async function startRelay(options: RelayOptions): Promise<void> {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const store = new PostgresStore(options.databaseUrl);
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") return reply(response, 200, { ok: true });
      if (request.method === "POST" && request.url === "/v1/apps") {
        if (bearer(request) !== options.adminToken) return reply(response, 401, { error: "Unauthorized" });
        const input = await body(request) as { appName?: string; recipient?: string };
        if (!input.appName || !input.recipient || !/^\S+@\S+\.\S+$/.test(input.recipient)) return reply(response, 400, { error: "appName and a valid recipient are required" });
        const key = appKey();
        await pool.query(
          `insert into sentinel_relay_apps (app_name, recipient_email, api_key_hash) values ($1,$2,$3)
           on conflict (app_name) do update set recipient_email=excluded.recipient_email, api_key_hash=excluded.api_key_hash, active=true, updated_at=now()`,
          [input.appName, input.recipient, hash(key)],
        );
        return reply(response, 201, { appName: input.appName, apiKey: key });
      }
      if (request.method === "POST" && request.url === "/v1/events") {
        const key = bearer(request); if (!key) return reply(response, 401, { error: "Missing app key" });
        const app = await pool.query<{ app_name: string; recipient_email: string }>("select app_name, recipient_email from sentinel_relay_apps where api_key_hash=$1 and active=true", [hash(key)]);
        if (!app.rows[0]) return reply(response, 401, { error: "Invalid app key" });
        const input = await body(request) as { event?: unknown };
        if (!isEvent(input.event) || input.event.appName !== app.rows[0].app_name) return reply(response, 400, { error: "Invalid event" });
        await store.save(input.event);
        let notified = false;
        if (input.event.type === "error" && input.event.fingerprint) {
          const decision = await store.shouldNotify(input.event, 30 * 60_000);
          if (decision.notify) {
            await nodemailerNotifier({ host: options.smtp.host, port: options.smtp.port, auth: options.smtp.user && options.smtp.password ? { user: options.smtp.user, pass: options.smtp.password } : undefined, to: app.rows[0].recipient_email }).send(input.event, decision.suppressedCount);
            notified = true;
          }
        }
        return reply(response, 202, { stored: true, notified });
      }
      return reply(response, 404, { error: "Not found" });
    } catch (error) { return reply(response, 500, { error: error instanceof Error ? error.message : "Relay failure" }); }
  });
  await new Promise<void>((resolve) => server.listen(options.port ?? 4318, resolve));
  console.log(`App Sentinel Relay listening on port ${options.port ?? 4318}`);
}
