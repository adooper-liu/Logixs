<script setup lang="ts">
import { computed, markRaw, toRaw, type Component } from "vue";
import type { Tone } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

type SignalTone = Exclude<Tone, "muted"> | "brand";

interface ManagementSignal {
  label: string;
  value: string;
  supportingText?: string;
  helpText?: string;
  tone: SignalTone;
  icon: Component;
  to: string;
}

const props = defineProps<{ items: readonly ManagementSignal[] }>();

const displayItems = computed(() =>
  props.items.map((item) => ({
    ...item,
    icon: markRaw(toRaw(item.icon)),
  })),
);
</script>

<template>
  <nav class="signal-strip" aria-label="关键运营信号">
    <div
      v-for="item in displayItems"
      :key="item.label"
      class="signal"
      :class="item.tone"
    >
      <router-link :to="item.to" class="signal-link">
        <span class="signal-summary">
          <span class="signal-label">
            <component :is="item.icon" :size="16" aria-hidden="true" />
            <small>{{ item.label }}</small>
          </span>
          <b class="mono">{{ item.value }}</b>
          <span v-if="item.supportingText" class="signal-note">{{
            item.supportingText
          }}</span>
        </span>
      </router-link>
      <InfoTooltip
        v-if="item.helpText"
        class="signal-help"
        :label="`查看${item.label}口径`"
        :text="item.helpText"
        inverse
      />
    </div>
  </nav>
</template>

<style scoped>
.signal-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.signal {
  --signal-accent: var(--info);
  --signal-foreground: var(--on-status);

  min-width: 0;
  min-height: 84px;
  position: relative;
  border-radius: var(--radius-m);
  background: var(--signal-accent);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--ink) 10%, transparent);
  color: var(--signal-foreground);
  overflow: hidden;
  transition:
    box-shadow var(--motion-fast),
    transform var(--motion-fast);
}

.signal-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.signal-help {
  position: absolute;
  top: 7px;
  right: 7px;
}

.signal:hover {
  box-shadow: 0 5px 14px color-mix(in srgb, var(--ink) 16%, transparent);
  transform: translateY(-1px);
}

.signal:focus-visible {
  outline-offset: 2px;
}

.signal-summary {
  min-width: 0;
  min-height: 84px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px 14px;
}

.signal-label {
  min-width: 0;
  display: flex;
  gap: 6px;
  align-items: center;
}

.signal-label small,
.signal-note {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signal-label small {
  color: currentColor;
  font-weight: 650;
}

.signal-summary > b {
  color: currentColor;
  font-size: 27px;
  line-height: 1.08;
  overflow-wrap: anywhere;
}

.signal-note {
  opacity: 0.82;
}

.signal.brand {
  --signal-accent: var(--brand);
  --signal-foreground: var(--on-brand);
}

.signal.ok {
  --signal-accent: var(--ok);
  --signal-foreground: var(--on-ok);
}

.signal.warn {
  --signal-accent: var(--warn);
  --signal-foreground: var(--on-warn);
}

.signal.risk {
  --signal-accent: var(--risk);
  --signal-foreground: var(--on-risk);
}

.signal.info {
  --signal-accent: var(--info);
}

@media (max-width: 1180px) {
  .signal-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .signal-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .signal {
    min-height: 76px;
  }

  .signal-summary {
    min-height: 76px;
    padding: 9px 10px;
  }

  .signal-summary > b {
    font-size: 22px;
  }

  .signal-note {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .signal {
    transition: none;
  }
}
</style>
