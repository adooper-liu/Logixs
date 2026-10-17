import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObjectActivityPage } from "../api/objectActivities";
import { useTaskArchive } from "./useTaskArchive";

const listObjectActivities = vi.fn();

vi.mock("../api/objectActivities", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../api/objectActivities")>();
  return {
    ...actual,
    listObjectActivities: (...args: unknown[]) => listObjectActivities(...args),
  };
});

const activity = (id: string, containerId = "c1") => ({
  id,
  activityCode: "task_created",
  sourceType: "node_task",
  sourceId: `source-${id}`,
  occurredAt: "2026-10-17T03:00:00.000Z",
  recordedAt: "2026-10-17T03:01:00.000Z",
  containerId,
  taskId: "task-1",
  workOrderId: null,
  actorId: null,
  nodeCode: "customs_clearance",
  title: "任务已生成",
  detail: null,
  severity: null,
  targetPath: null,
});

const page = (
  ids: string[],
  options: {
    containerId?: string;
    cursor?: string | null;
    hasMore?: boolean;
    asOf?: string;
    projectionVersion?: number;
    nextActions?: ObjectActivityPage["nextActions"];
  } = {},
): ObjectActivityPage => ({
  items: ids.map((id) => activity(id, options.containerId)),
  nextActions: options.nextActions ?? [],
  pageInfo: {
    nextCursor: options.cursor ?? null,
    hasNextPage: options.hasMore ?? false,
    pageSize: 25,
  },
  asOf: options.asOf ?? "2026-10-17T03:00:00.000Z",
  projectionVersion: options.projectionVersion ?? 7,
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const nextAction = (workOrderId: string) => ({
  actionCode: "work_execution.complete_work_order",
  containerId: "c1",
  taskId: `task-${workOrderId}`,
  workOrderId,
  nodeCode: "customs_clearance",
  taskDefinitionKey: "node-customs",
  workOrderDefinitionKey: "wo-customs",
  assignmentState: "assigned",
  assigneeId: null,
  dueAt: null,
  targetPath: `/tasks?task=task-${workOrderId}`,
});

describe("useTaskArchive", () => {
  beforeEach(() => listObjectActivities.mockReset());

  it("discards a late response from the previously selected object", async () => {
    const first = deferred<ObjectActivityPage>();
    const second = deferred<ObjectActivityPage>();
    listObjectActivities
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const archive = useTaskArchive();

    const loadFirst = archive.load("c1");
    const loadSecond = archive.load("c2");
    second.resolve(page(["b"], { containerId: "c2" }));
    await loadSecond;
    first.resolve(page(["a"], { containerId: "c1" }));
    await loadFirst;

    expect(archive.items.value.map((item) => item.id)).toEqual(["b"]);
  });

  it("deduplicates page boundaries while preserving a stable snapshot", async () => {
    listObjectActivities
      .mockResolvedValueOnce(
        page(["a", "b"], { cursor: "next", hasMore: true }),
      )
      .mockResolvedValueOnce(page(["b", "c"]));
    const archive = useTaskArchive();

    await archive.load("c1");
    await archive.loadMore();

    expect(archive.items.value.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(archive.asOf.value).toBe("2026-10-17T03:00:00.000Z");
    expect(archive.projectionVersion.value).toBe(7);
    expect(archive.hasMore.value).toBe(false);
  });

  it("loadMore preserves first-page nextActions while refresh may replace them", async () => {
    const firstAction = nextAction("work-order-a");
    const laterAction = nextAction("work-order-b");
    listObjectActivities
      .mockResolvedValueOnce(
        page(["a"], {
          cursor: "next",
          hasMore: true,
          nextActions: [firstAction],
        }),
      )
      .mockResolvedValueOnce(page(["b"], { nextActions: [laterAction] }))
      .mockResolvedValueOnce(page(["fresh"], { nextActions: [laterAction] }));
    const archive = useTaskArchive();

    await archive.load("c1");
    await archive.loadMore();

    expect(archive.items.value.map((item) => item.id)).toEqual(["a", "b"]);
    expect(archive.nextActions.value).toEqual([firstAction]);

    await archive.refresh();
    expect(archive.items.value.map((item) => item.id)).toEqual(["fresh"]);
    expect(archive.nextActions.value).toEqual([laterAction]);
  });

  it.each([
    ["asOf 漂移", page(["c"], { asOf: "2026-10-17T04:00:00.000Z" })],
    ["projectionVersion 漂移", page(["c"], { projectionVersion: 8 })],
  ])("分页%s时清除旧档案", async (_label, changedPage) => {
    listObjectActivities
      .mockResolvedValueOnce(page(["a"], { cursor: "next", hasMore: true }))
      .mockResolvedValueOnce(changedPage);
    const archive = useTaskArchive();

    await archive.load("c1");
    await archive.loadMore();

    expect(archive.items.value).toEqual([]);
    expect(archive.asOf.value).toBeNull();
    expect(archive.error.value).toContain("快照");
  });

  it.each(["FORBIDDEN", "RESOURCE_NOT_FOUND", "NETWORK_ERROR"])(
    "分页失败 %s 时不保留已读取记录",
    async (message) => {
      listObjectActivities
        .mockResolvedValueOnce(page(["a"], { cursor: "next", hasMore: true }))
        .mockRejectedValueOnce(new Error(message));
      const archive = useTaskArchive();

      await archive.load("c1");
      await archive.loadMore();

      expect(archive.items.value).toEqual([]);
      expect(archive.nextActions.value).toEqual([]);
      expect(archive.hasMore.value).toBe(false);
      expect(archive.error.value).not.toBe("");
    },
  );

  it("refresh rereads the current object and an empty load clears it", async () => {
    listObjectActivities
      .mockResolvedValueOnce(page(["a"]))
      .mockResolvedValueOnce(page(["b"]));
    const archive = useTaskArchive();

    await archive.load(" c1 ");
    await archive.refresh();
    expect(listObjectActivities).toHaveBeenLastCalledWith("c1", {
      pageSize: 25,
    });
    expect(archive.items.value.map((item) => item.id)).toEqual(["b"]);

    await archive.load(" ");
    expect(archive.items.value).toEqual([]);
    expect(archive.asOf.value).toBeNull();
  });
});
