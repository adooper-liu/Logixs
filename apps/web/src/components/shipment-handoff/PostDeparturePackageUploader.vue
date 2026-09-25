<script setup lang="ts">
import {
  CheckCircle2,
  FileSpreadsheet,
  SearchCheck,
  Upload,
} from "@lucide/vue";
import type { PostDepartureSourceKindV1 } from "../../api/postDepartureSourcePackages";
import type { PostDepartureSourceUploadView } from "../../composables/usePostDepartureHandoffWorkbench";

defineProps<{
  sources: readonly PostDepartureSourceUploadView[];
  sourceCount: number;
  canPreflight: boolean;
  preflighting: boolean;
}>();

const emit = defineEmits<{
  selectFile: [kind: PostDepartureSourceKindV1, file: File];
  preflight: [];
}>();

function selectFile(kind: PostDepartureSourceKindV1, event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("selectFile", kind, file);
  input.value = "";
}
</script>

<template>
  <section class="package-uploader" aria-labelledby="source-package-title">
    <header class="section-heading">
      <div>
        <p class="eyebrow">来源包</p>
        <h2 id="source-package-title">上传当前已有的来源文件</h2>
      </div>
      <span class="completion" :class="{ 'completion--ready': canPreflight }">
        <CheckCircle2 v-if="canPreflight" :size="16" aria-hidden="true" />
        {{ canPreflight ? `已收到 ${sourceCount}/4` : "等待来源" }}
      </span>
    </header>

    <div class="source-list">
      <article v-for="source in sources" :key="source.kind" class="source-row">
        <span class="source-icon" aria-hidden="true">
          <FileSpreadsheet :size="18" />
        </span>
        <span class="source-identity">
          <b>{{ source.label }}</b>
          <small>后续责任：{{ source.owner }}</small>
        </span>
        <span v-if="source.batch" class="file-fact">
          <b>{{ source.batch.fileName }}</b>
          <small>
            {{ source.batch.rowCount }} 行 · {{ source.batch.columnCount }} 列
          </small>
        </span>
        <span v-else class="file-fact file-fact--empty">
          <b>{{ source.fileName || "尚未选择" }}</b>
          <small>{{
            source.uploading ? "正在读取实际数据" : "需要 .xlsx 文件"
          }}</small>
        </span>
        <label
          class="file-command"
          :class="{ 'file-command--disabled': source.uploading }"
        >
          <input
            type="file"
            accept=".xlsx"
            :disabled="source.uploading"
            :aria-label="`选择${source.label}文件`"
            @change="selectFile(source.kind, $event)"
          />
          <Upload :size="16" aria-hidden="true" />
          {{ source.batch ? "替换" : "选择" }}
        </label>
        <p v-if="source.error" class="source-error" role="alert">
          {{ source.error }}
        </p>
      </article>
    </div>

    <footer class="package-action">
      <span>
        {{
          canPreflight
            ? "可先检查现有资料，其他来源后补"
            : "上传任一来源后即可开始"
        }}
      </span>
      <button
        type="button"
        class="primary-command"
        data-testid="post-departure-preflight"
        :disabled="!canPreflight || preflighting"
        @click="emit('preflight')"
      >
        <SearchCheck :size="17" aria-hidden="true" />
        {{ preflighting ? "正在联合预检" : "开始联合预检" }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.package-uploader {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.section-heading,
.package-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
}

.section-heading {
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 600;
}

.section-heading h2 {
  margin: 0;
}

.completion {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--warn);
  font-size: var(--text-label);
  font-weight: 600;
}

.completion--ready {
  color: var(--brand-strong);
}

.source-list {
  display: grid;
}

.source-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 36px minmax(130px, 0.55fr) minmax(240px, 1.45fr) 92px;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.source-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--surface-2);
  color: var(--brand-strong);
}

.source-identity,
.file-fact {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.source-identity small,
.file-fact small,
.package-action > span {
  color: var(--muted);
  font-size: var(--text-label);
}

.file-fact b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-meta);
}

.file-fact--empty b {
  color: var(--muted);
  font-weight: 400;
}

.file-command,
.primary-command {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-control);
  font-size: var(--text-meta);
  font-weight: 600;
  cursor: pointer;
}

.file-command {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink);
}

.file-command input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.file-command--disabled,
.primary-command:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.source-error {
  grid-column: 2 / -1;
  margin: 0;
  color: var(--risk);
  font-size: var(--text-label);
}

.package-action {
  background: var(--surface-2);
}

.primary-command {
  border: 1px solid var(--brand-strong);
  background: var(--brand);
  color: var(--surface);
  padding: var(--space-2) var(--space-4);
}

@media (max-width: 760px) {
  .source-row {
    grid-template-columns: 36px minmax(0, 1fr) 84px;
  }

  .file-fact {
    grid-column: 2 / -1;
    grid-row: 2;
  }

  .source-error {
    grid-column: 1 / -1;
  }

  .section-heading,
  .package-action {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
