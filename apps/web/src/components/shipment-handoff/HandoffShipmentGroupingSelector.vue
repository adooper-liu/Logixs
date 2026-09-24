<script setup lang="ts">
import { Check, Lightbulb, Plus, Ship } from "@lucide/vue";
import type {
  PostDepartureShipmentGroupingV1,
  PostDepartureSourceCandidateV1,
  ShipmentSummaryV1,
} from "@logix/contracts";
import { computed, shallowRef } from "vue";

const props = defineProps<{
  candidate: PostDepartureSourceCandidateV1;
  options: readonly ShipmentSummaryV1[];
  loading: boolean;
  error: string;
}>();

const grouping = defineModel<PostDepartureShipmentGroupingV1 | null>({
  required: true,
});
const query = shallowRef("");

const compatibleOptions = computed(() =>
  props.options.filter((option) => {
    const sameOrigin =
      !props.candidate.correction?.originPort?.unlocode ||
      option.originUnlocode === props.candidate.correction.originPort.unlocode;
    const sameDestination =
      !props.candidate.correction?.destinationPort?.unlocode ||
      option.destinationUnlocode ===
        props.candidate.correction.destinationPort.unlocode;
    const sameVessel =
      !props.candidate.vesselName ||
      !option.vesselName ||
      option.vesselName === props.candidate.vesselName;
    const sameVoyage =
      !props.candidate.voyageNumber ||
      !option.voyageNumber ||
      option.voyageNumber === props.candidate.voyageNumber;
    return sameOrigin && sameDestination && sameVessel && sameVoyage;
  }),
);

const recommendation = computed(() => compatibleOptions.value[0] ?? null);
const visibleOptions = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  const ranked = [
    ...compatibleOptions.value,
    ...props.options.filter(
      (option) => !compatibleOptions.value.includes(option),
    ),
  ];
  if (!needle) return ranked;
  return ranked.filter((option) =>
    [
      option.shipmentNumber,
      option.originUnlocode,
      option.destinationUnlocode,
      option.vesselName,
      option.voyageNumber,
    ].some((value) => value?.toLocaleLowerCase().includes(needle)),
  );
});
const alternativeOptions = computed(() =>
  visibleOptions.value.filter(
    (option) => option.id !== recommendation.value?.id,
  ),
);

function chooseExisting(option: ShipmentSummaryV1): void {
  grouping.value = {
    kind: "existing_shipment",
    shipmentId: option.id,
    expectedRelationshipVersion: option.relationshipVersion,
  };
}

function chooseNew(): void {
  grouping.value = { kind: "new_independent_shipment" };
}

function selected(option: ShipmentSummaryV1): boolean {
  return (
    grouping.value?.kind === "existing_shipment" &&
    grouping.value.shipmentId === option.id
  );
}

function shipmentLabel(option: ShipmentSummaryV1): string {
  return option.shipmentNumber ?? "未编业务号";
}

function routeLabel(option: ShipmentSummaryV1): string {
  return `${option.originUnlocode ?? "起运港待补"} → ${option.destinationUnlocode ?? "目的港待补"}`;
}
</script>

