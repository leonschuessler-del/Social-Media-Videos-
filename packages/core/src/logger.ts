import pino from "pino";

const REDACT_PATHS = [
  "*.apiKey", "*.api_key", "*.authorization", "*.Authorization", "*.refreshToken", "*.accessToken",
  "req.headers.authorization", "headers.authorization", "*.client_secret", "*.password",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: { service: process.env.SERVICE_NAME ?? "content-os" },
});

export type Logger = typeof logger;
