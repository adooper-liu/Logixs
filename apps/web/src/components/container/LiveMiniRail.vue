<script setup lang="ts">
import type { WorkNode } from "../../data/sample";

defineProps<{
  nodes: readonly WorkNode[];
}>();
</script>

<template>
  <ol v-if="nodes.length" class="mini-rail" aria-label="已落库站点">
    <li
      v-for="node in nodes"
      :key="node.key"
      :class="{ current: node.isCurrentStatus, done: node.phase === 'done' }"
    >
      {{ node.name }}
    </li>
  </ol>
</template>

<style scoped>
.mini-rail {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  margin: var(--space-1) 0 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: var(--text-micro);
}

.mini-rail li.done {
  color: var(--ink-soft, var(--muted));
}

.mini-rail li.current {
  color: var(--ink);
  font-weight: 600;
}
</style>
