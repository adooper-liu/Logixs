import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
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

export function usePickupCommands(
  reload: () => Promise<void>,
  currentContainerId: Readonly<Ref<string>>,
) {
  const submitting = shallowRef<PickupFactKind | null>(null);
  const error = shallowRef("");
  const results = ref<
    Partial<Record<PickupFactKind, RecordLifecycleDateFactResult>>
  >({});
  const keys = new Map<string, { value: string; owner: symbol }>();
  let generation = 0;
  let activeRequest: symbol | null = null;

  function resetContext() {
    generation++;
    activeRequest = null;
    submitting.value = null;
    results.value = {};
    error.value = "";
  }
  const stop = watch(currentContainerId, resetContext, { flush: "sync" });
  if (getCurrentScope())
    onScopeDispose(() => {
      stop();
      resetContext();
    });

  async function submit(
    containerId: string,
    expectedVersion: number,
    draft: PickupFactDraft,
  ) {
    if (
      containerId !== currentContainerId.value ||
      !containerId ||
      submitting.value
    )
      return;
    if (!draft.localDateTime) {
      error.value = "请选择有效的实际时间";
      return;
    }
    submitting.value = draft.kind;
    error.value = "";
    const scope = `${draft.kind}:${containerId}`;
    const owner = Symbol("pickup-command");
    const requestGeneration = generation;
    activeRequest = owner;
    const ownsRequest = () =>
      activeRequest === owner &&
      generation === requestGeneration &&
      currentContainerId.value === containerId;
    try {
      const idempotencyKey = keys.get(scope)?.value ?? crypto.randomUUID();
      keys.set(scope, { value: idempotencyKey, owner });
      // Bind all awaited work to the submitted input, never to later route/draft values.
      const input = {
        ...draft,
        location: { ...draft.location },
        evidenceInputs: [...draft.evidenceInputs],
      };
      const { occurredAt, sourceUtcOffset } = parseZonedDateTime(
        input.localDateTime,
        input.location.timezone,
      );
      const evidenceRefs = await resolveEvidence(
        containerId,
        input.evidenceInputs,
      );
      const result = await recordLifecycleDateFact(containerId, {
        nodeCode: "container_pickup",
        eventCode: input.kind,
        timeKind: "actual",
        occurredAt: occurredAt.toISOString(),
        rawValue: input.localDateTime,
        sourceUtcOffset,
        authoritySystem: "terminal-operator",
        location: input.location,
        evidenceRefs,
        reasonCode:
          input.kind === "available"
            ? "TERMINAL_AVAILABLE_RECORDED"
            : "LADEN_GATE_OUT_RECORDED",
        expectedVersion,
        ...(input.supersedesFactId
          ? { supersedesFactId: input.supersedesFactId }
          : {}),
        idempotencyKey,
      });
      if (keys.get(scope)?.owner === owner) keys.delete(scope);
      if (ownsRequest()) {
        results.value = { ...results.value, [input.kind]: result };
        await reload();
      }
    } catch (cause) {
      if (ownsRequest())
        error.value =
          cause instanceof Error ? cause.message : "提柜日期事实没有提交";
    } finally {
      if (ownsRequest()) {
        activeRequest = null;
        submitting.value = null;
      }
    }
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
