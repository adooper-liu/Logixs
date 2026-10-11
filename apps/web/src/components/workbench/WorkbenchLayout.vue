<script setup lang="ts">
import { ref } from "vue";
import CollapsibleRail from "./CollapsibleRail.vue";
import type {
  WorkbenchMobileScreen,
  WorkbenchPaneId,
} from "./workbenchLayout.types";

withDefaults(
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

function selectMobileScreen(screen: WorkbenchMobileScreen): void {
  emit("update:mobileScreen", screen);
  emit("restoreFocus", screen);
}
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

    <div class="workbench-layout__workspace">
      <button
        class="workbench-layout__narrow-queue"
        type="button"
        :aria-label="
          narrowQueueOpen ? `关闭${leftRailLabel}` : `打开${leftRailLabel}`
        "
        :aria-expanded="narrowQueueOpen"
        @click="narrowQueueOpen = !narrowQueueOpen"
      >
        <slot name="queueRail">
          <span>{{ leftRailSummary ?? leftRailLabel }}</span>
        </slot>
      </button>
      <div
        class="workbench-layout__pane workbench-layout__pane--queue"
        :class="{ 'workbench-layout__pane--queue-open': narrowQueueOpen }"
        data-workbench-pane="queue"
        :data-mobile-active="mobileScreen === 'queue' || undefined"
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
      >
        <slot name="detail" />
      </div>
      <div
        class="workbench-layout__pane workbench-layout__pane--context"
        data-workbench-pane="context"
        :data-mobile-active="mobileScreen === 'context' || undefined"
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

  .workbench-layout__pane--queue-open {
    position: absolute;
    z-index: 30;
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
    grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
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
