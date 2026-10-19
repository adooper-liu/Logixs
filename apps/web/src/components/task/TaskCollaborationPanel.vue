<script setup lang="ts">
import type {
  CollaborationEvidenceRefV1,
  CollaborationSourceRefV1,
  TaskCollaborationMessageV1,
} from "@logix/contracts";
import { ListPlus, Reply, RotateCcw, Send, X } from "@lucide/vue";
import type {
  TaskCollaborationPanelModel,
  TaskCollaborationRetryTarget,
} from "../../composables/useTaskCollaboration";

const props = defineProps<{ state: TaskCollaborationPanelModel }>();
const emit = defineEmits<{
  submit: [];
  retry: [target: TaskCollaborationRetryTarget];
  loadMore: [];
}>();

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

function parentFor(
  message: TaskCollaborationMessageV1,
): TaskCollaborationMessageV1 | null {
  if (!message.parentMessageId) return null;
  return (
    props.state.messages.value.find(
      ({ messageId }) => messageId === message.parentMessageId,
    ) ?? null
  );
}

function evidenceLabel(reference: CollaborationEvidenceRefV1): string {
  return (
    props.state.evidenceOptions.value.find(({ ref }) => ref.id === reference.id)
      ?.label ?? "证据引用"
  );
}

function sourceLabel(reference: CollaborationSourceRefV1): string {
  const version = reference.version ? " / v" + reference.version : "";
  return reference.kind + " / " + reference.id + version;
}
</script>

