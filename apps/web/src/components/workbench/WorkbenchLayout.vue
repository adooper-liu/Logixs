<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
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
    mobileContextLabel?: string;
    responsiveMode?: "standard" | "stacked";
  }>(),
  {
    leftCollapsed: false,
    rightCollapsed: false,
    mobileScreen: "queue",
    leftRailSummary: undefined,
    rightRailSummary: undefined,
    mobileContextLabel: "编辑",
    responsiveMode: "standard",
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
const layout = ref<HTMLElement | null>(null);
const workspace = ref<HTMLElement | null>(null);
const narrowQueueTrigger = ref<HTMLButtonElement | null>(null);
const paneFocusMemory = new Map<WorkbenchPaneId, HTMLElement>();
const paneScrollMemory = new Map<WorkbenchPaneId, number>();
const pageScrollMemory = new Map<WorkbenchPaneId, number>();
type RailPane = "queue" | "context";
const railScrollMemory = new Map<RailPane, number>();
const railGeneration = new Map<RailPane, number>([
  ["queue", 0],
  ["context", 0],
]);
const mobileQuery = ref<MediaQueryList | null>(null);
const narrowQuery = ref<MediaQueryList | null>(null);
const isMobileViewport = ref(false);
const isNarrowViewport = ref(false);
const viewportObservationAvailable = ref(false);
let mounted = true;
let recoveryGeneration = 0;
let drawerGeneration = 0;
let mediaCleanup: (() => void) | null = null;
let lastFocusedElement: HTMLElement | null = null;

const narrowDrawerAvailable = computed(
  () =>
    props.responsiveMode === "standard" &&
    !isMobileViewport.value &&
    (isNarrowViewport.value || !viewportObservationAvailable.value),
);
const drawerActive = computed(
  () => narrowQueueOpen.value && narrowDrawerAvailable.value,
);
const effectiveLeftCollapsed = computed(() =>
  props.responsiveMode === "standard" &&
  (isMobileViewport.value || drawerActive.value)
    ? false
    : props.leftCollapsed,
);
const effectiveRightCollapsed = computed(() =>
  props.responsiveMode === "standard" && isMobileViewport.value
    ? false
    : props.rightCollapsed,
);

function invalidateRecovery(): number {
  recoveryGeneration += 1;
  return recoveryGeneration;
}

function shouldRecoverMobile(): boolean {
  return (
    props.responsiveMode === "standard" &&
    (isMobileViewport.value || !viewportObservationAvailable.value)
  );
}

function isVisibleElement(
  element: HTMLElement,
  allowEmptyRect = false,
): boolean {
  if (!element.isConnected || element.hidden) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  let current: HTMLElement | null = element;
  while (current) {
    if (current.hidden || current.hasAttribute("inert")) return false;
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return (
    allowEmptyRect ||
    element.getClientRects().length > 0 ||
    !viewportObservationAvailable.value
  );
}

function isUsableControl(
  element: HTMLElement | undefined,
  pane: HTMLElement | null,
): element is HTMLElement {
  if (
    !element ||
    element === pane ||
    !pane?.contains(element) ||
    !isVisibleElement(element)
  ) {
    return false;
  }
  if (element instanceof HTMLButtonElement && element.disabled) return false;
  if (element instanceof HTMLInputElement && element.disabled) return false;
  if (element instanceof HTMLTextAreaElement && element.disabled) return false;
  if (element instanceof HTMLSelectElement && element.disabled) return false;
  return true;
}

function paneIsInert(pane: WorkbenchPaneId): boolean {
  if (props.responsiveMode === "stacked") return false;
  if (drawerActive.value) return pane !== "queue";
  return isMobileViewport.value && props.mobileScreen !== pane;
}

function updateViewport(): void {
  const previousFocus = ownedFocus();
  const nextMobile = mobileQuery.value?.matches ?? false;
  const nextNarrow = (narrowQuery.value?.matches ?? false) && !nextMobile;
  isMobileViewport.value = nextMobile;
  isNarrowViewport.value = nextNarrow;
  invalidateRecovery();
  if (!narrowDrawerAvailable.value) closeNarrowQueue(false);
  void recoverPresentationFocus(previousFocus);
}

function ownedFocus(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && layout.value?.contains(active))
    return active;
  // A CSS media change can blur the old control before its change listener runs.
  return active === document.body ? lastFocusedElement : null;
}

function hasUsableFocus(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element !== document.body &&
    !element.matches(":disabled") &&
    isVisibleElement(element)
  );
}

