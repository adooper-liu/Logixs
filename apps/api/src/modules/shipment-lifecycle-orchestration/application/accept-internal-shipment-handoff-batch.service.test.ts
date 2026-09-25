import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AcceptInternalShipmentHandoffBatchService } from "./accept-internal-shipment-handoff-batch.service";

const firstCandidateRef = `internal:${"a".repeat(64)}`;
const secondCandidateRef = `internal:${"b".repeat(64)}`;

describe("AcceptInternalShipmentHandoffBatchService", () => {
  it("keeps successful Shipments when another internal candidate conflicts", async () => {
    const acceptInternal = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          contractVersion: "internal-shipment-handoff-accept-result.v1",
          candidateRef: firstCandidateRef,
          handoff: {
            duplicate: false,
            shipmentId: "11111111-1111-4111-8111-111111111111",
            traceId: "trace-accepted",
          },
        })
        .mockRejectedValueOnce(
          new ConflictException("CONTAINER_ACTIVE_SHIPMENT_CONFLICT"),
        ),
    };
    const service = new AcceptInternalShipmentHandoffBatchService(
      acceptInternal as never,
    );

    const result = await service.execute(
      {
        contractVersion: "internal-shipment-handoff-batch-accept.v1",
        candidateRefs: [firstCandidateRef, secondCandidateRef],
        idempotencyKey: "internal-batch:test-1",
      },
      { tenantId: "tenant-a", actorId: "actor-a" },
    );

    expect(result).toMatchObject({
      contractVersion: "internal-shipment-handoff-batch-accept-result.v1",
      items: [
        {
          candidateRefs: [firstCandidateRef],
          status: "accepted",
          shipmentId: "11111111-1111-4111-8111-111111111111",
          errorCode: null,
          traceId: "trace-accepted",
          recoveryAction: "open_shipment",
        },
        {
          candidateRefs: [secondCandidateRef],
          status: "conflict",
          shipmentId: null,
          errorCode: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
          recoveryAction: "review_candidate",
        },
      ],
      totals: {
        groups: 2,
        accepted: 1,
        duplicate: 0,
        conflict: 1,
        rejected: 0,
        failed: 0,
      },
    });
    expect(acceptInternal.execute).toHaveBeenCalledTimes(2);
    const firstCommand = acceptInternal.execute.mock.calls[0]?.[0];
    const secondCommand = acceptInternal.execute.mock.calls[1]?.[0];
    expect(firstCommand.idempotencyKey).toMatch(
      /^internal-batch-item:[a-f0-9]{64}$/,
    );
    expect(secondCommand.idempotencyKey).toMatch(
      /^internal-batch-item:[a-f0-9]{64}$/,
    );
    expect(firstCommand.idempotencyKey).not.toBe(secondCommand.idempotencyKey);
  });

  it("reports idempotent replays separately from new acceptance", async () => {
    const acceptInternal = {
      execute: vi.fn().mockResolvedValue({
        contractVersion: "internal-shipment-handoff-accept-result.v1",
        candidateRef: firstCandidateRef,
        handoff: {
          duplicate: true,
          shipmentId: "11111111-1111-4111-8111-111111111111",
          traceId: "trace-duplicate",
        },
      }),
    };
    const service = new AcceptInternalShipmentHandoffBatchService(
      acceptInternal as never,
    );

    const result = await service.execute(
      {
        contractVersion: "internal-shipment-handoff-batch-accept.v1",
        candidateRefs: [firstCandidateRef],
        idempotencyKey: "internal-batch:test-replay",
      },
      { tenantId: "tenant-a", actorId: "actor-a" },
    );

    expect(result.items[0]?.status).toBe("duplicate");
    expect(result.totals).toMatchObject({ accepted: 0, duplicate: 1 });
  });
});
