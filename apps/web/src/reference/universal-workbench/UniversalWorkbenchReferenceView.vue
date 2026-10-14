<script setup lang="ts">
import { computed, ref } from "vue";
import type { WorkSessionV1 } from "@logix/contracts";
import { useRouter } from "vue-router";
import WorkbenchDecisionStrip from "../../components/workbench/WorkbenchDecisionStrip.vue";
import WorkbenchLayout from "../../components/workbench/WorkbenchLayout.vue";
import WorkbenchPageHeader from "../../components/workbench/WorkbenchPageHeader.vue";
import WorkbenchPane from "../../components/workbench/WorkbenchPane.vue";
import WorkbenchResponsibilityBand from "../../components/workbench/WorkbenchResponsibilityBand.vue";
import WorkbenchSessionSwitcher from "../../components/workbench/WorkbenchSessionSwitcher.vue";
import type { WorkbenchMobileScreen } from "../../components/workbench/workbenchLayout.types";
import {
  referenceScenarios,
  referenceSessions,
  syntheticNotice,
  type ReferenceScenarioKey,
} from "./referenceScenarios";

const props = withDefaults(
  defineProps<{
    scenarioControlsOpen?: boolean;
  }>(),
  { scenarioControlsOpen: undefined },
);

const scenarioControlsInitiallyOpen = computed(
  () =>
    props.scenarioControlsOpen ??
    window.matchMedia("(min-width: 681px)").matches,
);

const router = useRouter();
const scenarioKey = ref<ReferenceScenarioKey>("working");
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const mobileScreen = ref<WorkbenchMobileScreen>("queue");
const selectedItem = ref("pricing");
const editing = ref(false);
const moreMenuOpen = ref(false);
const currentSession = ref("selection");
const sessionFeedback = ref("");

const scenario = computed(() => referenceScenarios[scenarioKey.value]);
const sessions = computed<WorkSessionV1[]>(() =>
  referenceSessions.map((session, index) => ({
    contractVersion: "work-session.v1",
    sessionId: session.id,
    version: 1,
    status:
      session.id === currentSession.value
        ? "current"
        : session.status === "current"
          ? "resumable"
          : session.status,
    workbenchCode: "product_selection",
    contextKey: `reference:${session.id}`,
    routeContext: {
      kind: "product_selection.v1",
      handoffId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    },
    subjectRef: {
      kind: "product_initiative_handoff",
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    },
    displaySummary: session.label,
    lastOpenedAt: "2026-10-11T08:00:00.000Z",
    createdAt: "2026-10-11T08:00:00.000Z",
    updatedAt: "2026-10-11T08:00:00.000Z",
  })),
);

function selectScenario(key: ReferenceScenarioKey): void {
  scenarioKey.value = key;
  editing.value = false;
}

function startEditing(): void {
  selectedItem.value = "pricing";
  editing.value = true;
  mobileScreen.value = "context";
}

function stopEditing(): void {
  editing.value = false;
  mobileScreen.value = "detail";
}

async function switchSession(session: WorkSessionV1) {
  if (scenarioKey.value === "dirty-session") {
    sessionFeedback.value = "草稿保存失败，仍停留在当前工作现场";
    return { kind: "failed" as const, message: sessionFeedback.value };
  }
  sessionFeedback.value = "";
  currentSession.value = session.sessionId;
  return {
    kind: "switched" as const,
    session: { ...session, status: "current" as const },
  };
}
</script>

