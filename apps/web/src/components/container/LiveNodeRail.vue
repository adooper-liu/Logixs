<script setup lang="ts">
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  nodes: readonly LiveNodeView[];
}>();
</script>

<template>
  <nav class="rail" aria-label="货柜节点">
    <ol>
      <li
        v-for="node in nodes"
        :key="node.nodeInstanceId"
        class="rail-node"
        :class="{ current: node.isCurrent }"
      >
        <small>{{ String(node.sequence).padStart(2, "0") }}</small>
        <span class="copy">
          <b>{{ node.name }}</b>
          <span>{{ node.stateLabel }}</span>
          <time v-if="node.completedAt">{{ node.completedAt }}</time>
        </span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.rail {
  margin: 0 0 12px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rail-node {
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr);
  gap: 8px;
  padding: 6px 0;
  color: var(--ink-soft);
}

.rail-node.current {
  color: var(--ink);
}

.copy {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.copy b {
  font-weight: 600;
}

.copy span,
.copy time {
  color: var(--muted);
  font-size: 0.85em;
}
</style>
