<script setup lang="ts">
import { FileCheck2, History, Import, Upload } from "@lucide/vue";
import {
  computed,
  nextTick,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import { usePostDepartureHandoffWorkbench } from "../../composables/usePostDepartureHandoffWorkbench";
import {
  handoffIssueAction,
  type HandoffResolutionTarget,
} from "../../data/postDepartureHandoffCopy";
import PageHeader from "../ui/PageHeader.vue";
import HandoffCandidateDetail from "./HandoffCandidateDetail.vue";
import HandoffAcceptancePanel from "./HandoffAcceptancePanel.vue";
import HandoffCandidateCorrectionForm from "./HandoffCandidateCorrectionForm.vue";
import HandoffCargoLinesEditor from "./HandoffCargoLinesEditor.vue";
import HandoffCandidateQueue from "./HandoffCandidateQueue.vue";
import HandoffPreflightSummary from "./HandoffPreflightSummary.vue";
import PostDeparturePackageUploader from "./PostDeparturePackageUploader.vue";
import InternalShipmentHandoffPanel from "./InternalShipmentHandoffPanel.vue";
import ShipmentRelationshipPanel from "./ShipmentRelationshipPanel.vue";

const emit = defineEmits<{
  showLoadingHistory: [];
}>();

const workbench = usePostDepartureHandoffWorkbench();
const activeResolution = shallowRef<HandoffResolutionTarget | null>(null);
const sourcesExpanded = shallowRef(true);
const sourceUploader = useTemplateRef<HTMLElement>("sourceUploader");
const resolutionPanel = useTemplateRef<HTMLElement>("resolutionPanel");

onMounted(() => {
  void workbench.loadInternalCandidates();
});

const correctionFocusTarget = computed<HandoffResolutionTarget>(() => {
  if (activeResolution.value !== "cargo") {
    return activeResolution.value ?? "shipment_grouping";
  }
  const targets =
    workbench.selectedCandidate.value?.issues.map(
      (issue) => handoffIssueAction(issue).target,
    ) ?? [];
  return ([
    "shipment_grouping",
    "origin_port",
    "destination_port",
    "departure",
  ].find((target) => targets.includes(target as HandoffResolutionTarget)) ??
    "shipment_grouping") as HandoffResolutionTarget;
});

watch(
  () => workbench.selectedCandidateRef.value,
  () => {
    activeResolution.value = null;
  },
);

async function openResolution(target: HandoffResolutionTarget): Promise<void> {
  if (target === "sources" || target === "cargo_owner") {
    sourcesExpanded.value = true;
    await nextTick();
    sourceUploader.value?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    return;
  }

  activeResolution.value = target;
  const candidate = workbench.selectedCandidate.value;
  if (target === "origin_port" && candidate?.originPortRaw) {
    await workbench.searchPort("origin", candidate.originPortRaw);
  } else if (target === "destination_port" && candidate?.destinationPortRaw) {
    await workbench.searchPort("destination", candidate.destinationPortRaw);
  }

  await nextTick();
  resolutionPanel.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (target === "cargo") {
    resolutionPanel.value
      ?.querySelector<HTMLInputElement>('[aria-label="第 1 行 SKU"]')
      ?.focus();
  }
}

function closeResolution(): void {
  activeResolution.value = null;
}

async function runPreflight(): Promise<void> {
  await workbench.runPreflight();
  if (workbench.preflightResult.value) sourcesExpanded.value = false;
}
</script>

<template>
  <main class="handoff-workbench page-frame">
    <PageHeader
      eyebrow="出运工作台"
      title="接管已出运数据"
      summary="从当前已有资料开始接管；缺失内容持续提示并可后补。"
    >
      <template #actions>
        <div class="view-switch" aria-label="出运工作台视图">
          <button type="button" class="view-switch__active" aria-current="page">
            <Import :size="16" aria-hidden="true" />
            接管已出运数据
          </button>
          <button type="button" @click="emit('showLoadingHistory')">
            <History :size="16" aria-hidden="true" />
            装船交接历史
          </button>
        </div>
      </template>
    </PageHeader>

    <InternalShipmentHandoffPanel
      :candidates="workbench.internalCandidates.value"
      :loading="workbench.loadingInternalCandidates.value"
      :accepting-ref="workbench.acceptingInternalCandidateRef.value"
      :error="workbench.internalCandidateError.value"
      @refresh="workbench.loadInternalCandidates"
      @accept="workbench.acceptInternalCandidate"
    />

    <ShipmentRelationshipPanel
      v-if="workbench.acceptedShipmentDetail.value"
      :detail="workbench.acceptedShipmentDetail.value"
    />

    <div ref="sourceUploader" class="file-handoff-source">
      <PostDeparturePackageUploader
        v-if="!workbench.preflightResult.value || sourcesExpanded"
        :sources="workbench.sources.value"
        :source-count="workbench.sourceCount.value"
        :can-preflight="workbench.canPreflight.value"
        :preflighting="workbench.preflighting.value"
        @select-file="workbench.uploadSource"
        @preflight="runPreflight"
      />
      <section v-else class="source-summary" aria-label="当前来源文件">
        <FileCheck2 :size="18" aria-hidden="true" />
        <span>
          <b>{{ workbench.sourceCount.value }} 份来源已完成预检</b>
          <small>原文件与读取结果已留存</small>
        </span>
        <button type="button" @click="sourcesExpanded = true">
          <Upload :size="15" aria-hidden="true" />
          更换来源文件
        </button>
      </section>
    </div>

    <p v-if="workbench.preflightError.value" class="error-notice" role="alert">
      {{ workbench.preflightError.value }}
    </p>

    <div v-if="workbench.preflightResult.value" class="preflight-grid">
      <div class="workbench-pane">
        <HandoffCandidateQueue
          :candidates="workbench.candidates.value"
          :selected-candidate-ref="workbench.selectedCandidateRef.value"
          @select="workbench.selectCandidate"
        />
      </div>
      <div class="candidate-column">
        <div class="workbench-pane">
          <HandoffCandidateDetail
            v-if="workbench.selectedCandidate.value"
            :candidate="workbench.selectedCandidate.value"
            :active-resolution="activeResolution"
            @resolve="openResolution"
          />
        </div>
        <div
          v-if="activeResolution && workbench.selectedCandidate.value"
          ref="resolutionPanel"
          class="workbench-pane resolution-pane"
          :class="{
            'resolution-pane--compact': activeResolution !== 'cargo',
          }"
        >
          <HandoffCandidateCorrectionForm
            v-if="activeResolution !== 'cargo'"
            :candidate="workbench.selectedCandidate.value"
            :shipment-options="workbench.shipmentOptions.value"
            :loading-shipment-options="workbench.loadingShipmentOptions.value"
            :shipment-options-error="workbench.shipmentOptionsError.value"
            :focus-target="correctionFocusTarget"
            :origin-options="workbench.originPortOptions.value"
            :destination-options="workbench.destinationPortOptions.value"
            :searching-origin="workbench.searchingOriginPort.value"
            :searching-destination="workbench.searchingDestinationPort.value"
            :saving="workbench.savingCorrection.value"
            :error="workbench.correctionError.value"
            :result="workbench.correctionResult.value"
            @search-port="workbench.searchPort"
            @submit="workbench.saveCandidateCorrection"
            @cancel="closeResolution"
          />
          <HandoffCargoLinesEditor
            v-else
            :candidate="workbench.selectedCandidate.value"
            :saving="workbench.savingCargo.value"
            :error="workbench.cargoError.value"
            :result="workbench.cargoResult.value"
            @submit="workbench.saveCandidateCargoLines"
          />
        </div>
      </div>
      <div class="action-column">
        <div v-if="workbench.selectedCandidate.value" class="workbench-pane">
          <HandoffAcceptancePanel
            :candidate="workbench.selectedCandidate.value"
            :accepting="workbench.acceptingCandidate.value"
            :error="workbench.acceptanceError.value"
            :result="workbench.acceptanceResult.value"
            @accept="workbench.acceptSelectedCandidate"
          />
        </div>
        <div class="workbench-pane">
          <HandoffPreflightSummary
            :result="workbench.preflightResult.value"
            :preflighting="workbench.preflighting.value"
            :review-receipt="workbench.reviewReceipt.value"
            :review-save-error="workbench.reviewSaveError.value"
            @retry="runPreflight"
          />
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.handoff-workbench {
  min-width: 0;
}

