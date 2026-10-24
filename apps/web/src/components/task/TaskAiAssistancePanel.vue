<script setup lang="ts">
import {
  Check,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from "@lucide/vue";
import type { NodeTaskState } from "@logix/contracts";
import { computed, ref, watch } from "vue";
import type {
  TaskAiAssistancePanelModel,
  TaskAiAssistanceRetryTarget,
} from "../../composables/useTaskAiAssistance";
import { uiCopy } from "../../data/uiCopyCatalog";

const props = defineProps<{ state: TaskAiAssistancePanelModel }>();
const emit = defineEmits<{
  confirm: [];
  reject: [reason?: string];
  retry: [target: TaskAiAssistanceRetryTarget];
  refresh: [];
}>();

const rejectReason = ref("");
const sourceLabels = {
  rule: "规则建议",
  model: "模型建议",
  fallback: "确定性降级建议",
} as const;
const candidate = computed(() => props.state.candidate.value);
const candidateContextSignature = computed(() => {
  const value = candidate.value;
  if (!value) return null;
  return [
    value.context.subjectRef.kind,
    value.context.subjectRef.id,
    value.context.workRef.kind,
    value.context.workRef.id,
    value.workOrderId,
  ].join("|");
});
const lastCandidateContextSignature = ref<string | null>(null);
watch(
  candidateContextSignature,
  (signature) => {
    if (!signature) return;
    if (
      lastCandidateContextSignature.value &&
      lastCandidateContextSignature.value !== signature
    ) {
      rejectReason.value = "";
    }
    lastCandidateContextSignature.value = signature;
  },
  { immediate: true },
);
const decision = computed(() => props.state.decision.value);
const receipt = computed(() => props.state.receipt.value);
const contextRecoveryError = computed(() =>
  props.state.primaryRetryTarget.value === "context"
    ? props.state.confirmError.value || props.state.rejectError.value
    : "",
);
const canRetryConfirmation = computed(
  () =>
    props.state.retryable.value &&
    props.state.pendingConfirmCommand.value !== null,
);
const canRefreshDecisionError = computed(
  () =>
    props.state.retryable.value ||
    props.state.primaryRetryTarget.value === "context" ||
    (candidate.value !== null && candidate.value.status !== "proposed"),
);

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function taskStateLabel(state: NodeTaskState): string {
  if (state === "pending") return uiCopy.taskStatus.available;
  if (state in uiCopy.taskStatus) {
    return uiCopy.taskStatus[state as keyof typeof uiCopy.taskStatus];
  }
  return "请重新读取任务";
}

function emitReject(): void {
  const reason = rejectReason.value.trim();
  emit("reject", reason || undefined);
}
</script>

<template>
  <article class="task-ai" data-task-ai-assistance-panel>
    <header class="task-ai__header">
      <div>
        <p class="task-ai__eyebrow">AI 辅助 · 人员确认执行</p>
        <h3>领取建议</h3>
      </div>
      <span v-if="state.facts.fixtureLabel" class="task-ai__fixture">
        {{ state.facts.fixtureLabel }}
      </span>
    </header>

    <p v-if="state.loading.value" class="task-ai__notice" role="status">
      正在核对当前任务并生成建议…
    </p>

    <div
      v-else-if="!candidate && state.error.value"
      class="task-ai__notice task-ai__notice--error"
      role="alert"
    >
      <p>{{ state.error.value }}</p>
      <button
        v-if="state.primaryRetryTarget.value === 'generate'"
        type="button"
        data-testid="ai-retry-generate"
        @click="emit('retry', 'generate')"
      >
        <RotateCcw :size="15" aria-hidden="true" />重试生成
      </button>
      <button
        v-else-if="state.primaryRetryTarget.value === 'context'"
        type="button"
        data-testid="ai-retry-context"
        @click="emit('retry', 'context')"
      >
        <RefreshCw :size="15" aria-hidden="true" />重新读取任务
      </button>
    </div>

    <div
      v-if="!candidate && !state.error.value && contextRecoveryError"
      class="task-ai__notice task-ai__notice--error"
      role="alert"
    >
      <p>{{ contextRecoveryError }}</p>
      <button
        type="button"
        data-testid="ai-retry-context"
        @click="emit('retry', 'context')"
      >
        <RefreshCw :size="15" aria-hidden="true" />重新读取任务
      </button>
    </div>

    <ol v-if="candidate" class="task-ai__spine">
      <li data-ai-spine-step="task">
        <span class="task-ai__marker">1</span>
        <section aria-labelledby="ai-current-task">
          <p class="task-ai__step-label">当前任务与动作</p>
          <h4 id="ai-current-task">
            {{ state.facts.objectLabel }} · {{ state.facts.taskLabel }}
          </h4>
          <dl class="task-ai__facts">
            <div>
              <dt>当前动作</dt>
              <dd>{{ state.facts.actionLabel }}</dd>
            </div>
            <div>
              <dt>当前责任</dt>
              <dd>{{ state.facts.responsibilityLabel }}</dd>
            </div>
            <div>
              <dt>期限</dt>
              <dd>{{ state.facts.dueLabel }}</dd>
            </div>
          </dl>
          <p class="task-ai__reference">
            当前领取工单 <code>{{ candidate.workOrderId }}</code>
          </p>
        </section>
      </li>

      <li data-ai-spine-step="source">
        <span class="task-ai__marker">2</span>
        <section aria-labelledby="ai-suggestion-source">
          <p class="task-ai__step-label">建议来源与依据</p>
          <div class="task-ai__source-line">
            <strong id="ai-suggestion-source">{{ candidate.title }}</strong>
            <span>{{ sourceLabels[candidate.source.kind] }}</span>
          </div>
          <p>{{ candidate.rationale }}</p>
          <p class="task-ai__reference">
            {{ candidate.source.capabilityId }} / v{{
              candidate.source.capabilityVersion
            }}
          </p>
          <time :datetime="candidate.source.generatedAt">
            生成于 {{ formatTime(candidate.source.generatedAt) }}
          </time>
        </section>
      </li>

      <li data-ai-spine-step="impact">
        <span class="task-ai__marker">3</span>
        <section aria-labelledby="ai-impact">
          <p class="task-ai__step-label">影响与风险</p>
          <h4 id="ai-impact">
            {{
              candidate.status === "expired" ? "建议已失效" : "确认的业务影响"
            }}
          </h4>
          <p v-if="candidate.status !== 'expired'">{{ candidate.impact }}</p>
          <p class="task-ai__risk">
            风险等级：{{
              candidate.riskLevel === "low" ? "低" : candidate.riskLevel
            }}
          </p>
          <p v-if="candidate.status === 'proposed'" class="task-ai__boundary">
            未采信，不改变任务状态
          </p>
          <template v-else-if="candidate.status === 'expired'">
            <p class="task-ai__risk">当前建议不可执行</p>
            <p class="task-ai__boundary">未改变任务状态</p>
          </template>
        </section>
      </li>

      <li data-ai-spine-step="decision">
        <span class="task-ai__marker">4</span>
        <section aria-labelledby="ai-decision">
          <p class="task-ai__step-label">人员决定</p>
          <h4 id="ai-decision">
            {{
              candidate.status === "rejected"
                ? "已拒绝建议"
                : candidate.status === "accepted"
                  ? "已确认领取"
                  : candidate.status === "expired"
                    ? "建议已失效"
                    : "等待你的决定"
            }}
          </h4>
          <template v-if="candidate.status === 'proposed'">
            <p class="task-ai__verification">
              <ShieldCheck :size="16" aria-hidden="true" />
              确认后服务端会重新验证当前身份、task.execute、tenant/object
              scope、当前业务状态和并发版本。
            </p>
            <label class="task-ai__reason">
              <span>拒绝原因（可选）</span>
              <input
                v-model="rejectReason"
                aria-label="拒绝原因（可选）"
                maxlength="500"
                :disabled="state.confirming.value || state.rejecting.value"
              />
            </label>
            <div class="task-ai__actions">
              <button
                type="button"
                class="task-ai__primary"
                data-testid="ai-confirm"
                :disabled="state.confirming.value || state.rejecting.value"
                @click="emit('confirm')"
              >
                <Check :size="16" aria-hidden="true" />
                {{ state.confirming.value ? "确认中…" : "确认领取" }}
              </button>
              <button
                type="button"
                data-testid="ai-reject"
                :disabled="state.confirming.value || state.rejecting.value"
                @click="emitReject"
              >
                <X :size="16" aria-hidden="true" />
                {{ state.rejecting.value ? "保存中…" : "拒绝建议" }}
              </button>
            </div>
          </template>
          <div
            v-else-if="candidate.status === 'expired'"
            class="task-ai__notice"
          >
            <p>当前建议不可执行，请重新读取当前任务后生成新建议。</p>
            <button
              type="button"
              data-testid="ai-retry-context"
              @click="emit('retry', 'context')"
            >
              <RefreshCw :size="15" aria-hidden="true" />重新读取任务
            </button>
          </div>
          <template v-else-if="decision">
            <p>
              {{
                decision.decision === "rejected"
                  ? decision.reason || "未填写拒绝原因"
                  : "人员已明确确认该建议。"
              }}
            </p>
            <time :datetime="decision.decidedAt">
              决定于 {{ formatTime(decision.decidedAt) }}
            </time>
          </template>

          <div
            v-if="state.confirmError.value"
            class="task-ai__inline-error"
            role="alert"
          >
            <p>{{ state.confirmError.value }}</p>
            <button
              v-if="canRetryConfirmation"
              type="button"
              data-testid="ai-retry-confirm"
              @click="emit('retry', 'confirm')"
            >
              <RotateCcw :size="15" aria-hidden="true" />恢复确认结果
            </button>
            <button
              v-else-if="canRefreshDecisionError"
              type="button"
              @click="emit('refresh')"
            >
              <RefreshCw :size="15" aria-hidden="true" />重新读取建议
            </button>
          </div>
          <div
            v-if="state.rejectError.value"
            class="task-ai__inline-error"
            role="alert"
          >
            <p>{{ state.rejectError.value }}</p>
            <button
              v-if="canRefreshDecisionError"
              type="button"
              @click="emit('refresh')"
            >
              <RefreshCw :size="15" aria-hidden="true" />重新读取建议
            </button>
          </div>
        </section>
      </li>

      <li v-if="receipt" data-ai-spine-step="receipt">
        <span class="task-ai__marker task-ai__marker--receipt">5</span>
        <section aria-labelledby="ai-receipt">
          <p class="task-ai__step-label">正式执行回执</p>
          <h4 id="ai-receipt">
            {{ receipt.applied ? "已应用" : "未应用" }}
          </h4>
          <dl class="task-ai__facts">
            <div>
              <dt>当前负责人</dt>
              <dd>{{ receipt.assigneeId ? "你" : "未分配" }}</dd>
            </div>
            <div>
              <dt>任务状态</dt>
              <dd>{{ taskStateLabel(receipt.taskState) }}</dd>
            </div>
            <div>
              <dt>操作状态</dt>
              <dd>
                {{ uiCopy.reception[receipt.receptionState] }} /
                {{ uiCopy.decision[receipt.businessDecisionState] }} /
                {{ uiCopy.commit[receipt.commitState] }}
              </dd>
            </div>
          </dl>
          <p v-if="receipt.rejectionReasonCode" class="task-ai__risk">
            拒绝原因：{{ receipt.rejectionReasonCode }}
          </p>
          <p v-if="state.idempotencyReplay.value">同一操作的幂等恢复回执</p>
        </section>
      </li>
    </ol>

    <details v-if="candidate" class="task-ai__details">
      <summary>
        <ChevronRight :size="15" aria-hidden="true" />建议详情 / 执行详情
      </summary>
      <dl>
        <div>
          <dt>Candidate ID</dt>
          <dd>{{ candidate.candidateId }}</dd>
        </div>
        <div>
          <dt>Candidate hash</dt>
          <dd>{{ candidate.candidateHash }}</dd>
        </div>
        <div>
          <dt>能力版本</dt>
          <dd>
            {{ candidate.source.capabilityId }} / v{{
              candidate.source.capabilityVersion
            }}
          </dd>
        </div>
        <div>
          <dt>Schema 版本</dt>
          <dd>{{ candidate.source.schemaVersion }}</dd>
        </div>
        <div v-if="candidate.source.promptVersion">
          <dt>Prompt 版本</dt>
          <dd>{{ candidate.source.promptVersion }}</dd>
        </div>
        <div v-if="candidate.source.modelId">
          <dt>模型版本</dt>
          <dd>{{ candidate.source.modelId }}</dd>
        </div>
        <div>
          <dt>输入快照</dt>
          <dd>{{ candidate.source.inputSnapshotHash }}</dd>
        </div>
        <div v-if="candidate.source.inputRefs.length">
          <dt>输入引用</dt>
          <dd>
            {{
              candidate.source.inputRefs
                .map((reference) => `${reference.kind}/${reference.id}`)
                .join("；")
            }}
          </dd>
        </div>
        <div v-if="decision">
          <dt>Decision ID</dt>
          <dd>{{ decision.decisionId }}</dd>
        </div>
        <div v-if="decision?.traceId">
          <dt>Trace ID</dt>
          <dd>{{ decision.traceId }}</dd>
        </div>
        <div v-if="receipt">
          <dt>ClientOperation ID</dt>
          <dd>{{ receipt.clientOperationId }}</dd>
        </div>
        <template v-if="receipt">
          <div>
            <dt>Assignee ID</dt>
            <dd>{{ receipt.assigneeId || "null" }}</dd>
          </div>
          <div>
            <dt>Task state</dt>
            <dd>{{ receipt.taskState }}</dd>
          </div>
          <div>
            <dt>WorkOrder state</dt>
            <dd>{{ receipt.workOrderState }}</dd>
          </div>
          <div>
            <dt>Assignment state</dt>
            <dd>{{ receipt.assignmentState }}</dd>
          </div>
          <div>
            <dt>Reception state</dt>
            <dd>{{ receipt.receptionState }}</dd>
          </div>
          <div>
            <dt>Decision state</dt>
            <dd>{{ receipt.businessDecisionState }}</dd>
          </div>
          <div>
            <dt>Commit state</dt>
            <dd>{{ receipt.commitState }}</dd>
          </div>
        </template>
        <div v-if="decision?.resultRefs.length">
          <dt>结果引用</dt>
          <dd>
            {{
              decision.resultRefs
                .map((reference) => `${reference.kind}/${reference.id}`)
                .join("；")
            }}
          </dd>
        </div>
        <div v-if="state.idempotencyReplay.value !== null">
          <dt>幂等重放</dt>
          <dd>{{ state.idempotencyReplay.value ? "是" : "否" }}</dd>
        </div>
      </dl>
    </details>
  </article>
</template>

<style scoped>
.task-ai {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
  padding: var(--space-3);
  color: var(--ink);
}

.task-ai__header,
.task-ai__source-line,
.task-ai__actions {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.task-ai__header h3,
.task-ai__header p,
.task-ai__spine h4,
.task-ai__spine p,
.task-ai__notice p,
.task-ai__inline-error p {
  margin: 0;
}

.task-ai__header h3 {
  font-size: var(--text-title);
}

.task-ai__eyebrow,
.task-ai__step-label {
  color: var(--muted);
  font-size: var(--text-meta);
}

.task-ai__fixture,
.task-ai__source-line span {
  flex: 0 0 auto;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--muted);
  font-size: var(--text-meta);
}

.task-ai__notice,
.task-ai__inline-error {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid var(--line-strong);
  background: var(--surface-2);
}

.task-ai__notice--error,
.task-ai__inline-error {
  border-left-color: var(--risk);
}

.task-ai__spine {
  min-width: 0;
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-ai__spine > li {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: var(--space-2);
  padding-bottom: var(--space-4);
}

.task-ai__spine > li:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 26px;
  bottom: 0;
  left: 13px;
  width: 1px;
  background: var(--line-strong);
}

.task-ai__marker {
  position: relative;
  z-index: 1;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  font-size: var(--text-meta);
}

.task-ai__marker--receipt {
  border-color: var(--ok);
  color: var(--ok);
}

.task-ai__spine section {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-1);
}