<template>
  <article class="collaboration" data-task-collaboration-panel>
    <header class="collaboration__boundary">
      <div>
        <span>可见范围</span>
        <strong>{{ state.visibilityLabel.value || "正在确认" }}</strong>
      </div>
      <p>
        消息不改变任务状态、责任或期限；EvidenceRef
        只是当前有权读取的证据引用，不代表已核验。
      </p>
      <p>仅显示当前有权读取的证据引用；未显示不表示不存在。</p>
    </header>

    <p v-if="state.loading.value" class="collaboration__state" role="status">
      正在读取协作消息…
    </p>
    <div
      v-else-if="state.error.value"
      class="collaboration__state collaboration__state--error"
      role="alert"
    >
      <p>{{ state.error.value }}</p>
      <button
        v-if="state.retryable.value"
        type="button"
        data-testid="collaboration-retry"
        @click="emit('retry', 'thread')"
      >
        <RotateCcw :size="15" aria-hidden="true" />重试
      </button>
    </div>
    <template v-else>
      <ol v-if="state.messages.value.length" class="collaboration__messages">
        <li
          v-for="message in state.messages.value"
          :key="message.messageId"
          class="collaboration-message"
          :data-message-id="message.messageId"
        >
          <div class="collaboration-message__headline">
            <strong>{{ message.author.displayName }}</strong>
            <time :datetime="message.occurredAt">
              {{ formatTime(message.occurredAt) }}
            </time>
          </div>
          <blockquote
            v-if="message.parentMessageId"
            class="collaboration-message__parent"
            data-testid="parent-summary"
          >
            <template v-if="parentFor(message)">
              <strong>{{ parentFor(message)?.author.displayName }}</strong>
              <span>{{ parentFor(message)?.body }}</span>
            </template>
            <span v-else>回复较早消息</span>
          </blockquote>
          <p class="collaboration-message__body">{{ message.body }}</p>
          <p
            v-if="message.mentions.length"
            class="collaboration-message__mentions"
          >
            提醒：{{
              message.mentions.map(({ displayName }) => displayName).join("、")
            }}
          </p>
          <ul
            v-if="message.evidenceRefs.length"
            class="collaboration-message__evidence"
            data-testid="message-evidence"
          >
            <li v-for="reference in message.evidenceRefs" :key="reference.id">
              {{ evidenceLabel(reference) }}
            </li>
          </ul>
          <div class="collaboration-message__actions">
            <button
              v-if="state.canPost.value"
              type="button"
              :data-reply-id="message.messageId"
              @click="state.startReply(message)"
            >
              <Reply :size="14" aria-hidden="true" />回复
            </button>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>消息 ID</dt>
                  <dd>{{ message.messageId }}</dd>
                </div>
                <div>
                  <dt>Actor ref</dt>
                  <dd>{{ message.author.kind }} / {{ message.author.id }}</dd>
                </div>
                <div>
                  <dt>可见范围 code</dt>
                  <dd>{{ state.visibility.value }}</dd>
                </div>
                <div v-if="message.parentMessageId">
                  <dt>父消息 ID</dt>
                  <dd>{{ message.parentMessageId }}</dd>
                </div>
                <div v-if="message.mentions.length">
                  <dt>Mention refs</dt>
                  <dd>
                    {{ message.mentions.map(({ id }) => id).join("、") }}
                  </dd>
                </div>
                <div v-if="message.evidenceRefs.length">
                  <dt>EvidenceRef IDs</dt>
                  <dd>
                    {{ message.evidenceRefs.map(({ id }) => id).join("、") }}
                  </dd>
                </div>
                <div v-if="message.sourceRefs.length">
                  <dt>Source refs</dt>
                  <dd>{{ message.sourceRefs.map(sourceLabel).join("；") }}</dd>
                </div>
              </dl>
            </details>
          </div>
        </li>
      </ol>
      <p v-else class="collaboration__state" data-testid="collaboration-empty">
        还没有协作消息。
      </p>

      <button
        v-if="state.hasMore.value"
        type="button"
        class="collaboration__load-more"
        data-testid="collaboration-load-more"
        :disabled="state.loadingMore.value"
        @click="emit('loadMore')"
      >
        <ListPlus :size="15" aria-hidden="true" />
        {{ state.loadingMore.value ? "加载中…" : "更早消息" }}
      </button>

      <section v-if="state.canPost.value" class="collaboration-composer">
        <div
          v-if="state.replyTo.value"
          class="collaboration-composer__reply"
          data-testid="replying-to"
        >
          <span>
            回复 {{ state.replyTo.value.author.displayName }}：{{
              state.replyTo.value.body
            }}
          </span>
          <button
            type="button"
            title="取消回复"
            aria-label="取消回复"
            data-testid="cancel-reply"
            @click="state.cancelReply"
          >
            <X :size="15" aria-hidden="true" />
          </button>
        </div>
        <textarea
          :value="state.draft.value"
          rows="3"
          maxlength="4000"
          aria-label="协作消息"
          placeholder="写下需要共同处理的事实或问题"
          :disabled="state.sending.value"
          @input="state.setDraft(($event.target as HTMLTextAreaElement).value)"
        />
        <div class="collaboration-composer__options">
          <fieldset v-if="state.mentionOptions.value.length">
            <legend>提醒</legend>
            <label
              v-for="option in state.mentionOptions.value"
              :key="option.id"
            >
              <input
                type="checkbox"
                :value="option.id"
                :checked="state.selectedMentionIds.value.includes(option.id)"
                :data-mention-id="option.id"
                :disabled="state.sending.value"
                @change="
                  state.setMentionSelected(
                    option.id,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span>{{ option.displayName }}</span>
            </label>
          </fieldset>
          <fieldset v-if="state.evidenceOptions.value.length">
            <legend>证据引用</legend>
            <label
              v-for="option in state.evidenceOptions.value"
              :key="option.ref.id"
            >
              <input
                type="checkbox"
                :value="option.ref.id"
                :checked="
                  state.selectedEvidenceIds.value.includes(option.ref.id)
                "
                :data-evidence-id="option.ref.id"
                :disabled="state.sending.value"
                @change="
                  state.setEvidenceSelected(
                    option.ref.id,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span>{{ option.label }}</span>
            </label>
          </fieldset>
        </div>
        <div
          v-if="state.sendError.value"
          class="collaboration-composer__error"
          data-testid="send-error"
          role="alert"
        >
          <span>{{ state.sendError.value }}</span>
          <button
            v-if="state.pendingCommand.value"
            type="button"
            data-testid="collaboration-send-retry"
            :disabled="state.sending.value"
            @click="emit('retry', 'send')"
          >
            <RotateCcw :size="15" aria-hidden="true" />重试发送
          </button>
          <details v-if="state.pendingCommand.value">
            <summary>技术详情</summary>
            <p>{{ state.pendingCommand.value.idempotencyKey }}</p>
          </details>
        </div>
        <button
          type="button"
          class="collaboration-composer__send"
          data-testid="collaboration-send"
          :disabled="state.sending.value || !state.draft.value.trim()"
          @click="emit('submit')"
        >
          <Send :size="15" aria-hidden="true" />
          {{ state.sending.value ? "发送中…" : "发送" }}
        </button>
      </section>
      <p v-else class="collaboration__readonly">
        {{ state.postDisabledReason.value || "当前任务协作只读。" }}
      </p>
    </template>
  </article>
</template>

<style scoped>
.collaboration {
  min-width: 0;
  display: grid;
  align-content: start;
}

.collaboration__boundary,
.collaboration__state,
.collaboration__messages,
.collaboration__load-more,
.collaboration-composer,
.collaboration__readonly {
  min-width: 0;
  margin: 0;
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.collaboration__boundary {
  display: grid;
  gap: var(--space-1);
  background: var(--surface-2);
}

.collaboration__boundary div,
.collaboration-message__headline,
.collaboration-message__actions,
.collaboration-composer__reply,
.collaboration-composer__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.collaboration__boundary p,
.collaboration-message p,
.collaboration-message blockquote,
.collaboration__readonly,
.collaboration-composer__error span {
  margin: 0;
}

.collaboration__boundary p,
.collaboration-message__headline time,
.collaboration-message__mentions,
.collaboration__readonly {
  color: var(--muted);
  font-size: var(--text-micro);
}

.collaboration__messages {
  display: grid;
  gap: var(--space-3);
  list-style: none;
}

.collaboration-message {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px dashed var(--line);
}

.collaboration-message:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.collaboration-message__headline,
.collaboration-message__body {
  color: var(--ink);
  font-size: var(--text-label);
}

.collaboration-message__body,
.collaboration-message__parent,
.collaboration-message dd {
  overflow-wrap: anywhere;
}

.collaboration-message__parent {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-left: 3px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.collaboration-message__evidence {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.collaboration-message__evidence li {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.collaboration-message__actions {
  justify-content: flex-start;
  font-size: var(--text-micro);
}

.collaboration-message button,
.collaboration__state button,
.collaboration__load-more,
.collaboration-composer button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
}

.collaboration-message details summary {
  cursor: pointer;
}

.collaboration-message dl {
  display: grid;
  gap: var(--space-1);
}

.collaboration-message dl > div {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: var(--space-2);
}

.collaboration-message dt,
.collaboration-message dd {
  margin: 0;
}

.collaboration-message dt {
  color: var(--muted);
}

.collaboration__state--error,
.collaboration-composer__error {
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.collaboration__load-more {
  width: 100%;
  border-width: 0 0 1px;
  border-radius: 0;
}

.collaboration-composer {
  position: sticky;
  bottom: 0;
  display: grid;
  gap: var(--space-2);
  background: var(--surface);
}

.collaboration-composer__reply,
.collaboration-composer__error {
  padding: var(--space-2);
  font-size: var(--text-micro);
}

.collaboration-composer__reply span,
.collaboration-composer__error span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.collaboration-composer textarea {
  min-width: 0;
  width: 100%;
  resize: vertical;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  box-sizing: border-box;
}

.collaboration-composer__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.collaboration-composer fieldset {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: var(--space-2);
  border: 1px solid var(--line);
}

.collaboration-composer legend,
.collaboration-composer label {
  font-size: var(--text-micro);
}

.collaboration-composer label {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.collaboration-composer label span {
  overflow-wrap: anywhere;
}

.collaboration-composer__send {
  justify-self: end;
  min-width: 88px;
  border-color: var(--brand) !important;
  background: var(--brand) !important;
  color: white !important;
}

button:disabled,
textarea:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 520px) {
  .collaboration-composer__options {
    grid-template-columns: 1fr;
  }
}
</style>
