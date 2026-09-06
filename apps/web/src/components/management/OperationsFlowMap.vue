<script setup lang="ts">
import { computed } from "vue";
import type { ContainerProjection, Tone } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{ rows: readonly ContainerProjection[] }>();
const visibleTraceLimit = 6;
const tonePriority: Record<Tone, number> = {
  risk: 0,
  warn: 1,
  info: 2,
  ok: 3,
  muted: 4,
};

const rail = computed(() => props.rows[0]?.rail ?? []);
const nodeCountStyle = computed(() => ({
  "--node-count": String(Math.max(rail.value.length, 1)),
}));

const activeNodeKey = (row: ContainerProjection) =>
  row.rail.find((node) => node.isCurrentStatus)?.key ??
  row.rail.find((node) => node.name === row.currentNode)?.key;

const nodes = computed(() =>
  rail.value.map((node, index) => {
    const activeRows = props.rows.filter(
      (row) => activeNodeKey(row) === node.key,
    );
    const tone: Tone = activeRows.some((row) => row.tone === "risk")
      ? "risk"
      : activeRows.some((row) => row.tone === "warn")
        ? "warn"
        : activeRows.length
          ? "info"
          : "muted";
    return { ...node, index, count: activeRows.length, tone };
  }),
);

const traces = computed(() =>
  props.rows
    .slice()
    .sort((left, right) => tonePriority[left.tone] - tonePriority[right.tone])
    .slice(0, visibleTraceLimit)
    .map((row) => {
      const nodeKey = activeNodeKey(row);
      const nodeIndex = Math.max(
        0,
        rail.value.findIndex((node) => node.key === nodeKey),
      );
      const nodeCount = Math.max(rail.value.length, 1);
      return {
        row,
        nodeIndex,
        progressEnd: `${((nodeIndex + 0.5) / nodeCount) * 100}%`,
      };
    }),
);
const hiddenTraceCount = computed(() =>
  Math.max(0, props.rows.length - traces.value.length),
);
</script>

