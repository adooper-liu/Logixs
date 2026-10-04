<script setup lang="ts">
import {
  AlertCircle,
  BriefcaseBusiness,
  RefreshCw,
  UserRound,
} from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageHeader from "../components/ui/PageHeader.vue";
import type { SupplierQuotationV1 } from "@logix/contracts";
import {
  entryKey,
  priceTierLabels,
  useSourcingWorkbench,
} from "../composables/useSourcingWorkbench";

const route = useRoute();
const router = useRouter();
const requestedKey = computed(() => String(route.query.item ?? ""));

async function selectEntry(key: string): Promise<void> {
  await router.replace({ path: "/workspaces/sourcing", query: { item: key } });
}

const {
  suppliers,
  waiting,
  nominated,
  selected,
  loading,
  saving,
  error,
  receipt,
  load,
  addSupplier,
  admit,
  addQuotation,
  nominate,
} = useSourcingWorkbench({ selectedKey: requestedKey });

// —— 登记供应商（默认待准入；国别等业务事实不预填）——
const newSupplier = ref({ name: "", countryCode: "" });

// —— 录入报价（针对当前件 + 选中的供应商）——
const quotingSupplierId = ref("");
const draft = ref({
  unitPrice: "",
  currency: "",
  minQuantity: "",
  incoterms: "",
  toolingCost: "",
  leadTimeDays: "",
  exclusions: "",
});
const material = ref({
  name: "",
  quantityPerUnit: "",
  quantityUnit: "kg" as const,
  lossRatePercent: "",
  suppliedByCustomer: false,
});

// —— 定点 ——
const nominatingId = ref("");
const conclusion = ref({ sample: "", capacity: "" });

onMounted(async () => {
  await load();
  // 默认落在最该处理的那一件 —— 打开工作台还要先点一下才看得见内容，是把负担推给人。
  if (!selected.value) {
    const first = waiting.value[0] ?? nominated.value[0];
    if (first) await selectEntry(entryKey(first));
  }
});

// 换件就清掉上一件的草稿，免得把甲家的报价录到乙件上。
watch(requestedKey, () => {
  quotingSupplierId.value = "";
  nominatingId.value = "";
  draft.value.unitPrice = "";
  material.value.name = "";
});

const workResult = computed(() => {
  if (!selected.value) return "选一件开始";
  if (selected.value.nominated) return "已定点，待需求与补货侧明确接受";
  return selected.value.quotations.length > 0
    ? `已收 ${selected.value.quotations.length} 家报价`
    : "还没有人报价";
});

// 没有持久化的责任人，也没有下游接受事实：责任停在寻源岗位，定点不转移责任，供应商不是责任人。
const currentOwner = "寻源负责人";

async function submitSupplier(): Promise<void> {
  const countryCode = newSupplier.value.countryCode.trim().toUpperCase();
  if (!newSupplier.value.name.trim() || !countryCode) return;
  const saved = await addSupplier({
    name: newSupplier.value.name.trim(),
    countryCode,
  });
  if (saved) {
    newSupplier.value = { name: "", countryCode: "" };
  }
}

async function admitSupplierRow(supplierId: string): Promise<void> {
  const supplier = suppliers.value.find((row) => row.supplierId === supplierId);
  if (!supplier) return;
  await admit(supplier);
}

