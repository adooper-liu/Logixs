<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { Columns3, Search, X } from "@lucide/vue";
import type {
  DataTableColumnDefinition,
  DataTableSchema,
} from "./dataTableContract";
import type { DataTableExternalFilterView } from "./useDynamicDataTable";

defineProps<{
  schema: DataTableSchema;
  columns: readonly DataTableColumnDefinition[];
  visibleColumnCodes: readonly string[];
  externalFilters: readonly DataTableExternalFilterView[];
}>();

const emit = defineEmits<{
  toggleColumn: [columnCode: string];
  clearExternalFilter: [columnCode: string];
}>();
const query = defineModel<string>("query", { default: "" });
const filter = defineModel<string>("filter", { default: "" });
const columnMenu = useTemplateRef<HTMLDetailsElement>("columnMenu");

const closeColumnMenu = (returnFocus = false) => {
  if (!columnMenu.value?.open) return;
  columnMenu.value.open = false;
  if (returnFocus) columnMenu.value.querySelector("summary")?.focus();
};

const closeOnOutsidePointer = (event: PointerEvent) => {
  if (!columnMenu.value?.contains(event.target as Node)) closeColumnMenu();
};

const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || !columnMenu.value?.open) return;
  event.preventDefault();
  closeColumnMenu(true);
};

onMounted(() => {
  document.addEventListener("pointerdown", closeOnOutsidePointer);
  document.addEventListener("keydown", closeOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeOnOutsidePointer);
  document.removeEventListener("keydown", closeOnEscape);
});
</script>

<template>
  <header class="table-toolbar">
    <div class="toolbar-primary">
      <label class="search-control">
        <Search :size="16" aria-hidden="true" />
        <span class="sr-only">搜索货柜</span>
        <input
          v-model="query"
          type="search"
          :placeholder="schema.searchPlaceholder ?? '搜索'"
        />
      </label>

      <div
        v-if="schema.quickFilters?.length"
        class="quick-filters"
        aria-label="快速筛选"
      >
        <button
          v-for="item in schema.quickFilters"
          :key="item.code"
          type="button"
          :aria-pressed="filter === item.code"
          @click="filter = item.code"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <details
      v-if="columns.some((column) => column.hideable)"
      ref="columnMenu"
      class="column-menu"
    >
      <summary>
        <Columns3 :size="16" aria-hidden="true" />
        字段
      </summary>
      <div class="column-options">
        <label
          v-for="column in columns.filter((item) => item.hideable)"
          :key="column.code"
        >
          <input
            type="checkbox"
            :data-testid="`column-toggle-${column.code}`"
            :checked="visibleColumnCodes.includes(column.code)"
            @change="emit('toggleColumn', column.code)"
          />
          {{ column.label }}
        </label>
      </div>
    </details>
  </header>

  <div
    v-if="externalFilters.length"
    class="active-filters"
    aria-label="当前筛选"
  >
    <span v-for="item in externalFilters" :key="item.columnCode">
      {{ item.label }}：{{ item.displayValue }}
      <button
        type="button"
        :aria-label="`清除${item.label}筛选`"
        @click="emit('clearExternalFilter', item.columnCode)"
      >
        <X :size="13" aria-hidden="true" />
      </button>
    </span>
  </div>
</template>

<style scoped>
.table-toolbar,
.toolbar-primary,
.active-filters {
  display: flex;
  align-items: center;
}

.table-toolbar {
  min-height: 48px;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--line);
}

.toolbar-primary {
  min-width: 0;
  gap: 8px;
}

.search-control {
  width: min(300px, 38vw);
  height: var(--control-height);
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--muted);
}

.search-control input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
}

.quick-filters {
  display: flex;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  overflow: hidden;
}

.quick-filters button,
.column-menu summary {
  min-height: 32px;
  border: 0;
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
}

.quick-filters button {
  padding: 0 10px;
  border-right: 1px solid var(--line);
}

.quick-filters button:last-child {
  border-right: 0;
}

.quick-filters button[aria-pressed="true"] {
  background: var(--brand);
  color: var(--on-brand);
}

.column-menu {
  position: relative;
  flex: none;
}

.column-menu summary {
  height: var(--control-height);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  list-style: none;
}

.column-menu summary::-webkit-details-marker {
  display: none;
}

.column-options {
  position: absolute;
  z-index: calc(var(--z-content-raised) + 2);
  top: calc(100% + 5px);
  right: 0;
  width: 180px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  box-shadow: var(--shadow-overlay);
}

.column-options label {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 7px;
  color: var(--ink-soft);
  cursor: pointer;
}

.active-filters {
  min-height: 34px;
  gap: 6px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.active-filters > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 7px;
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: 11px;
}

.active-filters button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: currentColor;
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 767px) {
  .table-toolbar,
  .toolbar-primary {
    align-items: stretch;
    flex-direction: column;
  }

  .search-control {
    width: 100%;
    min-height: var(--touch-target);
  }

  .quick-filters button,
  .column-menu summary {
    min-height: var(--touch-target);
  }

  .column-menu summary {
    justify-content: center;
  }

  .column-options {
    right: auto;
    left: 0;
  }
}
</style>
