import * as React from "react";
import nodemailer from "nodemailer";
import { render, toPlainText } from "@react-email/render";
import { ErrorAlertEmail } from "../templates/error-alert-email.js";
import type { MonitorEvent, Notifier } from "../types.js";

// Fixed sender for every consuming app. Do not turn this into per-app configuration.
export const APP_SENTINEL_FROM = "App Sentinel <developer.kyleandrelim@gmail.com>";

export type NodemailerNotifierOptions = {
  host: string;
  port: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  to: string;
};

export function nodemailerNotifier(options: NodemailerNotifierOptions): Notifier {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure ?? options.port === 465,
    auth: options.auth,
  });
  return {
    async send(event: MonitorEvent, suppressedCount: number): Promise<void> {
      const template = React.createElement(ErrorAlertEmail, { event, suppressedCount });
      const html = await render(template);
      await transport.sendMail({
        from: APP_SENTINEL_FROM,
        to: options.to,
        subject: `[${event.environment.toUpperCase()}] ${event.appName} — ${event.error?.name ?? "Application error"}`,
        html,
        text: toPlainText(html),
      });
    },
  };
}
