import { describe, expect, it } from "vitest";
import {
  createValidFullChainPackage,
  mutateRecord,
} from "../test-support/full-chain-package.fixture";
import {
  buildFullChainLandingGraph,
  fullChainLandingProjectionHash,
} from "./landing-graph";

describe("full-chain landing graph", () => {
  it("derives a stable semantic projection hash from facts and typed joins", () => {
    const graph = buildFullChainLandingGraph(createValidFullChainPackage());
    const same = structuredClone(graph);
    same.packageHash = "f".repeat(64);
    expect(fullChainLandingProjectionHash(graph)).toMatch(/^[a-f0-9]{64}$/u);
    expect(fullChainLandingProjectionHash(same)).toBe(
      fullChainLandingProjectionHash(graph),
    );
    same.planCargoReadyLinks = [];
    expect(fullChainLandingProjectionHash(same)).not.toBe(
      fullChainLandingProjectionHash(graph),
    );
  });

  it("normalizes equivalent decimal scales in the semantic projection hash", () => {
    const graph = buildFullChainLandingGraph(createValidFullChainPackage());
    const scaled = structuredClone(graph);
    scaled.cargoReadyReleases[0]!.quantity = "1.000000";
    scaled.stuffingLines[0]!.quantity = "9007199254740993.000000";
    scaled.stuffingLines[0]!.grossWeight = "2.000000";
    scaled.stuffingLines[0]!.volume = "3.000000";
    scaled.exportCustomsCases[0]!.amount = "4.000000";
    expect(fullChainLandingProjectionHash(scaled)).toBe(
      fullChainLandingProjectionHash(graph),
    );
  });

  it("builds exact typed HBL and MBL links without using display groups", () => {
    const graph = buildFullChainLandingGraph(createValidFullChainPackage());

    expect(graph.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentType: "mbl", number: "MBL-1" }),
        expect.objectContaining({
          documentType: "hbl",
          number: "HBL-1",
          parentMasterBillNumber: "MBL-1",
        }),
      ]),
    );
    expect(graph.planCargoReadyLinks).toContainEqual({
      planNumber: "PLAN-1",
      cargoReadyNumber: "CR-1",
    });
    expect(graph.planCargoReadyLinks).not.toContainEqual(
      expect.objectContaining({ cargoReadyNumber: "DISPLAY-GROUP-1" }),
    );
  });

  it.each(["HBL", "BL-1", "HBL-1A"])(
    "rejects fuzzy customs HBL %s",
    (houseBillNo) => {
      const packageArtifacts = mutateRecord(
        createValidFullChainPackage(),
        "export_customs_case",
        (record) => {
          if (record.recordType === "export_customs_case")
            record.payload.houseBillNo = houseBillNo;
        },
      );
      expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
        /FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND/,
      );
    },
  );

  it("rejects an orphan shipment-plan booking", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "shipment_plan",
      (record) => {
        if (record.recordType === "shipment_plan")
          record.payload.bookingNo = "BOOK-MISSING";
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND/,
    );
  });

  it("rejects an orphan cargo-ready reference", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "stuffing_snapshot_line",
      (record) => {
        if (record.recordType === "stuffing_snapshot_line")
          record.payload.cargoReadyNo = "CR-MISSING";
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND/,
    );
  });

  it("rejects dispatch MBL mismatch", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "dispatch_fact",
      (record) => {
        if (record.recordType === "dispatch_fact")
          record.payload.masterBillNo = "MBL-MISSING";
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND/,
    );
  });

  it("rejects dispatch HBL mismatch", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "dispatch_fact",
      (record) => {
        if (record.recordType === "dispatch_fact")
          record.payload.houseBillRefs = ["HBL-MISSING"];
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND/,
    );
  });

  it("rejects a typed HBL claimed by two bookings", () => {
    const packageArtifacts = createValidFullChainPackage();
    const booking = packageArtifacts.records.find(
      (record) => record.recordType === "booking_commitment",
    );
    if (!booking || booking.recordType !== "booking_commitment")
      throw new Error("TEST_BOOKING_NOT_FOUND");
    const duplicate = structuredClone(booking);
    duplicate.businessKey = "BOOK-2";
    duplicate.payload.bookingNo = "BOOK-2";
    duplicate.payload.masterBillNo = "MBL-2";
    duplicate.source = {
      ...duplicate.source,
      row: 20,
      sourceRef: "09a_订舱#20",
    };
    packageArtifacts.records.push(duplicate);
    packageArtifacts.lineage.push({
      recordRef: "booking_commitment:BOOK-2",
      sourceRef: duplicate.source.sourceRef,
      payloadFields: Object.keys(duplicate.payload).sort(),
    });

    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_TYPED_REFERENCE_AMBIGUOUS/,
    );
  });

  it("rejects duplicate canonical business identity", () => {
    const packageArtifacts = createValidFullChainPackage();
    packageArtifacts.records.push(
      structuredClone(packageArtifacts.records[0]!),
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_DUPLICATE_BUSINESS_KEY/,
    );
  });

  it("rejects HBL and AMS tokens combined as one typed reference", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "booking_commitment",
      (record) => {
        if (record.recordType === "booking_commitment")
          record.payload.houseBillRefs = ["HBL-1 / AMS-1"];
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_TYPED_REFERENCE_INVALID/,
    );
  });

  it("preserves date precision and high decimal values as strings", () => {
    const graph = buildFullChainLandingGraph(createValidFullChainPackage());
    expect(graph.dispatchFacts[0]).toMatchObject({
      departedAt: "2026-09-18",
      departedPrecision: "date",
    });
    expect(graph.dispatchFacts[0]).not.toHaveProperty("departedInstant");
    expect(graph.stuffingLines[0]?.quantity).toBe("9007199254740993.000");
  });

  it("rejects a record without its exact package lineage", () => {
    const packageArtifacts = createValidFullChainPackage();
    packageArtifacts.lineage = packageArtifacts.lineage.slice(1);
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_LINEAGE_INCOMPLETE/,
    );
  });

  it("rejects FC-D07 contributor omission even when every declared ref exists", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "stuffing_snapshot_line",
      (record) => {
        if (record.recordType === "stuffing_snapshot_line")
          record.aggregation = {
            code: "FC-D07",
            contributorRefs: [record.source.sourceRef],
          };
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_LINEAGE_INCOMPLETE/,
    );
  });

  it("accepts complete FC-D07 contributor proof", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "stuffing_snapshot_line",
      (record) => {
        if (record.recordType === "stuffing_snapshot_line")
          record.aggregation = {
            code: "FC-D07",
            contributorRefs: [record.source.sourceRef, "11_装箱#source-two"],
          };
      },
    );
    packageArtifacts.lineage.push({
      recordRef: "stuffing_snapshot_line:CONT-1|CR-1|SKU-1|HBL-1",
      sourceRef: "11_装箱#source-two",
      payloadFields: [
        "containerNo",
        "cargoReadyNo",
        "sku",
        "houseBillNo",
        "quantity",
        "grossWeight",
        "volume",
      ],
    });
    expect(() => buildFullChainLandingGraph(packageArtifacts)).not.toThrow();
  });

  it("rejects derived multi-source input refs absent from package lineage", () => {
    const packageArtifacts = mutateRecord(
      createValidFullChainPackage(),
      "stuffing_snapshot_line",
      (record) => {
        record.evidenceClass = "D";
        record.derivation = {
          code: "FC-D07",
          version: "v0.5.1",
          inputRefs: [record.source.sourceRef, "11_装箱#source-two"],
        };
      },
    );
    expect(() => buildFullChainLandingGraph(packageArtifacts)).toThrowError(
      /FULL_CHAIN_LINEAGE_INCOMPLETE/,
    );
  });
});
