import { ref } from "vue";
import {
  listObjectActivities,
  type ObjectActivityItem,
  type ObjectNextAction,
} from "../api/objectActivities";

const PAGE_SIZE = 25;

export function useObjectActivities() {
  const items = ref<ObjectActivityItem[]>([]);
  const nextActions = ref<ObjectNextAction[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref("");
  const nextCursor = ref<string | null>(null);
  const hasNextPage = ref(false);
  let requestVersion = 0;
  let activeContainerId = "";

  async function load(containerId: string): Promise<void> {
    const normalizedId = containerId.trim();
    const version = ++requestVersion;
    activeContainerId = normalizedId;
    items.value = [];
    nextActions.value = [];
    nextCursor.value = null;
    hasNextPage.value = false;
    error.value = "";
    if (!normalizedId) return;

    loading.value = true;
    try {
      const page = await listObjectActivities(normalizedId, {
        pageSize: PAGE_SIZE,
      });
      if (version !== requestVersion) return;
      items.value = page.items;
      nextActions.value = page.nextActions;
      nextCursor.value = page.pageInfo.nextCursor;
      hasNextPage.value = page.pageInfo.hasNextPage;
    } catch (cause) {
      if (version !== requestVersion) return;
      error.value =
        cause instanceof Error && cause.message !== "RESOURCE_NOT_FOUND"
          ? cause.message
          : "对象动态不可用";
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    const cursor = nextCursor.value;
    const containerId = activeContainerId;
    if (!containerId || !cursor || loadingMore.value) return;
    const version = requestVersion;
    loadingMore.value = true;
    error.value = "";
    try {
      const page = await listObjectActivities(containerId, {
        pageSize: PAGE_SIZE,
        cursor,
      });
      if (version !== requestVersion) return;
      const knownIds = new Set(items.value.map((item) => item.id));
      items.value.push(...page.items.filter((item) => !knownIds.has(item.id)));
      nextActions.value = page.nextActions;
      nextCursor.value = page.pageInfo.nextCursor;
      hasNextPage.value = page.pageInfo.hasNextPage;
    } catch (cause) {
      if (version !== requestVersion) return;
      error.value = cause instanceof Error ? cause.message : "加载更多失败";
    } finally {
      if (version === requestVersion) loadingMore.value = false;
    }
  }

  return {
    items,
    nextActions,
    loading,
    loadingMore,
    error,
    hasNextPage,
    load,
    loadMore,
  };
}
