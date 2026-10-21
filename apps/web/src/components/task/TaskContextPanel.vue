<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type {
  TaskAiAssistancePanelModel,
  TaskAiAssistanceRetryTarget,
} from "../../composables/useTaskAiAssistance";
import type {
  TaskCollaborationPanelModel,
  TaskCollaborationRetryTarget,
} from "../../composables/useTaskCollaboration";
import TaskCollaborationPanel from "./TaskCollaborationPanel.vue";
import TaskAiAssistancePanel from "./TaskAiAssistancePanel.vue";

export type TaskContextMode = "work" | "archive" | "collaboration";
export type TaskContextPanelMode = TaskContextMode | "ai";

const props = withDefaults(
  defineProps<{
    modelValue: TaskContextPanelMode;
    contextKey: string | null;
    modes: readonly TaskContextPanelMode[];
    collaboration: TaskCollaborationPanelModel | null;
    ai?: TaskAiAssistancePanelModel | null;
  }>(),
  { ai: null },
);

const emit = defineEmits<{
  "update:modelValue": [mode: TaskContextPanelMode];
  submit: [];
  retry: [target: TaskCollaborationRetryTarget];
  loadMore: [];
  confirmAi: [];
  rejectAi: [reason?: string];
  retryAi: [target: TaskAiAssistanceRetryTarget];
  refreshAi: [];
}>();

defineSlots<{
  anchor?(): unknown;
  work?(): unknown;
  archive?(): unknown;
}>();

const modeLabels: Record<TaskContextPanelMode, string> = {
  work: "办理",
  archive: "档案",
  collaboration: "协作",
  ai: "AI 辅助",
};
const fixedModes: TaskContextPanelMode[] = [
  "work",
  "archive",
  "collaboration",
  "ai",
];
const availableModes = computed(() =>
  fixedModes.filter((mode) => props.modes.includes(mode)),
);
const activeMode = computed<TaskContextPanelMode>(() =>
  availableModes.value.includes(props.modelValue)
    ? props.modelValue
    : (availableModes.value[0] ?? "work"),
);
const panelRoot = ref<HTMLElement | null>(null);
const scrollMemory = new Map<TaskContextPanelMode, number>();
const focusMemory = new Map<TaskContextPanelMode, HTMLElement>();
const originalTabIndex = new WeakMap<HTMLElement, string | null>();
let transitionGeneration = 0;

function modeRoot(mode: TaskContextPanelMode): HTMLElement | null {
  return (
    panelRoot.value?.querySelector<HTMLElement>(
      `[data-context-mode="${mode}"]`,
    ) ?? null
  );
}

function scrollOwner(): HTMLElement | null {
  return (
    panelRoot.value?.closest<HTMLElement>(
      ".workbench-pane__scroll--independent",
    ) ?? null
  );
}

function syncTabStops(): void {
  for (const mode of availableModes.value) {
    const root = modeRoot(mode);
    if (!root) continue;
    const controls = root.querySelectorAll<HTMLElement>(
      "button, a[href], input, textarea, select, [tabindex]",
    );
    for (const control of controls) {
      if (mode !== activeMode.value) {
        if (!originalTabIndex.has(control)) {
          originalTabIndex.set(control, control.getAttribute("tabindex"));
        }
        control.setAttribute("tabindex", "-1");
        continue;
      }
      if (!originalTabIndex.has(control)) continue;
      const value = originalTabIndex.get(control);
      if (value === null) control.removeAttribute("tabindex");
      else if (value !== undefined) control.setAttribute("tabindex", value);
      originalTabIndex.delete(control);
    }
  }
}

function rememberMode(mode: TaskContextPanelMode): void {
  const owner = scrollOwner();
  if (owner) scrollMemory.set(mode, owner.scrollTop);
  const focused = document.activeElement;
  const root = modeRoot(mode);
  if (focused instanceof HTMLElement && root?.contains(focused)) {
    focusMemory.set(mode, focused);
  }
}

function rememberFocusedControl(
  mode: TaskContextPanelMode,
  event: FocusEvent,
): void {
  if (event.target instanceof HTMLElement) {
    focusMemory.set(mode, event.target);
  }
}

async function restoreMode(
  mode: TaskContextPanelMode,
  contextKey: string | null,
  generation: number,
): Promise<void> {
  await nextTick();
  if (
    generation !== transitionGeneration ||
    props.contextKey !== contextKey ||
    activeMode.value !== mode
  ) {
    return;
  }
  syncTabStops();
  const owner = scrollOwner();
  if (owner) owner.scrollTop = scrollMemory.get(mode) ?? 0;
  const remembered = focusMemory.get(mode);
  const root = modeRoot(mode);
  if (remembered?.isConnected && root?.contains(remembered)) {
    remembered.focus({ preventScroll: true });
    return;
  }
  panelRoot.value
    ?.querySelector<HTMLButtonElement>(`[data-mode-control="${mode}"]`)
    ?.focus({ preventScroll: true });
}