async function recoverPresentationFocus(
  previousFocus: HTMLElement | null,
): Promise<void> {
  const recovery = recoveryGeneration;
  await nextTick();
  if (
    !mounted ||
    recovery !== recoveryGeneration ||
    !previousFocus ||
    hasUsableFocus(previousFocus) ||
    hasUsableFocus(document.activeElement)
  )
    return;

  const screen = shouldRecoverMobile() ? props.mobileScreen : "detail";
  const pane = paneFor(screen);
  if (!pane || paneIsInert(screen)) return;
  const control = availablePaneControl(screen, pane);
  const target =
    control ??
    (isVisibleElement(pane) ? pane : null) ??
    layout.value?.querySelector<HTMLElement>(
      `[data-mobile-target="${screen}"]`,
    );
  if (!target || !isVisibleElement(target)) return;
  target.scrollIntoView({ block: "nearest" });
  target.focus({ preventScroll: true });
  if (recovery === recoveryGeneration && document.activeElement === target)
    emit("restoreFocus", screen);
}

function addMediaListener(
  query: MediaQueryList,
  listener: () => void,
): () => void {
  query.addEventListener?.("change", listener);
  if (!query.addEventListener) query.addListener(listener);
  return () => {
    query.removeEventListener?.("change", listener);
    if (!query.removeEventListener) query.removeListener(listener);
  };
}

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

function rememberRailScroll(pane: RailPane): void {
  const scrollOwner = scrollOwnerFor(paneFor(pane));
  if (scrollOwner) railScrollMemory.set(pane, scrollOwner.scrollTop);
}

function railIsCollapsed(pane: RailPane): boolean {
  return pane === "queue"
    ? effectiveLeftCollapsed.value
    : effectiveRightCollapsed.value;
}

function nextRailGeneration(pane: RailPane): number {
  const generation = (railGeneration.get(pane) ?? 0) + 1;
  railGeneration.set(pane, generation);
  return generation;
}

async function waitForLayoutFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function railTransitionIsCurrent(
  pane: RailPane,
  collapsed: boolean,
  generation: number,
  recovery: number,
): boolean {
  return (
    mounted &&
    recoveryGeneration === recovery &&
    railGeneration.get(pane) === generation &&
    railIsCollapsed(pane) === collapsed
  );
}

function focusRailExpandToggle(pane: RailPane): void {
  const toggle = paneFor(pane)?.querySelector<HTMLElement>(
    ".collapsible-rail__summary .collapsible-rail__toggle",
  );
  if (toggle && isUsableControl(toggle, paneFor(pane))) toggle.focus();
}

function restoreRailFocus(pane: RailPane): void {
  const rail = paneFor(pane);
  const control = paneFocusMemory.get(pane);
  if (control && isUsableControl(control, rail)) {
    control.focus({ preventScroll: true });
  }
}

async function settleRailTransition(
  pane: RailPane,
  collapsed: boolean,
): Promise<void> {
  const generation = nextRailGeneration(pane);
  const recovery = recoveryGeneration;
  if (collapsed) rememberRailScroll(pane);

  await nextTick();
  if (!railTransitionIsCurrent(pane, collapsed, generation, recovery)) return;
  if (collapsed) {
    focusRailExpandToggle(pane);
    return;
  }

  const scrollOwner = scrollOwnerFor(paneFor(pane));
  const postExpandScrollTop = scrollOwner?.scrollTop;
  await waitForLayoutFrame();
  if (!railTransitionIsCurrent(pane, collapsed, generation, recovery)) return;
  const rememberedScroll = railScrollMemory.get(pane);
  if (
    scrollOwner &&
    scrollOwnerFor(paneFor(pane)) === scrollOwner &&
    scrollOwner.scrollTop === postExpandScrollTop &&
    rememberedScroll !== undefined
  ) {
    scrollOwner.scrollTop = rememberedScroll;
  }
  restoreRailFocus(pane);
}

