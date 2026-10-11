<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import CollapsibleRail from "./CollapsibleRail.vue";
import type {
  WorkbenchMobileScreen,
  WorkbenchPaneId,
} from "./workbenchLayout.types";

const props = withDefaults(
  defineProps<{
    leftCollapsed?: boolean;
    rightCollapsed?: boolean;
    mobileScreen?: WorkbenchMobileScreen;
    leftRailLabel: string;
    rightRailLabel: string;
    leftRailSummary?: string;
    rightRailSummary?: string;
  }>(),
  {
    leftCollapsed: false,
    rightCollapsed: false,
    mobileScreen: "queue",
    leftRailSummary: undefined,
    rightRailSummary: undefined,
  },
);

const emit = defineEmits<{
  "update:leftCollapsed": [value: boolean];
  "update:rightCollapsed": [value: boolean];
  "update:mobileScreen": [value: WorkbenchMobileScreen];
  restoreFocus: [pane: WorkbenchPaneId];
}>();

defineSlots<{
  header(): unknown;
  responsibility(): unknown;
  decision(): unknown;
  queue(): unknown;
  queueRail?(): unknown;
  detail(): unknown;
  context(): unknown;
  contextRail?(): unknown;
  mobileBreadcrumb?(props: { screen: WorkbenchMobileScreen }): unknown;
}>();

const narrowQueueOpen = ref(false);
const workspace = ref<HTMLElement | null>(null);
const narrowQueueTrigger = ref<HTMLButtonElement | null>(null);
const paneFocusMemory = new Map<WorkbenchPaneId, HTMLElement>();
const paneScrollMemory = new Map<WorkbenchPaneId, number>();
const pageScrollMemory = new Map<WorkbenchPaneId, number>();

function containingScrollOwner(): HTMLElement | null {
  let candidate = workspace.value?.parentElement ?? null;
  while (candidate) {
    const style = getComputedStyle(candidate);
    if (/(auto|scroll)/.test(`${style.overflow} ${style.overflowY}`)) {
      return candidate;
    }
    candidate = candidate.parentElement;
  }
  return null;
}

function paneFor(screen: WorkbenchPaneId): HTMLElement | null {
  return (
    workspace.value?.querySelector<HTMLElement>(
      `[data-workbench-pane="${screen}"]`,
    ) ?? null
  );
}

function scrollOwnerFor(pane: HTMLElement | null): HTMLElement | null {
  return (
    pane?.querySelector<HTMLElement>(".workbench-pane__scroll--independent") ??
    null
  );
}

function rememberPane(screen: WorkbenchPaneId): void {
  const scrollOwner = scrollOwnerFor(paneFor(screen));
  if (scrollOwner) paneScrollMemory.set(screen, scrollOwner.scrollTop);
  pageScrollMemory.set(
    screen,
    containingScrollOwner()?.scrollTop ?? window.scrollY,
  );
}

function rememberFocusedControl(event: FocusEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const pane = target.closest<HTMLElement>("[data-workbench-pane]");
  const id = pane?.dataset.workbenchPane as WorkbenchPaneId | undefined;
  if (id) paneFocusMemory.set(id, target);
}

function selectMobileScreen(screen: WorkbenchMobileScreen): void {
  emit("update:mobileScreen", screen);
}

async function revealMobileScreen(
  screen: WorkbenchMobileScreen,
): Promise<void> {
  await nextTick();
  const pane = paneFor(screen);
  const rememberedPageScroll = pageScrollMemory.get(screen);
  if (rememberedPageScroll !== undefined) {
    const pageScrollOwner = containingScrollOwner();
    if (pageScrollOwner) pageScrollOwner.scrollTop = rememberedPageScroll;
    else window.scrollTo({ top: rememberedPageScroll });
  } else {
    pane?.scrollIntoView({ block: "start" });
  }
  const rememberedControl = paneFocusMemory.get(screen);
  const control =
    rememberedControl?.isConnected && pane?.contains(rememberedControl)
      ? rememberedControl
      : Array.from(
          pane?.querySelectorAll<HTMLElement>(
            "button:not([disabled]):not(.collapsible-rail__toggle), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]",
          ) ?? [],
        ).find((candidate) => candidate.getClientRects().length > 0);
  const scrollOwner = scrollOwnerFor(pane);
  const rememberedScroll = paneScrollMemory.get(screen);
  if (scrollOwner && rememberedScroll !== undefined) {
    scrollOwner.scrollTop = rememberedScroll;
  }
  if (control) {
    if (control !== rememberedControl) {
      control.scrollIntoView({ block: "nearest" });
    }
    control.focus({ preventScroll: true });
  }
  emit("restoreFocus", screen);
}

