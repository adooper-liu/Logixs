<script setup lang="ts">
import { computed, markRaw, toRaw, type Component } from "vue";
import {
  BadgeDollarSign,
  CircleAlert,
  Clock3,
  Container,
  TriangleAlert,
} from "@lucide/vue";
import type { KpiSignal, KpiSignalKey } from "../../data/kpiProjection";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{ items: readonly KpiSignal[] }>();

const icons: Record<KpiSignalKey, Component> = {
  online: Container,
  risk: TriangleAlert,
  feeExposure: BadgeDollarSign,
  pendingSync: Clock3,
  openExceptions: CircleAlert,
};

const displayItems = computed(() =>
  props.items.map((item) => ({
    ...item,
    icon: markRaw(toRaw(icons[item.key])),
  })),
);
</script>

<template>
  <nav class="kpi-strip" aria-label="管理看板 KPI">
    <div
      v-for="item in displayItems"
      :key="item.key"
      class="kpi-signal"
      :class="item.tone"
    >
      <router-link :to="item.to" class="kpi-link">
        <span class="kpi-label">
          <component :is="item.icon" :size="16" aria-hidden="true" />
          <small>{{ item.label }}</small>
        </span>
        <b class="mono">{{ item.value }}</b>
        <span class="kpi-supporting">{{ item.supportingText }}</span>
      </router-link>
      <InfoTooltip
        class="kpi-help"
        :label="`查看${item.label}口径`"
        :text="item.helpText"
        inverse
      />
    </div>
  </nav>
</template>

<style scoped>
.kpi-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.kpi-signal {
  --signal-accent: var(--info);
  --signal-foreground: var(--on-status);

  min-width: 0;
  min-height: 84px;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-m);
  background: var(--signal-accent);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--ink) 10%, transparent);
  color: var(--signal-foreground);
  transition:
    box-shadow var(--motion-fast),
    transform var(--motion-fast);
}

.kpi-signal:hover {
  box-shadow: 0 5px 14px color-mix(in srgb, var(--ink) 16%, transparent);
  transform: translateY(-1px);
}

.kpi-link {
  min-height: 84px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px 14px;
  color: inherit;
  text-decoration: none;
}

.kpi-label {
  min-width: 0;
  display: flex;
  gap: 6px;
  align-items: center;
  padding-right: 20px;
}

.kpi-label small,
.kpi-supporting {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-label small {
  color: currentColor;
  font-weight: 650;
}

.kpi-link > b {
  color: currentColor;
  font-size: 27px;
  line-height: 1.08;
  overflow-wrap: anywhere;
}

.kpi-supporting {
  opacity: 0.82;
}

.kpi-help {
  position: absolute;
  top: 7px;
  right: 7px;
}

.kpi-signal.brand {
  --signal-accent: var(--brand);
  --signal-foreground: var(--on-brand);
}

.kpi-signal.ok {
  --signal-accent: var(--ok);
  --signal-foreground: var(--on-ok);
}

.kpi-signal.warn {
  --signal-accent: var(--warn);
  --signal-foreground: var(--on-warn);
}

.kpi-signal.risk {
  --signal-accent: var(--risk);
  --signal-foreground: var(--on-risk);
}

.kpi-signal.info {
  --signal-accent: var(--info);
}

@media (max-width: 1180px) {
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kpi-signal:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .kpi-strip {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .kpi-signal:last-child {
    grid-column: auto;
  }

  .kpi-signal,
  .kpi-link {
    min-height: 72px;
  }

  .kpi-link {
    padding: 9px 10px;
  }

  .kpi-link > b {
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kpi-signal {
    transition: none;
  }
}
</style>
