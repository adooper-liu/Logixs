<script setup lang="ts">
import type {
  MarketOpportunityResponsibilityProjectionV1,
  ProductOpportunityLatestSelectionDecisionV1,
} from "@logix/contracts";
import { CheckCircle2, Clock3, UserRound } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  responsibility: MarketOpportunityResponsibilityProjectionV1;
  latestDecision: ProductOpportunityLatestSelectionDecisionV1 | null;
}>();

const responsibilityText = computed(() => {
  if (props.responsibility.status === "retained_by_market") {
    return "结果责任仍在经营与市场团队，等待选品接受";
  }
  if (props.responsibility.status === "transferred_to_selection") {
    return "选品已接受，经营与市场团队已退出当前结果责任";
  }
  return "这版交接已失效，仅供回看";
});

function decisionLabel(
  decision: ProductOpportunityLatestSelectionDecisionV1,
): string {
  if (decision.currentDestination === "returned_to_market") return "市场已接回";
  if (decision.currentDestination === "return_requested") return "选品请求退回";
  if (decision.outcome === "approve") return "选品已立项";
  if (decision.outcome === "defer") return "选品暂缓";
  if (decision.outcome === "reject") return "选品不立项";
  if (decision.outcome === "returned_from_npi") return "NPI 已退回选品";
  return "选品判断待补";
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <section
    class="selection-feedback"
    aria-labelledby="selection-feedback-title"
  >
    <header>
      <div>
        <small>下游回执</small>
        <h3 id="selection-feedback-title">选品反馈</h3>
      </div>
      <b>{{ responsibilityText }}</b>
    </header>

    <ol class="feedback-timeline">
      <li>
        <Clock3 :size="16" aria-hidden="true" />
        <span><b>交给选品</b>{{ dateTime(responsibility.handedOffAt) }}</span>
      </li>
      <li v-if="responsibility.claimedAt">
        <UserRound :size="16" aria-hidden="true" />
        <span>
          <b>{{ responsibility.assignedActorId }} 已领取</b>
          {{ dateTime(responsibility.claimedAt) }}
        </span>
      </li>
      <li v-if="responsibility.acceptedAt">
        <CheckCircle2 :size="16" aria-hidden="true" />
        <span><b>选品已接受</b>{{ dateTime(responsibility.acceptedAt) }}</span>
      </li>
      <li v-if="latestDecision">
        <CheckCircle2 :size="16" aria-hidden="true" />
        <span>
          <b>{{ decisionLabel(latestDecision) }}</b>
          {{ dateTime(latestDecision.decidedAt) }}
          <template v-if="latestDecision.reason">
            · {{ latestDecision.reason }}
          </template>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.selection-feedback {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-top: 1px solid var(--line);
}

.selection-feedback header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.selection-feedback small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.selection-feedback h3 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}

.selection-feedback header > b {
  max-width: 28rem;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
  text-align: right;
}

.feedback-timeline {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.feedback-timeline li {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.feedback-timeline svg {
  flex: none;
  margin-top: 2px;
  color: var(--brand-strong);
}

.feedback-timeline span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.feedback-timeline b {
  display: block;
  color: var(--ink);
}

@media (max-width: 640px) {
  .selection-feedback header {
    display: grid;
  }

  .selection-feedback header > b {
    text-align: left;
  }
}
</style>
