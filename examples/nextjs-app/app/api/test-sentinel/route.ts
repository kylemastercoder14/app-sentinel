import { NextResponse } from "next/server";
import { monitor } from "../../../lib/monitor";

// Keep this route development-only or protect it with staff authentication.
export async function GET() {
  try {
    throw new Error("Intentional App Sentinel test error");
  } catch (error) {
    await monitor.reportError(error, {
      route: "/api/test-sentinel",
      area: "monitoring-test",
      authorization: "this value will be redacted",
    });
    return NextResponse.json({ ok: true, message: "Test event submitted. Check Mailpit." });
  }
}
