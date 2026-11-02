<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { Download, Paperclip, Trash2 } from "@lucide/vue";

export interface AttachmentItem {
  id: string;
  name: string;
  file: File;
}

const files = defineModel<AttachmentItem[]>({ required: true });
defineProps<{ label: string }>();

const objectUrls = new Map<string, string>();

function nextId(): string {
  return crypto.randomUUID();
}

function objectUrl(item: AttachmentItem): string {
  const existing = objectUrls.get(item.id);
  if (existing) return existing;
  const url = URL.createObjectURL(item.file);
  objectUrls.set(item.id, url);
  return url;
}

function release(id: string): void {
  const url = objectUrls.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

function append(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const picked = Array.from(input.files ?? []);
  input.value = "";
  if (picked.length === 0) return;
  files.value = [
    ...files.value,
    ...picked.map((file) => ({
      id: nextId(),
      name: file.name,
      file,
    })),
  ];
}

function preview(item: AttachmentItem): void {
  window.open(objectUrl(item), "_blank", "noopener,noreferrer");
}

function download(item: AttachmentItem): void {
  const anchor = document.createElement("a");
  anchor.href = objectUrl(item);
  anchor.download = item.name;
  anchor.click();
}

function remove(id: string): void {
  release(id);
  files.value = files.value.filter((item) => item.id !== id);
}

onBeforeUnmount(() => {
  for (const id of objectUrls.keys()) release(id);
});
</script>

<template>
  <label class="icon-button attachment-clip">
    <Paperclip :size="16" aria-hidden="true" />
    <input type="file" multiple :aria-label="label" @change="append" />
  </label>
  <ul v-if="files.length" class="attachment-files">
    <li v-for="item in files" :key="item.id" class="attachment-file">
      <button
        type="button"
        class="attachment-name"
        :title="item.name"
        :aria-label="`预览 ${item.name}`"
        @click="preview(item)"
      >
        {{ item.name }}
      </button>
      <button
        type="button"
        class="icon-button"
        :aria-label="`下载 ${item.name}`"
        @click="download(item)"
      >
        <Download :size="16" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="icon-button"
        :aria-label="`删除 ${item.name}`"
        @click="remove(item.id)"
      >
        <Trash2 :size="16" aria-hidden="true" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.attachment-clip {
  position: relative;
}

.attachment-clip input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.attachment-files {
  grid-column: 1 / -1;
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.attachment-file {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.attachment-name {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--brand-strong);
  font: inherit;
  font-size: var(--text-label);
  line-height: var(--leading-body);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
</style>
