<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

interface RailNodeView extends LiveNodeView {
  summaryDate: string;
  summaryLabel: string;
}

const props = withDefaults(
  defineProps<{
    nodes: readonly LiveNodeView[];
    timeZone?: string;
  }>(),
  {
    timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);

const emit = defineEmits<{
  select: [nodeInstanceId: string];
}>();

const railNodes = computed<readonly RailNodeView[]>(() =>
  props.nodes.map((node) => {
    if (node.isNotApplicable) {
      return { ...node, summaryLabel: "", summaryDate: "不适用" };
    }

    const summary = node.times.actualAt
      ? { label: "实际", value: node.times.actualAt }
      : node.times.estimatedAt
        ? { label: "预计", value: node.times.estimatedAt }
        : node.times.plannedAt
          ? { label: "计划", value: node.times.plannedAt }
          : node.completedAt
            ? { label: "完成", value: node.completedAt }
            : null;

    return {
      ...node,
      summaryLabel: summary?.label ?? "",
      summaryDate: summary
        ? formatSummaryDate(summary.value, props.timeZone)
        : "—",
    };
  }),
);

function formatSummaryDate(value: string, timeZone: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        timeZone,
      })
        .format(date)
        .replace(/\//g, "-");
}
</script>

<template>
  <nav class="rail" aria-label="货柜生命周期节点">
    <ol class="rail-list">
      <li
        v-for="node in railNodes"
        :key="node.nodeInstanceId"
        class="rail-item"
      >
        <button
          type="button"
          class="rail-node"
          :class="{
            'rail-node--current': node.isCurrent,
            'rail-node--completed': node.completedAt !== null,
            'rail-node--blocked': node.blockedCount > 0,
            'rail-node--not-applicable': node.isNotApplicable,
          }"
          :aria-current="node.isCurrent ? 'step' : undefined"
          data-testid="rail-node"
          @click="emit('select', node.nodeInstanceId)"
        >
          <span class="node-heading">
            <span class="node-sequence">
              {{ String(node.sequence).padStart(2, "0") }}
            </span>
            <span v-if="node.isCurrent" class="current-label">当前</span>
          </span>

          <strong class="node-name">{{ node.name }}</strong>
          <span class="node-state">{{ node.stateLabel }}</span>

          <span class="node-date">
            <span v-if="node.summaryLabel" class="date-kind">
              {{ node.summaryLabel }}
            </span>
            <time
              v-if="node.summaryDate !== '—' && !node.isNotApplicable"
              :datetime="
                node.times.actualAt ??
                node.times.estimatedAt ??
                node.times.plannedAt ??
                node.completedAt ??
                undefined
              "
            >
              {{ node.summaryDate }}
            </time>
            <span v-else>{{ node.summaryDate }}</span>
          </span>

          <span
            class="node-blockers"
            :class="{ 'node-blockers--empty': node.blockedCount === 0 }"
            :aria-hidden="node.blockedCount === 0 ? 'true' : undefined"
          >
            <TriangleAlert :size="13" aria-hidden="true" />
            {{ node.blockedCount }} 个未关闭阻断
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.rail {
  min-width: 0;
  margin: 0 0 12px;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  scrollbar-gutter: stable;
}

.rail-list {
  display: flex;
  min-width: max-content;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rail-item {
  position: relative;
  width: 140px;
  flex: 0 0 140px;
  padding-right: 12px;
}

.rail-item:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  top: 24px;
  right: 0;
  width: 12px;
  height: 2px;
  background: var(--line-strong);
  content: "";
}

.rail-node {
  position: relative;
  z-index: 1;
  width: 128px;
  min-height: 132px;
  display: grid;
  grid-template-rows: 20px 22px 18px 24px 18px;
  gap: 3px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: inherit;
  font: inherit;
  letter-spacing: 0;
  text-align: left;
  cursor: pointer;
}

.rail-node:hover {
  border-color: var(--brand);
}

.rail-node:focus-visible {
  outline: 3px solid var(--brand);
  outline-offset: 2px;
}

.rail-node--current {
  border-width: 2px;
  border-color: var(--brand);
}

.rail-node--completed {
  border-top: 3px solid var(--ok);
}

.rail-node--blocked {
  border-bottom: 3px solid var(--risk);
}

.rail-node--not-applicable {
  border-style: dashed;
}

.node-heading,
.node-date,
.node-blockers {
  display: flex;
  align-items: center;
}

.node-heading {
  justify-content: space-between;
  gap: 6px;
}

.node-sequence,
.current-label,
.date-kind {
  font-size: 10px;
  line-height: 1;
}

.node-sequence {
  font-variant-numeric: tabular-nums;
}

.current-label {
  color: var(--brand);
  font-weight: 700;
}

.node-name,
.node-state,
.node-date,
.node-blockers {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-name {
  font-size: 14px;
  line-height: 22px;
}

.node-state,
.node-date,
.node-blockers {
  font-size: 11px;
}

.node-date {
  gap: 5px;
  font-variant-numeric: tabular-nums;
}

.date-kind {
  padding-right: 5px;
  border-right: 1px solid var(--line);
}

.node-blockers {
  gap: 4px;
  color: var(--risk);
}

.node-blockers--empty {
  visibility: hidden;
}

@media (max-width: 680px) {
  .rail {
    padding: 10px;
  }
}
</style>
