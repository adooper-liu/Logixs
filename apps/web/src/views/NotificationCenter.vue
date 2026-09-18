<script setup lang="ts">
import { ExternalLink } from "@lucide/vue";
import { onMounted, shallowRef } from "vue";
import { useRouter } from "vue-router";
import {
  listNotifications,
  resolveNotificationTarget,
  type OpsNotificationItem,
} from "../api/notifications";
import OpsAssistantPanel from "../components/assistant/OpsAssistantPanel.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useOpsAssistant } from "../composables/useOpsAssistant";

const items = shallowRef<OpsNotificationItem[]>([]);
const router = useRouter();
const loading = shallowRef(true);
const error = shallowRef("");
const askingId = shallowRef("");
const openingId = shallowRef("");
const {
  session: assistantSession,
  opening: assistantOpening,
  sending: assistantSending,
  error: assistantError,
  open: openAssistant,
  send: sendAssistantMessage,
  close: closeAssistant,
} = useOpsAssistant();

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
  await openAssistant({ notificationId: item.id });
  askingId.value = "";
}

async function openObject(item: OpsNotificationItem): Promise<void> {
  openingId.value = item.id;
  error.value = "";
  try {
    const target = await resolveNotificationTarget(item.id);
    await router.push(target.targetPath);
  } catch (cause) {
    error.value =
      cause instanceof Error && cause.message !== "RESOURCE_NOT_FOUND"
        ? cause.message
        : "关联对象不存在或不可访问";
  } finally {
    openingId.value = "";
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
    <p v-if="assistantError && !assistantSession" class="error" role="alert">
      {{ assistantError }}
    </p>
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
        <div class="actions">
          <button
            v-if="item.hasObjectTarget"
            type="button"
            :disabled="openingId === item.id"
            @click="openObject(item)"
          >
            <ExternalLink :size="15" aria-hidden="true" />
            打开对象
          </button>
          <button
            type="button"
            :disabled="askingId === item.id || assistantOpening"
            @click="askAssistant(item)"
          >
            询问助手
          </button>
        </div>
      </li>
      <li v-if="items.length === 0" class="empty">暂无问题通知</li>
    </ul>

    <OpsAssistantPanel
      v-if="assistantSession"
      :session="assistantSession"
      :sending="assistantSending"
      :error="assistantError"
      @send="sendAssistantMessage"
      @close="closeAssistant"
    />
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
.card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
}
.card {
  grid-template-columns: 1fr auto;
  align-items: start;
}
.actions,
.actions button {
  display: flex;
  align-items: center;
}
.actions {
  gap: 0.5rem;
}
.actions button {
  gap: 0.3rem;
}
.error {
  color: crimson;
}
.empty {
  opacity: 0.7;
}
@media (max-width: 720px) {
  .card {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-wrap: wrap;
  }
}
</style>
