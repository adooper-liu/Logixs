<script setup lang="ts">
import { toRef } from "vue";
import { ArrowDown, ArrowUp } from "@lucide/vue";
import DynamicDataTablePagination from "./DynamicDataTablePagination.vue";
import DynamicDataTableToolbar from "./DynamicDataTableToolbar.vue";
import DynamicTableCell from "./DynamicTableCell.vue";
import InfoTooltip from "./InfoTooltip.vue";
import type {
  DataTableProcessingMode,
  DataTableProjection,
  DataTableSort,
} from "./dataTableContract";
import { useDynamicDataTable } from "./useDynamicDataTable";

const props = withDefaults(
  defineProps<{
    projection: DataTableProjection;
    processingMode?: DataTableProcessingMode;
    externalFilters?: Readonly<Record<string, string>>;
  }>(),
  {
    processingMode: "client",
    externalFilters: () => ({}),
  },
);

const emit = defineEmits<{
  openRow: [rowId: string];
  sortChange: [sort: DataTableSort];
  previousPage: [];
  nextPage: [];
  clearExternalFilter: [columnCode: string];
}>();
const query = defineModel<string>("query", { default: "" });
const filter = defineModel<string>("filter", { default: "" });

const table = useDynamicDataTable({
  projection: toRef(props, "projection"),
  processingMode: toRef(props, "processingMode"),
  externalFilters: toRef(props, "externalFilters"),
  query,
  filter,
  onSortChange: (sort) => emit("sortChange", sort),
});

const previousPage = () => {
  if (!table.hasPrevious.value) return;
  table.previousPage();
  emit("previousPage");
};

const nextPage = () => {
  if (!table.hasNext.value) return;
  table.nextPage();
  emit("nextPage");
};
</script>

<template>
  <section class="data-table" :aria-label="projection.schema.label">
    <div
      v-if="table.resolution.value.issues.length"
      class="schema-error"
      role="alert"
    >
      <b>表格配置不可用</b>
      <span>{{ table.resolution.value.issues.join("；") }}</span>
    </div>

    <template v-else>
      <DynamicDataTableToolbar
        v-model:query="query"
        v-model:filter="filter"
        :schema="projection.schema"
        :columns="table.availableColumns.value"
        :visible-column-codes="table.visibleColumnCodes.value"
        :external-filters="table.externalFilterEntries.value"
        @toggle-column="table.toggleColumn"
        @clear-external-filter="emit('clearExternalFilter', $event)"
      />

      <div class="table-scroll" data-testid="data-table-scroll">
        <table :aria-label="projection.schema.label">
          <colgroup>
            <col
              v-for="column in table.visibleColumns.value"
              :key="column.code"
              :style="table.columnStyle(column)"
            />
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="column in table.visibleColumns.value"
                :key="column.code"
                scope="col"
                :aria-sort="table.ariaSort(column)"
                :class="{
                  pinned: column.pinned,
                  'divider-before': column.dividerBefore,
                }"
                :style="table.stickyStyle(column)"
              >
                <span class="column-heading">
                  <button
                    v-if="column.sortable"
                    type="button"
                    :aria-label="table.sortLabel(column)"
                    @click="table.changeSort(column)"
                  >
                    {{ column.label }}
                    <ArrowUp
                      v-if="
                        table.currentSort.value?.columnCode === column.code &&
                        table.currentSort.value.direction === 'asc'
                      "
                      :size="13"
                      aria-hidden="true"
                    />
                    <ArrowDown
                      v-else-if="
                        table.currentSort.value?.columnCode === column.code
                      "
                      :size="13"
                      aria-hidden="true"
                    />
                  </button>
                  <span v-else>{{ column.label }}</span>
                  <InfoTooltip
                    v-if="column.description"
                    :text="column.description"
                    :label="`查看${column.label}说明`"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in table.displayedRows.value"
              :key="row.rowId"
              :class="row.tone ? `row-tone-${row.tone}` : undefined"
            >
              <td
                v-for="column in table.visibleColumns.value"
                :key="column.code"
                :data-column-code="column.code"
                :class="[
                  `cell-${column.kind}`,
                  {
                    pinned: column.pinned,
                    'divider-before': column.dividerBefore,
                  },
                ]"
                :style="table.stickyStyle(column)"
              >
                <DynamicTableCell
                  :column="column"
                  :row="row"
                  :row-label="table.rowLabel(row)"
                  @open-row="emit('openRow', $event)"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="!table.displayedRows.value.length" class="empty-state">
          没有匹配的货柜，请调整筛选条件。
        </div>
      </div>

      <DynamicDataTablePagination
        :start="table.resultStart.value"
        :end="table.resultEnd.value"
        :total="table.resultTotal.value"
        :has-previous="table.hasPrevious.value"
        :has-next="table.hasNext.value"
        @previous="previousPage"
        @next="nextPage"
      />
    </template>
  </section>
</template>

<style scoped>
.data-table {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.table-scroll {
  max-width: 100%;
  max-height: max(280px, calc(100dvh - 198px));
  overflow: auto;
  overscroll-behavior: contain;
}

.table-scroll table {
  width: 100%;
  min-width: max-content;
  border-spacing: 0;
  table-layout: fixed;
}

.table-scroll th,
.table-scroll td {
  padding: 9px 10px;
  border-right: 0;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  text-align: left;
  vertical-align: middle;
}

.table-scroll .divider-before {
  border-left: 1px solid var(--line);
}

.table-scroll th {
  position: sticky;
  z-index: var(--z-content-raised);
  top: 0;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 12px;
  font-weight: 650;
}

.table-scroll tbody tr {
  height: 66px;
}

.table-scroll th.pinned {
  z-index: calc(var(--z-content-raised) + 1);
}

.table-scroll td.pinned {
  position: sticky;
  z-index: var(--z-content-raised);
}

.table-scroll th.pinned:last-child,
.table-scroll td.pinned:last-child {
  box-shadow: -1px 0 var(--line);
}

.table-scroll tbody tr:hover td {
  background: var(--surface-2);
}

.table-scroll tbody tr.row-tone-risk td:first-child {
  box-shadow: inset 3px 0 0 var(--risk);
}

.table-scroll tbody tr.row-tone-warn td:first-child {
  box-shadow: inset 3px 0 0 var(--warn);
}

.column-heading,
.column-heading button {
  display: flex;
  align-items: center;
  gap: 3px;
}

.column-heading button {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.empty-state,
.schema-error {
  padding: 34px 14px;
  color: var(--muted);
  text-align: center;
}

.schema-error {
  display: flex;
  flex-direction: column;
  color: var(--risk);
}

@media (max-width: 767px) {
  .table-scroll {
    max-height: max(260px, calc(100dvh - 314px));
  }

  .table-scroll th,
  .table-scroll td {
    padding: 8px;
  }

  .table-scroll th,
  .table-scroll th.pinned,
  .table-scroll td.pinned {
    position: static;
  }

  .table-scroll th.pinned:last-child,
  .table-scroll td.pinned:last-child {
    box-shadow: none;
  }
}
</style>