function selectMode(mode: TaskContextPanelMode): void {
  if (!availableModes.value.includes(mode) || mode === activeMode.value) return;
  rememberMode(activeMode.value);
  emit("update:modelValue", mode);
}

watch(
  () => props.contextKey,
  () => {
    const focused = document.activeElement;
    const shouldMoveFocus =
      focused instanceof HTMLElement && panelRoot.value?.contains(focused);
    transitionGeneration += 1;
    const requestGeneration = transitionGeneration;
    scrollMemory.clear();
    focusMemory.clear();
    const requestedMode = availableModes.value.includes("work")
      ? "work"
      : (availableModes.value[0] ?? "work");
    emit("update:modelValue", requestedMode);
    void nextTick(() => {
      syncTabStops();
      if (
        shouldMoveFocus &&
        requestGeneration === transitionGeneration &&
        props.contextKey
      ) {
        panelRoot.value
          ?.querySelector<HTMLButtonElement>(
            `[data-mode-control="${activeMode.value}"]`,
          )
          ?.focus({ preventScroll: true });
      }
    });
  },
  { flush: "sync" },
);

watch(
  availableModes,
  (modes) => {
    if (modes.includes(activeMode.value)) return;
    transitionGeneration += 1;
    emit(
      "update:modelValue",
      modes.includes("work") ? "work" : (modes[0] ?? "work"),
    );
  },
  { flush: "sync" },
);

watch(
  () => props.modelValue,
  (mode) => {
    if (!availableModes.value.includes(mode)) return;
    const requestGeneration = ++transitionGeneration;
    void restoreMode(mode, props.contextKey, requestGeneration);
  },
  { flush: "post" },
);

onMounted(syncTabStops);
</script>

<template>
  <article ref="panelRoot" class="task-context">
    <slot name="anchor" />
    <nav class="task-context__modes" aria-label="任务上下文模式">
      <button
        v-for="availableMode in availableModes"
        :key="availableMode"
        type="button"
        :data-mode-control="availableMode"
        :aria-pressed="activeMode === availableMode"
        @pointerdown="rememberMode(activeMode)"
        @click="selectMode(availableMode)"
      >
        {{ modeLabels[availableMode] }}
      </button>
    </nav>

    <section
      v-if="availableModes.includes('work')"
      class="task-context__mode"
      data-context-mode="work"
      :hidden="activeMode !== 'work'"
      :inert="activeMode !== 'work' || undefined"
      :aria-hidden="activeMode !== 'work' ? 'true' : undefined"
      @focusin="rememberFocusedControl('work', $event)"
    >
      <slot name="work" />
    </section>
    <section
      v-if="availableModes.includes('archive')"
      class="task-context__mode"
      data-context-mode="archive"
      :hidden="activeMode !== 'archive'"
      :inert="activeMode !== 'archive' || undefined"
      :aria-hidden="activeMode !== 'archive' ? 'true' : undefined"
      @focusin="rememberFocusedControl('archive', $event)"
    >
      <slot name="archive" />
    </section>
    <section
      v-if="availableModes.includes('collaboration') && collaboration"
      class="task-context__mode"
      data-context-mode="collaboration"
      :hidden="activeMode !== 'collaboration'"
      :inert="activeMode !== 'collaboration' || undefined"
      :aria-hidden="activeMode !== 'collaboration' ? 'true' : undefined"
      @focusin="rememberFocusedControl('collaboration', $event)"
    >
      <TaskCollaborationPanel
        :state="collaboration"
        @submit="emit('submit')"
        @retry="emit('retry', $event)"
        @load-more="emit('loadMore')"
      />
    </section>
    <section
      v-if="availableModes.includes('ai') && ai"
      class="task-context__mode"
      data-context-mode="ai"
      :hidden="activeMode !== 'ai'"
      :inert="activeMode !== 'ai' || undefined"
      :aria-hidden="activeMode !== 'ai' ? 'true' : undefined"
      @focusin="rememberFocusedControl('ai', $event)"
    >
      <TaskAiAssistancePanel
        :state="ai"
        @confirm="emit('confirmAi')"
        @reject="emit('rejectAi', $event)"
        @retry="emit('retryAi', $event)"
        @refresh="emit('refreshAi')"
      />
    </section>
  </article>
</template>

<style scoped>
.task-context {
  min-width: 0;
  display: grid;
  align-content: start;
}

.task-context__modes {
  position: sticky;
  top: 0;
  z-index: 2;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.task-context__modes button {
  min-width: 0;
  min-height: 34px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
}

.task-context__modes button[aria-pressed="true"] {
  border-color: var(--brand);
  color: var(--brand);
  font-weight: 600;
}

.task-context__mode {
  min-width: 0;
}
</style>
