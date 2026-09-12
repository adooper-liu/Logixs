<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { ContainerLifecycleState } from "@logix/contracts";
import { listContainers, type ContainerSummary } from "../api/containers";
import PageHeader from "../components/ui/PageHeader.vue";

const STATUS_LABELS: Record<ContainerLifecycleState, string> = {
  not_shipped: "未出运",
  shipped: "已出运",
  in_transit: "在途",
  at_port: "已到港",
  picked_up: "已提柜",
  unloaded: "已卸柜",
  returned_empty: "已还箱",
  cancelled: "已取消",
};

const containers = ref<ContainerSummary[]>([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    containers.value = await listContainers();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "加载失败，请确认 API 已启动";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="real-containers-page page-frame">
    <PageHeader eyebrow="薄真实链路验证" title="真实货柜（API 接线）" />

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">加载失败：{{ error }}</p>
    <p v-else-if="containers.length === 0" class="hint">暂无数据</p>

    <table v-else class="real-table">
      <thead>
        <tr>
          <th>备货单号</th>
          <th>箱号</th>
          <th>当前状态</th>
          <th>更新时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in containers" :key="item.id">
          <td>{{ item.orderNumber }}</td>
          <td>{{ item.containerNumber ?? "—" }}</td>
          <td>{{ STATUS_LABELS[item.currentStatus] ?? item.currentStatus }}</td>
          <td>{{ new Date(item.updatedAt).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.real-containers-page {
  min-width: 0;
  min-height: 100%;
}
.hint {
  color: var(--app-text-secondary, #6b7280);
  padding: 12px 0;
}
.hint--error {
  color: var(--app-danger, #dc2626);
}
.real-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.real-table th,
.real-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
}
.real-table th {
  color: var(--app-text-secondary, #6b7280);
  font-weight: 600;
}
</style>
