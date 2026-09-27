<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import type { ProductInitiativeReviewPointCodeV1 } from "@logix/contracts";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProductEvaluationRequirementsPanel from "../components/product-selection/ProductEvaluationRequirementsPanel.vue";
import ProductInitiativeOutcomePanel from "../components/product-selection/ProductInitiativeOutcomePanel.vue";
import ProductInitiativeReviewPanel from "../components/product-selection/ProductInitiativeReviewPanel.vue";
import ProductOpportunityActions from "../components/product-selection/ProductOpportunityActions.vue";
import ProductOpportunityDetail from "../components/product-selection/ProductOpportunityDetail.vue";
import ProductOpportunityQueue from "../components/product-selection/ProductOpportunityQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useProductInitiativeDecision } from "../composables/useProductInitiativeDecision";
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
  initiative,
  decided,
  objective,
  destination,
  currentReason,
  points,
  reviewPointViews,
  blockingGaps,
  evidenceCandidates,
  loading: readingInitiative,
  saving: deciding,
  error: initiativeError,
  receipt: initiativeReceipt,
  load: loadInitiative,
  setDestination,
  toggleEvidence,
  addEvidence: addInitiativeEvidence,
  decide,
} = useProductInitiativeDecision({
  handoffId: initiativeHandoffId,
  signalId: computed(() => selected.value?.handoff.signalId ?? ""),
});

/**
 * 判断详情读出来之前不摆出判断界面：那时的"还差 5 项"是空草稿而不是这条
 * 机会的真实状态，照着它填完提交会拿版本 0 去撞冲突。
 */
const initiativeReady = computed(
  () => accepted.value && !readingInitiative.value && !initiativeError.value,
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
    case "returned_to_market":
      return "已退回经营团队";
    default:
      break;
  }
  if (accepted.value) return "形成立项结论";
  return selected.value?.intakeState === "superseded"
    ? "等待新版交接"
    : "领取并接受机会";
});

const currentOwner = computed(() => {
  if (initiative.value?.currentDestination === "returned_to_market") {
    return "经营团队（重新判断）";
  }
  if (selected.value?.intakeState === "queued") return "选品团队（待领取）";
  return selected.value?.assignedActorId || "选品负责人";
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

function setObjective(value: string): void {
  objective.value = value;
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
</script>
<template>
  <main class="selection-workbench page-frame">
    <PageHeader
      eyebrow="选品岗位工作台"
      title="选品立项"
      summary="领取经营团队交来的机会，核对依据与待补项，再决定是否进入正式立项评审。"
    />

    <section v-if="feedbackError" class="feedback feedback--error" role="alert">
      <AlertCircle :size="17" />
      <span>{{ feedbackError }}</span>
      <button type="button" @click="reload">
        <RefreshCw :size="15" />重新加载
      </button>
    </section>
    <section
      v-else-if="feedbackReceipt"
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
      <section class="pane">
        <ProductOpportunityQueue
          :items="items"
          :selected-id="selected?.handoff.handoffId ?? ''"
          @select="selectOpportunity"
        />
      </section>
      <section class="pane">
        <template v-if="selected">
          <ProductOpportunityDetail :item="selected" />
          <ProductEvaluationRequirementsPanel
            :requirements="requirements.requirements"
            :withheld="requirements.withheld"
            :busy="saving"
            :save-evidence="addRequirementEvidence"
          />
          <ProductInitiativeReviewPanel
            v-if="initiativeReady"
            :points="reviewPointViews"
            :candidates="evidenceCandidates"
            :busy="deciding"
            :readonly="decided"
            :add-evidence="addInitiativeEvidence"
            @toggle-evidence="toggleEvidence"
            @update-conclusion="setConclusion"
          />
        </template>
        <p v-else class="empty">
          {{ loading ? "正在读取经营机会" : "暂无待处理机会" }}
        </p>
      </section>
      <section class="pane">
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
        <ProductInitiativeOutcomePanel
          v-else-if="selected"
          :outcome="destination"
          :objective="objective"
          :reason="currentReason"
          :gaps="blockingGaps"
          :busy="deciding"
          :decided="decided"
          @change-outcome="setDestination"
          @update-objective="setObjective"
          @update-reason="setCurrentReason"
          @submit="decide"
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
.empty {
  margin: 0;
  padding: var(--space-6) var(--space-4);
  color: var(--muted);
  font-size: var(--text-label);
  text-align: center;
}
@media (max-width: 1100px) {
  .workbench-grid {
    grid-template-columns: minmax(250px, 0.7fr) minmax(0, 1.3fr);
  }
  .pane:last-child {
    grid-column: 1 / -1;
  }
}
@media (max-width: 680px) {
  .work-context,
  .workbench-grid {
    grid-template-columns: 1fr;
  }
  .work-context > svg {
    display: none;
  }
  .work-context > span:last-child {
    padding: var(--space-2) 0 0;
    border-top: 1px solid var(--line);
    border-left: 0;
  }
  .pane:last-child {
    grid-column: auto;
  }
}
</style>
