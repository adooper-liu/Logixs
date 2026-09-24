import { BadRequestException, NotFoundException } from "@nestjs/common";
import type {
  PostDepartureSourcePackagePreflightCommandV1,
  PostDepartureSourcePackagePreflightResultV1,
} from "@logix/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ImportRepository } from "../domain/import.repository";
import type { PreflightPostDepartureSourcePackageService } from "./preflight-post-departure-source-package.service";
import { SavePostDepartureSourcePackageReviewService } from "./save-post-departure-source-package-review.service";

const PACKAGE_ID = "a".repeat(64);
const SOURCE_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
] as const;

describe("SavePostDepartureSourcePackageReviewService", () => {
  it("re-runs preflight and saves an all-review package without creating a Shipment", async () => {
    const preflight = {
      execute: vi.fn().mockResolvedValue(preflightResult()),
    };
    const repository = {
      savePostDepartureSourcePackageReview: vi
        .fn()
        .mockImplementation(async (input) => ({
          created: true,
          review: { ...input, createdAt: new Date("2026-09-23T08:00:00Z") },
        })),
    };
    const service = buildService(preflight, repository);

    const result = await service.execute(
      PACKAGE_ID,
      command(),
      "tenant-1",
      "operator-1",
    );

    expect(preflight.execute).toHaveBeenCalledWith(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: command().sources,
      },
      "tenant-1",
    );
    expect(
      repository.savePostDepartureSourcePackageReview,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        operatorId: "operator-1",
        packageHash: PACKAGE_ID,
        decision: "review_required",
        candidateCount: 1,
        reviewRequiredCount: 1,
        sources: command().sources,
        snapshot: expect.not.objectContaining({ traceId: expect.anything() }),
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(result).toMatchObject({
      contractVersion: "post-departure-source-package-review-result.v1",
      status: "saved",
      packageId: PACKAGE_ID,
      decision: "review_required",
      candidateCount: 1,
      savedAt: "2026-09-23T08:00:00.000Z",
    });
  });

  it("returns duplicate for an identical replay", async () => {
    const preflight = { execute: vi.fn().mockResolvedValue(preflightResult()) };
    const repository = {
      savePostDepartureSourcePackageReview: vi
        .fn()
        .mockImplementation(async (input) => ({
          created: false,
          review: { ...input, createdAt: new Date("2026-09-23T08:00:00Z") },
        })),
    };
    const service = buildService(preflight, repository);

    await expect(
      service.execute(PACKAGE_ID, command(), "tenant-1", "operator-1"),
    ).resolves.toMatchObject({ status: "duplicate" });
  });

  it("rejects a path/body or freshly calculated package identity mismatch", async () => {
    const repository = { savePostDepartureSourcePackageReview: vi.fn() };
    const service = buildService(
      { execute: vi.fn().mockResolvedValue(preflightResult()) },
      repository,
    );

    await expect(
      service.execute("b".repeat(64), command(), "tenant-1", "operator-1"),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.execute(
        PACKAGE_ID,
        { ...command(), packageId: "b".repeat(64) },
        "tenant-1",
        "operator-1",
      ),
    ).rejects.toThrow("SOURCE_PACKAGE_ID_MISMATCH");
    expect(
      repository.savePostDepartureSourcePackageReview,
    ).not.toHaveBeenCalled();
  });

  it("saves non-blocking gaps for a ready candidate", async () => {
    const current = preflightResult();
    current.candidates[0]!.decision = "ready";
    current.candidates[0]!.issues[0]!.blocking = false;
    current.totals = {
      ...current.totals,
      ready: 1,
      reviewRequired: 0,
    };
    const repository = {
      savePostDepartureSourcePackageReview: vi
        .fn()
        .mockImplementation(async (input) => ({
          created: true,
          review: { ...input, createdAt: new Date("2026-09-23T08:00:00Z") },
        })),
    };
    const service = buildService(
      { execute: vi.fn().mockResolvedValue(current) },
      repository,
    );

    await expect(
      service.execute(PACKAGE_ID, command(), "tenant-1", "operator-1"),
    ).resolves.toMatchObject({ status: "saved" });
    expect(
      repository.savePostDepartureSourcePackageReview,
    ).toHaveBeenCalledWith(expect.objectContaining({ reviewRequiredCount: 1 }));
  });

  it.each(["empty", "no-gaps"])(
    "rejects a package with nothing to register: %s",
    async (variant) => {
      const current = preflightResult();
      if (variant === "empty") current.candidates = [];
      else current.candidates[0]!.issues = [];
      const repository = { savePostDepartureSourcePackageReview: vi.fn() };
      const service = buildService(
        { execute: vi.fn().mockResolvedValue(current) },
        repository,
      );

      await expect(
        service.execute(PACKAGE_ID, command(), "tenant-1", "operator-1"),
      ).rejects.toThrow("SOURCE_PACKAGE_NOT_REVIEW_ONLY");
      expect(
        repository.savePostDepartureSourcePackageReview,
      ).not.toHaveBeenCalled();
    },
  );

  it("does not treat totals alone as actionable gaps", async () => {
    const repository = { savePostDepartureSourcePackageReview: vi.fn() };
    const current = preflightResult();
    current.candidates[0]!.issues = [];
    const service = buildService(
      { execute: vi.fn().mockResolvedValue(current) },
      repository,
    );

    await expect(
      service.execute(PACKAGE_ID, command(), "tenant-1", "operator-1"),
    ).rejects.toThrow("SOURCE_PACKAGE_NOT_REVIEW_ONLY");
    expect(
      repository.savePostDepartureSourcePackageReview,
    ).not.toHaveBeenCalled();
  });

  it("reuses the review when operator corrections change the projected snapshot", async () => {
    const current = preflightResult();
    const repository = {
      savePostDepartureSourcePackageReview: vi
        .fn()
        .mockImplementation(async (input) => ({
          created: false,
          review: {
            ...input,
            snapshotHash: "f".repeat(64),
            createdAt: new Date("2026-09-23T08:00:00Z"),
          },
        })),
    };
    const service = buildService(
      { execute: vi.fn().mockResolvedValue(current) },
      repository,
    );

    await expect(
      service.execute(PACKAGE_ID, command(), "tenant-1", "operator-1"),
    ).resolves.toMatchObject({ status: "duplicate", packageId: PACKAGE_ID });
  });

  it("preserves the cross-tenant batch lookup failure and does not save", async () => {
    const repository = { savePostDepartureSourcePackageReview: vi.fn() };
    const service = buildService(
      {
        execute: vi
          .fn()
          .mockRejectedValue(new NotFoundException("SOURCE_BATCH_NOT_FOUND")),
      },
      repository,
    );

    await expect(
      service.execute(PACKAGE_ID, command(), "tenant-2", "operator-1"),
    ).rejects.toThrow("SOURCE_BATCH_NOT_FOUND");
    expect(
      repository.savePostDepartureSourcePackageReview,
    ).not.toHaveBeenCalled();
  });
});

