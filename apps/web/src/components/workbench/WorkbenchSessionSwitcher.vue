<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import type { WorkSessionV1 } from "@logix/contracts";
import type { DirtyChoice } from "../../work-session/workSessionAdapter";
import type { SwitchWorkSessionResult } from "../../work-session/useWorkSessions";

const props = withDefaults(
  defineProps<{
    sessions: readonly WorkSessionV1[];
    onSelect: (session: WorkSessionV1) => Promise<SwitchWorkSessionResult>;
    onResolveChoice?: (
      session: WorkSessionV1,
      choice: DirtyChoice,
    ) => Promise<SwitchWorkSessionResult>;
    triggerLabel?: string;
  }>(),
  { triggerLabel: "切换工作现场", onResolveChoice: undefined },
);

const open = ref(false);
const busyId = ref<string | null>(null);
const feedback = ref("");
const pendingSession = ref<WorkSessionV1 | null>(null);
const pendingChoices = ref<readonly DirtyChoice[]>([]);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const current = computed(() =>
  props.sessions.find((session) => session.status === "current"),
);

function toggle(): void {
  open.value = !open.value;
  feedback.value = "";
  if (open.value) {
    void nextTick(() =>
      panel.value
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus(),
    );
  }
}

async function select(session: WorkSessionV1): Promise<void> {
  if (session.status === "current" || busyId.value) return;
  busyId.value = session.sessionId;
  feedback.value = "";
  const result = await props.onSelect(session);
  busyId.value = null;
  if (result.kind === "switched") {
    pendingSession.value = null;
    pendingChoices.value = [];
    open.value = false;
    await nextTick();
    trigger.value?.focus();
    return;
  }
  if (result.kind === "failed") feedback.value = result.message;
  if (result.kind === "needs-choice") {
    pendingSession.value = session;
    pendingChoices.value = result.choices as readonly DirtyChoice[];
  }
}

async function resolveChoice(choice: DirtyChoice): Promise<void> {
  const session = pendingSession.value;
  if (!session) return;
  if (choice === "stay") {
    pendingSession.value = null;
    pendingChoices.value = [];
    return;
  }
  if (!props.onResolveChoice) return;
  const result = await props.onResolveChoice(session, choice);
  if (result.kind === "switched") {
    pendingSession.value = null;
    pendingChoices.value = [];
    open.value = false;
    await nextTick();
    trigger.value?.focus();
  } else if (result.kind === "failed") {
    feedback.value = result.message;
  }
}

function close(): void {
  if (!open.value) return;
  open.value = false;
  void nextTick(() => trigger.value?.focus());
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

function onDocumentPointer(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return;
  close();
}

document.addEventListener("pointerdown", onDocumentPointer);
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", onDocumentPointer),
);

function statusLabel(status: WorkSessionV1["status"]): string {
  return {
    current: "当前",
    resumable: "待续办",
    draft_saved: "领域草稿已保存",
    browser_held: "仅此标签保留",
    conflict: "冲突",
    closed: "已关闭",
  }[status];
}
</script>

<template>
  <div class="session-switcher" @keydown="onKeydown">
    <button
      ref="trigger"
      type="button"
      class="session-switcher__trigger"
      :aria-label="triggerLabel"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      <span>切换</span>
      <small>{{ current?.displaySummary ?? "当前现场" }}</small>
    </button>
    <section
      v-if="open"
      ref="panel"
      class="session-switcher__panel"
      role="dialog"
      aria-modal="true"
      aria-label="工作现场切换"
    >
      <header>
        <b>工作现场</b>
        <button type="button" aria-label="关闭工作现场切换" @click="close">
          关闭
        </button>
      </header>
      <p v-if="feedback" class="session-switcher__feedback" role="alert">
        {{ feedback }}
      </p>
      <section
        v-if="pendingSession"
        class="session-switcher__choices"
        aria-label="离开前处理未保存输入"
      >
        <p>当前输入尚未处理，选择后再切换。</p>
        <button
          v-for="choice in pendingChoices"
          :key="choice"
          type="button"
          :data-dirty-choice="choice"
          @click="resolveChoice(choice)"
        >
          {{
            choice === "save"
              ? "保存领域草稿并切换"
              : choice === "discard"
                ? "放弃本地改动并切换"
                : choice === "new-tab"
                  ? "在新标签页打开目标"
                  : "留在当前页"
          }}
        </button>
      </section>
      <button
        v-for="session in sessions"
        :key="session.sessionId"
        type="button"
        class="session-switcher__item"
        :data-session-id="session.sessionId"
        :data-session="session.sessionId"
        :aria-current="session.status === 'current' || undefined"
        :disabled="session.status === 'closed' || busyId === session.sessionId"
        @click="select(session)"
      >
        <span>{{ session.displaySummary }}</span>
        <small>{{ statusLabel(session.status) }}</small>
      </button>
    </section>
  </div>
</template>

<style scoped>
.session-switcher {
  position: relative;
}
.session-switcher__trigger,
.session-switcher__item,
.session-switcher__panel header button {
  min-height: var(--touch-target);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
.session-switcher__trigger {
  display: grid;
  justify-items: start;
  padding: var(--space-2) var(--space-3);
}
.session-switcher__trigger small,
.session-switcher__item small {
  color: var(--muted);
}
.session-switcher__panel {
  position: absolute;
  z-index: var(--z-popover);
  top: calc(100% + var(--space-2));
  right: 0;
  width: min(360px, calc(100vw - var(--space-8)));
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-popover);
}
.session-switcher__panel header,
.session-switcher__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.session-switcher__item {
  width: 100%;
  padding: var(--space-3);
  text-align: left;
}
.session-switcher__item[aria-current="true"] {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.session-switcher__choices {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--warn);
  background: var(--warn-bg);
}
.session-switcher__choices p {
  margin: 0;
}
.session-switcher__choices button {
  min-height: var(--touch-target);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
}
.session-switcher__feedback {
  margin: 0;
  padding: var(--space-2);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}
@media (max-width: 680px) {
  .session-switcher__panel {
    position: fixed;
    inset: auto var(--space-4) var(--space-4);
    width: auto;
    max-height: min(70dvh, 560px);
    overflow: auto;
  }
}
</style>
