<script setup lang="ts">
import { ArrowLeft, MapPin } from "@lucide/vue";
import type { ContainerProjection } from "../../data/sample";
import StatusTriplet from "./StatusTriplet.vue";

defineProps<{ record: ContainerProjection }>();
</script>

<template>
  <section class="object-context" aria-label="当前货柜上下文">
    <div class="object-identity">
      <router-link
        to="/containers"
        class="icon-button back"
        aria-label="返回已出运货柜"
      >
        <ArrowLeft :size="18" />
      </router-link>
      <div>
        <h3 class="mono">{{ record.containerNumber }}</h3>
        <small class="mono"
          >{{ record.orderNumber }} · {{ record.billOfLading }}</small
        >
      </div>
      <span class="location"
        ><MapPin :size="14" />{{ record.location }}
        <span class="mono">{{ record.containerRecordId }}</span></span
      >
    </div>
    <StatusTriplet
      :container-status="record.currentStatus"
      :task-status="record.taskStatus"
      :sync-status="record.syncStatus"
      compact
    />
  </section>
</template>

<style scoped>
.object-context {
  display: grid;
  grid-template-columns: minmax(320px, 0.8fr) minmax(480px, 1.5fr);
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.object-identity {
  min-width: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 3px 10px;
  align-items: center;
  padding: 7px 10px;
  border-right: 1px solid var(--line);
}

.object-identity > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.object-identity small,
.location {
  color: var(--muted);
  font-size: 10px;
}

.object-identity h3 {
  margin: 0;
  font-size: 17px;
}

.location {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 4px;
}

.location > span {
  margin-left: 4px;
  color: var(--muted);
}

:deep(.status-triplet) {
  border: 0;
  border-radius: 0;
}

@media (max-width: 1100px) {
  .object-context {
    grid-template-columns: 1fr;
  }

  .object-identity {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
</style>
