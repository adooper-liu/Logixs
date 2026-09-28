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
import {
  RECIPIENTS,
  SORT_LABELS,
  remainingLabel,
  useShipmentRiskWorkbench,
} from "../composables/useShipmentRiskWorkbench";
import type { WorkHandoffRecipientV1 } from "../api/shipments";

const route = useRoute();
const router = useRouter();
const requestedId = computed(() => String(route.query.shipmentId ?? ""));

async function selectShipment(shipmentId: string): Promise<void> {
  await router.replace({
    path: "/workspaces/dispatch",
    query: { view: "risk", shipmentId },
  });
}

const {
  groups,
  sort,
  selected,
  openOf,
  loading,
  saving,
  error,
  receipt,
  load,
  changeSort,
  handOff,
} = useShipmentRiskWorkbench({ selectedId: requestedId });

const recipient = ref<WorkHandoffRecipientV1>("customs");
const title = ref("");
const detail = ref("");

onMounted(async () => {
  await load();
  // 默认落在最该处理的那一条 —— 打开工作台还要先点一下才看得见内容，是把负担推给人。
  if (!selected.value) {
    const first = groups.value.flatMap((group) => group.items)[0];
    if (first) await selectShipment(first.shipment.id);
  }
});

// 换票就清掉上一票的动作草稿，免得把甲的说明交到乙身上。
watch(requestedId, () => {
  title.value = "";
  detail.value = "";
});

/** 这一票为什么现在需要处理。理由按紧迫度排，与队列顺序同一口径。 */
const REASON_LABELS: Record<string, string> = {
  overdue_deadline: "已逾期",
  open_exceptions: "有未解决异常",
  unassigned_exceptions: "有未归属到票的异常",
  pending_gaps: "有待补事项",
};

const reasonLabels = computed(() =>
  (selected.value?.risk.reasons ?? []).map(
    (reason) => REASON_LABELS[reason] ?? reason,
  ),
);

const workResult = computed(() => {
  if (!selected.value) return "选一票开始";
  const waiting = openOf(selected.value.shipment.id);
  return waiting.length > 0
    ? `已交给${waiting.length}个岗位，等回音`
    : "这一票在我手上";
});

const currentOwner = computed(() => {
  const waiting = selected.value ? openOf(selected.value.shipment.id) : [];
  if (waiting.length === 0) return "出运运营（我）";
  return waiting
    .map(
      (handoff) =>
        RECIPIENTS.find((r) => r.code === handoff.recipientQueueCode)?.label ??
        handoff.recipientQueueCode,
    )
    .join("、");
});

async function submitHandoff(): Promise<void> {
  const saved = await handOff(recipient.value, title.value, detail.value);
  if (saved) {
    title.value = "";
    detail.value = "";
  }
}

async function reload(): Promise<void> {
  await load();
}
</script>

