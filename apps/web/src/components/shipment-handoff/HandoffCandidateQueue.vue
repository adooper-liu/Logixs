<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleX,
  Container,
} from "@lucide/vue";
import { computed } from "vue";
import type { PostDepartureSourceCandidateV1 } from "../../api/postDepartureSourcePackages";
import {
  handoffDecisionCopy,
  isHandoffIssueBlocking,
} from "../../data/postDepartureHandoffCopy";

const props = defineProps<{
  candidates: readonly PostDepartureSourceCandidateV1[];
  selectedCandidateRef: string;
}>();

const decisionCounts = computed(() => ({
  ready: props.candidates.filter((candidate) => candidate.decision === "ready")
    .length,
  pending: props.candidates.filter(
    (candidate) => candidate.decision === "review_required",
  ).length,
  rejected: props.candidates.filter(
    (candidate) => candidate.decision === "rejected",
  ).length,
}));

const emit = defineEmits<{
  select: [candidateRef: string];
}>();

function decisionIcon(decision: PostDepartureSourceCandidateV1["decision"]) {
  return {
    ready: CheckCircle2,
    review_required: AlertTriangle,
    rejected: CircleX,
  }[decision];
}

function actionCount(candidate: PostDepartureSourceCandidateV1): number {
  return candidate.issues.filter(isHandoffIssueBlocking).length;
}

function pendingCount(candidate: PostDepartureSourceCandidateV1): number {
  return candidate.issues.filter(
    (issue) =>
      !isHandoffIssueBlocking(issue) &&
      issue.resolutionState !== "system_handled",
  ).length;
}
</script>

<template>
  <section class="candidate-queue" aria-label="预检问题队列">
    <header class="pane-heading">
      <span class="pane-heading__title"
        ><small>原因队列</small><b>候选 Shipment</b></span
      >
      <b class="candidate-total">{{ candidates.length }}</b>
    </header>
    <div class="queue-summary" aria-label="候选处理概况">
      <span>可接管 {{ decisionCounts.ready }}</span>
      <span>待补 {{ decisionCounts.pending }}</span>
      <span>阻断 {{ decisionCounts.rejected }}</span>
    </div>
    <div class="candidate-list">
      <button
        v-for="candidate in candidates"
        :key="candidate.candidateRef"
        type="button"
        class="candidate-row"
        :class="{
          'candidate-row--selected':
            candidate.candidateRef === selectedCandidateRef,
        }"
        @click="emit('select', candidate.candidateRef)"
      >
        <span class="candidate-row__topline">
          <span class="candidate-identity">
            <Container :size="16" aria-hidden="true" />
            <b>{{ candidate.containerNumber }}</b>
          </span>
          <span class="decision" :class="`decision--${candidate.decision}`">
            <component
              :is="decisionIcon(candidate.decision)"
              :size="14"
              aria-hidden="true"
            />
            {{ handoffDecisionCopy(candidate.decision) }}
          </span>
        </span>
        <span class="candidate-route">
          <span>{{ candidate.originPortRaw || "起运港待确认" }}</span>
          <ArrowRight :size="13" aria-hidden="true" />
          <span>{{ candidate.destinationPortRaw || "目的港待确认" }}</span>
        </span>
        <span class="candidate-row__meta">
          <small>{{
            candidate.replenishmentOrderNumbers.join("、") || "无备货单号"
          }}</small>
          <small class="issue-count">
            {{ actionCount(candidate) }} 项阻断 ·
            {{ pendingCount(candidate) }} 项待补
          </small>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.candidate-queue {
  min-width: 0;
}

.pane-heading {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pane-heading__title {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.candidate-total {
  color: var(--muted);
  font-size: var(--text-meta);
}

.pane-heading small,
.issue-count {
  color: var(--muted);
  font-size: var(--text-micro);
}

.queue-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.queue-summary span {
  text-align: center;
  white-space: nowrap;
}

.candidate-list {
  display: grid;
  gap: var(--space-2);
  max-height: calc(100vh - 246px);
  padding: var(--space-2);
  background: var(--surface-2);
  overflow: auto;
}

.candidate-row {
  width: 100%;
  min-height: 102px;
  display: grid;
  gap: var(--space-2);
  align-content: center;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.candidate-row__topline,
.candidate-identity,
.candidate-route,
.candidate-row__meta,
.decision {
  min-width: 0;
  display: flex;
  align-items: center;
}

.candidate-row__topline,
.candidate-row__meta {
  justify-content: space-between;
  gap: var(--space-2);
}

.candidate-row:hover,
.candidate-row--selected {
  background: var(--brand-soft);
  border-color: var(--brand-line);
}

.candidate-row--selected {
  box-shadow: inset 3px 0 0 var(--brand);
}

.decision {
  gap: var(--space-1);
  padding: 0 var(--space-1);
  border-radius: var(--radius-control);
  background: var(--surface-2);
  font-size: var(--text-label);
  font-weight: var(--weight-strong);
}

.decision--ready {
  color: var(--brand-strong);
  background: var(--brand-soft);
}

.decision--review_required {
  color: var(--warn);
  background: var(--warn-bg);
}

.decision--rejected {
  color: var(--risk);
  background: var(--risk-bg);
}

.candidate-identity {
  gap: var(--space-2);
}

.candidate-route {
  gap: var(--space-1);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.candidate-route span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-row__meta small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-row__meta > small:first-child {
  color: var(--muted);
  font-size: var(--text-micro);
}
</style>