async function submitQuotation(): Promise<void> {
  const supplierId = quotingSupplierId.value;
  if (
    !supplierId ||
    !draft.value.unitPrice.trim() ||
    !draft.value.currency.trim() ||
    !draft.value.minQuantity.trim() ||
    !draft.value.incoterms.trim()
  ) {
    return;
  }
  const saved = await addQuotation(supplierId, {
    priceTiers: [
      {
        minQuantity: Number(draft.value.minQuantity),
        unitPrice: draft.value.unitPrice.trim(),
        currency: draft.value.currency.trim().toUpperCase(),
      },
    ],
    incoterms: draft.value.incoterms.trim(),
    ...(draft.value.toolingCost.trim()
      ? {
          toolingCost: {
            value: Number(draft.value.toolingCost),
            unit: "each" as const,
          },
        }
      : {}),
    ...(draft.value.leadTimeDays.trim()
      ? { leadTimeDays: Number(draft.value.leadTimeDays) }
      : {}),
    keyMaterials: material.value.name.trim()
      ? [
          {
            name: material.value.name.trim(),
            specification: null,
            quantityPerUnit: Number(material.value.quantityPerUnit || "0"),
            quantityUnit: material.value.quantityUnit,
            lossRatePercent: material.value.lossRatePercent.trim()
              ? Number(material.value.lossRatePercent)
              : null,
            suppliedByCustomer: material.value.suppliedByCustomer,
          },
        ]
      : [],
    exclusions: draft.value.exclusions.trim() || null,
  });
  if (saved) draft.value.unitPrice = "";
}

async function submitNomination(quotation: SupplierQuotationV1): Promise<void> {
  const saved = await nominate(quotation, {
    sampleConclusion: conclusion.value.sample.trim(),
    capacityConstraint: conclusion.value.capacity.trim(),
  });
  if (saved) nominatingId.value = "";
}

async function reload(): Promise<void> {
  await load();
}
</script>

