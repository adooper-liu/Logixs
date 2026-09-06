<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Circle,
  Clock3,
  TriangleAlert,
} from "@lucide/vue";
import type { TaskFocusStep, TaskFocusStepCode } from "./taskFocusContract";

defineProps<{
  steps: TaskFocusStep[];
  currentCode: TaskFocusStepCode;
}>();
</script>

<template>
  <nav class="focus-flow" aria-label="任务执行导引">
    <div class="focus-label">
      <strong>作业路径</strong>
    </div>
    <ol class="focus-steps" :style="{ '--step-count': steps.length }">
      <li
        v-for="(step, index) in steps"
        :key="step.code"
        :class="step.state"
        :aria-current="step.code === currentCode ? 'step' : undefined"
        :data-focus-step="step.code"
      >
        <span class="step-mark">
          <Check v-if="step.state === 'done'" :size="16" aria-hidden="true" />
          <TriangleAlert
            v-else-if="step.state === 'blocked'"
            :size="16"
            aria-hidden="true"
          />
          <Clock3
            v-else-if="step.state === 'waiting'"
            :size="16"
            aria-hidden="true"
          />
          <Circle v-else :size="12" aria-hidden="true" />
        </span>
        <span class="step-copy">
          <b>{{ step.label }}</b>
          <small v-if="step.progress">{{ step.progress }}</small>
        </span>
        <ChevronRight
          v-if="index < steps.length - 1"
          class="step-arrow"
          :size="15"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.focus-flow {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
}

.focus-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px 12px;
  border-right: 1px solid var(--line);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.focus-label strong {
  font-size: 12px;
}

.focus-steps {
  display: grid;
  grid-template-columns: repeat(var(--step-count), minmax(64px, 1fr));
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: 7px 10px;
  list-style: none;
}

.focus-steps li {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--muted);
}

.step-mark {
  z-index: var(--z-content-raised);
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
}

.step-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.step-copy b {
  font-size: 11px;
}

.step-copy small {
  margin-top: 2px;
  font-size: 9px;
}

.step-arrow {
  position: absolute;
  top: 50%;
  right: -8px;
  transform: translateY(-50%);
  color: var(--line-strong);
}

.focus-steps li.done {
  color: var(--ok);
}

.focus-steps li.done .step-mark {
  border-color: var(--ok);
  background: var(--ok);
  color: var(--on-status);
}

.focus-steps li.current {
  color: var(--brand-strong);
}

.focus-steps li.current .step-mark {
  border: 2px solid var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
  color: var(--brand);
}

.focus-steps li.waiting {
  color: var(--warn);
}

.focus-steps li.waiting .step-mark {
  border-color: var(--warn);
  color: var(--warn);
}

.focus-steps li.blocked {
  color: var(--risk);
}

.focus-steps li.blocked .step-mark {
  border-color: var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

@media (max-width: 720px) {
  .focus-flow {
    grid-template-columns: 1fr;
  }

  .focus-label {
    min-height: 38px;
    align-items: center;
    padding: 7px 10px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .focus-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px 0;
    padding: 9px 6px;
  }

  .focus-steps li {
    gap: 4px;
  }

  .step-mark {
    width: 25px;
    height: 25px;
  }

  .focus-steps li:nth-child(3n) .step-arrow,
  .focus-steps li:last-child .step-arrow {
    display: none;
  }
}
</style>
