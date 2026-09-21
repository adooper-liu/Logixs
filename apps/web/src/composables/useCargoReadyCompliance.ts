import { readonly, ref, shallowRef, watch, type Ref } from "vue";
import {
  assessCargoReadyCompliance,
  decideCargoReadyCompliance,
  getCargoReadyCompliance,
  type AssessCargoReadyComplianceInput,
  type CargoReadyComplianceAssessment,
  type CargoReadyDecisionResponse,
  type DecideCargoReadyComplianceInput,
} from "../api/cargoReadyCompliance";

export function useCargoReadyCompliance(containerId: Ref<string>) {
  const assessment = ref<CargoReadyComplianceAssessment | null>(null);
  const replay = ref<CargoReadyDecisionResponse["replay"] | null>(null);
  const loading = shallowRef(false);
  const submitting = shallowRef(false);
  const error = shallowRef("");

  watch(
    containerId,
    (id, _previous, onCleanup) => {
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      void load(id, controller.signal);
    },
    { immediate: true },
  );

  async function load(id = containerId.value, signal?: AbortSignal) {
    if (!id) {
      assessment.value = null;
      replay.value = null;
      error.value = "";
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const next = await getCargoReadyCompliance(id, signal);
      if (!signal?.aborted) assessment.value = next;
    } catch (cause) {
      if (!signal?.aborted) {
        assessment.value = null;
        error.value = message(cause, "加载备货合规评审失败");
      }
    } finally {
      if (!signal?.aborted) loading.value = false;
    }
  }

  async function assess(
    input: Omit<
      AssessCargoReadyComplianceInput,
      "expectedAssessmentVersion" | "idempotencyKey"
    >,
  ) {
    if (!containerId.value) return;
    submitting.value = true;
    error.value = "";
    replay.value = null;
    try {
      await assessCargoReadyCompliance(containerId.value, {
        ...input,
        expectedAssessmentVersion: assessment.value?.version ?? 0,
        idempotencyKey: crypto.randomUUID(),
      });
      await load();
    } catch (cause) {
      error.value = message(cause, "创建备货合规评审失败");
    } finally {
      submitting.value = false;
    }
  }

  async function decide(
    input: Omit<
      DecideCargoReadyComplianceInput,
      "assessmentId" | "expectedDecisionVersion" | "idempotencyKey"
    >,
  ) {
    if (!containerId.value || !assessment.value) return;
    submitting.value = true;
    error.value = "";
    try {
      const result = await decideCargoReadyCompliance(containerId.value, {
        ...input,
        assessmentId: assessment.value.assessmentId,
        expectedDecisionVersion: assessment.value.currentDecision?.version ?? 0,
        idempotencyKey: crypto.randomUUID(),
      });
      replay.value = result.replay;
      await load();
    } catch (cause) {
      error.value = message(cause, "提交合规决定失败");
    } finally {
      submitting.value = false;
    }
  }

  return {
    assessment: readonly(assessment),
    replay: readonly(replay),
    loading: readonly(loading),
    submitting: readonly(submitting),
    error: readonly(error),
    reload: load,
    assess,
    decide,
  };
}

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
