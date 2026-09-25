<script setup lang="ts">
import { FilePlus2, Save } from "@lucide/vue";
import { computed, reactive, watch, type DeepReadonly } from "vue";
import type {
  ShipmentDetailV1,
  ShipmentPendingDocumentCompletionResultV1,
} from "@logix/contracts";
import type { ShipmentPendingDocumentDraft } from "../../composables/usePostDepartureHandoffWorkbench";

const props = defineProps<{
  detail: DeepReadonly<ShipmentDetailV1>;
  saving: boolean;
  error: string;
  notice: string;
  result: DeepReadonly<ShipmentPendingDocumentCompletionResultV1> | null;
}>();

const emit = defineEmits<{
  save: [documents: ShipmentPendingDocumentDraft[]];
}>();

const draft = reactive<ShipmentPendingDocumentDraft>({
  documentType: "mbl",
  documentNumber: "",
  scac: "",
  containerRecordIds: [],
});

const canSave = computed(
  () =>
    Boolean(draft.documentNumber.trim()) && draft.containerRecordIds.length > 0,
);

watch(
  () => props.detail.shipment.id,
  () => {
    draft.containerRecordIds = props.detail.containers.map(
      ({ containerRecordId }) => containerRecordId,
    );
  },
  { immediate: true },
);

watch(
  () => props.result?.traceId,
  (traceId) => {
    if (!traceId) return;
    draft.documentNumber = "";
    draft.scac = "";
  },
);

function save(): void {
  if (!canSave.value) {
    emit("save", []);
    return;
  }
  emit("save", [
    {
      documentType: draft.documentType,
      documentNumber: draft.documentNumber,
      scac: draft.scac,
      containerRecordIds: [...draft.containerRecordIds],
    },
  ]);
}
</script>

<template>
  <section class="document-editor" aria-label="补充运输单证">
    <header>
      <FilePlus2 :size="17" aria-hidden="true" />
      <span><small>运输单证</small><b>补充提单资料</b></span>
    </header>

    <div
      v-if="detail.transportDocuments.length"
      class="document-editor__existing"
    >
      <span v-for="document in detail.transportDocuments" :key="document.id">
        {{ document.documentType.toUpperCase() }}
        {{ document.documentNumber }}
      </span>
    </div>

    <div class="document-editor__identity">
      <label>
        <span>单证类型</span>
        <select v-model="draft.documentType" name="documentType">
          <option value="booking">订舱号</option>
          <option value="mbl">主提单 MBL</option>
          <option value="hbl">分提单 HBL</option>
        </select>
      </label>
      <label>
        <span>单证号码</span>
        <input
          v-model="draft.documentNumber"
          name="documentNumber"
          maxlength="200"
          autocomplete="off"
        />
      </label>
      <label>
        <span>SCAC（可选）</span>
        <input
          v-model="draft.scac"
          name="documentScac"
          maxlength="4"
          autocomplete="off"
        />
      </label>
    </div>

    <fieldset>
      <legend>关联货柜</legend>
      <label
        v-for="container in detail.containers"
        :key="container.containerRecordId"
      >
        <input
          v-model="draft.containerRecordIds"
          type="checkbox"
          :value="container.containerRecordId"
        />
        <span>{{ container.containerNumber }}</span>
      </label>
    </fieldset>

    <button type="button" :disabled="saving" @click="save">
      <Save :size="16" aria-hidden="true" />
      {{ saving ? "保存中..." : "保存提单" }}
    </button>
    <p v-if="error" class="document-editor__error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="notice" class="document-editor__notice" role="status">
      {{ notice }}
    </p>
  </section>
</template>

<style scoped>
.document-editor {
  display: grid;
  gap: var(--space-3);
}

.document-editor header,
.document-editor header span {
  display: grid;
  align-items: center;
}

.document-editor header {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
}

.document-editor header span {
  gap: var(--space-1);
}

.document-editor small,
.document-editor label > span,
.document-editor legend {
  color: var(--muted);
  font-size: var(--text-label);
}

.document-editor__existing {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.document-editor__existing span {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  font-size: var(--text-label);
}

.document-editor__identity {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(180px, 1.3fr) minmax(
      110px,
      0.6fr
    );
  gap: var(--space-2);
}

.document-editor label {
  display: grid;
  gap: var(--space-1);
}

.document-editor input,
.document-editor select {
  min-width: 0;
  min-height: 38px;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}

.document-editor fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
}

.document-editor fieldset label {
  grid-template-columns: auto auto;
  align-items: center;
}

.document-editor fieldset input {
  min-height: auto;
}

.document-editor > button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--brand-strong);
  border-radius: var(--radius-control);
  background: var(--brand-strong);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.document-editor > button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.document-editor__error {
  color: var(--risk);
}

.document-editor__notice {
  color: var(--success);
}

@media (max-width: 680px) {
  .document-editor__identity {
    grid-template-columns: 1fr;
  }
}
</style>
