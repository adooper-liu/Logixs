<script setup lang="ts">
import { Save } from "@lucide/vue";
import { reactive, watch } from "vue";
import type { ContainerStuffingSnapshot } from "../../api/containerStuffing";
import type { ContainerCargoScope } from "../../api/containers";
import type { StuffingSnapshotDraft } from "../../composables/useStuffingCommands";

const props = defineProps<{
  containerNumber: string | null;
  cargo: ContainerCargoScope | null;
  snapshot: ContainerStuffingSnapshot | null;
  saving: boolean;
  error: string;
  message: string;
}>();

const emit = defineEmits<{ save: [draft: StuffingSnapshotDraft] }>();

const form = reactive({
  containerNumber: "",
  sealNumber: "",
  packageCount: "",
  grossWeight: "",
  netWeight: "",
  volume: "",
  hasVgm: false,
  vgmWeight: "",
  vgmMethod: "method_1" as "method_1" | "method_2",
  vgmVerifiedAt: "",
  evidenceInput: "",
  reasonCode: "stuffing_confirmed",
});

watch(
  () => [props.snapshot, props.containerNumber] as const,
  ([snapshot, containerNumber]) => {
    form.containerNumber = snapshot?.containerNumber ?? containerNumber ?? "";
    form.sealNumber = snapshot?.sealNumber ?? "";
    form.packageCount = snapshot ? String(snapshot.packageCount) : "";
    form.grossWeight = snapshot?.grossWeight ?? "";
    form.netWeight = snapshot?.netWeight ?? "";
    form.volume = snapshot?.volume ?? "";
    form.hasVgm = Boolean(snapshot?.vgm);
    form.vgmWeight = snapshot?.vgm?.weight ?? "";
    form.vgmMethod = snapshot?.vgm?.method ?? "method_1";
    form.vgmVerifiedAt = snapshot?.vgm
      ? toLocalDateTime(snapshot.vgm.verifiedAt)
      : "";
    form.evidenceInput = snapshot?.evidenceRefs.join("\n") ?? "";
    form.reasonCode = snapshot ? "stuffing_corrected" : "stuffing_confirmed";
  },
  { immediate: true },
);

function submit(): void {
  if (
    !props.cargo?.allocationSetId ||
    props.cargo.allocationSetVersion === null
  )
    return;
  emit("save", {
    expectedVersion: props.snapshot?.version ?? 0,
    allocationSetId: props.cargo.allocationSetId,
    allocationSetVersion: props.cargo.allocationSetVersion,
    containerNumber: form.containerNumber,
    sealNumber: form.sealNumber,
    packageCount: Number(form.packageCount),
    grossWeight: form.grossWeight,
    netWeight: form.netWeight || null,
    volume: form.volume,
    vgm: form.hasVgm
      ? {
          weight: form.vgmWeight,
          method: form.vgmMethod,
          verifiedAt: new Date(form.vgmVerifiedAt).toISOString(),
        }
      : null,
    evidenceInputs: form.evidenceInput.split(/[\n,]+/),
    reasonCode: form.reasonCode,
  });
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
</script>

<template>
  <form
    class="snapshot-form"
    aria-label="装箱结果表单"
    @submit.prevent="submit"
  >
    <header>
      <span>装箱结果</span
      ><b>{{ snapshot ? `更正第 ${snapshot.version} 版` : "首次记录" }}</b>
    </header>
    <p v-if="!cargo?.allocationSetId" class="form-notice">
      先形成当前装载明细，才能保存装箱结果。
    </p>
    <fieldset :disabled="saving || !cargo?.allocationSetId">
      <div class="field-grid">
        <label
          ><span>集装箱号</span
          ><input
            v-model.trim="form.containerNumber"
            required
            maxlength="11"
            placeholder="KOCU4960726"
        /></label>
        <label
          ><span>封号</span
          ><input v-model.trim="form.sealNumber" required maxlength="64"
        /></label>
        <label
          ><span>包装数</span
          ><input
            v-model="form.packageCount"
            required
            type="number"
            min="1"
            max="10000000"
        /></label>
        <label
          ><span>毛重 (kg)</span
          ><input v-model.trim="form.grossWeight" required inputmode="decimal"
        /></label>
        <label
          ><span>净重 (kg)</span
          ><input v-model.trim="form.netWeight" inputmode="decimal"
        /></label>
        <label
          ><span>体积 (m³)</span
          ><input v-model.trim="form.volume" required inputmode="decimal"
        /></label>
      </div>
      <label class="toggle"
        ><input v-model="form.hasVgm" type="checkbox" />同时记录 VGM</label
      >
      <div v-if="form.hasVgm" class="field-grid vgm-fields">
        <label
          ><span>VGM 重量 (kg)</span
          ><input v-model.trim="form.vgmWeight" required inputmode="decimal"
        /></label>
        <label
          ><span>核定方法</span
          ><select v-model="form.vgmMethod">
            <option value="method_1">整体称重</option>
            <option value="method_2">分项累加</option>
          </select></label
        >
        <label
          ><span>核验时间</span
          ><input v-model="form.vgmVerifiedAt" required type="datetime-local"
        /></label>
      </div>
      <label class="wide-field"
        ><span>装箱证据</span
        ><textarea
          v-model="form.evidenceInput"
          required
          rows="3"
          placeholder="填写证据编号，或装箱单/称重单/箱封照片的文件引用；每行一项"
        />
      </label>
      <label class="wide-field"
        ><span>保存原因</span
        ><select v-model="form.reasonCode">
          <option value="stuffing_confirmed">首次确认装箱</option>
          <option value="stuffing_corrected">更正装箱记录</option>
        </select></label
      >
      <button type="submit" class="primary-action">
        <Save :size="15" />{{
          saving ? "正在保存…" : snapshot ? "保存更正版" : "保存装箱记录"
        }}
      </button>
    </fieldset>
    <p v-if="error" class="result result--error" role="alert">{{ error }}</p>
    <p v-else-if="message" class="result result--ok">{{ message }}</p>
  </form>
</template>

<style scoped>
.snapshot-form {
  border-bottom: 1px solid var(--line-strong);
}
.snapshot-form > header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface-2);
  font-size: 12px;
}
.snapshot-form > header b {
  color: var(--brand-strong);
  font-size: 10px;
}
fieldset {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 12px;
  border: 0;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.field-grid label,
.wide-field {
  min-width: 0;
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 10px;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  box-sizing: border-box;
  padding: 7px 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}
textarea {
  resize: vertical;
}
.toggle {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-soft);
  font-size: 11px;
}
.toggle input {
  width: 16px;
  min-height: 16px;
}
.vgm-fields {
  padding: 9px;
  border-left: 3px solid var(--info);
  background: var(--info-bg);
}
.primary-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 700;
  cursor: pointer;
}
.primary-action:disabled,
fieldset:disabled {
  cursor: wait;
  opacity: 0.65;
}
.form-notice,
.result {
  margin: 0;
  padding: 9px 12px;
  font-size: 11px;
}
.form-notice {
  background: var(--warn-bg);
  color: var(--warn);
}
.result--error {
  background: var(--risk-bg);
  color: var(--risk);
}
.result--ok {
  background: var(--ok-bg);
  color: var(--ok);
}
@media (max-width: 560px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
