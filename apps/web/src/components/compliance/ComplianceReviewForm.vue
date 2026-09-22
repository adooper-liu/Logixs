<script setup lang="ts">
import { computed, reactive, type DeepReadonly } from "vue";
import type {
  AssessCargoReadyComplianceInput,
  CargoReadyComplianceAssessment,
  DecideCargoReadyComplianceInput,
} from "../../api/cargoReadyCompliance";

type AssessmentSubmission = Omit<
  AssessCargoReadyComplianceInput,
  "expectedAssessmentVersion" | "idempotencyKey"
>;
type DecisionSubmission = Omit<
  DecideCargoReadyComplianceInput,
  "assessmentId" | "expectedDecisionVersion" | "idempotencyKey"
>;

const props = defineProps<{
  assessment: DeepReadonly<CargoReadyComplianceAssessment> | null;
  submitting: boolean;
}>();

const emit = defineEmits<{
  assess: [input: AssessmentSubmission];
  decide: [input: DecisionSubmission];
}>();

const assessmentForm = reactive({
  jurisdictionCountryCode: "",
  assessmentDate: "",
  evidenceRefs: "",
  reasonCode: "",
});
const decisionForm = reactive({
  decisionCode: "evidence_required" as DecisionSubmission["decisionCode"],
  conditionRefs: "",
  evidenceRefs: "",
  reasonCode: "",
});

const needsConditions = computed(
  () => decisionForm.decisionCode === "approved_with_conditions",
);
const canDecide = computed(() => Boolean(props.assessment));

function submitAssessment(): void {
  emit("assess", {
    jurisdictionCountryCode: assessmentForm.jurisdictionCountryCode
      .trim()
      .toUpperCase(),
    assessmentDate: assessmentForm.assessmentDate,
    evidenceRefs: references(assessmentForm.evidenceRefs),
    reasonCode: assessmentForm.reasonCode.trim(),
  });
}

function submitDecision(): void {
  if (!props.assessment) return;
  emit("decide", {
    decisionCode: decisionForm.decisionCode,
    conditionRefs: needsConditions.value
      ? references(decisionForm.conditionRefs)
      : [],
    evidenceRefs: references(decisionForm.evidenceRefs),
    reasonCode: decisionForm.reasonCode.trim(),
  });
}

function references(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}
</script>

<template>
  <section class="review-form" aria-labelledby="review-form-title">
    <header class="form-heading">
      <p class="eyebrow">评审操作</p>
      <h2 id="review-form-title">建立事实快照，再作决定</h2>
    </header>

    <form
      class="form-section"
      data-testid="assessment-form"
      @submit.prevent="submitAssessment"
    >
      <h3>重新评审</h3>
      <div class="field-grid">
        <label>
          司法辖区国家码
          <input
            v-model="assessmentForm.jurisdictionCountryCode"
            name="jurisdictionCountryCode"
            maxlength="2"
            pattern="[A-Za-z]{2}"
            placeholder="US"
            required
          />
        </label>
        <label>
          业务日期
          <input
            v-model="assessmentForm.assessmentDate"
            name="assessmentDate"
            type="date"
            required
          />
        </label>
      </div>
      <label>
        评审证据引用
        <textarea
          v-model="assessmentForm.evidenceRefs"
          name="assessmentEvidenceRefs"
          rows="2"
          placeholder="每行一个证据 ID"
          required
        />
      </label>
      <label>
        原因码
        <input
          v-model="assessmentForm.reasonCode"
          name="assessmentReasonCode"
          maxlength="64"
          placeholder="scheduled_review"
          required
        />
      </label>
      <button type="submit" :disabled="submitting">运行评审</button>
    </form>

    <form
      class="form-section"
      data-testid="decision-form"
      @submit.prevent="submitDecision"
    >
      <h3>提交决定</h3>
      <label>
        决定
        <select v-model="decisionForm.decisionCode" name="decisionCode">
          <option value="approved">放行</option>
          <option value="approved_with_conditions">有条件放行</option>
          <option value="blocked">阻断</option>
          <option value="evidence_required">待补证</option>
        </select>
      </label>
      <label v-if="needsConditions">
        条件引用
        <textarea
          v-model="decisionForm.conditionRefs"
          name="conditionRefs"
          rows="2"
          placeholder="每行一个条件或整改义务引用"
          required
        />
      </label>
      <label>
        决定证据引用
        <textarea
          v-model="decisionForm.evidenceRefs"
          name="decisionEvidenceRefs"
          rows="2"
          placeholder="每行一个证据 ID"
          required
        />
      </label>
      <label>
        原因码
        <input
          v-model="decisionForm.reasonCode"
          name="decisionReasonCode"
          maxlength="64"
          placeholder="review_completed"
          required
        />
      </label>
      <button type="submit" :disabled="submitting || !canDecide">
        提交决定
      </button>
    </form>
  </section>
</template>

<style scoped>
.review-form {
  min-width: 0;
  border: 1px solid var(--line, #d7dde5);
  background: var(--surface, #ffffff);
}
.form-heading,
.form-section {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--line, #d7dde5);
}
.form-section:last-child {
  border-bottom: 0;
}
.eyebrow,
.form-heading h2,
.form-section h3 {
  margin: 0;
}
.eyebrow {
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
.form-heading h2 {
  margin-top: var(--space-1);
  font-size: var(--text-page);
  letter-spacing: 0;
}
.form-section {
  display: grid;
  gap: var(--space-3);
}
.form-section h3 {
  font-size: var(--text-body);
  letter-spacing: 0;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.form-section label {
  display: grid;
  gap: var(--space-1);
  color: var(--app-text-secondary, #667085);
  font-size: var(--text-label);
}
.form-section input,
.form-section select,
.form-section textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line, #d7dde5);
  border-radius: 4px;
  background: var(--surface, #ffffff);
  color: inherit;
  font: inherit;
}
.form-section textarea {
  resize: vertical;
}
.form-section button {
  justify-self: start;
  min-height: 36px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--app-brand, #155eef);
  border-radius: 4px;
  background: var(--app-brand, #155eef);
  color: #ffffff;
  font-weight: 650;
  cursor: pointer;
}
.form-section button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
