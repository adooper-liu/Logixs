import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptPostDepartureSourceCandidate,
  correctPostDepartureSourceCandidate,
  completePostDepartureSourceCandidateCargo,
  preflightPostDepartureSourcePackage,
  searchPostDepartureReferencePorts,
  savePostDepartureSourcePackageReview,
} from "./postDepartureSourcePackages";

describe("postDepartureSourcePackages api", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the currently available batch identities with the operator capability role", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          packageId: "a".repeat(64),
          sources: [],
          candidates: [],
          totals: {
            containers: 0,
            bills: 0,
            replenishmentOrders: 0,
            ready: 0,
            reviewRequired: 0,
            rejected: 0,
          },
          traceId: "trace-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await preflightPostDepartureSourcePackage([
      { kind: "container", batchId: "batch-1" },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/post-departure-source-packages/preflight",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Roles": "import_operator",
        }),
        body: expect.stringContaining(
          "post-departure-source-package-preflight.v1",
        ),
      }),
    );
  });

  it("saves a review package with the same operator capability role", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          contractVersion: "post-departure-source-package-review-result.v1",
          reviewId: "11111111-1111-4111-8111-111111111111",
          packageId: "a".repeat(64),
          decision: "review_required",
          status: "saved",
          candidateCount: 20,
          savedAt: "2026-09-23T08:00:00Z",
          traceId: "trace-2",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const sources = [
      { kind: "container" as const, batchId: "batch-1" },
      { kind: "customs" as const, batchId: "batch-2" },
      { kind: "logistics" as const, batchId: "batch-3" },
      { kind: "warehouse" as const, batchId: "batch-4" },
    ] as Parameters<typeof savePostDepartureSourcePackageReview>[1];

    await savePostDepartureSourcePackageReview("a".repeat(64), sources);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/post-departure-source-packages/${"a".repeat(64)}/reviews`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Roles": "import_operator" }),
        body: expect.stringContaining(
          "post-departure-source-package-review.v1",
        ),
      }),
    );
  });

  it("searches active reference ports with a bounded query", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], pageSize: 20, nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await searchPostDepartureReferencePorts("福州", 20);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/post-departure-source-packages/reference-ports?",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("pageSize=20");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Roles": "import_operator" }),
      }),
    );
  });

  it("posts a candidate correction to its review-scoped endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          contractVersion:
            "post-departure-source-candidate-correction-result.v1",
          status: "saved",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const command = {
      contractVersion: "post-departure-source-candidate-correction.v1" as const,
      packageId: "a".repeat(64),
      reviewId: "11111111-1111-4111-8111-111111111111",
      candidateRef: "MSNU9762671",
      expectedVersion: 0,
      shipmentGrouping: {
        kind: "authorized_new_shipment" as const,
        shipmentNumber: "SHIP-2026-0001",
      },
      originPortCode: "CNFZG",
      destinationPortCode: "USSAV",
      departureProof: {
        kind: "actual_departure_time" as const,
        occurredAt: "2026-09-22T16:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "22222222-2222-4222-8222-222222222222",
      },
      reasonCode: "source_fact_confirmed",
      idempotencyKey: "correction-1",
    };

    await correctPostDepartureSourceCandidate(command);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/post-departure-source-packages/${command.packageId}/reviews/${command.reviewId}/candidates/${command.candidateRef}/corrections`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Roles": "import_operator" }),
        body: JSON.stringify(command),
      }),
    );
  });

  it("turns a stale existing Shipment choice into a recoverable action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ message: "TARGET_SHIPMENT_VERSION_CONFLICT" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    const command: Parameters<typeof correctPostDepartureSourceCandidate>[0] = {
      contractVersion: "post-departure-source-candidate-correction.v1",
      packageId: "a".repeat(64),
      reviewId: "11111111-1111-4111-8111-111111111111",
      candidateRef: "MSNU9762671",
      expectedVersion: 0,
      shipmentGrouping: {
        kind: "existing_shipment",
        shipmentId: "33333333-3333-4333-8333-333333333333",
        expectedRelationshipVersion: 2,
      },
      originPortCode: "CNFZG",
      destinationPortCode: "USSAV",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: "2026-09-22T16:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "22222222-2222-4222-8222-222222222222",
      },
      reasonCode: "source_fact_confirmed",
      idempotencyKey: "correction-stale",
    };

    await expect(correctPostDepartureSourceCandidate(command)).rejects.toThrow(
      "所选出运已被其他操作更新，请重新预检并重新选择。",
    );
  });

  it("turns an invalid correction payload into an action on the current form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ message: "SOURCE_CANDIDATE_CORRECTION_INVALID" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      correctPostDepartureSourceCandidate({
        contractVersion: "post-departure-source-candidate-correction.v1",
        packageId: "a".repeat(64),
        reviewId: "11111111-1111-4111-8111-111111111111",
        candidateRef: "BMOU4788119",
        expectedVersion: 0,
        shipmentGrouping: { kind: "new_independent_shipment" },
        originPortCode: "CNNBO",
        destinationPortCode: "USLAX",
        departureLocal: "2026-09-22T00:00",
        departureSourceTimezone: "Asia/Shanghai",
        departureEvidenceRef: null,
        reasonCode: "source_progress_saved",
        idempotencyKey: "correction-invalid",
      }),
    ).rejects.toThrow(
      "请重新选择所属出运、港口或离港时间后保存；不确定的内容可以留空。",
    );
  });

  it("posts SKU loading lines to the candidate cargo endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "saved" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const command: Parameters<
      typeof completePostDepartureSourceCandidateCargo
    >[0] = {
      contractVersion: "post-departure-source-candidate-cargo.v1" as const,
      packageId: "a".repeat(64),
      reviewId: "11111111-1111-4111-8111-111111111111",
      candidateRef: "MSNU9762671",
      expectedVersion: 1,
      cargoLines: [
        {
          replenishmentOrderNumber: "26DSA01884",
          productNumber: "SKU-001",
          quantity: "10",
          quantityUnit: "piece" as const,
        },
      ],
      reasonCode: "cargo_lines_confirmed",
      idempotencyKey: "cargo-1",
    };

    await completePostDepartureSourceCandidateCargo(command);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/post-departure-source-packages/${command.packageId}/reviews/${command.reviewId}/candidates/${command.candidateRef}/cargo-lines`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
  });

  it("turns an unknown SKU response into an actionable business message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "CARGO_PRODUCT_SKU_NOT_FOUND",
          productNumbers: ["SKU-NEW"],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    const command: Parameters<
      typeof completePostDepartureSourceCandidateCargo
    >[0] = {
      contractVersion: "post-departure-source-candidate-cargo.v1",
      packageId: "a".repeat(64),
      reviewId: "11111111-1111-4111-8111-111111111111",
      candidateRef: "MSNU9762671",
      expectedVersion: 1,
      cargoLines: [
        {
          replenishmentOrderNumber: "26DSA01884",
          productNumber: "SKU-NEW",
          quantity: "1",
          quantityUnit: "piece",
        },
      ],
      reasonCode: "cargo_lines_confirmed",
      idempotencyKey: "cargo-unknown",
    };

    await expect(
      completePostDepartureSourceCandidateCargo(command),
    ).rejects.toThrow(
      "SKU 尚未建档：SKU-NEW。请联系物料资料负责人完成建档后，再在本页保存。",
    );
  });

  it("uses the candidate accept endpoint and does not expose a missing route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 404,
          message:
            "Cannot POST /api/post-departure-source-packages/package/candidates/MSNU9762671/accept",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );
    const command: Parameters<typeof acceptPostDepartureSourceCandidate>[0] = {
      contractVersion: "post-departure-source-candidate-accept.v1",
      packageId: "a".repeat(64),
      sources: [{ kind: "container", batchId: "batch-1" }],
      candidateRef: "MSNU9762671",
      idempotencyKey: "candidate-accept-1",
    };

    await expect(acceptPostDepartureSourceCandidate(command)).rejects.toThrow(
      "暂时无法完成接管，当前资料和选择已保留，请刷新后重试。",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/post-departure-source-packages/${command.packageId}/candidates/MSNU9762671/accept`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("turns a handoff contract failure into a recoverable business message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 400,
          message: {
            code: "SHIPMENT_HANDOFF_CONTRACT_INVALID",
            details: ['/tenantId must match format "uuid"'],
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    const command: Parameters<typeof acceptPostDepartureSourceCandidate>[0] = {
      contractVersion: "post-departure-source-candidate-accept.v1",
      packageId: "a".repeat(64),
      sources: [{ kind: "container", batchId: "batch-1" }],
      candidateRef: "MSNU9762671",
      idempotencyKey: "candidate-accept-contract-error",
    };

    await expect(acceptPostDepartureSourceCandidate(command)).rejects.toThrow(
      "接管资料校验未通过，请重新预检后重试；当前资料和选择已保留。",
    );
  });
});
