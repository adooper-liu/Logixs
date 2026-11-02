import { createHash } from "node:crypto";
import Ajv from "ajv";

export type ReferenceDataset = "carrier" | "container_type" | "port";
export interface ProfileMapping {
  namespace: string;
  sourceCode: string;
  canonicalCode: string | null;
  reason: string;
  evidence: string;
}
export interface ProfileDataset {
  dataset: ReferenceDataset;
  canonicalReleaseId: string;
  namespaces: string[];
  mappings: ProfileMapping[];
}
export interface ProviderProfile {
  schemaVersion: 1;
  provider: string;
  version: string;
  source: { reference: string; description: string };
  datasets: ProfileDataset[];
}

const text = {
  type: "string",
  minLength: 1,
  maxLength: 1000,
  pattern: "^\\S(?:[\\s\\S]*\\S)?$",
};
const code = { ...text, maxLength: 100 };
const validate = new Ajv({ allErrors: true }).compile({
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "provider", "version", "source", "datasets"],
  properties: {
    schemaVersion: { const: 1 },
    provider: { type: "string", pattern: "^[a-z][a-z0-9_-]{0,49}$" },
    version: code,
    source: {
      type: "object",
      additionalProperties: false,
      required: ["reference", "description"],
      properties: { reference: text, description: text },
    },
    datasets: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dataset", "canonicalReleaseId", "namespaces", "mappings"],
        properties: {
          dataset: { enum: ["carrier", "container_type", "port"] },
          canonicalReleaseId: {
            type: "string",
            pattern: "^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$",
          },
          namespaces: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            uniqueItems: true,
            items: code,
          },
          mappings: {
            type: "array",
            maxItems: 1000,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "namespace",
                "sourceCode",
                "canonicalCode",
                "reason",
                "evidence",
              ],
              properties: {
                namespace: code,
                sourceCode: code,
                canonicalCode: { anyOf: [code, { type: "null" }] },
                reason: text,
                evidence: text,
              },
            },
          },
        },
      },
    },
  },
});

export function profileContentHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(sorted(value)))
    .digest("hex");
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sorted(item)]),
    );
  return value;
}

export function parseProviderProfile(input: unknown): {
  profile: ProviderProfile;
  hash: string;
} {
  if (!validate(input))
    throw new Error(
      `INVALID_PROVIDER_PROFILE:${JSON.stringify(validate.errors)}`,
    );
  const profile = structuredClone(input) as ProviderProfile;
  const datasets = new Set<string>();
  for (const dataset of profile.datasets) {
    if (datasets.has(dataset.dataset)) throw new Error("DUPLICATE_DATASET");
    datasets.add(dataset.dataset);
    const keys = new Set<string>();
    for (const mapping of dataset.mappings) {
      if (!dataset.namespaces.includes(mapping.namespace))
        throw new Error("UNSUPPORTED_NAMESPACE");
      if (["logix", "iso3166-1-alpha2", "unlocode"].includes(mapping.namespace))
        throw new Error("STANDARD_NAMESPACE_REQUIRES_VALIDATION_NOT_MAPPING");
      const key = JSON.stringify([mapping.namespace, mapping.sourceCode]);
      if (keys.has(key)) throw new Error("DUPLICATE_MAPPING");
      keys.add(key);
    }
  }
  return { profile, hash: profileContentHash(profile) };
}
