<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  confirmMappings,
  executeImport,
  getImportBatch,
  getReconciliation,
  runPrecheck,
  type ImportBatchDetailDto,
  type PrecheckBlocker,
  type ReconciliationResult,
} from "../api/importBatches";
import PageHeader from "../components/ui/PageHeader.vue";

const route = useRoute();
const batchId = route.params.batchId as string;

const detail = ref<ImportBatchDetailDto | null>(null);
const loading = ref(true);
const error = ref("");
const busy = ref("");
const blockers = ref<PrecheckBlocker[]>([]);
const reconciliation = ref<ReconciliationResult | null>(null);

async function reload(): Promise<void> {
  detail.value = await getImportBatch(batchId);
}

onMounted(async () => {
  try {
    await reload();
    if (detail.value?.batch.status === "completed") {
      reconciliation.value = await getReconciliation(batchId);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "查询失败";
  } finally {
    loading.value = false;
  }
});

async function onConfirm(): Promise<void> {
  if (!detail.value) return;
  busy.value = "确认中…";
  error.value = "";
  try {
    const reviews = detail.value.batch.mappingSuggestions.map((s) => ({
      column: s.column,
      fieldCode: s.fieldCode,
    }));
    await confirmMappings(batchId, reviews);
    await reload();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "确认失败";
  } finally {
    busy.value = "";
  }
}

async function onPrecheck(): Promise<void> {
  busy.value = "预检中…";
  error.value = "";
  try {
    const result = await runPrecheck(batchId);
    blockers.value = result.blockers;
    await reload();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "预检失败";
  } finally {
    busy.value = "";
  }
}

async function onExecute(): Promise<void> {
  busy.value = "落账中…";
  error.value = "";
  try {
    reconciliation.value = await executeImport(batchId);
    await reload();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "落账失败";
  } finally {
    busy.value = "";
  }
}

const canExecute = computed(() => detail.value?.batch.status === "approved");
</script>

<template>
  <div class="import-batch-detail page-frame">
    <PageHeader eyebrow="P6 智能导入 · 阶段 C" title="导入批次详情" />

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

      <h2 class="block-title">字段映射建议（AI，待确认）</h2>
      <div v-if="detail.batch.mappingSuggestions.length" class="suggestions">
        <div
          v-for="suggestion in detail.batch.mappingSuggestions"
          :key="suggestion.column"
          class="suggestion-item"
        >
          <span class="sug-column">{{ suggestion.column }}</span>
          <span class="sug-arrow">→</span>
          <span v-if="suggestion.fieldCode" class="sug-field">
            {{ suggestion.fieldCode }}
          </span>
          <span v-else class="sug-null">待人工</span>
          <span class="sug-conf">
            {{ Math.round(suggestion.confidence * 100) }}%
          </span>
        </div>
      </div>
      <p v-else class="hint">无映射建议</p>

      <div class="actions">
        <button
          class="btn"
          :disabled="!!busy || detail.batch.status !== 'parsed'"
          @click="onConfirm"
        >
          确认映射
        </button>
        <button
          class="btn"
          :disabled="!!busy || detail.batch.status === 'parsed'"
          @click="onPrecheck"
        >
          预检
        </button>
        <button
          class="btn btn--primary"
          :disabled="!!busy || !canExecute"
          @click="onExecute"
        >
          执行落账
        </button>
        <span v-if="busy" class="hint">{{ busy }}</span>
      </div>

      <div v-if="blockers.length" class="blockers">
        <h2 class="block-title">预检 blocker（禁止落账）</h2>
        <ul>
          <li
            v-for="blocker in blockers"
            :key="blocker.ruleCode + '-' + blocker.rowNo"
          >
            <code>{{ blocker.ruleCode }}</code>
            {{ blocker.message }}
          </li>
        </ul>
      </div>

      <div v-if="reconciliation" class="reconciliation">
        <h2 class="block-title">对账结果</h2>
        <p class="hint">
          成功 {{ reconciliation.success }} · 失败 {{ reconciliation.failed }} ·
          重复 {{ reconciliation.duplicate }}
        </p>
      </div>

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
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
}
.sug-column {
  color: var(--app-text-secondary, #6b7280);
}
.sug-arrow {
  color: #9ca3af;
}
.sug-field {
  font-weight: 600;
}
.sug-null {
  color: var(--app-warn, #d97706);
  font-weight: 600;
}
.sug-conf {
  color: var(--app-text-secondary, #6b7280);
}
.actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 8px 0 16px;
}
.btn {
  padding: 8px 16px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.btn--primary {
  background: var(--app-accent, #2563eb);
  color: #fff;
  border-color: transparent;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.blockers ul {
  margin: 0;
  padding-left: 20px;
}
.blockers code {
  background: var(--app-bg-muted, #f3f4f6);
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 6px;
}
.reconciliation {
  margin-bottom: 16px;
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
