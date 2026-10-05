<script setup lang="ts">
import type { ProductInitiativeEvidenceCandidateV1 } from "@logix/contracts";
import { ChevronDown, ChevronRight, FilePlus2, Save, X } from "@lucide/vue";
import { computed, reactive, shallowRef, watch } from "vue";
import type {
  ProductInitiativeEvidenceDraft,
  ProductInitiativeReviewPointView,
} from "../../composables/useProductInitiativeDecision";
import { CONCLUSION_MAX_LENGTH } from "../../composables/useProductInitiativeDecision";
import {
  composeReviewConclusion,
  extractReviewSupplement,
  matchReviewOptionId,
  reviewPointOptions,
} from "../../data/productInitiativeReviewOptions";

const props = defineProps<{
  points: readonly ProductInitiativeReviewPointView[];
  candidates: readonly ProductInitiativeEvidenceCandidateV1[];
  busy: boolean;
  addEvidence: (draft: ProductInitiativeEvidenceDraft) => Promise<boolean>;
}>();

const emit = defineEmits<{
  toggleEvidence: [
    code: ProductInitiativeReviewPointView["code"],
    evidenceId: string,
  ];
  updateConclusion: [
    code: ProductInitiativeReviewPointView["code"],
    value: string,
  ];
}>();

/** 展开证据选择的要点；同一时刻只开一条，避免四份同样的候选列表堆在一起。 */
const pickerCode = shallowRef<ProductInitiativeReviewPointView["code"] | null>(
  null,
);
/** 展开登记表单的要点。 */
const formCode = shallowRef<ProductInitiativeReviewPointView["code"] | null>(
  null,
);
const draft = reactive<ProductInitiativeEvidenceDraft>({
  sourceName: "",
  sourceUrl: "",
  content: "",
});
const missingCount = computed(
  () => props.points.filter((point) => point.missing).length,
);
const expandedCode = shallowRef<
  ProductInitiativeReviewPointView["code"] | null
>(null);

watch(
  () => props.points,
  (points) => {
    if (
      expandedCode.value &&
      points.some((point) => point.code === expandedCode.value)
    ) {
      return;
    }
    expandedCode.value =
      points.find((point) => point.missing)?.code ?? points[0]?.code ?? null;
  },
  { immediate: true },
);

function byId(evidenceId: string): ProductInitiativeEvidenceCandidateV1 | null {
  return (
    props.candidates.find((item) => item.evidenceId === evidenceId) ?? null
  );
}

function referenced(
  point: ProductInitiativeReviewPointView,
): ProductInitiativeEvidenceCandidateV1[] {
  return point.evidenceRefs
    .map((evidenceId) => byId(evidenceId))
    .filter((item): item is ProductInitiativeEvidenceCandidateV1 =>
      Boolean(item),
    );
}

/** 引用了但已不在候选里的证据：如实说明，不静默丢掉这条引用。 */
function staleRefs(point: ProductInitiativeReviewPointView): string[] {
  return point.evidenceRefs.filter((evidenceId) => !byId(evidenceId));
}

function isExpanded(point: ProductInitiativeReviewPointView): boolean {
  return expandedCode.value === point.code;
}

function togglePoint(point: ProductInitiativeReviewPointView): void {
  expandedCode.value = isExpanded(point) ? null : point.code;
}

function selectedOptionLabel(
  point: ProductInitiativeReviewPointView,
): string | null {
  const optionId = matchReviewOptionId(point.code, point.conclusion);
  return (
    reviewPointOptions(point.code).find((option) => option.id === optionId)
      ?.label ?? null
  );
}

function togglePicker(code: ProductInitiativeReviewPointView["code"]): void {
  pickerCode.value = pickerCode.value === code ? null : code;
}

function openForm(code: ProductInitiativeReviewPointView["code"]): void {
  formCode.value = formCode.value === code ? null : code;
  draft.sourceName = "";
  draft.sourceUrl = "";
  draft.content = "";
}

async function submit(): Promise<void> {
  if (props.busy || !draft.content.trim()) return;
  // 登记失败时保留已填内容：让人能改一处再交，而不是从头再写。
  const saved = await props.addEvidence({ ...draft });
  if (!saved) return;
  draft.sourceName = "";
  draft.sourceUrl = "";
  draft.content = "";
  formCode.value = null;
}

function selectOption(
  point: ProductInitiativeReviewPointView,
  optionId: string,
): void {
  const option = reviewPointOptions(point.code).find(
    (item) => item.id === optionId,
  );
  if (!option) return;
  const supplement = extractReviewSupplement(point.code, point.conclusion);
  emit(
    "updateConclusion",
    point.code,
    composeReviewConclusion(option.sentence, supplement),
  );
}

