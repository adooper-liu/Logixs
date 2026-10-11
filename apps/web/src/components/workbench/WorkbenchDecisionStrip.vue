<script setup lang="ts">
import type { WorkbenchTone } from "./workbenchLayout.types";

withDefaults(
  defineProps<{
    conclusion: string;
    regionLabel: string;
    tone?: WorkbenchTone;
    disabledReason?: string;
  }>(),
  { tone: "neutral", disabledReason: undefined },
);

defineSlots<{
  conclusionDetail?(): unknown;
  progress?(): unknown;
  gaps?(): unknown;
  action?(): unknown;
}>();
</script>

<template>
  <section
    class="decision-strip"
    :class="`decision-strip--${tone}`"
    :aria-label="regionLabel"
  >
    <div class="decision-strip__conclusion">
      <b>{{ conclusion }}</b>
      <slot name="conclusionDetail" />
    </div>
    <div v-if="$slots.progress" class="decision-strip__progress">
      <slot name="progress" />
    </div>
    <div v-if="$slots.gaps" class="decision-strip__gaps">
      <slot name="gaps" />
    </div>
    <div v-if="$slots.action" class="decision-strip__action">
      <slot name="action" />
    </div>
    <p v-if="disabledReason" class="decision-strip__reason" role="status">
      {{ disabledReason }}
    </p>
  </section>
</template>

<style scoped>
.decision-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) auto minmax(12rem, 2fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface-2);
}

.decision-strip--info {
  border-left: 3px solid var(--info);
}

.decision-strip--ok {
  border-left: 3px solid var(--ok);
}

.decision-strip--warn {
  border-left: 3px solid var(--warn);
}

.decision-strip--risk {
  border-left: 3px solid var(--risk);
}

.decision-strip__conclusion,
.decision-strip__progress,
.decision-strip__gaps,
.decision-strip__action {
  min-width: 0;
}

.decision-strip__conclusion {
  display: grid;
  gap: var(--space-1);
  color: var(--ink);
  font-size: var(--text-meta);
}

.decision-strip__gaps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.decision-strip__reason {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

@media (max-width: 1100px) {
  .decision-strip {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .decision-strip__gaps {
    grid-column: 1 / -1;
  }
}

@media (max-width: 680px) {
  .decision-strip {
    grid-template-columns: 1fr;
    padding: var(--space-3);
  }

  .decision-strip__gaps,
  .decision-strip__reason {
    grid-column: auto;
  }
}
</style>
