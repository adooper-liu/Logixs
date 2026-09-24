<script setup lang="ts">
import { CheckCircle2, Ship } from "@lucide/vue";
import { computed, type DeepReadonly } from "vue";
import type {
  PostDepartureSourceCandidateAcceptResultV1,
  PostDepartureSourceCandidateV1,
} from "@logix/contracts";

const props = defineProps<{
  candidate: PostDepartureSourceCandidateV1;
  accepting: boolean;
  error: string;
  result: DeepReadonly<PostDepartureSourceCandidateAcceptResultV1> | null;
}>();

const emit = defineEmits<{ accept: [] }>();
const pendingIssueCount = computed(
  () =>
    props.candidate.issues.filter(
      (issue) => issue.resolutionState !== "system_handled",
    ).length,
);
</script>

<template>
  <section class="acceptance-panel" aria-label="正式接管 Shipment">
    <header>
      <Ship :size="18" aria-hidden="true" />
      <span><small>当前动作</small><b>接管当前 Shipment</b></span>
    </header>

    <p
      v-if="candidate.decision === 'rejected'"
      class="acceptance-panel__blocked"
    >
      当前货柜存在身份或引用冲突，只处理这只柜，不影响其他货柜继续接管。
    </p>
    <p v-else>
      已知事实立即建档并进入已出运流程；{{ pendingIssueCount }}
      项缺失资料保留为待补，不阻断在途工作。
    </p>

    <button
      type="button"
      :disabled="
        accepting || candidate.decision === 'rejected' || Boolean(result)
      "
      @click="emit('accept')"
    >
      <Ship :size="16" aria-hidden="true" />
      {{
        accepting
          ? "正在接管..."
          : result
            ? "已接管"
            : pendingIssueCount
              ? "先接管，稍后补齐"
              : "接管当前 Shipment"
      }}
    </button>

    <p v-if="error" class="acceptance-panel__error" role="alert">{{ error }}</p>
    <div v-if="result" class="acceptance-panel__success" role="status">
      <CheckCircle2 :size="17" aria-hidden="true" />
      <span>
        <b>Shipment 已建立</b>
        <small>
          {{ result.acceptedCandidateRefs.length }} 只柜已接管 ·
          {{ result.handoff.issues.length }} 项待补 · Shipment
          {{ result.handoff.shipmentId }}
        </small>
      </span>
    </div>
  </section>
</template>

<style scoped>
.acceptance-panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.acceptance-panel header > svg {
  box-sizing: content-box;
  padding: var(--space-2);
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.acceptance-panel header,
.acceptance-panel__success {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.acceptance-panel header > span,
.acceptance-panel__success > span {
  display: grid;
  gap: var(--space-1);
}

.acceptance-panel small,
.acceptance-panel p {
  color: var(--muted);
  font-size: var(--text-label);
}

.acceptance-panel p {
  margin: 0;
}

.acceptance-panel button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--brand-strong);
  border-radius: var(--radius-control);
  background: var(--brand-strong);
  color: white;
  font-weight: var(--weight-strong);
  cursor: pointer;
}

.acceptance-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.acceptance-panel__blocked,
.acceptance-panel__error {
  color: var(--risk) !important;
}

.acceptance-panel__success {
  padding: var(--space-3);
  border-left: 3px solid var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.acceptance-panel__success small {
  overflow-wrap: anywhere;
}
</style>
