<script setup lang="ts">
import type { PageHeaderProps } from "../../ui-theme/contracts";

defineProps<PageHeaderProps>();
</script>

<template>
  <header class="page-header">
    <div class="page-heading">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <div class="heading-title">
        <h2>{{ title }}</h2>
        <slot name="help" />
      </div>
      <p v-if="summary">{{ summary }}</p>
    </div>
    <div v-if="$slots.actions || updatedAt" class="page-actions">
      <small v-if="updatedAt">更新于 {{ updatedAt }}</small>
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  min-height: 58px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-5);
}

.page-heading {
  min-width: 0;
}

.heading-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.eyebrow {
  display: block;
  color: var(--brand);
  font-size: var(--text-micro);
  font-weight: 700;
}

h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-page);
  line-height: 1.3;
}

p {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.page-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-actions small {
  color: var(--muted);
  font-size: var(--text-micro);
}

@media (max-width: 767px) {
  .page-header {
    min-height: 0;
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
