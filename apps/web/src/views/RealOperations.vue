<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  listClientOperations,
  listCompensations,
  type ClientOperationPage,
} from "../api/clientOperations";
import PageHeader from "../components/ui/PageHeader.vue";
import {
  toCompensationRow,
  toOperationRow,
  type CompensationRow,
  type ClientOperationRow,
} from "../data/clientOperationQueueContract";
import { uiCopy } from "../data/uiCopyCatalog";

const rows = ref<ClientOperationRow[]>([]);
const page = ref<ClientOperationPage | null>(null);
const loading = ref(true);
const error = ref("");
const expandedId = ref("");
const compensationRows = ref<CompensationRow[]>([]);
const compensationLoading = ref(false);
const compensationError = ref("");

async function load(cursor?: string): Promise<void> {
  loading.value = true;
  error.value = "";
  expandedId.value = "";
  compensationRows.value = [];
  compensationError.value = "";
  try {
    const next = await listClientOperations({ pageSize: 50, cursor });
    page.value = next;
    rows.value = next.items.map(toOperationRow);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "加载失败，请确认 API 已启动";
  } finally {
    loading.value = false;
  }
}

async function toggleCompensations(id: string): Promise<void> {
  if (expandedId.value === id) {
    expandedId.value = "";
    compensationRows.value = [];
    compensationError.value = "";
    return;
  }
  expandedId.value = id;
  compensationLoading.value = true;
  compensationError.value = "";
  compensationRows.value = [];
  try {
    const next = await listCompensations(id, { pageSize: 50 });
    compensationRows.value = next.items.map(toCompensationRow);
  } catch (cause) {
    compensationError.value =
      cause instanceof Error ? cause.message : "加载补偿失败";
  } finally {
    compensationLoading.value = false;
  }
}

function formatTime(value: string): string {
  return value ? new Date(value).toLocaleString() : "—";
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="real-operations-page page-frame">
    <PageHeader
      title="看提交"
      :summary="uiCopy.chrome.operationsSummary"
      :updated-at="page?.asOf ? formatTime(page.asOf) : undefined"
    />

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>
    <p v-else-if="rows.length === 0" class="hint">还没有提交。</p>

    <div v-else class="table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>动作</th>
            <th>对象</th>
            <th>收到</th>
            <th>确认</th>
            <th>入账</th>
            <th>时间</th>
            <th>补偿</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="row.id">
            <tr>
              <td>
                <div class="action">{{ row.actionLabel }}</div>
              </td>
              <td class="ref">{{ row.objectRef }}</td>
              <td>{{ row.receptionLabel }}</td>
              <td>{{ row.decisionLabel }}</td>
              <td>
                {{ row.commitLabel }}
                <span v-if="row.rejectionReasonCode" class="reject">
                  {{ row.rejectionReasonCode }}
                </span>
              </td>
              <td>{{ formatTime(row.createdAt) }}</td>
              <td>
                <button
                  type="button"
                  class="expand"
                  :aria-expanded="expandedId === row.id"
                  @click="toggleCompensations(row.id)"
                >
                  {{ expandedId === row.id ? "收起补偿" : "查看补偿" }}
                </button>
              </td>
            </tr>
            <tr v-if="expandedId === row.id" class="compensation-row">
              <td colspan="7">
                <p v-if="compensationLoading" class="hint">正在加载补偿…</p>
                <p v-else-if="compensationError" class="hint hint--error">
                  {{ compensationError }}
                </p>
                <p v-else-if="compensationRows.length === 0" class="hint">
                  该操作没有补偿记录。
                </p>
                <table v-else class="ops-table nested">
                  <thead>
                    <tr>
                      <th>补偿动作</th>
                      <th>状态</th>
                      <th>原因</th>
                      <th>登记时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="compensation in compensationRows"
                      :key="compensation.id"
                    >
                      <td>{{ compensation.actionLabel }}</td>
                      <td>{{ compensation.stateLabel }}</td>
                      <td>{{ compensation.reasonCode }}</td>
                      <td>{{ formatTime(compensation.createdAt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

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
.real-operations-page {
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
.ops-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ops-table th,
.ops-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
  vertical-align: top;
}
.ops-table th {
  color: var(--app-text-secondary, #6b7280);
  font-weight: 600;
}
.action {
  font-weight: 600;
}
.mono,
.ref {
  word-break: break-all;
  color: var(--app-text-secondary, #6b7280);
  font-size: 12px;
}
.reject {
  display: block;
  color: var(--app-danger, #dc2626);
  font-size: 12px;
}
.expand,
.next-page {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--app-border, #d1d5db);
  background: var(--app-surface, #fff);
  color: inherit;
}
.compensation-row td {
  background: var(--app-surface-muted, #f9fafb);
}
.nested {
  margin: 4px 0 8px;
}
.next-page {
  margin-top: 16px;
}
</style>
