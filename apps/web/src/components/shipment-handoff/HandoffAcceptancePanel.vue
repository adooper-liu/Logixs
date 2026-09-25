<script setup lang="ts">
import { CheckCircle2, Layers3, Ship } from "@lucide/vue";
import { computed, type DeepReadonly } from "vue";
import type {
  PostDepartureSourceCandidateAcceptResultV1,
  PostDepartureSourceCandidateV1,
  PostDepartureSourcePackageAcceptResultV1,
} from "@logix/contracts";
import HandoffBatchAcceptanceReceipt from "./HandoffBatchAcceptanceReceipt.vue";

const props = defineProps<{
  candidate: PostDepartureSourceCandidateV1;
  accepting: boolean;
  error: string;
  result: DeepReadonly<PostDepartureSourceCandidateAcceptResultV1> | null;
  availableGroupCount: number;
  acceptingAll: boolean;
  batchError: string;
  batchResult: DeepReadonly<PostDepartureSourcePackageAcceptResultV1> | null;
}>();

const emit = defineEmits<{
  accept: [];
  acceptAll: [];
  reviewCandidate: [candidateRef: string];
}>();
const pendingIssueCount = computed(
  () =>
    props.candidate.issues.filter(
      (issue) => issue.resolutionState !== "system_handled",
    ).length,
);
const batchCompleted = computed(() => {
  const totals = props.batchResult?.totals;
  return Boolean(totals && totals.failed === 0);
});
const existingShipmentLabel = computed(
  () => props.candidate.existingShipmentMatch?.shipmentNumber || "业务编号待补",
);
</script>

<template>
  <section class="acceptance-panel" aria-label="正式接管 Shipment">
    <header>
      <Ship :size="18" aria-hidden="true" />
      <span>
        <small>当前动作</small>
        <b>{{
          candidate.existingShipmentMatch
            ? `补入已有 Shipment · ${existingShipmentLabel}`
            : "接管当前 Shipment"
        }}</b>
      </span>
    </header>

    <button
      type="button"
      :disabled="acceptingAll || availableGroupCount === 0 || batchCompleted"
      @click="emit('acceptAll')"
    >
      <Layers3 :size="16" aria-hidden="true" />
      {{
        acceptingAll
          ? "正在接管全部..."
          : batchCompleted
            ? "全部可接管项已接管"
            : `接管全部可接管项（${availableGroupCount} 票）`
      }}
    </button>

    <p v-if="batchError" class="acceptance-panel__error" role="alert">
      {{ batchError }}
    </p>
    <HandoffBatchAcceptanceReceipt
      v-if="batchResult"
      :result="batchResult"
      @review-candidate="emit('reviewCandidate', $event)"
      @retry-package="emit('acceptAll')"
    />

    <div class="acceptance-panel__single">
      <small>特殊情况</small>
      <span>仅处理当前选中的一票</span>
    </div>

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
            : candidate.existingShipmentMatch
              ? "补入已有 Shipment"
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
          {{
            candidate.existingShipmentMatch
              ? existingShipmentLabel
              : result.handoff.shipmentId
          }}
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

.acceptance-panel__single {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--line);
  color: var(--ink-soft);
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
  font-weight: 600;
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
