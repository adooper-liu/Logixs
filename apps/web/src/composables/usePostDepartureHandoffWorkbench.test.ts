import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { usePostDepartureHandoffWorkbench } from "./usePostDepartureHandoffWorkbench";

const uploadImportBatch = vi.fn();
const preflightPackage = vi.fn();
const savePackageReview = vi.fn();
const searchPorts = vi.fn();
const correctCandidate = vi.fn();
const completeCandidateCargo = vi.fn();
const acceptCandidate = vi.fn();
const registerEvidence = vi.fn();
const listShipments = vi.fn().mockResolvedValue([]);

vi.mock("../api/importBatches", () => ({
  uploadImportBatch: (...args: unknown[]) => uploadImportBatch(...args),
}));
vi.mock("../api/postDepartureSourcePackages", () => ({
  preflightPostDepartureSourcePackage: (...args: unknown[]) =>
    preflightPackage(...args),
  savePostDepartureSourcePackageReview: (...args: unknown[]) =>
    savePackageReview(...args),
  searchPostDepartureReferencePorts: (...args: unknown[]) =>
    searchPorts(...args),
  correctPostDepartureSourceCandidate: (...args: unknown[]) =>
    correctCandidate(...args),
  completePostDepartureSourceCandidateCargo: (...args: unknown[]) =>
    completeCandidateCargo(...args),
  acceptPostDepartureSourceCandidate: (...args: unknown[]) =>
    acceptCandidate(...args),
}));
vi.mock("../api/evidence", () => ({
  registerAndVerifyEvidence: (...args: unknown[]) => registerEvidence(...args),
}));
vi.mock("../api/shipments", () => ({
  listDepartedShipments: (...args: unknown[]) => listShipments(...args),
}));

