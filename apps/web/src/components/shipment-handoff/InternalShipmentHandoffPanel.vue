<script setup lang="ts">
import { ArrowRight, Boxes, RefreshCw, Ship } from "@lucide/vue";
import type { DeepReadonly } from "vue";
import type { InternalShipmentHandoffCandidateV1 } from "../../api/shipments";

defineProps<{
  candidates: readonly DeepReadonly<InternalShipmentHandoffCandidateV1>[];
  loading: boolean;
  acceptingRef: string;
  error: string;
}>();

const emit = defineEmits<{
  refresh: [];
  accept: [candidateRef: string];
}>();
</script>

<template>
  <section class="internal-handoff" aria-labelledby="internal-handoff-title">
    <header>
      <span class="title-icon" aria-hidden="true"><Boxes :size="18" /></span>
      <span>
        <small>无需重复导入</small>
        <h2 id="internal-handoff-title">系统内已出运记录</h2>
      </span>
      <button type="button" :disabled="loading" @click="emit('refresh')">
        <RefreshCw :size="15" aria-hidden="true" />刷新
      </button>
    </header>

    <p v-if="error" class="state state--error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="state">正在读取备货、装箱和离港事实…</p>
    <p v-else-if="candidates.length === 0" class="state">
      当前没有尚未接管的内部已出运记录。
    </p>
    <div v-else class="candidate-list">
      <article v-for="candidate in candidates" :key="candidate.candidateRef">
        <span class="ship-icon" aria-hidden="true"><Ship :size="17" /></span>
        <span class="identity">
          <b>{{ candidate.vesselName }} / {{ candidate.voyageNumber }}</b>
          <small>
            {{ candidate.originPortCode ?? "起运港待补" }}
            → {{ candidate.destinationPortCode ?? "目的港待补" }} ·
            {{ candidate.bookingNumber }}
          </small>
        </span>
        <span class="facts">
          <b>{{ candidate.containers.length }} 柜</b>
          <small>
            {{
              candidate.replenishmentOrders
                .map((item) => item.orderNumber)
                .join("、")
            }}
            · {{ candidate.cargoLines.length }} 个 SKU 装载行
          </small>
        </span>
        <span class="gaps"> {{ candidate.pendingItems.length }} 项待补 </span>
        <button
          type="button"
          class="accept-button"
          :disabled="Boolean(acceptingRef)"
          @click="emit('accept', candidate.candidateRef)"
        >
          {{
            acceptingRef === candidate.candidateRef
              ? "正在接管"
              : "接管 Shipment"
          }}
          <ArrowRight :size="15" aria-hidden="true" />
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.internal-handoff {
  margin-top: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.internal-handoff > header {
  min-height: 58px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.internal-handoff h2,
.internal-handoff p {
  margin: 0;
}

.internal-handoff h2 {
  font-size: var(--text-title);
}

.internal-handoff small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.title-icon,
.ship-icon {
  display: grid;
  place-items: center;
  color: var(--brand-strong);
}

.title-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
}

.internal-handoff button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font-weight: var(--weight-page);
  cursor: pointer;
}

.candidate-list article {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(180px, 1.2fr) minmax(180px, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.candidate-list article:last-child {
  border-bottom: 0;
}

.identity,
.facts {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.identity b,
.facts small {
  overflow-wrap: anywhere;
}

.gaps {
  color: var(--warn);
  font-size: var(--text-meta);
  font-weight: var(--weight-page);
}

.accept-button {
  border-color: var(--brand) !important;
  background: var(--brand) !important;
  color: var(--on-brand) !important;
}

.state {
  padding: var(--space-4);
  color: var(--muted);
}

.state--error {
  color: var(--risk);
}

@media (max-width: 820px) {
  .candidate-list article {
    grid-template-columns: 30px minmax(0, 1fr) auto;
  }

  .facts {
    grid-column: 2 / -1;
  }

  .gaps {
    grid-column: 2;
  }
}

@media (max-width: 560px) {
  .candidate-list article {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .facts,
  .gaps,
  .accept-button {
    grid-column: 2;
  }
}
</style>
