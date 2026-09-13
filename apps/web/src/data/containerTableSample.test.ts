import { describe, expect, it } from "vitest";
import { createLiveContainerTableProjection } from "./containerTableSample";
import { toLiveContainer } from "./liveWorkspaceProjection";

describe("createLiveContainerTableProjection", () => {
  it("有待办和同步列，不铺 ETA 和同步状态表头", () => {
    const projection = createLiveContainerTableProjection([
      toLiveContainer({
        id: "c1",
        orderNumber: "SO-1",
        containerNumber: "MSKU1",
        currentStatus: "in_transit",
        updatedAt: "2026-09-13T03:00:00.000Z",
      }),
    ]);

    expect(projection.schema.columns.map((column) => column.code)).toEqual([
      "container",
      "containerStatus",
      "currentStation",
      "openTask",
      "latestSync",
      "open",
    ]);
    expect(
      projection.schema.columns.find((column) => column.code === "latestSync")
        ?.label,
    ).toBe("同步");
    expect(
      projection.schema.columns.find((column) => column.code === "latestSync")
        ?.emptyLabel,
    ).toBe("最近没有提交");
    expect(projection.rows[0]?.values.openTask).toBe("");
    expect(projection.rows[0]?.values.currentStation).toBe("");
    expect(projection.rows[0]?.values.latestSync).toBe("");
    expect(projection.rows[0]?.values).not.toHaveProperty("taskStatus");
    expect(projection.rows[0]?.values).not.toHaveProperty("eta");
    expect(projection.rows[0]?.values).not.toHaveProperty("syncStatus");
  });

  it("任务没拉到时不把空待办假装成查过", () => {
    const projection = createLiveContainerTableProjection(
      [
        toLiveContainer({
          id: "c1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "in_transit",
          updatedAt: "2026-09-13T03:00:00.000Z",
        }),
      ],
      { tasksReady: false },
    );
    expect(projection.rows[0]?.values.openTask).toBe("待办没能加载");
  });

  it("当前站没拉到时不把空站假装成查过", () => {
    const projection = createLiveContainerTableProjection(
      [
        toLiveContainer({
          id: "c1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "in_transit",
          updatedAt: "2026-09-13T03:00:00.000Z",
        }),
      ],
      { stationsReady: false },
    );
    expect(projection.rows[0]?.values.currentStation).toBe("当前站没能加载");
  });

  it("同步没拉到时不把空同步假装成查过", () => {
    const projection = createLiveContainerTableProjection(
      [
        toLiveContainer({
          id: "c1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "in_transit",
          updatedAt: "2026-09-13T03:00:00.000Z",
        }),
      ],
      { syncReady: false },
    );
    expect(projection.rows[0]?.values.latestSync).toBe("同步没能加载");
  });
});
