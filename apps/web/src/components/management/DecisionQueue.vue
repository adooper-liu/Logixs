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
  gap: 16px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-head > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.panel-head h2 {
  margin: 0;
  font-size: 14px;
}

.panel-head > b {
  color: var(--muted);
  font-size: 10px;
}

.decision {
  min-height: 71px;
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
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
  font-size: 15px;
  line-height: 1.05;
}

.decision-metric span,
.decision-copy span {
  overflow: hidden;
  color: var(--muted);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decision-copy b {
  overflow: hidden;
  color: var(--ink);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decision a {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: currentColor;
  font-size: 10px;
  font-weight: 650;
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
