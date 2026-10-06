<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import type { ProductInitiativeReviewPointCodeV1 } from "@logix/contracts";
import { computed, nextTick, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProductEvaluationRequirementsPanel from "../components/product-selection/ProductEvaluationRequirementsPanel.vue";
import ProductInitiativeOutcomePanel from "../components/product-selection/ProductInitiativeOutcomePanel.vue";
import ProductInitiativeGapGroup from "../components/product-selection/ProductInitiativeGapGroup.vue";
import ProductInitiativeResultPanel from "../components/product-selection/ProductInitiativeResultPanel.vue";
import ProductInitiativeReviewPanel from "../components/product-selection/ProductInitiativeReviewPanel.vue";
import ProductOpportunityActions from "../components/product-selection/ProductOpportunityActions.vue";
import ProductOpportunityDetail from "../components/product-selection/ProductOpportunityDetail.vue";
import ProductOpportunityQueue from "../components/product-selection/ProductOpportunityQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import {
  useProductInitiativeDecision,
  type ProductInitiativeOutcome,
  type UnitEconomicsBasisChange,
  type UnitEconomicsEvidenceChange,
  type UnitEconomicsRangeChange,
  type ProductInitiativeGapPanel,
} from "../composables/useProductInitiativeDecision";
import { useProductOpportunityWorkbench } from "../composables/useProductOpportunityWorkbench";
import type { ProductEvaluationEvidenceDraft } from "../data/productEvaluationRequirements";

const route = useRoute();
const router = useRouter();
const requestedId = computed(() => String(route.query.handoffId ?? ""));

async function selectOpportunity(id: string): Promise<void> {
  await router.replace({
    path: "/workspaces/product-selection",
    query: { handoffId: id },
  });
}

const {
  items,
  initiatives,
  selected,
  requirements,
  loading,
  saving,
  error,
  receipt,
  load,
  claim,
  accept,
  addEvidence,
} = useProductOpportunityWorkbench({
  selectedId: requestedId,
  selectOpportunity,
});

// 立项判断只对已接受的机会成立：没接受就去立项，等于把经营团队交来的
// 线索当成已经要做的产品。所以未接受时连判断详情都不读。
const accepted = computed(() => selected.value?.intakeState === "accepted");
const initiativeHandoffId = computed(() =>
  accepted.value ? (selected.value?.handoff.handoffId ?? "") : "",
);
const {
  detail: initiativeDetail,
  initiative,
  decided,
  returnPending,
  objective,
  acceptResponsibility,
  receivingTeamOrRole,
  resourceDescription,
  targetDate,
  nextDecisionDate,
  nextDecisionQuestion,
  reconsiderationDate,
  destination,
  returnBasis,
  currentReason,
  points,
  reviewPointViews,
  requiredCount,
  blockingGapGroups,
  optionalGaps,
  evidenceCandidates,
  currencyOptions,
  marketCode,
  channelCode,
  unitEconomicsDraft,
  unitEconomicsSnapshot,
  negativeContributionNeedsReason,
  negativeConservativeReason,
  loading: readingInitiative,
  saving: deciding,
  error: initiativeError,
  receipt: initiativeReceipt,
  load: loadInitiative,
  setDestination,
  toggleEvidence,
  setUnitEconomicsCurrency,
  setUnitEconomicsRangeValue,
  setUnitEconomicsBasis,
  toggleUnitEconomicsEvidence,
  setNegativeConservativeReason,
  addEvidence: addInitiativeEvidence,
  decide: decideInitiative,
} = useProductInitiativeDecision({
  handoffId: initiativeHandoffId,
  signalId: computed(() => selected.value?.handoff.signalId ?? ""),
  marketCode: computed(() => selected.value?.handoff.marketCode),
  channelCode: computed(() => selected.value?.handoff.channelCode),
});

/**
 * 判断详情读出来之前不摆出判断界面：那时的"还差 5 项"是空草稿而不是这条
 * 机会的真实状态，照着它填完提交会拿版本 0 去撞冲突。
 */
const initiativeReady = computed(
  () =>
    accepted.value &&
    !readingInitiative.value &&
    initiativeDetail.value?.handoffId === initiativeHandoffId.value,
);

const feedbackCanReload = computed(
  () =>
    Boolean(error.value) ||
    Boolean(initiativeError.value && initiativeDetail.value === null),
);

// 接收动作与立项判断共用一个反馈位：谁刚失败就显示谁，不静默吞掉。
const feedbackError = computed(() => initiativeError.value ?? error.value);
const feedbackReceipt = computed(
  () => initiativeReceipt.value ?? receipt.value,
);