<template>
  <main class="sourcing-workbench page-frame">
    <PageHeader
      eyebrow="寻源与供应商定点岗位工作台"
      title="寻源与供应商定点"
      summary="为一件可售 SKU 收齐供应商报价，比的不只是单价，选定一家定点交给需求与补货。"
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

    <section class="work-context" aria-label="当前岗位与责任">
      <BriefcaseBusiness :size="19" />
      <span><small>谁在工作</small><b>寻源负责人</b></span>
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
        <header class="pane-head">
          <small>为什么现在处理</small>
          <h2>待寻源的可售 SKU</h2>
          <p class="note">
            来自主数据侧的发布。**一件 SKU 一个条目** ——
            寻源找的是"这一件谁做"， 不是"这一票"。
          </p>
        </header>
        <p v-if="loading && !selected" class="empty">
          正在读取待寻源的可售 SKU
        </p>
        <template v-else>
          <div
            v-for="group in [
              { key: 'waiting', label: '待寻源', items: waiting },
              { key: 'nominated', label: '已定点', items: nominated },
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
              <li v-for="entry in group.items" :key="entryKey(entry)">
                <button
                  type="button"
                  :class="{ 'is-selected': entryKey(entry) === requestedKey }"
                  @click="selectEntry(entryKey(entry))"
                >
                  <span class="identity">{{ entry.skuCode }}</span>
                  <span class="meta">
                    {{ entry.productNumber }} ·
                    {{ entry.quotations.length }} 家报价
                    <template v-if="entry.nominated">
                      · 定点给 {{ entry.nominated.supplierName }}
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
            <small>这一件是谁做、多少钱</small>
            <h2>{{ selected.skuCode }}</h2>
            <p class="meta">
              {{ selected.productNumber }} · 候选
              {{ selected.suppliers.length }} 家
            </p>
          </header>

          <div class="block">
            <span class="label">各家报价</span>
            <p v-if="selected.quotations.length === 0" class="note">
              还没有人报价。先在右栏登记供应商，再录入报价。
            </p>
            <p v-if="selected.quotations.length > 1" class="note">
              报价可比性待服务端判定，暂不排名。
            </p>
            <ul
              v-if="selected.quotations.length > 0"
              class="quotes"
              aria-label="各家报价"
            >
              <li
                v-for="quotation in selected.quotations"
                :key="quotation.quotationId"
              >
                <div class="quote-head">
                  <b>
                    {{
                      selected.suppliers.find(
                        (row) => row.supplierId === quotation.supplierId,
                      )?.name ?? quotation.supplierId
                    }}
                  </b>
                  <span class="price">
                    <span
                      v-for="label in priceTierLabels(quotation)"
                      :key="label"
                      >{{ label }}</span
                    >
                  </span>
                </div>
                <small>
                  {{ quotation.incoterms }}
                  <template v-if="quotation.leadTimeDays !== null">
                    · 交期 {{ quotation.leadTimeDays }} 天
                  </template>
                  <template v-if="quotation.toolingCost">
                    · 模具费 {{ quotation.toolingCost.value }}
                  </template>
                  · 关键物料 {{ quotation.keyMaterials.length }} 项
                </small>
                <small v-if="quotation.exclusions">
                  排除项：{{ quotation.exclusions }}
                </small>
                <button
                  type="button"
                  :disabled="saving || !!selected.nominated"
                  @click="nominatingId = quotation.quotationId"
                >
                  定点给他
                </button>
              </li>
            </ul>
          </div>

          <div v-if="selected.nominated" class="block">
            <span class="label">定点记录（待需求与补货侧明确接受）</span>
            <p class="note">
              {{ selected.nominated.supplierName }} ·
              {{ selected.nominated.incoterms }} · 报价第
              {{ selected.nominated.quotationVersion }} 版
            </p>
            <p class="note">样品：{{ selected.nominated.sampleConclusion }}</p>
            <p class="note">
              产能：{{ selected.nominated.capacityConstraint }}
            </p>
          </div>
        </template>
        <p v-else class="empty">
          {{ loading ? "正在读取待寻源的可售 SKU" : "暂无待寻源的可售 SKU" }}
        </p>
      </section>

      <section class="pane">
        <header class="pane-head">
          <small>现在做什么</small>
          <h2>登记、报价、定点</h2>
        </header>

        <div class="block">
          <span class="label">登记供应商</span>
          <label class="field">
            <span>名称（租户内唯一）</span>
            <input v-model="newSupplier.name" aria-label="供应商名称" />
          </label>
          <label class="field">
            <span>国别（两位大写）</span>
            <input v-model="newSupplier.countryCode" aria-label="供应商国别" />
          </label>
          <p class="note">登记后为待准入；准入是独立动作，未准入不能定点。</p>
          <div class="actions">
            <button
              type="button"
              :disabled="
                saving ||
                !newSupplier.name.trim() ||
                !newSupplier.countryCode.trim()
              "
              @click="submitSupplier"
            >
              登记
            </button>
          </div>
        </div>

        <div v-if="suppliers.length > 0" class="block">
          <span class="label">供应商准入</span>
          <ul class="quotes">
            <li v-for="supplier in suppliers" :key="supplier.supplierId">
              <div class="quote-head">
                <b>{{ supplier.name }}</b>
                <span class="price">
                  {{
                    supplier.admissionState === "admitted"
                      ? "已准入"
                      : supplier.admissionState === "suspended"
                        ? "已暂停"
                        : "待准入"
                  }}
                </span>
              </div>
              <button
                v-if="supplier.admissionState === 'pending'"
                type="button"
                :disabled="saving"
                :aria-label="`准入 ${supplier.name}`"
                @click="admitSupplierRow(supplier.supplierId)"
              >
                准入
              </button>
            </li>
          </ul>
        </div>

        <div v-if="selected" class="block">
          <span class="label">录入报价</span>
          <label class="field">
            <span>哪家供应商</span>
            <select v-model="quotingSupplierId" aria-label="报价的供应商">
              <option value="">选一家</option>
              <option
                v-for="supplier in suppliers"
                :key="supplier.supplierId"
                :value="supplier.supplierId"
              >
                {{ supplier.name }}
              </option>
            </select>
          </label>
          <div class="row">
            <label class="field">
              <span>单价</span>
              <input
                v-model="draft.unitPrice"
                aria-label="单价"
                placeholder="18.5000"
              />
            </label>
            <label class="field">
              <span>币种</span>
              <input v-model="draft.currency" aria-label="币种" />
            </label>
            <label class="field">
              <span>起订量</span>
              <input v-model="draft.minQuantity" aria-label="起订量" />
            </label>
          </div>
          <label class="field">
            <span>贸易术语</span>
            <input v-model="draft.incoterms" aria-label="贸易术语" />
          </label>
          <div class="row">
            <label class="field">
              <span>模具费</span>
              <input v-model="draft.toolingCost" aria-label="模具费" />
            </label>
            <label class="field">
              <span>交期（天）</span>
              <input v-model="draft.leadTimeDays" aria-label="交期" />
            </label>
          </div>
          <label class="field">
            <span>关键物料（由供应商报，一项一条）</span>
            <input
              v-model="material.name"
              aria-label="关键物料名称"
              placeholder="例如：改性 PP 粒子"
            />
          </label>
          <div class="row">
            <label class="field">
              <span>单件用量</span>
              <input v-model="material.quantityPerUnit" aria-label="单件用量" />
            </label>
            <label class="field">
              <span>损耗率 %</span>
              <input v-model="material.lossRatePercent" aria-label="损耗率" />
            </label>
          </div>
          <label class="check">
            <input
              v-model="material.suppliedByCustomer"
              type="checkbox"
              aria-label="客供"
            />
            <span>这件物料由我们客供</span>
          </label>
          <label class="field">
            <span>排除项与假设（沉默不等于确认）</span>
            <input v-model="draft.exclusions" aria-label="排除项" />
          </label>
          <div class="actions">
            <button
              type="button"
              :disabled="
                saving ||
                !quotingSupplierId ||
                !draft.unitPrice.trim() ||
                !draft.currency.trim() ||
                !draft.minQuantity.trim() ||
                !draft.incoterms.trim()
              "
              @click="submitQuotation"
            >
              {{ saving ? "正在保存" : "录入这一家的报价" }}
            </button>
          </div>
        </div>

        <div v-if="nominatingId" class="block">
          <span class="label">定点</span>
          <p class="note">
            定点前必须验过样、问清产能 —— 这两句是交给需求与补货侧的依据。
          </p>
          <label class="field">
            <span>样品结论（必填）</span>
            <textarea
              v-model="conclusion.sample"
              aria-label="样品结论"
              rows="2"
            />
          </label>
          <label class="field">
            <span>产能约束（必填）</span>
            <textarea
              v-model="conclusion.capacity"
              aria-label="产能约束"
              rows="2"
            />
          </label>
          <div class="actions">
            <button type="button" @click="nominatingId = ''">取消</button>
            <button
              type="button"
              class="primary"
              :disabled="
                saving ||
                !conclusion.sample.trim() ||
                !conclusion.capacity.trim()
              "
              @click="
                submitNomination(
                  selected!.quotations.find(
                    (q) => q.quotationId === nominatingId,
                  )!,
                )
              "
            >
              确认定点
            </button>
          </div>
        </div>

        <p v-if="!selected" class="empty">先从左边的队列选一件。</p>
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
}
.pane-head .meta,
.pane-head .note {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
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
.group ul,
.quotes {
  display: grid;
  gap: var(--space-2);
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
.identity {
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
.quotes li {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
}
.quote-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--brand-strong);
  font-weight: 700;
}
.quotes small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.field {
  display: grid;
  gap: var(--space-1);
}
.field > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.row {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
}
input,
textarea,
select {
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  background: var(--surface);
  color: inherit;
  font: inherit;
  width: 100%;
}
.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-meta);
}
.check input {
  width: auto;
}
.note {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}
.actions {
  display: flex;
  gap: var(--space-2);
}
button {
  justify-self: start;
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
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.empty {
  margin: 0;
  padding: var(--space-2) 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
}
</style>
