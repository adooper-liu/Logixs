import { BadRequestException, ConflictException } from "@nestjs/common";
import type { PostDepartureSourceCandidateCargoCommandV1 } from "@logix/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  PostDepartureCorrectionVersionConflictError,
  type PostDepartureSourceCandidateCorrectionRecord,
} from "../domain/import.repository";
import { CompletePostDepartureCandidateCargoService } from "./complete-post-departure-candidate-cargo.service";

const tenantId = "tenant-1";
const reviewId = "11111111-1111-4111-8111-111111111111";
const packageId = "a".repeat(64);
const candidateRef = "MSNU9762671";

describe("CompletePostDepartureCandidateCargoService", () => {
  it("saves multiple orders and SKUs as a new candidate version and clears only the cargo gap", async () => {
    const repository = repositoryFixture();
    const service = serviceFixture(repository);

    const result = await service.execute(
      packageId,
      reviewId,
      candidateRef,
      command(),
      tenantId,
      "operator-1",
    );

    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 1,
        cargoLines: [
          expect.objectContaining({
            replenishmentOrderNumber: "26DSA01884",
            productSkuId: "22222222-2222-4222-8222-222222222221",
            productNumber: "SKU-001",
            quantity: "10",
            quantityUnit: "piece",
            replenishmentOrderLineId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          }),
          expect.objectContaining({
            replenishmentOrderNumber: "26DSA01885",
            productSkuId: "22222222-2222-4222-8222-222222222222",
            productNumber: "SKU-002",
            quantity: "5.5",
            quantityUnit: "carton",
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      decision: "ready",
      version: 2,
      remainingIssues: [],
      candidate: {
        correction: {
          cargoAllocations: [
            { productNumber: "SKU-001", quantity: "10" },
            { productNumber: "SKU-002", quantity: "5.5" },
          ],
        },
      },
    });
  });

  it("rejects a replenishment order that is not part of the current candidate", async () => {
    const service = serviceFixture(repositoryFixture());
    const input = command();
    input.cargoLines[0].replenishmentOrderNumber = "OTHER-ORDER";

    await expect(
      service.execute(
        packageId,
        reviewId,
        candidateRef,
        input,
        tenantId,
        "operator-1",
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "CARGO_REPLENISHMENT_ORDER_MISMATCH",
      }),
    });
  });

  it("reports unknown product numbers without creating SKU master data", async () => {
    const repository = repositoryFixture();
    const resolveProductSkus = { execute: vi.fn().mockResolvedValue([]) };
    const service = serviceFixture(repository, resolveProductSkus);

    await expect(
      service.execute(
        packageId,
        reviewId,
        candidateRef,
        command(),
        tenantId,
        "operator-1",
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "CARGO_PRODUCT_SKU_NOT_FOUND",
      }),
    });
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.0001", "not-a-number"])(
    "rejects invalid quantity %s at the API boundary",
    async (quantity) => {
      const service = serviceFixture(repositoryFixture());
      const input = command() as unknown as {
        cargoLines: Array<{ quantity: string }>;
      };
      input.cargoLines[0].quantity = quantity;
      await expect(
        service.execute(
          packageId,
          reviewId,
          candidateRef,
          input,
          tenantId,
          "operator-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it("surfaces optimistic version conflicts instead of overwriting another correction", async () => {
    const repository = repositoryFixture();
    repository.savePostDepartureSourceCandidateCorrection.mockRejectedValue(
      new PostDepartureCorrectionVersionConflictError(),
    );
    const service = serviceFixture(repository);

    await expect(
      service.execute(
        packageId,
        reviewId,
        candidateRef,
        command(),
        tenantId,
        "operator-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function serviceFixture(
  repository: ReturnType<typeof repositoryFixture>,
  resolveProductSkus = {
    execute: vi.fn().mockResolvedValue([
      {
        productSkuId: "22222222-2222-4222-8222-222222222221",
        productNumber: "SKU-001",
        version: 1,
      },
      {
        productSkuId: "22222222-2222-4222-8222-222222222222",
        productNumber: "SKU-002",
        version: 1,
      },
    ]),
  },
) {
  const ports = {
    findByIds: vi.fn().mockResolvedValue([
      {
        portId: "33333333-3333-4333-8333-333333333331",
        unlocode: "CNFZG",
        officialName: "Fuzhou",
        areaCode: "CN",
      },
      {
        portId: "33333333-3333-4333-8333-333333333332",
        unlocode: "USSAV",
        officialName: "Savannah",
        areaCode: "US",
      },
    ]),
  };
  const replenishmentLines = {
    execute: vi.fn().mockResolvedValue([
      {
        replenishmentOrderLineId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        replenishmentOrderNumber: "26DSA01884",
        productSkuId: "22222222-2222-4222-8222-222222222221",
        productNumber: "SKU-001",
        sourceRowId: "source-row-1",
      },
    ]),
  };
  return new CompletePostDepartureCandidateCargoService(
    repository as never,
    resolveProductSkus as never,
    ports as never,
    replenishmentLines as never,
  );
}

function repositoryFixture() {
  const current = correction([]);
  const saved = correction(
    [
      {
        id: "44444444-4444-4444-8444-444444444441",
        lineNumber: 1,
        sourceLineId: `${candidateRef}:26DSA01884:SKU-001:1`,
        replenishmentOrderNumber: "26DSA01884",
        productSkuId: "22222222-2222-4222-8222-222222222221",
        productNumber: "SKU-001",
        quantity: "10",
        quantityUnit: "piece" as const,
        replenishmentOrderLineId: null,
      },
      {
        id: "44444444-4444-4444-8444-444444444442",
        lineNumber: 2,
        sourceLineId: `${candidateRef}:26DSA01885:SKU-002:2`,
        replenishmentOrderNumber: "26DSA01885",
        productSkuId: "22222222-2222-4222-8222-222222222222",
        productNumber: "SKU-002",
        quantity: "5.5",
        quantityUnit: "carton" as const,
        replenishmentOrderLineId: null,
      },
    ],
    2,
  );
  return {
    findPostDepartureSourcePackageReviewById: vi.fn().mockResolvedValue({
      id: reviewId,
      tenantId,
      packageHash: packageId,
      snapshot: {
        candidates: [
          {
            candidateRef,
            decision: "review_required",
            containerNumber: candidateRef,
            replenishmentOrderNumbers: ["26DSA01884", "26DSA01885"],
            billNumbers: ["BILL-1"],
            issues: [
              {
                code: "CARGO_DETAIL_INCOMPLETE",
                messageKey: "shipment_handoff_cargo_detail_incomplete",
              },
            ],
          },
        ],
      },
    }),
    listLatestPostDepartureSourceCandidateCorrections: vi
      .fn()
      .mockResolvedValue([current]),
    savePostDepartureSourceCandidateCorrection: vi.fn().mockResolvedValue({
      created: true,
      correction: saved,
    }),
  };
}

function correction(
  cargoLines: PostDepartureSourceCandidateCorrectionRecord["cargoLines"],
  version = 1,
): PostDepartureSourceCandidateCorrectionRecord {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    tenantId,
    reviewId,
    candidateRef,
    version,
    supersedesCorrectionId:
      version > 1 ? "66666666-6666-4666-8666-666666666666" : null,
    shipmentGroupingKind: "authorized_new_shipment",
    shipmentNumber: "SHIP-2026-0001",
    targetShipmentId: null,
    targetRelationshipVersion: null,
    originPortId: "33333333-3333-4333-8333-333333333331",
    originUnlocode: "CNFZG",
    destinationPortId: "33333333-3333-4333-8333-333333333332",
    destinationUnlocode: "USSAV",
    departureLocal: "2026-09-23T00:00",
    departureOccurredAt: new Date("2026-09-22T16:00:00Z"),
    departureSourceTimezone: "Asia/Shanghai",
    departureEvidenceId: "77777777-7777-4777-8777-777777777777",
    operatorId: "operator-1",
    reasonCode: "cargo_lines_confirmed",
    idempotencyKey: `cargo-${version}`,
    payloadHash: String(version).repeat(64),
    createdAt: new Date("2026-09-24T01:00:00Z"),
    cargoLines,
  };
}

function command(): PostDepartureSourceCandidateCargoCommandV1 {
  return {
    contractVersion: "post-departure-source-candidate-cargo.v1",
    packageId,
    reviewId,
    candidateRef,
    expectedVersion: 1,
    cargoLines: [
      {
        replenishmentOrderNumber: "26DSA01884",
        productNumber: "SKU-001",
        quantity: "10.000",
        quantityUnit: "piece",
      },
      {
        replenishmentOrderNumber: "26DSA01885",
        productNumber: "SKU-002",
        quantity: "5.500",
        quantityUnit: "carton",
      },
    ],
    reasonCode: "cargo_lines_confirmed",
    idempotencyKey: "cargo-lines-1",
  };
}