function openNarrowQueue(): void {
  narrowQueueOpen.value = true;
  void nextTick(() => {
    const firstControl = paneFor("queue")?.querySelector<HTMLElement>(
      "button:not([disabled]):not(.collapsible-rail__toggle), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    );
    firstControl?.focus();
  });
}

function closeNarrowQueue(): void {
  narrowQueueOpen.value = false;
  void nextTick(() => narrowQueueTrigger.value?.focus());
}

function toggleNarrowQueue(): void {
  if (narrowQueueOpen.value) closeNarrowQueue();
  else openNarrowQueue();
}

function drawerControls(): HTMLElement[] {
  return Array.from(
    paneFor("queue")?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) ?? [],
  ).filter((control) => control.getClientRects().length > 0);
}

function handleNarrowQueueKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeNarrowQueue();
    return;
  }
  if (event.key !== "Tab") return;
  const controls = drawerControls();
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

function handleQueueInteraction(event: Event): void {
  const target = event.target;
  if (
    narrowQueueOpen.value &&
    target instanceof HTMLElement &&
    target.closest("button, a[href]")
  ) {
    closeNarrowQueue();
  }
}

watch(
  () => props.mobileScreen,
  (screen, previous) => {
    if (screen !== previous) {
      rememberPane(previous);
      void revealMobileScreen(screen);
    }
  },
);
</script>

<template>
  <section
    class="workbench-layout"
    :class="{
      'workbench-layout--left-collapsed': leftCollapsed,
      'workbench-layout--right-collapsed': rightCollapsed,
    }"
  >
    <div class="workbench-layout__header"><slot name="header" /></div>
    <div class="workbench-layout__responsibility">
      <slot name="responsibility" />
    </div>
    <div class="workbench-layout__decision"><slot name="decision" /></div>

    <nav class="workbench-layout__mobile-nav" aria-label="工作台办理步骤">
      <button
        v-for="screen in ['queue', 'detail', 'context'] as const"
        :key="screen"
        type="button"
        :data-mobile-target="screen"
        :aria-current="mobileScreen === screen ? 'step' : undefined"
        @click="selectMobileScreen(screen)"
      >
        {{
          screen === "queue" ? "队列" : screen === "detail" ? "详情" : "编辑"
        }}
      </button>
    </nav>
    <div v-if="$slots.mobileBreadcrumb" class="workbench-layout__breadcrumb">
      <slot name="mobileBreadcrumb" :screen="mobileScreen" />
    </div>

    <div
      ref="workspace"
      class="workbench-layout__workspace"
      @focusin="rememberFocusedControl"
    >
      <button
        ref="narrowQueueTrigger"
        class="workbench-layout__narrow-queue"
        type="button"
        :aria-label="
          narrowQueueOpen ? `关闭${leftRailLabel}` : `打开${leftRailLabel}`
        "
        :aria-expanded="narrowQueueOpen"
        aria-controls="workbench-narrow-queue-drawer"
        @click="toggleNarrowQueue"
      >
        <slot name="queueRail">
          <span>{{ leftRailSummary ?? leftRailLabel }}</span>
        </slot>
      </button>
      <button
        v-if="narrowQueueOpen"
        class="workbench-layout__narrow-backdrop"
        type="button"
        aria-label="关闭任务队列抽屉"
        @click="closeNarrowQueue"
      />
      <div
        id="workbench-narrow-queue-drawer"
        class="workbench-layout__pane workbench-layout__pane--queue"
        :class="{ 'workbench-layout__pane--queue-open': narrowQueueOpen }"
        data-workbench-pane="queue"
        :data-mobile-active="mobileScreen === 'queue' || undefined"
        :role="narrowQueueOpen ? 'dialog' : undefined"
        :aria-modal="narrowQueueOpen || undefined"
        :aria-label="narrowQueueOpen ? leftRailLabel : undefined"
        @keydown="handleNarrowQueueKeydown"
        @click="handleQueueInteraction"
      >
        <CollapsibleRail
          side="left"
          :collapsed="leftCollapsed"
          :label="leftRailLabel"
          :summary="leftRailSummary"
          @update:collapsed="emit('update:leftCollapsed', $event)"
        >
          <slot name="queue" />
          <template v-if="$slots.queueRail" #rail
            ><slot name="queueRail"
          /></template>
        </CollapsibleRail>
      </div>
      <div
        class="workbench-layout__pane workbench-layout__pane--detail"
        data-workbench-pane="detail"
        :data-mobile-active="mobileScreen === 'detail' || undefined"
        :inert="narrowQueueOpen || undefined"
      >
        <slot name="detail" />
      </div>
      <div
        class="workbench-layout__pane workbench-layout__pane--context"
        data-workbench-pane="context"
        :data-mobile-active="mobileScreen === 'context' || undefined"
        :inert="narrowQueueOpen || undefined"
      >
        <CollapsibleRail
          side="right"
          :collapsed="rightCollapsed"
          :label="rightRailLabel"
          :summary="rightRailSummary"
          @update:collapsed="emit('update:rightCollapsed', $event)"
        >
          <slot name="context" />
          <template v-if="$slots.contextRail" #rail
            ><slot name="contextRail"
          /></template>
        </CollapsibleRail>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workbench-layout {
  min-width: 0;
  min-height: 0;
  height: calc(100dvh - var(--topbar-height) - var(--space-8) - var(--space-6));
  display: grid;
  grid-template-rows: auto auto auto auto minmax(0, 1fr);
  gap: var(--space-3);
}

