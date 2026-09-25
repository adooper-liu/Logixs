<script setup lang="ts">
import { Check, ClipboardPaste, Plus, Save, Trash2, X } from "@lucide/vue";
import { computed, reactive, shallowRef, watch } from "vue";
import type { PostDepartureSourceCandidateV1 } from "../../api/postDepartureSourcePackages";
import type { CandidateCargoLineDraft } from "../../composables/usePostDepartureHandoffWorkbench";

const props = defineProps<{
  candidate: PostDepartureSourceCandidateV1;
  saving: boolean;
  error: string;
  result: { remainingIssues: readonly unknown[] } | null;
}>();

const emit = defineEmits<{
  submit: [lines: CandidateCargoLineDraft[]];
}>();

type EditableLine = CandidateCargoLineDraft & { key: string; error: string };

const lines = reactive<EditableLine[]>([]);
const pasteOpen = shallowRef(false);
const pasteValue = shallowRef("");
const localError = shallowRef("");

const skuCount = computed(
  () =>
    new Set(lines.map((line) => line.productNumber.trim()).filter(Boolean))
      .size,
);

watch(
  () => [props.candidate.candidateRef, props.candidate.correction?.version],
  () => resetFromCandidate(),
  { immediate: true },
);

function resetFromCandidate(): void {
  const existing = props.candidate.correction?.cargoAllocations ?? [];
  lines.splice(
    0,
    lines.length,
    ...(existing.length
      ? existing.map((line) => ({
          key: crypto.randomUUID(),
          sourceLineRef: line.sourceLineId,
          replenishmentOrderNumber: line.replenishmentOrderNumber,
          productNumber: line.productNumber,
          quantity: line.quantity,
          quantityUnit: line.quantityUnit,
          error: "",
        }))
      : [emptyLine()]),
  );
  pasteOpen.value = false;
  pasteValue.value = "";
  localError.value = "";
}

function emptyLine(): EditableLine {
  return {
    key: crypto.randomUUID(),
    replenishmentOrderNumber:
      props.candidate.replenishmentOrderNumbers[0] ?? "",
    productNumber: "",
    quantity: "",
    quantityUnit: "piece",
    error: "",
  };
}

function addLine(): void {
  lines.push(emptyLine());
}

function removeLine(index: number): void {
  lines.splice(index, 1);
  if (lines.length === 0) lines.push(emptyLine());
}

function applyPaste(): void {
  const parsed = pasteValue.value
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) =>
      row.split(row.includes("\t") ? "\t" : ",").map((cell) => cell.trim()),
    );
  const rows = parsed.filter(
    (cells, index) => !(index === 0 && isHeader(cells)),
  );
  if (rows.length === 0 || rows.some((cells) => cells.length < 4)) {
    localError.value = "粘贴内容需包含备货单号、SKU、数量和单位四列";
    return;
  }
  const mapped = rows.map(
    ([orderNumber, productNumber, quantity, rawUnit]) => ({
      key: crypto.randomUUID(),
      replenishmentOrderNumber: orderNumber ?? "",
      productNumber: productNumber ?? "",
      quantity: quantity ?? "",
      quantityUnit: normalizeUnit(rawUnit ?? ""),
      error: "",
    }),
  );
  if (mapped.some((line) => !line.quantityUnit)) {
    localError.value =
      "单位只支持件、箱、套、托（或 piece、carton、set、pallet）";
    return;
  }
  lines.splice(0, lines.length, ...(mapped as EditableLine[]));
  pasteOpen.value = false;
  pasteValue.value = "";
  localError.value = "";
}

function isHeader(cells: string[]): boolean {
  return /备货|order/i.test(cells[0] ?? "") && /sku|货号/i.test(cells[1] ?? "");
}

function normalizeUnit(
  value: string,
): CandidateCargoLineDraft["quantityUnit"] | "" {
  const units: Record<string, CandidateCargoLineDraft["quantityUnit"]> = {
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

function submit(): void {
  let valid = true;
  const allowedOrders = new Set(props.candidate.replenishmentOrderNumbers);
  for (const line of lines) {
    line.error = "";
    if (!allowedOrders.has(line.replenishmentOrderNumber)) {
      line.error = "请选择当前货柜关联的备货单";
    } else if (!line.productNumber.trim()) {
      line.error = "请填写 SKU";
    } else if (
      !/^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,3})?$/.test(line.quantity) ||
      Number(line.quantity) <= 0
    ) {
      line.error = "数量必须大于 0，最多 3 位小数";
    }
    if (line.error) valid = false;
  }
  if (!valid) {
    localError.value = "请先修正标红的明细行";
    return;
  }
  localError.value = "";
  emit(
    "submit",
    lines.map(
      ({
        sourceLineRef,
        replenishmentOrderNumber,
        productNumber,
        quantity,
        quantityUnit,
      }) => ({
        ...(sourceLineRef ? { sourceLineRef } : {}),
        replenishmentOrderNumber,
        productNumber: productNumber.trim(),
        quantity,
        quantityUnit,
      }),
    ),
  );
}
</script>

