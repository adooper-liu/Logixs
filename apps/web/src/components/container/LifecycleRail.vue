<script setup lang="ts">
import { nextTick, shallowRef, watch } from "vue";
import type { WorkNode } from "../../data/sample";

const props = defineProps<{
  nodes: WorkNode[];
  activeKey: string;
}>();

const emit = defineEmits<{
  select: [node: WorkNode];
}>();

const nodeClass = (node: WorkNode) => [
  node.phase,
  node.attention ? `attention-${node.attention}` : "",
  { "current-status": node.isCurrentStatus },
];

const railElement = shallowRef<HTMLElement>();

watch(
  () => props.activeKey,
  async () => {
    await nextTick();
    const rail = railElement.value;
    if (!rail || rail.scrollWidth <= rail.clientWidth) return;
    rail
      .querySelector<HTMLElement>(".rail-node.active")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  },
  { immediate: true },
);
</script>

<template>
  <nav ref="railElement" class="rail" aria-label="货柜生命周期">
    <button
      v-for="node in nodes"
      :key="node.key"
      type="button"
      class="rail-node"
      :class="[nodeClass(node), { active: node.key === activeKey }]"
      :disabled="node.phase === 'optional' || node.phase === 'skipped'"
      @click="emit('select', node)"
    >
      <i><span v-if="node.attention" class="attention-dot"></span></i>
      <span>
        <b>{{ node.name }}</b>
        <small>{{
          node.actual || node.estimated || node.planned || "待发生"
        }}</small>
      </span>
    </button>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rail-node {
  position: relative;
  min-height: 40px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 7px;
  padding: 5px 7px;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  text-align: left;
  cursor: pointer;
}

.rail-node:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 17px;
  top: 25px;
  bottom: -8px;
  width: 1px;
  background: var(--line-strong);
}

.rail-node:hover,
.rail-node.active {
  background: var(--surface-2);
}

.rail-node i {
  position: relative;
  z-index: var(--z-content-raised);
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
}

.rail-node.done i {
  border-color: var(--ok);
  background: var(--ok);
}

.rail-node.current-status i {
  border-color: var(--info);
  box-shadow: 0 0 0 3px var(--info-bg);
}

.rail-node.attention-current i,
.rail-node.attention-warn i {
  border-color: var(--warn);
  background: var(--warn);
  box-shadow: 0 0 0 3px var(--warn-bg);
}

.rail-node.attention-risk i {
  border-color: var(--risk);
  background: var(--risk);
  box-shadow: 0 0 0 3px var(--risk-bg);
}

.attention-dot {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 4px;
  height: 4px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--on-status);
}

.rail-node.optional i,
.rail-node.skipped i {
  border-style: dashed;
}

.rail-node span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.rail-node b {
  font-size: 12px;
}

.rail-node small {
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.rail-node:disabled {
  cursor: default;
  opacity: 0.65;
}

@media (max-width: 900px) {
  .rail {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .rail-node {
    min-width: 116px;
  }

  .rail-node::after {
    display: none;
  }
}
</style>
