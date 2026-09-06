<script setup lang="ts">
import { ArrowLeft, Container, MapPin } from "@lucide/vue";
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
      <span class="object-icon" aria-hidden="true">
        <Container :size="20" />
      </span>
      <div class="identity-copy">
        <div class="identity-title">
          <h3 class="mono">{{ record.containerNumber }}</h3>
          <span>{{ record.typeCode }}</span>
        </div>
        <small class="mono">
          {{ record.orderNumber }} · {{ record.billOfLading }}
        </small>
        <span class="location">
          <MapPin :size="13" />{{ record.location }}
          <span class="mono">{{ record.containerRecordId }}</span>
        </span>
      </div>
    </div>
    <StatusTriplet
      :container-status="record.currentStatus"
      :task-status="record.taskStatus"
      :sync-status="record.syncStatus"
      compact
      variant="context"
      :show-idle-sync="false"
    />
  </section>
</template>

<style scoped>
.object-context {
  display: grid;
  grid-template-columns: minmax(390px, 0.9fr) minmax(0, 1.5fr);
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.object-identity {
  min-width: 0;
  display: grid;
  grid-template-columns: 34px 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 7px 10px;
  border-right: 1px solid var(--line);
}

.identity-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.object-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-s);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.identity-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.identity-title > span {
  padding: 1px 5px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  color: var(--ink-soft);
  font-size: 9px;
  font-weight: 700;
}

.location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.location > span {
  margin-left: 4px;
  color: var(--muted);
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

@media (max-width: 520px) {
  .object-identity {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .object-icon {
    display: none;
  }

  .location > span {
    display: none;
  }
}
</style>
