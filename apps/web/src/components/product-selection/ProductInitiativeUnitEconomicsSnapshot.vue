<script setup lang="ts">
import type { ProductInitiativeUnitEconomicsSnapshotV1 } from "@logix/contracts";
import {
  UNIT_ECONOMICS_FIELDS,
  UNIT_ECONOMICS_SCENARIOS,
} from "../../composables/useProductInitiativeDecision";

defineProps<{
  snapshot: ProductInitiativeUnitEconomicsSnapshotV1;
  negativeConservativeReason: string | null;
}>();
</script>

<template>
  <div class="unit-economics-snapshot">
    <dl class="unit-economics-snapshot__context">
      <div>
        <dt>市场</dt>
        <dd>{{ snapshot.marketCode }}</dd>
      </div>
      <div>
        <dt>渠道</dt>
        <dd>{{ snapshot.channelCode }}</dd>
      </div>
      <div>
        <dt>币种</dt>
        <dd>{{ snapshot.currencyCode }}</dd>
      </div>
    </dl>

    <section
      v-for="scenario in UNIT_ECONOMICS_SCENARIOS"
      :key="scenario.code"
      class="unit-economics-snapshot__scenario"
    >
      <header>
        <h4>{{ scenario.label }}</h4>
        <p>
          单件贡献
          <b>
            {{ snapshot.scenarios[scenario.code].contribution.min }}～{{
              snapshot.scenarios[scenario.code].contribution.max
            }}
            {{ snapshot.currencyCode }}
          </b>
        </p>
      </header>
      <dl>
        <div v-for="field in UNIT_ECONOMICS_FIELDS" :key="field.code">
          <dt>{{ field.label }}</dt>
          <dd>
            {{ snapshot.scenarios[scenario.code][field.code].min }}～{{
              snapshot.scenarios[scenario.code][field.code].max
            }}
          </dd>
          <dd class="unit-economics-snapshot__basis">
            {{
              snapshot.scenarios[scenario.code][field.code].basis === "evidence"
                ? "有证据"
                : "待验证假设"
            }}
            <template
              v-if="
                snapshot.scenarios[scenario.code][field.code].basis ===
                'evidence'
              "
            >
              ·
              {{
                snapshot.scenarios[scenario.code][field.code].evidenceRefs
                  .length
              }}
              项引用
            </template>
          </dd>
        </div>
      </dl>
    </section>

    <dl
      v-if="negativeConservativeReason"
      class="unit-economics-snapshot__reason"
    >
      <dt>保守情景仍要投入的理由</dt>
      <dd>{{ negativeConservativeReason }}</dd>
    </dl>
  </div>
</template>

<style scoped>
.unit-economics-snapshot {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}
.unit-economics-snapshot__context {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}
.unit-economics-snapshot__context > div,
.unit-economics-snapshot__scenario dl > div {
  min-width: 0;
  padding: var(--space-2);
  border: 1px solid var(--line);
  background: var(--surface-2);
}
.unit-economics-snapshot dt {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}
.unit-economics-snapshot dd {
  margin: var(--space-1) 0 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-label);
}
.unit-economics-snapshot__scenario {
  min-width: 0;
}
.unit-economics-snapshot__scenario header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.unit-economics-snapshot__scenario h4,
.unit-economics-snapshot__scenario p {
  margin: 0;
  font-size: var(--text-label);
}
.unit-economics-snapshot__scenario p {
  color: var(--ink-soft);
  text-align: right;
}
.unit-economics-snapshot__scenario p b {
  display: block;
  margin-top: var(--space-1);
  color: var(--ink);
}
.unit-economics-snapshot__scenario dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}
.unit-economics-snapshot__basis {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.unit-economics-snapshot__reason {
  margin: 0;
  padding: var(--space-3);
  border-left: 3px solid var(--warn);
  background: var(--warn-bg);
}
@media (max-width: 520px) {
  .unit-economics-snapshot__context,
  .unit-economics-snapshot__scenario dl {
    grid-template-columns: 1fr;
  }
  .unit-economics-snapshot__scenario header {
    display: grid;
  }
  .unit-economics-snapshot__scenario p {
    text-align: left;
  }
}
</style>
