import type {
  LifecycleDateFactReviewItem,
  LifecycleDateFactResult,
} from "@logix/contracts";
import { computed, onMounted, readonly, ref, shallowRef } from "vue";
import {
  approveLifecycleDateFactReview,
  listLifecycleDateFactReviews,
} from "../api/lifecycleDateFactReviews";

export function useDateFactReviewWorkbench() {
  const items = shallowRef<LifecycleDateFactReviewItem[]>([]);
  const selectedFactId = ref("");
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const nextCursor = shallowRef<string | null>(null);
  const submitting = shallowRef(false);
  const error = shallowRef("");
  const result = shallowRef<LifecycleDateFactResult | null>(null);
  const commandKeys = new Map<string, string>();
  const selected = computed(
    () =>
      items.value.find((item) => item.factId === selectedFactId.value) ?? null,
  );

  async function load(append = false): Promise<void> {
    if (append && !nextCursor.value) return;
    if (append) loadingMore.value = true;
    else loading.value = true;
    error.value = "";
    try {
      const page = await listLifecycleDateFactReviews({
        pageSize: 30,
        cursor: append ? (nextCursor.value ?? undefined) : undefined,
      });
      items.value = append
        ? [
            ...items.value,
            ...page.items.filter(
              (candidate) =>
                !items.value.some((item) => item.factId === candidate.factId),
            ),
          ]
        : [...page.items];
      nextCursor.value = page.pageInfo.nextCursor;
      if (!items.value.some((item) => item.factId === selectedFactId.value)) {
        selectedFactId.value = items.value[0]?.factId ?? "";
      }
    } catch (cause) {
      error.value = message(cause, "复核队列未能加载");
    } finally {
      if (append) loadingMore.value = false;
      else loading.value = false;
    }
  }

  const loadMore = () => load(true);

  function select(factId: string): void {
    selectedFactId.value = factId;
    result.value = null;
    error.value = "";
  }

  async function approve(): Promise<void> {
    const item = selected.value;
    if (!item || !item.allowedActions.includes("approve") || submitting.value) {
      return;
    }
    submitting.value = true;
    error.value = "";
    result.value = null;
    try {
      const idempotencyKey =
        commandKeys.get(item.factId) ?? crypto.randomUUID();
      commandKeys.set(item.factId, idempotencyKey);
      result.value = await approveLifecycleDateFactReview(item.factId, {
        reasonCode: "date_fact_review_approved",
        expectedVersion: item.projectionVersion,
        idempotencyKey,
      });
      commandKeys.delete(item.factId);
      await load();
    } catch (cause) {
      error.value = message(cause, "日期事实未能批准");
    } finally {
      submitting.value = false;
    }
  }

  onMounted(load);
  return {
    items: readonly(items),
    selected,
    selectedFactId: readonly(selectedFactId),
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    hasNextPage: computed(() => nextCursor.value !== null),
    submitting: readonly(submitting),
    error: readonly(error),
    result: readonly(result),
    load,
    loadMore,
    select,
    approve,
  };
}

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
