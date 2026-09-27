<script setup lang="ts">
import { CircleAlert, CircleHelp } from "@lucide/vue";
import type { NodeTaskQueueGuidance } from "../../data/nodeTaskQueueGuidance";

defineProps<NodeTaskQueueGuidance>();
</script>

<template>
  <span class="queue-guidance">
    <small class="queue-guidance__reason">
      <CircleHelp :size="12" />为什么：{{ attentionReason }}
    </small>
    <small :class="`queue-guidance__${conditionKind}`">
      <CircleAlert :size="12" />
      {{ conditionKind === "gap" ? "缺口" : "下一步" }}：{{ conditionLabel }}
    </small>
  </span>
</template>

<style scoped>
.queue-guidance {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.queue-guidance small {
  min-width: 0;
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-1);
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: var(--text-micro);
}

.queue-guidance svg {
  flex: none;
}

.queue-guidance .queue-guidance__reason {
  color: var(--ink-soft);
}

.queue-guidance .queue-guidance__gap {
  color: var(--risk);
}

.queue-guidance .queue-guidance__next {
  color: var(--brand-strong);
}
</style>
