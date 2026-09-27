<script setup lang="ts">
import { FilePlus2, Save, X } from "@lucide/vue";
import { reactive, shallowRef } from "vue";
import type {
  ProductEvaluationEvidenceDraft,
  ProductEvaluationRequirement,
  ProductEvaluationRequirementCode,
  ProductEvaluationWithheld,
} from "../../data/productEvaluationRequirements";

const props = defineProps<{
  requirements: readonly ProductEvaluationRequirement[];
  withheld: readonly ProductEvaluationWithheld[];
  busy: boolean;
  saveEvidence: (draft: ProductEvaluationEvidenceDraft) => Promise<boolean>;
}>();

const openCode = shallowRef<ProductEvaluationRequirementCode | null>(null);
const draft = reactive<ProductEvaluationEvidenceDraft>(
  createDraft("competitive_supply_evidence"),
);

function createDraft(
  code: ProductEvaluationRequirementCode,
): ProductEvaluationEvidenceDraft {
  return { requirementCode: code, content: "", sourceName: "", sourceUrl: "" };
}

function open(code: ProductEvaluationRequirementCode): void {
  openCode.value = openCode.value === code ? null : code;
  Object.assign(draft, createDraft(code));
}

async function submit(): Promise<void> {
  if (props.busy || !draft.content.trim()) return;
  const saved = await props.saveEvidence({ ...draft });
  if (saved) {
    openCode.value = null;
    Object.assign(draft, createDraft(draft.requirementCode));
  }
}
</script>

<template>
  <!--
    只有已经存在适用要求时才出现：还没有商品范围、也还没进入评估的机会，
    此时每一项都还是"还判断不了"，整块面板只会是噪音，也和自己"评估阶段才会
    出现"的说明矛盾。withheld 说明只在旁边有真正可办的要求时才有对照意义。
  -->
  <section
    v-if="requirements.length"
    class="evaluation-requirements"
    aria-labelledby="evaluation-requirements-title"
  >
    <header>
      <small>评估阶段才会出现</small>
      <h3 id="evaluation-requirements-title">本机会适用的专业要求</h3>
      <p>
        这些要求由适用规则生成，并向你说明为什么适用。补进去的证据会进入本信号的证据链，
        在「四项评审要点」里可以直接引用 ——
        这里管"拿到依据"，评审要点管"写下结论"。
      </p>
    </header>

    <ul>
      <li v-for="requirement in requirements" :key="requirement.code">
        <div class="requirement-head">
          <div>
            <b>{{ requirement.label }}</b>
            <span class="rationale"
              >为什么适用：{{ requirement.rationale }}</span
            >
          </div>
          <button
            type="button"
            class="add-evidence"
            :aria-label="`为${requirement.label}添加证据`"
            :aria-expanded="openCode === requirement.code"
            @click="open(requirement.code)"
          >
            <FilePlus2 :size="15" aria-hidden="true" />添加证据
          </button>
        </div>

        <form
          v-if="openCode === requirement.code"
          class="evidence-form"
          @submit.prevent="submit"
        >
          <label>
            <span>来源名称 <small>可后补</small></span>
            <input
              v-model.trim="draft.sourceName"
              placeholder="例如：站点类目周报、评价导出或竞品调研"
            />
          </label>
          <label>
            <span>来源链接 <small>可后补</small></span>
            <input
              v-model.trim="draft.sourceUrl"
              type="url"
              placeholder="https://"
            />
          </label>
          <label class="content">
            <span>证据内容</span>
            <textarea
              v-model.trim="draft.content"
              :aria-label="requirement.fieldLabel"
              :placeholder="requirement.placeholder"
              rows="3"
              required
            />
          </label>
          <div class="form-actions">
            <button type="button" class="secondary" @click="openCode = null">
              <X :size="15" aria-hidden="true" />取消
            </button>
            <button type="submit" class="primary" :disabled="busy">
              <Save :size="15" aria-hidden="true" />{{
                busy ? "正在保存" : "登记证据"
              }}
            </button>
          </div>
        </form>
      </li>
    </ul>

    <div v-if="withheld.length" class="withheld-notice">
      <b>还有 {{ withheld.length }} 项暂时生成不了</b>
      <ul>
        <li v-for="item in withheld" :key="item.code">
          <span>{{ item.label }}</span>
          <small>{{ item.missing }}</small>
        </li>
      </ul>
      <p>这些不是“不适用”，而是缺少判断依据；补齐后会自动出现。</p>
    </div>
  </section>
</template>

<style scoped>
.evaluation-requirements {
  padding: var(--space-4);
}

.evaluation-requirements > header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.evaluation-requirements > header h3 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-meta);
}

.evaluation-requirements > header p {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.evaluation-requirements ul {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.evaluation-requirements li {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
}

/* 与"适用要求"区分：这是"还判断不了"，不是待办 —— 所以不给卡片样式。 */
.withheld-notice {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--info);
  background: var(--info-bg);
}

.withheld-notice > b {
  color: var(--ink);
  font-size: var(--text-label);
}

.withheld-notice ul {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.withheld-notice li {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  border: 0;
  background: transparent;
}

.withheld-notice li span {
  color: var(--ink);
  font-size: var(--text-label);
}

.withheld-notice li small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.withheld-notice > p {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}

.requirement-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
}

.requirement-head > div {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.requirement-head b {
  color: var(--ink);
  font-size: var(--text-label);
}

.rationale {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
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

.evidence-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2);
  padding: 0 var(--space-3) var(--space-3);
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

.evidence-form textarea {
  resize: vertical;
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
.form-actions button:focus-visible,
.evidence-form input:focus-visible,
.evidence-form textarea:focus-visible {
  outline: 0;
  border-color: var(--brand);
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
