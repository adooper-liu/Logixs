import { ref, readonly, shallowRef } from "vue";
import {
  replaceContainerStuffingSnapshot,
  type ContainerStuffingSnapshot,
  type ReplaceContainerStuffingSnapshotInput,
} from "../api/containerStuffing";
import {
  recordLifecycleDateFact,
  type RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
} from "../api/evidence";

export interface StuffingSnapshotDraft extends Omit<
  ReplaceContainerStuffingSnapshotInput,
  "evidenceRefs" | "idempotencyKey"
> {
  evidenceInputs: string[];
}

export function useStuffingCommands(reload: () => Promise<void>) {
  const snapshotSaving = shallowRef(false);
  const snapshotError = shallowRef("");
  const snapshotMessage = shallowRef("");
  const dateSubmitting = shallowRef(false);
  const dateError = shallowRef("");
  const dateResult = ref<RecordLifecycleDateFactResult | null>(null);
  const idempotencyKeys = new Map<string, string>();

  async function saveSnapshot(
    containerId: string,
    draft: StuffingSnapshotDraft,
  ): Promise<void> {
    if (snapshotSaving.value) return;
    snapshotSaving.value = true;
    snapshotError.value = "";
    snapshotMessage.value = "";
    try {
      const evidenceRefs = await resolveEvidenceRefs(
        containerId,
        draft.evidenceInputs,
      );
      const result = await replaceContainerStuffingSnapshot(containerId, {
        ...draft,
        evidenceRefs,
        idempotencyKey: commandKey(`snapshot:${containerId}`, false),
      });
      snapshotMessage.value = result.duplicate
        ? `装箱记录已存在，当前为第 ${result.version} 版`
        : `装箱记录第 ${result.version} 版已保存`;
      idempotencyKeys.delete(`snapshot:${containerId}`);
      await reload();
    } catch (cause) {
      snapshotError.value = errorMessage(cause, "装箱记录没有保存");
    } finally {
      snapshotSaving.value = false;
    }
  }

  async function submitActualTime(input: {
    containerId: string;
    localDateTime: string;
    expectedVersion: number;
    snapshot: ContainerStuffingSnapshot;
  }): Promise<void> {
    if (dateSubmitting.value) return;
    dateSubmitting.value = true;
    dateError.value = "";
    dateResult.value = null;
    const date = new Date(input.localDateTime);
    if (!input.localDateTime || Number.isNaN(date.getTime())) {
      dateError.value = "请选择有效的实际装箱时间";
      dateSubmitting.value = false;
      return;
    }
    try {
      dateResult.value = await recordLifecycleDateFact(input.containerId, {
        nodeCode: "container_stuffing",
        eventCode: "stuffed",
        timeKind: "actual",
        occurredAt: date.toISOString(),
        rawValue: input.localDateTime,
        sourceUtcOffset: utcOffset(date),
        authoritySystem: "ops-team",
        evidenceRefs: [...input.snapshot.evidenceRefs],
        reasonCode: "stuffing_actual_confirmed",
        expectedVersion: input.expectedVersion,
        idempotencyKey: commandKey(`actual:${input.containerId}`, false),
      });
      idempotencyKeys.delete(`actual:${input.containerId}`);
      await reload();
    } catch (cause) {
      dateError.value = errorMessage(cause, "实际装箱时间没有提交");
    } finally {
      dateSubmitting.value = false;
    }
  }

  function commandKey(scope: string, reuse: boolean): string {
    const current = idempotencyKeys.get(scope);
    if (reuse && current) return current;
    if (current) return current;
    const next = crypto.randomUUID();
    idempotencyKeys.set(scope, next);
    return next;
  }

  return {
    snapshotSaving: readonly(snapshotSaving),
    snapshotError: readonly(snapshotError),
    snapshotMessage: readonly(snapshotMessage),
    dateSubmitting: readonly(dateSubmitting),
    dateError: readonly(dateError),
    dateResult: readonly(dateResult),
    saveSnapshot,
    submitActualTime,
  };
}

async function resolveEvidenceRefs(
  containerId: string,
  values: readonly string[],
): Promise<string[]> {
  const normalized = [...new Set(values.map((item) => item.trim()))].filter(
    Boolean,
  );
  if (normalized.length === 0) {
    throw new Error("EVIDENCE_REQUIRED: 请提供装箱单、称重或箱封证据");
  }
  const resolved: string[] = [];
  for (const value of normalized) {
    resolved.push(
      isEvidenceUuid(value)
        ? value
        : await registerAndVerifyFloorEvidence(containerId, value),
    );
  }
  return resolved;
}

function utcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
