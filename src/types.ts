export type LogLevel = "debug" | "info" | "warn" | "error";
export type EventType = "error" | "log" | "trace";

export type SafeContext = Record<string, unknown>;

export type TraceData = {
  traceId: string;
  spanId: string;
  name: string;
  durationMs: number;
  status: "ok" | "error";
  attributes?: SafeContext;
};

export type NormalizedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: string;
};

export type MonitorEvent = {
  id: string;
  type: EventType;
  level: LogLevel;
  timestamp: string;
  appName: string;
  environment: string;
  release?: string;
  fingerprint?: string;
  message: string;
  error?: NormalizedError;
  context?: SafeContext;
  trace?: TraceData;
};

export type AlertDecision = { notify: boolean; suppressedCount: number };

export interface EventStore {
  save(event: MonitorEvent): Promise<void>;
  shouldNotify(event: MonitorEvent, cooldownMs: number): Promise<AlertDecision>;
  close?(): Promise<void>;
}

export interface Notifier {
  send(event: MonitorEvent, suppressedCount: number): Promise<void>;
}

export type MonitorOptions = {
  appName: string;
  environment: string;
  databaseUrl?: string;
  store?: EventStore;
  notifier?: Notifier;
  release?: string;
  cooldownMinutes?: number;
  redactKeys?: string[];
  console?: boolean;
};

export type ReportResult = {
  event: MonitorEvent;
  stored: boolean;
  notified: boolean;
  notificationError?: Error;
};

export type RelayMonitorOptions = {
  appName: string;
  endpoint: string;
  apiKey: string;
  environment?: string;
  release?: string;
  redactKeys?: string[];
};