/**
 * 本次结果按服务端事实说：已退回／已暂缓／已立项都不再是"形成立项结论"，
 * 否则做完动作还得靠猜才知道机会去了哪。
 */
const workResult = computed(() => {
  switch (initiative.value?.currentDestination) {
    case "handed_off":
      return "已立项并交给产品侧";
    case "deferred":
      return "已暂缓，仍留在选品队列";
    case "rejected":
      return "已记录不立项";
    case "return_requested":
      return "已请求退回市场，等待市场接回";
    case "returned_to_market":
      return "已退回经营团队";
    case "returned_from_npi":
      return "NPI 退回，需再判断";
    default:
      break;
  }
  if (accepted.value) return "形成立项结论";
  return selected.value?.intakeState === "superseded"
    ? "等待新版交接"
    : "领取并接受机会";
});

const currentOwner = computed(() => {
  if (initiative.value?.currentDestination === "handed_off") {
    return initiative.value.receivingTeamOrRole || "历史未记录";
  }
  if (initiative.value?.currentDestination === "returned_to_market") {
    return "经营团队（重新判断）";
  }
  if (initiative.value) {
    return initiative.value.responsibleActorId || "历史未记录";
  }
  if (selected.value?.intakeState === "queued") return "选品团队（待领取）";
  return selected.value?.assignedActorId || "选品负责人";
});

const historicalMissingCategoryCount = computed(() => {
  const item = selected.value;
  if (!item) return 0;
  const supplemented = new Set(item.supplementedFieldCodes);
  return new Set(
    item.handoff.pendingFieldCodes.filter((code) => !supplemented.has(code)),
  ).size;
});

async function reload(): Promise<void> {
  await Promise.all([load(), loadInitiative()]);
}

/** 重新读立项判断：错误横幅的重试与登记证据后刷新候选都走这里。 */
async function reloadInitiative(): Promise<void> {
  await loadInitiative({ keepDraft: true });
}

function setCurrentReason(value: string): void {
  currentReason.value = value;
}

function setReturnBasis(value: typeof returnBasis.value): void {
  returnBasis.value = value;
}

function setObjective(value: string): void {
  objective.value = value;
}

function updateUnitEconomicsRange(change: UnitEconomicsRangeChange): void {
  setUnitEconomicsRangeValue(
    change.scenario,
    change.field,
    change.endpoint,
    change.value,
  );
}

function updateUnitEconomicsBasis(change: UnitEconomicsBasisChange): void {
  setUnitEconomicsBasis(change.scenario, change.field, change.basis);
}

function updateUnitEconomicsEvidence(
  change: UnitEconomicsEvidenceChange,
): void {
  toggleUnitEconomicsEvidence(change.scenario, change.field, change.evidenceId);
}

function setConclusion(
  code: ProductInitiativeReviewPointCodeV1,
  value: string,
): void {
  points[code].conclusion = value;
}

/**
 * 专业要求面板登记的证据同样挂在该信号的证据链上，评审要点的可引用列表
 * 必须跟着更新，否则同一个动作在两个面板里表现不一致。
 */
async function addRequirementEvidence(
  draft: ProductEvaluationEvidenceDraft,
): Promise<boolean> {
  const saved = await addEvidence(draft);
  if (saved) await reloadInitiative();
  return saved;
}

/**
 * 判断落库后连队列一起重读：队列上的立项标记来自服务端投影，不重读的话
 * 刚暂缓的机会在队列里还显示成没处理过。
 */
async function submitDecision(
  outcome: ProductInitiativeOutcome,
): Promise<void> {
  const ok = await decideInitiative(outcome);
  if (ok) await load();
}

const isInitiated = computed(() => decided.value);
watch(isInitiated, async (initiated) => {
  if (!initiated) return;
  await nextTick();
  document
    .querySelector<HTMLElement>(".app-content")
    ?.scrollTo({ top: 0, behavior: "auto" });
});
const activeGapPanel = shallowRef<ProductInitiativeGapPanel>("objective");
watch(
  blockingGapGroups,
  (groups) => {
    if (!groups.some((group) => group.panel === activeGapPanel.value)) {
      activeGapPanel.value = groups[0]?.panel ?? "objective";
    }
  },
  { immediate: true },
);

