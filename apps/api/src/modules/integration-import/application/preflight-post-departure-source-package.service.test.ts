import type {
  PostDepartureSourceKindV1,
  PostDepartureSourcePackagePreflightCommandV1,
} from "@logix/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  ImportBatchWithRows,
  ImportRepository,
  PostDepartureSourceCandidateCorrectionRecord,
  PostDepartureSourcePackageReviewRecord,
} from "../domain/import.repository";
import { PreflightPostDepartureSourcePackageService } from "./preflight-post-departure-source-package.service";

const IDS: Record<PostDepartureSourceKindV1, string> = {
  container: "11111111-1111-4111-8111-111111111111",
  customs: "22222222-2222-4222-8222-222222222222",
  logistics: "33333333-3333-4333-8333-333333333333",
  warehouse: "44444444-4444-4444-8444-444444444444",
};

describe("PreflightPostDepartureSourcePackageService", () => {
  it("joins all four retained sources and keeps non-key gaps visible without blocking", async () => {
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(SOURCE_ROWS) as ImportRepository,
      portDirectory(),
      shipmentMatcher(),
    );

    const result = await service.execute(command(), "tenant-1");

    expect(result.sources).toHaveLength(4);
    expect(result.totals).toEqual({
      containers: 1,
      bills: 1,
      replenishmentOrders: 1,
      ready: 1,
      reviewRequired: 0,
      rejected: 0,
    });
    expect(result.candidates[0]).toMatchObject({
      containerNumber: "MSNU9762671",
      replenishmentOrderNumbers: ["26DSA01884"],
      billNumbers: ["1811F026PE36669R2"],
      carrierCode: "MSC",
      vesselName: "MSC MAKALU III",
      voyageNumber: "HD638A",
      decision: "ready",
    });
    expect(result.candidates[0]!.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "SOURCE_RANGE_METADATA_INVALID",
        "UNKNOWN_REFERENCE_CODE",
        "DEPARTURE_PROOF_REQUIRED",
        "CARGO_DETAIL_INCOMPLETE",
        "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
      ]),
    );
  });

  it("preflights one available source and reports the other sources as non-blocking gaps", async () => {
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(SOURCE_ROWS) as ImportRepository,
      portDirectory(),
      shipmentMatcher(),
    );

    const result = await service.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: [{ kind: "container", batchId: IDS.container }],
      },
      "tenant-1",
    );

    expect(result.sources).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      containerNumber: "MSNU9762671",
      decision: "ready",
    });
    const sourceGaps = result.candidates[0]!.issues.filter(
      ({ code }) => code === "SOURCE_DATA_INCOMPLETE",
    );
    expect(sourceGaps).toHaveLength(3);
    expect(sourceGaps.every(({ blocking }) => blocking === false)).toBe(true);
  });

  it("matches a late source to the unique active Shipment without operator grouping", async () => {
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(SOURCE_ROWS) as ImportRepository,
      portDirectory(),
      shipmentMatcher({
        shipmentId: "77777777-7777-4777-8777-777777777777",
        shipmentNumber: "SHP-2026-01884",
        relationshipVersion: 4,
      }),
    );

    const result = await service.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: [{ kind: "warehouse", batchId: IDS.warehouse }],
      },
      "tenant-1",
    );

    expect(result.candidates[0]).toMatchObject({
      candidateRef: "MSNU9762671",
      existingShipmentMatch: {
        shipmentId: "77777777-7777-4777-8777-777777777777",
        shipmentNumber: "SHP-2026-01884",
        expectedRelationshipVersion: 4,
        matchedBy: "container_active_link",
      },
    });
    expect(
      result.candidates[0]!.issues.some(
        ({ code }) => code === "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
      ),
    ).toBe(false);
  });

  it("rejects only the affected container when active Shipment matching is ambiguous", async () => {
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(SOURCE_ROWS) as ImportRepository,
      portDirectory(),
      {
        matchByContainerNumbers: async (_tenantId, containerNumbers) =>
          containerNumbers.map((containerNumber) => ({
            containerNumber,
            state: "conflict" as const,
          })),
      },
    );

    const result = await service.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: [{ kind: "warehouse", batchId: IDS.warehouse }],
      },
      "tenant-1",
    );

    expect(result.candidates[0]).toMatchObject({
      candidateRef: "MSNU9762671",
      decision: "rejected",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
          blocking: true,
        }),
      ]),
    });
  });

  it("re-preflights a partially saved candidate without requiring a port lookup", async () => {
    const repository = repositoryFor(SOURCE_ROWS);
    repository.findPostDepartureSourcePackageReviewByPackage = async () =>
      partialReview();
    repository.listLatestPostDepartureSourceCandidateCorrections = async () => [
      partialCorrection(),
    ];
    const findByIds = vi
      .fn()
      .mockRejectedValue(new Error("REFERENCE_PORT_ID_INVALID"));
    const service = new PreflightPostDepartureSourcePackageService(
      repository as ImportRepository,
      { ...portDirectory(), findByIds },
      shipmentMatcher(),
    );

    const result = await service.execute(
      {
        contractVersion: "post-departure-source-package-preflight.v1",
        sources: [{ kind: "container", batchId: IDS.container }],
      },
      "tenant-1",
    );

    expect(result.sources).toHaveLength(1);
    expect(result.candidates[0]?.containerNumber).toBe("MSNU9762671");
    expect(findByIds).not.toHaveBeenCalled();
  });

  it("rejects duplicate source kinds", async () => {
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(SOURCE_ROWS) as ImportRepository,
      portDirectory(),
      shipmentMatcher(),
    );
    const invalid = command();
    invalid.sources[3] = { kind: "container", batchId: IDS.container };

    await expect(service.execute(invalid, "tenant-1")).rejects.toThrow(
      "SOURCE_PACKAGE_INCOMPLETE",
    );
  });

  it.each([
    undefined,
    {},
    {
      contractVersion: "post-departure-source-package-preflight.v1",
      sources: [null, null, null, null],
    },
    {
      contractVersion: "post-departure-source-package-preflight.v1",
      sources: [],
    },
    {
      ...command(),
      sources: command().sources.map((source, index) =>
        index === 0 ? { ...source, batchId: "not-a-uuid" } : source,
      ),
    },
  ])("rejects malformed boundary input with a stable error", async (input) => {
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(SOURCE_ROWS) as ImportRepository,
      portDirectory(),
      shipmentMatcher(),
    );

    await expect(service.execute(input, "tenant-1")).rejects.toThrow(
      "SOURCE_PACKAGE_INCOMPLETE",
    );
  });

  it("rejects a source batch whose registered identity columns are missing", async () => {
    const rows = { ...SOURCE_ROWS, customs: { other: "value" } };
    const service = new PreflightPostDepartureSourcePackageService(
      repositoryFor(rows) as ImportRepository,
      portDirectory(),
      shipmentMatcher(),
    );

    await expect(service.execute(command(), "tenant-1")).rejects.toThrow(
      "SOURCE_PACKAGE_SCHEMA_MISMATCH:customs",
    );
  });
});

