<script setup lang="ts">
import { CalendarClock, Hourglass, UserRound } from "@lucide/vue";
import type { MarketSignalActiveValidationV1 } from "@logix/contracts";

const props = defineProps<{
  validation: MarketSignalActiveValidationV1 | null;
  actorId: string | null;
}>();

function ownerLabel(): string {
  if (!props.validation) return "未安排";
  return props.actorId === props.validation.responsibleActorId
    ? "我"
    : props.validation.responsibleActorId;
}
</script>

<template>
  <section class="active-validation" aria-label="当前验证承诺">
    <header>
      <small>当前验证承诺</small>
      <b v-if="validation">负责人：{{ ownerLabel() }}</b>
      <b v-else>尚未安排下一项验证</b>
    </header>
    <template v-if="validation">
      <p class="validation-focus">
        {{ validation.watchFocus || "旧记录未填写，需重新安排" }}
      </p>
      <div class="validation-meta">
        <span>
          <CalendarClock :size="15" aria-hidden="true" />
          检查日 {{ validation.nextReviewDate }}
        </span>
        <span v-if="validation.waitingReason">
          <Hourglass :size="15" aria-hidden="true" />
          等待 {{ validation.waitingReason }}
        </span>
        <span>
          <UserRound :size="15" aria-hidden="true" />
          {{ ownerLabel() }}
        </span>
      </div>
    </template>
    <p v-else class="validation-empty">
      选择“安排下一项验证”，写清由谁负责、验证什么以及何时回来检查。
    </p>
  </section>
</template>

<style scoped>
.active-validation {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.active-validation header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.active-validation small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: 700;
}

.active-validation b,
.validation-focus,
.validation-empty {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: var(--text-label);
}

.validation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.validation-meta span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
</style>
