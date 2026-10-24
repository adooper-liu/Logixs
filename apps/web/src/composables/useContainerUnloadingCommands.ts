import type {
  ContainerUnloadingOperationState,
  ContainerUnloadingReport,
  ContainerUnloadingSealCheck,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { readonly, ref, shallowRef } from "vue";
import { appendContainerUnloadingReport } from "../api/containerUnloading";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
} from "../api/evidence";
import {
  recordLifecycleDateFact,
  type RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import { parseZonedDateTime } from "../utils/zonedDateTime";

export interface UnloadingReportDraft {
  operationState: ContainerUnloadingOperationState;
  startedLocal: string;
  completedLocal: string;
  expectedQuantity: string;
  unloadedQuantity: string;
  remainingQuantity: string;
  damagedQuantity: string;
  shortageQuantity: string;
  quantityUnit: "piece" | "carton" | "set" | "pallet";
  sealCheck: ContainerUnloadingSealCheck;
  exceptionResolved: boolean;
  exceptionNotes: string;
  evidenceInputs: string[];
}

type Stage = "report" | "date" | "reload";
export type UnloadingAttemptStage = Stage | null;
interface Attempt {
  containerId: string;
  taskId: string;
  selectionKey: string;
  generation: number;
  draft: UnloadingReportDraft;
  instruction: WarehouseDeliveryInstruction;
  expectedVersion: number;
  projectionVersion: number;
  reportKey: string;
  dateKey: string | null;
  evidenceRefs: string[] | null;
  reportPayload?: Parameters<typeof appendContainerUnloadingReport>[1];
  report?: ContainerUnloadingReport;
  datePayload?: Parameters<typeof recordLifecycleDateFact>[1];
  stage: Stage;
}
interface Owner {
  containerId: string;
  taskId: string;
  selectionKey: string;
  generation: number;
  token: symbol;
}

export interface UnloadingSelectionOwner {
  taskId?: string;
  selectionKey?: string;
  generation?: number;
}

export interface UnloadingCurrentAuthority {
  containerId: string;
  taskId?: string;
  selectionKey?: string;
  generation?: number;
  instruction: WarehouseDeliveryInstruction | null;
  reportVersion: number | null;
  projectionVersion: number | null;
}

export function useContainerUnloadingCommands(
  reload: () => Promise<void>,
  getCurrentAuthority?: () => UnloadingCurrentAuthority,
) {
  const submitting = shallowRef(false);
  const error = shallowRef("");
  const reportResult = ref<ContainerUnloadingReport | null>(null);
  const factResult = ref<RecordLifecycleDateFactResult | null>(null);
  const resultContainerId = shallowRef<string | null>(null);
  const attemptStage = shallowRef<UnloadingAttemptStage>(null);
  const attemptContainerId = shallowRef<string | null>(null);
  const attemptTaskId = shallowRef<string | null>(null);
  const attemptSelectionKey = shallowRef<string | null>(null);
  const attempts = new Map<string, Attempt>();
  const inFlight = new Set<string>();
  const stateVersion = ref(0);
  let generation = 0;
  let owner: Owner | null = null;

  function sameDraft(
    a: UnloadingReportDraft,
    b: UnloadingReportDraft,
  ): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function createAttempt(
    containerId: string,
    owner: UnloadingSelectionOwner,
    expectedVersion: number,
    projectionVersion: number,
    instruction: WarehouseDeliveryInstruction,
    draft: UnloadingReportDraft,
  ): Attempt {
    return {
      containerId,
      taskId: owner.taskId ?? "",
      selectionKey:
        owner.selectionKey ?? `${containerId}|${owner.taskId ?? ""}`,
      generation: owner.generation ?? ++generation,
      draft: { ...draft, evidenceInputs: [...draft.evidenceInputs] },
      instruction: { ...instruction },
      expectedVersion,
      projectionVersion,
      reportKey: crypto.randomUUID(),
      dateKey:
        draft.operationState === "completed" ? crypto.randomUUID() : null,
      evidenceRefs: null,
      stage: "report",
    };
  }
  function syncAttemptState(current: Attempt | null): void {
    attemptStage.value = current?.stage ?? null;
    attemptContainerId.value = current?.containerId ?? null;
    attemptTaskId.value = current?.taskId ?? null;
    attemptSelectionKey.value = current?.selectionKey ?? null;
  }
  function begin(current: Attempt): Owner | null {
    const ownerKey = current.selectionKey;
    if (inFlight.has(ownerKey)) return null;
    const next = {
      containerId: current.containerId,
      taskId: current.taskId,
      selectionKey: ownerKey,
      generation: current.generation,
      token: Symbol("unloading-command"),
    };
    owner = next;
    inFlight.add(ownerKey);
    stateVersion.value++;
    submitting.value = true;
    error.value = "";
    return next;
  }
  function owns(request: Owner): boolean {
    if (owner !== request) return false;
    const current = getCurrentAuthority?.();
    return Boolean(
      !current ||
      (current.containerId === request.containerId &&
        (!current.taskId || current.taskId === request.taskId) &&
        (!current.selectionKey ||
          current.selectionKey === request.selectionKey) &&
        (current.generation == null ||
          current.generation === request.generation)),
    );
  }
  function finish(request: Owner): void {
    inFlight.delete(request.selectionKey);
    stateVersion.value++;
    if (owner === request) {
      owner = null;
      submitting.value = false;
    }
  }
  function clearNewResult(): void {
    reportResult.value = null;
    factResult.value = null;
    error.value = "";
    resultContainerId.value = null;
  }

  async function submitReport(
    containerId: string,
    expectedVersion: number | null | undefined,
    projectionVersion: number | null | undefined,
    instruction: WarehouseDeliveryInstruction,
    draft: UnloadingReportDraft,
    selectionOwner: UnloadingSelectionOwner = {},
  ): Promise<ContainerUnloadingReport | null> {
    if (!containerId || expectedVersion == null || projectionVersion == null) {
      error.value = "卸柜事实权限未完整，暂时不能提交";
      return null;
    }
    if (instruction.containerRecordId !== containerId) {
      error.value = "卸柜与目的仓指令不匹配，暂时不能提交";
      return null;
    }
    const selectionKey =
      selectionOwner.selectionKey ??
      `${containerId}|${selectionOwner.taskId ?? ""}|${selectionOwner.generation ?? 0}`;
    const authority = getCurrentAuthority?.();
    if (
      authority &&
      (authority.containerId !== containerId ||
        (authority.selectionKey && authority.selectionKey !== selectionKey))
    ) {
      error.value = "当前货柜或任务已切换，已阻止旧请求写入";
      return null;
    }
    let current = attempts.get(selectionKey) ?? null;
    const priorAttempt = [...attempts.values()].find(
      (attempt) =>
        attempt.containerId === containerId &&
        attempt.taskId === (selectionOwner.taskId ?? "") &&
        attempt.selectionKey !== selectionKey,
    );
    if (!current && priorAttempt) {
      error.value = "存在当前任务未完成的卸柜尝试，请先明确恢复原尝试";
      syncAttemptState(priorAttempt);
      return null;
    }
    if (current?.stage === "reload") {
      error.value = "卸柜报告和日期已保存，请明确恢复原尝试再重读";
      syncAttemptState(current);
      return null;
    }
    if (current && !sameDraft(current.draft, draft)) {
      error.value = "存在未完成的卸柜尝试，请先恢复原尝试；编辑值尚未保存";
      syncAttemptState(current);
      return null;
    }
    if (!current) {
      clearNewResult();
      current = createAttempt(
        containerId,
        { ...selectionOwner, selectionKey },
        expectedVersion,
        projectionVersion,
        instruction,
        draft,
      );
      attempts.set(selectionKey, current);
      stateVersion.value++;
    }
    if (
      current.stage === "date" &&
      (current.instruction.warehouseLocationId !==
        instruction.warehouseLocationId ||
        current.instruction.timezone !== instruction.timezone)
    ) {
      error.value =
        "目的仓或时区已变更，已保存报告保留；请重新核对后再恢复日期事实";
      syncAttemptState(current);
      return null;
    }
    return runAttempt(current);
  }

  async function resumeAttempt(
    containerId: string,
    selectionOwner: UnloadingSelectionOwner = {},
  ): Promise<ContainerUnloadingReport | null> {
    const selectionKey = selectionOwner.selectionKey;
    const current =
      (selectionKey ? attempts.get(selectionKey) : undefined) ??
      [...attempts.values()].find(
        (attempt) =>
          attempt.containerId === containerId &&
          attempt.taskId === (selectionOwner.taskId ?? attempt.taskId),
      );
    if (!current) return null;
    // A route change creates a new selection generation. Recovery is the only
    // path allowed to adopt an unfinished attempt into that new owner; normal
    // submission stays fail-closed until the operator explicitly resumes it.
    if (selectionKey && current.selectionKey !== selectionKey) {
      if (inFlight.has(current.selectionKey)) return null;
      attempts.delete(current.selectionKey);
      current.selectionKey = selectionKey;
      current.taskId = selectionOwner.taskId ?? current.taskId;
      current.generation = selectionOwner.generation ?? current.generation;
      attempts.set(selectionKey, current);
      stateVersion.value++;
    }
    return runAttempt(current);
  }

  async function runAttempt(
    current: Attempt,
  ): Promise<ContainerUnloadingReport | null> {
    const request = begin(current);
    if (!request) return null;
    if (owns(request)) syncAttemptState(current);
    try {
      if (current.stage === "report") {
        current.evidenceRefs ??= await resolveEvidence(
          current.containerId,
          current.draft.evidenceInputs,
        );
        const startedAt = parseZonedDateTime(
          current.draft.startedLocal,
          current.instruction.timezone,
        );
        const completedAt =
          current.draft.operationState === "completed"
            ? parseZonedDateTime(
                current.draft.completedLocal,
                current.instruction.timezone,
              )
            : null;
        current.reportPayload ??= {
          expectedVersion: current.expectedVersion,
          warehouseLocationId: current.instruction.warehouseLocationId,
          operationState: current.draft.operationState,
          startedAt: startedAt.occurredAt.toISOString(),
          completedAt: completedAt?.occurredAt.toISOString() ?? null,
          expectedQuantity: current.draft.expectedQuantity.trim(),
          unloadedQuantity: current.draft.unloadedQuantity.trim(),
          remainingQuantity: current.draft.remainingQuantity.trim(),
          damagedQuantity: current.draft.damagedQuantity.trim(),
          shortageQuantity: current.draft.shortageQuantity.trim(),
          quantityUnit: current.draft.quantityUnit,
          sealCheck: current.draft.sealCheck,
          exceptionResolved: current.draft.exceptionResolved,
          exceptionNotes: current.draft.exceptionNotes.trim() || null,
          evidenceRefs: current.evidenceRefs as [string, ...string[]],
          reasonCode:
            current.draft.operationState === "completed"
              ? "unloading_completed"
              : current.draft.operationState === "partial"
                ? "unloading_progress_reported"
                : "unloading_started",
          idempotencyKey: current.reportKey,
        };
        if (!authorityMatches(current)) {
          if (owns(request)) syncAttemptState(current);
          throw new Error(
            "UNLOADING_AUTHORITY_CHANGED: 已保存证据，当前仓库或时区已变化；报告暂停写入",
          );
        }
        current.report = await appendContainerUnloadingReport(
          current.containerId,
          current.reportPayload,
        );
        current.stage =
          current.report.operationState === "completed" ? "date" : "reload";
        if (owns(request)) syncAttemptState(current);
        if (owns(request)) {
          reportResult.value = current.report;
          resultContainerId.value = current.containerId;
        }
      }
      if (current.stage === "date") {
        if (!authorityMatches(current) || !currentOwnerMatches(current)) {
          if (owns(request)) syncAttemptState(current);
          throw new Error(
            "UNLOADING_AUTHORITY_CHANGED: 报告已保存，当前仓库或时区已变化；日期暂停写入",
          );
        }
        const completedAt = parseZonedDateTime(
          current.draft.completedLocal,
          current.instruction.timezone,
        );
        current.datePayload ??= {
          nodeCode: "container_unloading",
          eventCode: "unloaded",
          timeKind: "actual",
          occurredAt: completedAt.occurredAt.toISOString(),
          rawValue: current.draft.completedLocal,
          sourceUtcOffset: completedAt.sourceUtcOffset,
          authoritySystem: "warehouse-receiving",
          location: {
            locationType: "warehouse",
            locationId: current.instruction.warehouseLocationId,
            ...(current.instruction.unlocode
              ? { unlocode: current.instruction.unlocode }
              : {}),
            timezone: current.instruction.timezone,
          },
          evidenceRefs: current.evidenceRefs!,
          reasonCode: "UNLOADING_COMPLETION_RECORDED",
          expectedVersion: current.projectionVersion,
          idempotencyKey: current.dateKey!,
        };
        const result = await recordLifecycleDateFact(
          current.containerId,
          current.datePayload,
        );
        current.stage = "reload";
        if (owns(request)) syncAttemptState(current);
        if (owns(request)) {
          factResult.value = result;
          resultContainerId.value = current.containerId;
        }
      }
      // A late response must never reload the currently selected B context.
      if (!owns(request) || !currentOwnerMatches(current))
        return current.report ?? null;
      await reload();
      if (!owns(request) || !currentOwnerMatches(current))
        return current.report ?? null;
      attempts.delete(current.selectionKey);
      syncAttemptState(null);
      return current.report ?? null;
    } catch (cause) {
      if (owns(request))
        error.value =
          cause instanceof Error ? cause.message : "卸柜作业没有保存";
      if (owns(request)) syncAttemptState(current);
      return null;
    } finally {
      finish(request);
    }
  }

  return {
    submitting: readonly(submitting),
    error: readonly(error),
    reportResult: readonly(reportResult),
    factResult: readonly(factResult),
    resultContainerId: readonly(resultContainerId),
    attemptStage: readonly(attemptStage),
    attemptContainerId: readonly(attemptContainerId),
    attemptTaskId: readonly(attemptTaskId),
    attemptSelectionKey: readonly(attemptSelectionKey),
    isSubmittingFor: (selectionKey: string) => {
      void stateVersion.value;
      return inFlight.has(selectionKey);
    },
    attemptStageFor: (
      containerId: string,
      selectionOwner: UnloadingSelectionOwner = {},
    ): UnloadingAttemptStage => {
      void stateVersion.value;
      const current =
        (selectionOwner.selectionKey
          ? attempts.get(selectionOwner.selectionKey)
          : undefined) ??
        [...attempts.values()].find(
          (attempt) =>
            attempt.containerId === containerId &&
            attempt.taskId === (selectionOwner.taskId ?? attempt.taskId),
        );
      return current?.stage ?? null;
    },
    submitReport,
    resumeAttempt,
  };

  function authorityMatches(attempt: Attempt): boolean {
    const current = getCurrentAuthority?.();
    if (!current) return true;
    const instruction = current.instruction;
    if (
      current.containerId !== attempt.containerId ||
      (current.taskId && current.taskId !== attempt.taskId) ||
      (current.selectionKey && current.selectionKey !== attempt.selectionKey) ||
      (current.generation != null &&
        current.generation !== attempt.generation) ||
      !instruction ||
      instruction.containerRecordId !== attempt.containerId ||
      instruction.warehouseLocationId !==
        attempt.instruction.warehouseLocationId ||
      instruction.timezone !== attempt.instruction.timezone
    )
      return false;
    // Attempt payloads and optimistic-concurrency versions are immutable. A
    // later read may refresh an equivalent projection, but it must never
    // silently rewrite the request that is being retried.
    return true;
  }

  function currentOwnerMatches(attempt: Attempt): boolean {
    const current = getCurrentAuthority?.();
    return (
      !current ||
      (current.containerId === attempt.containerId &&
        (!current.taskId || current.taskId === attempt.taskId) &&
        (current.generation == null ||
          current.generation === attempt.generation) &&
        (!current.selectionKey ||
          current.selectionKey === attempt.selectionKey))
    );
  }
}

async function resolveEvidence(
  containerId: string,
  values: readonly string[],
): Promise<string[]> {
  const refs: string[] = [];
  for (const value of [...new Set(values.map((item) => item.trim()))].filter(
    Boolean,
  )) {
    refs.push(
      isEvidenceUuid(value)
        ? value
        : await registerAndVerifyFloorEvidence(containerId, value, {
            evidenceType: "receipt",
            authorityLevel: "operational",
            sourceType: "organization",
            authoritySystem: "warehouse-receiving",
            captureSource: "manual_backfill",
          }),
    );
  }
  if (!refs.length)
    throw new Error("EVIDENCE_REQUIRED: 缺少仓方确认或卸货清单");
  return refs;
}
