<script setup lang="ts">
import { ArrowRight, BriefcaseBusiness } from "@lucide/vue";
import type {
  WorkbenchHandoff,
  WorkbenchStage,
} from "../../data/workbenchNetwork";

defineProps<{
  stage: WorkbenchStage;
  inbound: WorkbenchHandoff | null;
  outbound: WorkbenchHandoff | null;
}>();
</script>

<template>
  <section class="flow-context" aria-label="当前责任与交接">
    <div class="flow-party">
      <small>上游交接</small>
      <b>{{ inbound?.name ?? "业务链起点" }}</b>
    </div>
    <ArrowRight class="flow-arrow" :size="18" aria-hidden="true" />
    <div class="flow-party flow-party--current">
      <BriefcaseBusiness :size="18" aria-hidden="true" />
      <span>
        <small>当前责任</small>
        <b>{{ stage.ownerRole }}</b>
      </span>
    </div>
    <ArrowRight class="flow-arrow" :size="18" aria-hidden="true" />
    <div class="flow-party">
      <small>下一交接</small>
      <b>{{ outbound?.name ?? "主链责任收口" }}</b>
    </div>
  </section>
</template>

<style scoped>
.flow-context {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.15fr) auto minmax(
      0,
      1fr
    );
  align-items: stretch;
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.flow-party {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-3);
}

.flow-party--current {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.flow-party--current span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.flow-party small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.flow-party b {
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}

.flow-arrow {
  align-self: center;
  color: var(--muted);
}

@media (max-width: 680px) {
  .flow-context {
    grid-template-columns: 1fr;
  }

  .flow-arrow {
    display: none;
  }

  .flow-party + .flow-party {
    border-top: 1px solid var(--line);
  }
}
</style>
