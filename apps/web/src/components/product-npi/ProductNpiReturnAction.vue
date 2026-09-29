<script setup lang="ts">
import { Undo2 } from "@lucide/vue";
import { shallowRef } from "vue";

const props = defineProps<{
  busy: boolean;
  returnToSelection: (reason: string) => Promise<boolean>;
}>();

const open = shallowRef(false);
const reason = shallowRef("");

async function submit(): Promise<void> {
  if (props.busy) return;
  const ok = await props.returnToSelection(reason.value);
  if (ok) {
    open.value = false;
    reason.value = "";
  }
}
</script>

<template>
  <section class="npi-return" aria-label="退回选品">
    <button
      v-if="!open"
      type="button"
      class="npi-return__open"
      :disabled="busy"
      @click="open = true"
    >
      <Undo2 :size="15" aria-hidden="true" />退回选品
    </button>
    <form v-else class="npi-return__form" @submit.prevent="submit">
      <label>
        <span>退回理由 <small>必填才关闭</small></span>
        <textarea
          v-model="reason"
          rows="3"
          maxlength="500"
          aria-label="退回选品理由"
          placeholder="例如：立项范围与工厂能力不匹配，需选品重判"
          required
        />
      </label>
      <div class="npi-return__actions">
        <button type="button" class="secondary" @click="open = false">
          取消
        </button>
        <button
          type="submit"
          class="primary"
          :disabled="busy || !reason.trim()"
        >
          {{ busy ? "正在退回" : "确认退回选品" }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.npi-return {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}
.npi-return__open,
.npi-return__actions button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
}
.npi-return__open:disabled,
.npi-return__actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.npi-return__form {
  display: grid;
  gap: var(--space-2);
}
.npi-return__form label {
  display: grid;
  gap: var(--space-1);
}
.npi-return__form span {
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 600;
}
.npi-return__form small {
  color: var(--muted);
  font-weight: 400;
}
.npi-return__form textarea {
  width: 100%;
  min-width: 0;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  box-sizing: border-box;
  resize: vertical;
}
.npi-return__actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}
.npi-return__actions .primary {
  border-color: var(--brand-strong);
  background: var(--brand-strong);
  color: var(--surface);
}
</style>
