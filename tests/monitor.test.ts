import { describe, expect, it } from "vitest";
import { createMonitor } from "../src/monitor.js";
import type { EventStore, MonitorEvent, Notifier } from "../src/types.js";

describe("createMonitor", () => {
  it("stores and notifies a new error without leaking redacted context", async () => {
    const events: MonitorEvent[] = [];
    const store: EventStore = { save: async (event) => { events.push(event); }, shouldNotify: async () => ({ notify: true, suppressedCount: 0 }) };
    let mailed: MonitorEvent | undefined;
    const notifier: Notifier = { send: async (event) => { mailed = event; } };
    const monitor = createMonitor({ appName: "test", environment: "test", store, notifier, console: false });
    const result = await monitor.reportError(new Error("Boom"), { authorization: "do-not-send", orderId: "ord_1" });
    expect(result.notified).toBe(true);
    expect(events[0]?.context).toEqual({ authorization: "[REDACTED]", orderId: "ord_1" });
    expect(mailed?.fingerprint).toHaveLength(16);
  });
});
