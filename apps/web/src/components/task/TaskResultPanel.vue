<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { CircleCheck, Crosshair, TriangleAlert } from "@lucide/vue";
import type { TaskAction, TaskItem } from "../../data/sample";
import InfoTooltip from "../ui/InfoTooltip.vue";

const props = defineProps<{
  task: TaskItem;
  canSubmit: boolean;
  isSubmitting: boolean;
  attentionLabel: string;
}>();

const emit = defineEmits<{
  claim: [];
  execute: [actionCode: string];
  openException: [];
}>();

const pendingAction = shallowRef<TaskAction>();
const visibleActions = computed(() =>
  props.task.actions.filter(
    (action) =>
      action.intent === "exception" ||
      (props.canSubmit &&
        !["completed", "waiting_external"].includes(props.task.status)),
  ),
);

const isDisabled = (action: TaskAction) =>
  props.isSubmitting || (action.intent === "complete" && !props.canSubmit);

const requestAction = (action: TaskAction) => {
  if (isDisabled(action)) return;
  if (action.intent === "exception") {
    emit("openException");
  } else if (action.confirmation === "review") {
    pendingAction.value = action;
  } else {
    emit("execute", action.actionCode);
  }
};

const confirmAction = () => {
  if (!pendingAction.value) return;
  emit("execute", pendingAction.value.actionCode);
  pendingAction.value = undefined;
};
</script>

<template>
  <section class="result-band" aria-label="当前任务动作">
    <div class="result-copy">
      <span class="focus-kicker"><Crosshair :size="15" />当前关注</span>
      <div class="result-title">
        <h3>{{ attentionLabel }}</h3>
        <span class="result-rule">
          <span
            :class="
              task.completionPolicy.advancesContainerStatus
                ? 'advance'
                : 'neutral'
            "
          >
            {{
              task.completionPolicy.advancesContainerStatus
                ? "落账后推进货柜"
                : "不推进货柜"
            }}
          </span>
          <InfoTooltip
            label="查看结果规则"
            :text="`${task.completionPolicy.summary}${task.completionPolicy.resultEventCode ? ` 结果事件：${task.completionPolicy.resultEventCode}` : ''}`"
          />
        </span>
      </div>
    </div>

    <div class="actions">
      <button
        v-if="task.assignment.mode === 'pool' && !task.assignment.assignee"
        class="primary"
        type="button"
        :disabled="isSubmitting"
        @click="emit('claim')"
      >
        领取任务
      </button>
      <button
        v-for="action in visibleActions"
        :key="action.actionCode"
        :class="action.tone"
        type="button"
        :disabled="isDisabled(action)"
        :title="action.summary"
        @click="requestAction(action)"
      >
        <TriangleAlert
          v-if="action.intent === 'exception'"
          :size="16"
          aria-hidden="true"
        />
        <CircleCheck v-else :size="16" aria-hidden="true" />
        {{ action.label }}
      </button>
    </div>

    <el-dialog
      :model-value="Boolean(pendingAction)"
      title="确认本次业务动作"
      width="min(480px, 92vw)"
      @close="pendingAction = undefined"
    >
      <div v-if="pendingAction" class="confirm-copy">
        <b>{{ pendingAction.label }}</b>
        <p>{{ pendingAction.summary }}</p>
        <dl v-if="pendingAction.defaultPayload?.length">
          <div v-for="item in pendingAction.defaultPayload" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
        <small class="mono">
          {{ pendingAction.actionCode }} ·
          {{
            pendingAction.catalogStatus === "catalog" ? "动作目录" : "候选动作"
          }}
        </small>
      </div>
      <template #footer>
        <button
          class="secondary"
          type="button"
          @click="pendingAction = undefined"
        >
          取消
        </button>
        <button class="primary" type="button" @click="confirmAction">
          确认执行
        </button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.result-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 12px;
  border: 1px solid var(--brand);
  border-left-width: 4px;
  border-radius: var(--radius-m);
  background: var(--surface);
}

.result-copy {
  min-width: 0;
  flex: 1;
}

.result-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.focus-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--brand);
  font-size: 10px;
  font-weight: 700;
}

.result-copy h3 {
  flex: none;
  margin: 2px 0 0;
  font-size: 14px;
  white-space: nowrap;
}

.result-title span {
  color: var(--muted);
  font-size: 10px;
}

.result-title .result-rule {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.result-title .advance {
  color: var(--ok);
}

.confirm-copy p {
  margin: 3px 0 5px;
  color: var(--ink-soft);
  font-size: 12px;
}

.actions {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.actions button,
.secondary,
.primary {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: var(--radius-s);
  font-weight: 600;
  cursor: pointer;
}

.actions button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.primary {
  border: 1px solid var(--brand);
  background: var(--brand);
  color: var(--on-brand);
}

.secondary {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink-soft);
}

.danger {
  border: 1px solid var(--risk);
  background: var(--surface);
  color: var(--risk);
}

.confirm-copy dl {
  margin: 12px 0;
  border-top: 1px solid var(--line);
}

.confirm-copy dl > div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

.confirm-copy dt {
  color: var(--muted);
}

.confirm-copy dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.confirm-copy small {
  color: var(--muted);
}

@media (max-width: 720px) {
  .result-band {
    align-items: stretch;
    flex-direction: column;
  }

  .actions button {
    flex: 1;
    justify-content: center;
  }
}
</style>
