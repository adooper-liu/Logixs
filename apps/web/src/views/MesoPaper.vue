<script setup lang="ts">
import AnalysisClosurePanel from "../components/management/AnalysisClosurePanel.vue";
import ContainerFlowTable from "../components/management/ContainerFlowTable.vue";
import PlanningExecutionPanel from "../components/management/PlanningExecutionPanel.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import InfoTooltip from "../components/ui/InfoTooltip.vue";
import {
  achievementRows,
  capabilityRows,
  cycleRows,
  feeRows,
  meetingDecisions,
} from "../data/sample";
import { useDemoOperationsStore } from "../composables/useDemoOperationsStore";

const { containers, exceptions } = useDemoOperationsStore();
</script>

<template>
  <div class="operations-page page-frame">
    <PageHeader eyebrow="运营计划" title="First Mile PDCA 运营">
      <template #help>
        <InfoTooltip
          label="查看七维管理范围"
          text="完整性范围：计划、达成、状态、时效、费用、异常与复盘；管理维度映射到流程节点和责任动作。"
        />
      </template>
    </PageHeader>
    <PlanningExecutionPanel
      :capabilities="capabilityRows"
      :achievements="achievementRows"
    />
    <ContainerFlowTable :rows="containers" />
    <AnalysisClosurePanel
      :cycles="cycleRows"
      :fees="feeRows"
      :exceptions="exceptions"
      :decisions="meetingDecisions"
    />
  </div>
</template>

<style scoped>
.operations-page {
  min-height: 100%;
}
</style>
