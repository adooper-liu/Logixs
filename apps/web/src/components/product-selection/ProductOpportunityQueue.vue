<script setup lang="ts">
import { ArrowRight, CircleAlert } from "@lucide/vue";
import type {
  ProductInitiativeQueueEntryV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import { computed } from "vue";
import {
  initiativeQueueBadge,
  type ProductInitiativeQueueBadge,
} from "../../data/productInitiativeQueue";

const props = defineProps<{
  items: ProductOpportunityV1[];
  selectedId: string;
  /** 队列上的立项投影；没有条目就是"还没看过"。 */
  initiatives: Map<string, ProductInitiativeQueueEntryV1>;
}>();
defineEmits<{ select: [id: string] }>();

/** 每条机会连同它的立项标记一次算好，模板里不再重复查。 */
const decorated = computed<
  { item: ProductOpportunityV1; badge: ProductInitiativeQueueBadge | null }[]
>(() =>
  props.items.map((item) => ({
    item,
    badge: initiativeQueueBadge(props.initiatives.get(item.handoff.handoffId)),
  })),
);

function stateLabel(state: ProductOpportunityV1["intakeState"]): string {
  if (state === "claimed") return "已领取";
  if (state === "accepted") return "已接受";
  if (state === "superseded") return "已有新版";
  return "待领取";
}
</script>

<template>
  <section class="opportunity-queue" aria-label="选品机会队列">
    <header>
      <small>先处理什么</small>
      <h2>经营机会</h2>
    </header>
    <button
      v-for="{ item, badge } in decorated"
      :key="item.handoff.handoffId"
      type="button"
      class="queue-item"
      :class="{ selected: item.handoff.handoffId === selectedId }"
      @click="$emit('select', item.handoff.handoffId)"
    >
      <span class="state">{{ stateLabel(item.intakeState) }}</span>
      <strong>{{ item.handoff.title }}</strong>
      <span
        >{{ item.handoff.marketCode || "市场待补" }} ·
        {{ item.handoff.channelCode || "渠道待补" }}</span
      >
      <!--
        这一行是队列上唯一能分出"看过但先放着"和"还没看过"的地方：
        没有立项记录的机会不显示任何标记，而不是和已处理的长得一样。
      -->
      <span
        v-if="badge"
        class="initiative"
        :class="`initiative--${badge.state}`"
      >
        {{ badge.label
        }}<template v-if="badge.pendingCount">
          · 待补 {{ badge.pendingCount }} 项</template
        >
      </span>
      <span v-else class="reason"
        ><CircleAlert :size="14" />经营团队判断值得进一步评估</span
      >
      <span v-if="item.handoff.pendingFieldCodes.length" class="gaps">
        随交接待补 {{ item.handoff.pendingFieldCodes.length }} 项
      </span>
      <ArrowRight class="arrow" :size="16" aria-hidden="true" />
    </button>
    <p v-if="items.length === 0" class="empty">暂无经营团队交来的机会。</p>
  </section>
</template>

<style scoped>
.opportunity-queue header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.opportunity-queue header small,
.state {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
.opportunity-queue h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}
.queue-item {
  position: relative;
  width: 100%;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6) var(--space-3) var(--space-4);
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-label);
  text-align: left;
}
.queue-item.selected {
  box-shadow: inset 3px 0 var(--brand);
  background: var(--brand-soft);
}
.queue-item strong {
  color: var(--ink);
  font-size: var(--text-meta);
}
.reason {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
}
.reason svg {
  flex: none;
  color: var(--brand-strong);
}
.gaps {
  color: var(--warn);
}
.initiative {
  font-weight: 700;
}
.initiative--pending {
  color: var(--warn);
}
.initiative--closed {
  color: var(--muted);
}
.initiative--handed_off {
  color: var(--ok);
}
.arrow {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  color: var(--muted);
}
.empty {
  margin: 0;
  padding: var(--space-6) var(--space-4);
  color: var(--muted);
  text-align: center;
}
</style>
