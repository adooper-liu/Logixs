<script setup lang="ts">
import DateFactReviewActionPanel from "../components/date-review/DateFactReviewActionPanel.vue";
import DateFactReviewContext from "../components/date-review/DateFactReviewContext.vue";
import DateFactReviewQueue from "../components/date-review/DateFactReviewQueue.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import { useDateFactReviewWorkbench } from "../composables/useDateFactReviewWorkbench";

const workbench = useDateFactReviewWorkbench();
</script>

<template>
  <main class="date-review-page page-frame">
    <PageHeader
      eyebrow="复核岗位"
      title="日期事实复核"
      summary="核对人工实际日期与证据，批准后由系统按来源权威和生命周期条件决定是否推进。"
    />
    <p v-if="workbench.error.value" class="error" role="alert">
      {{ workbench.error.value }}
    </p>
    <div class="review-layout">
      <DateFactReviewQueue
        class="pane pane--queue"
        :items="workbench.items.value"
        :selected-fact-id="workbench.selectedFactId.value"
        :loading="workbench.loading.value"
        :loading-more="workbench.loadingMore.value"
        :has-next-page="workbench.hasNextPage.value"
        @select="workbench.select"
        @more="workbench.loadMore"
      />
      <DateFactReviewContext class="pane" :item="workbench.selected.value" />
      <DateFactReviewActionPanel
        class="pane"
        :item="workbench.selected.value"
        :submitting="workbench.submitting.value"
        :result="workbench.result.value"
        @approve="workbench.approve"
        @refresh="workbench.load"
      />
    </div>
  </main>
</template>

<style scoped>
.date-review-page {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.review-layout {
  display: grid;
  grid-template-columns: minmax(250px, 0.75fr) minmax(360px, 1.35fr) minmax(
      250px,
      0.75fr
    );
  gap: var(--space-3);
  align-items: start;
}
.pane {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--line, #d7dde5);
  border-radius: 6px;
  background: var(--surface, #fff);
}
.pane--queue {
  max-height: calc(100vh - 190px);
  overflow: auto;
}
.error {
  margin: 0;
  padding: var(--space-3) var(--space-3);
  border-left: 3px solid var(--app-danger, #c2413b);
  background: #fef3f2;
  color: var(--app-danger, #c2413b);
  font-size: var(--text-meta);
}
@media (max-width: 1120px) {
  .review-layout {
    grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr);
  }
  .review-layout > :last-child {
    grid-column: 2;
  }
}
@media (max-width: 760px) {
  .review-layout {
    grid-template-columns: 1fr;
  }
  .review-layout > :last-child {
    grid-column: auto;
  }
  .pane--queue {
    max-height: none;
  }
}
</style>