function updateRailCollapsed(pane: RailPane, value: boolean): void {
  if (pane === "queue") emit("update:leftCollapsed", value);
  else emit("update:rightCollapsed", value);
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
  lastFocusedElement = target;
  if (target.closest(".collapsible-rail__toggle")) return;
  const pane = target.closest<HTMLElement>("[data-workbench-pane]");
  const id = pane?.dataset.workbenchPane as WorkbenchPaneId | undefined;
  if (!id) return;
  paneFocusMemory.set(id, target);
}

function availablePaneControl(
  screen: WorkbenchPaneId,
  pane: HTMLElement,
): HTMLElement | undefined {
  const remembered = paneFocusMemory.get(screen);
  if (isUsableControl(remembered, pane)) return remembered;
  return Array.from(
    pane.querySelectorAll<HTMLElement>(
      "button:not([disabled]):not(.collapsible-rail__toggle), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]",
    ),
  ).find((candidate) => isUsableControl(candidate, pane));
}

function selectMobileScreen(screen: WorkbenchMobileScreen): void {
  if (screen !== props.mobileScreen) invalidateRecovery();
  emit("update:mobileScreen", screen);
}

async function revealMobileScreen(
  screen: WorkbenchMobileScreen,
): Promise<void> {
  const recovery = recoveryGeneration;
  await nextTick();
  if (
    !mounted ||
    recoveryGeneration !== recovery ||
    props.responsiveMode !== "standard" ||
    !shouldRecoverMobile() ||
    props.mobileScreen !== screen
  )
    return;
  const pane = paneFor(screen);
  if (!pane || paneIsInert(screen)) return;
  const rememberedPageScroll = pageScrollMemory.get(screen);
  if (rememberedPageScroll !== undefined) {
    const pageScrollOwner = containingScrollOwner();
    if (pageScrollOwner) pageScrollOwner.scrollTop = rememberedPageScroll;
    else window.scrollTo({ top: rememberedPageScroll });
  } else {
    pane?.scrollIntoView({ block: "start" });
  }
  const rememberedControl = paneFocusMemory.get(screen);
  const control = availablePaneControl(screen, pane);
  const scrollOwner = scrollOwnerFor(pane);
  const rememberedScroll = paneScrollMemory.get(screen);
  if (scrollOwner && rememberedScroll !== undefined) {
    scrollOwner.scrollTop = rememberedScroll;
  }
  if (control && recoveryGeneration === recovery) {
    if (control !== rememberedControl) {
      control.scrollIntoView({ block: "nearest" });
    }
    control.focus({ preventScroll: true });
  } else if (isVisibleElement(pane, true) && recoveryGeneration === recovery) {
    pane.focus({ preventScroll: true });
  } else {
    const navigation = document.querySelector<HTMLElement>(
      `[data-mobile-target="${screen}"]`,
    );
    if (navigation && isVisibleElement(navigation))
      navigation.focus({ preventScroll: true });
  }
  if (recoveryGeneration === recovery) emit("restoreFocus", screen);
}

