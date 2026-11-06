import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fingerprintError } from "./fingerprint.js";
import { normalizeError } from "./normalize-error.js";
import { redact } from "./redact.js";
import { PostgresStore } from "./stores/postgres.js";
import type { EventStore, LogLevel, MonitorEvent, MonitorOptions, ReportResult, SafeContext, TraceData } from "./types.js";

export type Monitor = {
  reportError(error: unknown, context?: SafeContext): Promise<ReportResult>;
  log(level: Exclude<LogLevel, "error"> | "error", message: string, metadata?: SafeContext): Promise<MonitorEvent>;
  trace<T>(name: string, operation: () => Promise<T>, attributes?: SafeContext): Promise<T>;
  close(): Promise<void>;
};

export function createMonitor(options: MonitorOptions): Monitor {
  if (!options.appName.trim()) throw new Error("App Sentinel requires appName.");
  if (!options.environment.trim()) throw new Error("App Sentinel requires environment.");
  const store: EventStore | undefined = options.store ?? (options.databaseUrl ? new PostgresStore(options.databaseUrl) : undefined);
  const cooldownMs = (options.cooldownMinutes ?? 30) * 60_000;
  const redactKeys = options.redactKeys ?? [];

  const createEvent = (partial: Omit<MonitorEvent, "id" | "timestamp" | "appName" | "environment" | "release">): MonitorEvent => ({
    id: randomUUID(), timestamp: new Date().toISOString(), appName: options.appName, environment: options.environment,
    release: options.release, ...partial,
  });
  const writeConsole = (event: MonitorEvent) => { if (options.console !== false) console.log(JSON.stringify(event)); };
  const persist = async (event: MonitorEvent): Promise<boolean> => {
    writeConsole(event);
    if (!store) return false;
    try { await store.save(event); return true; }
    catch (error) { console.warn("[app-sentinel] Event storage failed", error); return false; }
  };

  return {
    async reportError(error, context = {}): Promise<ReportResult> {
      const normalized = normalizeError(error);
      const safeContext = redact(context, redactKeys) as SafeContext;
      const event = createEvent({
        type: "error", level: "error", message: normalized.message, error: normalized,
        fingerprint: fingerprintError(normalized), context: safeContext,
      });
      const stored = await persist(event);
      if (!store || !options.notifier || !stored) return { event, stored, notified: false };
      try {
        const decision = await store.shouldNotify(event, cooldownMs);
        if (!decision.notify) return { event, stored, notified: false };
        await options.notifier.send(event, decision.suppressedCount);
        return { event, stored, notified: true };
      } catch (notificationError) {
        const asError = notificationError instanceof Error ? notificationError : new Error(String(notificationError));
        console.warn("[app-sentinel] Notification failed", asError);
        return { event, stored, notified: false, notificationError: asError };
      }
    },

    async log(level, message, metadata = {}): Promise<MonitorEvent> {
      const event = createEvent({ type: "log", level, message, context: redact(metadata, redactKeys) as SafeContext });
      await persist(event);
      return event;
    },

    async trace<T>(name: string, operation: () => Promise<T>, attributes = {}): Promise<T> {
      const started = performance.now();
      const traceBase = { traceId: randomUUID(), spanId: randomUUID(), name, attributes: redact(attributes, redactKeys) as SafeContext };
      try {
        const result = await operation();
        const trace: TraceData = { ...traceBase, durationMs: Math.round(performance.now() - started), status: "ok" };
        await persist(createEvent({ type: "trace", level: "info", message: name, trace }));
        return result;
      } catch (error) {
        const trace: TraceData = { ...traceBase, durationMs: Math.round(performance.now() - started), status: "error" };
        await persist(createEvent({ type: "trace", level: "error", message: name, trace }));
        throw error;
      }
    },

    async close(): Promise<void> { await store?.close?.(); },
  };
}
