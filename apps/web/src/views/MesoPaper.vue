<script setup lang="ts">
import { onMounted } from "vue";
import ContainerFlowTable from "../components/management/ContainerFlowTable.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useLiveCatalog } from "../composables/useLiveCatalog";
import { uiCopy } from "../data/uiCopyCatalog";

const { containers, loading, error, railsReady, reload } = useLiveCatalog();

onMounted(() => {
  void reload();
});
</script>

<template>
  <div class="operations-page page-frame">
    <PageHeader title="看档" summary="点柜号打开这一柜的档案。" />
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="hint hint--error">{{ error }}</p>
    <p v-else-if="!containers.length" class="hint">还没有货柜。</p>
    <template v-else>
      <p v-if="!railsReady" class="hint">{{ uiCopy.chrome.railsFailed }}</p>
      <ContainerFlowTable :rows="containers" />
    </template>
  </div>
</template>

<style scoped>
.operations-page {
  min-height: 100%;
}

.hint {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  color: var(--muted);
  font-size: var(--text-micro);
}

.hint--error {
  color: var(--risk);
}
</style>
