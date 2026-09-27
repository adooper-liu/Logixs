<script setup lang="ts">
import { CheckCircle2, Hand, UserRoundCheck } from "@lucide/vue";
import type { ProductInitiativeNpiQueueEntryV1 } from "@logix/contracts";

defineProps<{ entry: ProductInitiativeNpiQueueEntryV1; busy: boolean }>();
defineEmits<{ claim: [] }>();
</script>

<template>
  <section class="npi-action">
    <header>
      <small>现在做什么</small>
      <h2>接住这一票</h2>
    </header>

    <div v-if="!entry.claim" class="action-body">
      <Hand :size="22" />
      <b>领取后由你负责推进到可发布的产品定义</b>
      <p>
        领取不会自动产生产品结论，也不会改写立项阶段的判断 ——
        只是让这一票有明确的 产品负责人，不再悬空。
      </p>
      <button type="button" :disabled="busy" @click="$emit('claim')">
        {{ busy ? "正在领取" : "领取此立项" }}
      </button>
    </div>

    <div v-else class="action-body action-body--done">
      <UserRoundCheck :size="22" />
      <b>已由 {{ entry.claim.productOwnerActorId }} 负责</b>
      <p>
        领取于
        {{ new Date(entry.claim.claimedAt).toLocaleString("zh-CN") }}。
        <template v-if="entry.claim.productOwnerActorId === 'dev-operator'">
          接下来是产品规格、里程碑与发布决定 —— 那是本节点的下一片。
        </template>
        <template v-else> 这一票已在他人手上，不会重复领取。 </template>
      </p>
    </div>

    <!-- 领取之外的动作（转交、放手）本片不做：还没有真实诉求，先不摆按不动的按钮。 -->
    <p class="scope-note">
      <CheckCircle2 :size="14" />
      本片只做到"接住"；产品规格、里程碑与发布决定是下一片。
    </p>
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
  border-bottom: 1px solid var(--line);
}
.action-body p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-meta);
  line-height: var(--leading-body);
}
.action-body--done {
  color: var(--ok);
}
button {
  justify-self: start;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--brand);
  border-radius: var(--radius-s);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.scope-note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-micro);
}
</style>