async function selectGapPanel(panel: ProductInitiativeGapPanel): Promise<void> {
  activeGapPanel.value = panel;
  await nextTick();
  const target = document.querySelector<HTMLElement>(
    '[data-gap-panel="' + panel + '"]',
  );
  target?.scrollIntoView({ block: "nearest" });
  const control = target?.querySelector<HTMLElement>(
    "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), summary",
  );
  (control ?? target)?.focus({ preventScroll: true });
}

const progressFilled = computed(() =>
  Math.max(0, requiredCount.value - blockingGapGroups.value.length),
);
const progressPercent = computed(() =>
  requiredCount.value === 0
    ? 100
    : Math.round((progressFilled.value / requiredCount.value) * 100),
);
</script>
<template>
  <main
    class="selection-workbench page-frame"
    :class="{
      'selection-workbench--decision-ready':
        selected && initiativeReady && !isInitiated,
    }"
  >
    <PageHeader
      :class="{ 'page-header--result': isInitiated }"
      eyebrow="选品岗位工作台"
      title="选品立项"
      :summary="
        isInitiated
          ? returnPending
            ? '等待市场接回；当前责任仍在选品。'
            : '查看已冻结的立项结论与 NPI 交接。'
          : '领取经营团队交来的机会，核对依据与待补项，再决定是否进入正式立项评审。'
      "
    />

    <section v-if="feedbackError" class="feedback feedback--error" role="alert">
      <AlertCircle :size="17" />
      <span>{{ feedbackError }}</span>
      <button v-if="feedbackCanReload" type="button" @click="reload">
        <RefreshCw :size="15" />重新加载
      </button>
    </section>
    <section
      v-else-if="feedbackReceipt && !isInitiated"
      class="feedback feedback--success"
      role="status"
    >
      {{ feedbackReceipt }}
    </section>
    <section class="work-context" aria-label="当前岗位与交接责任">
      <BriefcaseBusiness :size="19" />
      <span><small>谁在工作</small><b>选品负责人</b></span>
      <span
        ><small>本次结果</small><b>{{ workResult }}</b></span
      >
      <span
        ><UserRound :size="16" /><span
          ><small>当前责任</small><b>{{ currentOwner }}</b></span
        ></span
      >
    </section>

    <div class="workbench-grid">
      <section class="pane pane--queue">
        <ProductOpportunityQueue
          :items="items"
          :initiatives="initiatives"
          :selected-id="selected?.handoff.handoffId ?? ''"
          @select="selectOpportunity"
        />
      </section>
      <section class="pane pane--detail">
        <template v-if="selected">
          <p v-if="readingInitiative" class="empty">
            正在读取该机会已有的立项判断
          </p>
          <template v-else>
            <header
              v-if="initiativeReady && !isInitiated"
              class="progress-head"
              aria-label="立项完备度"
            >
              <div class="progress-head__copy">
                <small>立项完备度</small>
                <b
                  >待处理 {{ blockingGapGroups.length }} 类 · 已齐
                  {{ progressFilled }}/{{ requiredCount }}</b
                >
              </div>
              <div
                class="progress-head__bar"
                role="progressbar"
                :aria-valuenow="progressPercent"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span :style="{ width: `${progressPercent}%` }" />
              </div>
            </header>
            <ProductInitiativeGapGroup
              v-if="initiativeReady && !isInitiated"
              :groups="blockingGapGroups"
              :active-panel="activeGapPanel"
              @select="selectGapPanel"
            />
            <ProductInitiativeResultPanel
              v-if="isInitiated && initiative"
              :title="selected.handoff.title"
              :market-code="selected.handoff.marketCode"
              :channel-code="selected.handoff.channelCode"
              :category-ref="selected.handoff.categoryRef"
              :opportunity-statement="selected.handoff.opportunityStatement"
              :observed-fact-summary="selected.handoff.observedFactSummary"
              :hypothesis="selected.handoff.hypothesis"
              :supplemented-fact-count="selected.supplementedFieldCodes.length"
              :historical-missing-category-count="
                historicalMissingCategoryCount
              "
              :initiative="initiative"
              :points="reviewPointViews"
              :candidates="evidenceCandidates"
              :unit-economics-snapshot="unitEconomicsSnapshot"
            />
            <template v-else>
              <ProductOpportunityDetail :item="selected" />
            </template>
            <ProductEvaluationRequirementsPanel
              v-if="!isInitiated"
              :key="initiativeHandoffId"
              :requirements="requirements.requirements"
              :withheld="requirements.withheld"
              :busy="saving"
              :save-evidence="addRequirementEvidence"
            />
            <ProductInitiativeReviewPanel
              v-if="initiativeReady && !isInitiated"
              :key="initiativeHandoffId"
              data-gap-panel="review_points"
              tabindex="-1"
              :points="reviewPointViews"
              :candidates="evidenceCandidates"
              :busy="deciding"
              :add-evidence="addInitiativeEvidence"
              :active="activeGapPanel === 'review_points'"
              @toggle-evidence="toggleEvidence"
              @update-conclusion="setConclusion"
            />
          </template>
        </template>
        <p v-else class="empty">
          {{ loading ? "正在读取经营机会" : "暂无待处理机会" }}
        </p>
      </section>
      <section
        class="pane pane--action"
        :class="{
          'pane--decision': selected && initiativeReady && !isInitiated,
        }"
      >
        <ProductOpportunityActions
          v-if="selected && !accepted"
          :item="selected"
          :busy="saving"
          @claim="claim"
          @accept="accept"
        />
        <p v-else-if="selected && !initiativeReady" class="empty">
          {{
            readingInitiative
              ? "正在读取该机会已有的立项判断"
              : "立项判断没能读出来，请先用上方的“重新加载”再继续。"
          }}
        </p>
        <section
          v-else-if="selected && isInitiated"
          class="initiative-readonly-context"
          :aria-label="returnPending ? '等待市场接回' : '冻结立项结论'"
        >
          <small>{{ returnPending ? "退回请求" : "立项结果" }}</small>
          <h2>{{ returnPending ? "等待市场接回" : "结论已冻结" }}</h2>
          <p v-if="returnPending">
            当前责任仍在选品，市场接回前不提供编辑或重新提交动作。
          </p>
          <p v-else>已交 NPI，当前不提供编辑或重新提交动作。</p>
          <dl>
            <div>
              <dt>{{ returnPending ? "当前责任" : "当前承接" }}</dt>
              <dd>{{ returnPending ? "当前责任仍在选品" : currentOwner }}</dd>
            </div>
          </dl>
        </section>
        <ProductInitiativeOutcomePanel
          v-else-if="selected"
          :outcome="destination"
          :objective="objective"
          :accept-responsibility="acceptResponsibility"
          :receiving-team-or-role="receivingTeamOrRole"
          :resource-description="resourceDescription"
          :target-date="targetDate"
          :next-decision-date="nextDecisionDate"
          :next-decision-question="nextDecisionQuestion"
          :reconsideration-date="reconsiderationDate"
          :reason="currentReason"
          :return-basis="returnBasis"
          :market-code="marketCode"
          :channel-code="channelCode"
          :currency-options="currencyOptions"
          :unit-economics-draft="unitEconomicsDraft"
          :unit-economics-snapshot="unitEconomicsSnapshot"
          :evidence-candidates="evidenceCandidates"
          :negative-contribution-needs-reason="negativeContributionNeedsReason"
          :negative-conservative-reason="negativeConservativeReason"
          :gaps="blockingGapGroups"
          :active-panel="activeGapPanel"
          :optional-gaps="optionalGaps"
          :busy="deciding"
          :decided="decided"
          :return-pending="returnPending"
          @change-outcome="setDestination"
          @update-objective="setObjective"
          @update-accept-responsibility="acceptResponsibility = $event"
          @update-receiving-team-or-role="receivingTeamOrRole = $event"
          @update-resource-description="resourceDescription = $event"
          @update-target-date="targetDate = $event"
          @update-next-decision-date="nextDecisionDate = $event"
          @update-next-decision-question="nextDecisionQuestion = $event"
          @update-reconsideration-date="reconsiderationDate = $event"
          @update-reason="setCurrentReason"
          @update-return-basis="setReturnBasis"
          @update-unit-economics-currency="setUnitEconomicsCurrency"
          @update-unit-economics-range="updateUnitEconomicsRange"
          @update-unit-economics-basis="updateUnitEconomicsBasis"
          @toggle-unit-economics-evidence="updateUnitEconomicsEvidence"
          @update-negative-conservative-reason="setNegativeConservativeReason"
          @submit="submitDecision"
        />
        <p v-else class="empty">选择一条机会后显示接收动作。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.selection-workbench {
  min-width: 0;
}
.progress-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}
.progress-head__copy {
  display: grid;
  gap: var(--space-1);
}
.progress-head__copy small {
  color: var(--muted);
  font-size: var(--text-micro);
  font-weight: 700;
}
.progress-head__copy b {
  color: var(--ink);
  font-size: var(--text-meta);
}
.progress-head__bar {
  grid-column: 1 / -1;
  height: 6px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}
