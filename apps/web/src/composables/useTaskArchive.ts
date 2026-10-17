import { shallowRef, type ShallowRef } from "vue";
import {
  listObjectActivities,
  type ObjectActivityItem,
  type ObjectNextAction,
} from "../api/objectActivities";

const PAGE_SIZE = 25;

export interface TaskArchiveState {
  items: ShallowRef<ObjectActivityItem[]>;
  nextActions: ShallowRef<ObjectNextAction[]>;
  asOf: ShallowRef<string | null>;
  projectionVersion: ShallowRef<number | null>;
  loading: ShallowRef<boolean>;
  error: ShallowRef<string>;
  hasMore: ShallowRef<boolean>;
  load(containerId: string): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
}

export function useTaskArchive(): TaskArchiveState {
  const items = shallowRef<ObjectActivityItem[]>([]);
  const nextActions = shallowRef<ObjectNextAction[]>([]);
  const asOf = shallowRef<string | null>(null);
  const projectionVersion = shallowRef<number | null>(null);
  const loading = shallowRef(false);
  const error = shallowRef("");
  const hasMore = shallowRef(false);
  let activeContainerId = "";
  let nextCursor: string | null = null;
  let generation = 0;

  function clearArchive(): void {
    items.value = [];
    nextActions.value = [];
    asOf.value = null;
    projectionVersion.value = null;
    nextCursor = null;
    hasMore.value = false;
  }

  function fail(message: string): void {
    clearArchive();
    error.value = message;
  }

  async function load(containerId: string): Promise<void> {
    const normalizedId = containerId.trim();
    const requestGeneration = ++generation;
    activeContainerId = normalizedId;
    clearArchive();
    error.value = "";
    if (!normalizedId) {
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const page = await listObjectActivities(normalizedId, {
        pageSize: PAGE_SIZE,
      });
      if (requestGeneration !== generation) return;
      items.value = page.items;
      nextActions.value = page.nextActions;
      asOf.value = page.asOf;
      projectionVersion.value = page.projectionVersion;
      nextCursor = page.pageInfo.nextCursor;
      hasMore.value = Boolean(
        page.pageInfo.hasNextPage && page.pageInfo.nextCursor,
      );
    } catch (cause) {
      if (requestGeneration !== generation) return;
      fail(
        cause instanceof Error && cause.message
          ? cause.message
          : "任务档案暂时不可用",
      );
    } finally {
      if (requestGeneration === generation) loading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    await load(activeContainerId);
  }

  async function loadMore(): Promise<void> {
    const containerId = activeContainerId;
    const cursor = nextCursor;
    if (!containerId || !cursor || loading.value || !hasMore.value) return;
    const requestGeneration = generation;
    loading.value = true;
    error.value = "";
    try {
      const page = await listObjectActivities(containerId, {
        pageSize: PAGE_SIZE,
        cursor,
      });
      if (requestGeneration !== generation) return;
      if (
        page.asOf !== asOf.value ||
        page.projectionVersion !== projectionVersion.value
      ) {
        fail("档案分页快照已变化，请重试");
        return;
      }
      const knownIds = new Set(items.value.map((item) => item.id));
      items.value = [
        ...items.value,
        ...page.items.filter((item) => !knownIds.has(item.id)),
      ];
      nextCursor = page.pageInfo.nextCursor;
      hasMore.value = Boolean(
        page.pageInfo.hasNextPage && page.pageInfo.nextCursor,
      );
    } catch (cause) {
      if (requestGeneration !== generation) return;
      fail(
        cause instanceof Error && cause.message
          ? cause.message
          : "任务档案暂时不可用",
      );
    } finally {
      if (requestGeneration === generation) loading.value = false;
    }
  }

  return {
    items,
    nextActions,
    asOf,
    projectionVersion,
    loading,
    error,
    hasMore,
    load,
    refresh,
    loadMore,
  };
}
