import pino from "pino";
import { env } from "./env";

// Basic PII redaction: phone/email fields anywhere in the log payload.
const REDACT_PATHS = [
  "req.body.phone",
  "req.body.email",
  "*.phone",
  "*.email",
  "*.guestPhone",
  "*.guestEmail",
  "*.password",
  "*.passwordHash",
  "*.encryptedValue",
];

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
      : undefined,
});

/** Redacts an email/phone string for inline log messages (not structured fields). */
export function redactContact(value: string | null | undefined): string {
  if (!value) return "";
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (value.length > 4) {
    return `${value.slice(0, 3)}***${value.slice(-2)}`;
  }
  return "***";
}
