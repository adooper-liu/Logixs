<script setup lang="ts">
import { CircleCheck, ListChecks, ShieldAlert, Sparkles } from "@lucide/vue";
import type { WorkbenchOperationalSpec } from "../../data/workbenchNetwork";

defineProps<{ spec: WorkbenchOperationalSpec }>();
</script>

<template>
  <div class="operational-spec">
    <section aria-labelledby="spec-actions">
      <header>
        <ListChecks :size="16" aria-hidden="true" />
        <div>
          <small>他可以做什么</small>
          <h4 id="spec-actions">主要动作</h4>
        </div>
      </header>
      <ul>
        <li v-for="action in spec.allowedActions" :key="action">
          {{ action }}
        </li>
      </ul>
    </section>

    <section aria-labelledby="spec-system">
      <header>
        <Sparkles :size="16" aria-hidden="true" />
        <div>
          <small>不占他的时间</small>
          <h4 id="spec-system">系统代劳</h4>
        </div>
      </header>
      <ul>
        <li v-for="item in spec.systemDoes" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section aria-labelledby="spec-missing">
      <header>
        <CircleCheck :size="16" aria-hidden="true" />
        <div>
          <small>缺资料时</small>
          <h4 id="spec-missing">如何继续</h4>
        </div>
      </header>
      <p>{{ spec.missingHandling }}</p>
    </section>

    <section aria-labelledby="spec-discipline">
      <header>
        <ShieldAlert :size="16" aria-hidden="true" />
        <div>
          <small>红线</small>
          <h4 id="spec-discipline">操作纪律</h4>
        </div>
      </header>
      <ul>
        <li v-for="rule in spec.discipline" :key="rule">{{ rule }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.operational-spec {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-3);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.operational-spec section {
  min-width: 0;
  padding: var(--space-3);
  border-left: 3px solid var(--line-strong);
  background: var(--surface);
}

.operational-spec section:last-child {
  border-left-color: var(--warn);
}

.operational-spec header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.operational-spec header svg {
  flex: none;
  margin-top: var(--space-1);
  color: var(--brand-strong);
}

.operational-spec section:last-child header svg {
  color: var(--warn);
}

.operational-spec header div {
  min-width: 0;
}

.operational-spec small {
  display: block;
  color: var(--muted);
  font-size: var(--text-micro);
}

.operational-spec h4 {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-label);
  line-height: var(--leading-title);
}

.operational-spec ul {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-left: var(--space-4);
}

.operational-spec li,
.operational-spec p {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--text-label);
  line-height: var(--leading-body);
}

@media (max-width: 900px) {
  .operational-spec {
    grid-template-columns: 1fr;
  }
}
</style>
