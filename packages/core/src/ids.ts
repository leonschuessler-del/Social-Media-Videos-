import { randomUUID } from "node:crypto";

/** Zeitlich sortierbare, kollisionsfreie IDs (UUID v4 + Zeitpräfix für Lesbarkeit in Logs). */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