function openNarrowQueue(): void {
  if (!narrowDrawerAvailable.value) return;
  invalidateRecovery();
  narrowQueueOpen.value = true;
  const generation = ++drawerGeneration;
  const recovery = recoveryGeneration;
  void nextTick(() => {
    if (
      !mounted ||
      recovery !== recoveryGeneration ||
      drawerGeneration !== generation ||
      !drawerActive.value
    ) {
      return;
    }
    const queue = paneFor("queue");
    const firstControl = queue?.querySelector<HTMLElement>(
      "button:not([disabled]):not(.collapsible-rail__toggle), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    );
    if (firstControl && isUsableControl(firstControl, queue ?? null))
      firstControl.focus();
  });
}

function closeNarrowQueue(restoreFocus = true): void {
  if (!narrowQueueOpen.value) return;
  narrowQueueOpen.value = false;
  invalidateRecovery();
  const generation = ++drawerGeneration;
  const recovery = recoveryGeneration;
  if (!restoreFocus) return;
  void nextTick(() => {
    if (
      !mounted ||
      recovery !== recoveryGeneration ||
      drawerGeneration !== generation ||
      !narrowDrawerAvailable.value
    )
      return;
    if (
      narrowQueueTrigger.value &&
      isVisibleElement(narrowQueueTrigger.value)
    ) {
      narrowQueueTrigger.value.focus();
    }
  });
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
  if (!drawerActive.value) return;
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
    drawerActive.value &&
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
      if (shouldRecoverMobile()) rememberPane(previous);
      invalidateRecovery();
      if (shouldRecoverMobile()) void revealMobileScreen(screen);
    }
  },
);

watch(
  () => [props.leftCollapsed, effectiveLeftCollapsed.value] as const,
  ([explicit, collapsed], [previousExplicit, previous]) => {
    if (explicit !== previousExplicit && collapsed !== previous) {
      void settleRailTransition("queue", collapsed);
    } else if (collapsed !== previous) {
      nextRailGeneration("queue");
    }
  },
);

watch(
  () => [props.rightCollapsed, effectiveRightCollapsed.value] as const,
  ([explicit, collapsed], [previousExplicit, previous]) => {
    if (explicit !== previousExplicit && collapsed !== previous) {
      void settleRailTransition("context", collapsed);
    } else if (collapsed !== previous) {
      nextRailGeneration("context");
    }
  },
);

watch(
  () => props.responsiveMode,
  () => {
    const previousFocus = ownedFocus();
    invalidateRecovery();
    if (props.responsiveMode !== "standard") closeNarrowQueue(false);
    void recoverPresentationFocus(previousFocus);
  },
);

onMounted(() => {
  if (typeof window.matchMedia !== "function") return;
  viewportObservationAvailable.value = true;
  mobileQuery.value = window.matchMedia("(max-width: 680px)");
  narrowQuery.value = window.matchMedia("(max-width: 1100px)");
  updateViewport();
  const cleanups = [
    addMediaListener(mobileQuery.value, updateViewport),
    addMediaListener(narrowQuery.value, updateViewport),
  ];
  mediaCleanup = () => cleanups.forEach((cleanup) => cleanup());
});

onBeforeUnmount(() => {
  mounted = false;
  invalidateRecovery();
  mediaCleanup?.();
  nextRailGeneration("queue");
  nextRailGeneration("context");
});
</script>

