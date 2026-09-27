<script setup lang="ts">
import { Download, FileSpreadsheet, SearchCheck, Upload } from "@lucide/vue";
import { shallowRef } from "vue";
import { downloadPostDepartureStandardTemplate } from "../../api/postDepartureSourcePackages";

defineProps<{
  upload: {
    readonly fileName: string;
    readonly batch: {
      readonly fileName: string;
      readonly rowCount: number;
    } | null;
    readonly uploading: boolean;
    readonly error: string;
  };
  preflighting: boolean;
}>();

const emit = defineEmits<{
  selectFile: [file: File];
  preflight: [];
}>();

const downloading = shallowRef(false);
const downloadError = shallowRef("");

function selectFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("selectFile", file);
  input.value = "";
}

async function downloadTemplate(): Promise<void> {
  downloading.value = true;
  downloadError.value = "";
  try {
    await downloadPostDepartureStandardTemplate();
  } catch (cause) {
    downloadError.value =
      cause instanceof Error ? cause.message : "标准模板下载失败";
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <section class="standard-import" aria-labelledby="standard-import-title">
    <header class="standard-import__heading">
      <div>
        <p>推荐方式</p>
        <h2 id="standard-import-title">使用标准模板接管已出运数据</h2>
      </div>
      <button type="button" class="secondary-command" @click="downloadTemplate">
        <Download :size="16" aria-hidden="true" />
        {{ downloading ? "正在下载" : "下载 V1 模板" }}
      </button>
    </header>

    <div class="standard-import__flow">
      <span class="step"><b>1</b> 下载并填写</span>
      <span aria-hidden="true">→</span>
      <span class="step"><b>2</b> 上传文件</span>
      <span aria-hidden="true">→</span>
      <span class="step"><b>3</b> 预检并接管</span>
    </div>

    <div class="standard-import__file">
      <span class="file-icon" aria-hidden="true"
        ><FileSpreadsheet :size="20"
      /></span>
      <span class="file-summary">
        <b>{{
          upload.batch?.fileName || upload.fileName || "尚未选择标准模板"
        }}</b>
        <small v-if="upload.batch">
          已读取 {{ upload.batch.rowCount }} 行 · 模板解析 V1
        </small>
        <small v-else>支持 .xlsx；SKU 明细页可暂时为空</small>
      </span>
      <label class="secondary-command" :class="{ disabled: upload.uploading }">
        <input
          type="file"
          accept=".xlsx"
          :disabled="upload.uploading"
          aria-label="选择已出运标准导入模板"
          @change="selectFile"
        />
        <Upload :size="16" aria-hidden="true" />
        {{
          upload.uploading ? "正在读取" : upload.batch ? "替换文件" : "选择文件"
        }}
      </label>
      <button
        type="button"
        class="primary-command"
        :disabled="!upload.batch || preflighting"
        data-testid="standard-post-departure-preflight"
        @click="emit('preflight')"
      >
        <SearchCheck :size="17" aria-hidden="true" />
        {{ preflighting ? "正在预检" : "开始预检" }}
      </button>
    </div>
    <p v-if="upload.error" class="error" role="alert">{{ upload.error }}</p>
    <p v-if="downloadError" class="error" role="alert">{{ downloadError }}</p>
  </section>
</template>

<style scoped>
.standard-import {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.standard-import__heading,
.standard-import__file {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
}

.standard-import__heading {
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
}

.standard-import__heading p {
  margin: 0 0 var(--space-1);
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.standard-import__heading h2 {
  margin: 0;
}

.standard-import__flow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-2);
  color: var(--muted);
  font-size: var(--text-label);
}

.step {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.step b,
.file-icon {
  display: grid;
  place-items: center;
  background: var(--surface);
  color: var(--brand-strong);
}

.step b {
  width: 22px;
  height: 22px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-size: var(--text-micro);
}

.file-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-control);
}

.file-summary {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: var(--space-1);
}

.file-summary b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-summary small {
  color: var(--muted);
}

.secondary-command,
.primary-command {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  font-size: var(--text-meta);
  font-weight: 600;
  cursor: pointer;
}

.secondary-command {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink);
}

.secondary-command input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.primary-command {
  border: 1px solid var(--brand-strong);
  background: var(--brand);
  color: var(--surface);
}

.primary-command:disabled,
.disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.error {
  margin: 0;
  padding: 0 var(--space-4) var(--space-4);
  color: var(--risk);
  font-size: var(--text-label);
}

@media (max-width: 760px) {
  .standard-import__heading,
  .standard-import__file,
  .standard-import__flow {
    align-items: stretch;
    flex-direction: column;
  }

  .standard-import__flow > span[aria-hidden="true"] {
    display: none;
  }
}
</style>
