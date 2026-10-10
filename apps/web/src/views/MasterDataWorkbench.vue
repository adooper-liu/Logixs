<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import WorkbenchPageHeader from "../components/workbench/WorkbenchPageHeader.vue";
import { useProductIdentity } from "../composables/useProductIdentity";

const route = useRoute();
const router = useRouter();
const requestedId = computed(() => String(route.query.releaseId ?? ""));

async function selectRelease(releaseId: string): Promise<void> {
  await router.replace({
    path: "/workspaces/master-data",
    query: { releaseId },
  });
}

const {
  selected,
  waiting,
  drafted,
  identity,
  draft,
  releaseGaps,
  loading,
  saving,
  error,
  receipt,
  load,
  addSku,
  removeSku,
  save,
  release,
} = useProductIdentity({ selectedId: requestedId });

onMounted(async () => {
  await load();
  // 默认落在最该处理的那条 —— 打开工作台还要先点一下才看得见内容，是把负担推给人。
  if (!selected.value) {
    const first = waiting.value[0] ?? drafted.value[0];
    if (first) await selectRelease(first.releaseId);
  }
});

/** 目标国家与认证在界面上按逗号分隔输入，落库是数组。 */
const targetCountriesText = computed({
  get: () => draft.attributes.targetCountries.join(", "),
  set: (value: string) => {
    draft.attributes.targetCountries = value
      .split(/[,，\s]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  },
});
const certificationsText = computed({
  get: () => draft.attributes.certifications.join(", "),
  set: (value: string) => {
    draft.attributes.certifications = value
      .split(/[,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  },
});

/**
 * 危险品用勾选表达"有没有"：null = **没有**，对象 = **有、但可能还没查全**。
 * 全是 null 的对象与 null 不是一回事 —— 前者是"有但还没查"，后者是"没有"。
 */
const hasDangerousGoods = computed({
  get: () => draft.attributes.dangerousGoods !== null,
  set: (value: boolean) => {
    draft.attributes.dangerousGoods = value
      ? {
          unNumber: null,
          classCode: null,
          packingGroup: null,
          shippingName: null,
          technicalName: null,
          flashPointC: null,
        }
      : null;
  },
});

const workResult = computed(() => {
  if (!selected.value) return "选一票开始";
  return identity.value
    ? `已建档（第 ${identity.value.version} 版）`
    : "建立产品与 SKU 身份";
});
const currentOwner = computed(
  () => selected.value?.releasedBy ?? "还没有可建档的设计",
);

async function reload(): Promise<void> {
  await load();
}
async function saveDraft(): Promise<void> {
  await save();
}
async function publish(): Promise<void> {
  await release();
}
</script>

<template>
  <main class="master-data-workbench page-frame">
    <WorkbenchPageHeader
      stage-code="master_data"
      eyebrow="商品与主数据岗位工作台"
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
      <span><small>谁在工作</small><b>主数据负责人</b></span>
      <span
        ><small>本次结果</small><b>{{ workResult }}</b></span
      >
      <span
        ><UserRound :size="16" /><span
          ><small>设计来自</small><b>{{ currentOwner }}</b></span
        ></span
      >
    </section>

    <div class="workbench-grid">
      <section class="pane">
        <header class="pane-head">
          <small>为什么现在处理</small>
          <h2>待建档的产品设计</h2>
          <p>来自产品开发与 NPI 的发布。没建档的那部分，下游还引用不到它。</p>
        </header>
        <p v-if="loading && !selected" class="empty">
          正在读取待建档的产品设计
        </p>
        <template v-else>
          <div
            v-for="group in [
              { key: 'waiting', label: '等我建档', items: waiting },
              { key: 'drafted', label: '已建档', items: drafted },
            ]"
            :key="group.key"
            class="group"
          >
            <h3>
              {{ group.label
              }}<span class="count">{{ group.items.length }}</span>
            </h3>
            <p v-if="group.items.length === 0" class="empty">没有</p>
            <ul v-else>
              <li v-for="item in group.items" :key="item.releaseId">
                <button
                  type="button"
                  :class="{ 'is-selected': item.releaseId === requestedId }"
                  @click="selectRelease(item.releaseId)"
                >
                  <span class="spec">{{ item.specification }}</span>
                  <span class="meta">
                    {{ item.npiStage.toUpperCase() }} ·
                    {{ new Date(item.releasedAt).toLocaleString("zh-CN") }}
                    <template v-if="item.productNumber">
                      · {{ item.productNumber }}
                    </template>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </template>
      </section>

      <section class="pane">
        <template v-if="selected">
          <header class="pane-head">
            <small>这一票是什么</small>
            <h2>{{ selected.specification }}</h2>
            <p class="meta">
              来自 {{ selected.npiStage.toUpperCase() }} 阶段的发布 ·
              {{ new Date(selected.releasedAt).toLocaleString("zh-CN") }}
            </p>
          </header>

          <div class="block">
            <label class="field">
              <span>对外产品号</span>
              <input
                v-model="draft.productNumber"
                aria-label="对外产品号"
                placeholder="留空则按来源自动生成；之后可改"
              />
            </label>
            <p class="note">
              内部代理键由系统生成、永不改变；产品号给人看、可改 ——
              改它不动内部键。
            </p>
          </div>

          <div class="block">
            <span class="label">身份与分类</span>
            <label class="field">
              <span>品类</span>
              <input
                v-model="draft.attributes.categoryCode"
                aria-label="品类"
              />
            </label>
            <label class="field">
              <span>功能名</span>
              <input
                v-model="draft.attributes.functionalName"
                aria-label="功能名"
              />
            </label>
            <label class="field">
              <span>品牌</span>
              <input v-model="draft.attributes.brandName" aria-label="品牌" />
            </label>
          </div>

          <div class="block">
            <span class="label">关务与合规</span>
            <label class="field">
              <span>原产国（两位国别码，如 CN）</span>
              <input
                v-model="draft.attributes.countryOfOrigin"
                aria-label="原产国"
                placeholder="CN"
              />
            </label>
            <label class="field">
              <span>HS 编码（6–10 位数字）</span>
              <input v-model="draft.attributes.hsCode" aria-label="HS 编码" />
            </label>
            <label class="field">
              <span>目标销售国家（逗号分隔）</span>
              <input
                v-model="targetCountriesText"
                aria-label="目标销售国家"
                placeholder="US, CA"
              />
            </label>
            <label class="field">
              <span>需要的认证（逗号分隔）</span>
              <input
                v-model="certificationsText"
                aria-label="需要的认证"
                placeholder="CE, FCC"
              />
            </label>
          </div>

          <details class="block">
            <summary>更多属性（危险品、温度、订货条件、包装与电池）</summary>
            <label class="check">
              <input
                v-model="hasDangerousGoods"
                type="checkbox"
                aria-label="这件产品属于危险品"
              />
              <span>这件产品属于危险品</span>
            </label>
            <template v-if="draft.attributes.dangerousGoods">
              <label class="field">
                <span>UN 编号</span>
                <input
                  v-model="draft.attributes.dangerousGoods.unNumber"
                  aria-label="UN 编号"
                />
              </label>
              <label class="field">
                <span>危险品类别</span>
                <input
                  v-model="draft.attributes.dangerousGoods.classCode"
                  aria-label="危险品类别"
                />
              </label>
              <label class="field">
                <span>运输名称</span>
                <input
                  v-model="draft.attributes.dangerousGoods.shippingName"
                  aria-label="运输名称"
                />
              </label>
            </template>
            <label class="field">
              <span>订货提前期（天）</span>
              <input
                v-model.number="draft.attributes.orderConditions.leadTimeDays"
                type="number"
                aria-label="订货提前期"
              />
            </label>
            <p class="note">
              危险品与订货条件的其余项、温度、SKU 的尺寸重量与包装层级，见下方
              SKU 区 与契约字段；它们在本片先存半成品也可以。
            </p>
          </details>

          <div class="block">
            <span class="label">SKU（一个产品下可以有多个）</span>
            <div
              v-for="(sku, index) in draft.skus"
              :key="index"
              class="sku-row"
            >
              <label class="field">
                <span>SKU 编号（租户内唯一）</span>
                <input
                  v-model="sku.skuCode"
                  :aria-label="`SKU 编号 ${index + 1}`"
                />
              </label>
              <label class="field">
                <span>颜色</span>
                <input
                  v-model="sku.attributes.colorCode"
                  :aria-label="`颜色 ${index + 1}`"
                />
              </label>
              <label class="field">
                <span>尺码/规格</span>
                <input
                  v-model="sku.attributes.sizeDescription"
                  :aria-label="`尺码 ${index + 1}`"
                />
              </label>
              <label class="field">
                <span>条码</span>
                <input
                  v-model="sku.attributes.barcode"
                  :aria-label="`条码 ${index + 1}`"
                />
              </label>
              <button type="button" class="ghost" @click="removeSku(index)">
                移除这个 SKU
              </button>
            </div>
            <button type="button" @click="addSku">再加一个 SKU</button>
          </div>
        </template>
        <p v-else class="empty">
          {{ loading ? "正在读取待建档的产品设计" : "暂无待建档的产品设计" }}
        </p>
      </section>

      <section class="pane">
        <header class="pane-head">
          <small>现在做什么</small>
          <h2>建档并交给寻源</h2>
        </header>
        <template v-if="selected">
          <div class="block">
            <p class="note">
              主数据是逐步查清的：<em>存半成品是对的</em>，缺的项记在待补里。只有发布
              那一刻才要求齐 —— 因为发布是交给下游当依据的。
            </p>
            <div class="actions">
              <button type="button" :disabled="saving" @click="saveDraft">
                {{ saving ? "正在保存" : "保存" }}
              </button>
            </div>
          </div>

          <div class="block">
            <span class="label">发布前还差什么</span>
            <p v-if="releaseGaps.length === 0" class="note note--done">
              齐了，可以发布。
            </p>
            <ul v-else class="pending">
              <li v-for="gap in releaseGaps" :key="gap">{{ gap }}</li>
            </ul>
            <p class="note">
              BOM 与 Listing
              不在这一片：它们会作为<em>待补</em>随交接带下去，不阻断发布。
            </p>
            <div class="actions">
              <button
                type="button"
                class="primary"
                :disabled="saving || !identity || releaseGaps.length > 0"
                @click="publish"
              >
                {{ saving ? "正在发布" : "发布可售 SKU" }}
              </button>
            </div>
          </div>
        </template>
        <p v-else class="empty">先从左边的队列选一票。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.pane-head {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.pane-head small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
.pane-head h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
  line-height: var(--leading-title);
}
.pane-head p {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}
.group {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.group h3 {
  display: flex;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  font-size: var(--text-meta);
  font-weight: 600;
}
.count {
  color: var(--ink-soft);
  font-weight: 400;
}
.group ul {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.group button {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-s);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.group button:hover {
  background: var(--surface-2);
}
.group button.is-selected {
  border-color: var(--brand);
  background: var(--surface-2);
}
.spec {
  font-weight: 600;
}
.meta {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.label {
  font-size: var(--text-meta);
  font-weight: 600;
}
.field {
  display: grid;
  gap: var(--space-1);
}
.field > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
input {
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: inherit;
  font: inherit;
}
.note {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}
.note--done {
  color: var(--ok);
}
.sku-row {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
}
.actions {
  display: flex;
  gap: var(--space-2);
}
button {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
button.primary {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
}
button.ghost {
  justify-self: start;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.pending {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--risk);
  font-size: var(--text-meta);
}
.empty {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-meta);
}
</style>
