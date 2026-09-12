<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { uploadImportBatch } from "../api/importBatches";
import PageHeader from "../components/ui/PageHeader.vue";

const router = useRouter();
const uploading = ref(false);
const error = ref("");

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  error.value = "";
  uploading.value = true;
  try {
    // 开发期幂等键：文件名+大小；同一文件重传会命中幂等返回原批次。
    const idempotencyKey = `${file.name}-${file.size}`;
    const batch = await uploadImportBatch(file, idempotencyKey);
    void router.push(`/import/${batch.id}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "上传失败";
  } finally {
    uploading.value = false;
    if (input) input.value = "";
  }
}
</script>

<template>
  <div class="import-upload page-frame">
    <PageHeader eyebrow="P6 智能导入 · 阶段 A" title="上传已出运货柜表" />

    <p class="hint">
      选择一份 <code>.xlsx</code> / <code>.csv</code> 文件（≤10MB、≤5000 行、≤50
      列），上传后会解析并展示样本。
    </p>

    <label class="picker">
      <input
        type="file"
        accept=".xlsx,.csv"
        :disabled="uploading"
        @change="onFileChange"
      />
      <span>{{ uploading ? "解析中…" : "选择文件" }}</span>
    </label>

    <p v-if="error" class="hint hint--error">{{ error }}</p>
  </div>
</template>

<style scoped>
.import-upload {
  min-width: 0;
  min-height: 100%;
}
.hint {
  color: var(--app-text-secondary, #6b7280);
  padding: 8px 0;
}
.hint code {
  background: var(--app-bg-muted, #f3f4f6);
  padding: 2px 6px;
  border-radius: 4px;
}
.hint--error {
  color: var(--app-danger, #dc2626);
}
.picker {
  display: inline-block;
  margin-top: 8px;
}
.picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.picker span {
  display: inline-block;
  padding: 10px 18px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
}
.picker:hover span {
  border-color: var(--app-accent, #2563eb);
}
</style>