function buildService(
  preflight: Pick<PreflightPostDepartureSourcePackageService, "execute">,
  repository: Pick<ImportRepository, "savePostDepartureSourcePackageReview">,
) {
  return new SavePostDepartureSourcePackageReviewService(
    preflight as PreflightPostDepartureSourcePackageService,
    repository as ImportRepository,
  );
}

function command() {
  return {
    contractVersion: "post-departure-source-package-review.v1" as const,
    packageId: PACKAGE_ID,
    sources: [
      { kind: "container" as const, batchId: SOURCE_IDS[0] },
      { kind: "customs" as const, batchId: SOURCE_IDS[1] },
      { kind: "logistics" as const, batchId: SOURCE_IDS[2] },
      { kind: "warehouse" as const, batchId: SOURCE_IDS[3] },
    ] as PostDepartureSourcePackagePreflightCommandV1["sources"],
  };
}

function preflightResult(): PostDepartureSourcePackagePreflightResultV1 {
  return {
    packageId: PACKAGE_ID,
    sources: command().sources.map((source) => ({
      ...source,
      fileName: `${source.kind}.xlsx`,
      rowCount: 20,
      columnCount: 20,
    })) as PostDepartureSourcePackagePreflightResultV1["sources"],
    candidates: [
      {
        candidateRef: "MSNU9762671",
        decision: "review_required",
        containerNumber: "MSNU9762671",
        replenishmentOrderNumbers: ["26DSA01884"],
        billNumbers: ["1811F026PE36669R2"],
        issues: [
          {
            code: "UNKNOWN_REFERENCE_CODE",
            messageKey: "shipment_handoff_unknown_reference_code",
          },
        ],
      },
    ],
    totals: {
      containers: 1,
      bills: 1,
      replenishmentOrders: 1,
      ready: 0,
      reviewRequired: 1,
      rejected: 0,
    },
    traceId: "preflight-trace",
  };
}
