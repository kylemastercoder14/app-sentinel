import { Pool } from "pg";
import type { AlertDecision, EventStore, MonitorEvent } from "../types.js";

export class PostgresStore implements EventStore {
  private readonly pool: Pool;
  constructor(databaseUrl: string) { this.pool = new Pool({ connectionString: databaseUrl }); }

  async save(event: MonitorEvent): Promise<void> {
    await this.pool.query(
      `insert into sentinel_events (id, type, level, timestamp, app_name, environment, release, fingerprint, message, error_name, error_stack, context, trace)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [event.id, event.type, event.level, event.timestamp, event.appName, event.environment, event.release ?? null, event.fingerprint ?? null, event.message, event.error?.name ?? null, event.error?.stack ?? null, event.context ?? null, event.trace ?? null],
    );
  }

  async shouldNotify(event: MonitorEvent, cooldownMs: number): Promise<AlertDecision> {
    if (!event.fingerprint) return { notify: false, suppressedCount: 0 };
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const existing = await client.query<{ last_notified_at: Date | null; suppressed_count: number }>(
        `select last_notified_at, suppressed_count from sentinel_alert_state where app_name=$1 and environment=$2 and fingerprint=$3 for update`,
        [event.appName, event.environment, event.fingerprint],
      );
      const row = existing.rows[0];
      const now = Date.now();
      const shouldAlert = !row?.last_notified_at || now - row.last_notified_at.getTime() >= cooldownMs;
      const suppressedCount = row?.suppressed_count ?? 0;
      if (shouldAlert) {
        await client.query(
          `insert into sentinel_alert_state (app_name, environment, fingerprint, last_notified_at, suppressed_count)
           values ($1,$2,$3,now(),0)
           on conflict (app_name, environment, fingerprint) do update set last_notified_at=now(), suppressed_count=0, updated_at=now()`,
          [event.appName, event.environment, event.fingerprint],
        );
      } else {
        await client.query(
          `update sentinel_alert_state set suppressed_count=suppressed_count+1, updated_at=now() where app_name=$1 and environment=$2 and fingerprint=$3`,
          [event.appName, event.environment, event.fingerprint],
        );
      }
      await client.query("commit");
      return { notify: shouldAlert, suppressedCount };
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  async close(): Promise<void> { await this.pool.end(); }
}
