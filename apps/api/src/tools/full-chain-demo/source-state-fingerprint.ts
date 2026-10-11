import { createHash } from "node:crypto";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value
      .map(canonical)
      .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
      .join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

export function sourceStateFingerprint(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}
