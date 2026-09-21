<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { listContainers, type ContainerSummary } from "../api/containers";
import ComplianceAssessmentPanel from "../components/compliance/ComplianceAssessmentPanel.vue";
import ComplianceReviewForm from "../components/compliance/ComplianceReviewForm.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useCargoReadyCompliance } from "../composables/useCargoReadyCompliance";

const route = useRoute();
const router = useRouter();
const containers = shallowRef<ContainerSummary[]>([]);
const containerLoadError = shallowRef("");
const containerId = computed(() =>
  String(route.query.containerId ?? "").trim(),
);
const { assessment, replay, loading, submitting, error, assess, decide } =
  useCargoReadyCompliance(containerId);

onMounted(async () => {
  try {
    containers.value = (await listContainers({ pageSize: 100 })).items;
  } catch (cause) {
    containerLoadError.value =
      cause instanceof Error
        ? cause.message
        : "加载货柜失败，请确认 API 已启动";
  }
});

function selectContainer(value: string): void {
  void router.replace({
    path: "/compliance",
    query: value ? { containerId: value } : {},
  });
}

const replayLabel = computed(() => {
  if (!replay.value) return "";
  const labels: Record<typeof replay.value.status, string> = {
    not_requested: "未申请重放",
    no_pending_facts: "没有待应用日期事实",
    completed: "待应用日期事实已完成重放",
    deferred: "重放后仍待条件满足",
    retry_required: "重放失败，需重试",
  };
  return `${labels[replay.value.status]}：应用 ${replay.value.applied}，待处理 ${replay.value.pending}，拒绝 ${replay.value.rejected}`;
});
</script>

<template>
  <main class="compliance-page page-frame">
    <PageHeader
      eyebrow="备货岗位"
      title="合规评审"
      summary="按货柜锁定 SKU、档案、证书与规则版本；决定提交后只重放既有待应用事实。"
    />

    <label class="container-picker">
      货柜
      <select
        data-testid="container-select"
        :value="containerId"
        @change="selectContainer(($event.target as HTMLSelectElement).value)"
      >
        <option value="">选择货柜</option>
        <option v-for="item in containers" :key="item.id" :value="item.id">
          {{ item.orderNumber }} · {{ item.containerNumber ?? "无箱号" }}
        </option>
      </select>
    </label>

    <p
      v-if="containerLoadError || error"
      class="message message--error"
      role="alert"
    >
      {{ containerLoadError || error }}
    </p>
    <p v-if="replayLabel" class="message" data-testid="replay-result">
      {{ replayLabel }}
    </p>
    <p v-if="!containerId" class="message">先选择货柜再进行合规评审。</p>

    <div v-else class="workspace-grid">
      <ComplianceReviewForm
        :assessment="assessment"
        :submitting="submitting"
        @assess="assess"
        @decide="decide"
      />
      <ComplianceAssessmentPanel :assessment="assessment" :loading="loading" />
    </div>
  </main>
</template>

<style scoped>
.compliance-page {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.container-picker {
  display: grid;
  gap: 6px;
  max-width: 480px;
  color: var(--app-text-secondary, #667085);
  font-size: 13px;
}
.container-picker select {
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line, #d7dde5);
  border-radius: 4px;
  background: var(--surface, #ffffff);
}
.message {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--app-brand, #155eef);
  background: color-mix(in srgb, var(--app-brand, #155eef) 7%, transparent);
  font-size: 13px;
}
.message--error {
  border-left-color: var(--app-danger, #c2413b);
  color: var(--app-danger, #c2413b);
}
.workspace-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.7fr) minmax(0, 1.3fr);
  gap: 16px;
  align-items: start;
}
@media (max-width: 980px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
