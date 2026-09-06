<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ArrowRight, Search, X } from "@lucide/vue";
import type { AppNavigationItem } from "./navigation";

const props = defineProps<{
  open: boolean;
  navigation: AppNavigationItem[];
}>();

const emit = defineEmits<{ close: [] }>();
const query = ref("");
const searchInput = ref<HTMLInputElement>();

const filteredNavigation = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  if (!normalized) return props.navigation;
  return props.navigation.filter((item) =>
    `${item.label} ${item.section}`.toLowerCase().includes(normalized),
  );
});

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      query.value = "";
      return;
    }
    await nextTick();
    searchInput.value?.focus();
  },
);
</script>

<template>
  <div v-if="open" class="command-layer" @click.self="emit('close')">
    <section class="command-palette" role="dialog" aria-label="快速导航">
      <header>
        <Search :size="18" aria-hidden="true" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="查找工作区"
          aria-label="查找工作区"
        />
        <button
          class="icon-button"
          type="button"
          aria-label="关闭快速导航"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </header>
      <nav aria-label="快速导航结果">
        <router-link
          v-for="item in filteredNavigation"
          :key="item.path"
          :to="item.path"
          @click="emit('close')"
        >
          <component :is="item.icon" :size="17" aria-hidden="true" />
          <span
            ><b>{{ item.label }}</b
            ><small>{{ item.section }}</small></span
          >
          <ArrowRight :size="16" aria-hidden="true" />
        </router-link>
        <p v-if="filteredNavigation.length === 0">没有匹配的工作区</p>
      </nav>
      <footer><span class="key">Esc</span> 关闭</footer>
    </section>
  </div>
</template>

<style scoped>
.command-layer {
  position: fixed;
  z-index: var(--z-command);
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: min(16vh, 140px) 16px 16px;
  background: var(--overlay);
}

.command-palette {
  width: min(520px, 100%);
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-overlay);
}

header {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}

input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
}

nav {
  max-height: 320px;
  padding: 6px;
  overflow-y: auto;
}

nav a {
  min-height: 48px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  text-decoration: none;
}

nav a:hover {
  background: var(--surface-2);
  color: var(--brand-strong);
}

nav a span {
  display: flex;
  flex-direction: column;
}

nav a small,
nav p,
footer {
  color: var(--muted);
  font-size: 11px;
}

nav p {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
}

footer {
  padding: 8px 12px;
  border-top: 1px solid var(--line);
  text-align: right;
}

.key {
  padding: 1px 5px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  font-family: var(--font-mono);
}
</style>
