import { createHash } from "node:crypto";
import type { NormalizedError } from "./types.js";

export function fingerprintError(error: NormalizedError): string {
  const frames = error.stack?.split("\n").slice(1, 5).join("\n") ?? "";
  return createHash("sha256").update(`${error.name}\n${error.message}\n${frames}`).digest("hex").slice(0, 16);
}