const SOURCE_ROWS: Record<PostDepartureSourceKindV1, Record<string, string>> = {
  container: {
    "箱号(集装箱号)": "MSNU9762671",
    备货单号: "26DSA01884",
    提单号: "1811F026PE36669R2",
    销往国家: "AOSOM LLC",
    船公司: "MSC",
    船名: "MSC MAKALU III",
    航次: "HD638A",
    柜型: "40HQ",
    起运港: "福州",
    目的港: "萨凡纳",
    出运日期: "2026-09-23 00:00:00",
    "预计到港日期(ETA)": "2026-11-01 00:00:00",
    箱数合计: "367",
    "毛重合计(KG)": "12511.3",
    "体积合计(m3)": "68.4",
  },
  customs: {
    集装箱号: "MSNU9762671",
    备货单号: "26DSA01884",
    提单号: "1811F026PE36669R2",
  },
  logistics: {
    集装箱号: "MSNU9762671",
    备货单号: "26DSA01884",
    提单号: "1811F026PE36669R2",
  },
  warehouse: {
    集装箱号: "MSNU9762671",
    备货单号: "26DSA01884",
    提单号: "1811F026PE36669R2",
  },
};

function command(): PostDepartureSourcePackagePreflightCommandV1 {
  return {
    contractVersion: "post-departure-source-package-preflight.v1",
    sources: (Object.entries(IDS) as [PostDepartureSourceKindV1, string][]).map(
      ([kind, batchId]) => ({ kind, batchId }),
    ) as PostDepartureSourcePackagePreflightCommandV1["sources"],
  };
}

