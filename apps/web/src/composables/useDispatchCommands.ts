import { readonly, ref, shallowRef } from "vue";
import {
  replaceContainerDispatchSnapshot,
  type ContainerDispatchSnapshot,
  type ReplaceContainerDispatchSnapshotInput,
} from "../api/containerDispatch";
import {
  recordLifecycleDateFact,
  type RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
} from "../api/evidence";

export interface DispatchSnapshotDraft extends Omit<
  ReplaceContainerDispatchSnapshotInput,
  "evidenceRefs" | "idempotencyKey"
> {
  evidenceInputs: string[];
}

export function useDispatchCommands(reload: () => Promise<void>) {
  const saving = shallowRef(false);
  const saveError = shallowRef("");
  const saveMessage = shallowRef("");
  const dateSubmitting = shallowRef(false);
  const dateError = shallowRef("");
  const dateResult = ref<RecordLifecycleDateFactResult | null>(null);
  const keys = new Map<string, string>();

  async function saveSnapshot(
    containerId: string,
    draft: DispatchSnapshotDraft,
  ) {
    if (saving.value) return;
    saving.value = true;
    saveError.value = "";
    saveMessage.value = "";
    try {
      const evidenceRefs = await resolveEvidence(
        containerId,
        draft.evidenceInputs,
      );
      const result = await replaceContainerDispatchSnapshot(containerId, {
        ...draft,
        evidenceRefs,
        idempotencyKey: key(`dispatch:${containerId}`),
      });
      saveMessage.value = result.duplicate
        ? `出运交接已存在，当前为第 ${result.version} 版`
        : `出运交接第 ${result.version} 版已保存`;
      keys.delete(`dispatch:${containerId}`);
      await reload();
    } catch (cause) {
      saveError.value = message(cause, "出运交接没有保存");
    } finally {
      saving.value = false;
    }
  }

  async function submitActual(input: {
    containerId: string;
    eventCode: "gate_in" | "loaded";
    localDateTime: string;
    expectedVersion: number;
    snapshot: ContainerDispatchSnapshot;
  }) {
    if (dateSubmitting.value) return;
    const occurredAt = new Date(input.localDateTime);
    if (!input.localDateTime || Number.isNaN(occurredAt.getTime())) {
      dateError.value = "请选择有效的实际发生时间";
      return;
    }
    dateSubmitting.value = true;
    dateError.value = "";
    dateResult.value = null;
    const scope = `${input.eventCode}:${input.containerId}`;
    try {
      dateResult.value = await recordLifecycleDateFact(input.containerId, {
        nodeCode: "shipment_dispatch",
        eventCode: input.eventCode,
        timeKind: "actual",
        occurredAt: occurredAt.toISOString(),
        rawValue: input.localDateTime,
        sourceUtcOffset: utcOffset(occurredAt),
        authoritySystem: "ops-team",
        evidenceRefs: [...input.snapshot.evidenceRefs],
        reasonCode: `${input.eventCode}_actual_confirmed`,
        expectedVersion: input.expectedVersion,
        idempotencyKey: key(scope),
      });
      keys.delete(scope);
      await reload();
    } catch (cause) {
      dateError.value = message(cause, "实际日期没有提交");
    } finally {
      dateSubmitting.value = false;
    }
  }

  function key(scope: string): string {
    const current = keys.get(scope);
    if (current) return current;
    const created = crypto.randomUUID();
    keys.set(scope, created);
    return created;
  }

  return {
    saving: readonly(saving),
    saveError: readonly(saveError),
    saveMessage: readonly(saveMessage),
    dateSubmitting: readonly(dateSubmitting),
    dateError: readonly(dateError),
    dateResult: readonly(dateResult),
    saveSnapshot,
    submitActual,
  };
}

async function resolveEvidence(containerId: string, values: readonly string[]) {
  const normalized = [...new Set(values.map((value) => value.trim()))].filter(
    Boolean,
  );
  if (!normalized.length) {
    throw new Error("EVIDENCE_REQUIRED: 请提供订舱、VGM 接收或承运交接证据");
  }
  const refs: string[] = [];
  for (const value of normalized) {
    refs.push(
      isEvidenceUuid(value)
        ? value
        : await registerAndVerifyFloorEvidence(containerId, value),
    );
  }
  return refs;
}

function utcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const value = Math.abs(minutes);
  return `${sign}${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}
