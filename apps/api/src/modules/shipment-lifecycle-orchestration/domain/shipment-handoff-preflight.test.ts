import type { ShipmentHandoffCommandV1 } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import { preflightShipmentHandoff } from "./shipment-handoff-preflight";

const command: ShipmentHandoffCommandV1 = {
  contractVersion: "shipment-handoff.v1",
  tenantId: "10000000-0000-4000-8000-000000000001",
  sourceProfile: "packing_platform_v1",
  source: {
    channel: "api",
    system: "packing-platform",
    externalHandoffId: "handoff-001",
    handoffVersion: 1,
    occurredAt: "2026-09-23T01:00:00+08:00",
    idempotencyKey: "packing-platform:handoff-001:1",
    correlationId: "10000000-0000-4000-8000-000000000002",
    traceId: "trace-handoff-001",
  },
  shipment: {
    externalShipmentId: "shipment-001",
    shipmentNumber: "SHP-20260923-001",
    transportMode: "ocean",
    carrierCode: "HMM",
    vesselName: "ONE TRUTH",
    voyageNumber: "V001",
    originPortCode: "CNNGB",
    destinationPortCode: "USLAX",
    destinationCountryCode: "US",
    departureProof: {
      kind: "actual_departure_time",
      occurredAt: "2026-09-22T18:00:00+08:00",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "10000000-0000-4000-8000-000000000003",
    },
  },
  billsOfLading: [
    {
      referenceId: "mbl-1",
      documentType: "mbl",
      documentNumber: "MBL001",
      version: 1,
    },
  ],
  containers: [
    {
      referenceId: "container-1",
      containerNumber: "HMMU4956442",
      containerTypeCode: "40HQ",
      stuffingSnapshotRef: "10000000-0000-4000-8000-000000000004",
      billReferences: ["mbl-1"],
      upstreamReferences: [],
      cargoAllocations: [
        {
          sourceLineId: "line-1",
          productNumber: "SKU-001",
          quantity: "10",
          quantityUnit: "piece",
        },
      ],
    },
  ],
  evidenceReferences: ["10000000-0000-4000-8000-000000000003"],
};

describe("preflightShipmentHandoff", () => {
  it("accepts a complete packing handoff and hashes normalized order", () => {
    const first = preflightShipmentHandoff(command);
    const reordered = preflightShipmentHandoff({
      ...command,
      evidenceReferences: [
        ...command.evidenceReferences,
      ].reverse() as ShipmentHandoffCommandV1["evidenceReferences"],
    });

    expect(first.result).toMatchObject({ decision: "ready", issues: [] });
    expect(first.result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered.result.payloadHash).toBe(first.result.payloadHash);
  });

  it("sends a legacy handoff without stable Shipment identity to review", () => {
    const result = preflightShipmentHandoff({
      ...command,
      sourceProfile: "legacy_departed_file_v1",
      source: {
        ...command.source,
        channel: "file_import",
        sourceBatchId: "10000000-0000-4000-8000-000000000005",
        mappingVersion: "legacy-v1",
      },
      shipment: { ...command.shipment, externalShipmentId: undefined },
    }).result;

    expect(result.decision).toBe("review_required");
    expect(result.issues.map(({ code }) => code)).toEqual([
      "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
    ]);
  });

  it("keeps incomplete legacy cargo visible instead of inventing SKU rows", () => {
    const result = preflightShipmentHandoff({
      ...command,
      sourceProfile: "legacy_departed_file_v1",
      source: {
        ...command.source,
        channel: "file_import",
        sourceBatchId: "10000000-0000-4000-8000-000000000005",
        mappingVersion: "legacy-v1",
      },
      containers: [{ ...command.containers[0]!, cargoAllocations: undefined }],
    }).result;

    expect(result.decision).toBe("review_required");
    expect(result.issues.map(({ code }) => code)).toContain(
      "CARGO_DETAIL_INCOMPLETE",
    );
  });

  it("rejects a container that references an unknown bill", () => {
    const result = preflightShipmentHandoff({
      ...command,
      containers: [
        { ...command.containers[0]!, billReferences: ["missing-mbl"] },
      ],
    }).result;

    expect(result.decision).toBe("rejected");
    expect(result.issues.map(({ code }) => code)).toContain(
      "BILL_REFERENCE_NOT_FOUND",
    );
  });

  it("rejects API handoff without actual SKU allocations", () => {
    const result = preflightShipmentHandoff({
      ...command,
      sourceProfile: "api_v1",
      containers: command.containers.map((container) => ({
        ...container,
        cargoAllocations: undefined,
      })) as ShipmentHandoffCommandV1["containers"],
    });

    expect(result.result.decision).toBe("rejected");
    expect(result.result.issues).toContainEqual(
      expect.objectContaining({ code: "CARGO_ALLOCATION_REQUIRED" }),
    );
  });

  it("rejects one source cargo line with inconsistent SKU identity", () => {
    const baseContainer = command.containers[0];
    const result = preflightShipmentHandoff({
      ...command,
      containers: [
        baseContainer,
        {
          ...baseContainer,
          referenceId: "container-2",
          externalContainerId: "container-external-2",
          containerNumber: "HMMU4207629",
          cargoAllocations: [
            {
              ...baseContainer.cargoAllocations![0],
              productNumber: "SKU-CONFLICT",
            },
          ],
        },
      ],
    });

    expect(result.result.decision).toBe("rejected");
    expect(result.result.issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_SOURCE_VALUE" }),
    );
  });

  it("rejects a correction without a predecessor and expected relationship version", () => {
    const result = preflightShipmentHandoff({
      ...command,
      source: {
        ...command.source,
        handoffVersion: 2,
        idempotencyKey: "packing-platform:handoff-001:2",
      },
    }).result;

    expect(result.decision).toBe("rejected");
    expect(result.issues.map(({ code }) => code)).toEqual([
      "SUPERSEDED_HANDOFF_NOT_FOUND",
      "INVALID_SOURCE_VALUE",
    ]);
  });

  it("accepts a structurally complete correction for repository validation", () => {
    const result = preflightShipmentHandoff({
      ...command,
      source: {
        ...command.source,
        handoffVersion: 2,
        supersedesExternalHandoffId: command.source.externalHandoffId,
        idempotencyKey: "packing-platform:handoff-001:2",
      },
      shipment: { ...command.shipment, expectedRelationshipVersion: 1 },
    }).result;

    expect(result).toMatchObject({ decision: "ready", issues: [] });
  });
});
