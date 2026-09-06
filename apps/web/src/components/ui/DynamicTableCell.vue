<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "@lucide/vue";
import {
  resolveDataTableCell,
  type DataTableColumnDefinition,
  type DataTableRow,
} from "./dataTableContract";

const props = defineProps<{
  column: DataTableColumnDefinition;
  row: DataTableRow;
  rowLabel: string;
}>();

const emit = defineEmits<{ openRow: [rowId: string] }>();
const cell = computed(() =>
  resolveDataTableCell(props.column, props.row.values[props.column.code]),
);
const hasSemanticTone = computed(
  () => props.column.kind === "status" || props.column.kind === "risk",
);
</script>

<template>
  <button
    v-if="column.kind === 'action'"
    class="open-row"
    type="button"
    :aria-label="`${column.label}：${rowLabel}`"
    @click="emit('openRow', row.rowId)"
  >
    <ChevronRight :size="17" aria-hidden="true" />
  </button>
  <button
    v-else-if="column.kind === 'entity' && column.rowAction === 'open'"
    class="identity-action entity-action"
    type="button"
    :aria-label="cell.displayValue"
    @click="emit('openRow', row.rowId)"
  >
    <b>{{ cell.displayValue }}</b>
    <small v-if="cell.supportingValues?.length" class="entity-references mono">
      {{ cell.supportingValues.join(" · ") }}
    </small>
    <span v-if="cell.context" class="entity-context">{{ cell.context }}</span>
  </button>
  <span v-else-if="column.kind === 'entity'" class="entity-value">
    <b>{{ cell.displayValue }}</b>
    <small v-if="cell.supportingValues?.length" class="entity-references mono">
      {{ cell.supportingValues.join(" · ") }}
    </small>
    <span v-if="cell.context" class="entity-context">{{ cell.context }}</span>
  </span>
  <button
    v-else-if="column.rowAction === 'open'"
    class="identity-action mono"
    type="button"
    @click="emit('openRow', row.rowId)"
  >
    {{ cell.displayValue }}
  </button>
  <span
    v-else-if="hasSemanticTone"
    class="semantic-value"
    :class="cell.valueState"
  >
    <b :class="cell.tone">{{ cell.displayValue }}</b>
    <small v-if="cell.detail">{{ cell.detail }}</small>
  </span>
  <span
    v-else
    class="plain-value"
    :class="[
      cell.valueState,
      { mono: column.kind === 'identifier' || column.kind === 'currency' },
    ]"
  >
    {{ cell.displayValue }}
  </span>
</template>

<style scoped>
.open-row,
.identity-action {
  border: 0;
  background: transparent;
  color: var(--brand-strong);
  cursor: pointer;
}

.open-row {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-control);
}

.open-row:hover {
  background: var(--brand-soft);
}

.identity-action {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-action,
.entity-value {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}

.entity-action {
  width: 100%;
  overflow: visible;
  white-space: normal;
}

.entity-action b,
.entity-value b {
  color: var(--ink);
  font-size: 13px;
  line-height: 1.25;
}

.entity-references {
  max-width: 100%;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-context {
  color: var(--brand-strong);
  font-size: 11px;
}

.identity-action:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.semantic-value {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.semantic-value b,
.plain-value {
  overflow: hidden;
  font-size: 12px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
}

.semantic-value small {
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plain-value.empty {
  color: var(--muted);
}

.plain-value.invalid,
.semantic-value.invalid b {
  color: var(--risk);
}

.ok {
  color: var(--ok);
}

.warn {
  color: var(--warn);
}

.risk {
  color: var(--risk);
}

.info {
  color: var(--info);
}

.muted {
  color: var(--muted);
}
</style>
