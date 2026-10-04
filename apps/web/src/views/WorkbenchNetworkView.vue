<script setup lang="ts">
import {
  ArrowRight,
  CircleCheck,
  Construction,
  MousePointer2,
} from "@lucide/vue";
import { computed } from "vue";
import PageHeader from "../components/ui/PageHeader.vue";
import WorkbenchOperationalSpecPanel from "../components/workbench/WorkbenchOperationalSpecPanel.vue";
import {
  getOutboundWorkbenchRelations,
  mainWorkbenchChain,
  supportingWorkbenches,
  workbenchOperationalSpecs,
  workbenchPhaseLabels,
  type WorkbenchOperationalSpec,
  type WorkbenchPhase,
  type WorkbenchStage,
} from "../data/workbenchNetwork";

const phaseOrder: readonly WorkbenchPhase[] = [
  "strategy",
  "product",
  "supply",
  "shipment",
  "arrival",
];

const phases = computed(() =>
  phaseOrder.map((phase) => ({
    code: phase,
    label: workbenchPhaseLabels[phase],
    items: mainWorkbenchChain.filter((item) => item.phase === phase),
  })),
);

// 交接是节点之间的关系，画在连接处；链尾没有出向交接就不画连接。
function outboundLabel(stage: WorkbenchStage): string | null {
  const relations = getOutboundWorkbenchRelations(stage.code);
  if (relations.length === 0) return null;
  if (relations.length === 1) return relations[0]!.label;
  return `${relations.length} 项出向交接`;
}

const exceptionCenter = computed(() =>
  supportingWorkbenches.find((stage) => stage.code === "exceptions"),
);

// 岗位作业规格：网络里的字段说明"这个岗位在链上的位置"，
// 规格说明"他具体怎么干"。未定义 = 尚未梳理，不是"没有要求"。
const specByCode = computed<Record<string, WorkbenchOperationalSpec>>(() =>
  Object.fromEntries(
    workbenchOperationalSpecs.map((item) => [item.code, item]),
  ),
);

const definedSpecCount = computed(() => workbenchOperationalSpecs.length);
const totalStageCount = computed(
  () => mainWorkbenchChain.length + supportingWorkbenches.length,
);
</script>

<template>
  <main class="network-page page-frame">
    <PageHeader
      eyebrow="端到端业务接力"
      title="业务工作台"
      summary="从市场机会到还箱收口，按事实产生顺序进入正确岗位；实施状态只说明技术链路是否接入，不代表岗位业务已经通过复审。"
    />

    <section class="volume-band" aria-label="全局业务量">
      <dl>
        <div>
          <dt>在办</dt>
          <dd>—</dd>
        </div>
        <div>
          <dt>本周流转</dt>
          <dd>—</dd>
        </div>
        <div>
          <dt>阻塞</dt>
          <dd>—</dd>
        </div>
      </dl>
      <p>
        尚无业务量投影：各台在办与阻塞的计数口径确定并由服务端提供前，这里不显示数字。
      </p>
      <RouterLink v-if="exceptionCenter" :to="exceptionCenter.path">
        进入异常中心 <ArrowRight :size="15" aria-hidden="true" />
      </RouterLink>
    </section>

    <section class="network-legend" aria-label="工作台实施状态说明">
      <span><CircleCheck :size="16" aria-hidden="true" /> 已接真实能力</span>
      <span><MousePointer2 :size="16" aria-hidden="true" /> 交互样板</span>
      <span><Construction :size="16" aria-hidden="true" /> 框架已建立</span>
      <p>
        已接真实能力只表示页面连接了真实 API
        或写入链路，不代表业务闭环已经验收；交互样板和框架节点也不得冒充已落库能力。
        <b
          >已有技术操作映射 {{ definedSpecCount }} /
          {{ totalStageCount }} 个工作台</b
        >，这些映射仍须逐台对照业务规格复审。
      </p>
    </section>

    <section
      v-for="phase in phases"
      :key="phase.code"
      class="phase-band"
      :aria-labelledby="`phase-${phase.code}`"
    >
      <header class="phase-heading">
        <span>{{
          String(phaseOrder.indexOf(phase.code) + 1).padStart(2, "0")
        }}</span>
        <h2 :id="`phase-${phase.code}`">{{ phase.label }}</h2>
      </header>

      <ol class="stage-grid">
        <li
          v-for="stage in phase.items"
          :key="stage.code"
          class="stage-item"
          :class="`stage-item--${stage.implementation}`"
          data-testid="main-workbench-stage"
          :data-implementation="stage.implementation"
        >
          <div class="stage-card">
            <RouterLink class="stage-link" :to="stage.path">
              <div class="stage-topline">
                <span class="stage-number">{{ stage.sequence }}</span>
                <span class="stage-status">
                  <CircleCheck
                    v-if="stage.implementation === 'live'"
                    :size="14"
                    aria-hidden="true"
                  />
                  <MousePointer2
                    v-else-if="stage.implementation === 'prototype'"
                    :size="14"
                    aria-hidden="true"
                  />
                  <Construction v-else :size="14" aria-hidden="true" />
                  {{
                    stage.implementation === "live"
                      ? "已接能力"
                      : stage.implementation === "prototype"
                        ? "可体验"
                        : "待接通"
                  }}
                </span>
              </div>
              <h3>{{ stage.title }}</h3>
              <p>{{ stage.roleResult }}</p>
            </RouterLink>

            <details v-if="specByCode[stage.code]" class="stage-spec">
              <summary>已有技术操作映射 · 展开查看</summary>
              <WorkbenchOperationalSpecPanel :spec="specByCode[stage.code]!" />
            </details>
          </div>
          <p
            v-if="outboundLabel(stage)"
            class="stage-connector"
            :data-from="stage.code"
          >
            <ArrowRight :size="14" aria-hidden="true" />
            <span>{{ outboundLabel(stage) }}</span>
          </p>
        </li>
      </ol>
    </section>

    <section class="support-band" aria-labelledby="support-title">
      <header class="support-heading">
        <span>支撑模块</span>
        <h2 id="support-title">不改变主链顺序，但持续消费主链事实</h2>
      </header>
      <div class="support-grid">
        <RouterLink
          v-for="stage in supportingWorkbenches"
          :key="stage.code"
          class="support-link"
          :to="stage.path"
          data-testid="support-workbench-stage"
        >
          <div>
            <small>{{ stage.ownerRole }}</small>
            <h3>{{ stage.title }}</h3>
          </div>
          <p>{{ stage.roleResult }}</p>
          <ArrowRight :size="17" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.network-page {
  gap: var(--space-5);
}

