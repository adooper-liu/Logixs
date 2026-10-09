<script setup lang="ts">
import type {
  ProductInitiativeEvidenceCandidateV1,
  ProductInitiativeReviewPointV1,
} from "@logix/contracts";
import { computed, reactive, shallowRef } from "vue";
import type {
  BusinessCaseDimensionView,
  ProductInitiativeEvidenceDraft,
  RiskAssessmentView,
} from "../../composables/useProductInitiativeDecision";
import {
  CONCLUSION_MAX_LENGTH,
  REVIEW_POINTS,
} from "../../composables/useProductInitiativeDecision";

const props = defineProps<{
  dimensions: readonly BusinessCaseDimensionView[];
  risks: readonly RiskAssessmentView[];
  legacyPoints: readonly ProductInitiativeReviewPointV1[];
  candidates: readonly ProductInitiativeEvidenceCandidateV1[];
  busy: boolean;
  addEvidence: (draft: ProductInitiativeEvidenceDraft) => Promise<boolean>;
  active?: boolean;
}>();

const emit = defineEmits<{
  updateDecision: [
    code: BusinessCaseDimensionView["code"],
    decision: BusinessCaseDimensionView["decision"],
  ];
  updateConclusion: [code: BusinessCaseDimensionView["code"], value: string];
  updateUnknown: [code: BusinessCaseDimensionView["code"], value: string];
  toggleEvidence: [code: BusinessCaseDimensionView["code"], evidenceId: string];
  updateRisk: [
    risk: RiskAssessmentView["riskCode"],
    patch: Partial<RiskAssessmentView>,
  ];
}>();

const selectedCode =
  shallowRef<BusinessCaseDimensionView["code"]>("customer_need");
const selected = computed(
  () =>
    props.dimensions.find((item) => item.code === selectedCode.value) ??
    props.dimensions[0],
);
const activeEditor = shallowRef<"business" | "risk">("business");
const selectedRiskCode =
  shallowRef<RiskAssessmentView["riskCode"]>("compliance");
const selectedRisk = computed(
  () =>
    props.risks.find((item) => item.riskCode === selectedRiskCode.value) ??
    props.risks[0],
);
const adding = shallowRef(false);
const registration = reactive<ProductInitiativeEvidenceDraft>({
  sourceName: "",
  sourceUrl: "",
  content: "",
});
const labels = new Map(REVIEW_POINTS.map((item) => [item.code, item.label]));
const decisions = [
  { code: "supports_investment", label: "支持投入" },
  { code: "validate_before_investment", label: "投入前需验证" },
  { code: "does_not_support", label: "不支持投入" },
] as const;

function decisionLabel(point: BusinessCaseDimensionView): string {
  return (
    decisions.find((item) => item.code === point.decision)?.label ?? "尚未判断"
  );
}

async function register(): Promise<void> {
  if (props.busy || !registration.content.trim()) return;
  if (!(await props.addEvidence({ ...registration }))) return;
  Object.assign(registration, { sourceName: "", sourceUrl: "", content: "" });
  adding.value = false;
}
</script>

