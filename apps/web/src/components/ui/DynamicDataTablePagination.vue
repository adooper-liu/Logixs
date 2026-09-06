<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";

defineProps<{
  start: number;
  end: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
}>();

defineEmits<{ previous: []; next: [] }>();
</script>

<template>
  <footer class="table-footer">
    <span class="result-count mono">{{ start }}–{{ end }} / {{ total }}</span>
    <div class="page-actions">
      <button
        type="button"
        aria-label="上一页"
        :disabled="!hasPrevious"
        @click="$emit('previous')"
      >
        <ChevronLeft :size="16" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="下一页"
        :disabled="!hasNext"
        @click="$emit('next')"
      >
        <ChevronRight :size="16" aria-hidden="true" />
      </button>
    </div>
  </footer>
</template>

<style scoped>
.table-footer,
.page-actions {
  display: flex;
  align-items: center;
}

.table-footer {
  min-height: 42px;
  justify-content: space-between;
  padding: 5px 10px;
  color: var(--muted);
  font-size: 11px;
}

.page-actions {
  gap: 4px;
}

.page-actions button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
}

.page-actions button:disabled {
  color: var(--disabled);
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .page-actions button {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
