<script setup lang="ts">
import { BriefcaseBusiness, Container } from "@lucide/vue";
import type { ContainerSummary } from "../../api/containers";
import type { LiveNodeView } from "../../data/liveNodeProjection";
import LiveNodeRail from "../container/LiveNodeRail.vue";
import PageHeader from "../ui/PageHeader.vue";

defineProps<{
  title: string;
  summary: string;
  workspaceLabel: string;
  nodeScopeLabel: string;
  containers: readonly ContainerSummary[];
  selectedContainerId: string;
  selectedContainer: ContainerSummary | null;
  nodes: readonly LiveNodeView[];
  containerListLoading: boolean;
  selectionLoading: boolean;
  containerListError: string;
  selectionError: string;
  warnings: readonly { code: string; message: string }[];
}>();

const emit = defineEmits<{
  selectContainer: [containerId: string];
}>();

defineSlots<{
  actions(): unknown;
  queue(): unknown;
  primary(): unknown;
  secondary(): unknown;
}>();

function selectContainer(event: Event): void {
  emit("selectContainer", (event.target as HTMLSelectElement).value);
}
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

      <label class="container-selector">
        <span>当前货柜</span>
        <select
          data-testid="workbench-container-select"
          :value="selectedContainerId"
          :disabled="containerListLoading"
          @change="selectContainer"
        >
          <option value="">
            {{ containerListLoading ? "货柜加载中" : "选择货柜" }}
          </option>
          <option v-for="item in containers" :key="item.id" :value="item.id">
            {{ item.containerNumber ?? "未绑箱号" }} · {{ item.orderNumber }}
          </option>
        </select>
      </label>

      <div v-if="selectedContainer" class="container-identity">
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
    <p v-if="!selectedContainerId" class="notice">
      从任务池选择工作，或直接选择货柜查看{{ workspaceLabel }}事实。
    </p>
    <p v-else-if="selectionLoading" class="notice">
      正在加载这柜的{{ workspaceLabel }}事实…
    </p>
    <p v-else-if="selectionError" class="notice notice--error" role="alert">
      {{ selectionError }}
    </p>

    <template v-if="selectedContainer && !selectionLoading && !selectionError">
      <LiveNodeRail v-if="nodes.length" :nodes="nodes" />
      <p v-else class="notice">这柜尚未初始化生命周期流程。</p>

      <ul
        v-if="warnings.length"
        class="projection-warnings"
        aria-label="局部数据提示"
      >
        <li v-for="warning in warnings" :key="warning.code">
          {{ warning.message }}
        </li>
      </ul>
    </template>

    <div
      class="workbench-grid"
      :class="{ 'workbench-grid--queue-only': !selectedContainer }"
    >
      <section
        class="workbench-pane workbench-pane--queue"
        aria-label="岗位任务池"
      >
        <slot name="queue" />
      </section>
      <section
        v-if="selectedContainer"
        class="workbench-pane"
        aria-label="岗位事实"
      >
        <slot name="primary" />
      </section>
      <section
        v-if="selectedContainer"
        class="workbench-pane"
        aria-label="岗位待办"
      >
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
  grid-template-columns: minmax(250px, 0.8fr) minmax(280px, 1fr) minmax(
      180px,
      0.65fr
    );
  align-items: stretch;
  margin-bottom: 12px;
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
  gap: 10px;
  padding: 10px 12px;
}

.role-context {
  border-right: 1px solid var(--line);
}

.role-context > span:not(.context-icon),
.container-identity > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  padding-left: 12px;
  border-left: 1px solid var(--line);
}

.role-context small,
.container-identity small,
.container-selector > span {
  color: var(--muted);
  font-size: 10px;
}

.role-context b,
.container-identity b {
  overflow-wrap: anywhere;
  font-size: 13px;
}

.container-selector {
  min-width: 0;
  display: grid;
  gap: 4px;
  padding: 9px 12px;
  border-right: 1px solid var(--line);
}

.container-selector select {
  min-width: 0;
  min-height: 36px;
  padding: 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}

.container-identity > svg {
  flex: none;
  color: var(--brand-strong);
}

.notice,
.projection-warnings {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-left: 3px solid var(--info);
  background: var(--info-bg);
  color: var(--ink-soft);
  font-size: 12px;
}

.notice--error {
  border-left-color: var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.projection-warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding-left: 28px;
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
  gap: 12px;
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

  .container-identity {
    grid-column: 1 / -1;
    border-top: 1px solid var(--line);
  }

  .container-selector {
    border-right: 0;
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

  .role-context,
  .container-selector {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .container-identity {
    grid-column: auto;
    border-top: 0;
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
