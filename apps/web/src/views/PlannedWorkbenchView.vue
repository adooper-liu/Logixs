<script setup lang="ts">
import { ArrowLeft, ArrowRight, Construction } from "@lucide/vue";
import { computed } from "vue";
import WorkbenchFlowContext from "../components/workbench/WorkbenchFlowContext.vue";
import WorkbenchOperationalSpecPanel from "../components/workbench/WorkbenchOperationalSpecPanel.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import {
  getWorkbenchHandoff,
  getWorkbenchOperationalSpec,
  getWorkbenchStage,
  type WorkbenchHandoff,
} from "../data/workbenchNetwork";

const props = defineProps<{ stageCode: string }>();

const stage = computed(() => getWorkbenchStage(props.stageCode));
const operationalSpec = computed(() =>
  getWorkbenchOperationalSpec(props.stageCode),
);
const inbound = computed(() =>
  getWorkbenchHandoff(stage.value?.inboundHandoffCode ?? null),
);
const outbound = computed(() =>
  getWorkbenchHandoff(stage.value?.outboundHandoffCode ?? null),
);
const consumedHandoffs = computed(() =>
  (stage.value?.consumesHandoffCodes ?? [])
    .map((code) => getWorkbenchHandoff(code))
    .filter((item): item is WorkbenchHandoff => item !== null),
);
const upstream = computed(() =>
  inbound.value ? getWorkbenchStage(inbound.value.from) : undefined,
);
const downstream = computed(() =>
  outbound.value ? getWorkbenchStage(outbound.value.to) : undefined,
);
</script>

<template>
  <main v-if="stage" class="planned-page page-frame">
    <PageHeader
      eyebrow="业务工作台 · 框架"
      :title="stage.title"
      :summary="stage.roleResult"
    />

    <WorkbenchFlowContext
      :stage="stage"
      :inbound="inbound"
      :outbound="outbound"
    />

    <p class="implementation-notice">
      <Construction :size="17" aria-hidden="true" />
      <span>
        <b>框架已建立，业务能力待接通</b>
        当前页面固定岗位目标和交接边界；在领域事实、权限、事务与审计实现前，不提供虚假执行按钮。
      </span>
    </p>

    <div class="planned-grid">
      <section class="planned-block" aria-labelledby="role-result-title">
        <span class="block-index">01</span>
        <div>
          <small>岗位结果</small>
          <h2 id="role-result-title">{{ stage.ownerRole }}要完成什么</h2>
          <p>{{ stage.roleResult }}</p>
        </div>
      </section>

      <section class="planned-block" aria-labelledby="required-facts-title">
        <span class="block-index">02</span>
        <div>
          <small>开始工作前</small>
          <h2 id="required-facts-title">需要看到的事实</h2>
          <ul>
            <li v-for="fact in stage.requiredFacts" :key="fact">{{ fact }}</li>
          </ul>
        </div>
      </section>

      <section class="planned-block" aria-labelledby="handoff-result-title">
        <span class="block-index">03</span>
        <div>
          <small>{{
            stage.kind === "support" ? "横向接入" : "完成工作后"
          }}</small>
          <h2 id="handoff-result-title">
            {{ stage.kind === "support" ? "消费哪些主链事实" : "交出什么" }}
          </h2>
          <template v-if="outbound">
            <b class="handoff-name">{{ outbound.name }}</b>
            <p>{{ outbound.timing }}</p>
            <ul>
              <li v-for="fact in outbound.facts" :key="fact">{{ fact }}</li>
            </ul>
          </template>
          <ul v-else-if="consumedHandoffs.length" class="consumed-list">
            <li v-for="handoff in consumedHandoffs" :key="handoff.code">
              {{ handoff.name }}
            </li>
          </ul>
          <p v-else>以可核验的业务回执完成当前主链责任。</p>
        </div>
      </section>
    </div>

    <section
      v-if="operationalSpec"
      class="planned-spec"
      aria-labelledby="planned-spec-title"
    >
      <header>
        <small>岗位作业规格</small>
        <h2 id="planned-spec-title">这个岗位具体怎么干</h2>
        <p>
          上面三块说明他在链上的位置；这里是他能做的动作、系统替他做什么、缺资料时怎么继续、以及不许越的线。
        </p>
      </header>
      <WorkbenchOperationalSpecPanel :spec="operationalSpec" />
    </section>

    <nav class="adjacent-navigation" aria-label="相邻工作台">
      <RouterLink v-if="upstream" :to="upstream.path">
        <ArrowLeft :size="16" aria-hidden="true" />
        上游：{{ upstream.title }}
      </RouterLink>
      <RouterLink class="directory-link" to="/workspaces">
        返回业务工作台
      </RouterLink>
      <RouterLink v-if="downstream" :to="downstream.path">
        下游：{{ downstream.title }}
        <ArrowRight :size="16" aria-hidden="true" />
      </RouterLink>
    </nav>
  </main>

  <main v-else class="planned-page page-frame">
    <PageHeader
      eyebrow="业务工作台"
      title="未找到工作台"
      summary="该工作台不在当前业务链目录中。"
    />
    <RouterLink class="directory-link" to="/workspaces">
      返回业务工作台
    </RouterLink>
  </main>
</template>

<style scoped>
.planned-page {
  gap: var(--space-4);
}

.implementation-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--info);
  background: var(--info-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.implementation-notice svg {
  flex: none;
  margin-top: var(--space-1);
  color: var(--info);
}

.implementation-notice span {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.implementation-notice b {
  color: var(--ink);
}

.planned-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.planned-spec {
  display: grid;
  gap: var(--space-2);
}

.planned-spec > header small {
  color: var(--brand);
  font-size: var(--text-micro);
  font-weight: 700;
}

.planned-spec > header h2 {
  margin: var(--space-1) 0 0;
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.planned-spec > header p {
  margin: var(--space-1) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

/* 规格面板自带内边距，外层不再叠一层。 */
.planned-spec :deep(.operational-spec) {
  padding: 0;
  border-top: 0;
  background: transparent;
}

.planned-block {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-content: start;
  min-height: 230px;
  padding: var(--space-4);
  border-top: 3px solid var(--line-strong);
  background: var(--surface);
}

.planned-block:last-child {
  border-top-color: var(--brand);
}

.block-index {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--text-micro);
  font-weight: 700;
}

.planned-block > div {
  min-width: 0;
}

.planned-block small {
  color: var(--brand);
  font-size: var(--text-micro);
  font-weight: 700;
}

.planned-block h2 {
  margin: var(--space-1) 0 var(--space-3);
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.planned-block p,
.planned-block li {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

.planned-block p {
  margin: 0;
}

.planned-block ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
}

.handoff-name {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--brand-strong);
  font-size: var(--text-meta);
}

.handoff-name + p {
  margin-bottom: var(--space-3);
}

.consumed-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.adjacent-navigation {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}

.adjacent-navigation a,
.directory-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 600;
  text-decoration: none;
}

.adjacent-navigation a:last-child {
  justify-self: end;
  text-align: right;
}

.adjacent-navigation .directory-link {
  justify-self: center;
}

@media (max-width: 900px) {
  .planned-grid {
    grid-template-columns: 1fr;
  }

  .planned-block {
    min-height: 0;
  }
}

@media (max-width: 680px) {
  .adjacent-navigation {
    grid-template-columns: 1fr;
  }

  .adjacent-navigation a,
  .adjacent-navigation a:last-child,
  .adjacent-navigation .directory-link {
    justify-self: start;
    text-align: left;
  }
}
</style>
