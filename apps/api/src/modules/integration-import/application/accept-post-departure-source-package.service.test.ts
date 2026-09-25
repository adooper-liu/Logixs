import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AcceptPostDepartureSourcePackageService } from "./accept-post-departure-source-package.service";

const packageId = "a".repeat(64);
const batchId = "70000000-0000-4000-8000-000000000002";
const context = {
  tenantId: "demo-real-sample-20260921",
  actorId: "70000000-0000-4000-8000-000000000009",
};

describe("AcceptPostDepartureSourcePackageService", () => {
  it("accepts each Shipment group independently and distinguishes rejected, conflicting and failed groups", async () => {
    const preflightPackage = {
      execute: vi.fn().mockResolvedValue({
        packageId,
        candidates: [
          candidate("container-a", "SHIP-A", "ready"),
          candidate("container-b", "SHIP-A", "review_required"),
          candidate("container-c", "SHIP-B", "ready"),
          candidate("container-d", "SHIP-C", "rejected"),
          candidate("container-e", "SHIP-D", "ready"),
          candidate("container-f", "SHIP-E", "ready"),
        ],
      }),
    };
    const acceptCandidate = {
      acceptPrepared: vi
        .fn()
        .mockResolvedValueOnce({
          acceptedCandidateRefs: ["container-a", "container-b"],
          handoff: {
            duplicate: false,
            shipmentId: "10000000-0000-4000-8000-000000000001",
            traceId: "trace-a",
          },
        })
        .mockRejectedValueOnce(
          new ConflictException("TARGET_SHIPMENT_FACT_CONFLICT"),
        )
        .mockRejectedValueOnce(
          new BadRequestException("SHIPMENT_HANDOFF_CONTRACT_INVALID"),
        )
        .mockRejectedValueOnce(new Error("database unavailable")),
    };
    const service = new AcceptPostDepartureSourcePackageService(
      preflightPackage as never,
      acceptCandidate as never,
    );

    const result = await service.execute(packageId, command(), context);

    expect(preflightPackage.execute).toHaveBeenCalledTimes(1);
    expect(acceptCandidate.acceptPrepared).toHaveBeenCalledTimes(4);
    expect(result.items).toEqual([
      expect.objectContaining({
        candidateRefs: ["container-a", "container-b"],
        status: "accepted",
        shipmentId: "10000000-0000-4000-8000-000000000001",
        recoveryAction: "open_shipment",
      }),
      expect.objectContaining({
        candidateRefs: ["container-c"],
        status: "conflict",
        errorCode: "TARGET_SHIPMENT_FACT_CONFLICT",
        recoveryAction: "review_candidate",
      }),
      expect.objectContaining({
        candidateRefs: ["container-d"],
        status: "rejected",
        errorCode: "SOURCE_CANDIDATE_REJECTED",
        recoveryAction: "review_candidate",
      }),
      expect.objectContaining({
        candidateRefs: ["container-e"],
        status: "rejected",
        errorCode: "SHIPMENT_HANDOFF_CONTRACT_INVALID",
        recoveryAction: "review_candidate",
      }),
      expect.objectContaining({
        candidateRefs: ["container-f"],
        status: "failed",
        errorCode: "SOURCE_PACKAGE_GROUP_ACCEPT_FAILED",
        recoveryAction: "retry_package",
      }),
    ]);
    expect(result.totals).toEqual({
      groups: 5,
      accepted: 1,
      duplicate: 0,
      conflict: 1,
      rejected: 2,
      failed: 1,
    });
  });

  it("derives stable group idempotency keys so successful groups replay as duplicates", async () => {
    const preflight = {
      packageId,
      candidates: [candidate("container-a", "SHIP-A", "ready")],
    };
    const preflightPackage = { execute: vi.fn().mockResolvedValue(preflight) };
    const acceptCandidate = {
      acceptPrepared: vi.fn().mockResolvedValue({
        acceptedCandidateRefs: ["container-a"],
        handoff: {
          duplicate: true,
          shipmentId: "10000000-0000-4000-8000-000000000001",
          traceId: "trace-a",
        },
      }),
    };
    const service = new AcceptPostDepartureSourcePackageService(
      preflightPackage as never,
      acceptCandidate as never,
    );

    await service.execute(packageId, command(), context);
    const firstCommand = acceptCandidate.acceptPrepared.mock.calls[0]?.[2];
    await service.execute(packageId, command(), context);
    const replayCommand = acceptCandidate.acceptPrepared.mock.calls[1]?.[2];

    expect(firstCommand.idempotencyKey).toBe(replayCommand.idempotencyKey);
    expect(firstCommand.idempotencyKey).toMatch(
      /^package-accept:[a-f0-9]{64}$/,
    );
  });
});

function command() {
  return {
    contractVersion: "post-departure-source-package-accept.v1",
    packageId,
    sources: [{ kind: "container", batchId }],
    idempotencyKey: "accept-package:operator-action-1",
  };
}

function candidate(
  candidateRef: string,
  shipmentNumber: string,
  decision: "ready" | "review_required" | "rejected",
) {
  return {
    candidateRef,
    decision,
    issues: decision === "rejected" ? [{ code: "IDENTITY_CONFLICT" }] : [],
    correction: {
      shipmentGrouping: {
        kind: "authorized_new_shipment",
        shipmentNumber,
      },
    },
  };
}
