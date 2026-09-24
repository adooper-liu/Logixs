import { computed, reactive, readonly, shallowRef } from "vue";
import { uploadImportBatch, type ImportBatchDto } from "../api/importBatches";
import {
  acceptPostDepartureSourceCandidate,
  correctPostDepartureSourceCandidate,
  completePostDepartureSourceCandidateCargo,
  preflightPostDepartureSourcePackage,
  searchPostDepartureReferencePorts,
  savePostDepartureSourcePackageReview,
  type PostDepartureReferencePortV1,
  type PostDepartureSourceCandidateV1,
  type PostDepartureSourceCandidateCorrectionResultV1,
  type PostDepartureSourceCandidateAcceptResultV1,
  type PostDepartureSourceKindV1,
  type PostDepartureSourcePackagePreflightResultV1,
  type PostDepartureSourcePackageReviewResultV1,
} from "../api/postDepartureSourcePackages";
import { registerAndVerifyEvidence } from "../api/evidence";
import {
  acceptInternalShipmentHandoffCandidate,
  getShipmentDetail,
  listInternalShipmentHandoffCandidates,
  listDepartedShipments,
  type InternalShipmentHandoffCandidateV1,
  type ShipmentDetailV1,
  type ShipmentSummaryV1,
} from "../api/shipments";
import type { PostDepartureShipmentGroupingV1 } from "@logix/contracts";
import { normalizeLocalDateTimeInput } from "../data/postDepartureTime";

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
  const shipmentOptions = shallowRef<ShipmentSummaryV1[]>([]);
  const loadingShipmentOptions = shallowRef(false);
  const shipmentOptionsError = shallowRef("");
  const internalCandidates = shallowRef<InternalShipmentHandoffCandidateV1[]>(
    [],
  );
  const loadingInternalCandidates = shallowRef(false);
  const internalCandidateError = shallowRef("");
  const acceptingInternalCandidateRef = shallowRef("");
  const acceptedShipmentDetail = shallowRef<ShipmentDetailV1 | null>(null);

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
    } catch (cause) {
      acceptanceError.value =
        cause instanceof Error ? cause.message : "接管 Shipment 失败";
    } finally {
      acceptingCandidate.value = false;
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
      await loadInternalCandidates();
    } catch (cause) {
      internalCandidateError.value =
        cause instanceof Error ? cause.message : "暂时无法接管该票内部出运";
    } finally {
      acceptingInternalCandidateRef.value = "";
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
    shipmentOptions: readonly(shipmentOptions),
    loadingShipmentOptions: readonly(loadingShipmentOptions),
    shipmentOptionsError: readonly(shipmentOptionsError),
    internalCandidates: readonly(internalCandidates),
    loadingInternalCandidates: readonly(loadingInternalCandidates),
    internalCandidateError: readonly(internalCandidateError),
    acceptingInternalCandidateRef: readonly(acceptingInternalCandidateRef),
    acceptedShipmentDetail: readonly(acceptedShipmentDetail),
    uploadSource,
    runPreflight,
    selectCandidate,
    saveForReview,
    searchPort,
    saveCandidateCorrection,
    saveCandidateCargoLines,
    acceptSelectedCandidate,
    loadInternalCandidates,
    acceptInternalCandidate,
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