<template>
  <section
    class="cargo-editor"
    aria-label="补齐 SKU 装载明细"
    data-testid="handoff-cargo-editor"
  >
    <header class="pane-heading">
      <span><small>货物明细</small><b>补齐 SKU 装载明细</b></span>
      <small>{{ lines.length }} 行 · {{ skuCount }} 个 SKU</small>
    </header>

    <div class="editor-body">
      <div class="editor-actions">
        <button type="button" @click="pasteOpen = !pasteOpen">
          <X v-if="pasteOpen" :size="16" aria-hidden="true" />
          <ClipboardPaste v-else :size="16" aria-hidden="true" />
          {{ pasteOpen ? "关闭批量录入" : "批量粘贴" }}
        </button>
        <button type="button" @click="addLine">
          <Plus :size="16" aria-hidden="true" />
          新增一行
        </button>
      </div>

      <div v-if="pasteOpen" class="paste-panel">
        <textarea
          v-model="pasteValue"
          aria-label="批量粘贴 SKU 装载明细"
          rows="5"
          placeholder="备货单号&#9;SKU&#9;数量&#9;单位"
        />
        <button type="button" @click="applyPaste">
          <Check :size="16" aria-hidden="true" />
          解析到明细表
        </button>
      </div>

      <div class="cargo-table" role="table" aria-label="SKU 装载明细">
        <div class="cargo-row cargo-row--head" role="row">
          <span role="columnheader">备货单</span>
          <span role="columnheader">SKU</span>
          <span role="columnheader">数量</span>
          <span role="columnheader">单位</span>
          <span role="columnheader" class="sr-only">操作</span>
        </div>
        <div v-for="(line, index) in lines" :key="line.key" class="cargo-line">
          <div
            class="cargo-row"
            role="row"
            :aria-label="`装载明细第 ${index + 1} 行`"
          >
            <select
              v-model="line.replenishmentOrderNumber"
              :aria-label="`第 ${index + 1} 行备货单`"
            >
              <option
                v-for="orderNumber in candidate.replenishmentOrderNumbers"
                :key="orderNumber"
                :value="orderNumber"
              >
                {{ orderNumber }}
              </option>
            </select>
            <input
              v-model.trim="line.productNumber"
              :aria-label="`第 ${index + 1} 行 SKU`"
              maxlength="200"
              placeholder="SKU"
              autocomplete="off"
            />
            <input
              v-model.trim="line.quantity"
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
              class="icon-action"
              :aria-label="`删除第 ${index + 1} 行`"
              title="删除此行"
              @click="removeLine(index)"
            >
              <Trash2 :size="16" aria-hidden="true" />
            </button>
          </div>
          <small v-if="line.error" class="line-error" role="alert"
            >第 {{ index + 1 }} 行：{{ line.error }}</small
          >
        </div>
      </div>

      <p v-if="localError || error" class="form-error" role="alert">
        {{ localError || error }}
      </p>
      <div v-if="result" class="save-result" role="status">
        <Check :size="16" aria-hidden="true" />
        <span>
          <b>SKU 装载明细已保存</b>
          <small v-if="result.remainingIssues.length"
            >仍有其他接管缺口需要处理</small
          >
          <small v-else>当前候选接管条件已齐备</small>
        </span>
      </div>

      <button
        type="button"
        class="save-action"
        :disabled="saving"
        @click="submit"
      >
        <Save :size="16" aria-hidden="true" />
        {{ saving ? "正在核对并保存" : "核对并保存全部明细" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.cargo-editor,
.pane-heading > span,
.save-result span {
  min-width: 0;
}

.pane-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pane-heading > span,
.save-result span {
  display: grid;
  gap: var(--space-1);
}

.pane-heading small,
.save-result small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.editor-body,
.paste-panel {
  display: grid;
  gap: var(--space-3);
}

.editor-body {
  padding: var(--space-4);
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

textarea,
input,
select {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

textarea {
  resize: vertical;
}

.cargo-table,
.cargo-line {
  display: grid;
  gap: var(--space-1);
}

.cargo-row {
  display: grid;
  grid-template-columns:
    minmax(120px, 1.1fr) minmax(110px, 1.2fr) minmax(76px, 0.65fr)
    minmax(72px, 0.7fr) 38px;
  gap: var(--space-2);
  align-items: center;
}

.cargo-row--head {
  color: var(--muted);
  font-size: var(--text-micro);
}

.icon-action {
  width: 38px;
  padding: 0;
  color: var(--risk);
}

.line-error,
.form-error {
  margin: 0;
  color: var(--risk);
  font-size: var(--text-meta);
}

.save-result {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid var(--success);
  background: var(--success-bg);
  color: var(--success);
}

.save-action {
  width: 100%;
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 720px) {
  .cargo-row--head {
    display: none;
  }

  .cargo-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 38px;
  }

  .cargo-row input:nth-of-type(1),
  .cargo-row select:first-child {
    grid-column: span 2;
  }
}
</style>
