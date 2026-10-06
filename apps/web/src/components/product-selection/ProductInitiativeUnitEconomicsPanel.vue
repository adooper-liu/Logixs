<script setup lang="ts">
import type {
  ProductInitiativeCurrencyOptionV1,
  ProductInitiativeEvidenceCandidateV1,
  ProductInitiativeUnitEconomicsBasisV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
} from "@logix/contracts";
import {
  NEGATIVE_CONSERVATIVE_REASON_MAX_LENGTH,
  UNIT_ECONOMICS_FIELDS,
  UNIT_ECONOMICS_SCENARIOS,
  type UnitEconomicsDraftState,
  type UnitEconomicsBasisChange,
  type UnitEconomicsEvidenceChange,
  type UnitEconomicsFieldCode,
  type UnitEconomicsRangeChange,
  type UnitEconomicsScenarioCode,
} from "../../composables/useProductInitiativeDecision";

defineProps<{
  marketCode: string;
  channelCode: string;
  currencyOptions: readonly ProductInitiativeCurrencyOptionV1[];
  draft: UnitEconomicsDraftState;
  snapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  evidenceCandidates: readonly ProductInitiativeEvidenceCandidateV1[];
  negativeContributionNeedsReason: boolean;
  negativeConservativeReason: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  updateCurrency: [value: string];
  updateRange: [change: UnitEconomicsRangeChange];
  updateBasis: [change: UnitEconomicsBasisChange];
  toggleEvidence: [change: UnitEconomicsEvidenceChange];
  updateNegativeReason: [value: string];
}>();

function rangeLabel(
  scenario: UnitEconomicsScenarioCode,
  field: UnitEconomicsFieldCode,
  suffix: string,
): string {
  const scenarioLabel = UNIT_ECONOMICS_SCENARIOS.find(
    (item) => item.code === scenario,
  )?.label;
  const fieldLabel = UNIT_ECONOMICS_FIELDS.find(
    (item) => item.code === field,
  )?.label;
  return [scenarioLabel, fieldLabel, suffix].filter(Boolean).join(" ");
}
</script>

