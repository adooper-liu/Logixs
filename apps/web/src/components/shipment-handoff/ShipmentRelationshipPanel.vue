<script setup lang="ts">
import { AlertCircle, CheckCircle2, ExternalLink } from "@lucide/vue";
import type { DeepReadonly } from "vue";
import type { ShipmentDetailV1 } from "../../api/shipments";

defineProps<{ detail: DeepReadonly<ShipmentDetailV1> }>();
</script>

<template>
  <section class="relationship-panel" aria-labelledby="relationship-title">
    <header>
      <span>
        <small>接管完成，共用同一组权威关系</small>
        <h2 id="relationship-title">
          Shipment
          {{ detail.shipment.shipmentNumber ?? detail.shipment.id.slice(0, 8) }}
        </h2>
      </span>
      <router-link
        :to="`/workspaces/dispatch?shipmentId=${detail.shipment.id}`"
      >
        打开出运详情 <ExternalLink :size="14" aria-hidden="true" />
      </router-link>
    </header>
    <div class="relationship-grid">
      <section>
        <small>来源备货单</small>
        <b>
          {{
            [
              ...new Set(
                detail.upstreamReferences
                  .filter((item) => item.referenceType === "stocking_order")
                  .map((item) => item.sourceRecordId),
              ),
            ].join("、") || "待补"
          }}
        </b>
      </section>
      <section>
        <small>货柜</small>
        <b>{{
          detail.containers
            .map((item) => item.containerNumber ?? "箱号待补")
            .join("、")
        }}</b>
      </section>
      <section>
        <small>SKU 装载</small>
        <b>{{ detail.cargoLines.length }} 行</b>
      </section>
      <section :class="detail.pendingItems.length ? 'pending' : 'ready'">
        <small>后续补全</small>
        <b>
          <AlertCircle
            v-if="detail.pendingItems.length"
            :size="14"
            aria-hidden="true"
          />
          <CheckCircle2 v-else :size="14" aria-hidden="true" />
          {{
            detail.pendingItems.length
              ? `${detail.pendingItems.length} 项待补`
              : "当前已齐"
          }}
        </b>
      </section>
    </div>
  </section>
</template>

<style scoped>
.relationship-panel {
  margin-top: var(--space-3);
  border: 1px solid var(--line);
  border-left: 3px solid var(--ok);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.relationship-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--line);
}

.relationship-panel h2 {
  margin: var(--space-1) 0 0;
  font-size: var(--text-title);
}

.relationship-panel small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.relationship-panel a,
.relationship-panel b {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.relationship-panel a {
  color: var(--brand-strong);
  font-size: var(--text-meta);
  font-weight: 700;
  text-decoration: none;
}

.relationship-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.relationship-grid section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-right: 1px solid var(--line);
}

.relationship-grid section:last-child {
  border-right: 0;
}

.relationship-grid b {
  overflow-wrap: anywhere;
  font-size: var(--text-meta);
}

.pending b {
  color: var(--warn);
}
.ready b {
  color: var(--ok);
}

@media (max-width: 720px) {
  .relationship-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .relationship-grid section:nth-child(2) {
    border-right: 0;
  }
  .relationship-grid section:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }
}
</style>
