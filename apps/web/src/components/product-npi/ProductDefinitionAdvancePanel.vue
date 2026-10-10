<script setup lang="ts">
import { CheckCircle2, CircleSlash, Factory, Rocket, Save } from "@lucide/vue";
import type { ProductDefinitionV1 } from "@logix/contracts";
import { computed, ref } from "vue";
import {
  NPI_STAGES,
  stageLabel,
  type NpiStageCode,
} from "../../composables/useProductDefinition";

// 草稿由上层持有：本组件只透传输入，不直接改 props（`vue/no-mutating-props`）。
const props = defineProps<{
  definition: ProductDefinitionV1 | null;
  specification: string;
  complianceAssumptions: readonly string[];
  conclusion: string;
  stage: NpiStageCode;
  nextStage: NpiStageCode | null;
  currentStageConcluded: boolean;
  pendingFields: readonly { code: string; hint: string }[];
  released: boolean;
  busy: boolean;
  save: (advanceStage: boolean) => Promise<boolean>;
  release: (
    decision: "release" | "defer" | "terminate",
    reason?: string,
  ) => Promise<boolean>;
}>();

const emit = defineEmits<{
  updateSpecification: [value: string];
  updateComplianceAssumptions: [value: string[]];
  updateConclusion: [value: string];
}>();

const reason = ref("");
const reasonDecision = ref<"defer" | "terminate" | null>(null);
const newAssumption = ref("");

const stageHint = computed(
  () => NPI_STAGES.find((item) => item.code === props.stage)?.hint ?? "",
);
const outcomes = computed(() => props.definition?.stageOutcomes ?? []);
const releaseState = computed(
  () => props.definition?.releaseState ?? "in_progress",
);

function addAssumption(): void {
  const value = newAssumption.value.trim();
  if (!value) return;
  emit("updateComplianceAssumptions", [...props.complianceAssumptions, value]);
  newAssumption.value = "";
}

function removeAssumption(index: number): void {
  emit(
    "updateComplianceAssumptions",
    props.complianceAssumptions.filter((_value, at) => at !== index),
  );
}

async function submitReason(): Promise<void> {
  if (!reasonDecision.value) return;
  const decided = await props.release(reasonDecision.value, reason.value);
  if (decided) {
    reasonDecision.value = null;
    reason.value = "";
  }
}
</script>

