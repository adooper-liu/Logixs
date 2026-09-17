<script setup lang="ts">
import { Save } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import type {
  ImportFieldCatalog,
  ImportFieldCode,
  ImportMappingSuggestion,
  QuantityUnitCode,
} from "../../api/importBatches";

const props = defineProps<{
  columns: string[];
  suggestions: ImportMappingSuggestion[];
  effectiveMappings: ImportMappingSuggestion[];
  fieldCatalog: ImportFieldCatalog;
  confirmedQuantityUnit: QuantityUnitCode | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  confirm: [
    payload: {
      reviews: { column: string; fieldCode: ImportFieldCode | null }[];
      quantityUnit: QuantityUnitCode | null;
    },
  ];
}>();

const selections = reactive<Record<string, ImportFieldCode | "">>({});
const quantityUnit = ref<QuantityUnitCode | "">("");

watch(
  () =>
    [
      props.columns,
      props.suggestions,
      props.effectiveMappings,
      props.confirmedQuantityUnit,
    ] as const,
  () => {
    const initial =
      props.effectiveMappings.length > 0
        ? props.effectiveMappings
        : props.suggestions;
    const targetCounts = new Map<ImportFieldCode, number>();
    for (const mapping of initial) {
      if (!mapping.fieldCode) continue;
      targetCounts.set(
        mapping.fieldCode,
        (targetCounts.get(mapping.fieldCode) ?? 0) + 1,
      );
    }
    for (const column of props.columns) {
      const fieldCode = initial.find(
        (mapping) => mapping.column === column,
      )?.fieldCode;
      selections[column] =
        fieldCode && targetCounts.get(fieldCode) === 1 ? fieldCode : "";
    }
    quantityUnit.value = props.confirmedQuantityUnit ?? "";
  },
  { immediate: true, deep: true },
);

const hasMappedQuantityUnit = computed(() =>
  Object.values(selections).includes("quantityUnit"),
);
const hasQuantityUnit = computed(
  () => hasMappedQuantityUnit.value || quantityUnit.value !== "",
);

function updateMapping(column: string, event: Event): void {
  const fieldCode = (event.target as HTMLSelectElement).value as
    ImportFieldCode | "";
  if (fieldCode) {
    for (const otherColumn of props.columns) {
      if (otherColumn !== column && selections[otherColumn] === fieldCode) {
        selections[otherColumn] = "";
      }
    }
  }
  selections[column] = fieldCode;
  if (fieldCode === "quantityUnit") quantityUnit.value = "";
}

function updateQuantityUnit(event: Event): void {
  quantityUnit.value = (event.target as HTMLSelectElement).value as
    QuantityUnitCode | "";
  if (quantityUnit.value) {
    for (const column of props.columns) {
      if (selections[column] === "quantityUnit") selections[column] = "";
    }
  }
}

function submit(): void {
  if (!hasQuantityUnit.value) return;
  emit("confirm", {
    reviews: props.columns.map((column) => ({
      column,
      fieldCode: selections[column] || null,
    })),
    quantityUnit: quantityUnit.value || null,
  });
}
</script>

<template>
  <section class="mapping-editor" aria-labelledby="mapping-title">
    <h2 id="mapping-title" class="block-title">字段映射确认</h2>

    <div class="mapping-grid">
      <label v-for="column in columns" :key="column" class="mapping-row">
        <span class="source-column">{{ column }}</span>
        <select
          :value="selections[column]"
          :disabled="disabled"
          :data-column="column"
          @change="updateMapping(column, $event)"
        >
          <option value="">忽略此列</option>
          <option
            v-for="field in fieldCatalog.fields"
            :key="field.code"
            :value="field.code"
          >
            {{ field.label }}{{ field.required ? " *" : "" }}
          </option>
        </select>
      </label>
    </div>

    <label class="unit-row">
      <span>整批出运数量单位</span>
      <select
        :value="quantityUnit"
        :disabled="disabled || hasMappedQuantityUnit"
        data-testid="quantity-unit"
        required
        @change="updateQuantityUnit"
      >
        <option value="">请选择</option>
        <option
          v-for="unit in fieldCatalog.quantityUnits"
          :key="unit.code"
          :value="unit.code"
        >
          {{ unit.label }}
        </option>
      </select>
      <span v-if="hasMappedQuantityUnit" class="source-unit">按来源单位列</span>
    </label>

    <button
      class="btn"
      type="button"
      :disabled="disabled || !hasQuantityUnit"
      @click="submit"
    >
      <Save :size="16" aria-hidden="true" />
      保存字段确认
    </button>
  </section>
</template>

<style scoped>
.mapping-editor {
  margin-bottom: 18px;
}
.block-title {
  margin: 0 0 10px;
  color: var(--app-text-secondary, #6b7280);
  font-size: 15px;
  font-weight: 600;
}
.mapping-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 8px 16px;
  margin-bottom: 14px;
}
.mapping-row,
.unit-row {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(140px, 1.2fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 13px;
}
.source-column {
  overflow: hidden;
  color: var(--app-text-secondary, #6b7280);
  text-overflow: ellipsis;
  white-space: nowrap;
}
select {
  min-width: 0;
  height: 34px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 6px;
  background: var(--app-surface, #fff);
  color: inherit;
  padding: 0 8px;
}
.unit-row {
  grid-template-columns: minmax(150px, max-content) minmax(140px, 220px) auto;
  margin-bottom: 12px;
}
.source-unit {
  color: var(--app-text-secondary, #6b7280);
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 8px 14px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
@media (max-width: 640px) {
  .mapping-grid {
    grid-template-columns: 1fr;
  }
  .unit-row {
    grid-template-columns: 1fr;
  }
}
</style>
