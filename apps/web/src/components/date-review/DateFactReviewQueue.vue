<script setup lang="ts">
import type { LifecycleDateFactReviewItem } from "@logix/contracts";
import { ChevronsDown } from "@lucide/vue";
import type { DeepReadonly } from "vue";

defineProps<{
  items: readonly DeepReadonly<LifecycleDateFactReviewItem>[];
  selectedFactId: string;
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
}>();

const emit = defineEmits<{ select: [factId: string]; more: [] }>();
</script>

<template>
  <section class="review-queue" aria-labelledby="review-queue-title">
    <header>
      <div>
        <p class="eyebrow">全局队列</p>
        <h2 id="review-queue-title">待复核日期</h2>
      </div>
      <span class="count">{{ items.length }}</span>
    </header>
    <p v-if="loading" class="empty">正在加载待复核事实...</p>
    <p v-else-if="items.length === 0" class="empty">
      当前没有待复核的人工实际日期。
    </p>
    <div v-else class="items" role="list">
      <button
        v-for="item in items"
        :key="item.factId"
        type="button"
        class="queue-item"
        :class="{ 'queue-item--active': item.factId === selectedFactId }"
        :aria-pressed="item.factId === selectedFactId"
        role="listitem"
        @click="emit('select', item.factId)"
      >
        <span class="identity">
          <strong>{{ item.containerNumber || "待绑定箱号" }}</strong>
          <span>{{ item.orderNumber }}</span>
        </span>
        <span class="event">{{ item.nodeCode }} · {{ item.eventCode }}</span>
        <span class="time">{{
          new Date(item.occurredAt).toLocaleString()
        }}</span>
        <span
          class="status"
          :class="{ 'status--blocked': item.blockingReasons.length > 0 }"
        >
          {{ item.blockingReasons.length ? "有复核缺口" : "可批准" }}
        </span>
      </button>
      <button
        v-if="hasNextPage"
        type="button"
        class="more-button"
        :disabled="loadingMore"
        @click="emit('more')"
      >
        <ChevronsDown :size="16" />
        {{ loadingMore ? "正在加载..." : "加载更多" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.review-queue {
  min-width: 0;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.eyebrow {
  margin: 0 0 3px;
  color: var(--app-text-secondary, #667085);
  font-size: 12px;
}
h2 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}
.count {
  min-width: 28px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #eef2f6;
  text-align: center;
  font-size: 12px;
}
.items {
  display: grid;
  gap: 6px;
}
.queue-item {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--line, #d7dde5);
  border-radius: 6px;
  background: var(--surface, #fff);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.queue-item:hover {
  border-color: #98a2b3;
}
.queue-item--active {
  border-color: var(--app-brand, #155eef);
  box-shadow: inset 3px 0 var(--app-brand, #155eef);
}
.identity {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
}
.identity span,
.event,
.time {
  color: var(--app-text-secondary, #667085);
  font-size: 12px;
}
.status {
  width: fit-content;
  color: #067647;
  font-size: 12px;
}
.status--blocked {
  color: #b54708;
}
.empty {
  margin: 0;
  color: var(--app-text-secondary, #667085);
  font-size: 13px;
}
.more-button {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--line, #d7dde5);
  border-radius: 4px;
  background: #fff;
  color: #344054;
  cursor: pointer;
}
.more-button:disabled {
  color: #98a2b3;
  cursor: wait;
}
</style>
