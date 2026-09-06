<script setup lang="ts">
import { computed } from "vue";
import type {
  DisplayFieldSet,
  ResolvedDisplayField,
} from "./displayFieldContract";
import { resolveDisplayFieldSet } from "./displayFieldContract";
import InfoTooltip from "./InfoTooltip.vue";

const props = withDefaults(
  defineProps<{
    fieldSet: DisplayFieldSet;
    columns?: 1 | 2 | 3 | 4;
    mobileColumns?: 1 | 2 | 3;
    locale?: string;
    variant?: "table" | "signal";
  }>(),
  {
    columns: 3,
    mobileColumns: 1,
    locale: "zh-CN",
    variant: "table",
  },
);

const resolution = computed(() =>
  resolveDisplayFieldSet(props.fieldSet, props.locale),
);
const showGroupHeadings = computed(() => resolution.value.groups.length > 1);
const gridStyle = computed(() => ({
  "--field-columns": String(props.columns),
  "--field-mobile-columns": String(props.mobileColumns),
}));
const fieldStyle = (field: ResolvedDisplayField) => ({
  "--field-span": String(Math.min(field.span ?? 1, props.columns)),
  "--field-mobile-span": String(Math.min(field.span ?? 1, props.mobileColumns)),
});
const valueClass = (field: ResolvedDisplayField) => ({
  mono: field.type === "identifier" || field.type === "currency",
  empty: field.valueState === "empty",
  invalid: field.valueState === "invalid",
});
</script>

<template>
  <div
    class="dynamic-fields"
    :class="`dynamic-fields--${variant}`"
    :style="gridStyle"
  >
    <p v-if="resolution.issues.length" class="schema-error" role="alert">
      字段配置不可用：{{ resolution.issues.join("；") }}
    </p>

    <template v-else>
      <p v-if="!resolution.groups.length" class="empty-fields">
        暂无可展示字段
      </p>
      <section
        v-for="group in resolution.groups"
        :key="group.code"
        class="field-group"
      >
        <h4 v-if="showGroupHeadings" class="group-title">
          {{ group.label }}
        </h4>

        <dl v-if="group.primaryFields.length" class="field-grid">
          <div
            v-for="field in group.primaryFields"
            :key="field.code"
            class="field"
            :class="`field--${field.valueState}`"
            :style="fieldStyle(field)"
          >
            <dt>
              <span>{{ field.label }}</span>
              <InfoTooltip
                v-if="field.description"
                :label="`查看${field.label}说明`"
                :text="field.description"
              />
            </dt>
            <dd :class="valueClass(field)" :title="field.displayValue">
              {{ field.displayValue }}
            </dd>
          </div>
        </dl>

        <details v-if="group.secondaryFields.length" class="secondary-fields">
          <summary>更多字段 {{ group.secondaryFields.length }}</summary>
          <dl class="field-grid">
            <div
              v-for="field in group.secondaryFields"
              :key="field.code"
              class="field"
              :class="`field--${field.valueState}`"
              :style="fieldStyle(field)"
            >
              <dt>
                <span>{{ field.label }}</span>
                <InfoTooltip
                  v-if="field.description"
                  :label="`查看${field.label}说明`"
                  :text="field.description"
                />
              </dt>
              <dd :class="valueClass(field)" :title="field.displayValue">
                {{ field.displayValue }}
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dynamic-fields {
  min-width: 0;
}

.field-group + .field-group {
  margin-top: 8px;
}

.group-title {
  margin: 0;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 12px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(var(--field-columns), minmax(0, 1fr));
  margin: 0;
  border: 1px solid var(--line);
  border-right: 0;
  border-bottom: 0;
}

.field {
  min-width: 0;
  grid-column: span var(--field-span);
  padding: 7px 10px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.field dt {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--muted);
  font-size: 10px;
}

.field dt > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field dt :deep(.info-tooltip__trigger) {
  width: 20px;
  height: 20px;
}

.field dd {
  margin: 1px 0 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-weight: 650;
}

.field dd.empty {
  color: var(--muted);
  font-weight: 500;
}

.field dd.invalid,
.schema-error {
  color: var(--risk);
}

.dynamic-fields--signal .field-grid {
  gap: 8px;
  border: 0;
}

.dynamic-fields--signal .field {
  min-height: 64px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface-2);
}

.dynamic-fields--signal .field dd {
  margin-top: 3px;
  font-size: 14px;
}

.dynamic-fields--signal .field--empty {
  border-style: dashed;
  background: var(--surface);
}

.empty-fields {
  margin: 0;
  padding: 10px;
  color: var(--muted);
  text-align: center;
}

.secondary-fields {
  margin-top: -1px;
}

.secondary-fields summary {
  min-height: 32px;
  display: flex;
  align-items: center;
  padding: 5px 8px;
  border: 1px solid var(--line);
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.secondary-fields[open] summary {
  border-bottom: 0;
}

.schema-error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--risk);
  background: var(--risk-bg);
  font-size: 12px;
}

@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: repeat(var(--field-mobile-columns), minmax(0, 1fr));
  }

  .field {
    grid-column: span var(--field-mobile-span);
  }

  .secondary-fields summary {
    min-height: var(--touch-target);
  }
}
</style>
