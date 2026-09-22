<script setup lang="ts">
import type { AssistantSessionResponse } from "@logix/contracts";
import { LockKeyhole, Send, X } from "@lucide/vue";
import { shallowRef, watch, type DeepReadonly } from "vue";

const props = defineProps<{
  session: DeepReadonly<AssistantSessionResponse>;
  sending: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  send: [body: string];
  close: [];
}>();

const draft = shallowRef("");

watch(
  () => props.session.sessionId,
  () => {
    draft.value = "";
  },
);

function submit(): void {
  const body = draft.value.trim();
  if (!body || props.sending) return;
  emit("send", body);
  draft.value = "";
}
</script>

<template>
  <section class="assistant-panel" aria-label="运营助手会话">
    <header class="assistant-header">
      <div>
        <h2>运营助手</h2>
        <p class="read-only-label">
          <LockKeyhole :size="14" aria-hidden="true" />
          只读
        </p>
      </div>
      <button
        type="button"
        class="icon-button"
        aria-label="关闭助手"
        title="关闭助手"
        @click="emit('close')"
      >
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <section v-if="session.objectContext" class="object-context">
      <div class="summary-grid">
        <div>
          <span>货柜</span>
          <strong>{{
            session.objectContext.summary.containerNumber ?? "未绑定箱号"
          }}</strong>
        </div>
        <div>
          <span>备货单</span>
          <strong>{{ session.objectContext.summary.orderNumber }}</strong>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{{ session.objectContext.summary.currentStatus }}</strong>
        </div>
        <div>
          <span>当前节点</span>
          <strong>{{
            session.objectContext.summary.currentNodeCode ?? "尚无节点"
          }}</strong>
        </div>
      </div>

      <div class="next-actions">
        <p>{{ session.objectContext.actionSummary }}</p>
        <ul v-if="session.objectContext.allowedActions.length">
          <li
            v-for="action in session.objectContext.allowedActions"
            :key="action.workOrderId"
          >
            <router-link :to="action.targetPath">
              {{ action.explanation }}
            </router-link>
            <small>
              {{ action.assigneeId ? `负责人 ${action.assigneeId}` : "待领取" }}
              {{ action.dueAt ? ` · 截止 ${action.dueAt}` : "" }}
            </small>
          </li>
        </ul>
        <p class="policy">
          {{ session.objectContext.readOnlyPolicy.explanation }}
        </p>
      </div>
    </section>

    <div class="thread" aria-live="polite">
      <article
        v-for="message in session.messages"
        :key="message.id"
        class="message"
        :class="`message--${message.role}`"
      >
        <strong>{{ message.role === "user" ? "我" : "助手" }}</strong>
        <pre>{{ message.body }}</pre>
      </article>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <form class="composer" @submit.prevent="submit">
      <input
        v-model="draft"
        type="text"
        maxlength="4000"
        placeholder="询问当前情况"
        aria-label="给运营助手的问题"
      />
      <button
        type="submit"
        class="icon-button icon-button--primary"
        :disabled="sending || !draft.trim()"
        aria-label="发送问题"
        title="发送问题"
      >
        <Send :size="18" aria-hidden="true" />
      </button>
    </form>
  </section>
</template>

<style scoped>
.assistant-panel {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--line);
  background: var(--surface);
}

.assistant-header,
.assistant-header > div,
.read-only-label,
.composer,
.next-actions li {
  display: flex;
  align-items: center;
}

.assistant-header {
  justify-content: space-between;
  gap: var(--space-3);
}

.assistant-header > div {
  gap: var(--space-3);
}

.assistant-header h2,
.assistant-header p,
.next-actions p {
  margin: 0;
}

.assistant-header h2 {
  font-size: var(--text-title);
}

.read-only-label {
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-label);
}

.icon-button {
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line);
  background: var(--surface);
  color: inherit;
}

.icon-button--primary {
  color: white;
  background: var(--brand);
  border-color: var(--brand);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-1);
  background: var(--line);
  border: 1px solid var(--line);
}

.summary-grid > div {
  min-width: 0;
  padding: var(--space-3);
  display: grid;
  gap: var(--space-1);
  background: var(--surface);
}

.summary-grid span,
.next-actions small {
  color: var(--muted);
  font-size: var(--text-label);
}

.summary-grid strong {
  overflow-wrap: anywhere;
}

.next-actions {
  margin-top: var(--space-3);
  display: grid;
  gap: var(--space-2);
}

.next-actions ul {
  margin: 0;
  padding-left: var(--space-5);
  display: grid;
  gap: var(--space-2);
}

.next-actions li {
  justify-content: space-between;
  gap: var(--space-3);
}

.next-actions a {
  color: var(--brand);
}

.policy {
  color: var(--muted);
  font-size: var(--text-meta);
}

.thread {
  display: grid;
  gap: var(--space-3);
  max-height: 320px;
  overflow: auto;
}

.message {
  max-width: 82%;
  padding: var(--space-3);
  border-left: 3px solid var(--line);
  background: color-mix(in srgb, var(--surface) 92%, var(--line));
}

.message--user {
  margin-left: auto;
  border-left: 0;
  border-right: 3px solid var(--brand);
}

.message pre {
  margin: var(--space-1) 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
}

.composer {
  gap: var(--space-2);
}

.composer input {
  min-width: 0;
  flex: 1;
}

.error {
  margin: 0;
  color: var(--risk);
}

@media (max-width: 720px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .next-actions li {
    align-items: flex-start;
    flex-direction: column;
  }

  .message {
    max-width: 100%;
  }
}
</style>
