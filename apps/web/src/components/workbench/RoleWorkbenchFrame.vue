<script setup lang="ts">
import { computed } from "vue";
import type { ContainerSummary } from "../../api/containers";
import type { LiveNodeView } from "../../data/liveNodeProjection";
import LiveNodeRail from "../container/LiveNodeRail.vue";
import WorkbenchLayout from "./WorkbenchLayout.vue";
import WorkbenchPageHeader from "./WorkbenchPageHeader.vue";
import WorkbenchPane from "./WorkbenchPane.vue";
import WorkbenchResponsibilityBand from "./WorkbenchResponsibilityBand.vue";
import type {
  WorkbenchPaneState,
  WorkbenchResponsibilityItem,
} from "./workbenchLayout.types";

const props = withDefaults(
  defineProps<{
    stageCode: import("../../data/workbenchPurposes.generated").WorkbenchCode;
    embedded?: boolean;
    workspaceLabel: string;
    nodeScopeLabel: string;
    selectedContainer: ContainerSummary | null;
    nodes: readonly LiveNodeView[];
    selectionLoading: boolean;
    containerListError: string;
    selectionError: string;
    warnings: readonly { code: string; message: string }[];
    contextReady?: boolean;
    emptyMessage?: string;
    loadingMessage?: string;
  }>(),
  {
    embedded: false,
    contextReady: undefined,
    emptyMessage: "从左侧任务队列选择一项工作，查看事实与当前可执行动作。",
    loadingMessage: "正在加载当前岗位事实…",
  },
);

defineSlots<{
  actions(): unknown;
  context(): unknown;
  queue(): unknown;
  primary(): unknown;
  secondary(): unknown;
}>();

const hasContext = computed(
  () => props.contextReady ?? Boolean(props.selectedContainer),
);

const responsibilityItems = computed<readonly WorkbenchResponsibilityItem[]>(
  () => [
    { label: "当前岗位", value: props.workspaceLabel, state: "known" },
    { label: "负责节点", value: props.nodeScopeLabel, state: "known" },
    props.selectedContainer
      ? {
          label: "当前货柜",
          value:
            props.selectedContainer.containerNumber ??
            props.selectedContainer.orderNumber,
          state: "known",
        }
      : { label: "当前货柜", value: null, state: "unknown" },
  ],
);

const detailState = computed<WorkbenchPaneState>(() => {
  if (!hasContext.value) return { kind: "empty", message: props.emptyMessage };
  if (props.selectionLoading)
    return { kind: "loading", message: props.loadingMessage };
  if (props.selectionError)
    return { kind: "error", message: props.selectionError };
  return { kind: "ready" };
});

const contextState = computed<WorkbenchPaneState>(() => {
  if (!hasContext.value)
    return { kind: "empty", message: "选择对象后显示动作。" };
  if (props.selectionLoading)
    return { kind: "loading", message: props.loadingMessage };
  if (props.selectionError)
    return { kind: "error", message: props.selectionError };
  return { kind: "ready" };
});
</script>

<template>
  <component
    :is="embedded ? 'section' : 'main'"
    class="role-workbench"
    :class="{ 'page-frame': !embedded }"
  >
    <WorkbenchLayout
      left-rail-label="岗位任务池"
      right-rail-label="岗位待办"
      :left-rail-summary="selectedContainer?.containerNumber ?? '待选择'"
      :right-rail-summary="hasContext ? '查看动作' : '待选择'"
    >
      <template #header>
        <WorkbenchPageHeader v-if="!embedded" :stage-code="stageCode">
          <template v-if="$slots.actions" #actions>
            <slot name="actions" />
          </template>
        </WorkbenchPageHeader>
      </template>

      <template #responsibility>
        <WorkbenchResponsibilityBand
          :region-label="'岗位与货柜范围'"
          :items="responsibilityItems"
        >
          <template v-if="$slots.context" #tail>
            <slot name="context" />
          </template>
        </WorkbenchResponsibilityBand>
      </template>

      <template #decision>
        <div class="role-workbench__feedback">
          <p
            v-if="containerListError"
            class="notice notice--error"
            role="alert"
          >
            {{ containerListError }}
          </p>
          <template
            v-if="selectedContainer && !selectionLoading && !selectionError"
          >
            <LiveNodeRail v-if="nodes.length" :nodes="nodes" />
            <p v-else class="notice">这柜尚未初始化生命周期流程。</p>
          </template>
          <ul
            v-if="warnings.length"
            class="projection-warnings"
            aria-label="局部数据提示"
          >
            <li v-for="warning in warnings" :key="warning.code">
              {{ warning.message }}
            </li>
          </ul>
        </div>
      </template>

      <template #queue>
        <WorkbenchPane
          id="role-workbench-queue"
          title="岗位任务池"
          :region-label="'岗位任务池'"
        >
          <slot name="queue" />
        </WorkbenchPane>
      </template>

      <template #detail>
        <WorkbenchPane
          id="role-workbench-detail"
          title="岗位事实"
          :region-label="'岗位事实'"
          :state="detailState"
        >
          <slot name="primary" />
        </WorkbenchPane>
      </template>

      <template #context>
        <WorkbenchPane
          id="role-workbench-context"
          title="岗位待办"
          :region-label="'岗位待办'"
          :state="contextState"
        >
          <slot name="secondary" />
        </WorkbenchPane>
      </template>
    </WorkbenchLayout>
  </component>
</template>

<style scoped>
.role-workbench {
  min-width: 0;
  min-height: 0;
}

.role-workbench__feedback:empty {
  display: none;
}

.notice,
.projection-warnings {
  margin: 0;
  padding: var(--space-3);
  border-left: 3px solid var(--info);
  background: var(--info-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.notice--error {
  border-left-color: var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.projection-warnings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-5);
  padding-left: var(--space-8);
  border-left-color: var(--warn);
  background: var(--warn-bg);
}
</style>
