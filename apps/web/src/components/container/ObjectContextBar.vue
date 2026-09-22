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
        aria-label="回干活"
      >
        <ArrowLeft :size="18" />
      </router-link>
      <span class="object-icon" aria-hidden="true">
        <Container :size="20" />
      </span>
      <div class="identity-copy">
        <div class="identity-title">
          <h3 class="mono">{{ record.containerNumber }}</h3>
          <span v-if="record.typeCode">{{ record.typeCode }}</span>
        </div>
        <small v-if="record.orderNumber" class="mono">
          {{ record.orderNumber
          }}<template v-if="record.billOfLading">
            · {{ record.billOfLading }}</template
          >
        </small>
        <span v-if="record.location" class="location">
          <MapPin :size="13" />{{ record.location }}
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
      :show-idle-task="false"
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
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-right: 1px solid var(--line);
}

.identity-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.object-identity small,
.location {
  color: var(--muted);
  font-size: var(--text-micro);
}

.object-identity h3 {
  margin: 0;
  font-size: var(--text-page);
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
  gap: var(--space-2);
}

.identity-title > span {
  padding: var(--space-1) var(--space-1);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  color: var(--ink-soft);
  font-size: var(--text-micro);
  font-weight: 700;
}

.location {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.location > span {
  margin-left: var(--space-1);
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