<template>
  <section class="definition-panel">
    <header>
      <small>现在做什么</small>
      <h2>推进产品定义</h2>
      <p class="stage">
        <Factory :size="15" />
        当前阶段：<b>{{ stageLabel(stage) }}</b>
        <span v-if="stageHint" class="hint">—— {{ stageHint }}</span>
      </p>
    </header>

    <template v-if="released">
      <div class="closed">
        <CheckCircle2 v-if="releaseState === 'released'" :size="22" />
        <CircleSlash v-else :size="22" />
        <b v-if="releaseState === 'released'">已发布，交给主数据侧建档</b>
        <b v-else-if="releaseState === 'deferred'">已暂缓</b>
        <b v-else>已终止</b>
        <p v-if="releaseState === 'released'">
          规格、阶段与各段结论已按发布时点冻结成不可变交接；之后不再接受推进。
        </p>
        <p v-else>这一票已关闭，不再接受推进。</p>
      </div>
    </template>

    <template v-else>
      <div class="block">
        <label class="field">
          <span>产品规格</span>
          <textarea
            :value="specification"
            aria-label="产品规格"
            rows="3"
            placeholder="做到什么程度算这个产品，例如：40HC 折叠宠物推车，承重 25kg，收纳后厚度 ≤18cm"
            @input="
              emit(
                'updateSpecification',
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </label>
      </div>

      <div class="block">
        <span class="label">合规假设</span>
        <p class="note">
          你<em>假设</em>这个产品要过哪些认证。这里是假设，不是结论 ——
          结论归合规域。
        </p>
        <ul v-if="complianceAssumptions.length" class="assumptions">
          <li v-for="(item, index) in complianceAssumptions" :key="item">
            <span>{{ item }}</span>
            <button type="button" @click="removeAssumption(index)">移除</button>
          </li>
        </ul>
        <div class="add-row">
          <input
            v-model="newAssumption"
            aria-label="新增合规假设"
            placeholder="例如：CE、UN38.3"
            @keyup.enter="addAssumption"
          />
          <button type="button" @click="addAssumption">添加</button>
        </div>
      </div>

      <div class="block">
        <label class="field">
          <span>本阶段结论（{{ stageLabel(stage) }}）</span>
          <textarea
            :value="conclusion"
            aria-label="本阶段结论"
            rows="3"
            placeholder="本阶段做到了什么、依据是什么。已登记过就不用重写。"
            @input="
              emit(
                'updateConclusion',
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </label>
        <p v-if="currentStageConcluded" class="note note--done">
          本阶段已登记过结论；再写一次会追加一条新的。
        </p>
        <p v-else class="note">
          本阶段还没登记结论 —— 没登记就前进不了下一段。
        </p>
      </div>

      <div v-if="outcomes.length" class="block">
        <span class="label">已登记的阶段结论</span>
        <ul class="outcomes">
          <li v-for="outcome in outcomes" :key="outcome.stage">
            <b>{{ stageLabel(outcome.stage) }}</b>
            <span>{{ outcome.conclusion }}</span>
            <small
              >{{ outcome.recordedBy }} ·
              {{ new Date(outcome.recordedAt).toLocaleString("zh-CN") }}</small
            >
          </li>
        </ul>
      </div>

      <div v-if="pendingFields.length" class="block">
        <b>{{ stage === "mp" ? "还差这些才能发布" : "还差这些才能前进" }}</b>
        <ul class="pending">
          <li v-for="field in pendingFields" :key="field.code">
            <span>{{ field.code }}</span>
            <small>{{ field.hint }}</small>
          </li>
        </ul>
      </div>

      <div class="actions">
        <button type="button" :disabled="busy" @click="save(false)">
          <Save :size="15" />{{ busy ? "正在保存" : "保存" }}
        </button>
        <button
          type="button"
          class="primary"
          :disabled="busy"
          @click="save(true)"
        >
          <Rocket :size="15" />
          {{ nextStage ? `保存并前进到${stageLabel(nextStage)}` : "保存" }}
        </button>
      </div>

      <p v-if="stage !== 'mp'" class="release-gate-note">
        发布动作将在 MP 阶段且现有门槛满足后提供。
      </p>

      <div class="release">
        <span class="label">发布决定</span>
        <p class="note">
          发布会把当前规格、阶段与各段结论冻结成不可变交接，交给主数据侧建档。
        </p>
        <div class="actions">
          <button
            v-if="stage === 'mp'"
            type="button"
            :disabled="busy"
            @click="release('release')"
          >
            发布
          </button>
          <button
            type="button"
            :disabled="busy"
            @click="reasonDecision = 'defer'"
          >
            暂缓
          </button>
          <button
            type="button"
            :disabled="busy"
            @click="reasonDecision = 'terminate'"
          >
            终止
          </button>
        </div>
        <div v-if="reasonDecision" class="reason">
          <label class="field">
            <span>{{
              reasonDecision === "defer" ? "暂缓原因" : "终止原因"
            }}</span>
            <textarea
              v-model="reason"
              :aria-label="reasonDecision === 'defer' ? '暂缓原因' : '终止原因'"
              rows="2"
              placeholder="不写为什么，事后无从复盘 —— 服务端也会拒绝"
            />
          </label>
          <div class="actions">
            <button type="button" @click="reasonDecision = null">取消</button>
            <button type="button" :disabled="busy" @click="submitReason">
              确认{{ reasonDecision === "defer" ? "暂缓" : "终止" }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}
.stage {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  font-size: var(--text-meta);
}
.hint {
  color: var(--ink-soft);
}
.block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.field {
  display: grid;
  gap: var(--space-1);
}
.field > span,
.label {
  font-size: var(--text-meta);
  font-weight: 600;
}
textarea,
input {
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: inherit;
  font: inherit;
}
.note {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}
.note--done {
  color: var(--ok);
}
.assumptions,
.outcomes,
.pending {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.assumptions li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
}
.add-row {
  display: flex;
  gap: var(--space-2);
}
.add-row input {
  flex: 1;
}
.actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
button.primary {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.outcomes li {
  display: grid;
  gap: var(--space-1);
}
.outcomes small,
.pending small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.pending li {
  display: grid;
  gap: var(--space-1);
}
.closed {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
}
.closed p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}
.release {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-3);
}
.release .actions {
  border-bottom: none;
  padding: 0;
}
.reason {
  display: grid;
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-3);
}
</style>
