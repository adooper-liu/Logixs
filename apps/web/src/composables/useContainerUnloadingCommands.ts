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

export function useContainerUnloadingCommands(reload: () => Promise<void>) {
  const submitting = shallowRef(false);
  const error = shallowRef("");
  const reportResult = ref<ContainerUnloadingReport | null>(null);
  const factResult = ref<RecordLifecycleDateFactResult | null>(null);
  const keys = new Map<string, string>();
  const evidenceRefsByScope = new Map<string, string[]>();

  async function submitReport(
    containerId: string,
    expectedVersion: number,
    projectionVersion: number,
    instruction: WarehouseDeliveryInstruction,
    draft: UnloadingReportDraft,
  ): Promise<void> {
    if (submitting.value) return;
    submitting.value = true;
    error.value = "";
    const reportScope = `unloading-report:${containerId}:${expectedVersion + 1}`;
    try {
      let evidenceRefs = evidenceRefsByScope.get(reportScope);
      if (!evidenceRefs) {
        evidenceRefs = await resolveEvidence(containerId, draft.evidenceInputs);
        evidenceRefsByScope.set(reportScope, evidenceRefs);
      }
      const startedAt = parseZonedDateTime(
        draft.startedLocal,
        instruction.timezone,
      );
      const completedAt =
        draft.operationState === "completed"
          ? parseZonedDateTime(draft.completedLocal, instruction.timezone)
          : null;
      const report = await appendContainerUnloadingReport(containerId, {
        expectedVersion,
        warehouseLocationId: instruction.warehouseLocationId,
        operationState: draft.operationState,
        startedAt: startedAt.occurredAt.toISOString(),
        completedAt: completedAt?.occurredAt.toISOString() ?? null,
        expectedQuantity: draft.expectedQuantity.trim(),
        unloadedQuantity: draft.unloadedQuantity.trim(),
        remainingQuantity: draft.remainingQuantity.trim(),
        damagedQuantity: draft.damagedQuantity.trim(),
        shortageQuantity: draft.shortageQuantity.trim(),
        quantityUnit: draft.quantityUnit,
        sealCheck: draft.sealCheck,
        exceptionResolved: draft.exceptionResolved,
        exceptionNotes: draft.exceptionNotes.trim() || null,
        evidenceRefs: evidenceRefs as [string, ...string[]],
        reasonCode:
          draft.operationState === "completed"
            ? "unloading_completed"
            : draft.operationState === "partial"
              ? "unloading_progress_reported"
              : "unloading_started",
        idempotencyKey: key(reportScope),
      });
      reportResult.value = report;

      let factScope: string | null = null;
      if (report.operationState === "completed" && completedAt) {
        factScope = `unloaded:${containerId}:${report.reportId}`;
        factResult.value = await recordLifecycleDateFact(containerId, {
          nodeCode: "container_unloading",
          eventCode: "unloaded",
          timeKind: "actual",
          occurredAt: completedAt.occurredAt.toISOString(),
          rawValue: draft.completedLocal,
          sourceUtcOffset: completedAt.sourceUtcOffset,
          authoritySystem: "warehouse-receiving",
          location: {
            locationType: "warehouse",
            locationId: instruction.warehouseLocationId,
            ...(instruction.unlocode ? { unlocode: instruction.unlocode } : {}),
            timezone: instruction.timezone,
          },
          evidenceRefs,
          reasonCode: "UNLOADING_COMPLETION_RECORDED",
          expectedVersion: projectionVersion,
          idempotencyKey: key(factScope),
        });
      }
      await reload();
      keys.delete(reportScope);
      evidenceRefsByScope.delete(reportScope);
      if (factScope) keys.delete(factScope);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "卸柜作业没有保存";
    } finally {
      submitting.value = false;
    }
  }

  function key(scope: string): string {
    const existing = keys.get(scope);
    if (existing) return existing;
    const created = crypto.randomUUID();
    keys.set(scope, created);
    return created;
  }

  return {
    submitting: readonly(submitting),
    error: readonly(error),
    reportResult: readonly(reportResult),
    factResult: readonly(factResult),
    submitReport,
  };
}

async function resolveEvidence(
  containerId: string,
  values: readonly string[],
): Promise<string[]> {
  const normalized = [...new Set(values.map((value) => value.trim()))].filter(
    Boolean,
  );
  const refs: string[] = [];
  for (const value of normalized) {
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
  if (refs.length === 0)
    throw new Error("EVIDENCE_REQUIRED: 缺少仓方确认或卸货清单");
  return refs;
}
