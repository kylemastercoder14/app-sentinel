# @kylealimdev/app-sentinel

Server-side TypeScript error reporting with PostgreSQL event storage, email alerts, structured logs, and simple traces. It is designed for the maintainer's internal Node.js and Next.js projects.

## What version 0.1.0 includes

- Error normalization, stack traces, SHA-256 fingerprints, and PostgreSQL storage.
- Recursive sensitive-data redaction.
- Per-error alert cooldowns stored in PostgreSQL.
- Rich React Email alerts delivered by Nodemailer.
- JSON logs and simple async-operation duration traces.
- Docker Compose setup for local PostgreSQL and Mailpit.

## Important sender rule

The sender is fixed in `src/notifiers/nodemailer.ts` as `APP_SENTINEL_FROM` (`developer.kyleandrelim@gmail.com`). Do not add a per-app `from` option.

The dedicated sender account's SMTP username and app password are secrets supplied by the deployed app. Each app only chooses its recipient using `APP_SENTINEL_ALERT_TO`.

## Local setup

```bash
npm install
docker compose up -d
copy .env.example .env
npm run migrate
npm test
npm run build
npm run test:local
```

Open [Mailpit](http://localhost:8025) to inspect development emails. PostgreSQL uses host port `5433` locally so it does not collide with an existing local PostgreSQL service. Do not use the local Docker password in production.

`npm run test:local` sends one intentional error, stores it in PostgreSQL, and delivers it to Mailpit. Run it again within 30 minutes to confirm alert cooldown: the event is stored, but a second email is not sent.

## Configure an app

```ts
import { createMonitor, nodemailerNotifier } from "@kylealimdev/app-sentinel";

export const monitor = createMonitor({
  appName: "community-store",
  environment: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.APP_SENTINEL_DATABASE_URL,
  notifier: nodemailerNotifier({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    to: process.env.APP_SENTINEL_ALERT_TO!,
  }),
});
```

```ts
try {
  await createOrder();
} catch (error) {
  await monitor.reportError(error, { route: "/api/checkout", orderId, userId });
  throw error;
}
```

## Production environment variables

```env
APP_SENTINEL_DATABASE_URL=postgresql://app_sentinel:strong-password@127.0.0.1:5432/app_sentinel
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=developer.kyleandrelim@gmail.com
SMTP_PASSWORD=your-dedicated-email-app-password
APP_SENTINEL_ALERT_TO=owner@example.com
```

Never commit this file or publish these values to npm.

## Verification checklist

1. Run migrations.
2. Start the Next.js example and call `GET /api/test-sentinel` in development.
3. Open Mailpit, confirm the email and redacted `authorization` field.
4. Trigger the same error again inside 30 minutes; confirm it is saved but does not email again.
