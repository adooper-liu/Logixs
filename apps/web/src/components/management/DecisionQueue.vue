<script setup lang="ts">
import { ArrowRight } from "@lucide/vue";
import type { Tone } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

interface DecisionItem {
  id: string;
  title: string;
  context: string;
  metric: string;
  metricLabel: string;
  action: string;
  tone: Tone;
  to: string;
}

defineProps<{ items: readonly DecisionItem[] }>();
</script>

<template>
  <section class="decision-queue" aria-labelledby="decision-title">
    <header class="panel-head">
      <div>
        <h2 id="decision-title">待决策</h2>
        <InfoTooltip
          label="查看决策队列口径"
          text="仅在风险、冲突或权威来源不一致时进入人工复核。"
        />
      </div>
      <b class="mono">{{ items.length }}</b>
    </header>

    <article
      v-for="item in items"
      :key="item.id"
      class="decision"
      :class="item.tone"
    >
      <div class="decision-metric">
        <b class="mono">{{ item.metric }}</b>
        <span>{{ item.metricLabel }}</span>
      </div>
      <div class="decision-copy">
        <b>{{ item.title }}</b>
        <span>{{ item.context }}</span>
      </div>
      <router-link :to="item.to" :aria-label="`${item.action}：${item.title}`">
        <span>{{ item.action }}</span>
        <ArrowRight :size="15" aria-hidden="true" />
      </router-link>
    </article>
  </section>
</template>

<style scoped>
.decision-queue {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  overflow: hidden;
}

.panel-head {
  min-height: 46px;
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-head > div {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.panel-head h2 {
  margin: 0;
  font-size: var(--text-body);
}

.panel-head > b {
  color: var(--muted);
  font-size: var(--text-micro);
}

.decision {
  min-height: 71px;
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  box-shadow: inset 3px 0 currentColor;
}

.decision:last-child {
  border-bottom: 0;
}

.decision-metric,
.decision-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.decision-metric b {
  overflow-wrap: anywhere;
  color: currentColor;
  font-size: var(--text-title);
  line-height: var(--leading-tight);
}

.decision-metric span,
.decision-copy span {
  overflow: hidden;
  color: var(--muted);
  font-size: var(--text-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decision-copy b {
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decision a {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: currentColor;
  font-size: var(--text-micro);
  font-weight: 600;
  text-decoration: none;
}

.decision.risk {
  color: var(--risk);
}

.decision.warn {
  color: var(--warn);
}

@media (max-width: 720px) {
  .decision {
    grid-template-columns: 58px minmax(0, 1fr);
  }

  .decision a {
    grid-column: 2;
    min-height: var(--touch-target);
  }
}
</style>
