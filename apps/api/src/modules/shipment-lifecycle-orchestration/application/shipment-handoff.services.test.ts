import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffCommandV2,
} from "@logix/contracts";
import { describe, expect, it, vi } from "vitest";
import { AcceptShipmentHandoffService } from "./accept-shipment-handoff.service";
import { PreflightShipmentHandoffService } from "./preflight-shipment-handoff.service";

const command: ShipmentHandoffCommandV1 = {
  contractVersion: "shipment-handoff.v1",
  tenantId: "70000000-0000-4000-8000-000000000001",
  sourceProfile: "api_v1",
  source: {
    channel: "api",
    system: "packing-platform",
    externalHandoffId: "handoff-001",
    handoffVersion: 1,
    occurredAt: "2026-09-23T01:00:00+08:00",
    idempotencyKey: "packing-platform:handoff-001:1",
    correlationId: "70000000-0000-4000-8000-000000000002",
    traceId: "trace-shipment-handoff-001",
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
      evidenceRef: "70000000-0000-4000-8000-000000000003",
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
      externalContainerId: "container-external-1",
      containerNumber: "HMMU4956442",
      containerTypeCode: "40HQ",
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
  evidenceReferences: ["70000000-0000-4000-8000-000000000003"],
};

const context = {
  tenantId: command.tenantId,
  actorId: "70000000-0000-4000-8000-000000000009",
};

describe("Shipment Handoff application services", () => {
  const noDatabaseConflicts = {
    inspect: vi.fn().mockResolvedValue({ duplicate: false, issues: [] }),
  };

  it("validates the public contract before business preflight", async () => {
    const service = new PreflightShipmentHandoffService(
      noDatabaseConflicts as never,
    );
    await expect(
      service.preflight({ ...command, unsupportedField: true }, context),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns a stable boundary error for malformed input", async () => {
    const service = new PreflightShipmentHandoffService(
      noDatabaseConflicts as never,
    );
    await expect(
      service.preflight({ contractVersion: "shipment-handoff.v1" }, context),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a command that crosses the authenticated tenant", async () => {
    const service = new PreflightShipmentHandoffService(
      noDatabaseConflicts as never,
    );
    await expect(
      service.preflight(command, {
        ...context,
        tenantId: "other-tenant",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("re-runs preflight and passes the normalized command to the atomic port", async () => {
    const commit = {
      execute: vi.fn().mockResolvedValue({ handoffId: "handoff-id" }),
    };
    const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
    const service = new AcceptShipmentHandoffService(
      new PreflightShipmentHandoffService(noDatabaseConflicts as never),
      commit as never,
      evidence as never,
    );

    await service.accept(command, context);

    expect(commit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: context.actorId,
        command: expect.objectContaining({
          tenantId: command.tenantId,
          contractVersion: "shipment-handoff.v1",
        }),
        preflight: expect.objectContaining({ decision: "ready" }),
      }),
    );
    expect(evidence.execute).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      evidenceIds: ["70000000-0000-4000-8000-000000000003"],
    });
  });

  it("allows a review-required handoff to continue while validating known evidence", async () => {
    const commit = {
      execute: vi.fn().mockResolvedValue({
        businessDecisionState: "review_required",
      }),
    };
    const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
    const reviewCommand: ShipmentHandoffCommandV1 = {
      ...command,
      sourceProfile: "legacy_departed_file_v1",
      source: {
        ...command.source,
        channel: "file_import",
        sourceBatchId: "70000000-0000-4000-8000-000000000005",
        mappingVersion: "legacy-detail-v1",
      },
      containers: command.containers.map((container) => ({
        ...container,
        cargoAllocations: undefined,
      })) as ShipmentHandoffCommandV1["containers"],
    };
    const service = new AcceptShipmentHandoffService(
      new PreflightShipmentHandoffService(noDatabaseConflicts as never),
      commit as never,
      evidence as never,
    );

    await service.accept(reviewCommand, context);

    expect(evidence.execute).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      evidenceIds: ["70000000-0000-4000-8000-000000000003"],
    });
    expect(commit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        preflight: expect.objectContaining({ decision: "review_required" }),
      }),
    );
  });

  it("accepts a v2 departed Shipment with business facts still pending", async () => {
    const commit = {
      execute: vi.fn().mockResolvedValue({ shipmentId: "shipment-id" }),
    };
    const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
    const incomplete: ShipmentHandoffCommandV2 = {
      contractVersion: "shipment-handoff.v2",
      tenantId: "demo-real-sample-20260921",
      sourceProfile: "legacy_departed_file_v1",
      source: {
        ...command.source,
        channel: "file_import",
        mappingVersion: "post_departure_source_package.v1",
      },
      shipment: { transportMode: "ocean" },
      billsOfLading: [],
      containers: [
        {
          referenceId: "candidate-1",
          externalContainerId: "candidate-1",
          billReferences: [],
          upstreamReferences: [],
        },
      ],
      evidenceReferences: [],
    };
    const service = new AcceptShipmentHandoffService(
      new PreflightShipmentHandoffService(noDatabaseConflicts as never),
      commit as never,
      evidence as never,
    );

    await service.accept(incomplete, {
      ...context,
      tenantId: incomplete.tenantId,
    });

    expect(evidence.execute).not.toHaveBeenCalled();
    expect(commit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          contractVersion: "shipment-handoff.v2",
        }),
        preflight: expect.objectContaining({
          decision: "review_required",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "DEPARTURE_PROOF_REQUIRED",
              blocking: false,
            }),
            expect.objectContaining({
              code: "SOURCE_DATA_INCOMPLETE",
              blocking: false,
            }),
          ]),
        }),
      }),
    );
  });

  it("replays an identical handoff without revalidating historical evidence", async () => {
    const duplicateInspector = {
      inspect: vi.fn().mockResolvedValue({ duplicate: true, issues: [] }),
    };
    const commit = {
      execute: vi.fn().mockResolvedValue({ duplicate: true }),
    };
    const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
    const service = new AcceptShipmentHandoffService(
      new PreflightShipmentHandoffService(duplicateInspector as never),
      commit as never,
      evidence as never,
    );

    await service.accept(command, context);

    expect(evidence.execute).not.toHaveBeenCalled();
    expect(commit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        preflight: expect.objectContaining({
          decision: "ready",
          duplicate: true,
        }),
      }),
    );
  });

  it("adds database conflicts and duplicate state to preflight", async () => {
    const databaseConflicts = {
      inspect: vi.fn().mockResolvedValue({
        duplicate: true,
        issues: [
          {
            code: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
            subjectRef: "container-1",
            messageKey: "shipment_handoff_container_active_shipment_conflict",
          },
        ],
      }),
    };
    const service = new PreflightShipmentHandoffService(
      databaseConflicts as never,
    );

    await expect(service.preflight(command, context)).resolves.toMatchObject({
      decision: "rejected",
      duplicate: true,
      issues: [
        expect.objectContaining({
          code: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
        }),
      ],
    });
  });
});