<template>
  <section
    ref="layout"
    class="workbench-layout"
    :class="{
      'workbench-layout--left-collapsed': effectiveLeftCollapsed,
      'workbench-layout--right-collapsed': effectiveRightCollapsed,
      'workbench-layout--stacked-responsive': responsiveMode === 'stacked',
    }"
    @focusin="rememberFocusedControl"
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
          screen === "queue"
            ? "队列"
            : screen === "detail"
              ? "详情"
              : mobileContextLabel
        }}
      </button>
    </nav>
    <div v-if="$slots.mobileBreadcrumb" class="workbench-layout__breadcrumb">
      <slot name="mobileBreadcrumb" :screen="mobileScreen" />
    </div>

    <div ref="workspace" class="workbench-layout__workspace">
      <button
        ref="narrowQueueTrigger"
        class="workbench-layout__narrow-queue"
        type="button"
        :aria-label="
          drawerActive ? `关闭${leftRailLabel}` : `打开${leftRailLabel}`
        "
        :aria-expanded="drawerActive"
        aria-controls="workbench-narrow-queue-drawer"
        @click="toggleNarrowQueue"
      >
        <slot name="queueRail">
          <span>{{ leftRailSummary ?? leftRailLabel }}</span>
        </slot>
      </button>
      <button
        v-if="drawerActive"
        class="workbench-layout__narrow-backdrop"
        type="button"
        aria-label="关闭任务队列抽屉"
        @click="closeNarrowQueue()"
      />
      <div
        id="workbench-narrow-queue-drawer"
        class="workbench-layout__pane workbench-layout__pane--queue"
        :class="{ 'workbench-layout__pane--queue-open': drawerActive }"
        data-workbench-pane="queue"
        :data-mobile-active="mobileScreen === 'queue' || undefined"
        :role="drawerActive ? 'dialog' : undefined"
        :aria-modal="drawerActive || undefined"
        :aria-label="drawerActive ? leftRailLabel : undefined"
        :inert="paneIsInert('queue') || undefined"
        tabindex="-1"
        @keydown="handleNarrowQueueKeydown"
        @click="handleQueueInteraction"
      >
        <CollapsibleRail
          side="left"
          :collapsed="effectiveLeftCollapsed"
          :label="leftRailLabel"
          :summary="leftRailSummary"
          @update:collapsed="updateRailCollapsed('queue', $event)"
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
        :inert="paneIsInert('detail') || undefined"
        tabindex="-1"
      >
        <slot name="detail" />
      </div>
      <div
        class="workbench-layout__pane workbench-layout__pane--context"
        data-workbench-pane="context"
        :data-mobile-active="mobileScreen === 'context' || undefined"
        :inert="paneIsInert('context') || undefined"
        tabindex="-1"
      >
        <CollapsibleRail
          side="right"
          :collapsed="effectiveRightCollapsed"
          :label="rightRailLabel"
          :summary="rightRailSummary"
          @update:collapsed="updateRailCollapsed('context', $event)"
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

.workbench-layout__header {
  position: relative;
  z-index: calc(var(--z-content-raised) + 1);
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

.workbench-layout__pane :deep(.workbench-pane__scroll--independent) {
  overflow-anchor: none;
}

.workbench-layout__mobile-nav,
.workbench-layout__breadcrumb,
.workbench-layout__narrow-queue {
  display: none;
}

@media (max-width: 1100px) and (min-width: 681px) {
  .workbench-layout--stacked-responsive {
    height: auto;
    grid-template-rows: repeat(5, auto);
    align-content: start;
  }

  .workbench-layout--stacked-responsive .workbench-layout__workspace {
    grid-template-columns: minmax(280px, 0.7fr) minmax(0, 1.3fr);
    overflow: visible;
  }

  .workbench-layout--stacked-responsive .workbench-layout__narrow-queue {
    display: none;
  }

  .workbench-layout--stacked-responsive .workbench-layout__pane--queue {
    display: block;
  }

  .workbench-layout--stacked-responsive .workbench-layout__pane {
    height: auto;
    overflow: visible;
  }

  .workbench-layout--stacked-responsive .workbench-layout__pane--context {
    grid-column: 1 / -1;
  }

  .workbench-layout--stacked-responsive
    .workbench-layout__pane
    :deep(.workbench-pane) {
    height: auto;
    overflow: visible;
  }

  .workbench-layout--stacked-responsive
    .workbench-layout__pane
    :deep(.workbench-pane__scroll--independent) {
    overflow-y: visible;
    overscroll-behavior: auto;
  }

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

  .workbench-layout--stacked-responsive .workbench-layout__mobile-nav,
  .workbench-layout--stacked-responsive .workbench-layout__breadcrumb {
    display: none;
  }

  .workbench-layout--stacked-responsive .workbench-layout__workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .workbench-layout--stacked-responsive .workbench-layout__pane,
  .workbench-layout--stacked-responsive
    .workbench-layout__pane:not([data-mobile-active="true"]) {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
    transform: none;
    white-space: normal;
  }

  .workbench-layout--stacked-responsive
    .workbench-layout__pane
    :deep(.workbench-pane) {
    height: auto;
    overflow: visible;
  }

  .workbench-layout--stacked-responsive
    .workbench-layout__pane
    :deep(.workbench-pane__scroll--independent) {
    overflow-y: visible;
    overscroll-behavior: auto;
  }

  .workbench-layout__pane :deep(.collapsible-rail__toggle) {
    display: none;
  }
}
</style>
