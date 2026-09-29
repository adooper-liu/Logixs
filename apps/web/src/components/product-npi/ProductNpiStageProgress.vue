<script setup lang="ts">
import { computed } from "vue";
import type { NpiStageOutcomeV1, NpiStageV1 } from "@logix/contracts";
import {
  currentRailStage,
  NPI_STAGE_RAIL,
  npiCompleteness,
  npiCompletenessLabel,
  railStageState,
  type NpiCompleteness,
} from "../../data/productNpiVisualFlow";

const props = defineProps<{
  claimed: boolean;
  npiStage: NpiStageV1 | null;
  stageOutcomes: readonly NpiStageOutcomeV1[];
  objective: string;
  title: string;
}>();

const current = computed(() => currentRailStage(props.npiStage, props.claimed));

const tiles = computed(() => {
  const stages: Array<{
    code: string;
    label: string;
    completeness: NpiCompleteness;
  }> = [
    {
      code: "objective",
      label: "目标结果",
      completeness: props.objective.trim() ? "complete" : "missing",
    },
  ];
  for (const stage of ["evt", "dvt", "pvt"] as const) {
    const outcome = props.stageOutcomes.find((item) => item.stage === stage);
    stages.push({
      code: stage,
      label: stage.toUpperCase(),
      completeness: npiCompleteness(outcome),
    });
  }
  return stages;
});

const warnTile = computed(
  () => tiles.value.find((tile) => tile.completeness !== "complete") ?? null,
);
</script>

<template>
  <section class="npi-visual-head" aria-label="阶段与完备度">
    <header class="conclusion">
      <small>结论</small>
      <h2>{{ title }}</h2>
      <p>
        当前阶段 ·
        <b>{{
          NPI_STAGE_RAIL.find((item) => item.code === current)?.label ?? current
        }}</b>
      </p>
    </header>

    <ol class="stage-rail" aria-label="NPI 阶段轨">
      <li
        v-for="(item, index) in NPI_STAGE_RAIL"
        :key="item.code"
        class="stage-rail__item"
        :class="`is-${railStageState(item.code, current)}`"
      >
        <span class="dot" aria-hidden="true" />
        <b>{{ item.label }}</b>
        <span
          v-if="index < NPI_STAGE_RAIL.length - 1"
          class="connector"
          aria-hidden="true"
        />
      </li>
    </ol>

    <ul class="completeness" aria-label="齐半缺四宫格">
      <li
        v-for="tile in tiles"
        :key="tile.code"
        class="tile"
        :class="{
          'tile--ok': tile.completeness === 'complete',
          'tile--warn':
            warnTile?.code === tile.code && tile.completeness !== 'complete',
          'tile--muted':
            tile.completeness !== 'complete' && warnTile?.code !== tile.code,
        }"
      >
        <small>{{ tile.label }}</small>
        <b>{{ npiCompletenessLabel(tile.completeness) }}</b>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.npi-visual-head {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.conclusion small {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.conclusion h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.conclusion p {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
}

.stage-rail {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.stage-rail__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-label);
}

.stage-rail__item .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--line-strong);
}

.stage-rail__item.is-done .dot,
.stage-rail__item.is-done .connector {
  background: var(--brand-strong);
}

.stage-rail__item.is-current {
  color: var(--ink);
  font-weight: 700;
}

.stage-rail__item.is-current .dot {
  background: var(--brand-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-strong) 25%, transparent);
}

.stage-rail__item .connector {
  width: 18px;
  height: 2px;
  background: var(--line);
}

.completeness {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tile {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
}

.tile small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.tile b {
  font-size: var(--text-meta);
}

.tile--ok b {
  color: var(--ok);
}

.tile--warn {
  border-color: var(--warn);
}

.tile--warn b {
  color: var(--warn);
}

.tile--muted b {
  color: var(--muted);
}

@media (max-width: 680px) {
  .completeness {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
