import { describe, expect, it } from "vitest";
import {
  createLiveContainerTableProjection,
} from "../../data/containerTableSample";
import { toLiveContainer } from "../../data/liveWorkspaceProjection";
import {
  defaultDataTableFilter,
  queryDataTableRows,
  resolveDataTableProjection,
} from "./dataTableContract";

const liveProjection = () =>
  createLiveContainerTableProjection([
    toLiveContainer({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    }),
  ]);

describe("defaultDataTableFilter", () => {
  it("没有快筛时默认不过滤", () => {
    const projection = liveProjection();
    expect(defaultDataTableFilter(projection.schema)).toBe("");
    const resolved = resolveDataTableProjection(projection);
    expect(resolved.issues).toEqual([]);
    expect(
      queryDataTableRows({
        rows: resolved.rows,
        columns: resolved.columns,
        query: "",
        filterCode: defaultDataTableFilter(projection.schema),
      }),
    ).toHaveLength(1);
  });

  it("写死 all 且没有 matchAll 会把真实货柜滤空", () => {
    const projection = liveProjection();
    const resolved = resolveDataTableProjection(projection);
    expect(
      queryDataTableRows({
        rows: resolved.rows,
        columns: resolved.columns,
        query: "",
        filterCode: "all",
      }),
    ).toHaveLength(0);
  });
});