function repositoryFor(
  rows: Record<PostDepartureSourceKindV1, Record<string, string>>,
): Pick<
  ImportRepository,
  | "findById"
  | "findPostDepartureSourcePackageReviewByPackage"
  | "listLatestPostDepartureSourceCandidateCorrections"
> {
  return {
    async findById(id) {
      const kind = (
        Object.entries(IDS) as [PostDepartureSourceKindV1, string][]
      ).find(([, batchId]) => batchId === id)?.[0];
      if (!kind) return null;
      const values = rows[kind];
      return batch(kind, id, values);
    },
    async findPostDepartureSourcePackageReviewByPackage() {
      return null;
    },
    async listLatestPostDepartureSourceCandidateCorrections() {
      return [];
    },
  };
}

function portDirectory() {
  return {
    search: async () => ({ items: [], nextCursor: null }),
    findByUnlocodes: async () => [],
    findByIds: async () => [],
  };
}

function shipmentMatcher(match?: {
  shipmentId: string;
  shipmentNumber: string | null;
  relationshipVersion: number;
}) {
  return {
    matchByContainerNumbers: async (
      _tenantId: string,
      containerNumbers: readonly string[],
    ) =>
      containerNumbers.map((containerNumber) =>
        match
          ? { containerNumber, state: "matched" as const, ...match }
          : { containerNumber, state: "not_found" as const },
      ),
  };
}

function partialReview(): PostDepartureSourcePackageReviewRecord {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    tenantId: "tenant-1",
    packageHash: "a".repeat(64),
    contractVersion: "post-departure-source-package-review.v1",
    decision: "review_required",
    candidateCount: 1,
    reviewRequiredCount: 1,
    snapshot: {} as PostDepartureSourcePackageReviewRecord["snapshot"],
    snapshotHash: "b".repeat(64),
    operatorId: "operator-1",
    traceId: "trace-review",
    createdAt: new Date("2026-09-23T00:00:00Z"),
  };
}

function partialCorrection(): PostDepartureSourceCandidateCorrectionRecord {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    tenantId: "tenant-1",
    reviewId: "55555555-5555-4555-8555-555555555555",
    candidateRef: "MSNU9762671",
    version: 1,
    supersedesCorrectionId: null,
    shipmentGroupingKind: null,
    shipmentNumber: null,
    targetShipmentId: null,
    targetRelationshipVersion: null,
    originPortId: null,
    originUnlocode: null,
    destinationPortId: null,
    destinationUnlocode: null,
    departureLocal: null,
    departureOccurredAt: null,
    departureSourceTimezone: null,
    departureEvidenceId: null,
    operatorId: "operator-1",
    reasonCode: "partial_save",
    idempotencyKey: "partial-save-1",
    payloadHash: "c".repeat(64),
    createdAt: new Date("2026-09-23T00:00:00Z"),
    cargoLines: [],
  };
}

function batch(
  kind: PostDepartureSourceKindV1,
  id: string,
  values: Record<string, string>,
): ImportBatchWithRows {
  return {
    batch: {
      id,
      tenantId: "tenant-1",
      operatorId: "operator-1",
      idempotencyKey: `key-${kind}`,
      fileName: `${kind}.xlsx`,
      fileHash: kind.padEnd(64, "0"),
      sourceFileStatus: "retained",
      sourceObjectKey: `imports/${id}/source`,
      sourceContentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sourceSizeBytes: 100,
      sourceRetainedAt: new Date("2026-09-23T00:00:00Z"),
      parserVersion: "tabular-v2",
      replacesBatchId: null,
      status: "parsed",
      rowCount: 1,
      columnCount: Object.keys(values).length,
      mappingSuggestions: [],
      confirmedQuantityUnit: null,
      createdAt: new Date("2026-09-23T00:00:00Z"),
    },
    rows: [{ id: `row-${kind}`, rowNo: 1, values }],
    reviews: [],
  };
}
