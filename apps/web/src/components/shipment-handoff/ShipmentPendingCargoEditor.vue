<script setup lang="ts">
import { Check, ClipboardPaste, Plus, Save, Trash2, X } from "@lucide/vue";
import { computed, reactive, shallowRef, watch, type DeepReadonly } from "vue";
import type {
  ShipmentDetailV1,
  ShipmentPendingCargoCompletionResultV1,
} from "@logix/contracts";
import type { ShipmentPendingCargoLineDraft } from "../../composables/usePostDepartureHandoffWorkbench";

const props = defineProps<{
  detail: DeepReadonly<ShipmentDetailV1>;
  saving: boolean;
  error: string;
  notice: string;
  result: DeepReadonly<ShipmentPendingCargoCompletionResultV1> | null;
}>();

const emit = defineEmits<{
  save: [lines: ShipmentPendingCargoLineDraft[]];
}>();

type EditableLine = ShipmentPendingCargoLineDraft & {
  key: string;
  error: string;
};

const lines = reactive<EditableLine[]>([]);
const pasteOpen = shallowRef(false);
const pasteValue = shallowRef("");
const localError = shallowRef("");
const containerOptions = computed(() =>
  props.detail.containers.map((container) => ({
    id: container.containerRecordId,
    label: container.containerNumber || "未编号货柜",
  })),
);

watch(
  () => props.detail.shipment.id,
  () => reset(),
  { immediate: true },
);

function emptyLine(): EditableLine {
  return {
    key: crypto.randomUUID(),
    containerRecordId: containerOptions.value[0]?.id ?? "",
    productNumber: "",
    quantity: "",
    quantityUnit: "piece",
    error: "",
  };
}

function reset(): void {
  lines.splice(0, lines.length, emptyLine());
  pasteOpen.value = false;
  pasteValue.value = "";
  localError.value = "";
}

function addLine(): void {
  lines.push(emptyLine());
}

function removeLine(index: number): void {
  lines.splice(index, 1);
  if (lines.length === 0) lines.push(emptyLine());
}

function applyPaste(): void {
  const rows = pasteValue.value
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) =>
      row.split(row.includes("\t") ? "\t" : ",").map((cell) => cell.trim()),
    )
    .filter(
      (cells, index) => !(index === 0 && /柜|container/i.test(cells[0] ?? "")),
    );
  if (rows.length === 0 || rows.some((cells) => cells.length < 4)) {
    localError.value = "粘贴内容需包含柜号、SKU、数量和单位四列";
    return;
  }
  const containerByNumber = new Map(
    props.detail.containers.flatMap((container) =>
      container.containerNumber
        ? [
            [
              container.containerNumber.toUpperCase(),
              container.containerRecordId,
            ] as const,
          ]
        : [],
    ),
  );
  const mapped = rows.map(
    ([containerNumber, productNumber, quantity, unit]) => ({
      key: crypto.randomUUID(),
      containerRecordId:
        containerByNumber.get(containerNumber?.toUpperCase() ?? "") ?? "",
      productNumber: productNumber ?? "",
      quantity: quantity ?? "",
      quantityUnit: normalizeUnit(unit ?? ""),
      error: "",
    }),
  );
  if (mapped.some(({ containerRecordId }) => !containerRecordId)) {
    localError.value = "粘贴内容中有柜号不属于当前 Shipment";
    return;
  }
  if (mapped.some(({ quantityUnit }) => !quantityUnit)) {
    localError.value = "单位只支持件、箱、套、托";
    return;
  }
  lines.splice(0, lines.length, ...(mapped as EditableLine[]));
  pasteOpen.value = false;
  pasteValue.value = "";
  localError.value = "";
}

function normalizeUnit(
  value: string,
): ShipmentPendingCargoLineDraft["quantityUnit"] | "" {
  const units: Record<string, ShipmentPendingCargoLineDraft["quantityUnit"]> = {
    件: "piece",
    piece: "piece",
    箱: "carton",
    carton: "carton",
    套: "set",
    set: "set",
    托: "pallet",
    pallet: "pallet",
  };
  return units[value.toLowerCase()] ?? "";
}

function save(): void {
  const nonEmptyLines = lines.filter(
    ({ productNumber, quantity }) => productNumber.trim() || quantity.trim(),
  );
  if (nonEmptyLines.length === 0) {
    localError.value = "";
    emit("save", []);
    return;
  }
  let valid = true;
  for (const line of nonEmptyLines) {
    line.error = "";
    if (!line.containerRecordId) {
      line.error = "请选择当前 Shipment 的货柜";
    } else if (!line.productNumber.trim()) {
      line.error = "请填写 SKU";
    } else if (
      !/^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,4})?$/.test(line.quantity) ||
      Number(line.quantity) <= 0
    ) {
      line.error = "数量必须大于 0，最多 4 位小数";
    }
    if (line.error) valid = false;
  }
  if (!valid) {
    localError.value = "请修正明细行后再保存";
    return;
  }
  localError.value = "";
  emit(
    "save",
    nonEmptyLines.map(
      ({ containerRecordId, productNumber, quantity, quantityUnit }) => ({
        containerRecordId,
        productNumber: productNumber.trim(),
        quantity,
        quantityUnit,
      }),
    ),
  );
}
</script>

