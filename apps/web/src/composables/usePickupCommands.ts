import { readonly, ref, shallowRef } from "vue";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
} from "../api/evidence";
import {
  recordLifecycleDateFact,
  type LifecycleLocation,
  type RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import { parseZonedDateTime } from "../utils/zonedDateTime";

export type PickupFactKind = "available" | "gate_out";

export interface PickupFactDraft {
  kind: PickupFactKind;
  localDateTime: string;
  evidenceInputs: string[];
  location: LifecycleLocation;
  supersedesFactId?: string;
}

export function usePickupCommands(reload: () => Promise<void>) {
  const submitting = shallowRef<PickupFactKind | null>(null);
  const error = shallowRef("");
  const results = ref<
    Partial<Record<PickupFactKind, RecordLifecycleDateFactResult>>
  >({});
  const keys = new Map<string, string>();

  async function submit(
    containerId: string,
    expectedVersion: number,
    draft: PickupFactDraft,
  ) {
    if (submitting.value) return;
    if (!draft.localDateTime) {
      error.value = "请选择有效的实际时间";
      return;
    }
    submitting.value = draft.kind;
    error.value = "";
    const scope = `${draft.kind}:${containerId}`;
    try {
      const { occurredAt, sourceUtcOffset } = parseZonedDateTime(
        draft.localDateTime,
        draft.location.timezone,
      );
      const evidenceRefs = await resolveEvidence(
        containerId,
        draft.evidenceInputs,
      );
      const result = await recordLifecycleDateFact(containerId, {
        nodeCode: "container_pickup",
        eventCode: draft.kind,
        timeKind: "actual",
        occurredAt: occurredAt.toISOString(),
        rawValue: draft.localDateTime,
        sourceUtcOffset,
        authoritySystem: "terminal-operator",
        location: draft.location,
        evidenceRefs,
        reasonCode:
          draft.kind === "available"
            ? "TERMINAL_AVAILABLE_RECORDED"
            : "LADEN_GATE_OUT_RECORDED",
        expectedVersion,
        ...(draft.supersedesFactId
          ? { supersedesFactId: draft.supersedesFactId }
          : {}),
        idempotencyKey: key(scope),
      });
      results.value = { ...results.value, [draft.kind]: result };
      keys.delete(scope);
      await reload();
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "提柜日期事实没有提交";
    } finally {
      submitting.value = null;
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
    submitting: readonly(submitting),
    error: readonly(error),
    results: readonly(results),
    submit,
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
        : await registerAndVerifyFloorEvidence(containerId, value, {
            evidenceType: "receipt",
            authorityLevel: "operational",
            sourceType: "person",
            authoritySystem: "terminal-operator",
            captureSource: "manual_backfill",
          }),
    );
  }
  return refs;
}
