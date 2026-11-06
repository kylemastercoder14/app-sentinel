const DEFAULT_REDACT_KEYS = [
  "password", "passcode", "secret", "token", "authorization", "cookie",
  "set-cookie", "apikey", "api_key", "cardnumber", "cvv", "accountnumber",
];

export function redact(value: unknown, extraKeys: string[] = []): unknown {
  const blocked = new Set([...DEFAULT_REDACT_KEYS, ...extraKeys].map((key) => key.toLowerCase()));
  const seen = new WeakSet<object>();

  const visit = (input: unknown, depth = 0): unknown => {
    if (depth > 8) return "[TRUNCATED]";
    if (input === null || input === undefined || typeof input === "boolean" || typeof input === "number") return input;
    if (typeof input === "string") return input.length > 4_000 ? `${input.slice(0, 4_000)}…[TRUNCATED]` : input;
    if (typeof input === "bigint") return input.toString();
    if (typeof input === "function" || typeof input === "symbol") return `[${typeof input}]`;
    if (input instanceof Date) return input.toISOString();
    if (typeof input !== "object") return String(input);
    if (seen.has(input)) return "[CIRCULAR]";
    seen.add(input);
    if (Array.isArray(input)) return input.slice(0, 100).map((item) => visit(item, depth + 1));
    return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([key, item]) => [
      key,
      blocked.has(key.toLowerCase()) ? "[REDACTED]" : visit(item, depth + 1),
    ]));
  };
  return visit(value);
}