<template>
  <fieldset class="unit-economics" aria-describedby="unit-economics-help">
    <legend>单位经济</legend>
    <p id="unit-economics-help" class="unit-economics__helper">
      录入两种情景的单件区间；贡献只采用服务端计算结果。
    </p>

    <dl class="unit-economics__context">
      <div>
        <dt>市场</dt>
        <dd>{{ marketCode || "交接未提供" }}</dd>
      </div>
      <div>
        <dt>渠道</dt>
        <dd>{{ channelCode || "交接未提供" }}</dd>
      </div>
    </dl>

    <label class="unit-economics__currency">
      <span>币种</span>
      <select
        :value="draft.currencyCode"
        :disabled="busy || currencyOptions.length === 0"
        aria-label="单位经济币种"
        @change="
          emit('updateCurrency', ($event.target as HTMLSelectElement).value)
        "
      >
        <option value="">请选择 active 币种</option>
        <option
          v-if="
            draft.currencyCode &&
            !currencyOptions.some((item) => item.code === draft.currencyCode)
          "
          :value="draft.currencyCode"
          disabled
        >
          {{ draft.currencyCode }}（当前不可选）
        </option>
        <option
          v-for="currency in currencyOptions"
          :key="currency.code"
          :value="currency.code"
        >
          {{ currency.code }} · {{ currency.name }}
        </option>
      </select>
    </label>
    <p v-if="currencyOptions.length === 0" class="unit-economics__warning">
      币种参考数据未接通，当前无法完成立项。
    </p>

    <section
      v-for="scenario in UNIT_ECONOMICS_SCENARIOS"
      :key="scenario.code"
      class="unit-economics__scenario"
      :aria-labelledby="'unit-economics-' + scenario.code"
    >
      <header>
        <h3 :id="'unit-economics-' + scenario.code">
          {{ scenario.label }}
        </h3>
        <p
          v-if="snapshot"
          class="unit-economics__contribution"
          :aria-label="scenario.label + '服务端贡献'"
        >
          单件贡献
          <b>
            {{ snapshot.scenarios[scenario.code].contribution.min }}～{{
              snapshot.scenarios[scenario.code].contribution.max
            }}
            {{ snapshot.currencyCode }}
          </b>
        </p>
        <p v-else class="unit-economics__pending">保存后由服务端计算</p>
      </header>

      <details class="unit-economics__scenario-details">
        <summary>填写{{ scenario.label }}金额与依据</summary>
        <div class="unit-economics__rows">
          <div
            v-for="field in UNIT_ECONOMICS_FIELDS"
            :key="field.code"
            class="unit-economics__row"
          >
            <b>{{ field.label }}</b>
            <div class="unit-economics__range-controls">
              <label>
                <span>最低</span>
                <input
                  type="text"
                  inputmode="decimal"
                  :value="draft.scenarios[scenario.code][field.code].min"
                  :aria-label="rangeLabel(scenario.code, field.code, '最低值')"
                  :disabled="busy"
                  @input="
                    emit('updateRange', {
                      scenario: scenario.code,
                      field: field.code,
                      endpoint: 'min',
                      value: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
              </label>
              <label>
                <span>最高</span>
                <input
                  type="text"
                  inputmode="decimal"
                  :value="draft.scenarios[scenario.code][field.code].max"
                  :aria-label="rangeLabel(scenario.code, field.code, '最高值')"
                  :disabled="busy"
                  @input="
                    emit('updateRange', {
                      scenario: scenario.code,
                      field: field.code,
                      endpoint: 'max',
                      value: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
              </label>
              <label class="unit-economics__basis">
                <span>依据</span>
                <select
                  :value="draft.scenarios[scenario.code][field.code].basis"
                  :aria-label="
                    rangeLabel(scenario.code, field.code, '依据类型')
                  "
                  :disabled="busy"
                  @change="
                    emit('updateBasis', {
                      scenario: scenario.code,
                      field: field.code,
                      basis: ($event.target as HTMLSelectElement).value as
                        ProductInitiativeUnitEconomicsBasisV1 | '',
                    })
                  "
                >
                  <option value="">请选择</option>
                  <option value="evidence">有证据</option>
                  <option value="assumption">待验证假设</option>
                </select>
              </label>
            </div>

            <details
              v-if="
                draft.scenarios[scenario.code][field.code].basis === 'evidence'
              "
              class="unit-economics__evidence"
            >
              <summary>
                已选
                {{
                  draft.scenarios[scenario.code][field.code].evidenceRefs.length
                }}
                项证据
              </summary>
              <p v-if="evidenceCandidates.length === 0">当前没有可引用证据</p>
              <label
                v-for="candidate in evidenceCandidates"
                :key="candidate.evidenceId"
              >
                <input
                  type="checkbox"
                  :checked="
                    draft.scenarios[scenario.code][
                      field.code
                    ].evidenceRefs.includes(candidate.evidenceId)
                  "
                  :disabled="busy"
                  :aria-label="
                    rangeLabel(scenario.code, field.code, '证据') +
                    ' ' +
                    candidate.sourceName
                  "
                  @change="
                    emit('toggleEvidence', {
                      scenario: scenario.code,
                      field: field.code,
                      evidenceId: candidate.evidenceId,
                    })
                  "
                />
                <span>
                  <b>{{ candidate.sourceName }}</b>
                  <small>{{ candidate.summary }}</small>
                </span>
              </label>
            </details>
          </div>
        </div>
      </details>
    </section>

    <label
      v-if="negativeContributionNeedsReason"
      class="unit-economics__negative-reason"
    >
      <span>仍要投入的理由</span>
      <textarea
        :value="negativeConservativeReason"
        :maxlength="NEGATIVE_CONSERVATIVE_REASON_MAX_LENGTH"
        :disabled="busy"
        rows="3"
        aria-label="仍要投入的理由"
        placeholder="说明为什么在保守情景贡献下限为负时仍值得投入"
        @input="
          emit(
            'updateNegativeReason',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>
  </fieldset>
</template>

<style scoped>
.unit-economics {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-2);
}
.unit-economics > legend {
  padding: 0 var(--space-1);
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 700;
}
.unit-economics__helper,
.unit-economics__warning,
.unit-economics__pending,
.unit-economics__contribution,
.unit-economics__evidence p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}
.unit-economics__warning {
  padding: var(--space-2);
  border-left: 3px solid var(--warn);
  background: var(--warn-bg);
  color: var(--warn);
}
.unit-economics__context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}
.unit-economics__context > div {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--line);
  background: var(--surface);
}
.unit-economics__context dt,
.unit-economics__currency > span,
.unit-economics__range-controls span,
.unit-economics__negative-reason > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}
.unit-economics__context dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-label);
}
.unit-economics__currency,
.unit-economics__negative-reason,
.unit-economics__range-controls label {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}
.unit-economics select,
.unit-economics input,
.unit-economics textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--text-label);
}
.unit-economics textarea {
  resize: vertical;
}
.unit-economics select:focus-visible,
.unit-economics input:focus-visible,
.unit-economics textarea:focus-visible,
.unit-economics summary:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}
.unit-economics__scenario {
  min-width: 0;
  border-top: 1px solid var(--line);
  padding-top: var(--space-3);
}
.unit-economics__scenario > header {
  display: grid;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}
.unit-economics__scenario h3 {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-meta);
}
.unit-economics__scenario-details {
  min-width: 0;
}
.unit-economics__scenario-details > summary {
  cursor: pointer;
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 700;
}
.unit-economics__scenario-details[open] > summary {
  margin-bottom: var(--space-2);
}
.unit-economics__scenario-details > summary:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}
.unit-economics__contribution b {
  display: block;
  margin-top: var(--space-1);
  color: var(--ink);
  font-size: var(--text-label);
}
.unit-economics__rows {
  display: grid;
  gap: var(--space-2);
}
.unit-economics__row {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--line);
  background: var(--surface);
}
.unit-economics__row > b {
  color: var(--ink);
  font-size: var(--text-label);
}
.unit-economics__range-controls {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
.unit-economics__basis {
  grid-column: 1 / -1;
}
.unit-economics__evidence {
  min-width: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.unit-economics__evidence summary {
  cursor: pointer;
  font-weight: 700;
}
.unit-economics__evidence > label {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  margin-top: var(--space-2);
}
.unit-economics__evidence input {
  width: 18px;
  height: 18px;
  padding: 0;
}
.unit-economics__evidence span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}
.unit-economics__evidence small {
  overflow-wrap: anywhere;
  color: var(--ink-soft);
}
.unit-economics__negative-reason {
  padding: var(--space-3);
  border-left: 3px solid var(--warn);
  background: var(--warn-bg);
}
@media (max-width: 340px) {
  .unit-economics__context,
  .unit-economics__range-controls {
    grid-template-columns: 1fr;
  }
  .unit-economics__basis {
    grid-column: auto;
  }
}
</style>
