<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProductEvaluationRequirementsPanel from "../components/product-selection/ProductEvaluationRequirementsPanel.vue";
import ProductOpportunityActions from "../components/product-selection/ProductOpportunityActions.vue";
import ProductOpportunityDetail from "../components/product-selection/ProductOpportunityDetail.vue";
import ProductOpportunityQueue from "../components/product-selection/ProductOpportunityQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useProductOpportunityWorkbench } from "../composables/useProductOpportunityWorkbench";

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
</script>

<template>
  <main class="selection-workbench page-frame">
    <PageHeader
      eyebrow="选品岗位工作台"
      title="选品立项"
      summary="领取经营团队交来的机会，核对依据与待补项，再决定是否进入正式立项评审。"
    />

    <section v-if="error" class="feedback feedback--error" role="alert">
      <AlertCircle :size="17" />
      <span>{{ error }}</span>
      <button type="button" @click="load">
        <RefreshCw :size="15" />重新加载
      </button>
    </section>
    <section
      v-else-if="receipt"
      class="feedback feedback--success"
      role="status"
    >
      {{ receipt }}
    </section>

    <section class="work-context" aria-label="当前岗位与交接责任">
      <BriefcaseBusiness :size="19" />
      <span><small>谁在工作</small><b>选品负责人</b></span>
      <span><small>本次结果</small><b>领取并接受机会</b></span>
      <span
        ><UserRound :size="16" /><span
          ><small>当前责任</small
          ><b>{{
            selected?.intakeState === "queued"
              ? "选品团队（待领取）"
              : selected?.assignedActorId || "选品负责人"
          }}</b></span
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
        <ProductOpportunityDetail v-if="selected" :item="selected" />
        <ProductEvaluationRequirementsPanel
          v-if="selected"
          :requirements="requirements.requirements"
          :withheld="requirements.withheld"
          :busy="saving"
          :save-evidence="addEvidence"
        />
        <p v-else class="empty">
          {{ loading ? "正在读取经营机会" : "暂无待处理机会" }}
        </p>
      </section>
      <section class="pane">
        <ProductOpportunityActions
          v-if="selected"
          :item="selected"
          :busy="saving"
          @claim="claim"
          @accept="accept"
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
