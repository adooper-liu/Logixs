<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

interface TimeTrackView {
  key: "planned" | "estimated" | "actual";
  label: string;
  sourceValue: string | null;
  displayValue: string;
  isBlank: boolean;
}

const props = withDefaults(
  defineProps<{
    node: LiveNodeView | null;
    timeZone?: string;
  }>(),
  {
    timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
);

const timeTracks = computed<readonly TimeTrackView[]>(() => {
  if (!props.node) return [];

  const tracks = [
    {
      key: "planned" as const,
      label: "计划",
      value: props.node.times.plannedAt,
    },
    {
      key: "estimated" as const,
      label: "预计",
      value: props.node.times.estimatedAt,
    },
    {
      key: "actual" as const,
      label: "实际",
      value: props.node.times.actualAt,
    },
  ];

  return tracks.map(({ key, label, value }) => ({
    key,
    label,
    sourceValue: value,
    displayValue: props.node?.isNotApplicable
      ? "不适用"
      : formatDate(value, props.timeZone),
    isBlank: value === null && !props.node?.isNotApplicable,
  }));
});

function formatDate(value: string | null, timeZone: string): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}
</script>

<template>
  <section class="track-card" aria-label="节点三轨时间">
    <p v-if="!node" class="empty">
      选择上方任一站点，查看它的计划 / 预计 / 实际时间。
    </p>

    <template v-else>
      <header class="track-header">
        <div class="track-heading">
          <span class="node-sequence">
            {{ node.sequence.toString().padStart(2, "0") }}
          </span>
          <strong class="node-name">{{ node.name }}</strong>
        </div>
        <span class="node-state">{{ node.stateLabel }}</span>
      </header>

      <dl class="tracks">
        <div
          v-for="track in timeTracks"
          :key="track.key"
          class="track-row"
          data-testid="time-track"
        >
          <dt class="track-label">{{ track.label }}</dt>
          <dd class="track-value" :class="{ blank: track.isBlank }">
            <time
              v-if="
                track.sourceValue &&
                !node.isNotApplicable &&
                track.displayValue !== '—'
              "
              :datetime="track.sourceValue"
            >
              {{ track.displayValue }}
            </time>
            <span v-else>{{ track.displayValue }}</span>
          </dd>
        </div>
      </dl>

      <p v-if="node.blockedCount > 0" class="blocked" role="alert">
        <TriangleAlert :size="16" aria-hidden="true" />
        有 {{ node.blockedCount }} 项未关闭的阻断
      </p>
    </template>
  </section>
</template>

<style scoped>
.track-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.track-header {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.track-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.node-sequence,
.node-state,
.track-label {
  color: var(--muted);
}

.node-sequence,
.track-value {
  font-variant-numeric: tabular-nums;
}

.node-sequence {
  font-size: 12px;
}

.node-name {
  overflow-wrap: anywhere;
  font-size: 16px;
  line-height: 24px;
}

.node-state {
  flex: 0 0 auto;
  font-size: 13px;
}

.tracks {
  margin: 0;
}

.track-row {
  display: grid;
  min-height: 40px;
  grid-template-columns: minmax(56px, 80px) minmax(0, 1fr);
  align-items: center;
  border-top: 1px solid var(--line);
}

.track-label,
.track-value {
  margin: 0;
}

.track-label {
  font-size: 13px;
}

.track-value {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.blank,
.empty {
  color: var(--muted);
}

.empty {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  text-align: center;
}

.blocked {
  display: flex;
  min-height: 24px;
  align-items: center;
  gap: 6px;
  margin: 12px 0 0;
  color: var(--risk);
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 680px) {
  .track-card {
    padding: 12px;
  }

  .track-header {
    align-items: flex-start;
  }
}
</style>
