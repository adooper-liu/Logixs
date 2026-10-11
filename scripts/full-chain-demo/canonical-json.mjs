import { createHash } from "node:crypto";

export function canonicalStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(",")}}`;
}

export function sha256Hex(value) {
  const input = typeof value === "string" ? value : canonicalStringify(value);
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function sortedEntries(entries = []) {
  return [...entries].sort((a, b) =>
    Buffer.from(canonicalStringify(a)).compare(
      Buffer.from(canonicalStringify(b)),
    ),
  );
}

export function manifestHashProjection(manifest) {
  const projection = { ...manifest };
  for (const field of [
    "generatedAt",
    "operator",
    "traceId",
    "outputPath",
    "receipt",
    "manifestHash",
  ])
    delete projection[field];
  return projection;
}
