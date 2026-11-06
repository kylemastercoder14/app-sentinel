import { describe, expect, it } from "vitest";
import { redact } from "../src/redact.js";

describe("redact", () => {
  it("redacts sensitive nested values", () => {
    expect(redact({ token: "secret", child: { Password: "hidden", orderId: "ord_1" } })).toEqual({
      token: "[REDACTED]", child: { Password: "[REDACTED]", orderId: "ord_1" },
    });
  });

  it("handles circular metadata", () => {
    const input: Record<string, unknown> = {}; input.self = input;
    expect(redact(input)).toEqual({ self: "[CIRCULAR]" });
  });
});
