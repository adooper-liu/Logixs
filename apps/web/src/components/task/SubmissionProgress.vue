<script setup lang="ts">
import { computed } from "vue";
import type { SubmissionStage, SubmissionView } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{
  submission: SubmissionView;
  actionLabel?: string;
}>();
const emit = defineEmits<{ retry: [] }>();

const order: SubmissionStage[] = ["received", "accepted", "committed"];
const stageIndex = computed(() => order.indexOf(props.submission.stage));
const operationTitle = computed(
  () => props.actionLabel ?? props.submission.actionCode ?? "本次操作",
);
const helpText = computed(() => {
  const references = [
    props.submission.actionCode
      ? `动作码 ${props.submission.actionCode}`
      : undefined,
    props.submission.clientOperationId
      ? `操作编号 ${props.submission.clientOperationId}`
      : undefined,
    props.submission.traceId ? `追踪 ${props.submission.traceId}` : undefined,
    props.submission.resultRef
      ? `结果 ${props.submission.resultRef}`
      : undefined,
  ].filter(Boolean);
  return [
    "用于核对本次动作是否被服务器收到、业务规则接受并写入正式记录。只有结果落账才计入业务事实。",
    references.join(" · "),
  ]
    .filter(Boolean)
    .join(" ");
});
const stateOf = (index: number) => {
  if (props.submission.stage === "rejected") {
    if (index === 0 && props.submission.receivedAt) return "done";
    return index === 1 ? "rejected" : "idle";
  }
  if (props.submission.stage === "sending")
    return index === 0 ? "active" : "idle";
  return index < stageIndex.value
    ? "done"
    : index === stageIndex.value
      ? "active"
      : "idle";
};
</script>

<template>
  <section
    class="submission"
    :class="{ 'submission--idle': submission.stage === 'idle' }"
    aria-label="本次操作记录"
    aria-live="polite"
  >
    <header class="submission-header">
      <div class="heading">
        <h3>操作记录</h3>
        <InfoTooltip label="了解操作记录" :text="helpText" />
      </div>
      <span v-if="submission.stage === 'idle'" class="idle-label">未启动</span>
      <div v-if="submission.clientOperationId" class="operation mono">
        <b class="action-label">{{ operationTitle }}</b>
      </div>
    </header>

    <ol class="stages">
      <li :class="stateOf(0)">
        <i>1</i>
        <div class="stage-copy">
          <b>服务器已收到</b
          ><span v-if="submission.receivedAt">{{ submission.receivedAt }}</span>
        </div>
      </li>
      <li :class="stateOf(1)">
        <i>2</i>
        <div class="stage-copy">
          <b>业务已接受</b
          ><span v-if="submission.acceptedAt">{{ submission.acceptedAt }}</span>
        </div>
      </li>
      <li :class="stateOf(2)">
        <i>3</i>
        <div class="stage-copy">
          <b>结果已落账</b
          ><span v-if="submission.committedAt">{{
            submission.committedAt
          }}</span>
        </div>
      </li>
    </ol>

    <div v-if="submission.stage !== 'idle'" class="message-row">
      <p class="message" :class="{ error: submission.errorCode }">
        {{ submission.message }}
      </p>
      <button
        v-if="submission.canRetry"
        class="retry"
        type="button"
        @click="emit('retry')"
      >
        使用原编号重试
      </button>
    </div>
    <div
      v-if="
        submission.errorCode && (submission.traceId || submission.resultRef)
      "
      class="refs mono"
    >
      <span v-if="submission.traceId">追踪 {{ submission.traceId }}</span>
      <span v-if="submission.resultRef">结果 {{ submission.resultRef }}</span>
      <span v-if="submission.errorCode">错误 {{ submission.errorCode }}</span>
    </div>
  </section>
</template>

<style scoped>
.submission {
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  padding: 10px 12px;
}

.submission--idle {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding-block: 8px;
}

.submission--idle .submission-header {
  margin-bottom: 0;
}

.submission-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.heading {
  display: flex;
  align-items: center;
  gap: 2px;
}

.operation {
  color: var(--muted);
  font-size: 11px;
}

.operation .action-label {
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 11px;
}

.operation {
  display: flex;
  flex-direction: column;
}

.heading h3 {
  margin: 0;
  font-size: 13px;
}

.idle-label {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}

.operation {
  overflow-wrap: anywhere;
  text-align: right;
}

.stages {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stages li {
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  grid-template-rows: 22px auto;
  row-gap: 4px;
  min-width: 0;
  padding-right: 12px;
}

.stages li:not(:last-child)::after {
  content: "";
  position: absolute;
  z-index: 0;
  top: 10px;
  left: 22px;
  right: -11px;
  height: 2px;
  background: var(--line);
}

.stages i {
  z-index: var(--z-content-raised);
  grid-column: 1;
  grid-row: 1;
  width: 22px;
  height: 22px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--muted);
  font-size: 11px;
  font-style: normal;
}

.stage-copy {
  grid-column: 1 / -1;
  grid-row: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stages b {
  font-size: 11px;
}

.stages span {
  color: var(--muted);
  font-size: 10px;
}

.stages .done i,
.stages .active i {
  border-color: var(--ok);
  background: var(--ok);
  color: var(--on-status);
}

.stages .active b {
  color: var(--brand);
}

.stages .rejected i {
  border-color: var(--risk);
  background: var(--risk);
  color: var(--on-risk);
}

.message-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 9px;
}

.message {
  flex: 1;
  margin: 14px 0 0;
  padding: 6px 8px;
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: 11px;
}

.message-row .message {
  margin: 0;
}

.message.error {
  background: var(--risk-bg);
  color: var(--risk);
}

.retry {
  flex: none;
  padding: 6px 10px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: var(--brand);
  font-weight: 700;
  cursor: pointer;
}

.refs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 720px) {
  .submission--idle {
    display: block;
  }

  .submission--idle .submission-header {
    margin-bottom: 7px;
  }

  .stages li {
    padding-right: 4px;
  }

  .stages li:not(:last-child)::after {
    right: -10px;
  }

  .stages i {
    width: 20px;
    height: 20px;
  }

  .stages b {
    font-size: 10px;
  }

  .stages span {
    display: none;
  }

  .message-row {
    flex-direction: column;
  }
}
</style>
