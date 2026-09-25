import { computed, reactive, readonly, shallowRef } from "vue";
import { uploadImportBatch, type ImportBatchDto } from "../api/importBatches";
import {
  acceptPostDepartureSourceCandidate,
  acceptPostDepartureSourcePackage,
  correctPostDepartureSourceCandidate,
  completePostDepartureSourceCandidateCargo,
  preflightPostDepartureSourcePackage,
  searchPostDepartureReferencePorts,
  savePostDepartureSourcePackageReview,
  type PostDepartureReferencePortV1,
  type PostDepartureSourceCandidateV1,
  type PostDepartureSourceCandidateCorrectionResultV1,
  type PostDepartureSourceCandidateAcceptResultV1,
  type PostDepartureSourcePackageAcceptResultV1,
  type PostDepartureSourceKindV1,
  type PostDepartureSourcePackagePreflightResultV1,
  type PostDepartureSourcePackageReviewResultV1,
} from "../api/postDepartureSourcePackages";
import { registerAndVerifyEvidence } from "../api/evidence";
import {
  acceptInternalShipmentHandoffCandidate,
  acceptInternalShipmentHandoffCandidates,
  bindShipmentPendingSku,
  completeShipmentPendingCargo,
  completeShipmentPendingDocuments,
  completeShipmentPendingFacts,
  getShipmentDetail,
  listInternalShipmentHandoffCandidates,
  listShipmentPendingCompletion,
  listDepartedShipments,
  type InternalShipmentHandoffCandidateV1,
  type InternalShipmentHandoffBatchAcceptResultV1,
  type ShipmentDetailV1,
  type ShipmentPendingCompletionItemV1,
  type ShipmentSummaryV1,
} from "../api/shipments";
import type { PostDepartureShipmentGroupingV1 } from "@logix/contracts";
import {
  normalizeLocalDateTimeInput,
  zonedLocalDateTimeToIso,
} from "../data/postDepartureTime";

export interface CandidateCorrectionDraft {
  shipmentGrouping: PostDepartureShipmentGroupingV1 | null;
  originPortCode: string;
  destinationPortCode: string;
  departureLocal: string;
  sourceTimezone: string;
  evidenceRef: string;
}

export interface CandidateCargoLineDraft {
  sourceLineRef?: string;
  replenishmentOrderNumber: string;
  productNumber: string;
  quantity: string;
  quantityUnit: "piece" | "carton" | "set" | "pallet";
}

export interface ShipmentPendingFactDraft {
  carrierCode: string;
  vesselName: string;
  voyageNumber: string;
  originPortCode: string;
  destinationPortCode: string;
  departureLocal: string;
  sourceTimezone: string;
  evidenceRef: string;
}

export interface ShipmentPendingCargoLineDraft {
  containerRecordId: string;
  productNumber: string;
  quantity: string;
  quantityUnit: "piece" | "carton" | "set" | "pallet";
}

export interface ShipmentPendingSkuBindingDraft {
  cargoLineId: string;
  expectedCargoLineVersion: number;
}

export interface ShipmentPendingDocumentDraft {
  documentType: "booking" | "mbl" | "hbl";
  documentNumber: string;
  scac: string;
  containerRecordIds: string[];
}

export interface PostDepartureSourceUploadView {
  kind: PostDepartureSourceKindV1;
  label: string;
  owner: string;
  fileName: string;
  batch: ImportBatchDto | null;
  uploading: boolean;
  error: string;
}

const SOURCE_DEFINITIONS: ReadonlyArray<
  Pick<PostDepartureSourceUploadView, "kind" | "label" | "owner">
> = [
  { kind: "container", label: "货柜信息", owner: "出运运营" },
  { kind: "customs", label: "清关信息", owner: "清关" },
  { kind: "logistics", label: "物流信息", owner: "内陆调度" },
  { kind: "warehouse", label: "仓库信息", owner: "仓库" },
];

type UploadState = {
  fileName: string;
  batch: ImportBatchDto | null;
  uploading: boolean;
  error: string;
};

type PortSearchState = {
  items: PostDepartureReferencePortV1[];
  searching: boolean;
};

