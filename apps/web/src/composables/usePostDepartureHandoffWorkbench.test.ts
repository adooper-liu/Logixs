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
const acceptPackage = vi.fn();
const registerEvidence = vi.fn();
const listShipments = vi.fn().mockResolvedValue([]);
const listPendingCompletion = vi.fn().mockResolvedValue({
  items: [],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-24T00:00:00.000Z",
  projectionVersion: 0,
});
const completePendingFacts = vi.fn();
const completePendingCargo = vi.fn();
const bindPendingSku = vi.fn();
const completePendingDocuments = vi.fn();
const getShipmentDetail = vi.fn().mockResolvedValue(pendingDetail());
const listInternalCandidates = vi.fn().mockResolvedValue({
  items: [],
  asOf: "2026-09-24T00:00:00.000Z",
  projectionVersion: 1,
});
const acceptInternalCandidate = vi.fn();
const acceptInternalCandidates = vi.fn();

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
  acceptPostDepartureSourcePackage: (...args: unknown[]) =>
    acceptPackage(...args),
}));
vi.mock("../api/evidence", () => ({
  registerAndVerifyEvidence: (...args: unknown[]) => registerEvidence(...args),
}));
vi.mock("../api/shipments", () => ({
  listDepartedShipments: (...args: unknown[]) => listShipments(...args),
  listShipmentPendingCompletion: (...args: unknown[]) =>
    listPendingCompletion(...args),
  completeShipmentPendingFacts: (...args: unknown[]) =>
    completePendingFacts(...args),
  completeShipmentPendingCargo: (...args: unknown[]) =>
    completePendingCargo(...args),
  bindShipmentPendingSku: (...args: unknown[]) => bindPendingSku(...args),
  completeShipmentPendingDocuments: (...args: unknown[]) =>
    completePendingDocuments(...args),
  getShipmentDetail: (...args: unknown[]) => getShipmentDetail(...args),
  listInternalShipmentHandoffCandidates: (...args: unknown[]) =>
    listInternalCandidates(...args),
  acceptInternalShipmentHandoffCandidate: (...args: unknown[]) =>
    acceptInternalCandidate(...args),
  acceptInternalShipmentHandoffCandidates: (...args: unknown[]) =>
    acceptInternalCandidates(...args),
}));