<template>
  <form class="cargo-editor" @submit.prevent="save">
    <div class="cargo-editor__toolbar">
      <button type="button" @click="pasteOpen = !pasteOpen">
        <X v-if="pasteOpen" :size="15" aria-hidden="true" />
        <ClipboardPaste v-else :size="15" aria-hidden="true" />
        {{ pasteOpen ? "关闭批量录入" : "批量粘贴" }}
      </button>
      <button type="button" @click="addLine">
        <Plus :size="15" aria-hidden="true" />
        新增一行
      </button>
    </div>

    <div v-if="pasteOpen" class="cargo-editor__paste">
      <textarea
        v-model="pasteValue"
        rows="4"
        aria-label="批量粘贴已接管 Shipment 的 SKU 装载明细"
        placeholder="柜号&#9;SKU&#9;数量&#9;单位"
      />
      <button type="button" @click="applyPaste">
        <Check :size="15" aria-hidden="true" />
        解析到明细
      </button>
    </div>

    <div
      class="cargo-editor__table"
      role="table"
      aria-label="当前 Shipment SKU 装载明细"
    >
      <div class="cargo-editor__row cargo-editor__row--head" role="row">
        <span>货柜</span><span>SKU</span><span>数量</span><span>单位</span
        ><span />
      </div>
      <div
        v-for="(line, index) in lines"
        :key="line.key"
        class="cargo-editor__line"
      >
        <div class="cargo-editor__row" role="row">
          <select
            v-model="line.containerRecordId"
            :aria-label="`第 ${index + 1} 行货柜`"
          >
            <option
              v-for="container in containerOptions"
              :key="container.id"
              :value="container.id"
            >
              {{ container.label }}
            </option>
          </select>
          <input
            v-model="line.productNumber"
            :name="index === 0 ? 'cargoProductNumber' : undefined"
            :aria-label="`第 ${index + 1} 行 SKU`"
            maxlength="200"
            placeholder="SKU"
          />
          <input
            v-model="line.quantity"
            :aria-label="`第 ${index + 1} 行数量`"
            inputmode="decimal"
            placeholder="0"
          />
          <select
            v-model="line.quantityUnit"
            :aria-label="`第 ${index + 1} 行单位`"
          >
            <option value="piece">件</option>
            <option value="carton">箱</option>
            <option value="set">套</option>
            <option value="pallet">托</option>
          </select>
          <button
            type="button"
            class="cargo-editor__delete"
            :aria-label="`删除第 ${index + 1} 行`"
            title="删除此行"
            @click="removeLine(index)"
          >
            <Trash2 :size="15" aria-hidden="true" />
          </button>
        </div>
        <small v-if="line.error" role="alert">{{ line.error }}</small>
      </div>
    </div>

    <p v-if="localError || error" class="cargo-editor__error" role="alert">
      {{ localError || error }}
    </p>
    <p v-if="notice" class="cargo-editor__notice" role="status">{{ notice }}</p>
    <p v-if="result" class="cargo-editor__success" role="status">
      <Check :size="15" aria-hidden="true" />
      已保存 {{ result.cargoLineCount }} 行
      <template v-if="result.unmatchedSkuCount">
        ，{{ result.unmatchedSkuCount }} 个 SKU 继续待匹配
      </template>
    </p>

    <button type="submit" class="cargo-editor__save" :disabled="saving">
      <Save :size="15" aria-hidden="true" />
      {{ saving ? "保存中..." : "保存 SKU 装载明细" }}
    </button>
  </form>
</template>

<style scoped>
.cargo-editor,
.cargo-editor__paste,
.cargo-editor__line {
  display: grid;
  gap: var(--space-3);
}

.cargo-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cargo-editor button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  font-weight: 600;
  cursor: pointer;
}

.cargo-editor__paste textarea {
  width: 100%;
  resize: vertical;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
}

.cargo-editor__table {
  min-width: 0;
  overflow-x: auto;
}

.cargo-editor__row {
  min-width: 620px;
  display: grid;
  grid-template-columns: 1.25fr 1.25fr 0.7fr 0.7fr 38px;
  gap: var(--space-2);
  align-items: center;
}

.cargo-editor__row--head {
  margin-bottom: var(--space-2);
  color: var(--muted);
  font-size: var(--text-label);
}

.cargo-editor input,
.cargo-editor select {
  min-width: 0;
  min-height: 38px;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
}

.cargo-editor__line small,
.cargo-editor__error {
  color: var(--risk);
}

.cargo-editor__line small,
.cargo-editor p {
  margin: 0;
  font-size: var(--text-label);
}

.cargo-editor__notice {
  color: var(--warn);
}

.cargo-editor__success {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--success);
}

.cargo-editor .cargo-editor__delete {
  width: 38px;
  padding: 0;
}

.cargo-editor .cargo-editor__save {
  border-color: var(--brand-strong);
  background: var(--brand-strong);
  color: white;
}
</style>