.file-handoff-source {
  margin-top: var(--space-3);
}

.view-switch {
  display: inline-flex;
  padding: var(--space-1);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-2);
}

.view-switch button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: calc(var(--radius-control) - 2px);
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--text-meta);
  cursor: pointer;
}

.view-switch__active {
  background: var(--surface) !important;
  color: var(--brand-strong) !important;
  box-shadow: var(--shadow-card);
  font-weight: var(--weight-strong);
}

.error-notice {
  margin: var(--space-3) 0 0;
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--risk);
  background: var(--risk-bg);
  color: var(--risk);
}

.source-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  min-height: 46px;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--brand-strong);
}

.source-summary span {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.source-summary small {
  color: var(--muted);
  font-size: var(--text-micro);
}

.source-summary button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink-soft);
  font-weight: var(--weight-strong);
  cursor: pointer;
}

.preflight-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(264px, 0.72fr) minmax(500px, 1.7fr) minmax(
      276px,
      0.78fr
    );
  gap: var(--space-4);
  align-items: start;
  margin-top: var(--space-3);
}

.workbench-pane {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  overflow: hidden;
}

.action-column {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
  position: sticky;
  top: var(--space-4);
}

.candidate-column {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}

.resolution-pane {
  scroll-margin-top: var(--space-4);
}

.resolution-pane--compact {
  width: min(100%, 780px);
  margin-inline: auto;
}

@media (max-width: 1180px) {
  .preflight-grid {
    grid-template-columns: minmax(260px, 0.7fr) minmax(0, 1.3fr);
  }

  .action-column {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    position: static;
  }
}

@media (max-width: 720px) {
  .view-switch,
  .view-switch button {
    width: 100%;
  }

  .view-switch {
    flex-direction: column;
  }

  .preflight-grid {
    grid-template-columns: 1fr;
  }

  .action-column {
    grid-column: auto;
    grid-template-columns: 1fr;
  }

  .source-summary {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .source-summary button {
    grid-column: 1 / -1;
    justify-content: center;
  }
}
</style>
