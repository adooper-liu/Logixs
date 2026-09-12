<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  getImportBatch,
  type ImportBatchDetailDto,
} from "../api/importBatches";
import PageHeader from "../components/ui/PageHeader.vue";

const route = useRoute();
const batchId = route.params.batchId as string;

const detail = ref<ImportBatchDetailDto | null>(null);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    detail.value = await getImportBatch(batchId);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "查询失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="import-batch-detail page-frame">
    <PageHeader eyebrow="P6 智能导入 · 阶段 A" title="导入批次详情" />

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>

    <template v-else-if="detail">
      <dl class="meta">
        <div class="meta-item">
          <dt>文件</dt>
          <dd>{{ detail.batch.fileName }}</dd>
        </div>
        <div class="meta-item">
          <dt>状态</dt>
          <dd>{{ detail.batch.status }}</dd>
        </div>
        <div class="meta-item">
          <dt>行 / 列</dt>
          <dd>{{ detail.batch.rowCount }} / {{ detail.batch.columnCount }}</dd>
        </div>
      </dl>

      <h2 class="block-title">解析样本（前 {{ detail.rows.length }} 行）</h2>
      <div v-if="detail.columns.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th v-for="column in detail.columns" :key="column">
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in detail.rows" :key="row.rowNo">
              <td>{{ row.rowNo }}</td>
              <td v-for="column in detail.columns" :key="column">
                {{ row.values[column] ?? "" }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="hint">无数据行</p>
    </template>
  </div>
</template>

<style scoped>
.import-batch-detail {
  min-width: 0;
  min-height: 100%;
}
.hint {
  color: var(--app-text-secondary, #6b7280);
  padding: 8px 0;
}
.hint--error {
  color: var(--app-danger, #dc2626);
}
.meta {
  display: flex;
  gap: 32px;
  margin: 12px 0 20px;
}
.meta-item dt {
  font-size: 12px;
  color: var(--app-text-secondary, #6b7280);
}
.meta-item dd {
  margin: 4px 0 0;
  font-weight: 600;
}
.block-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-secondary, #6b7280);
  margin: 0 0 10px;
}
.table-wrap {
  overflow-x: auto;
}
.table {
  border-collapse: collapse;
  font-size: 13px;
  white-space: nowrap;
}
.table th,
.table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
}
.table th {
  color: var(--app-text-secondary, #6b7280);
  font-weight: 600;
}
</style>
