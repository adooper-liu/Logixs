<script setup lang="ts">
import { ClipboardList } from "@lucide/vue";
import type { ProductInitiativeNpiQueueEntryV1 } from "@logix/contracts";
import { computed } from "vue";

const props = defineProps<{
  waiting: ProductInitiativeNpiQueueEntryV1[];
  mine: ProductInitiativeNpiQueueEntryV1[];
  takenByOthers: ProductInitiativeNpiQueueEntryV1[];
  selectedId: string;
  loading: boolean;
}>();

/** 三组按"等谁动"排：等我 → 我负责的 → 已在他人手上。 */
const groups = computed(() => [
  { key: "waiting", label: "等我接手", items: props.waiting },
  { key: "mine", label: "我负责的", items: props.mine },
  { key: "others", label: "已在他人手上", items: props.takenByOthers },
]);

defineEmits<{ select: [handoffId: string] }>();

function ownerLabel(entry: ProductInitiativeNpiQueueEntryV1): string {
  return entry.claim?.productOwnerActorId ?? "";
}

function receivedAt(entry: ProductInitiativeNpiQueueEntryV1): string {
  return new Date(entry.handoff.createdAt).toLocaleString("zh-CN");
}
</script>

<template>
  <section class="npi-queue">
    <header>
      <small>为什么现在处理</small>
      <h2>产品侧待办</h2>
      <p>
        选品已立项并交过来的机会。没接的那部分，负责人还不存在 ——
        接一件，它就归你推进。
      </p>
    </header>

    <p v-if="loading" class="empty">正在读取产品侧待办</p>
    <template v-else>
      <div v-for="group in groups" :key="group.key" class="group">
        <h3>
          {{ group.label }}
          <span class="count">{{ group.items.length }}</span>
        </h3>
        <p v-if="group.items.length === 0" class="empty">没有</p>
        <ul v-else>
          <li v-for="entry in group.items" :key="entry.handoff.handoffId">
            <button
              type="button"
              :class="{ 'is-selected': entry.handoff.handoffId === selectedId }"
              @click="$emit('select', entry.handoff.handoffId)"
            >
              <ClipboardList :size="16" />
              <span class="objective">{{ entry.handoff.objective }}</span>
              <span class="meta">
                {{ entry.handoff.marketCode || "未填市场" }} ·
                {{ receivedAt(entry) }}
                <template v-if="ownerLabel(entry)">
                  · 负责：{{ ownerLabel(entry) }}
                </template>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}
header p {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}
.group {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  font-size: var(--text-meta);
  font-weight: 600;
}
.count {
  color: var(--ink-soft);
  font-weight: 400;
}
ul {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
button {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-s);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
button:hover {
  background: var(--surface-2);
}
button.is-selected {
  border-color: var(--brand);
  background: var(--surface-2);
}
.objective {
  font-weight: 600;
  line-height: var(--leading-body);
}
.meta {
  grid-column: 2;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.empty {
  margin: 0;
  padding: var(--space-2) 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
}
</style>