describe("usePostDepartureHandoffWorkbench", () => {
  it("batch accepts internal facts and reloads both persistent queues", async () => {
    const candidate = internalCandidate();
    listInternalCandidates
      .mockReset()
      .mockResolvedValueOnce({
        items: [candidate],
        asOf: "2026-09-24T00:00:00.000Z",
        projectionVersion: 1,
      })
      .mockResolvedValue({
        items: [],
        asOf: "2026-09-24T00:01:00.000Z",
        projectionVersion: 1,
      });
    listPendingCompletion.mockReset().mockResolvedValue(pendingPage());
    acceptInternalCandidates.mockReset().mockResolvedValue({
      contractVersion: "internal-shipment-handoff-batch-accept-result.v1",
      items: [
        {
          candidateRefs: [candidate.candidateRef],
          status: "accepted",
          shipmentId: "55555555-5555-4555-8555-555555555555",
          errorCode: null,
          traceId: "trace-internal-batch",
          recoveryAction: "open_shipment",
        },
      ],
      totals: {
        groups: 1,
        accepted: 1,
        duplicate: 0,
        conflict: 0,
        rejected: 0,
        failed: 0,
      },
    });
    const workbench = usePostDepartureHandoffWorkbench();
    await workbench.loadInternalCandidates();

    await workbench.acceptAllInternalCandidates();

    expect(acceptInternalCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: "internal-shipment-handoff-batch-accept.v1",
        candidateRefs: [candidate.candidateRef],
      }),
    );
    expect(listInternalCandidates).toHaveBeenCalledTimes(2);
    expect(listPendingCompletion).toHaveBeenCalledTimes(1);
    expect(workbench.internalCandidates.value).toEqual([]);
    expect(workbench.internalBatchAcceptanceResult.value?.totals.accepted).toBe(
      1,
    );
  });

  it("saves accepted Shipment facts through a manual Handoff and reloads the persistent queue", async () => {
    listPendingCompletion.mockReset().mockResolvedValue(pendingPage());
    completePendingFacts.mockReset().mockResolvedValue({
      contractVersion: "shipment-pending-fact-completion-result.v1",
      status: "saved",
      shipmentId: "55555555-5555-4555-8555-555555555555",
      relationshipVersion: 2,
      traceId: "trace-completion-1",
    });
    registerEvidence
      .mockReset()
      .mockResolvedValue("77777777-7777-4777-8777-777777777777");
    const workbench = usePostDepartureHandoffWorkbench();
    await workbench.loadPendingCompletion();

    await workbench.savePendingShipmentFacts({
      carrierCode: "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originPortCode: "CNNGB",
      destinationPortCode: "USLAX",
      departureLocal: "2026-09-22T00:00",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "departure-confirmation.pdf",
    });

    expect(registerEvidence).toHaveBeenCalledWith(
      "shipment",
      "55555555-5555-4555-8555-555555555555",
      "departure-confirmation.pdf",
      expect.any(Object),
    );
    expect(completePendingFacts).toHaveBeenCalledWith(
      "55555555-5555-4555-8555-555555555555",
      expect.objectContaining({
        contractVersion: "shipment-pending-fact-completion.v1",
        expectedRelationshipVersion: 1,
        facts: expect.objectContaining({
          originPortCode: "CNNGB",
          destinationPortCode: "USLAX",
          departureProof: expect.objectContaining({
            occurredAt: "2026-09-21T16:00:00.000Z",
          }),
        }),
      }),
    );
    expect(listPendingCompletion).toHaveBeenCalledTimes(2);
  });

  it("saves SKU loading rows and keeps unmatched SKU identities pending", async () => {
    listPendingCompletion.mockReset().mockResolvedValue(pendingPage());
    getShipmentDetail.mockReset().mockResolvedValue(pendingDetail());
    completePendingCargo.mockReset().mockResolvedValue({
      contractVersion: "shipment-pending-cargo-completion-result.v1",
      status: "saved",
      shipmentId: "55555555-5555-4555-8555-555555555555",
      relationshipVersion: 1,
      cargoLineCount: 1,
      unmatchedSkuCount: 1,
      traceId: "cargo-trace",
    });
    const workbench = usePostDepartureHandoffWorkbench();
    await workbench.loadPendingCompletion();

    await workbench.savePendingShipmentCargo([
      {
        containerRecordId: "77777777-7777-4777-8777-777777777777",
        productNumber: "SKU-NEW",
        quantity: "10",
        quantityUnit: "piece",
      },
    ]);

    expect(completePendingCargo).toHaveBeenCalledWith(
      "55555555-5555-4555-8555-555555555555",
      expect.objectContaining({
        contractVersion: "shipment-pending-cargo-completion.v1",
        expectedRelationshipVersion: 1,
        lines: [expect.objectContaining({ productNumber: "SKU-NEW" })],
      }),
    );
    expect(workbench.pendingCargoSaveNotice.value).toContain(
      "1 个 SKU 尚未匹配物料主数据",
    );
    expect(listPendingCompletion).toHaveBeenCalledTimes(2);
  });

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

  it("accepts all available Shipment groups and refreshes the server pending queue", async () => {
    uploadImportBatch.mockReset();
    preflightPackage.mockReset();
    acceptPackage.mockReset();
    listPendingCompletion.mockReset();
    uploadImportBatch.mockImplementation(async (file: File) =>
      batch(file.name),
    );
    preflightPackage.mockResolvedValue(result());
    acceptPackage.mockResolvedValue({
      contractVersion: "post-departure-source-package-accept-result.v1",
      packageId: "a".repeat(64),
      items: [
        {
          candidateRefs: ["MSNU9762671"],
          status: "accepted",
          shipmentId: "55555555-5555-4555-8555-555555555555",
          errorCode: null,
          traceId: "trace-batch-1",
          recoveryAction: "open_shipment",
        },
      ],
      totals: {
        groups: 1,
        accepted: 1,
        duplicate: 0,
        conflict: 0,
        rejected: 0,
        failed: 0,
      },
    });
    listPendingCompletion.mockResolvedValue(pendingPage());
    const workbench = usePostDepartureHandoffWorkbench();
    await workbench.uploadSource(
      "container",
      new File(["container"], "container.xlsx"),
    );
    await workbench.runPreflight();

    await workbench.acceptAllAvailableCandidates();

    expect(acceptPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: "post-departure-source-package-accept.v1",
        packageId: "a".repeat(64),
        sources: [{ kind: "container", batchId: "container.xlsx" }],
      }),
    );
    expect(listPendingCompletion).toHaveBeenCalledWith(100);
    expect(workbench.pendingCompletionItems.value).toHaveLength(1);
    expect(workbench.batchAcceptanceResult.value?.totals.accepted).toBe(1);
  });

  it("loads accepted pending work from the server in a fresh session", async () => {
    listPendingCompletion.mockReset();
    listPendingCompletion.mockResolvedValue(pendingPage());
    const workbench = usePostDepartureHandoffWorkbench();

    await workbench.loadPendingCompletion();

    expect(
      workbench.pendingCompletionItems.value[0]?.shipment.shipmentNumber,
    ).toBe("SHIP-001");
    expect(
      workbench.selectedPendingCompletion.value?.pendingItems[0]?.code,
    ).toBe("cargo_detail_missing");
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

function pendingPage() {
  return {
    items: [
      {
        shipment: {
          id: "55555555-5555-4555-8555-555555555555",
          shipmentNumber: "SHIP-001",
          transportMode: "ocean",
          carrierCode: "HMM",
          vesselName: "ONE TRUTH",
          voyageNumber: "V001",
          originCountryCode: "CN",
          originUnlocode: "CNNGB",
          destinationCountryCode: "US",
          destinationUnlocode: "USLAX",
          salesCountryCode: "US",
          cargoOwnerReferenceId: null,
          cargoOwnerName: "AOSOM LLC",
          atdAt: "2026-09-22T00:00:00.000Z",
          etaAt: null,
          currentLifecycleStatus: "departed",
          lifecycleVersion: 2,
          relationshipVersion: 1,
          activeContainerCount: 1,
          activeCargoLineCount: 0,
          lifecycleInitializationState: "ready",
          updatedAt: "2026-09-24T00:00:00.000Z",
        },
        pendingItems: [
          {
            code: "cargo_detail_missing",
            label: "补充 SKU 装载明细",
            subjectType: "cargo",
            subjectRef: "55555555-5555-4555-8555-555555555555",
            currentValue: null,
            sourceSystem: "legacy-departed-file",
            sourceValue: null,
            candidateValues: [],
            responsibility: {
              roleCode: "operations_dispatcher",
              roleLabel: "出运运营",
            },
            deadline: {
              dueAt: null,
              source: "not_configured",
              label: "未设定",
            },
            restrictedActions: [],
            directAction: { code: "add_cargo_lines", label: "补录明细" },
          },
        ],
      },
    ],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-09-24T00:00:00.000Z",
    projectionVersion: 2,
  };
}

function pendingDetail() {
  const page = pendingPage();
  return {
    shipment: page.items[0]!.shipment,
    handoff: null,
    containers: [
      {
        linkId: "66666666-6666-4666-8666-666666666666",
        containerRecordId: "77777777-7777-4777-8777-777777777777",
        containerNumber: "MSNU9762671",
        containerTypeCode: "40HQ",
        sealNumber: null,
        currentStatus: "shipped",
        linkVersion: 1,
        currentNodeCode: null,
        flowState: null,
        allocations: [],
      },
    ],
    cargoLines: [],
    transportDocuments: [],
    upstreamReferences: [],
    pendingItems: page.items[0]!.pendingItems,
    lifecycleInitialization: {
      state: "ready",
      activeContainerCount: 1,
      initializedContainerCount: 1,
      relationshipVersion: 1,
      lastErrorCode: null,
    },
    projectionVersion: 2,
    asOf: "2026-09-24T00:00:00.000Z",
  };
}

function internalCandidate() {
  return {
    candidateRef: `internal:${"a".repeat(64)}`,
    bookingNumber: "BK-001",
    carrierCode: "HMM",
    vesselName: "ONE INNOVATION",
    voyageNumber: "001E",
    originPortCode: "CNSHA",
    destinationPortCode: "USLAX",
    departedAt: "2026-09-24T00:00:00.000Z",
    departureSourceTimezone: "Asia/Shanghai",
    departureEvidenceRef: null,
    containers: [
      {
        containerRecordId: "11111111-1111-4111-8111-111111111111",
        containerNumber: "HMMU4956442",
        containerTypeCode: "40HQ",
        stuffingSnapshotRef: "22222222-2222-4222-8222-222222222222",
      },
    ],
    replenishmentOrders: [],
    cargoLines: [],
    transportDocuments: [],
    pendingItems: [],
  };
}
