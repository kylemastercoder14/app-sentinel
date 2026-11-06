import * as React from "react";
import { Body, CodeBlock, Container, Head, Heading, Html, Preview, Section, Text, dracula } from "@react-email/components";
import type { MonitorEvent } from "../types.js";

export function ErrorAlertEmail({ event, suppressedCount }: { event: MonitorEvent; suppressedCount: number }) {
  const details = {
    application: event.appName,
    environment: event.environment,
    occurredAt: event.timestamp,
    release: event.release ?? "Not supplied",
    fingerprint: event.fingerprint ?? "Not supplied",
    occurrencesSinceLastEmail: suppressedCount + 1,
    ...(event.context ?? {}),
  };
  return (
    <Html>
      <Head />
      <Preview>[{event.environment}] {event.appName} — {event.error?.name ?? "Application error"}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Application error detected</Heading>
          <Text style={styles.lead}>{event.error?.name ?? "Error"}: {event.message}</Text>
          <Section>
            <Heading as="h2" style={styles.subheading}>Details</Heading>
            <CodeBlock code={JSON.stringify(details, null, 2)} language="json" theme={dracula} />
          </Section>
          {event.trace && <Section>
            <Heading as="h2" style={styles.subheading}>Trace</Heading>
            <CodeBlock code={JSON.stringify(event.trace, null, 2)} language="json" theme={dracula} />
          </Section>}
          {event.error?.stack && <Section>
            <Heading as="h2" style={styles.subheading}>Stack trace</Heading>
            <CodeBlock code={event.error.stack} language="javastacktrace" theme={dracula} />
          </Section>}
          <Text style={styles.footer}>Sensitive fields configured in App Sentinel are redacted before delivery.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: "#f6f8fa", fontFamily: "Arial, sans-serif", color: "#1f2937" },
  container: { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", margin: "32px auto", maxWidth: "680px", padding: "24px" },
  heading: { fontSize: "24px", margin: "0 0 16px" },
  subheading: { fontSize: "16px", margin: "24px 0 8px" },
  lead: { fontSize: "15px", lineHeight: "1.5" },
  footer: { color: "#6b7280", fontSize: "12px", marginTop: "24px" },
};
