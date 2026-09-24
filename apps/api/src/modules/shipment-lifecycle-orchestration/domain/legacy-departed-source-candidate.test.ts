import fixture from "@logix/contracts/post-departure-container-operational-source.json";
import { describe, expect, it } from "vitest";
import {
  prepareLegacyDepartedSourceCandidate,
  type LegacyDepartedSourceRecord,
} from "./legacy-departed-source-candidate";

const records = fixture.records as LegacyDepartedSourceRecord[];

describe("prepareLegacyDepartedSourceCandidate", () => {
  it("preserves every real detail record identity and observable quantity", () => {
    const candidates = records.map(prepareLegacyDepartedSourceCandidate);

    expect(candidates).toHaveLength(10);
    expect(candidates.map(({ containerNumber }) => containerNumber)).toEqual(
      records.map(({ containerNumber }) => containerNumber),
    );
    expect(candidates[0]).toMatchObject({
      sourceIdentity: {
        sourceSha256:
          "d2cefca2cd3b60daea6e7301f3bbbc786db5a9006373827b9fa17a130b8627f7",
        sourceRange: "A1:CS2",
      },
      containerNumber: "MSNU9762671",
      replenishmentOrderNumber: "26DSA01884",
      billNumber: "1811F026PE36669R2",
      observedShipment: {
        carrierCode: "MSC",
        vesselName: "MSC MAKALU III",
        voyageNumber: "HD638A",
        originPortRaw: "福州",
        destinationPortRaw: "萨凡纳",
        cargoOwnerNameRaw: "AOSOM LLC",
        cargoOwnerName: "AOSOM LLC",
        cargoOwnerReferenceId: "cb0d6214-2f8b-5de6-a8e4-afcc0411f4d3",
        internalCountryShortCode: "US",
        salesCountryCode: "US",
        departureRaw: "2026-09-23 00:00:00",
        estimatedArrivalRaw: "2026-11-01 00:00:00",
        sourceLogisticsStatus: "已出运",
      },
      observedContainer: {
        containerTypeCode: "40HQ",
        packageCount: "367",
        grossWeightKg: "12511.3",
        volumeM3: "68.4",
      },
    });
  });

  it("keeps all ten real records in review instead of inventing missing facts", () => {
    const candidates = records.map(prepareLegacyDepartedSourceCandidate);

    for (const candidate of candidates) {
      expect(candidate.issues.map(({ code }) => code)).toEqual([
        "SOURCE_RANGE_METADATA_INVALID",
        "UNKNOWN_REFERENCE_CODE",
        "UNKNOWN_REFERENCE_CODE",
        "DEPARTURE_PROOF_REQUIRED",
        "CARGO_DETAIL_INCOMPLETE",
      ]);
    }
  });

  it("keeps the internal UK abbreviation separate from ISO country code GB", () => {
    const candidate = prepareLegacyDepartedSourceCandidate({
      ...records[0]!,
      values: { ...records[0]!.values, 销往国家: "MH   STAR UK LTD" },
    });

    expect(candidate.observedShipment).toMatchObject({
      cargoOwnerNameRaw: "MH   STAR UK LTD",
      cargoOwnerName: "MH STAR UK LTD",
      cargoOwnerReferenceId: "661238b9-39e3-55e5-9023-25f4c790f864",
      internalCountryShortCode: "UK",
      salesCountryCode: "GB",
    });
    expect(candidate.issues).not.toContainEqual(
      expect.objectContaining({ code: "FIELD_SEMANTIC_MISMATCH" }),
    );
  });

  it("requires review for an unknown cargo owner instead of guessing a country", () => {
    const candidate = prepareLegacyDepartedSourceCandidate({
      ...records[0]!,
      values: { ...records[0]!.values, 销往国家: "UNKNOWN COMPANY" },
    });

    expect(candidate.observedShipment).toMatchObject({
      cargoOwnerNameRaw: "UNKNOWN COMPANY",
      cargoOwnerName: null,
      cargoOwnerReferenceId: null,
      internalCountryShortCode: null,
      salesCountryCode: null,
    });
    expect(candidate.issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_REFERENCE_CODE",
        fieldCodes: ["cargo_owner_reference_id", "sales_country_code"],
      }),
    );
  });
});
