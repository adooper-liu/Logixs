<script setup lang="ts">
import { AlertCircle, Inbox, RefreshCw } from "@lucide/vue";
import { computed, ref } from "vue";
import PageHeader from "../components/ui/PageHeader.vue";
import type {
  ShipmentWorkHandoffV1,
  WorkHandoffRecipientV1,
} from "../api/shipments";
import { RECIPIENTS } from "../composables/useShipmentRiskWorkbench";
import { useWorkInbox } from "../composables/useWorkInbox";

/**
 * 岗位待办。**为什么单独一页而不是塞进各专业工作台**：
 * 那些工作台已经有一个队列（按柜的任务队列），再加一个交办队列就成了两个主选择源，
 * 违反 WB-D05。所以交办事项独立成页，专业工作台保持"一个队列驱动"。
 */
const recipient = ref<WorkHandoffRecipientV1>("customs");
const conclusions = ref<Record<string, string>>({});

const { waiting, mine, loading, saving, error, receipt, load, claim, close } =
  useWorkInbox({ recipient });

const recipientLabel = computed(
  () => RECIPIENTS.find((item) => item.code === recipient.value)?.label ?? "",
);

async function submitClose(handoff: ShipmentWorkHandoffV1): Promise<void> {
  const saved = await close(
    handoff,
    conclusions.value[handoff.handoffId] ?? "",
  );
  if (saved) delete conclusions.value[handoff.handoffId];
}

async function reload(): Promise<void> {
  await load();
}
</script>

<template>
  <main class="work-inbox page-frame">
    <PageHeader
      eyebrow="专业岗位待办"
      title="岗位待办"
      summary="出运运营交过来的事项：领取它、办完它、写下结论 —— 交办的人靠你这句话判断下一步。"
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
      <Inbox :size="19" />
      <span
        ><small>哪个岗位</small><b>{{ recipientLabel }}</b></span
      >
      <span
        ><small>等我领取</small><b>{{ waiting.length }}</b></span
      >
      <span
        ><small>我在办</small><b>{{ mine.length }}</b></span
      >
    </section>

    <div class="workbench-grid">
      <section class="pane">
        <header class="pane-head">
          <small>谁的待办</small>
          <h2>看哪个岗位</h2>
          <label class="field">
            <span>岗位</span>
            <select v-model="recipient" aria-label="看哪个岗位">
              <option
                v-for="option in RECIPIENTS"
                :key="option.code"
                :value="option.code"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <p class="note">
            队列按岗位分。**只到岗位不到人** ——
            交办的人不必知道今天谁在班，谁在班谁领。
          </p>
        </header>

        <p v-if="loading" class="empty">正在读取岗位待办</p>
        <template v-else>
          <div class="group">
            <h3>
              等我领取<span class="count">{{ waiting.length }}</span>
            </h3>
            <p v-if="waiting.length === 0" class="empty">没有</p>
            <ul v-else>
              <li v-for="handoff in waiting" :key="handoff.handoffId">
                <b>{{ handoff.title }}</b>
                <small v-if="handoff.detail">{{ handoff.detail }}</small>
                <small>
                  来自票 {{ handoff.shipmentId.slice(0, 8) }} ·
                  {{ new Date(handoff.raisedAt).toLocaleString("zh-CN") }}
                </small>
                <button
                  type="button"
                  class="primary"
                  :disabled="saving"
                  @click="claim(handoff)"
                >
                  领取这件
                </button>
              </li>
            </ul>
          </div>
          <div class="group">
            <h3>
              我在办<span class="count">{{ mine.length }}</span>
            </h3>
            <p v-if="mine.length === 0" class="empty">没有</p>
            <ul v-else>
              <li v-for="handoff in mine" :key="handoff.handoffId">
                <b>{{ handoff.title }}</b>
                <small v-if="handoff.detail">{{ handoff.detail }}</small>
                <small>
                  {{ handoff.claimedByActorId }} 领于
                  {{
                    new Date(
                      handoff.claimedAt ?? handoff.raisedAt,
                    ).toLocaleString("zh-CN")
                  }}
                </small>
                <label class="field">
                  <span>怎么了结的（必填）</span>
                  <textarea
                    v-model="conclusions[handoff.handoffId]"
                    :aria-label="`${handoff.title} 的结论`"
                    rows="2"
                    placeholder="办了什么、结论是什么"
                  />
                </label>
                <button
                  type="button"
                  :disabled="
                    saving || !(conclusions[handoff.handoffId] ?? '').trim()
                  "
                  @click="submitClose(handoff)"
                >
                  了结
                </button>
              </li>
            </ul>
          </div>
        </template>
      </section>

      <section class="pane">
        <header class="pane-head">
          <small>这一页怎么用</small>
          <h2>三步</h2>
        </header>
        <div class="block">
          <ol class="steps">
            <li><b>领取</b> —— 领了才归你办，别人不会再抢走。</li>
            <li><b>办事</b> —— 用你这个岗位本来就在用的那些工作台。</li>
            <li>
              <b>写结论了结</b> ——
              交办的人看到你的结论，这一票才会从「等待他人」回到他手上。
            </li>
          </ol>
          <p class="note">
            <em>没领不能了结，不是你领的不能由你结</em> ——
            服务端这么判，这里也不给按不动的按钮。
          </p>
        </div>
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
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.group li {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
}
.group small {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
.block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}
.steps {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-4);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}
.field {
  display: grid;
  gap: var(--space-1);
}
.field > span {
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
select,
textarea {
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
