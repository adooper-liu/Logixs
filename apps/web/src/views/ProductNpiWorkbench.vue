<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthSession } from "../auth/useAuthSession";
import ProductDefinitionAdvancePanel from "../components/product-npi/ProductDefinitionAdvancePanel.vue";
import ProductNpiClaimAction from "../components/product-npi/ProductNpiClaimAction.vue";
import ProductNpiHandoffDetail from "../components/product-npi/ProductNpiHandoffDetail.vue";
import ProductNpiQueue from "../components/product-npi/ProductNpiQueue.vue";
import ProductNpiReturnAction from "../components/product-npi/ProductNpiReturnAction.vue";
import ProductNpiStageProgress from "../components/product-npi/ProductNpiStageProgress.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useProductDefinition } from "../composables/useProductDefinition";
import { useProductNpiWorkbench } from "../composables/useProductNpiWorkbench";

const route = useRoute();
const router = useRouter();
const requestedId = computed(() => String(route.query.handoffId ?? ""));

async function selectInitiative(handoffId: string): Promise<void> {
  await router.replace({
    path: "/workspaces/product-npi",
    query: { handoffId },
  });
}

const {
  items,
  selected,
  waiting,
  mine,
  takenByOthers,
  loading,
  saving,
  error,
  receipt,
  load,
  claim,
  returnToSelection,
} = useProductNpiWorkbench({ selectedId: requestedId, selectInitiative });

onMounted(async () => {
  await load();
  // 首屏直接落在最该处理的那一条：打开工作台还要先点一下才看得见内容，
  // 等于把选择的负担推给人。队列仍是唯一选择源，这里只是给个默认落点。
  if (selected.value) return;
  const first = waiting.value[0] ?? mine.value[0] ?? items.value[0];
  if (first) await selectInitiative(first.handoff.handoffId);
});

/**
 * 本次结果按服务端事实说，而不是按"点过按钮"说 —— 领没领到以返回的领取回执为准。
 */
/**
 * 推进区只在"我负责的那一票"上出现：没接的还没轮到推进，别人接的轮不到我。
 * 这与上一片的两道门槛同源 —— 界面上不给按不动的按钮。
 */
const { actorId } = useAuthSession();
const isMine = computed(
  () =>
    actorId.value !== null &&
    selected.value?.claim?.productOwnerActorId === actorId.value,
);
const definition = useProductDefinition({
  initiativeHandoffId: computed(() => selected.value?.handoff.handoffId ?? ""),
  mine: isMine,
});

const workResult = computed(() => {
  if (!selected.value) return "选一票开始";
  return selected.value.claim ? "这一票已有人负责" : "接住这一票";
});

const currentOwner = computed(() => {
  if (!selected.value) return "产品负责人（待定）";
  return (
    selected.value.claim?.productOwnerActorId ?? "还没有人接 —— 接了就是你"
  );
});

async function reload(): Promise<void> {
  await load();
}

async function claimSelected(): Promise<void> {
  await claim();
}
</script>

<template>
  <main class="npi-workbench page-frame">
    <PageHeader
      eyebrow="产品开发与 NPI 岗位工作台"
      title="产品开发与 NPI"
      summary="接住选品交过来的立项，让它有明确的产品负责人，再推进到可发布的产品定义。"
    />

    <section v-if="error" class="feedback feedback--error" role="alert">
      <AlertCircle :size="17" />
      <span>{{ error }}</span>
      <button type="button" @click="reload">
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
      <span><small>谁在工作</small><b>产品负责人</b></span>
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
        <ProductNpiQueue
          :waiting="waiting"
          :mine="mine"
          :taken-by-others="takenByOthers"
          :selected-id="selected?.handoff.handoffId ?? ''"
          :loading="loading"
          @select="selectInitiative"
        />
      </section>
      <section class="pane pane--main">
        <template v-if="selected">
          <ProductNpiStageProgress
            :claimed="Boolean(selected.claim)"
            :npi-stage="definition.definition.value?.npiStage ?? null"
            :stage-outcomes="definition.definition.value?.stageOutcomes ?? []"
            :objective="selected.handoff.objective"
            :title="selected.handoff.objective"
          />
          <ProductNpiHandoffDetail :entry="selected" />
        </template>
        <p v-else class="empty">
          {{ loading ? "正在读取产品侧待办" : "暂无待处理的立项交接" }}
        </p>
      </section>
      <section class="pane">
        <ProductDefinitionAdvancePanel
          v-if="selected && isMine"
          :definition="definition.definition.value"
          :specification="definition.draft.specification"
          :compliance-assumptions="definition.draft.complianceAssumptions"
          :conclusion="definition.draft.conclusion"
          :stage="definition.stage.value"
          :next-stage="definition.nextStage.value"
          :current-stage-concluded="definition.currentStageConcluded.value"
          :pending-fields="definition.pendingFields.value"
          :released="definition.released.value"
          :busy="definition.saving.value || saving"
          :save="definition.save"
          :release="definition.release"
          @update-specification="definition.draft.specification = $event"
          @update-compliance-assumptions="
            definition.draft.complianceAssumptions = $event
          "
          @update-conclusion="definition.draft.conclusion = $event"
        />
        <ProductNpiReturnAction
          v-if="selected && isMine && !definition.released.value"
          :busy="saving || definition.saving.value"
          :return-to-selection="returnToSelection"
        />
        <ProductNpiClaimAction
          v-else-if="selected && !isMine"
          :entry="selected"
          :busy="saving"
          :mine="isMine"
          @claim="claimSelected"
        />
        <p v-else-if="!selected" class="empty">先从左边的队列选一票。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.npi-workbench {
  min-width: 0;
}
.feedback {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--ok);
  background: var(--ok-bg);
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
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
  grid-template-columns: minmax(220px, 0.55fr) minmax(420px, 1.45fr) minmax(
      290px,
      0.85fr
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
    grid-template-columns: minmax(220px, 0.6fr) minmax(0, 1.4fr);
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