.progress-head__bar > span {
  display: block;
  height: 100%;
  background: var(--brand-strong);
}
.feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--ok);
  background: var(--ok-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
}
.feedback--error {
  border-left-color: var(--risk);
  background: var(--risk-bg);
}
.feedback span {
  flex: 1;
}
.feedback button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
}
.work-context {
  display: grid;
  grid-template-columns: auto repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
}
.work-context > svg {
  color: var(--brand-strong);
}
.work-context > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.work-context > span:last-child {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  padding-left: var(--space-3);
  border-left: 1px solid var(--line);
}
.work-context > span:last-child > svg {
  color: var(--brand-strong);
}
.work-context small {
  color: var(--muted);
  font-size: var(--text-micro);
}
.work-context b {
  color: var(--ink);
  font-size: var(--text-meta);
  overflow-wrap: anywhere;
}
.workbench-grid {
  display: grid;
  grid-template-columns: minmax(250px, 0.7fr) minmax(420px, 1.35fr) minmax(
      290px,
      0.8fr
    );
  grid-template-areas: "queue detail action";
  align-items: start;
  gap: var(--space-3);
}
.pane {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}
.pane--queue {
  grid-area: queue;
}
.pane--detail {
  grid-area: detail;
}
.pane--action {
  grid-area: action;
  position: sticky;
  top: var(--space-3);
  align-self: start;
}
.pane--decision {
  height: clamp(420px, calc(100dvh - var(--topbar-height) - 260px), 660px);
}
.empty {
  margin: 0;
  padding: var(--space-6) var(--space-4);
  color: var(--muted);
  font-size: var(--text-label);
  text-align: center;
}
.initiative-readonly-context {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}
.initiative-readonly-context > small,
.initiative-readonly-context dt {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}
.initiative-readonly-context h2,
.initiative-readonly-context p,
.initiative-readonly-context dl,
.initiative-readonly-context dd {
  margin: 0;
}
.initiative-readonly-context h2,
.initiative-readonly-context dd {
  color: var(--ink);
  font-size: var(--text-meta);
}
.initiative-readonly-context p {
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}
.initiative-readonly-context dl {
  display: grid;
  gap: var(--space-2);
}
.initiative-readonly-context dl > div {
  display: grid;
  gap: var(--space-1);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}
