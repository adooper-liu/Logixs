<script setup lang="ts">
import { Activity, LoaderCircle, RefreshCw } from "@lucide/vue";
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useObjectActivities } from "../../composables/useObjectActivities";
import ObjectActivityTimeline from "./ObjectActivityTimeline.vue";

const props = defineProps<{ containerId: string }>();
const router = useRouter();
const {
  items,
  nextActions,
  loading,
  loadingMore,
  error,
  hasNextPage,
  load,
  loadMore,
} = useObjectActivities();

watch(
  () => props.containerId,
  (containerId) => void load(containerId),
  { immediate: true },
);

function openTarget(path: string): void {
  void router.push(path);
}
</script>

<template>
  <section class="activity-panel" aria-label="对象动态">
    <header class="panel-head">
      <div>
        <Activity :size="16" aria-hidden="true" />
        <b>对象动态</b>
        <span>{{ items.length }} 条</span>
      </div>
      <button
        type="button"
        class="icon-button"
        :disabled="loading"
        title="刷新对象动态"
        aria-label="刷新对象动态"
        @click="load(containerId)"
      >
        <RefreshCw :size="15" aria-hidden="true" />
      </button>
    </header>

    <p v-if="loading" class="state">
      <LoaderCircle class="spin" :size="15" aria-hidden="true" />
      加载中…
    </p>
    <template v-else>
      <p v-if="error" class="state state--error" role="alert">{{ error }}</p>
      <ObjectActivityTimeline
        :items="items"
        :next-actions="nextActions"
        @open-target="openTarget"
      />
      <button
        v-if="hasNextPage"
        type="button"
        class="load-more"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? "加载中…" : "加载更早动态" }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.activity-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.panel-head,
.panel-head > div,
.state {
  display: flex;
  align-items: center;
}

.panel-head {
  min-height: 42px;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.panel-head > div {
  gap: 7px;
}

.panel-head svg {
  color: var(--brand);
}

.panel-head span {
  color: var(--muted);
  font-size: 10px;
}

.icon-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--brand);
  cursor: pointer;
}

.icon-button:disabled,
.load-more:disabled {
  cursor: default;
  opacity: 0.5;
}

.state {
  gap: 7px;
  margin: 0;
  padding: 16px 12px;
  color: var(--muted);
  font-size: 11px;
}

.state--error {
  color: var(--risk);
}

.load-more {
  width: 100%;
  min-height: 34px;
  border: 0;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--brand);
  cursor: pointer;
  font-size: 11px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