.network-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-5);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--brand);
  background: var(--surface);
}

.network-legend span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--ink);
  font-size: var(--text-label);
  font-weight: 600;
}

.network-legend span:first-child svg {
  color: var(--ok);
}

.volume-band {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.volume-band dl {
  display: flex;
  gap: var(--space-5);
  margin: 0;
}

.volume-band dt {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 600;
}

.volume-band dd {
  margin: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--text-title);
  font-weight: 700;
}

.volume-band p {
  flex: 1 1 280px;
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.volume-band a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: 600;
  text-decoration: none;
}

.volume-band a:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.network-legend p {
  flex: 1 1 320px;
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  text-align: right;
}

.phase-band {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(150px, 0.2fr) minmax(0, 1fr);
  gap: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-strong);
}

.phase-heading {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.phase-heading span {
  color: var(--brand);
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: 700;
}

.phase-heading h2,
.support-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--leading-title);
}

.stage-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.stage-item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stage-card {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

/* 交接画在卡片外的连接处：虚线引出，不占卡面。 */
.stage-connector {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  padding-left: var(--space-3);
  border-left: 1px dashed var(--line-strong);
  margin-left: var(--space-3);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.stage-connector svg {
  flex: none;
  color: var(--muted);
}

.stage-link {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  color: inherit;
  text-decoration: none;
}

.stage-link:hover {
  background: var(--surface-2);
}

.stage-link:focus-visible,
.support-link:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.stage-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.stage-number {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--text-micro);
}

.stage-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 600;
}

.stage-item--live .stage-status svg {
  color: var(--ok);
}

.stage-item--prototype .stage-status svg {
  color: var(--info);
}

.stage-link h3,
.support-link h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-meta);
  line-height: var(--leading-title);
}

.stage-link p,
.support-link p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

/* 岗位作业规格：展开在卡片内，不跳页 —— 与卡片链接是同级，避免交互嵌套。 */
.stage-spec {
  border-top: 1px solid var(--line);
}

.stage-spec > summary {
  padding: var(--space-2) var(--space-3);
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
  cursor: pointer;
}

.stage-spec > summary:focus-visible {
  outline: 0;
  box-shadow: inset var(--focus-ring);
}

.support-band {
  display: grid;
  grid-template-columns: minmax(180px, 0.3fr) minmax(0, 1fr);
  gap: var(--space-5);
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface-2);
}

.support-heading span {
  display: block;
  margin-bottom: var(--space-1);
  color: var(--brand);
  font-size: var(--text-micro);
  font-weight: 700;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.support-link {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}

.support-link small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.support-link svg {
  color: var(--brand-strong);
}

@media (max-width: 959px) {
  .phase-band,
  .support-band {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .network-legend p {
    text-align: left;
  }
}

@media (max-width: 680px) {
  .stage-grid,
  .support-grid {
    grid-template-columns: 1fr;
  }

  .support-link {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .support-link p {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