describe("usePostDepartureHandoffWorkbench", () => {
  it("starts joint preflight with the first available retained source", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    const workbench = usePostDepartureHandoffWorkbench();

    await workbench.uploadSource(
      "container",
      new File(["container"], "container.xlsx"),
    );

    expect(workbench.sourceCount.value).toBe(1);
    expect(workbench.canPreflight.value).toBe(true);
    await workbench.runPreflight();
    await flushPromises();
    expect(preflightPackage).toHaveBeenCalledWith([
      { kind: "container", batchId: "container.xlsx" },
    ]);
    expect(workbench.selectedCandidate.value?.containerNumber).toBe(
      "MSNU9762671",
    );
  });

  it("keeps an upload failure on its source and does not preflight", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    uploadImportBatch.mockRejectedValue(new Error("文件格式不正确"));
    const workbench = usePostDepartureHandoffWorkbench();

    await workbench.uploadSource(
      "container",
      new File(["bad"], "container.xlsx"),
    );
    await workbench.runPreflight();

    expect(workbench.sources.value[0]?.error).toBe("文件格式不正确");
    expect(workbench.canPreflight.value).toBe(false);
    expect(preflightPackage).not.toHaveBeenCalled();
  });

  it("saves the review package and exposes its business receipt", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    savePackageReview.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    savePackageReview.mockResolvedValue(reviewReceipt());
    const workbench = usePostDepartureHandoffWorkbench();
    await uploadAll(workbench);
    await workbench.runPreflight();

    await workbench.saveForReview();

    expect(savePackageReview).toHaveBeenCalledWith(
      "a".repeat(64),
      expect.arrayContaining([
        { kind: "container", batchId: "container.xlsx" },
        { kind: "warehouse", batchId: "warehouse.xlsx" },
      ]),
    );
    expect(workbench.reviewReceipt.value).toEqual(reviewReceipt());
    expect(workbench.reviewSaveError.value).toBe("");
  });

  it("keeps uploaded files, selected candidate and preflight result when saving fails", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    savePackageReview.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    savePackageReview.mockRejectedValue(new Error("保存冲突，请重新预检"));
    const workbench = usePostDepartureHandoffWorkbench();
    await uploadAll(workbench);
    await workbench.runPreflight();

    await workbench.saveForReview();

    expect(workbench.sources.value.every((source) => source.batch)).toBe(true);
    expect(workbench.preflightResult.value?.packageId).toBe("a".repeat(64));
    expect(workbench.selectedCandidate.value?.candidateRef).toBe("MSNU9762671");
    expect(workbench.reviewSaveError.value).toBe("保存冲突，请重新预检");
  });

  it("registers business evidence, saves the correction and keeps the SKU gap non-blocking", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    savePackageReview.mockReset();
    searchPorts.mockReset();
    correctCandidate.mockReset();
    registerEvidence.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    savePackageReview.mockResolvedValue(reviewReceipt());
    registerEvidence.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    searchPorts.mockImplementation(async (query: string) => ({
      items: [
        query === "福州"
          ? port("11111111-1111-4111-8111-111111111111", "CNFZG", "Fuzhou")
          : port("33333333-3333-4333-8333-333333333333", "USSAV", "Savannah"),
      ],
      pageSize: 20,
      nextCursor: null,
    }));
    correctCandidate.mockResolvedValue(correctionResult());
    const workbench = usePostDepartureHandoffWorkbench();
    await uploadAll(workbench);
    await workbench.runPreflight();
    await workbench.saveForReview();

    await workbench.searchPort("origin", "福州");
    await workbench.searchPort("destination", "萨凡纳");
    await workbench.saveCandidateCorrection({
      shipmentGrouping: { kind: "new_independent_shipment" },
      originPortCode: "CNFZG",
      destinationPortCode: "USSAV",
      departureLocal: "2026-09-23T00:00",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "船司离港记录 ATD-1",
    });

    expect(registerEvidence).toHaveBeenCalledWith(
      "domain_fact",
      reviewReceipt().reviewId,
      "船司离港记录 ATD-1",
      expect.objectContaining({ authoritySystem: "shipping-operations" }),
    );
    expect(correctCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 0,
        shipmentGrouping: { kind: "new_independent_shipment" },
        originPortCode: "CNFZG",
        destinationPortCode: "USSAV",
        departureLocal: "2026-09-23T00:00",
        departureSourceTimezone: "Asia/Shanghai",
        departureEvidenceRef: "22222222-2222-4222-8222-222222222222",
        reasonCode: "source_progress_saved",
        idempotencyKey: expect.stringContaining("candidate-correction:"),
      }),
    );
    expect(workbench.selectedCandidate.value?.correction?.version).toBe(1);
    expect(workbench.selectedCandidate.value?.issues).toHaveLength(1);
    expect(workbench.preflightResult.value?.totals.reviewRequired).toBe(0);
    expect(workbench.preflightResult.value?.totals.ready).toBe(1);
  });

  it("saves browser datetime precision with no departure evidence and leaves the gap pending", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    savePackageReview.mockReset();
    correctCandidate.mockReset();
    registerEvidence.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    savePackageReview.mockResolvedValue(reviewReceipt());
    correctCandidate.mockResolvedValue(correctionResult());
    const workbench = usePostDepartureHandoffWorkbench();
    await workbench.uploadSource(
      "container",
      new File(["container"], "container.xlsx"),
    );
    await workbench.runPreflight();

    await workbench.saveCandidateCorrection({
      shipmentGrouping: { kind: "new_independent_shipment" },
      originPortCode: "CNNBO",
      destinationPortCode: "USLAX",
      departureLocal: "2026-09-22T23:59:00.000",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "",
    });

    expect(registerEvidence).not.toHaveBeenCalled();
    expect(correctCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        departureLocal: "2026-09-22T23:59",
        departureSourceTimezone: "Asia/Shanghai",
        departureEvidenceRef: null,
      }),
    );
  });

  it("saves all SKU loading lines against the current correction version and makes the candidate ready", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    savePackageReview.mockReset();
    correctCandidate.mockReset();
    completeCandidateCargo.mockReset();
    registerEvidence.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    savePackageReview.mockResolvedValue(reviewReceipt());
    registerEvidence.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    correctCandidate.mockResolvedValue(correctionResult());
    completeCandidateCargo.mockResolvedValue(cargoResult());
    const workbench = usePostDepartureHandoffWorkbench();
    await uploadAll(workbench);
    await workbench.runPreflight();
    await workbench.saveForReview();
    await workbench.saveCandidateCorrection({
      shipmentGrouping: { kind: "new_independent_shipment" },
      originPortCode: "CNFZG",
      destinationPortCode: "USSAV",
      departureLocal: "2026-09-23T00:00",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "船司离港记录 ATD-1",
    });

    await workbench.saveCandidateCargoLines([
      {
        replenishmentOrderNumber: "26DSA01884",
        productNumber: "SKU-001",
        quantity: "10",
        quantityUnit: "piece",
      },
    ]);

    expect(completeCandidateCargo).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 1,
        cargoLines: [expect.objectContaining({ productNumber: "SKU-001" })],
        idempotencyKey: expect.stringContaining("candidate-cargo:"),
      }),
    );
    expect(workbench.selectedCandidate.value?.decision).toBe("ready");
    expect(workbench.preflightResult.value?.totals.ready).toBe(1);
    expect(workbench.preflightResult.value?.totals.reviewRequired).toBe(0);
  });

  it("accepts a review-required candidate and keeps its missing data visible", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    acceptCandidate.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    acceptCandidate.mockResolvedValue({
      contractVersion:
        "post-departure-source-candidate-accept-result.v1" as const,
      acceptedCandidateRefs: ["MSNU9762671"],
      handoff: {
        shipmentId: "55555555-5555-4555-8555-555555555555",
        issues: result().candidates[0]!.issues,
      },
    });
    const workbench = usePostDepartureHandoffWorkbench();
    await workbench.uploadSource(
      "container",
      new File(["container"], "container.xlsx"),
    );
    await workbench.runPreflight();

    await workbench.acceptSelectedCandidate();

    expect(acceptCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: "post-departure-source-candidate-accept.v1",
        candidateRef: "MSNU9762671",
        sources: [{ kind: "container", batchId: "container.xlsx" }],
      }),
    );
    expect(workbench.acceptanceResult.value?.handoff.issues).toHaveLength(1);
    expect(workbench.acceptanceError.value).toBe("");
  });
});

