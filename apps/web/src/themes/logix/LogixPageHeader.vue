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
  gap: 20px;
}

.page-heading {
  min-width: 0;
}

.heading-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.eyebrow {
  display: block;
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
}

h2 {
  margin: 1px 0 0;
  font-size: 20px;
  line-height: 1.3;
}

p {
  margin: 3px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
}

.page-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-actions small {
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 767px) {
  .page-header {
    min-height: 0;
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .page-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
