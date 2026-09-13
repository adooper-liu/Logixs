<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DynamicDataTable from "../components/ui/DynamicDataTable.vue";
import {
  defaultDataTableFilter,
  extractDataTableRouteFilters,
  type DataTableColumnDefinition,
} from "../components/ui/dataTableContract";
import PageHeader from "../components/ui/PageHeader.vue";
import { useLiveCatalog } from "../composables/useLiveCatalog";
import { createLiveContainerTableProjection } from "../data/containerTableSample";

const route = useRoute();
const router = useRouter();
const {
  containers,
  loading,
  error,
  tasksReady,
  stationsReady,
  syncReady,
  reload,
} = useLiveCatalog();
const query = shallowRef("");
const projection = computed(() =>
  createLiveContainerTableProjection(containers.value, {
    tasksReady: tasksReady.value,
    stationsReady: stationsReady.value,
    syncReady: syncReady.value,
  }),
);
const defaultFilter = computed(() =>
  defaultDataTableFilter(projection.value.schema),
);
const filter = shallowRef(defaultFilter.value);
const externalFilters = computed(() =>
  extractDataTableRouteFilters(projection.value.schema, route.query),
);

onMounted(() => {
  void reload();
});

watch(
  () => route.query.filter,
  (value) => {
    const allowed = projection.value.schema.quickFilters?.some(
      (item) => item.code === value,
    );
    filter.value =
      typeof value === "string" && allowed ? value : defaultFilter.value;
  },
  { immediate: true },
);

watch(filter, (value) => {
  if (
    route.query.filter === value ||
    (value === defaultFilter.value && !route.query.filter)
  )
    return;
  const nextQuery = { ...route.query };
  if (value === defaultFilter.value) delete nextQuery.filter;
  else nextQuery.filter = value;
  void router.replace({ query: nextQuery });
});

const openRow = (rowId: string) => {
  void router.push({ path: "/tasks", query: { containerId: rowId } });
};

const clearExternalFilter = (columnCode: string) => {
  const column: DataTableColumnDefinition | undefined =
    projection.value.schema.columns.find((item) => item.code === columnCode);
  if (!column?.queryKey) return;
  const nextQuery = { ...route.query };
  delete nextQuery[column.queryKey];
  void router.replace({ query: nextQuery });
};
</script>

<template>
  <div class="containers-page page-frame">
    <PageHeader title="干活" summary="点开一行去做这一柜的任务。" />
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>
    <DynamicDataTable
      v-else
      v-model:query="query"
      v-model:filter="filter"
      :projection="projection"
      :external-filters="externalFilters"
      processing-mode="client"
      @open-row="openRow"
      @clear-external-filter="clearExternalFilter"
    />
  </div>
</template>

<style scoped>
.containers-page {
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
</style>
