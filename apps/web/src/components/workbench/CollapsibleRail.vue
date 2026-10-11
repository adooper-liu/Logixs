<script setup lang="ts">
import { nextTick, ref } from "vue";

const props = withDefaults(
  defineProps<{
    side: "left" | "right";
    collapsed: boolean;
    label: string;
    summary?: string;
    mode?: "rail" | "drawer";
  }>(),
  { summary: undefined, mode: "rail" },
);

const emit = defineEmits<{
  "update:collapsed": [value: boolean];
  opened: [];
  closed: [];
}>();

const body = ref<HTMLElement | null>(null);
let lastFocused: HTMLElement | null = null;

function collapse(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && body.value?.contains(active)) {
    lastFocused = active;
  }
  emit("update:collapsed", true);
  emit("closed");
}

async function expand(): Promise<void> {
  emit("update:collapsed", false);
  emit("opened");
  await nextTick();
  if (lastFocused?.isConnected) lastFocused.focus();
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.mode === "drawer" && event.key === "Escape" && !props.collapsed) {
    collapse();
  }
}
</script>

<template>
  <section
    class="collapsible-rail"
    :class="[
      `collapsible-rail--${side}`,
      `collapsible-rail--${mode}`,
      { 'collapsible-rail--collapsed': collapsed },
    ]"
    @keydown="handleKeydown"
  >
    <div
      ref="body"
      class="collapsible-rail__body"
      :hidden="collapsed"
      :inert="collapsed || undefined"
    >
      <button
        class="collapsible-rail__toggle"
        type="button"
        :aria-label="`折叠${label}`"
        aria-expanded="true"
        @click="collapse"
      >
        {{ side === "left" ? "‹" : "›" }}
      </button>
      <slot />
    </div>
    <div v-if="collapsed" class="collapsible-rail__summary">
      <button
        class="collapsible-rail__toggle"
        type="button"
        :aria-label="`展开${label}`"
        aria-expanded="false"
        @click="expand"
      >
        {{ side === "left" ? "›" : "‹" }}
      </button>
      <slot name="rail">
        <span>{{ summary ?? label }}</span>
      </slot>
    </div>
  </section>
</template>

<style scoped>
.collapsible-rail {
  min-width: 0;
  min-height: 0;
  height: 100%;
  position: relative;
}

.collapsible-rail__body {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.collapsible-rail__toggle {
  min-width: 32px;
  min-height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
  font: inherit;
}

.collapsible-rail__body > .collapsible-rail__toggle {
  position: absolute;
  z-index: 2;
  top: var(--space-2);
}

.collapsible-rail--left .collapsible-rail__body > .collapsible-rail__toggle {
  right: var(--space-2);
}

.collapsible-rail--right .collapsible-rail__body > .collapsible-rail__toggle {
  left: var(--space-2);
}

.collapsible-rail__summary {
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--ink-soft);
}

.collapsible-rail__summary span {
  writing-mode: vertical-rl;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.collapsible-rail--drawer:not(.collapsible-rail--collapsed) {
  box-shadow: var(--shadow-overlay);
}
</style>