export function usePostDepartureHandoffWorkbench() {
  const uploads = reactive<Record<PostDepartureSourceKindV1, UploadState>>({
    container: emptyUpload(),
    customs: emptyUpload(),
    logistics: emptyUpload(),
    warehouse: emptyUpload(),
  });
  const preflightResult =
    shallowRef<PostDepartureSourcePackagePreflightResultV1 | null>(null);
  const preflighting = shallowRef(false);
  const preflightError = shallowRef("");
  const selectedCandidateRef = shallowRef("");
  const savingReview = shallowRef(false);
  const reviewSaveError = shallowRef("");
  const reviewReceipt =
    shallowRef<PostDepartureSourcePackageReviewResultV1 | null>(null);
  const portSearch = reactive<
    Record<"origin" | "destination", PortSearchState>
  >({
    origin: { items: [], searching: false },
    destination: { items: [], searching: false },
  });
  const savingCorrection = shallowRef(false);
  const correctionError = shallowRef("");
  const correctionResult =
    shallowRef<PostDepartureSourceCandidateCorrectionResultV1 | null>(null);
  const correctionIdempotencyKeys = new Map<string, string>();
  const savingCargo = shallowRef(false);
  const cargoError = shallowRef("");
  const cargoResult =
    shallowRef<PostDepartureSourceCandidateCorrectionResultV1 | null>(null);
  const cargoIdempotencyKeys = new Map<string, string>();
  const acceptingCandidate = shallowRef(false);
  const acceptanceError = shallowRef("");
  const acceptanceResult =
    shallowRef<PostDepartureSourceCandidateAcceptResultV1 | null>(null);
  const acceptanceIdempotencyKeys = new Map<string, string>();
  const acceptingAllCandidates = shallowRef(false);
  const batchAcceptanceError = shallowRef("");
  const batchAcceptanceResult =
    shallowRef<PostDepartureSourcePackageAcceptResultV1 | null>(null);
  const batchAcceptanceIdempotencyKeys = new Map<string, string>();
  const shipmentOptions = shallowRef<ShipmentSummaryV1[]>([]);
  const loadingShipmentOptions = shallowRef(false);
  const shipmentOptionsError = shallowRef("");
  const internalCandidates = shallowRef<InternalShipmentHandoffCandidateV1[]>(
    [],
  );
  const loadingInternalCandidates = shallowRef(false);
  const internalCandidateError = shallowRef("");
  const acceptingInternalCandidateRef = shallowRef("");
  const acceptingAllInternalCandidates = shallowRef(false);
  const internalBatchAcceptanceResult =
    shallowRef<InternalShipmentHandoffBatchAcceptResultV1 | null>(null);
  const acceptedShipmentDetail = shallowRef<ShipmentDetailV1 | null>(null);
  const pendingCompletionItems = shallowRef<ShipmentPendingCompletionItemV1[]>(
    [],
  );
  const loadingPendingCompletion = shallowRef(false);
  const pendingCompletionError = shallowRef("");
  const selectedPendingShipmentId = shallowRef("");
  const selectedPendingShipmentDetail = shallowRef<ShipmentDetailV1 | null>(
    null,
  );
  const loadingPendingShipmentDetail = shallowRef(false);
  const pendingShipmentDetailError = shallowRef("");
  const savingPendingFacts = shallowRef(false);
  const pendingFactSaveError = shallowRef("");
  const pendingFactSaveNotice = shallowRef("");
  const pendingFactSaveResult = shallowRef<Awaited<
    ReturnType<typeof completeShipmentPendingFacts>
  > | null>(null);
  const pendingFactIdempotency = new Map<
    string,
    { idempotencyKey: string; occurredAt: string }
  >();
  const savingPendingCargo = shallowRef(false);
  const pendingCargoSaveError = shallowRef("");
  const pendingCargoSaveNotice = shallowRef("");
  const pendingCargoSaveResult = shallowRef<Awaited<
    ReturnType<typeof completeShipmentPendingCargo>
  > | null>(null);
  const pendingCargoIdempotency = new Map<
    string,
    { idempotencyKey: string; occurredAt: string }
  >();
  const bindingPendingSkuLineId = shallowRef("");
  const pendingSkuBindingError = shallowRef("");
  const pendingSkuBindingNotice = shallowRef("");
  const pendingSkuBindingResult = shallowRef<Awaited<
    ReturnType<typeof bindShipmentPendingSku>
  > | null>(null);
  const pendingSkuIdempotency = new Map<
    string,
    { idempotencyKey: string; occurredAt: string }
  >();
  const savingPendingDocuments = shallowRef(false);
  const pendingDocumentSaveError = shallowRef("");
  const pendingDocumentSaveNotice = shallowRef("");
  const pendingDocumentSaveResult = shallowRef<Awaited<
    ReturnType<typeof completeShipmentPendingDocuments>
  > | null>(null);
  const pendingDocumentIdempotency = new Map<
    string,
    { idempotencyKey: string; occurredAt: string }
  >();

  const sources = computed<PostDepartureSourceUploadView[]>(() =>
    SOURCE_DEFINITIONS.map((definition) => ({
      ...definition,
      ...uploads[definition.kind],
    })),
  );
  const sourceCount = computed(
    () => SOURCE_DEFINITIONS.filter(({ kind }) => uploads[kind].batch).length,
  );
  const canPreflight = computed(() => sourceCount.value > 0);
  const candidates = computed(() => preflightResult.value?.candidates ?? []);
  const selectedCandidate = computed<PostDepartureSourceCandidateV1 | null>(
    () =>
      candidates.value.find(
        ({ candidateRef }) => candidateRef === selectedCandidateRef.value,
      ) ??
      candidates.value[0] ??
      null,
  );
  const preflightResultView = computed(() => preflightResult.value);
  const availableGroupCount = computed(() => {
    const keys = new Set<string>();
    for (const candidate of candidates.value) {
      if (candidate.decision === "rejected") continue;
      keys.add(candidateGroupKey(candidate));
    }
    return keys.size;
  });
  const selectedPendingCompletion = computed(
    () =>
      pendingCompletionItems.value.find(
        ({ shipment }) => shipment.id === selectedPendingShipmentId.value,
      ) ??
      pendingCompletionItems.value[0] ??
      null,
  );

  async function uploadSource(
    kind: PostDepartureSourceKindV1,
    file: File,
  ): Promise<void> {
    const state = uploads[kind];
    state.fileName = file.name;
    state.uploading = true;
    state.error = "";
    preflightResult.value = null;
    preflightError.value = "";
    selectedCandidateRef.value = "";
    reviewSaveError.value = "";
    reviewReceipt.value = null;
    resetCorrectionState();
    try {
      state.batch = await uploadImportBatch(file, state.batch?.id);
    } catch (cause) {
      state.batch = null;
      state.error = cause instanceof Error ? cause.message : "文件上传失败";
    } finally {
      state.uploading = false;
    }
  }

  async function runPreflight(): Promise<void> {
    if (!canPreflight.value) return;
    preflighting.value = true;
    preflightError.value = "";
    reviewSaveError.value = "";
    reviewReceipt.value = null;
    acceptanceError.value = "";
    acceptanceResult.value = null;
    try {
      preflightResult.value =
        await preflightPostDepartureSourcePackage(selectedSources());
      selectedCandidateRef.value =
        preflightResult.value.candidates[0]?.candidateRef ?? "";
      syncSelectedCorrectionState();
      await loadShipmentOptions();
    } catch (cause) {
      preflightResult.value = null;
      preflightError.value =
        cause instanceof Error ? cause.message : "联合预检失败";
    } finally {
      preflighting.value = false;
    }
  }

  function selectCandidate(candidateRef: string): void {
    selectedCandidateRef.value = candidateRef;
    correctionError.value = "";
    correctionResult.value = null;
    cargoError.value = "";
    cargoResult.value = null;
    acceptanceError.value = "";
    acceptanceResult.value = null;
    syncSelectedCorrectionState();
  }

  async function acceptSelectedCandidate(): Promise<void> {
    const current = selectedCandidate.value;
    const packageResult = preflightResult.value;
    if (!current || !packageResult) return;
    if (current.decision === "rejected") {
      acceptanceError.value = "当前货柜存在身份或引用冲突，请先按提示处理";
      return;
    }
    acceptingCandidate.value = true;
    acceptanceError.value = "";
    acceptanceResult.value = null;
    const key = `${packageResult.packageId}:${current.candidateRef}`;
    const idempotencyKey =
      acceptanceIdempotencyKeys.get(key) ??
      `candidate-accept:${packageResult.packageId.slice(0, 32)}:${crypto.randomUUID()}`;
    acceptanceIdempotencyKeys.set(key, idempotencyKey);
    try {
      acceptanceResult.value = await acceptPostDepartureSourceCandidate({
        contractVersion: "post-departure-source-candidate-accept.v1",
        packageId: packageResult.packageId,
        sources: selectedSources(),
        candidateRef: current.candidateRef,
        idempotencyKey,
      });
      acceptanceIdempotencyKeys.delete(key);
      await loadPendingCompletion();
    } catch (cause) {
      acceptanceError.value =
        cause instanceof Error ? cause.message : "接管 Shipment 失败";
    } finally {
      acceptingCandidate.value = false;
    }
  }

  async function acceptAllAvailableCandidates(): Promise<void> {
    const packageResult = preflightResult.value;
    if (!packageResult || availableGroupCount.value === 0) return;
    acceptingAllCandidates.value = true;
    batchAcceptanceError.value = "";
    batchAcceptanceResult.value = null;
    const key = packageResult.packageId;
    const idempotencyKey =
      batchAcceptanceIdempotencyKeys.get(key) ??
      `package-accept:${packageResult.packageId.slice(0, 32)}:${crypto.randomUUID()}`;
    batchAcceptanceIdempotencyKeys.set(key, idempotencyKey);
    try {
      const result = await acceptPostDepartureSourcePackage({
        contractVersion: "post-departure-source-package-accept.v1",
        packageId: packageResult.packageId,
        sources: selectedSources(),
        idempotencyKey,
      });
      batchAcceptanceResult.value = result;
      if (result.totals.failed === 0 && result.totals.conflict === 0) {
        batchAcceptanceIdempotencyKeys.delete(key);
      }
      await loadPendingCompletion();
    } catch (cause) {
      batchAcceptanceError.value =
        cause instanceof Error ? cause.message : "批量接管 Shipment 失败";
    } finally {
      acceptingAllCandidates.value = false;
    }
  }

  async function saveCandidateCargoLines(
    lines: CandidateCargoLineDraft[],
  ): Promise<void> {
    const current = selectedCandidate.value;
    const packageResult = preflightResult.value;
    if (!current?.correction || !packageResult) {
      cargoError.value = "请先确认所属出运、港口和离港事实";
      return;
    }
    if (lines.length === 0) {
      cargoError.value = "请至少填写一条 SKU 装载明细";
      return;
    }
    savingCargo.value = true;
    cargoError.value = "";
    cargoResult.value = null;
    const receipt = await ensureReviewReceipt();
    if (!receipt) {
      cargoError.value =
        reviewSaveError.value || "当前输入已保留，暂时无法保存，请稍后重试";
      savingCargo.value = false;
      return;
    }
    const key = `${receipt.reviewId}:${current.candidateRef}:${current.correction.version}`;
    const idempotencyKey =
      cargoIdempotencyKeys.get(key) ??
      `candidate-cargo:${receipt.reviewId}:${current.candidateRef}:${crypto.randomUUID()}`;
    cargoIdempotencyKeys.set(key, idempotencyKey);
    try {
      const saved = await completePostDepartureSourceCandidateCargo({
        contractVersion: "post-departure-source-candidate-cargo.v1",
        packageId: packageResult.packageId,
        reviewId: receipt.reviewId,
        candidateRef: current.candidateRef,
        expectedVersion: current.correction.version,
        cargoLines: lines as Parameters<
          typeof completePostDepartureSourceCandidateCargo
        >[0]["cargoLines"],
        reasonCode: "cargo_lines_confirmed",
        idempotencyKey,
      });
      replaceCandidate(saved.candidate);
      cargoResult.value = saved;
      cargoIdempotencyKeys.delete(key);
      syncSelectedCorrectionState();
    } catch (cause) {
      cargoError.value =
        cause instanceof Error ? cause.message : "保存 SKU 装载明细失败";
    } finally {
      savingCargo.value = false;
    }
  }

  async function saveForReview(): Promise<void> {
    const result = preflightResult.value;
    if (!result || result.candidates.length === 0) return;
    if (!result.candidates.some((candidate) => candidate.issues.length > 0)) {
      reviewSaveError.value = "当前没有需要登记的待补事项";
      return;
    }
    savingReview.value = true;
    reviewSaveError.value = "";
    try {
      reviewReceipt.value = await savePostDepartureSourcePackageReview(
        result.packageId,
        selectedSources(),
      );
    } catch (cause) {
      reviewSaveError.value =
        cause instanceof Error ? cause.message : "保存待复核失败";
    } finally {
      savingReview.value = false;
    }
  }

  async function ensureReviewReceipt(): Promise<PostDepartureSourcePackageReviewResultV1 | null> {
    if (reviewReceipt.value) return reviewReceipt.value;
    await saveForReview();
    return reviewReceipt.value;
  }

  async function searchPort(
    scope: "origin" | "destination",
    query: string,
  ): Promise<void> {
    const state = portSearch[scope];
    state.searching = true;
    correctionError.value = "";
    try {
      state.items = (await searchPostDepartureReferencePorts(query, 20)).items;
      if (state.items.length === 0) {
        correctionError.value = "未找到可用的权威港口，请核对名称或 UN/LOCODE";
      }
    } catch (cause) {
      correctionError.value =
        cause instanceof Error ? cause.message : "查找权威港口失败";
    } finally {
      state.searching = false;
    }
  }

  async function saveCandidateCorrection(
    draft: CandidateCorrectionDraft,
  ): Promise<void> {
    const current = selectedCandidate.value;
    const packageResult = preflightResult.value;
    if (!current || !packageResult) {
      return;
    }
    savingCorrection.value = true;
    correctionError.value = "";
    correctionResult.value = null;
    const receipt = await ensureReviewReceipt();
    if (!receipt) {
      correctionError.value =
        reviewSaveError.value || "当前输入已保留，暂时无法保存，请稍后重试";
      savingCorrection.value = false;
      return;
    }
    const key = `${receipt.reviewId}:${current.candidateRef}`;
    const idempotencyKey =
      correctionIdempotencyKeys.get(key) ??
      `candidate-correction:${receipt.reviewId}:${current.candidateRef}:${crypto.randomUUID()}`;
    correctionIdempotencyKeys.set(key, idempotencyKey);
    try {
      const evidenceLocator = draft.evidenceRef.trim();
      const evidenceRef = evidenceLocator
        ? await registerAndVerifyEvidence(
            "domain_fact",
            receipt.reviewId,
            evidenceLocator,
            {
              evidenceType: "document",
              authorityLevel: "operational",
              sourceType: "person",
              authoritySystem: "shipping-operations",
              captureSource: "manual_backfill",
            },
          )
        : (current.correction?.departureEvidenceRef ??
          current.correction?.departureProof?.evidenceRef ??
          null);
      const saved = await correctPostDepartureSourceCandidate({
        contractVersion: "post-departure-source-candidate-correction.v1",
        packageId: packageResult.packageId,
        reviewId: receipt.reviewId,
        candidateRef: current.candidateRef,
        expectedVersion: current.correction?.version ?? 0,
        shipmentGrouping: draft.shipmentGrouping,
        originPortCode: draft.originPortCode.trim() || null,
        destinationPortCode: draft.destinationPortCode.trim() || null,
        departureLocal:
          normalizeLocalDateTimeInput(draft.departureLocal.trim()) || null,
        departureSourceTimezone: draft.sourceTimezone.trim() || null,
        departureEvidenceRef: evidenceRef,
        reasonCode: "source_progress_saved",
        idempotencyKey,
      });
      replaceCandidate(saved.candidate);
      correctionResult.value = saved;
      correctionIdempotencyKeys.delete(key);
      syncSelectedCorrectionState();
    } catch (cause) {
      correctionError.value =
        cause instanceof Error ? cause.message : "保存接管信息失败";
    } finally {
      savingCorrection.value = false;
    }
  }

  function replaceCandidate(candidate: PostDepartureSourceCandidateV1): void {
    const current = preflightResult.value;
    if (!current) return;
    const candidates = current.candidates.map((item) =>
      item.candidateRef === candidate.candidateRef ? candidate : item,
    );
    preflightResult.value = {
      ...current,
      candidates,
      totals: {
        ...current.totals,
        ready: candidates.filter(({ decision }) => decision === "ready").length,
        reviewRequired: candidates.filter(
          ({ decision }) => decision === "review_required",
        ).length,
        rejected: candidates.filter(({ decision }) => decision === "rejected")
          .length,
      },
    };
  }

  function syncSelectedCorrectionState(): void {
    const correction = selectedCandidate.value?.correction;
    portSearch.origin.items = correction?.originPort
      ? [correction.originPort]
      : [];
    portSearch.destination.items = correction?.destinationPort
      ? [correction.destinationPort]
      : [];
  }

  function resetCorrectionState(): void {
    portSearch.origin.items = [];
    portSearch.destination.items = [];
    portSearch.origin.searching = false;
    portSearch.destination.searching = false;
    savingCorrection.value = false;
    correctionError.value = "";
    correctionResult.value = null;
    correctionIdempotencyKeys.clear();
    savingCargo.value = false;
    cargoError.value = "";
    cargoResult.value = null;
    cargoIdempotencyKeys.clear();
    acceptingCandidate.value = false;
    acceptanceError.value = "";
    acceptanceResult.value = null;
    acceptanceIdempotencyKeys.clear();
    shipmentOptions.value = [];
    shipmentOptionsError.value = "";
    loadingShipmentOptions.value = false;
  }

  async function loadShipmentOptions(): Promise<void> {
    loadingShipmentOptions.value = true;
    shipmentOptionsError.value = "";
    try {
      shipmentOptions.value = await listDepartedShipments();
    } catch (cause) {
      shipmentOptions.value = [];
      shipmentOptionsError.value =
        cause instanceof Error ? cause.message : "查找现有出运失败";
    } finally {
      loadingShipmentOptions.value = false;
    }
  }

  async function loadInternalCandidates(): Promise<void> {
    loadingInternalCandidates.value = true;
    internalCandidateError.value = "";
    try {
      internalCandidates.value = (
        await listInternalShipmentHandoffCandidates()
      ).items;
    } catch (cause) {
      internalCandidateError.value =
        cause instanceof Error ? cause.message : "暂时无法加载系统内已出运记录";
    } finally {
      loadingInternalCandidates.value = false;
    }
  }

  async function loadPendingCompletion(): Promise<void> {
    loadingPendingCompletion.value = true;
    pendingCompletionError.value = "";
    try {
      pendingCompletionItems.value = (
        await listShipmentPendingCompletion(100)
      ).items;
      if (
        !pendingCompletionItems.value.some(
          ({ shipment }) => shipment.id === selectedPendingShipmentId.value,
        )
      ) {
        selectedPendingShipmentId.value =
          pendingCompletionItems.value[0]?.shipment.id ?? "";
      }
      if (selectedPendingShipmentId.value) {
        await loadPendingShipmentDetail(selectedPendingShipmentId.value);
      } else {
        selectedPendingShipmentDetail.value = null;
      }
    } catch (cause) {
      pendingCompletionError.value =
        cause instanceof Error ? cause.message : "暂时无法加载已接管待补任务";
    } finally {
      loadingPendingCompletion.value = false;
    }
  }

  async function selectPendingCompletion(shipmentId: string): Promise<void> {
    selectedPendingShipmentId.value = shipmentId;
    pendingFactSaveError.value = "";
    pendingFactSaveNotice.value = "";
    pendingFactSaveResult.value = null;
    pendingCargoSaveError.value = "";
    pendingCargoSaveNotice.value = "";
    pendingCargoSaveResult.value = null;
    pendingSkuBindingError.value = "";
    pendingSkuBindingNotice.value = "";
    pendingSkuBindingResult.value = null;
    pendingDocumentSaveError.value = "";
    pendingDocumentSaveNotice.value = "";
    pendingDocumentSaveResult.value = null;
    await loadPendingShipmentDetail(shipmentId);
  }

  async function loadPendingShipmentDetail(shipmentId: string): Promise<void> {
    loadingPendingShipmentDetail.value = true;
    pendingShipmentDetailError.value = "";
    try {
      const detail = await getShipmentDetail(shipmentId);
      if (selectedPendingShipmentId.value === shipmentId) {
        selectedPendingShipmentDetail.value = detail;
      }
    } catch (cause) {
      if (selectedPendingShipmentId.value === shipmentId) {
        selectedPendingShipmentDetail.value = null;
        pendingShipmentDetailError.value =
          cause instanceof Error
            ? cause.message
            : "暂时无法加载当前 Shipment 货柜";
      }
    } finally {
      if (selectedPendingShipmentId.value === shipmentId) {
        loadingPendingShipmentDetail.value = false;
      }
    }
  }

  async function savePendingShipmentFacts(
    draft: ShipmentPendingFactDraft,
  ): Promise<void> {
    const current = selectedPendingCompletion.value;
    if (!current) return;
    savingPendingFacts.value = true;
    pendingFactSaveError.value = "";
    pendingFactSaveNotice.value = "";
    pendingFactSaveResult.value = null;
    const normalized = {
      carrierCode: draft.carrierCode.trim(),
      vesselName: draft.vesselName.trim(),
      voyageNumber: draft.voyageNumber.trim(),
      originPortCode: draft.originPortCode.trim().toUpperCase(),
      destinationPortCode: draft.destinationPortCode.trim().toUpperCase(),
      departureLocal: normalizeLocalDateTimeInput(draft.departureLocal.trim()),
      sourceTimezone: draft.sourceTimezone.trim(),
      evidenceRef: draft.evidenceRef.trim(),
    };
    const signature = `${current.shipment.id}:${current.shipment.relationshipVersion}:${JSON.stringify(normalized)}`;
    const operation = pendingFactIdempotency.get(signature) ?? {
      idempotencyKey: `shipment-pending-facts:${current.shipment.id}:${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
    };
    pendingFactIdempotency.set(signature, operation);
    try {
      let departureProof;
      if (
        normalized.departureLocal &&
        normalized.sourceTimezone &&
        normalized.evidenceRef
      ) {
        const evidenceId = await registerAndVerifyEvidence(
          "shipment",
          current.shipment.id,
          normalized.evidenceRef,
          {
            evidenceType: "document",
            authorityLevel: "operational",
            sourceType: "person",
            authoritySystem: "shipping-operations",
            captureSource: "manual_backfill",
          },
        );
        departureProof = {
          kind: "actual_departure_time" as const,
          occurredAt: zonedLocalDateTimeToIso(
            normalized.departureLocal,
            normalized.sourceTimezone,
          ),
          sourceTimezone: normalized.sourceTimezone,
          evidenceRef: evidenceId,
        };
      } else if (
        normalized.departureLocal ||
        normalized.sourceTimezone ||
        normalized.evidenceRef
      ) {
        pendingFactSaveNotice.value =
          "离港时间、来源时区和依据需同时具备；其他内容已照常保存，离港依据继续待补。";
      }

      pendingFactSaveResult.value = await completeShipmentPendingFacts(
        current.shipment.id,
        {
          contractVersion: "shipment-pending-fact-completion.v1",
          expectedRelationshipVersion: current.shipment.relationshipVersion,
          occurredAt: operation.occurredAt,
          idempotencyKey: operation.idempotencyKey,
          facts: {
            carrierCode: normalized.carrierCode || null,
            vesselName: normalized.vesselName || null,
            voyageNumber: normalized.voyageNumber || null,
            originPortCode: normalized.originPortCode || null,
            destinationPortCode: normalized.destinationPortCode || null,
            departureProof: departureProof ?? null,
          },
        },
      );
      pendingFactIdempotency.delete(signature);
      await loadPendingCompletion();
    } catch (cause) {
      pendingFactSaveError.value =
        cause instanceof Error
          ? cause.message
          : "暂时无法保存 Shipment 待补事实";
    } finally {
      savingPendingFacts.value = false;
    }
  }

  async function savePendingShipmentCargo(
    lines: ShipmentPendingCargoLineDraft[],
  ): Promise<void> {
    const current = selectedPendingCompletion.value;
    if (!current) return;
    pendingCargoSaveError.value = "";
    pendingCargoSaveNotice.value = "";
    pendingCargoSaveResult.value = null;
    if (lines.length === 0) {
      pendingCargoSaveNotice.value =
        "本次未填写明细，待补任务已保留，可继续处理其他工作。";
      return;
    }
    savingPendingCargo.value = true;
    const signature = `${current.shipment.id}:${current.shipment.relationshipVersion}:${JSON.stringify(lines)}`;
    const operation = pendingCargoIdempotency.get(signature) ?? {
      idempotencyKey: `shipment-pending-cargo:${current.shipment.id}:${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
    };
    pendingCargoIdempotency.set(signature, operation);
    try {
      pendingCargoSaveResult.value = await completeShipmentPendingCargo(
        current.shipment.id,
        {
          contractVersion: "shipment-pending-cargo-completion.v1",
          expectedRelationshipVersion: current.shipment.relationshipVersion,
          occurredAt: operation.occurredAt,
          idempotencyKey: operation.idempotencyKey,
          lines: [lines[0]!, ...lines.slice(1)],
        },
      );
      if (pendingCargoSaveResult.value.unmatchedSkuCount > 0) {
        pendingCargoSaveNotice.value = `${pendingCargoSaveResult.value.unmatchedSkuCount} 个 SKU 尚未匹配物料主数据，装载明细已保存并转入持续待补。`;
      }
      pendingCargoIdempotency.delete(signature);
      await loadPendingCompletion();
    } catch (cause) {
      pendingCargoSaveError.value =
        cause instanceof Error ? cause.message : "暂时无法保存 SKU 装载明细";
    } finally {
      savingPendingCargo.value = false;
    }
  }

  async function bindPendingShipmentSku(
    draft: ShipmentPendingSkuBindingDraft,
  ): Promise<void> {
    const current = selectedPendingCompletion.value;
    if (!current) return;
    bindingPendingSkuLineId.value = draft.cargoLineId;
    pendingSkuBindingError.value = "";
    pendingSkuBindingNotice.value = "";
    pendingSkuBindingResult.value = null;
    const signature = `${current.shipment.id}:${current.shipment.relationshipVersion}:${draft.cargoLineId}:${draft.expectedCargoLineVersion}`;
    const operation = pendingSkuIdempotency.get(signature) ?? {
      idempotencyKey: `shipment-pending-sku:${current.shipment.id}:${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
    };
    pendingSkuIdempotency.set(signature, operation);
    try {
      pendingSkuBindingResult.value = await bindShipmentPendingSku(
        current.shipment.id,
        {
          contractVersion: "shipment-pending-sku-binding.v1",
          expectedRelationshipVersion: current.shipment.relationshipVersion,
          expectedCargoLineVersion: draft.expectedCargoLineVersion,
          occurredAt: operation.occurredAt,
          idempotencyKey: operation.idempotencyKey,
          cargoLineId: draft.cargoLineId,
        },
      );
      pendingSkuBindingNotice.value =
        pendingSkuBindingResult.value.skuResolution === "registered"
          ? `SKU ${pendingSkuBindingResult.value.productNumber} 已建档并绑定。`
          : `SKU ${pendingSkuBindingResult.value.productNumber} 已匹配并绑定。`;
      pendingSkuIdempotency.delete(signature);
      await loadPendingCompletion();
    } catch (cause) {
      pendingSkuBindingError.value =
        cause instanceof Error
          ? cause.message
          : "暂时无法建立或绑定 SKU 主数据";
    } finally {
      bindingPendingSkuLineId.value = "";
    }
  }

  async function savePendingShipmentDocuments(
    drafts: ShipmentPendingDocumentDraft[],
  ): Promise<void> {
    const current = selectedPendingCompletion.value;
    if (!current) return;
    pendingDocumentSaveError.value = "";
    pendingDocumentSaveNotice.value = "";
    pendingDocumentSaveResult.value = null;
    if (drafts.length === 0) {
      pendingDocumentSaveNotice.value =
        "本次未填写提单，待补任务已保留，可继续处理其他工作。";
      return;
    }
    savingPendingDocuments.value = true;
    const documents = drafts.map((draft) => {
      const containerRecordIds = [...new Set(draft.containerRecordIds)];
      return {
        documentType: draft.documentType,
        documentNumber: draft.documentNumber.trim(),
        scac: draft.scac.trim().toUpperCase() || null,
        containerRecordIds: [
          containerRecordIds[0]!,
          ...containerRecordIds.slice(1),
        ] as [string, ...string[]],
      };
    });
    const signature = `${current.shipment.id}:${current.shipment.relationshipVersion}:${JSON.stringify(documents)}`;
    const operation = pendingDocumentIdempotency.get(signature) ?? {
      idempotencyKey: `shipment-pending-document:${current.shipment.id}:${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
    };
    pendingDocumentIdempotency.set(signature, operation);
    try {
      pendingDocumentSaveResult.value = await completeShipmentPendingDocuments(
        current.shipment.id,
        {
          contractVersion: "shipment-pending-document-completion.v1",
          expectedRelationshipVersion: current.shipment.relationshipVersion,
          occurredAt: operation.occurredAt,
          idempotencyKey: operation.idempotencyKey,
          documents: [documents[0]!, ...documents.slice(1)],
        },
      );
      pendingDocumentSaveNotice.value = `已保存 ${pendingDocumentSaveResult.value.documentCount} 份运输单证。`;
      pendingDocumentIdempotency.delete(signature);
      await loadPendingCompletion();
    } catch (cause) {
      pendingDocumentSaveError.value =
        cause instanceof Error ? cause.message : "暂时无法保存提单资料";
    } finally {
      savingPendingDocuments.value = false;
    }
  }

  async function acceptInternalCandidate(candidateRef: string): Promise<void> {
    acceptingInternalCandidateRef.value = candidateRef;
    internalCandidateError.value = "";
    acceptedShipmentDetail.value = null;
    try {
      const result = await acceptInternalShipmentHandoffCandidate({
        contractVersion: "internal-shipment-handoff-accept.v1",
        candidateRef,
        idempotencyKey: `internal-handoff:${crypto.randomUUID()}`,
      });
      if (!result.handoff.shipmentId) {
        throw new Error("接管已完成，但 Shipment 关系暂时无法读取");
      }
      acceptedShipmentDetail.value = await getShipmentDetail(
        result.handoff.shipmentId,
      );
      await Promise.all([loadInternalCandidates(), loadPendingCompletion()]);
    } catch (cause) {
      internalCandidateError.value =
        cause instanceof Error ? cause.message : "暂时无法接管该票内部出运";
    } finally {
      acceptingInternalCandidateRef.value = "";
    }
  }

  async function acceptAllInternalCandidates(): Promise<void> {
    const candidateRefs = internalCandidates.value.map(
      ({ candidateRef }) => candidateRef,
    );
    if (candidateRefs.length === 0) return;
    acceptingAllInternalCandidates.value = true;
    internalCandidateError.value = "";
    internalBatchAcceptanceResult.value = null;
    try {
      internalBatchAcceptanceResult.value =
        await acceptInternalShipmentHandoffCandidates({
          contractVersion: "internal-shipment-handoff-batch-accept.v1",
          candidateRefs: [candidateRefs[0]!, ...candidateRefs.slice(1)],
          idempotencyKey: `internal-handoff-batch:${crypto.randomUUID()}`,
        });
      await Promise.all([loadInternalCandidates(), loadPendingCompletion()]);
    } catch (cause) {
      internalCandidateError.value =
        cause instanceof Error
          ? cause.message
          : "暂时无法批量接管系统内已出运记录";
    } finally {
      acceptingAllInternalCandidates.value = false;
    }
  }

  return {
    sources,
    sourceCount,
    canPreflight,
    preflightResult: preflightResultView,
    candidates,
    selectedCandidate,
    selectedCandidateRef: readonly(selectedCandidateRef),
    preflighting: readonly(preflighting),
    preflightError: readonly(preflightError),
    savingReview: readonly(savingReview),
    reviewSaveError: readonly(reviewSaveError),
    reviewReceipt: readonly(reviewReceipt),
    originPortOptions: computed(() => portSearch.origin.items),
    destinationPortOptions: computed(() => portSearch.destination.items),
    searchingOriginPort: computed(() => portSearch.origin.searching),
    searchingDestinationPort: computed(() => portSearch.destination.searching),
    savingCorrection: readonly(savingCorrection),
    correctionError: readonly(correctionError),
    correctionResult: readonly(correctionResult),
    savingCargo: readonly(savingCargo),
    cargoError: readonly(cargoError),
    cargoResult: readonly(cargoResult),
    acceptingCandidate: readonly(acceptingCandidate),
    acceptanceError: readonly(acceptanceError),
    acceptanceResult: readonly(acceptanceResult),
    availableGroupCount,
    acceptingAllCandidates: readonly(acceptingAllCandidates),
    batchAcceptanceError: readonly(batchAcceptanceError),
    batchAcceptanceResult: readonly(batchAcceptanceResult),
    shipmentOptions: readonly(shipmentOptions),
    loadingShipmentOptions: readonly(loadingShipmentOptions),
    shipmentOptionsError: readonly(shipmentOptionsError),
    internalCandidates: readonly(internalCandidates),
    loadingInternalCandidates: readonly(loadingInternalCandidates),
    internalCandidateError: readonly(internalCandidateError),
    acceptingInternalCandidateRef: readonly(acceptingInternalCandidateRef),
    acceptingAllInternalCandidates: readonly(acceptingAllInternalCandidates),
    internalBatchAcceptanceResult: readonly(internalBatchAcceptanceResult),
    acceptedShipmentDetail: readonly(acceptedShipmentDetail),
    pendingCompletionItems: readonly(pendingCompletionItems),
    loadingPendingCompletion: readonly(loadingPendingCompletion),
    pendingCompletionError: readonly(pendingCompletionError),
    selectedPendingShipmentId: readonly(selectedPendingShipmentId),
    selectedPendingCompletion,
    selectedPendingShipmentDetail: readonly(selectedPendingShipmentDetail),
    loadingPendingShipmentDetail: readonly(loadingPendingShipmentDetail),
    pendingShipmentDetailError: readonly(pendingShipmentDetailError),
    savingPendingFacts: readonly(savingPendingFacts),
    pendingFactSaveError: readonly(pendingFactSaveError),
    pendingFactSaveNotice: readonly(pendingFactSaveNotice),
    pendingFactSaveResult: readonly(pendingFactSaveResult),
    savingPendingCargo: readonly(savingPendingCargo),
    pendingCargoSaveError: readonly(pendingCargoSaveError),
    pendingCargoSaveNotice: readonly(pendingCargoSaveNotice),
    pendingCargoSaveResult: readonly(pendingCargoSaveResult),
    bindingPendingSkuLineId: readonly(bindingPendingSkuLineId),
    pendingSkuBindingError: readonly(pendingSkuBindingError),
    pendingSkuBindingNotice: readonly(pendingSkuBindingNotice),
    pendingSkuBindingResult: readonly(pendingSkuBindingResult),
    savingPendingDocuments: readonly(savingPendingDocuments),
    pendingDocumentSaveError: readonly(pendingDocumentSaveError),
    pendingDocumentSaveNotice: readonly(pendingDocumentSaveNotice),
    pendingDocumentSaveResult: readonly(pendingDocumentSaveResult),
    uploadSource,
    runPreflight,
    selectCandidate,
    saveForReview,
    searchPort,
    saveCandidateCorrection,
    saveCandidateCargoLines,
    acceptSelectedCandidate,
    acceptAllAvailableCandidates,
    loadInternalCandidates,
    loadPendingCompletion,
    selectPendingCompletion,
    savePendingShipmentFacts,
    savePendingShipmentCargo,
    bindPendingShipmentSku,
    savePendingShipmentDocuments,
    acceptInternalCandidate,
    acceptAllInternalCandidates,
  };

  function selectedSources(): Parameters<
    typeof preflightPostDepartureSourcePackage
  >[0] {
    return SOURCE_DEFINITIONS.flatMap(({ kind }) => {
      const batch = uploads[kind].batch;
      return batch ? [{ kind, batchId: batch.id }] : [];
    }) as Parameters<typeof preflightPostDepartureSourcePackage>[0];
  }
}

function emptyUpload(): UploadState {
  return { fileName: "", batch: null, uploading: false, error: "" };
}

function candidateGroupKey(candidate: PostDepartureSourceCandidateV1): string {
  const grouping = candidate.correction?.shipmentGrouping;
  if (grouping?.kind === "authorized_new_shipment") {
    return `authorized:${grouping.shipmentNumber}`;
  }
  if (grouping?.kind === "existing_shipment") {
    return `existing:${grouping.shipmentId}`;
  }
  return `candidate:${candidate.candidateRef}`;
}
