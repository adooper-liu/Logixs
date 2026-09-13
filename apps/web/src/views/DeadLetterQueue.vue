<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  listDeadLetters,
  replayDeadLetter,
  type DeadLetterPage,
} from "../api/deadLetters";
import PageHeader from "../components/ui/PageHeader.vue";
import {
  toDeadLetterRow,
  type DeadLetterRow,
} from "../data/deadLetterQueueContract";

const rows = ref<DeadLetterRow[]>([]);
const page = ref<DeadLetterPage | null>(null);
const loading = ref(true);
const error = ref("");
const replayingId = ref("");
const replayReason = ref("manual_replay");
const replayConsumerVersion = ref("consumer-v1");
const replayMessage = ref("");

async function load(cursor?: string): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const next = await listDeadLetters({ pageSize: 50, cursor });
    page.value = next;
    rows.value = next.items.map(toDeadLetterRow);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "加载失败，请确认 API 已启动";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

function startReplay(id: string): void {
  replayingId.value = id;
  replayMessage.value = "";
}

async function confirmReplay(): Promise<void> {
  const reasonCode = replayReason.value.trim();
  const targetConsumerVersion = replayConsumerVersion.value.trim();
  if (!reasonCode || !targetConsumerVersion) {
    replayMessage.value = "原因码和目标消费者版本必填";
    return;
  }
  try {
    const result = await replayDeadLetter(replayingId.value, {
      reasonCode,
      targetConsumerVersion,
      idempotencyKey: crypto.randomUUID(),
    });
    replayMessage.value = result.applied
      ? `已重放为 ${result.replayedEventId}`
      : `已返回原重放 ${result.replayedEventId}`;
    replayingId.value = "";
  } catch (cause) {
    replayMessage.value = cause instanceof Error ? cause.message : "重放失败";
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}
</script>

<template>
  <div class="dead-letter-page page-frame">
    <PageHeader
      eyebrow="同步健康"
      title="死信队列"
      summary="只显示受控引用和失败摘要。重放会生成新消息，不会改写原死信。"
      :updated-at="page?.asOf ? formatTime(page.asOf) : undefined"
    />

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>
    <p v-else-if="rows.length === 0" class="hint">当前租户没有死信。</p>

    <div v-else class="table-wrap">
      <table class="dead-table">
        <thead>
          <tr>
            <th>事件</th>
            <th>对象</th>
            <th>失败</th>
            <th>尝试</th>
            <th>引用</th>
            <th>入死信</th>
            <th>动作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.eventType }}</td>
            <td>{{ row.objectRef }}</td>
            <td>{{ row.failureSummary }}</td>
            <td>{{ row.attemptCount }}</td>
            <td class="ref">{{ row.payloadRef }}</td>
            <td>{{ formatTime(row.deadLetteredAt) }}</td>
            <td>
              <button
                type="button"
                class="replay-button"
                :disabled="Boolean(replayingId)"
                @click="startReplay(row.id)"
              >
                重放
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="replayMessage" class="hint">{{ replayMessage }}</p>

    <form
      v-if="replayingId"
      class="replay-form"
      @submit.prevent="confirmReplay"
    >
      <label>
        原因码
        <input v-model="replayReason" name="reasonCode" required />
      </label>
      <label>
        目标消费者版本
        <input
          v-model="replayConsumerVersion"
          name="targetConsumerVersion"
          required
        />
      </label>
      <div class="replay-actions">
        <button type="submit">确认重放</button>
        <button type="button" @click="replayingId = ''">取消</button>
      </div>
    </form>

    <button
      v-if="page?.pageInfo.hasNextPage && page.pageInfo.nextCursor"
      type="button"
      class="next-page"
      @click="load(page.pageInfo.nextCursor)"
    >
      下一页
    </button>
  </div>
</template>

<style scoped>
.dead-letter-page {
  min-width: 0;
  min-height: 100%;
}
.hint {
  color: var(--app-text-secondary, #6b7280);
  padding: 12px 0;
}
.hint--error {
  color: var(--app-danger, #dc2626);
}
.table-wrap {
  overflow-x: auto;
}
.dead-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.dead-table th,
.dead-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
}
.dead-table th {
  color: var(--app-text-secondary, #6b7280);
  font-weight: 600;
}
.ref {
  word-break: break-all;
}
.replay-button,
.next-page,
.replay-actions button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--app-border, #d1d5db);
  background: var(--app-surface, #fff);
  color: inherit;
}
.replay-form {
  display: grid;
  gap: 12px;
  max-width: 28rem;
  margin-top: 16px;
}
.replay-form label {
  display: grid;
  gap: 4px;
}
.replay-form input {
  min-height: 36px;
  padding: 0 8px;
}
.replay-actions {
  display: flex;
  gap: 8px;
}
.next-page {
  margin-top: 16px;
}
</style>
