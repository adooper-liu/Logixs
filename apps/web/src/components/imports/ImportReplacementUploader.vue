<script setup lang="ts">
import { Upload } from "@lucide/vue";

defineProps<{ disabled: boolean }>();

const emit = defineEmits<{
  replace: [file: File];
}>();

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("replace", file);
  input.value = "";
}
</script>

<template>
  <label class="replacement-uploader" :class="{ disabled }">
    <input
      type="file"
      accept=".xlsx,.csv"
      :disabled="disabled"
      @change="onFileChange"
    />
    <span class="replacement-command">
      <Upload :size="16" aria-hidden="true" />
      重新上传替代
    </span>
  </label>
</template>

<style scoped>
.replacement-uploader {
  display: inline-flex;
  cursor: pointer;
}

.replacement-uploader input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.replacement-command {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 8px;
}

.replacement-uploader:not(.disabled):hover .replacement-command {
  border-color: var(--app-accent, #2563eb);
}

.replacement-uploader.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