function updateSupplement(
  point: ProductInitiativeReviewPointView,
  supplement: string,
): void {
  const optionId = matchReviewOptionId(point.code, point.conclusion);
  const option = optionId
    ? reviewPointOptions(point.code).find((item) => item.id === optionId)
    : null;
  if (option) {
    emit(
      "updateConclusion",
      point.code,
      composeReviewConclusion(option.sentence, supplement),
    );
    return;
  }
  // 旧自由文本：补充区即全文，不硬塞档位短句。
  emit(
    "updateConclusion",
    point.code,
    supplement.slice(0, CONCLUSION_MAX_LENGTH),
  );
}
</script>

<template>
  <section
    class="product-initiative-review"
    aria-labelledby="product-initiative-review-title"
  >
    <header>
      <small>立项依据</small>
      <h3 id="product-initiative-review-title">评审要点</h3>
      <p>
        <template v-if="missingCount">
          优先处理 <b>{{ missingCount }}</b> 项未齐的要点。
        </template>
        <template v-else> 四项门槛要点均已齐备。 </template>
      </p>
    </header>

    <ul>
      <li
        v-for="point in points"
        :key="point.code"
        class="review-point"
        :data-code="point.code"
      >
        <div class="review-point__head">
          <button
            type="button"
            class="review-point__toggle"
            :aria-expanded="isExpanded(point)"
            @click="togglePoint(point)"
          >
            <b>{{ point.label }}</b>
            <span v-if="point.missing" class="review-point__gap">
              {{ point.evidenceRefs.length ? "缺结论" : "缺证据" }}
            </span>
            <span
              v-else-if="staleRefs(point).length"
              class="review-point__stale"
            >
              引用失效
            </span>
            <span v-else class="review-point__ok">已齐</span>
            <small v-if="selectedOptionLabel(point)">
              {{ selectedOptionLabel(point) }}
            </small>
            <ChevronDown :size="16" :class="{ open: isExpanded(point) }" />
          </button>
          <button
            v-if="isExpanded(point)"
            type="button"
            class="add-evidence"
            :aria-label="`${point.label}添加证据`"
            :aria-expanded="formCode === point.code"
            @click="openForm(point.code)"
          >
            <FilePlus2 :size="15" aria-hidden="true" />添加证据
          </button>
        </div>

        <div v-show="isExpanded(point)" class="review-point__content">
          <div class="review-point__facts">
            <small>证据</small>
            <ul v-if="referenced(point).length" class="referenced">
              <li v-for="item in referenced(point)" :key="item.evidenceId">
                <b>{{ item.sourceName }}</b>
                <span>{{ item.summary }}</span>
                <small>{{ item.contentRef }}</small>
              </li>
            </ul>
            <p v-else-if="!staleRefs(point).length" class="empty">
              暂无已引用证据
            </p>
            <p v-if="staleRefs(point).length" class="empty">
              {{ staleRefs(point).length }} 条引用失效
            </p>

            <button
              v-if="candidates.length"
              type="button"
              class="picker-toggle"
              :aria-expanded="pickerCode === point.code"
              @click="togglePicker(point.code)"
            >
              <component
                :is="pickerCode === point.code ? ChevronDown : ChevronRight"
                :size="14"
                aria-hidden="true"
              />
              引用证据 · {{ candidates.length }}
            </button>
            <p v-else class="empty">暂无可引用证据</p>

            <ul v-if="pickerCode === point.code" class="candidates">
              <li v-for="item in candidates" :key="item.evidenceId">
                <label>
                  <input
                    type="checkbox"
                    :value="item.evidenceId"
                    :checked="point.evidenceRefs.includes(item.evidenceId)"
                    @change="
                      emit('toggleEvidence', point.code, item.evidenceId)
                    "
                  />
                  <span
                    ><b>{{ item.sourceName }}</b
                    >{{ item.summary }}</span
                  >
                </label>
              </li>
            </ul>
          </div>

          <fieldset class="review-point__conclusion">
            <legend>判断</legend>
            <div
              class="option-row"
              role="radiogroup"
              :aria-label="`${point.label}判断强度`"
            >
              <label
                v-for="option in reviewPointOptions(point.code)"
                :key="option.id"
                class="option"
                :class="{
                  selected:
                    matchReviewOptionId(point.code, point.conclusion) ===
                    option.id,
                }"
              >
                <input
                  type="radio"
                  :name="`review-option-${point.code}`"
                  :value="option.id"
                  :checked="
                    matchReviewOptionId(point.code, point.conclusion) ===
                    option.id
                  "
                  @change="selectOption(point, option.id)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
            <label class="supplement">
              <span>备注</span>
              <textarea
                :value="extractReviewSupplement(point.code, point.conclusion)"
                :aria-label="`${point.label}结论`"
                :maxlength="CONCLUSION_MAX_LENGTH"
                rows="1"
                placeholder="可选备注"
                @input="
                  updateSupplement(
                    point,
                    ($event.target as HTMLTextAreaElement).value,
                  )
                "
              />
            </label>
          </fieldset>

          <form
            v-if="formCode === point.code"
            class="evidence-form"
            @submit.prevent="submit"
          >
            <label>
              <span>来源名称 <small>可后补</small></span>
              <input
                v-model.trim="draft.sourceName"
                :aria-label="`${point.label}证据来源名称`"
                placeholder="例如：站点类目周报、评价导出或竞品调研"
              />
            </label>
            <label>
              <span>来源链接 <small>可后补</small></span>
              <input
                v-model.trim="draft.sourceUrl"
                type="url"
                :aria-label="`${point.label}证据来源链接`"
                placeholder="https://"
              />
            </label>
            <label class="content">
              <span>证据内容</span>
              <textarea
                v-model.trim="draft.content"
                :aria-label="`${point.label}证据内容`"
                rows="3"
                required
              />
            </label>
            <div class="form-actions">
              <button type="button" class="secondary" @click="formCode = null">
                <X :size="15" aria-hidden="true" />取消
              </button>
              <button type="submit" class="primary" :disabled="busy">
                <Save :size="15" aria-hidden="true" />{{
                  busy ? "正在登记" : "登记证据"
                }}
              </button>
            </div>
          </form>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.no-requirement {
  display: block;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}

