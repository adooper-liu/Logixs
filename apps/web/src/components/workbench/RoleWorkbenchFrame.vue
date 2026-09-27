<script setup lang="ts">
import { BriefcaseBusiness, Container } from "@lucide/vue";
import { computed } from "vue";
import type { ContainerSummary } from "../../api/containers";
import type { LiveNodeView } from "../../data/liveNodeProjection";
import LiveNodeRail from "../container/LiveNodeRail.vue";
import PageHeader from "../ui/PageHeader.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    summary: string;
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
</script>

<template>
  <main class="role-workbench page-frame">
    <PageHeader eyebrow="岗位工作台" :title="title" :summary="summary">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <section class="context-band" aria-label="岗位与货柜范围">
      <div class="role-context">
        <span class="context-icon" aria-hidden="true">
          <BriefcaseBusiness :size="18" />
        </span>
        <span>
          <small>当前岗位</small>
          <b>{{ workspaceLabel }}</b>
        </span>
        <span class="node-scope">
          <small>负责节点</small>
          <b>{{ nodeScopeLabel }}</b>
        </span>
      </div>

      <slot v-if="$slots.context" name="context" />

      <div
        v-if="!$slots.context && selectedContainer"
        class="container-identity"
      >
        <Container :size="18" aria-hidden="true" />
        <span>
          <b>{{ selectedContainer.containerNumber ?? "未绑箱号" }}</b>
          <small>{{ selectedContainer.orderNumber }}</small>
        </span>
      </div>
    </section>

    <p v-if="containerListError" class="notice notice--error" role="alert">
      {{ containerListError }}
    </p>
    <p v-if="!hasContext" class="notice">
      {{ emptyMessage }}
    </p>
    <p v-else-if="selectionLoading" class="notice">
      {{ loadingMessage }}
    </p>
    <p v-else-if="selectionError" class="notice notice--error" role="alert">
      {{ selectionError }}
    </p>

    <template v-if="selectedContainer && !selectionLoading && !selectionError">
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

    <div
      class="workbench-grid"
      :class="{ 'workbench-grid--queue-only': !hasContext }"
    >
      <section
        class="workbench-pane workbench-pane--queue"
        aria-label="岗位任务池"
      >
        <slot name="queue" />
      </section>
      <section v-if="hasContext" class="workbench-pane" aria-label="岗位事实">
        <slot name="primary" />
      </section>
      <section v-if="hasContext" class="workbench-pane" aria-label="岗位待办">
        <slot name="secondary" />
      </section>
    </div>
  </main>
</template>

<style scoped>
.role-workbench {
  min-width: 0;
}

.context-band {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(250px, 0.8fr) minmax(180px, 0.65fr);
  align-items: stretch;
  margin-bottom: var(--space-3);
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.role-context,
.container-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
}

.role-context {
  border-right: 1px solid var(--line);
}

.role-context > span:not(.context-icon),
.container-identity > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.context-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.node-scope {
  margin-left: auto;
  padding-left: var(--space-3);
  border-left: 1px solid var(--line);
}

.role-context small,
.container-identity small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.role-context b,
.container-identity b {
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}

.container-identity > svg {
  flex: none;
  color: var(--brand-strong);
}

.notice,
.projection-warnings {
  margin: 0 0 var(--space-3);
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

.workbench-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(280px, 0.7fr) minmax(520px, 1.5fr) minmax(
      300px,
      0.8fr
    );
  gap: var(--space-3);
  align-items: start;
}

.workbench-pane--queue {
  position: sticky;
  top: 12px;
}

.workbench-grid--queue-only {
  grid-template-columns: minmax(280px, 420px);
}

.workbench-pane {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

@media (max-width: 1280px) {
  .context-band {
    grid-template-columns: 1fr 1fr;
  }

  .workbench-grid {
    grid-template-columns: minmax(280px, 0.7fr) minmax(0, 1.3fr);
  }

  .workbench-pane:last-child {
    grid-column: 1 / -1;
  }

  .workbench-pane--queue {
    position: static;
  }
}

@media (max-width: 680px) {
  .context-band {
    grid-template-columns: 1fr;
  }

  .role-context {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .node-scope {
    margin-left: 0;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
  }

  .workbench-pane:last-child {
    grid-column: auto;
  }
}
</style>
