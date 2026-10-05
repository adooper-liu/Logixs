import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const ISO_4217_LIST_ONE_URL =
  "https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml";

export function generateCurrencyReferenceSnapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    invalid("root");
  const release = input.release;
  if (!release || typeof release !== "object" || Array.isArray(release)) {
    invalid("release");
  }
  if (input.schemaVersion !== "1.0.0") invalid("schemaVersion");
  if (
    !["synthetic_rehearsal", "authorized_official"].includes(input.fixtureKind)
  ) {
    invalid("fixtureKind");
  }
  if (release.authority !== "SIX") invalid("release.authority");
  if (release.datasetCode !== "ISO_4217_LIST_ONE") {
    invalid("release.datasetCode");
  }
  if (release.sourceUrl !== ISO_4217_LIST_ONE_URL) invalid("release.sourceUrl");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.version)) invalid("release.version");
  if (release.publishedAt !== release.version) invalid("release.publishedAt");
  if (!validTimestamp(release.retrievedAt)) invalid("release.retrievedAt");
  if (!/^[0-9a-f]{64}$/.test(release.sourceSha256 ?? "")) {
    invalid("release.sourceSha256");
  }
  if (typeof release.license !== "string" || !release.license.trim()) {
    invalid("release.license");
  }
  if (!["staged", "active", "superseded"].includes(release.status)) {
    invalid("release.status");
  }
  if (
    input.fixtureKind === "synthetic_rehearsal" &&
    release.status !== "staged"
  ) {
    throw new Error("Synthetic rehearsal currency data must remain staged");
  }
  if (!Array.isArray(input.records) || input.records.length === 0) {
    invalid("records");
  }

  const byAlphaCode = new Map();
  for (const source of input.records) {
    const record = normalizeRecord(source);
    const current = byAlphaCode.get(record.alphaCode);
    if (current && JSON.stringify(current) !== JSON.stringify(record)) {
      throw new Error(`Conflicting currency metadata: ${record.alphaCode}`);
    }
    byAlphaCode.set(record.alphaCode, record);
  }
  const records = [...byAlphaCode.values()].sort((left, right) =>
    left.alphaCode.localeCompare(right.alphaCode),
  );
  const numericCodes = new Set();
  for (const record of records) {
    if (numericCodes.has(record.numericCode)) {
      throw new Error(`Duplicate currency numeric code: ${record.numericCode}`);
    }
    numericCodes.add(record.numericCode);
  }
  const releaseKey = `iso-4217-list-one:${release.version}`;
  const generatedRecords = records.map((record) => ({
    id: deterministicUuid(`${releaseKey}:${record.alphaCode}`),
    ...record,
    sourceRowHash: sha256(JSON.stringify(record)),
  }));
  const recordsSha256 = sha256(JSON.stringify(generatedRecords));
  if (release.recordsSha256 && release.recordsSha256 !== recordsSha256) {
    throw new Error("Currency records hash mismatch");
  }

  return {
    schemaVersion: "1.0.0",
    fixtureKind: input.fixtureKind,
    release: {
      id: deterministicUuid(releaseKey),
      authority: "SIX",
      datasetCode: "ISO_4217_LIST_ONE",
      version: release.version,
      publishedAt: release.publishedAt,
      sourceUrl: ISO_4217_LIST_ONE_URL,
      retrievedAt: new Date(release.retrievedAt).toISOString(),
      sourceSha256: release.sourceSha256,
      recordsSha256,
      license: release.license.trim(),
      status: release.status,
    },
    recordCount: generatedRecords.length,
    records: generatedRecords,
  };
}

export function validateCurrencyReferenceSnapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalid("root");
  }
  if (
    Object.keys(input).sort().join(",") !==
    "fixtureKind,recordCount,records,release,schemaVersion"
  ) {
    invalid("root.properties");
  }
  if (!Number.isInteger(input.recordCount) || input.recordCount < 1) {
    invalid("recordCount");
  }
  const canonical = generateCurrencyReferenceSnapshot(input);
  if (input.recordCount !== canonical.recordCount) invalid("recordCount");
  if (stableStringify(input.release) !== stableStringify(canonical.release)) {
    invalid("release");
  }
  if (stableStringify(input.records) !== stableStringify(canonical.records)) {
    invalid("records");
  }
  return canonical;
}

export function validateAuthorizedCurrencyReferenceSnapshot(input) {
  const snapshot = validateCurrencyReferenceSnapshot(input);
  if (snapshot.fixtureKind !== "authorized_official") {
    throw new Error("CURRENCY_REFERENCE_IMPORT_REQUIRES_AUTHORIZED_OFFICIAL");
  }
  if (snapshot.release.status !== "active") {
    throw new Error("AUTHORIZED_CURRENCY_RELEASE_MUST_BE_ACTIVE");
  }
  return snapshot;
}

function normalizeRecord(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    invalid("records[]");
  }
  const alphaCode = source.alphaCode;
  const numericCode = source.numericCode;
  const currencyName = source.currencyName;
  const minorUnit = source.minorUnit;
  if (!/^[A-Z]{3}$/.test(alphaCode ?? "")) invalid("records[].alphaCode");
  if (!/^\d{3}$/.test(numericCode ?? "")) invalid("records[].numericCode");
  if (typeof currencyName !== "string" || !currencyName.trim()) {
    invalid("records[].currencyName");
  }
  if (
    minorUnit !== null &&
    (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 9)
  ) {
    invalid("records[].minorUnit");
  }
  return {
    alphaCode,
    numericCode,
    minorUnit,
    currencyName: currencyName.trim(),
  };
}

function validTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function deterministicUuid(value) {
  const bytes = Buffer.from(sha256(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function invalid(field) {
  throw new Error(`Invalid currency snapshot: ${field}`);
}

async function main() {
  const [modeOrInputPath, inputOrOutputPath, possibleOutputPath] =
    process.argv.slice(2);
  if (modeOrInputPath === "--validate") {
    if (!inputOrOutputPath || possibleOutputPath) {
      throw new Error(
        "Usage: node generate-currency-reference-snapshot.mjs --validate <snapshot.json>",
      );
    }
    const snapshot = JSON.parse(await readFile(inputOrOutputPath, "utf8"));
    const validated = validateCurrencyReferenceSnapshot(snapshot);
    console.log(
      `Currency snapshot valid: ${validated.fixtureKind} ${validated.release.version} (${validated.recordCount} records)`,
    );
    return;
  }
  const inputPath = modeOrInputPath;
  const outputPath = inputOrOutputPath;
  if (!inputPath || !outputPath) {
    throw new Error(
      "Usage: node generate-currency-reference-snapshot.mjs <input.json> <output.json>",
    );
  }
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const snapshot = generateCurrencyReferenceSnapshot(input);
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
