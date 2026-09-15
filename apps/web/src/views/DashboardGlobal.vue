<script setup lang="ts">
import { computed, onMounted } from "vue";
import { ArrowRight } from "@lucide/vue";
import KpiSignalStrip from "../components/management/KpiSignalStrip.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useLiveCatalog } from "../composables/useLiveCatalog";
import { createWorkspaceOverviewSignals } from "../data/kpiProjection";
import { uiCopy } from "../data/uiCopyCatalog";

const { containers, loading, error, syncReady, reload } = useLiveCatalog();

onMounted(() => {
  void reload();
});

const signals = computed(() =>
  createWorkspaceOverviewSignals(containers.value, {
    syncReady: syncReady.value,
  }),
);
</script>

<template>
  <div class="dashboard page-frame">
    <PageHeader title="货柜" :summary="uiCopy.chrome.containersSummary">
      <template #actions>
        <router-link class="page-link" to="/containers">
          去干活
          <ArrowRight :size="15" aria-hidden="true" />
        </router-link>
      </template>
    </PageHeader>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>
    <KpiSignalStrip v-else :items="signals" />
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
}

.hint {
  margin: 0;
  padding: 8px 10px;
  color: var(--muted);
  font-size: 11px;
}

.hint--error {
  color: var(--risk);
}

.page-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--brand);
  text-decoration: none;
  font-size: 13px;
}
</style>