<template>
  <main class="reference-page page-frame">
    <p class="reference-notice" role="note">{{ syntheticNotice }}</p>
    <details class="reference-scenarios" :open="scenarioControlsInitiallyOpen">
      <summary>参考场景 · {{ scenarioKey }}</summary>
      <div class="reference-scenarios__controls" aria-label="参考场景">
        <button
          v-for="key in Object.keys(
            referenceScenarios,
          ) as ReferenceScenarioKey[]"
          :key="key"
          type="button"
          :data-scenario="key"
          :aria-pressed="scenarioKey === key"
          @click="selectScenario(key)"
        >
          {{ key }}
        </button>
      </div>
    </details>
    <p v-if="sessionFeedback" class="reference-feedback" role="alert">
      {{ sessionFeedback }}
    </p>

    <WorkbenchLayout
      v-model:left-collapsed="leftCollapsed"
      v-model:right-collapsed="rightCollapsed"
      v-model:mobile-screen="mobileScreen"
      left-rail-label="对象与任务队列"
      right-rail-label="当前事项操作上下文"
      left-rail-summary="合成机会 · 2 待办"
      right-rail-summary="2 阻塞 · 1 动作"
    >
      <template #header>
        <WorkbenchPageHeader
          stage-code="product_selection"
          eyebrow="结构参考 · 选品岗位"
        >
          <template #switcher>
            <WorkbenchSessionSwitcher
              :sessions="sessions"
              :on-select="switchSession"
              trigger-label="切换工作现场（结构参考）"
            />
          </template>
          <template #moreFunctions>
            <div class="reference-menu">
              <button
                type="button"
                aria-label="更多关联功能（结构参考）"
                @click="moreMenuOpen = !moreMenuOpen"
              >
                更多功能
              </button>
              <div v-if="moreMenuOpen" class="reference-menu__panel">
                <button
                  type="button"
                  @click="
                    router.push(
                      '/__reference/universal-workbench/linked-feature',
                    )
                  "
                >
                  关联子功能结构参考
                </button>
              </div>
            </div>
          </template>
        </WorkbenchPageHeader>
      </template>

      <template #responsibility>
        <WorkbenchResponsibilityBand
          region-label="岗位、对象与责任上下文"
          :items="scenario.responsibility"
        />
      </template>

      <template #decision>
        <WorkbenchDecisionStrip
          region-label="当前结论与办理缺口"
          :conclusion="scenario.conclusion"
          :disabled-reason="scenario.disabledReason"
          :tone="
            scenarioKey === 'failed' || scenarioKey === 'conflict'
              ? 'risk'
              : 'info'
          "
        >
          <template v-if="scenario.progressLabel" #progress>
            <b>{{ scenario.progressLabel }}</b>
          </template>
          <template #gaps>
            <button
              type="button"
              data-item="pricing"
              :class="{ 'is-selected': selectedItem === 'pricing' }"
              @click="startEditing"
            >
              价格带证据
            </button>
            <button type="button" data-item="risk">风险依据</button>
          </template>
          <template #action>
            <button type="button" :disabled="Boolean(scenario.disabledReason)">
              唯一主动作
            </button>
          </template>
        </WorkbenchDecisionStrip>
      </template>

      <template #queue>
        <WorkbenchPane
          id="reference-queue"
          title="对象与任务队列"
          region-label="对象与任务队列"
        >
          <button type="button" class="reference-item is-selected">
            合成机会 REF-001
          </button>
          <button type="button" class="reference-item">合成机会 REF-002</button>
        </WorkbenchPane>
      </template>
      <template #queueRail>
        <strong>REF</strong>
        <span>2 待办</span>
      </template>

      <template #detail>
        <WorkbenchPane
          id="reference-detail"
          :title="scenario.detailTitle"
          region-label="事实、缺口与推进任务"
        >
          <button
            type="button"
            data-item="pricing"
            :class="[
              'reference-item',
              { 'is-selected': selectedItem === 'pricing' },
            ]"
            @click="startEditing"
          >
            价格带证据
          </button>
          <p v-for="line in scenario.detailBody" :key="line">{{ line }}</p>
        </WorkbenchPane>
      </template>

      <template #context>
        <WorkbenchPane
          id="reference-context"
          :title="editing ? '编辑价格带证据' : scenario.contextTitle"
          region-label="当前事项操作上下文"
        >
          <template v-if="editing">
            <button
              type="button"
              aria-label="返回事项上下文"
              @click="stopEditing"
            >
              返回
            </button>
            <p>正在编辑：价格带证据</p>
            <label>证据说明 <input value="合成草稿" /></label>
          </template>
          <template v-else>
            <p v-for="line in scenario.contextBody" :key="line">{{ line }}</p>
          </template>
        </WorkbenchPane>
      </template>
      <template #contextRail>
        <span>2 阻塞 · 1 动作</span>
      </template>
      <template #mobileBreadcrumb="{ screen }">
        <p>合成机会 REF-001 · {{ screen }}</p>
      </template>
    </WorkbenchLayout>
  </main>
</template>

<style scoped>
.reference-page {
  min-width: 0;
}

.reference-notice {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--line-strong);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.reference-feedback {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
  font-size: var(--text-label);
}

.reference-scenarios {
  margin-bottom: var(--space-3);
}

.reference-scenarios summary {
  display: none;
  cursor: pointer;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.reference-scenarios__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.reference-scenarios__controls button,
.reference-menu button,
.reference-item,
.reference-page :deep(.decision-strip button),
.reference-page :deep(.workbench-pane button) {
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
}

.reference-scenarios__controls button[aria-pressed="true"],
.is-selected {
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-weight: 600;
}

.reference-menu {
  position: relative;
}

.reference-menu__panel {
  min-width: 14rem;
  position: absolute;
  z-index: 20;
  top: calc(100% + var(--space-1));
  right: 0;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-overlay);
}

.reference-menu__panel button[aria-current="true"] {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.reference-page :deep(.workbench-pane__scroll) {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  padding: var(--space-3);
}

.reference-page :deep(.workbench-pane p) {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}
@media (max-width: 680px) {
  .reference-scenarios summary {
    display: list-item;
  }
}
</style>
