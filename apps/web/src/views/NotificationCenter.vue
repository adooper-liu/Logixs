<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  listNotifications,
  openAssistantSession,
  postAssistantMessage,
  type AssistantMessage,
  type OpsNotificationItem,
} from "../api/notifications";
import PageHeader from "../components/ui/PageHeader.vue";

const items = ref<OpsNotificationItem[]>([]);
const loading = ref(true);
const error = ref("");
const sessionId = ref("");
const messages = ref<AssistantMessage[]>([]);
const draft = ref("");
const askingId = ref("");
const sending = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    items.value = await listNotifications();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "加载通知失败，请确认 API 已启动";
  } finally {
    loading.value = false;
  }
}

async function askAssistant(item: OpsNotificationItem): Promise<void> {
  askingId.value = item.id;
  error.value = "";
  try {
    const session = await openAssistantSession(item.id);
    sessionId.value = session.sessionId;
    messages.value = session.messages;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "打开助手失败";
  } finally {
    askingId.value = "";
  }
}

async function send(): Promise<void> {
  if (!sessionId.value || !draft.value.trim()) return;
  sending.value = true;
  error.value = "";
  try {
    const session = await postAssistantMessage(sessionId.value, draft.value);
    messages.value = session.messages;
    draft.value = "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "发送失败";
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <PageHeader
      title="问题通知"
      summary="出事时推送给调度/主管；可打开只读助手追问。"
    />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="loading">加载中…</p>
    <ul v-else class="list" aria-label="问题通知列表">
      <li v-for="item in items" :key="item.id" class="card">
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.body }}</p>
          <small
            >{{ item.problemCode }} · {{ item.severity }} ·
            {{ item.createdAt }}</small
          >
        </div>
        <button
          type="button"
          :disabled="askingId === item.id"
          @click="askAssistant(item)"
        >
          询问助手
        </button>
      </li>
      <li v-if="items.length === 0" class="empty">暂无问题通知</li>
    </ul>

    <section v-if="sessionId" class="assistant" aria-label="运营助手会话">
      <h2>只读助手</h2>
      <div class="thread">
        <article v-for="message in messages" :key="message.id" class="bubble">
          <strong>{{ message.role }}</strong>
          <pre>{{ message.body }}</pre>
        </article>
      </div>
      <form class="composer" @submit.prevent="send">
        <input
          v-model="draft"
          type="text"
          placeholder="继续追问（只读，不会改业务）"
        />
        <button type="submit" :disabled="sending || !draft.trim()">发送</button>
      </form>
    </section>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: 1.25rem;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.card,
.assistant {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
}
.card {
  grid-template-columns: 1fr auto;
  align-items: start;
}
.error {
  color: crimson;
}
.thread {
  display: grid;
  gap: 0.75rem;
  max-height: 24rem;
  overflow: auto;
}
.bubble pre {
  white-space: pre-wrap;
  margin: 0.25rem 0 0;
  font: inherit;
}
.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}
.empty {
  opacity: 0.7;
}
</style>
