<script setup lang="ts">
import { CheckCircle2, Hand, UserRoundCheck } from "@lucide/vue";
import type { ProductOpportunityV1 } from "@logix/contracts";

defineProps<{ item: ProductOpportunityV1; busy: boolean }>();
defineEmits<{ claim: []; accept: [] }>();
</script>

<template>
  <section class="opportunity-actions">
    <header>
      <small>现在做什么</small>
      <h2>接收经营机会</h2>
    </header>
    <div v-if="item.intakeState === 'queued'" class="action-body">
      <Hand :size="22" />
      <b>领取后由你负责完成立项判断</b>
      <p>领取不会自动立项，也不要求先补齐经营团队留下的普通缺口。</p>
      <button type="button" :disabled="busy" @click="$emit('claim')">
        {{ busy ? "正在领取" : "领取此机会" }}
      </button>
    </div>
    <div v-else-if="item.intakeState === 'claimed'" class="action-body">
      <UserRoundCheck :size="22" />
      <b>已领取，确认是否接受本次交接</b>
      <p>接受后进入选品立项判断；本切片不提前替你作出立项结论。</p>
      <button type="button" :disabled="busy" @click="$emit('accept')">
        {{ busy ? "正在确认" : "接受并进入立项判断" }}
      </button>
    </div>
    <!--
      已接受的机会不走这里：那时主动作是"形成立项结论"（ProductInitiativeOutcomePanel），
      本组件只负责领取与接受这一步。
    -->
    <div v-else class="action-body action-body--done">
      <CheckCircle2 :size="22" />
      <b>该版本已被新版替代</b>
      <p>请返回队列处理同一信号的最新交接版本。</p>
    </div>
  </section>
</template>

<style scoped>
header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
header small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}
h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}
.action-body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}
.action-body > svg {
  color: var(--brand-strong);
}
.action-body b {
  color: var(--ink);
  font-size: var(--text-meta);
}
.action-body p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}
.action-body button {
  min-height: var(--touch-target);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}
.action-body button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.action-body--done {
  background: var(--ok-bg);
}
.action-body--done > svg {
  color: var(--ok);
}
</style>
