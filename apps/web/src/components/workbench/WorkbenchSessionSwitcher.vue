<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { WorkSessionV1 } from "@logix/contracts";
import type { DirtyChoice } from "../../work-session/workSessionAdapter";
import type { SwitchWorkSessionResult } from "../../work-session/useWorkSessions";
import type { CloseWorkSessionResult } from "../../work-session/useWorkSessions";

const props = withDefaults(
  defineProps<{
    sessions: readonly WorkSessionV1[];
    onSelect: (session: WorkSessionV1) => Promise<SwitchWorkSessionResult>;
    onClose?: (session: WorkSessionV1) => Promise<CloseWorkSessionResult>;
    onResolveChoice?: (
      session: WorkSessionV1,
      choice: DirtyChoice,
    ) => Promise<SwitchWorkSessionResult>;
    triggerLabel?: string;
  }>(),
  {
    triggerLabel: "切换工作现场",
    onClose: undefined,
    onResolveChoice: undefined,
  },
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
const liveSessions = computed(() =>
  props.sessions.filter((session) => session.status !== "closed"),
);
const closedSessions = computed(() =>
  props.sessions.filter((session) => session.status === "closed"),
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
  if (result.kind === "failed" || result.kind === "conflict") {
    feedback.value = result.message;
  }
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
  } else if (result.kind === "failed" || result.kind === "conflict") {
    feedback.value = result.message;
  }
}

async function closeSession(session: WorkSessionV1): Promise<void> {
  if (
    !props.onClose ||
    session.status === "current" ||
    session.status === "browser_held" ||
    session.status === "closed"
  )
    return;
  busyId.value = session.sessionId;
  feedback.value = "";
  const result = await props.onClose(session);
  busyId.value = null;
  if (result.message) {
    feedback.value = result.message;
  }
}

function close(): void {
  if (!open.value) return;
  open.value = false;
  void nextTick(() => trigger.value?.focus());
}

function focusable(): HTMLElement[] {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) ?? [],
  ).filter((element) => element.getClientRects().length > 0);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab" || !open.value) return;
  const controls = focusable();
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDocumentPointer(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return;
  close();
}

document.addEventListener("pointerdown", onDocumentPointer);
watch(open, (value) => {
  const root = trigger.value?.closest(".workbench-layout");
  const workspace = root?.querySelector<HTMLElement>(
    ".workbench-layout__workspace",
  );
  if (workspace) workspace.inert = value;
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointer);
  const workspace = trigger.value
    ?.closest(".workbench-layout")
    ?.querySelector<HTMLElement>(".workbench-layout__workspace");
  if (workspace) workspace.inert = false;
});

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
      <div
        v-for="session in liveSessions"
        :key="session.sessionId"
        class="session-switcher__row"
      >
        <button
          type="button"
          class="session-switcher__item"
          :data-session-id="session.sessionId"
          :data-session="session.sessionId"
          :aria-current="session.status === 'current' || undefined"
          :disabled="busyId === session.sessionId"
          @click="select(session)"
        >
          <span>{{ session.displaySummary }}</span>
          <small>{{ statusLabel(session.status) }}</small>
        </button>
        <button
          v-if="
            onClose &&
            session.status !== 'current' &&
            session.status !== 'browser_held'
          "
          type="button"
          class="session-switcher__close"
          :data-close-session="session.sessionId"
          :disabled="busyId === session.sessionId"
          :aria-label="`关闭此工作现场：${session.displaySummary}`"
          @click="closeSession(session)"
        >
          关闭此工作现场
        </button>
      </div>
      <details v-if="closedSessions.length" class="session-switcher__closed">
        <summary>已关闭工作现场（{{ closedSessions.length }}）</summary>
        <p><b>工作现场已关闭</b></p>
        <p>关闭现场不等于业务完成、延期或责任转移。</p>
        <p>重新进入该对象会建立新的受控现场，并重新授权和重读。</p>
        <div
          v-for="session in closedSessions"
          :key="session.sessionId"
          class="session-switcher__closed-item"
          :data-session-id="session.sessionId"
        >
          <span>{{ session.displaySummary }}</span>
          <small>{{ statusLabel(session.status) }}</small>
        </div>
      </details>
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
  z-index: var(--z-command);
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
.session-switcher__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: stretch;
}
.session-switcher__item {
  width: 100%;
  padding: var(--space-3);
  text-align: left;
}
.session-switcher__close {
  min-height: var(--touch-target);
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--risk);
  font: inherit;
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
  min-width: 0;
  margin: 0;
  padding: var(--space-2);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
  overflow-wrap: anywhere;
}
.session-switcher__closed {
  border-top: 1px solid var(--line);
  padding-top: var(--space-2);
}
.session-switcher__closed p {
  margin: var(--space-1) 0;
  color: var(--muted);
}
.session-switcher__closed-item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
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
