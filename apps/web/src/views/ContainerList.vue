<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DynamicDataTable from "../components/ui/DynamicDataTable.vue";
import {
  extractDataTableRouteFilters,
  type DataTableColumnDefinition,
} from "../components/ui/dataTableContract";
import PageHeader from "../components/ui/PageHeader.vue";
import { useDemoOperationsStore } from "../composables/useDemoOperationsStore";
import { createContainerTableProjection } from "../data/containerTableSample";

const route = useRoute();
const router = useRouter();
const { containers } = useDemoOperationsStore();
const query = shallowRef("");
const filter = shallowRef("all");
const projection = computed(() =>
  createContainerTableProjection(containers.value),
);
const externalFilters = computed(() =>
  extractDataTableRouteFilters(projection.value.schema, route.query),
);

watch(
  () => route.query.filter,
  (value) => {
    const allowed = projection.value.schema.quickFilters?.some(
      (item) => item.code === value,
    );
    filter.value = typeof value === "string" && allowed ? value : "all";
  },
  { immediate: true },
);

watch(filter, (value) => {
  if (route.query.filter === value || (value === "all" && !route.query.filter))
    return;
  const nextQuery = { ...route.query };
  if (value === "all") delete nextQuery.filter;
  else nextQuery.filter = value;
  void router.replace({ query: nextQuery });
});

const openRow = (rowId: string) => {
  void router.push(`/container/${rowId}`);
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
    <PageHeader eyebrow="当前业务入口" title="已出运货柜" />
    <DynamicDataTable
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
</style>