@media (max-width: 1100px) {
  .selection-workbench :deep(.page-header--result .eyebrow) {
    display: none;
  }
  .selection-workbench :deep(.page-header--result .page-heading > p) {
    margin-top: 0;
    font-size: var(--text-micro);
  }
  .work-context {
    margin-bottom: var(--space-2);
  }
  .workbench-grid {
    grid-template-columns: minmax(250px, 0.7fr) minmax(0, 1.3fr);
    grid-template-areas:
      "queue action"
      "detail detail";
  }
  .pane--action {
    position: static;
  }
  .initiative-readonly-context {
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
  }
  .initiative-readonly-context > small {
    display: none;
  }
  .initiative-readonly-context h2 {
    font-size: var(--text-label);
  }
  .initiative-readonly-context p {
    font-size: var(--text-micro);
  }
  .initiative-readonly-context dl > div {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    padding-top: var(--space-1);
  }
}
@media (max-width: 680px) {
  .selection-workbench :deep(.page-header--result .page-heading > p) {
    display: none;
  }
  .work-context,
  .workbench-grid {
    grid-template-columns: 1fr;
  }
  .selection-workbench--decision-ready {
    padding-bottom: calc(var(--touch-target) + var(--space-6));
  }
  .workbench-grid {
    gap: var(--space-2);
    grid-template-areas:
      "queue"
      "detail"
      "action";
  }
  .work-context > svg {
    display: none;
  }
  .work-context {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    padding: var(--space-2);
  }
  .work-context > span:last-child {
    grid-column: 1 / -1;
  }
  .work-context > span:last-child {
    padding: var(--space-2) 0 0;
    border-top: 1px solid var(--line);
    border-left: 0;
  }
  .pane--action {
    position: static;
  }
  .pane--decision {
    height: auto;
  }
  .initiative-readonly-context {
    gap: var(--space-2);
    padding: var(--space-2);
  }
  .initiative-readonly-context > small {
    display: none;
  }
  .initiative-readonly-context h2 {
    font-size: var(--text-label);
  }
  .initiative-readonly-context p {
    font-size: var(--text-micro);
  }
  .initiative-readonly-context dl > div {
    padding-top: var(--space-2);
  }
}
</style>
