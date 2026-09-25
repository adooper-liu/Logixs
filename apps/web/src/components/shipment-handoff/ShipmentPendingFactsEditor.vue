<script setup lang="ts">
import { CheckCircle2, Save } from "@lucide/vue";
import { reactive, watch, type DeepReadonly } from "vue";
import type {
  ShipmentPendingCompletionItemV1,
  ShipmentPendingFactCompletionResultV1,
} from "@logix/contracts";
import { POST_DEPARTURE_TIMEZONES } from "../../data/postDepartureTime";
import type { ShipmentPendingFactDraft } from "../../composables/usePostDepartureHandoffWorkbench";

const props = defineProps<{
  selected: DeepReadonly<ShipmentPendingCompletionItemV1>;
  saving: boolean;
  error: string;
  notice: string;
  result: DeepReadonly<ShipmentPendingFactCompletionResultV1> | null;
}>();

const emit = defineEmits<{
  save: [draft: ShipmentPendingFactDraft];
}>();

const draft = reactive<ShipmentPendingFactDraft>(emptyDraft());

watch(
  () => props.selected.shipment,
  (shipment) => {
    Object.assign(draft, {
      carrierCode: shipment.carrierCode ?? "",
      vesselName: shipment.vesselName ?? "",
      voyageNumber: shipment.voyageNumber ?? "",
      originPortCode: shipment.originUnlocode ?? "",
      destinationPortCode: shipment.destinationUnlocode ?? "",
      departureLocal: "",
      sourceTimezone: "",
      evidenceRef: "",
    });
  },
  { immediate: true },
);

function emptyDraft(): ShipmentPendingFactDraft {
  return {
    carrierCode: "",
    vesselName: "",
    voyageNumber: "",
    originPortCode: "",
    destinationPortCode: "",
    departureLocal: "",
    sourceTimezone: "",
    evidenceRef: "",
  };
}
</script>

<template>
  <form
    class="pending-facts-editor"
    @submit.prevent="emit('save', { ...draft })"
  >
    <div class="pending-facts-editor__grid">
      <label>
        <span>船公司代码</span>
        <input v-model="draft.carrierCode" name="carrierCode" maxlength="50" />
      </label>
      <label>
        <span>船名</span>
        <input v-model="draft.vesselName" name="vesselName" maxlength="200" />
      </label>
      <label>
        <span>航次</span>
        <input
          v-model="draft.voyageNumber"
          name="voyageNumber"
          maxlength="100"
        />
      </label>
      <label>
        <span>起运港 UN/LOCODE</span>
        <input
          v-model="draft.originPortCode"
          name="originPortCode"
          maxlength="5"
          placeholder="例如 CNNGB"
        />
      </label>
      <label>
        <span>目的港 UN/LOCODE</span>
        <input
          v-model="draft.destinationPortCode"
          name="destinationPortCode"
          maxlength="5"
          placeholder="例如 USLAX"
        />
      </label>
    </div>

    <fieldset>
      <legend>实际离港依据</legend>
      <div class="pending-facts-editor__grid">
        <label>
          <span>来源当地时间</span>
          <input
            v-model="draft.departureLocal"
            name="departureLocal"
            type="datetime-local"
          />
        </label>
        <label>
          <span>来源时区</span>
          <select v-model="draft.sourceTimezone">
            <option value="">暂不补</option>
            <option
              v-for="[value, label] in POST_DEPARTURE_TIMEZONES"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
        </label>
        <label class="pending-facts-editor__evidence">
          <span>依据附件或链接</span>
          <input
            v-model="draft.evidenceRef"
            maxlength="500"
            placeholder="文件路径、共享链接或业务凭证引用"
          />
        </label>
      </div>
    </fieldset>

    <p v-if="error" class="pending-facts-editor__error" role="alert">
      {{ error }}
    </p>
    <p v-if="notice" class="pending-facts-editor__notice" role="status">
      {{ notice }}
    </p>
    <p v-if="result" class="pending-facts-editor__success" role="status">
      <CheckCircle2 :size="15" aria-hidden="true" />
      {{
        result.status === "no_change"
          ? "当前进度已保留"
          : "已保存并重新核对待补项"
      }}
    </p>

    <button type="submit" :disabled="saving">
      <Save :size="15" aria-hidden="true" />
      {{ saving ? "保存中..." : "保存当前进度" }}
    </button>
  </form>
</template>

<style scoped>
.pending-facts-editor,
.pending-facts-editor__grid {
  display: grid;
  gap: var(--space-3);
}

.pending-facts-editor__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pending-facts-editor label {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.pending-facts-editor label > span,
.pending-facts-editor legend {
  color: var(--muted);
  font-size: var(--text-label);
}

.pending-facts-editor input,
.pending-facts-editor select {
  min-width: 0;
  min-height: 38px;
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}

.pending-facts-editor fieldset {
  min-width: 0;
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
}

.pending-facts-editor__evidence {
  grid-column: 1 / -1;
}

.pending-facts-editor p {
  margin: 0;
  font-size: var(--text-label);
}

.pending-facts-editor__error {
  color: var(--risk);
}

.pending-facts-editor__notice {
  color: var(--warn);
}

.pending-facts-editor__success {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--success);
}

.pending-facts-editor > button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--brand-strong);
  border-radius: var(--radius-control);
  background: var(--brand-strong);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.pending-facts-editor > button:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 680px) {
  .pending-facts-editor__grid {
    grid-template-columns: 1fr;
  }

  .pending-facts-editor__evidence {
    grid-column: auto;
  }
}
</style>
