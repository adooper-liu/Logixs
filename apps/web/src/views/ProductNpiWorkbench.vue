<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProductNpiClaimAction from "../components/product-npi/ProductNpiClaimAction.vue";
import ProductNpiHandoffDetail from "../components/product-npi/ProductNpiHandoffDetail.vue";
import ProductNpiQueue from "../components/product-npi/ProductNpiQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
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
      <section class="pane">
        <ProductNpiQueue
          :waiting="waiting"
          :mine="mine"
          :taken-by-others="takenByOthers"
          :selected-id="selected?.handoff.handoffId ?? ''"
          :loading="loading"
          @select="selectInitiative"
        />
      </section>
      <section class="pane">
        <ProductNpiHandoffDetail v-if="selected" :entry="selected" />
        <p v-else class="empty">
          {{ loading ? "正在读取产品侧待办" : "暂无待处理的立项交接" }}
        </p>
      </section>
      <section class="pane">
        <ProductNpiClaimAction
          v-if="selected"
          :entry="selected"
          :busy="saving"
          @claim="claimSelected"
        />
        <p v-else class="empty">先从左边的队列选一票。</p>
      </section>
    </div>
  </main>
</template>