.workbench-layout__header,
.workbench-layout__responsibility,
.workbench-layout__decision,
.workbench-layout__workspace,
.workbench-layout__pane {
  min-width: 0;
  min-height: 0;
}

.workbench-layout__workspace {
  position: relative;
  display: grid;
  grid-template-columns: minmax(224px, 0.65fr) minmax(360px, 1.5fr) minmax(
      280px,
      0.85fr
    );
  gap: var(--space-3);
  overflow: hidden;
}

.workbench-layout--left-collapsed .workbench-layout__workspace {
  grid-template-columns: 48px minmax(360px, 1.5fr) minmax(280px, 0.85fr);
}

.workbench-layout--right-collapsed .workbench-layout__workspace {
  grid-template-columns: minmax(224px, 0.65fr) minmax(360px, 1.5fr) 48px;
}

.workbench-layout--left-collapsed.workbench-layout--right-collapsed
  .workbench-layout__workspace {
  grid-template-columns: 48px minmax(360px, 1fr) 48px;
}

.workbench-layout__pane {
  height: 100%;
  overflow: hidden;
}

.workbench-layout__mobile-nav,
.workbench-layout__breadcrumb,
.workbench-layout__narrow-queue {
  display: none;
}

@media (max-width: 1100px) and (min-width: 681px) {
  .workbench-layout__workspace,
  .workbench-layout--right-collapsed .workbench-layout__workspace {
    grid-template-columns: 48px minmax(0, 1.45fr) minmax(260px, 0.85fr);
  }

  .workbench-layout__narrow-queue {
    display: flex;
    min-width: 0;
    height: 100%;
    align-items: center;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    background: var(--surface);
    color: var(--ink-soft);
    cursor: pointer;
    font: inherit;
  }

  .workbench-layout__narrow-queue :deep(strong),
  .workbench-layout__narrow-queue :deep(span) {
    display: block;
    color: var(--brand-strong);
    font-size: var(--text-micro);
    font-weight: 600;
    line-height: var(--leading-tight);
    text-align: center;
  }

  .workbench-layout__narrow-queue :deep(span) {
    max-width: 2rem;
    white-space: normal;
  }

  .workbench-layout__pane--queue {
    display: none;
  }

  .workbench-layout__narrow-backdrop {
    position: absolute;
    z-index: var(--z-backdrop);
    inset: 0;
    border: 0;
    background: var(--overlay);
    cursor: pointer;
  }

  .workbench-layout__pane--queue-open {
    position: absolute;
    z-index: calc(var(--z-backdrop) + 1);
    top: 0;
    bottom: 0;
    left: 0;
    width: min(22rem, calc(100% - var(--space-8)));
    display: block;
    box-shadow: var(--shadow-overlay);
  }
}

@media (max-width: 680px) {
  .workbench-layout {
    height: auto;
    min-height: calc(100dvh - var(--topbar-height) - var(--space-6));
    grid-template-rows: repeat(6, auto);
    align-content: start;
    gap: var(--space-2);
  }

  .workbench-layout__mobile-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface);
    overflow: hidden;
  }

  .workbench-layout__mobile-nav button {
    min-height: var(--touch-target);
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-soft);
    cursor: pointer;
    font: inherit;
  }

  .workbench-layout__mobile-nav button:last-child {
    border-right: 0;
  }

  .workbench-layout__mobile-nav button[aria-current="step"] {
    background: var(--brand-soft);
    color: var(--brand-strong);
    font-weight: 600;
  }

  .workbench-layout__breadcrumb {
    display: block;
  }

  .workbench-layout__workspace,
  .workbench-layout--left-collapsed .workbench-layout__workspace,
  .workbench-layout--right-collapsed .workbench-layout__workspace,
  .workbench-layout--left-collapsed.workbench-layout--right-collapsed
    .workbench-layout__workspace {
    display: block;
    overflow: visible;
  }

  .workbench-layout__narrow-queue {
    display: none;
  }

  .workbench-layout__pane {
    height: auto;
  }

  .workbench-layout__pane:not([data-mobile-active="true"]) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    transform: translateX(-200vw);
    white-space: nowrap;
  }

  .workbench-layout__pane :deep(.collapsible-rail__toggle) {
    display: none;
  }
}
</style>