<template>
  <fieldset class="grouping-selector">
    <legend>这批货归入哪一票出运</legend>

    <button
      v-if="recommendation"
      type="button"
      class="recommendation"
      :data-testid="`existing-shipment-${shipmentLabel(recommendation)}`"
      :aria-pressed="selected(recommendation)"
      @click="chooseExisting(recommendation)"
    >
      <span class="recommendation__icon">
        <Lightbulb :size="18" aria-hidden="true" />
      </span>
      <span class="recommendation__copy">
        <small>系统建议</small>
        <b>选择 {{ shipmentLabel(recommendation) }}</b>
        <span>
          {{ routeLabel(recommendation) }} ·
          {{ recommendation.vesselName || "船名待补" }}
          {{ recommendation.voyageNumber || "" }}
        </span>
      </span>
      <span class="recommendation__state">
        <Check v-if="selected(recommendation)" :size="15" aria-hidden="true" />
        {{ selected(recommendation) ? "已选" : "选择" }}
      </span>
    </button>

    <button
      v-else
      type="button"
      class="recommendation"
      data-testid="new-independent-shipment"
      :aria-pressed="grouping?.kind === 'new_independent_shipment'"
      @click="chooseNew"
    >
      <span class="recommendation__icon">
        <Lightbulb :size="18" aria-hidden="true" />
      </span>
      <span class="recommendation__copy">
        <small>系统建议</small>
        <b>新建独立出运</b>
        <span>当前没有同时匹配路线和船名航次的已出运 Shipment。</span>
      </span>
      <span class="recommendation__state">
        <Check
          v-if="grouping?.kind === 'new_independent_shipment'"
          :size="15"
          aria-hidden="true"
        />
        {{ grouping?.kind === "new_independent_shipment" ? "已选" : "选择" }}
      </span>
    </button>

    <div v-if="loading" class="selector-state">正在查找现有出运…</div>
    <p v-else-if="error" class="selector-error" role="alert">{{ error }}</p>

    <input
      v-if="options.length"
      v-model.trim="query"
      class="shipment-search"
      type="search"
      aria-label="搜索现有出运"
      placeholder="搜索业务号、港口或船名航次"
    />

    <div v-if="alternativeOptions.length" class="shipment-options">
      <button
        v-for="option in alternativeOptions"
        :key="option.id"
        type="button"
        :data-testid="`existing-shipment-${shipmentLabel(option)}`"
        :aria-pressed="selected(option)"
        @click="chooseExisting(option)"
      >
        <Check v-if="selected(option)" :size="16" aria-hidden="true" />
        <Ship v-else :size="16" aria-hidden="true" />
        <span>
          <b>{{ shipmentLabel(option) }}</b>
          <small>
            {{ routeLabel(option) }} ·
            {{ option.vesselName || "船名待补" }}
            {{ option.voyageNumber || "" }} ·
            {{ option.activeContainerCount }} 柜
          </small>
        </span>
      </button>
    </div>

    <button
      v-if="recommendation"
      type="button"
      class="new-shipment-option"
      data-testid="new-independent-shipment"
      :aria-pressed="grouping?.kind === 'new_independent_shipment'"
      @click="chooseNew"
    >
      <Check
        v-if="grouping?.kind === 'new_independent_shipment'"
        :size="16"
        aria-hidden="true"
      />
      <Plus v-else :size="16" aria-hidden="true" />
      <span>
        <b>新建独立出运</b>
        <small>系统生成内部身份，无需填写或编造编号。</small>
      </span>
    </button>
  </fieldset>
</template>

<style scoped>
.grouping-selector {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  padding: 0 0 var(--space-1);
  color: var(--ink-soft);
  font-size: var(--text-label);
  font-weight: var(--weight-strong);
}

.recommendation {
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 0;
  border-left: 3px solid var(--brand);
  border-radius: var(--radius-card);
  background: var(--brand-soft);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.recommendation__icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
}

.recommendation__copy {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.recommendation__copy small {
  color: var(--brand-strong);
  font-size: var(--text-micro);
  font-weight: var(--weight-strong);
}

.recommendation__copy > span,
.shipment-options small,
.new-shipment-option small,
.selector-state {
  color: var(--muted);
  font-size: var(--text-micro);
}

.recommendation__copy b,
.recommendation__copy > span {
  overflow-wrap: anywhere;
}

.recommendation__state {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--brand);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--brand-strong);
  font-size: var(--text-label);
  font-weight: var(--weight-strong);
  white-space: nowrap;
}

.recommendation[aria-pressed="true"] .recommendation__state {
  background: var(--brand);
  color: var(--on-brand);
}

.shipment-options {
  display: grid;
  gap: var(--space-1);
  max-height: 210px;
  overflow: auto;
}

.shipment-search {
  width: 100%;
  min-height: 38px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

.shipment-options button,
.new-shipment-option {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.shipment-options button[aria-pressed="true"],
.new-shipment-option[aria-pressed="true"] {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.shipment-options button > span,
.new-shipment-option > span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.selector-error {
  margin: 0;
  color: var(--risk);
  font-size: var(--text-meta);
}

@media (max-width: 560px) {
  .recommendation {
    grid-template-columns: 36px minmax(0, 1fr);
    padding: var(--space-3);
  }

  .recommendation__icon {
    width: 36px;
    height: 36px;
  }

  .recommendation__state {
    grid-column: 1 / -1;
    justify-self: stretch;
    justify-content: center;
  }
}
</style>