.product-initiative-review {
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.product-initiative-review > header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.product-initiative-review > header h3 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-meta);
}

.product-initiative-review > header p {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.product-initiative-review > header b {
  color: var(--warn);
}

.product-initiative-review > ul {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.review-point {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
}

.review-point__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
}

.review-point__toggle {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.review-point__toggle b {
  color: var(--ink);
  font-size: var(--text-label);
}

.review-point__toggle small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.review-point__toggle svg {
  flex: none;
  margin-left: auto;
  color: var(--muted);
  transition: transform 0.15s ease;
}

.review-point__toggle svg.open {
  transform: rotate(180deg);
}

.review-point__toggle:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.review-point__content {
  display: grid;
  gap: var(--space-2);
  padding: 0 var(--space-3) var(--space-3);
}

.review-point__gap,
.review-point__ok,
.review-point__stale {
  font-size: var(--text-micro);
  font-weight: 700;
}

.review-point__gap,
.review-point__stale {
  color: var(--warn);
}

.review-point__ok {
  color: var(--ok);
}

.add-evidence {
  flex: none;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--brand-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-micro);
  font-weight: 700;
}

.review-point__facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-1) var(--space-2);
  align-items: start;
}

.review-point__facts > small {
  align-self: center;
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}

.referenced {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-point__facts > :not(small) {
  grid-column: 2;
}

.referenced li {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-left: 3px solid var(--info);
  background: var(--info-bg);
}

.referenced li b {
  color: var(--ink);
  font-size: var(--text-micro);
}

.referenced li span {
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.referenced li small {
  color: var(--muted);
  font-size: var(--text-micro);
  overflow-wrap: anywhere;
}

.empty {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-micro);
}

.picker-toggle {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--brand-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-micro);
  font-weight: 700;
}

.candidates {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-1) 0 0;
  padding: 0;
  list-style: none;
}

.candidates label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  cursor: pointer;
}

.candidates label span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.candidates label b {
  color: var(--ink);
}

.review-point__conclusion {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.review-point__conclusion > legend {
  padding: 0;
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 600;
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.option {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 34px;
  padding: 0 var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-label);
  cursor: pointer;
}

.option.selected {
  border-color: var(--brand-strong);
  background: var(--surface-2);
}

.option input {
  margin: 0;
}

.supplement {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: center;
}

.supplement > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}

.review-point__conclusion textarea,
.evidence-form input,
.evidence-form textarea {
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--text-label);
  box-sizing: border-box;
}

.review-point__conclusion textarea,
.evidence-form textarea {
  resize: vertical;
}

.review-point__conclusion textarea:focus-visible,
.evidence-form input:focus-visible,
.evidence-form textarea:focus-visible {
  outline: 0;
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

.evidence-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2);
  padding: 0;
}

.evidence-form label {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.evidence-form label span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}

.evidence-form label small {
  color: var(--muted);
  font-weight: 400;
}

.evidence-form .content,
.form-actions {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.form-actions button {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  font-weight: 700;
}

.form-actions .secondary {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink-soft);
}

.form-actions .primary {
  border: 1px solid var(--brand);
  background: var(--brand);
  color: var(--on-brand);
}

.form-actions .primary:disabled {
  cursor: wait;
  opacity: 0.65;
}

.add-evidence:focus-visible,
.picker-toggle:focus-visible,
.form-actions button:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

@media (max-width: 680px) {
  .evidence-form {
    grid-template-columns: 1fr;
  }

  .evidence-form .content,
  .form-actions {
    grid-column: auto;
  }
}
</style>
