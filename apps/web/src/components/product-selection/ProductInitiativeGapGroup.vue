<script setup lang="ts">
import type {
  ProductInitiativeGapGroup,
  ProductInitiativeGapPanel,
} from "../../composables/useProductInitiativeDecision";

defineProps<{
  groups: readonly ProductInitiativeGapGroup[];
  activePanel: ProductInitiativeGapPanel;
}>();
defineEmits<{ select: [panel: ProductInitiativeGapPanel] }>();
</script>

<template>
  <nav class="initiative-gap-groups" aria-label="立项缺口导航">
    <p>先处理这些业务区域</p>
    <div>
      <button
        v-for="group in groups"
        :key="group.panel"
        type="button"
        :class="{ active: group.panel === activePanel }"
        :aria-current="group.panel === activePanel ? 'step' : undefined"
        @click="$emit('select', group.panel)"
      >
        <b>{{ group.label }}</b>
        <span>· {{ group.count }} 项未齐</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.initiative-gap-groups {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.initiative-gap-groups p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.initiative-gap-groups > div {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.initiative-gap-groups button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-micro);
}
.initiative-gap-groups button.active {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.initiative-gap-groups button:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}
.initiative-gap-groups span {
  color: var(--muted);
}
</style>