<template>
  <div class="review-panel">
    <section class="business-case" aria-labelledby="business-case-title">
      <header>
        <h3 id="business-case-title">五面商业论证</h3>
        <small
          >逐面说明投入理由、证据与关键未知；单位经济在下方单独记录。</small
        >
      </header>
      <ul class="business-case__summary">
        <li v-for="point in dimensions" :key="point.code">
          <button
            type="button"
            :class="{ selected: selectedCode === point.code }"
            :aria-pressed="selectedCode === point.code"
            @click="
              selectedCode = point.code;
              activeEditor = 'business';
            "
          >
            <b>{{ point.label }}</b
            ><span>{{ decisionLabel(point) }}</span>
            <small v-if="point.criticalUnknown"
              >阻断未知：{{ point.criticalUnknown }}</small
            >
            <small v-else-if="point.missing">{{
              point.decision === "does_not_support"
                ? "当前不支持立项"
                : point.decision === "validate_before_investment"
                  ? "须先验证"
                  : "待补判断、结论或证据"
            }}</small>
          </button>
        </li>
      </ul>
      <details v-if="legacyPoints.length" class="business-case__legacy">
        <summary>历史四项评审（只读，不作为五面判断）</summary>
        <ul>
          <li v-for="point in legacyPoints" :key="point.code">
            <b>{{ labels.get(point.code) ?? point.code }}</b
            >：{{ point.conclusion || "未写结论" }} ·
            {{ point.evidenceRefs.length }} 项证据
          </li>
        </ul>
      </details>
    </section>
    <section class="risk-assessment" aria-labelledby="risk-assessment-title">
      <header>
        <h3 id="risk-assessment-title">五类适用风险</h3>
        <small>人工显式判断；尚不能判断不会被当作不适用。</small>
      </header>
      <ul class="risk-summary">
        <li v-for="risk in risks" :key="risk.riskCode">
          <button
            type="button"
            :class="{ selected: selectedRiskCode === risk.riskCode }"
            :aria-pressed="selectedRiskCode === risk.riskCode"
            @click="
              selectedRiskCode = risk.riskCode;
              activeEditor = 'risk';
            "
          >
            <b>{{ risk.label }}</b>
            <span v-if="risk.applicability === 'applicable'"
              >适用 ·
              {{
                risk.investmentDecision === "supports_investment"
                  ? "支持投入"
                  : risk.investmentDecision === "validate_before_investment"
                    ? "投入前需验证"
                    : risk.investmentDecision === "does_not_support"
                      ? "不支持投入"
                      : "尚未判断投资结论"
              }}</span
            >
            <span v-else-if="risk.applicability === 'not_applicable'"
              >不适用</span
            >
            <span v-else>尚不能判断</span>
            <small v-if="risk.missing">当前阻断投入决定</small>
          </button>
        </li>
      </ul>
    </section>
    <div class="active-editor" aria-live="polite">
      <div
        v-if="activeEditor === 'business' && selected"
        :key="selected.code"
        class="business-case__editor"
      >
        <h4>{{ selected.label }} · 当前编辑</h4>
        <fieldset>
          <legend>投资判断</legend>
          <label v-for="choice in decisions" :key="choice.code">
            <input
              type="radio"
              :name="'decision-' + selected.code"
              :value="choice.code"
              :checked="selected.decision === choice.code"
              @change="emit('updateDecision', selected.code, choice.code)"
            />{{ choice.label }}
          </label>
        </fieldset>
        <label class="business-case__field"
          >结论
          <textarea
            :value="selected.conclusion"
            :maxlength="CONCLUSION_MAX_LENGTH"
            rows="3"
            placeholder="说明本面的投入判断依据"
            @input="
              emit(
                'updateConclusion',
                selected.code,
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </label>
        <label
          v-if="selected.decision === 'validate_before_investment'"
          class="business-case__field"
          >使结论失效的关键未知
          <textarea
            :value="selected.criticalUnknown"
            maxlength="2000"
            rows="2"
            placeholder="说明投入前必须验证什么"
            @input="
              emit(
                'updateUnknown',
                selected.code,
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </label>
        <details>
          <summary>
            引用来源信号证据 · {{ selected.evidenceRefs.length }} 项
          </summary>
          <ul v-if="candidates.length" class="business-case__evidence">
            <li v-for="candidate in candidates" :key="candidate.evidenceId">
              <label
                ><input
                  type="checkbox"
                  :checked="
                    selected.evidenceRefs.includes(candidate.evidenceId)
                  "
                  @change="
                    emit('toggleEvidence', selected.code, candidate.evidenceId)
                  "
                /><b>{{ candidate.sourceName }}</b>
                {{ candidate.summary }}</label
              >
            </li>
          </ul>
          <p v-else>当前机会尚无可引用证据。</p>
          <p
            v-if="
              selected.evidenceRefs.some(
                (id) =>
                  !candidates.some((candidate) => candidate.evidenceId === id),
              )
            "
          >
            已有引用不在当前候选中；保存时服务端将校验。
          </p>
          <button type="button" :disabled="busy" @click="adding = !adding">
            登记新证据
          </button>
          <form
            v-if="adding"
            class="business-case__field"
            @submit.prevent="register"
          >
            <label>来源名称 <input v-model="registration.sourceName" /></label>
            <label>来源链接 <input v-model="registration.sourceUrl" /></label>
            <label
              >证据内容
              <textarea v-model="registration.content" required rows="3" />
            </label>
            <button type="submit" :disabled="busy">保存到来源信号</button>
          </form>
        </details>
      </div>
      <div
        v-else-if="activeEditor === 'risk' && selectedRisk"
        class="risk-editor"
      >
        <h4>{{ selectedRisk.label }} · 当前编辑</h4>
        <fieldset>
          <legend>适用性</legend>
          <label
            v-for="choice in [
              { value: 'applicable', label: '适用' },
              { value: 'not_applicable', label: '不适用' },
              { value: 'undetermined', label: '尚不能判断' },
            ]"
            :key="choice.value"
          >
            <input
              type="radio"
              :name="`risk-${selectedRisk.riskCode}`"
              :value="choice.value"
              :checked="selectedRisk.applicability === choice.value"
              @change="
                emit('updateRisk', selectedRisk.riskCode, {
                  applicability:
                    choice.value as RiskAssessmentView['applicability'],
                  applicabilityReason: null,
                  investmentDecision: null,
                  conclusion: null,
                  criticalUnknown:
                    choice.value === 'undetermined'
                      ? selectedRisk.criticalUnknown
                      : null,
                })
              "
            />{{ choice.label }}
          </label>
        </fieldset>
        <label v-if="selectedRisk.applicability === 'undetermined'"
          >关键未知<textarea
            :value="selectedRisk.criticalUnknown ?? ''"
            rows="2"
            @input="
              emit('updateRisk', selectedRisk.riskCode, {
                criticalUnknown: ($event.target as HTMLTextAreaElement).value,
              })
            "
          />
        </label>
        <label v-if="selectedRisk.applicability === 'not_applicable'"
          >不适用理由<textarea
            :value="selectedRisk.applicabilityReason ?? ''"
            rows="2"
            @input="
              emit('updateRisk', selectedRisk.riskCode, {
                applicabilityReason: ($event.target as HTMLTextAreaElement)
                  .value,
              })
            "
          />
        </label>
        <template v-if="selectedRisk.applicability === 'applicable'">
          <fieldset>
            <legend>投资判断</legend>
            <label
              v-for="choice in [
                { value: 'supports_investment', label: '支持投入' },
                { value: 'validate_before_investment', label: '投入前需验证' },
                { value: 'does_not_support', label: '不支持投入' },
              ]"
              :key="choice.value"
            >
              <input
                type="radio"
                :name="`risk-decision-${selectedRisk.riskCode}`"
                :value="choice.value"
                :checked="selectedRisk.investmentDecision === choice.value"
                @change="
                  emit('updateRisk', selectedRisk.riskCode, {
                    investmentDecision:
                      choice.value as RiskAssessmentView['investmentDecision'],
                    criticalUnknown:
                      choice.value === 'validate_before_investment'
                        ? selectedRisk.criticalUnknown
                        : null,
                  })
                "
              />{{ choice.label }}
            </label>
          </fieldset>
          <label
            >结论<textarea
              :value="selectedRisk.conclusion ?? ''"
              rows="2"
              @input="
                emit('updateRisk', selectedRisk.riskCode, {
                  conclusion: ($event.target as HTMLTextAreaElement).value,
                })
              "
            />
          </label>
          <label
            v-if="
              selectedRisk.investmentDecision === 'validate_before_investment'
            "
            >关键未知<textarea
              :value="selectedRisk.criticalUnknown ?? ''"
              rows="2"
              @input="
                emit('updateRisk', selectedRisk.riskCode, {
                  criticalUnknown: ($event.target as HTMLTextAreaElement).value,
                })
              "
            />
          </label>
          <details>
            <summary>
              引用来源信号证据 · {{ selectedRisk.evidenceRefs.length }} 项
            </summary>
            <label v-for="candidate in candidates" :key="candidate.evidenceId"
              ><input
                type="checkbox"
                :checked="
                  selectedRisk.evidenceRefs.includes(candidate.evidenceId)
                "
                @change="
                  emit('updateRisk', selectedRisk.riskCode, {
                    evidenceRefs: selectedRisk.evidenceRefs.includes(
                      candidate.evidenceId,
                    )
                      ? selectedRisk.evidenceRefs.filter(
                          (id) => id !== candidate.evidenceId,
                        )
                      : [...selectedRisk.evidenceRefs, candidate.evidenceId],
                  })
                "
              />{{ candidate.sourceName }} {{ candidate.summary }}</label
            >
          </details>
          <small
            >当前机会证据：{{
              selectedRisk.evidenceRefs.length
            }}
            项（证据选择沿用来源信号）</small
          >
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-panel {
  min-width: 0;
}
.business-case {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3) var(--space-4);
}
@media (max-width: 680px) {
  .business-case {
    padding: var(--space-3);
  }
}
.business-case header,
.risk-assessment header {
  display: grid;
  gap: var(--space-1);
}
.business-case header h3,
.risk-assessment header h3 {
  margin: 0;
}
.business-case header > small,
.risk-assessment header > small {
  display: none;
}
.business-case header small,
.business-case__summary small {
  color: var(--ink-soft);
}
.business-case__summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-1);
}
.business-case__summary button {
  width: 100%;
  min-height: var(--touch-target);
  text-align: left;
  display: grid;
  gap: var(--space-1);
  align-content: start;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.business-case__summary button.selected {
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}
.risk-assessment {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  padding: 0 var(--space-4) var(--space-3);
}
.risk-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-1);
  list-style: none;
  margin: 0;
  padding: 0;
}
.risk-summary > li {
  min-width: 0;
}
.risk-summary button {
  width: 100%;
  min-height: var(--touch-target);
  display: grid;
  gap: var(--space-1);
  align-content: start;
  text-align: left;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.risk-summary button.selected {
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}
.risk-summary button small {
  color: var(--risk);
}
.risk-editor {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.risk-editor fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
}
.active-editor {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4);
}
@media (max-width: 680px) {
  .active-editor {
    padding: var(--space-3);
  }
}
.risk-summary textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--surface);
  color: var(--ink);
}
.business-case__summary small {
  overflow-wrap: anywhere;
}
.business-case__editor {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.business-case__editor fieldset {
  border: 1px solid var(--line-strong);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.business-case__field,
.business-case__field label {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}
.active-editor textarea,
.business-case__field input {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--surface);
  color: var(--ink);
}
.business-case__evidence {
  max-height: 16rem;
  overflow: auto;
  padding-inline-start: var(--space-4);
}
.business-case__evidence li {
  overflow-wrap: anywhere;
  margin-block: var(--space-2);
}
.business-case__legacy {
  overflow-wrap: anywhere;
}
.business-case button:focus-visible,
.business-case input:focus-visible,
.business-case textarea:focus-visible,
.business-case summary:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
@media (max-width: 680px) {
  .business-case__summary,
  .risk-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .risk-assessment {
    padding: 0 var(--space-3) var(--space-3);
  }
}
</style>
