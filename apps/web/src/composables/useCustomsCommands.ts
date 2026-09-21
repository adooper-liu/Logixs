import { readonly, ref, shallowRef } from "vue";
import {
  replaceCustomsClearanceCase,
  type CustomsClearanceCaseView,
  type ReplaceCustomsClearanceCaseInput,
} from "../api/customsClearance";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
} from "../api/evidence";
import {
  recordLifecycleDateFact,
  type RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";

export interface CustomsCaseDraft extends Omit<
  ReplaceCustomsClearanceCaseInput,
  "evidenceRefs" | "idempotencyKey"
> {
  evidenceInputs: string[];
}

export function useCustomsCommands(reload: () => Promise<void>) {
  const saving = shallowRef(false);
  const saveError = shallowRef("");
  const saveMessage = shallowRef("");
  const dateSubmitting = shallowRef(false);
  const dateError = shallowRef("");
  const dateResult = ref<RecordLifecycleDateFactResult | null>(null);
  const keys = new Map<string, string>();

  async function saveCase(containerId: string, draft: CustomsCaseDraft) {
    if (saving.value) return;
    saving.value = true;
    saveError.value = "";
    saveMessage.value = "";
    const scope = `customs:${containerId}`;
    try {
      const evidenceRefs = await resolveEvidence(
        containerId,
        draft.evidenceInputs,
      );
      const result = await replaceCustomsClearanceCase(containerId, {
        ...draft,
        evidenceRefs,
        idempotencyKey: key(scope),
      });
      saveMessage.value = result.duplicate
        ? `清关案件已存在，当前为第 ${result.version} 版`
        : `清关案件第 ${result.version} 版已保存`;
      keys.delete(scope);
      await reload();
    } catch (cause) {
      saveError.value = message(cause, "清关案件没有保存");
    } finally {
      saving.value = false;
    }
  }

  async function submitActual(input: {
    containerId: string;
    localDateTime: string;
    expectedVersion: number;
    clearanceCase: CustomsClearanceCaseView;
  }) {
    if (dateSubmitting.value) return;
    const occurredAt = new Date(input.localDateTime);
    if (!input.localDateTime || Number.isNaN(occurredAt.getTime())) {
      dateError.value = "请选择有效的实际清关时间";
      return;
    }
    dateSubmitting.value = true;
    dateError.value = "";
    dateResult.value = null;
    const scope = `customs-actual:${input.containerId}`;
    try {
      dateResult.value = await recordLifecycleDateFact(input.containerId, {
        nodeCode: "customs_clearance",
        eventCode: "container_customs_completed",
        timeKind: "actual",
        occurredAt: occurredAt.toISOString(),
        rawValue: input.localDateTime,
        sourceUtcOffset: utcOffset(occurredAt),
        authoritySystem: "customs-authority",
        evidenceRefs: [...input.clearanceCase.evidenceRefs],
        reasonCode: "CUSTOMS_ACTUAL_RECORDED",
        expectedVersion: input.expectedVersion,
        idempotencyKey: key(scope),
      });
      keys.delete(scope);
      await reload();
    } catch (cause) {
      dateError.value = message(cause, "实际清关时间没有提交");
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
    saveCase,
    submitActual,
  };
}

async function resolveEvidence(containerId: string, values: readonly string[]) {
  const normalized = [...new Set(values.map((value) => value.trim()))].filter(
    Boolean,
  );
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