<template>
  <main class="risk-workbench page-frame">
    <PageHeader
      eyebrow="出运运营岗位工作台"
      title="在途 Shipment"
      summary="按业务原因找到现在该处理哪一票，看懂它为什么排在前面，再把它交给正确的专业岗位。"
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
      <span><small>谁在工作</small><b>出运运营</b></span>
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
          <h2>在途票</h2>
          <label class="sort">
            <span>排序</span>
            <select
              :value="sort"
              aria-label="排序方式"
              @change="
                changeSort(
                  ($event.target as HTMLSelectElement).value as typeof sort,
                )
              "
            >
              <option
                v-for="option in SORT_LABELS"
                :key="option.code"
                :value="option.code"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <p class="note">
            队列按<em>该谁动</em>分组；「临期」只做标签与排序 ——
            一件票可以既临期又待我， 分组与排序不能是同一个维度。
          </p>
        </header>

        <p v-if="loading && !selected" class="empty">正在读取在途票</p>
        <template v-else>
          <div v-for="group in groups" :key="group.code" class="group">
            <h3>
              {{ group.label
              }}<span class="count">{{ group.items.length }}</span>
            </h3>
            <p v-if="group.items.length === 0" class="empty">没有</p>
            <ul v-else>
              <li v-for="item in group.items" :key="item.shipment.id">
                <button
                  type="button"
                  :class="{ 'is-selected': item.shipment.id === requestedId }"
                  @click="selectShipment(item.shipment.id)"
                >
                  <span class="identity">
                    {{
                      item.shipment.shipmentNumber ||
                      item.shipment.id.slice(0, 8)
                    }}
                    · {{ item.shipment.vesselName || "未填船名" }}
                    {{ item.shipment.voyageNumber || "" }}
                  </span>
                  <span class="meta">
                    {{ item.shipment.originUnlocode || "?" }} →
                    {{ item.shipment.destinationUnlocode || "?" }}
                    · {{ item.shipment.activeContainerCount }} 柜
                  </span>
                  <span class="deadline">
                    {{ remainingLabel(item.risk.nearestDeadline?.at) }}
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
            <small>它为什么排在前面</small>
            <h2>
              {{
                selected.shipment.shipmentNumber ||
                selected.shipment.id.slice(0, 8)
              }}
            </h2>
            <p class="meta">
              {{ selected.shipment.vesselName || "未填船名" }}
              {{ selected.shipment.voyageNumber || "" }} ·
              {{ selected.shipment.originUnlocode || "?" }} →
              {{ selected.shipment.destinationUnlocode || "?" }}
            </p>
          </header>

          <div class="block">
            <span class="label">已经摆在面前的事实</span>
            <p class="deadline-big">
              {{ remainingLabel(selected.risk.nearestDeadline?.at) }}
              <small v-if="selected.risk.nearestDeadline">
                （{{
                  selected.risk.nearestDeadline.kind === "eta"
                    ? "预计到港"
                    : "任务截止"
                }}）
              </small>
            </p>
            <ul v-if="reasonLabels.length" class="reasons">
              <li v-for="reason in reasonLabels" :key="reason">{{ reason }}</li>
            </ul>
          </div>

          <div class="block">
            <span class="label"
              >缺口（{{ selected.pendingItems.length }}）</span
            >
            <p v-if="selected.pendingItems.length === 0" class="note">
              这一票没有待补事项。
            </p>
            <ul v-else class="gaps">
              <li v-for="gap in selected.pendingItems" :key="gap.code">
                <b>{{ gap.label }}</b>
                <small>
                  当前值：{{ gap.currentValue ?? "没有" }}
                  <template v-if="gap.directAction">
                    · 可就地{{ gap.directAction.label }}
                  </template>
                </small>
              </li>
            </ul>
          </div>

          <div class="block">
            <span class="label">已经交出去的事</span>
            <p v-if="openOf(selected.shipment.id).length === 0" class="note">
              这一票还没有交给任何专业岗位。
            </p>
            <ul v-else class="handoffs">
              <li
                v-for="handoff in openOf(selected.shipment.id)"
                :key="handoff.handoffId"
              >
                <b>{{ handoff.title }}</b>
                <small>
                  交给{{
                    RECIPIENTS.find(
                      (r) => r.code === handoff.recipientQueueCode,
                    )?.label
                  }}岗位 ·
                  {{
                    handoff.state === "raised"
                      ? "还没人接"
                      : `${handoff.claimedByActorId} 已接、在办`
                  }}
                  · {{ new Date(handoff.raisedAt).toLocaleString("zh-CN") }}
                </small>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="empty">
          {{ loading ? "正在读取在途票" : "暂无在途票" }}
        </p>
      </section>

      <section class="pane">
        <header class="pane-head">
          <small>现在做什么</small>
          <h2>交给专业岗位</h2>
        </header>
        <template v-if="selected">
          <div class="block">
            <p class="note">
              交给<em>岗位</em>而不是某个人 ——
              你只需判断归谁办，不必知道今天谁在班。
              谁在班谁领，这一票随即进入「等待他人」。
            </p>
            <label class="field">
              <span>交给哪个岗位</span>
              <select v-model="recipient" aria-label="交给哪个岗位">
                <option
                  v-for="option in RECIPIENTS"
                  :key="option.code"
                  :value="option.code"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>要他们做什么</span>
              <input
                v-model="title"
                aria-label="要他们做什么"
                placeholder="例如：这票缺随车单，请清关岗位补"
              />
            </label>
            <label class="field">
              <span>补充说明（可选）</span>
              <textarea v-model="detail" aria-label="补充说明" rows="2" />
            </label>
            <div class="actions">
              <button
                type="button"
                class="primary"
                :disabled="saving || !title.trim()"
                @click="submitHandoff"
              >
                {{ saving ? "正在交出去" : "交给该岗位" }}
              </button>
            </div>
          </div>

          <div class="block">
            <span class="label">专业岗位看得到</span>
            <p class="note">
              交出去之后它出现在该岗位的待办里，由岗位上的人领取、办理、写结论了结。
              对方了结后这一票才从「等待他人」回到你手上。
            </p>
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
.pane-head .meta,
.pane-head .note {
  margin: var(--space-2) 0 0;
  color: var(--ink-soft);
  font-size: var(--text-micro);
  line-height: var(--leading-body);
}
.sort {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--text-micro);
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
.reasons,
.gaps,
.handoffs {
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
.deadline {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 600;
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
.deadline-big {
  margin: 0;
  font-size: var(--text-title);
  font-weight: 700;
}
.deadline-big small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 400;
}
.gaps li,
.handoffs li {
  display: grid;
  gap: var(--space-1);
}
.gaps small,
.handoffs small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.reasons {
  color: var(--risk);
  font-size: var(--text-meta);
}
.field {
  display: grid;
  gap: var(--space-1);
}
.field > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
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
  padding: var(--space-3) var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-meta);
}
</style>
