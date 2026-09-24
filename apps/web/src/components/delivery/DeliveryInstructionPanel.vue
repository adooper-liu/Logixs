<script setup lang="ts">
import type { WarehouseDeliveryInstruction } from "@logix/contracts";
import { MapPinned, Save } from "@lucide/vue";
import { computed, reactive, shallowRef, watch } from "vue";
import type { DeliveryInstructionDraft } from "../../composables/useWarehouseDeliveryCommands";

const props = defineProps<{
  instruction: WarehouseDeliveryInstruction | null;
  saving: boolean;
}>();
const emit = defineEmits<{ save: [draft: DeliveryInstructionDraft] }>();
const form = reactive({
  warehouseLocationId: "",
  warehouseCode: "",
  warehouseName: "",
  unlocode: "",
  timezone: "",
  appointmentStartLocal: "",
  appointmentEndLocal: "",
  appointmentReference: "",
});
const evidence = shallowRef("");
const valid = computed(
  () =>
    uuid(form.warehouseLocationId.trim()) &&
    Boolean(form.warehouseName.trim()) &&
    Boolean(form.timezone.trim()) &&
    (!form.unlocode.trim() ||
      /^[A-Za-z]{2}[A-Za-z0-9]{3}$/.test(form.unlocode.trim())) &&
    Boolean(evidence.value.trim()) &&
    Boolean(form.appointmentStartLocal) === Boolean(form.appointmentEndLocal),
);

watch(
  () => props.instruction,
  (value) => {
    form.warehouseLocationId = value?.warehouseLocationId ?? "";
    form.warehouseCode = value?.warehouseCode ?? "";
    form.warehouseName = value?.warehouseName ?? "";
    form.unlocode = value?.unlocode ?? "";
    form.timezone = value?.timezone ?? "";
    form.appointmentStartLocal = local(value?.appointmentStartAt);
    form.appointmentEndLocal = local(value?.appointmentEndAt);
    form.appointmentReference = value?.appointmentReference ?? "";
    evidence.value = "";
  },
  { immediate: true },
);

function save() {
  if (!valid.value) return;
  emit("save", { ...form, evidenceInputs: split(evidence.value) });
}
function split(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
function local(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
</script>

<template>
  <section class="instruction" aria-label="目的仓指令">
    <header>
      <span><MapPinned :size="16" />目的仓与预约</span
      ><b>{{ instruction ? `第 ${instruction.version} 版` : "待建立" }}</b>
    </header>
    <div class="fields">
      <label
        ><span>仓库地点 ID</span
        ><input v-model="form.warehouseLocationId" placeholder="UUID"
      /></label>
      <label
        ><span>仓库代码</span
        ><input v-model="form.warehouseCode" placeholder="VLS"
      /></label>
      <label class="wide"
        ><span>仓库名称</span><input v-model="form.warehouseName"
      /></label>
      <label
        ><span>UN/LOCODE（可选）</span
        ><input v-model="form.unlocode" maxlength="5" placeholder="ESBCN"
      /></label>
      <label
        ><span>IANA 时区</span
        ><input v-model="form.timezone" placeholder="Europe/Madrid"
      /></label>
      <label
        ><span>预约开始（当地）</span
        ><input v-model="form.appointmentStartLocal" type="datetime-local"
      /></label>
      <label
        ><span>预约结束（当地）</span
        ><input v-model="form.appointmentEndLocal" type="datetime-local"
      /></label>
      <label class="wide"
        ><span>预约参考（可选）</span
        ><input v-model="form.appointmentReference"
      /></label>
      <label class="wide"
        ><span>调度指令证据</span
        ><textarea
          v-model="evidence"
          rows="2"
          placeholder="证据 ID 或调度确认引用，每行一条"
        />
      </label>
    </div>
    <button
      class="primary"
      type="button"
      :disabled="saving || !valid"
      @click="save"
    >
      <Save :size="15" />{{
        saving ? "保存中…" : instruction ? "保存更正版本" : "锁定目的仓"
      }}
    </button>
  </section>
</template>

<style scoped>
.instruction {
  display: grid;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--line-strong);
}
header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--surface-2);
  font-size: var(--text-label);
}
header span,
button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 var(--space-3);
}
.wide {
  grid-column: 1 / -1;
}
label {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-micro);
}
input,
textarea,
button {
  min-width: 0;
  min-height: 36px;
  padding: var(--space-2) var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}
textarea {
  resize: vertical;
}
button {
  margin: 0 var(--space-3);
  justify-content: center;
  cursor: pointer;
  font-weight: 700;
}
.primary {
  background: var(--brand);
  border-color: var(--brand);
  color: var(--on-brand);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
@media (max-width: 560px) {
  .fields {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
