<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  confirmMappings,
  executeImport,
  getImportBatch,
  getReconciliation,
  runPrecheck,
  uploadImportBatch,
  type ImportBatchDetailDto,
  type ImportFieldCode,
  type PrecheckBlocker,
  type QuantityUnitCode,
  type ReconciliationResult,
} from "../api/importBatches";
import PageHeader from "../components/ui/PageHeader.vue";
import ImportMappingEditor from "../components/imports/ImportMappingEditor.vue";
import ImportReplacementUploader from "../components/imports/ImportReplacementUploader.vue";

const route = useRoute();
const router = useRouter();
const batchId = computed(() => route.params.batchId as string);

const detail = ref<ImportBatchDetailDto | null>(null);
const loading = ref(true);
const error = ref("");
const busy = ref("");
const blockers = ref<PrecheckBlocker[]>([]);
const reconciliation = ref<ReconciliationResult | null>(null);

async function reload(): Promise<void> {
  detail.value = await getImportBatch(batchId.value);
}

watch(
  batchId,
  async (requestedBatchId) => {
    loading.value = true;
    error.value = "";
    detail.value = null;
    blockers.value = [];
    reconciliation.value = null;
    try {
      const nextDetail = await getImportBatch(requestedBatchId);
      if (batchId.value !== requestedBatchId) return;
      detail.value = nextDetail;
      if (nextDetail.batch.status === "completed") {
        reconciliation.value = await getReconciliation(requestedBatchId);
      }
    } catch (cause) {
      if (batchId.value !== requestedBatchId) return;
      error.value = cause instanceof Error ? cause.message : "查询失败";
    } finally {
      if (batchId.value === requestedBatchId) loading.value = false;
    }
  },
  { immediate: true },
);

async function onConfirm(payload: {
  reviews: { column: string; fieldCode: ImportFieldCode | null }[];
  quantityUnit: QuantityUnitCode | null;
}): Promise<void> {
  if (!detail.value) return;
  busy.value = "确认中…";
  error.value = "";
  try {
    await confirmMappings(batchId.value, payload.reviews, payload.quantityUnit);
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
    const result = await runPrecheck(batchId.value);
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
    reconciliation.value = await executeImport(batchId.value);
    await reload();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "落账失败";
  } finally {
    busy.value = "";
  }
}

async function onReplace(file: File): Promise<void> {
  busy.value = "上传中…";
  error.value = "";
  try {
    const batch = await uploadImportBatch(file, batchId.value);
    await router.push(`/import/${batch.id}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "替代上传失败";
  } finally {
    busy.value = "";
  }
}

const canExecute = computed(() => detail.value?.batch.status === "approved");
const mappingEditable = computed(() =>
  ["parsed", "confirmed"].includes(detail.value?.batch.status ?? ""),
);

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
</script>

<template>
  <div class="import-batch-detail page-frame">
    <PageHeader title="导入批次" />

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error && !detail" class="hint hint--error">{{ error }}</p>

    <template v-else-if="detail">
      <p v-if="error" class="hint hint--error">{{ error }}</p>
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
        <div class="meta-item">
          <dt>解析版本</dt>
          <dd>{{ detail.batch.parserVersion }}</dd>
        </div>
        <div class="meta-item">
          <dt>原文件</dt>
          <dd v-if="detail.batch.sourceFileStatus === 'retained'">
            已留存 · {{ formatFileSize(detail.batch.sourceSizeBytes) }}
          </dd>
          <dd v-else>历史批次未留存</dd>
        </div>
        <div v-if="detail.batch.replacesBatchId" class="meta-item">
          <dt>替代批次</dt>
          <dd>
            <RouterLink :to="`/import/${detail.batch.replacesBatchId}`">
              {{ detail.batch.replacesBatchId }}
            </RouterLink>
          </dd>
        </div>
      </dl>

      <ImportMappingEditor
        :columns="detail.columns"
        :suggestions="detail.batch.mappingSuggestions"
        :effective-mappings="detail.effectiveMappings"
        :field-catalog="detail.fieldCatalog"
        :confirmed-quantity-unit="detail.batch.confirmedQuantityUnit"
        :disabled="!!busy || !mappingEditable"
        @confirm="onConfirm"
      />

      <div class="actions">
        <ImportReplacementUploader :disabled="!!busy" @replace="onReplace" />
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
  flex-wrap: wrap;
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
  overflow-wrap: anywhere;
}
.block-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-secondary, #6b7280);
  margin: 0 0 10px;
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