.task-ai__spine h4,
.task-ai__source-line strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-body);
}

.task-ai__reference {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: var(--text-meta);
}

.task-ai__spine time,
.task-ai__boundary,
.task-ai__risk {
  color: var(--muted);
  font-size: var(--text-meta);
}

.task-ai__facts,
.task-ai__details dl {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.task-ai__facts > div,
.task-ai__details dl > div {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(5rem, 0.42fr) minmax(0, 1fr);
  gap: var(--space-2);
}

.task-ai dt,
.task-ai dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}

.task-ai dt {
  color: var(--muted);
}

.task-ai__verification {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-2);
  border-left: 3px solid var(--accent);
  background: var(--surface-2);
  font-size: var(--text-meta);
}

.task-ai__verification svg {
  flex: 0 0 auto;
}

.task-ai__reason {
  display: grid;
  gap: var(--space-1);
  font-size: var(--text-meta);
}

.task-ai__reason input {
  min-width: 0;
  min-height: 36px;
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  padding: 0 var(--space-2);
}

.task-ai button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}

.task-ai button:disabled {
  color: var(--muted);
  cursor: wait;
}

.task-ai__actions button {
  flex: 1 1 0;
}

.task-ai__actions .task-ai__primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-contrast);
}

.task-ai__details {
  min-width: 0;
  border-top: 1px solid var(--line);
  padding-top: var(--space-2);
}

.task-ai__details summary {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  cursor: pointer;
  color: var(--muted);
  font-size: var(--text-label);
}

.task-ai__details[open] summary svg {
  transform: rotate(90deg);
}

.task-ai__details dl {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--surface-2);
}

@media (max-width: 1100px) and (min-width: 681px) {
  .task-ai {
    gap: var(--space-2);
    padding: var(--space-2);
  }

  .task-ai__spine > li {
    padding-bottom: var(--space-2);
  }

  .task-ai__spine section {
    gap: 0;
  }

  .task-ai__facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-1);
  }

  .task-ai__facts > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}

@media (max-width: 420px) {
  .task-ai {
    padding: var(--space-2);
  }

  .task-ai__header,
  .task-ai__source-line {
    align-items: flex-start;
    flex-direction: column;
  }

  .task-ai__actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