<template>
  <section class="flow-map" aria-labelledby="flow-map-title">
    <header class="panel-head">
      <div>
        <h2 id="flow-map-title">货柜流向扫描</h2>
        <InfoTooltip
          label="查看货柜流向口径"
          text="按货柜流转记录展示实际节点；一条轨道对应一个重点货柜。"
        />
      </div>
      <strong class="mono">
        {{ rows.length }} 柜在线
        <span v-if="hiddenTraceCount">· 展示 {{ traces.length }} 个重点</span>
      </strong>
    </header>

    <div class="node-axis" :style="nodeCountStyle" aria-hidden="true">
      <span class="axis-label">货柜</span>
      <div class="node-scale">
        <span
          v-for="node in nodes"
          :key="node.key"
          class="node-cell"
          :class="[node.tone, { occupied: node.count }]"
          :title="node.name"
        >
          <small class="node-sequence mono">{{
            String(node.index + 1).padStart(2, "0")
          }}</small>
          <b>{{ node.name }}</b>
          <i v-if="node.count" class="mono">{{ node.count }}</i>
        </span>
      </div>
      <span class="axis-label">当前事实</span>
    </div>

    <div class="trace-list" :style="nodeCountStyle">
      <article
        v-for="trace in traces"
        :key="trace.row.containerRecordId"
        class="trace-row"
      >
        <router-link
          :to="`/container/${trace.row.containerRecordId}`"
          class="trace-identity"
        >
          <b class="mono">{{ trace.row.containerNumber }}</b>
          <span>{{ trace.row.location }}</span>
        </router-link>
        <div
          class="trace-track"
          :class="trace.row.tone"
          :style="{ '--progress-end': trace.progressEnd }"
          aria-hidden="true"
        >
          <span
            class="trace-marker"
            :class="trace.row.tone"
            :style="{ gridColumn: String(trace.nodeIndex + 1) }"
          ></span>
        </div>
        <div class="trace-state">
          <b :class="trace.row.tone">{{ trace.row.currentNode }}</b>
          <span
            >{{ trace.row.currentStatus.label }} ·
            {{ trace.row.currentStatus.changedAt }}</span
          >
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.flow-map {
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
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.panel-head h2 {
  margin: 0;
  font-size: 14px;
}

.panel-head strong,
.axis-label {
  color: var(--muted);
  font-size: 10px;
}

.node-axis,
.trace-row {
  display: grid;
  grid-template-columns: minmax(132px, 0.7fr) minmax(0, 4fr) minmax(
      118px,
      0.75fr
    );
}

.node-axis {
  min-height: 82px;
  align-items: stretch;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.axis-label {
  display: flex;
  align-items: center;
  padding: 8px 10px;
}

.node-scale,
.trace-track {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(var(--node-count), minmax(0, 1fr));
}

.node-scale {
  position: relative;
  border-inline: 1px solid var(--line);
}

.node-scale::before {
  position: absolute;
  top: 20px;
  right: calc(50% / var(--node-count));
  left: calc(50% / var(--node-count));
  height: 2px;
  background: var(--line-strong);
  content: "";
}

.node-cell {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  padding: 8px 2px 6px;
  color: var(--muted);
  text-align: center;
}

.node-sequence {
  z-index: 1;
  width: 26px;
  height: 26px;
  display: grid;
  flex: 0 0 26px;
  place-items: center;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.node-cell b {
  overflow: hidden;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.node-cell i {
  position: absolute;
  z-index: 2;
  top: 3px;
  left: calc(50% + 10px);
  min-width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: 2px solid var(--surface-2);
  border-radius: 50%;
  background: var(--info);
  color: var(--surface);
  font-size: 8px;
  font-style: normal;
  transform: translateX(-50%);
}

.node-cell.occupied {
  color: var(--info);
}

.node-cell.occupied .node-sequence {
  border-color: currentColor;
  background: var(--surface);
  color: currentColor;
  box-shadow: 0 0 0 2px var(--surface-2);
}

.node-cell.occupied.warn {
  color: var(--warn);
}

.node-cell.occupied.warn i {
  background: var(--warn);
}

.node-cell.occupied.risk {
  color: var(--risk);
}

.node-cell.occupied.risk i {
  background: var(--risk);
}

.trace-row {
  min-height: 54px;
  align-items: center;
  border-bottom: 1px solid var(--line);
}

.trace-row:last-child {
  border-bottom: 0;
}

.trace-identity,
.trace-state {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
}

.trace-identity {
  color: var(--ink);
  text-decoration: none;
}

.trace-identity:hover b {
  color: var(--brand);
}

.trace-identity b,
.trace-state b {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-identity span,
.trace-state span {
  overflow: hidden;
  color: var(--muted);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-track {
  position: relative;
  height: 100%;
  align-items: center;
  border-inline: 1px solid var(--line);
  color: var(--info);
}

.trace-track::before,
.trace-track::after {
  position: absolute;
  left: calc(50% / var(--node-count));
  height: 2px;
  content: "";
}

.trace-track::before {
  right: calc(50% / var(--node-count));
  background: var(--line);
}

.trace-track::after {
  width: calc(var(--progress-end) - (50% / var(--node-count)));
  background: currentColor;
}

.trace-track.ok {
  color: var(--ok);
}

.trace-track.warn {
  color: var(--warn);
}

.trace-track.risk {
  color: var(--risk);
}

.trace-marker {
  z-index: 1;
  width: 13px;
  height: 13px;
  place-self: center;
  border: 3px solid var(--surface);
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 1px currentColor;
}

.trace-state .ok {
  color: var(--ok);
}

.trace-state .warn {
  color: var(--warn);
}

.trace-state .risk {
  color: var(--risk);
}

.trace-state .info {
  color: var(--info);
}

@media (max-width: 720px) {
  .node-axis {
    display: none;
  }

  .trace-row {
    grid-template-columns: minmax(0, 1fr) minmax(112px, auto);
  }

  .trace-track {
    display: none;
  }

  .trace-state {
    align-items: flex-end;
    text-align: right;
  }
}
</style>
