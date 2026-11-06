import { createMonitor, nodemailerNotifier } from "../dist/index.js";

const required = ["APP_SENTINEL_DATABASE_URL", "SMTP_HOST", "SMTP_PORT", "APP_SENTINEL_ALERT_TO"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) throw new Error(`Missing required local environment variables: ${missing.join(", ")}`);

const monitor = createMonitor({
  appName: "app-sentinel-local-test",
  environment: "development",
  databaseUrl: process.env.APP_SENTINEL_DATABASE_URL,
  notifier: nodemailerNotifier({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    to: process.env.APP_SENTINEL_ALERT_TO,
  }),
  console: false,
});

try {
  const result = await monitor.reportError(new Error("Intentional local App Sentinel test"), {
    route: "/local-test",
    orderId: "ord_local_test",
    authorization: "this-must-be-redacted",
  });
  console.log(`Stored: ${result.stored}; email sent: ${result.notified}; fingerprint: ${result.event.fingerprint}`);
  if (result.notificationError) console.warn("Email delivery failed:", result.notificationError.message);
} finally {
  await monitor.close();
}
