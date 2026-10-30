import { describe, expect, it } from "vitest";
import { parseProviderProfile } from "./provider-profile";

export function profileFixture(
  provider = "example-provider",
  version = "1.0.0",
) {
  return {
    schemaVersion: 1,
    provider,
    version,
    source: { reference: "fixture://example", description: "Test source" },
    datasets: [
      {
        dataset: "container_type",
        canonicalReleaseId: "00000000-0000-5000-8000-000000000001",
        namespaces: ["supplier_type", "logix"],
        mappings: [
          {
            namespace: "supplier_type",
            sourceCode: "HQ40",
            canonicalCode: "40HC",
            reason: "Source alias",
            evidence: "fixture://example/row/1",
          },
        ],
      },
    ],
  };
}

describe("provider profile configuration", () => {
  it("accepts different suppliers and makes hashing insensitive to object key order", () => {
    const a = parseProviderProfile(profileFixture());
    expect(a.profile.provider).toBe("example-provider");
    expect(
      parseProviderProfile(profileFixture("another-provider")).hash,
    ).not.toBe(a.hash);
    const raw = profileFixture();
    expect(
      parseProviderProfile({
        ...raw,
        source: {
          description: raw.source.description,
          reference: raw.source.reference,
        },
      }).hash,
    ).toBe(a.hash);
  });
  it("rejects approval, duplicates, empty values, unsupported datasets and namespaces", () => {
    const raw = profileFixture();
    expect(() => parseProviderProfile({ ...raw, approval: true })).toThrow();
    const dataset = raw.datasets[0]!;
    const mapping = dataset.mappings[0]!;
    expect(() =>
      parseProviderProfile({
        ...raw,
        datasets: [{ ...dataset, mappings: [mapping, mapping] }],
      }),
    ).toThrow("DUPLICATE_MAPPING");
    expect(() =>
      parseProviderProfile({
        ...raw,
        datasets: [{ ...dataset, mappings: [{ ...mapping, sourceCode: " " }] }],
      }),
    ).toThrow();
    expect(() =>
      parseProviderProfile({
        ...raw,
        datasets: [{ ...dataset, dataset: "terminal" }],
      }),
    ).toThrow();
    expect(() =>
      parseProviderProfile({
        ...raw,
        datasets: [
          { ...dataset, mappings: [{ ...mapping, namespace: "unknown" }] },
        ],
      }),
    ).toThrow();
  });
});
