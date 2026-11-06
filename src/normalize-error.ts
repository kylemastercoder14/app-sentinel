import type { NormalizedError } from "./types.js";

export function normalizeError(input: unknown): NormalizedError {
  if (input instanceof Error) {
    const cause = input.cause instanceof Error ? input.cause.message : input.cause ? String(input.cause) : undefined;
    return { name: input.name || "Error", message: input.message || "Unknown error", stack: input.stack?.slice(0, 12_000), cause };
  }
  if (typeof input === "string") return { name: "Error", message: input };
  try {
    return { name: "NonErrorThrown", message: JSON.stringify(input) };
  } catch {
    return { name: "NonErrorThrown", message: String(input) };
  }
}
