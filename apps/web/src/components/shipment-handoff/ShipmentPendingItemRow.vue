<script setup lang="ts">
import { ArrowRight, ClipboardCheck } from "@lucide/vue";
import type { ShipmentPendingItemV1 } from "@logix/contracts";
import type { DeepReadonly } from "vue";

defineProps<{
  item: DeepReadonly<ShipmentPendingItemV1>;
}>();

const emit = defineEmits<{
  act: [code: string];
}>();
</script>

<template>
  <li class="pending-item">
    <div class="pending-item__heading">
      <ClipboardCheck :size="15" aria-hidden="true" />
      <b>{{ item.label }}</b>
      <button type="button" @click="emit('act', item.code)">
        {{ item.directAction.label }}
        <ArrowRight :size="14" aria-hidden="true" />
      </button>
    </div>
    <dl class="pending-item__context">
      <div>
        <dt>当前</dt>
        <dd>{{ item.currentValue || "仍为空" }}</dd>
      </div>
      <div>
        <dt>来源</dt>
        <dd>
          {{ item.sourceValue || `${item.sourceSystem || "原来源"}未提供` }}
        </dd>
      </div>
      <div>
        <dt>候选</dt>
        <dd>{{ item.candidateValues.join("、") || "暂无可靠候选" }}</dd>
      </div>
      <div>
        <dt>责任</dt>
        <dd>{{ item.responsibility.roleLabel }}</dd>
      </div>
      <div>
        <dt>截止</dt>
        <dd>{{ item.deadline.label }}</dd>
      </div>
      <div>
        <dt>影响</dt>
        <dd>
          {{
            item.restrictedActions.map(({ label }) => label).join("、") ||
            "当前不限制流程"
          }}
        </dd>
      </div>
    </dl>
  </li>
</template>

<style scoped>
.pending-item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--line);
}

.pending-item__heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pending-item__heading b {
  min-width: 0;
  flex: 1;
}

.pending-item__heading button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 600;
  cursor: pointer;
}

.pending-item__context {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0 0 0 calc(15px + var(--space-2));
}

.pending-item__context div {
  display: inline-flex;
  min-width: 0;
  gap: var(--space-1);
}

.pending-item__context dt,
.pending-item__context dd {
  margin: 0;
  font-size: var(--text-label);
}

.pending-item__context dt {
  color: var(--muted);
}

.pending-item__context dd {
  color: var(--ink-soft);
}

@media (max-width: 680px) {
  .pending-item__context {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