async function uploadAll(
  workbench: ReturnType<typeof usePostDepartureHandoffWorkbench>,
) {
  for (const source of workbench.sources.value) {
    await workbench.uploadSource(
      source.kind,
      new File([source.kind], `${source.kind}.xlsx`),
    );
  }
}

function batch(fileName: string) {
  return {
    id: fileName,
    fileName,
    sourceFileStatus: "retained",
    sourceSizeBytes: 100,
    parserVersion: "tabular-v2",
    replacesBatchId: null,
    status: "parsed",
    rowCount: 20,
    columnCount: 20,
    mappingSuggestions: [],
    confirmedQuantityUnit: null,
    createdAt: "2026-09-23T00:00:00Z",
  };
}

function result() {
  return {
    packageId: "a".repeat(64),
    sources: [],
    candidates: [
      {
        candidateRef: "MSNU9762671",
        decision: "review_required",
        containerNumber: "MSNU9762671",
        replenishmentOrderNumbers: ["26DSA01884"],
        billNumbers: ["1811F026PE36669R2"],
        issues: [
          {
            code: "SOURCE_DATA_INCOMPLETE" as const,
            messageKey: "shipment_handoff_source_not_provided",
            blocking: false,
            resolutionState: "upstream_action_required" as const,
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
    traceId: "trace-1",
  };
}

function correctionResult() {
  const originPort = port(
    "11111111-1111-4111-8111-111111111111",
    "CNFZG",
    "Fuzhou",
  );
  const destinationPort = port(
    "33333333-3333-4333-8333-333333333333",
    "USSAV",
    "Savannah",
  );
  const candidate = {
    ...result().candidates[0]!,
    decision: "ready" as const,
    issues: [
      {
        code: "CARGO_DETAIL_INCOMPLETE" as const,
        messageKey: "shipment_handoff_cargo_detail_incomplete",
        blocking: false,
        resolutionState: "upstream_action_required" as const,
      },
    ],
    correction: {
      correctionId: "44444444-4444-4444-8444-444444444444",
      version: 1,
      shipmentGrouping: {
        kind: "authorized_new_shipment" as const,
        shipmentNumber: "SHIP-2026-0001",
      },
      originPort,
      destinationPort,
      departureProof: {
        kind: "actual_departure_time" as const,
        occurredAt: "2026-09-22T16:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "22222222-2222-4222-8222-222222222222",
      },
      reasonCode: "source_fact_confirmed",
      correctedAt: "2026-09-24T01:00:00Z",
    },
  };
  return {
    contractVersion:
      "post-departure-source-candidate-correction-result.v1" as const,
    status: "saved" as const,
    correctionId: candidate.correction.correctionId,
    version: 1,
    candidate,
    remainingIssues: candidate.issues,
    decision: "ready" as const,
    traceId: "trace-correction",
  };
}

function cargoResult() {
  const base = correctionResult();
  const candidate = {
    ...base.candidate,
    decision: "ready" as const,
    issues: [],
    correction: {
      ...base.candidate.correction,
      version: 2,
      cargoAllocations: [
        {
          sourceLineId: "MSNU9762671:26DSA01884:SKU-001:1",
          replenishmentOrderNumber: "26DSA01884",
          productSkuId: "55555555-5555-4555-8555-555555555555",
          productNumber: "SKU-001",
          quantity: "10",
          quantityUnit: "piece" as const,
        },
      ],
    },
  };
  return {
    ...base,
    version: 2,
    candidate,
    remainingIssues: [],
    decision: "ready" as const,
  };
}

function port(portId: string, unlocode: string, officialName: string) {
  return { portId, unlocode, officialName, areaCode: unlocode.slice(0, 2) };
}

function reviewReceipt() {
  return {
    contractVersion: "post-departure-source-package-review-result.v1" as const,
    reviewId: "11111111-1111-4111-8111-111111111111",
    packageId: "a".repeat(64),
    decision: "review_required" as const,
    status: "saved" as const,
    candidateCount: 1,
    savedAt: "2026-09-23T08:00:00Z",
    traceId: "trace-2",
  };
}
