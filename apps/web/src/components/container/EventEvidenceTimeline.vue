<script setup lang="ts">
import { Check, Clock3, FileCheck2 } from "@lucide/vue";
import { computed } from "vue";
import type { EventRow } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{ events: EventRow[] }>();

const items = computed(() =>
  props.events.map((event, index) => ({
    event,
    index: String(index + 1).padStart(2, "0"),
    hasActual: Boolean(event.actual),
  })),
);
</script>

<template>
  <section class="timeline-panel" aria-label="事件时间证据">
    <header class="timeline-head">
      <div>
        <Clock3 :size="16" aria-hidden="true" />
        <b>事实时间轴</b>
        <span>{{ events.length }} 个事件</span>
      </div>
      <InfoTooltip
        label="查看时间证据口径"
        text="计划、预计和实际时间分开记录，实际时间必须能追溯到来源证据。"
      />
    </header>

    <ol class="event-list">
      <li
        v-for="item in items"
        :key="item.event.eventRef ?? item.event.eventCode"
        class="event-item"
        :class="{ occurred: item.hasActual }"
        data-testid="event-evidence"
      >
        <div class="event-marker">
          <span><Check v-if="item.hasActual" :size="12" /></span>
          <small>{{ item.index }}</small>
        </div>

        <div class="event-identity">
          <b>{{ item.event.label }}</b>
          <span :class="item.hasActual ? 'ok' : 'warn'">
            {{ item.hasActual ? "已发生" : "待发生" }}
          </span>
        </div>

        <dl class="event-times">
          <div>
            <dt>计划</dt>
            <dd>{{ item.event.planned || "—" }}</dd>
          </div>
          <div>
            <dt>预计</dt>
            <dd>{{ item.event.estimated || "—" }}</dd>
          </div>
          <div class="actual">
            <dt>实际</dt>
            <dd>{{ item.event.actual || "待发生" }}</dd>
          </div>
        </dl>

        <div class="event-evidence">
          <FileCheck2 :size="15" aria-hidden="true" />
          <span>
            <small>证据</small>
            <b>{{ item.event.evidence || "待补" }}</b>
          </span>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.timeline-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.timeline-head,
.timeline-head > div {
  display: flex;
  align-items: center;
}

.timeline-head {
  min-height: 42px;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.timeline-head > div {
  gap: 7px;
}

.timeline-head svg {
  color: var(--brand);
}

.timeline-head span {
  color: var(--muted);
  font-size: 10px;
}

.event-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.event-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 44px minmax(110px, 0.55fr) minmax(360px, 1.7fr) minmax(
      140px,
      0.6fr
    );
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 8px;
  border-bottom: 1px solid var(--line);
}

.event-item:last-child {
  border-bottom: 0;
}

.event-marker {
  position: relative;
  align-self: stretch;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 3px;
}

.event-marker::after {
  content: "";
  position: absolute;
  z-index: 0;
  top: 24px;
  bottom: -22px;
  width: 1px;
  background: var(--line-strong);
}

.event-item:last-child .event-marker::after {
  display: none;
}

.event-marker > span {
  position: relative;
  z-index: 1;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
}

.occurred .event-marker > span {
  border-color: var(--ok);
  background: var(--ok);
  color: var(--on-ok);
}

.event-marker small {
  color: var(--muted);
  font-size: 9px;
}

.event-identity,
.event-evidence,
.event-evidence > span {
  min-width: 0;
  display: flex;
}

.event-identity,
.event-evidence > span {
  flex-direction: column;
}

.event-identity > span {
  margin-top: 2px;
  font-size: 10px;
  font-weight: 700;
}

.event-identity .ok {
  color: var(--ok);
}

.event-identity .warn {
  color: var(--warn);
}

.event-times {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-s);
  overflow: hidden;
}

.event-times > div {
  min-width: 0;
  padding: 6px 8px;
  border-right: 1px solid var(--line);
}

.event-times > div:last-child {
  border-right: 0;
}

.event-times dt,
.event-evidence small {
  color: var(--muted);
  font-size: 9px;
}

.event-times dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  color: var(--ink-soft);
  font-size: 11px;
}

.occurred .event-times .actual dd {
  color: var(--ok);
  font-weight: 700;
}

.event-evidence {
  align-items: center;
  gap: 7px;
  color: var(--brand);
}

.event-evidence b {
  overflow-wrap: anywhere;
  color: var(--ink-soft);
  font-size: 11px;
}

@media (max-width: 1180px) {
  .event-item {
    grid-template-columns: 36px minmax(105px, 0.45fr) minmax(0, 1.55fr);
    gap: 6px 10px;
  }

  .event-marker {
    grid-row: 1 / 3;
  }

  .event-evidence {
    grid-column: 3;
  }
}

@media (max-width: 720px) {
  .event-item {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 6px 8px;
    padding: 10px 10px 10px 6px;
  }

  .event-marker {
    grid-row: 1 / 4;
  }

  .event-times,
  .event-evidence {
    grid-column: 2;
  }

  .event-times > div {
    padding: 6px;
  }
}
</style>
