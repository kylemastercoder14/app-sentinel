import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fingerprintError } from "./fingerprint.js";
import { normalizeError } from "./normalize-error.js";
import { redact } from "./redact.js";
import type { LogLevel, MonitorEvent, RelayMonitorOptions, ReportResult, SafeContext, TraceData } from "./types.js";

export type RelayMonitor = {
  reportError(error: unknown, context?: SafeContext): Promise<ReportResult>;
  log(level: LogLevel, message: string, metadata?: SafeContext): Promise<MonitorEvent>;
  trace<T>(name: string, operation: () => Promise<T>, attributes?: SafeContext): Promise<T>;
};

export function createRelayMonitor(options: RelayMonitorOptions): RelayMonitor {
  const redactKeys = options.redactKeys ?? [];
  const createEvent = (partial: Omit<MonitorEvent, "id" | "timestamp" | "appName" | "environment" | "release">): MonitorEvent => ({
    id: randomUUID(), timestamp: new Date().toISOString(), appName: options.appName,
    environment: options.environment ?? process.env.NODE_ENV ?? "development", release: options.release, ...partial,
  });
  const send = async (event: MonitorEvent): Promise<ReportResult> => {
    try {
      const response = await fetch(`${options.endpoint.replace(/\/$/, "")}/v1/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({ event }),
      });
      if (!response.ok) throw new Error(`Relay returned ${response.status}`);
      const result = await response.json() as { stored: boolean; notified: boolean };
      return { event, stored: result.stored, notified: result.notified };
    } catch (error) {
      return { event, stored: false, notified: false, notificationError: error instanceof Error ? error : new Error(String(error)) };
    }
  };
  return {
    async reportError(error, context = {}) {
      const normalized = normalizeError(error);
      return send(createEvent({ type: "error", level: "error", message: normalized.message, error: normalized, fingerprint: fingerprintError(normalized), context: redact(context, redactKeys) as SafeContext }));
    },
    async log(level, message, metadata = {}) {
      const event = createEvent({ type: "log", level, message, context: redact(metadata, redactKeys) as SafeContext });
      await send(event);
      return event;
    },
    async trace(name, operation, attributes = {}) {
      const start = performance.now();
      const traceBase = { traceId: randomUUID(), spanId: randomUUID(), name, attributes: redact(attributes, redactKeys) as SafeContext };
      try {
        const value = await operation();
        const trace: TraceData = { ...traceBase, durationMs: Math.round(performance.now() - start), status: "ok" };
        await send(createEvent({ type: "trace", level: "info", message: name, trace }));
        return value;
      } catch (error) {
        const trace: TraceData = { ...traceBase, durationMs: Math.round(performance.now() - start), status: "error" };
        await send(createEvent({ type: "trace", level: "error", message: name, trace }));
        throw error;
      }
    },
  };
}

export function createRelayMonitorFromEnv(appName: string): RelayMonitor {
  const endpoint = process.env.APP_SENTINEL_RELAY_URL;
  const apiKey = process.env.APP_SENTINEL_APP_KEY;
  if (!endpoint || !apiKey) throw new Error("Run `pnpm exec app-sentinel init` to configure App Sentinel Relay.");
  return createRelayMonitor({ appName, endpoint, apiKey });
}
