import { createMonitor, nodemailerNotifier } from "@kylealimdev/app-sentinel";

export const monitor = createMonitor({
  appName: "community-store",
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.APP_VERSION,
  databaseUrl: process.env.APP_SENTINEL_DATABASE_URL,
  notifier: nodemailerNotifier({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    to: process.env.APP_SENTINEL_ALERT_TO ?? "developer@app-sentinel.local",
  }),
});
