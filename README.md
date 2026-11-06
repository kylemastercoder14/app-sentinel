# @kylealimdev/app-sentinel

Server-side TypeScript error reporting with PostgreSQL event storage, email alerts, structured logs, and simple traces. It is designed for the maintainer's internal Node.js and Next.js projects.

## What version 0.2.0 includes

- Error normalization, stack traces, SHA-256 fingerprints, and PostgreSQL storage.
- Recursive sensitive-data redaction.
- Per-error alert cooldowns stored in PostgreSQL.
- Rich React Email alerts delivered by Nodemailer.
- JSON logs and simple async-operation duration traces.
- Docker Compose setup for local PostgreSQL and Mailpit.
- A self-hosted relay that centralizes PostgreSQL and SMTP credentials.
- A client initializer that registers an app and writes its relay configuration.

## Important sender rule

The sender is fixed in `src/notifiers/nodemailer.ts` as `APP_SENTINEL_FROM`. Do not add a per-app `from` option.

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

## Next.js example

The example is a self-contained Next.js project, so it has its own dependencies and TypeScript configuration. From `examples/nextjs-app`:

```bash
copy .env.local.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000/api/test-sentinel` while PostgreSQL and Mailpit are running. The sample installs `@kylealimdev/app-sentinel` from npm.

## Version 0.2 Relay setup

The relay runs once on your local machine or VPS. It owns the shared monitoring database, Gmail/SMTP credentials, and recipient registrations. Consuming apps do not receive database or SMTP credentials.

```bash
copy .env.example .env
npm run migrate
npm run build
npm run relay
```

For production, put these only on the relay host:

```env
APP_SENTINEL_RELAY_DATABASE_URL=postgresql://app_sentinel:strong-password@127.0.0.1:5432/app_sentinel
APP_SENTINEL_RELAY_ADMIN_TOKEN=a-long-random-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-dedicated-sender@example.com
SMTP_PASSWORD=your-dedicated-email-app-password
PORT=4318
```

Never expose the relay admin token, database URL, or SMTP password to a consuming application.

### Register a consuming app

Run this from the consuming app's directory after the relay is reachable:

```bash
$env:APP_SENTINEL_RELAY_ADMIN_TOKEN="YOUR_RELAY_ADMIN_TOKEN"
pnpm exec app-sentinel init --relay-url https://your-relay.example.com --app-name community-store
$env:APP_SENTINEL_RELAY_ADMIN_TOKEN=$null
```

The command asks only for the email address that should receive the app's alerts. It registers the app with the relay, generates a unique app key, and writes these machine values to the consuming app's `.env.local`:

```env
APP_SENTINEL_RELAY_URL=https://your-relay.example.com
APP_SENTINEL_APP_KEY=generated-private-key
```

Do not commit the generated app key. The relay stores the recipient email, so application code never needs database or SMTP configuration.

### Use the relay in a Next.js app

```ts
import { createRelayMonitorFromEnv } from "@kylealimdev/app-sentinel";

export const monitor = createRelayMonitorFromEnv("community-store");
```

Use `monitor` in server-side Route Handlers, Server Actions, or backend services:

```ts
try {
  await createOrder();
} catch (error) {
  await monitor.reportError(error, { route: "/api/checkout", orderId, userId });
  throw error;
}
```

## Direct database mode (version 0.1 compatibility)

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
SMTP_USER=your-dedicated-sender@example.com
SMTP_PASSWORD=your-dedicated-email-app-password
APP_SENTINEL_ALERT_TO=owner@example.com
```

Never commit this file or publish these values to npm.

## Verification checklist

1. Run migrations.
2. Start the Next.js example and call `GET /api/test-sentinel` in development.
3. Open Mailpit, confirm the email and redacted `authorization` field.
4. Trigger the same error again inside 30 minutes; confirm it is saved but does not email again.
