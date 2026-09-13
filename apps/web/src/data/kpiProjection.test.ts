import { describe, expect, it } from "vitest";
import {
  createKpiSignals,
  createWorkspaceOverviewSignals,
} from "./kpiProjection";
import { toLiveContainer } from "./liveWorkspaceProjection";
import { createContainerSeed, createExceptionSeed, feeRows } from "./sample";

const liveRow = (syncCode: string): ReturnType<typeof toLiveContainer> => ({
  ...toLiveContainer({
    id: "c1",
    orderNumber: "SO-1",
    containerNumber: "MSKU1",
    currentStatus: "in_transit",
    updatedAt: "2026-09-13T03:00:00.000Z",
  }),
  syncStatus: {
    code: syncCode,
    label: syncCode,
    tone: "info",
  },
});

describe("createKpiSignals", () => {
  it("derives only the five supported management indicators", () => {
    const signals = createKpiSignals({
      containers: createContainerSeed(),
      fees: feeRows,
      exceptions: createExceptionSeed(),
    });

    expect(signals.map((signal) => signal.key)).toEqual([
      "online",
      "risk",
      "feeExposure",
      "pendingSync",
      "openExceptions",
    ]);
    expect(signals.map((signal) => signal.label)).not.toEqual(
      expect.arrayContaining([
        "全链路时效",
        "单柜总成本",
        "船期准点率",
        "清关一次放行率",
      ]),
    );
    expect(signals.find((signal) => signal.key === "online")).toMatchObject({
      label: "货柜",
      value: "3 柜",
    });
    expect(
      signals.find((signal) => signal.key === "feeExposure"),
    ).toMatchObject({
      value: "76%",
      supportingText: "USD 160.00 / 210.00",
    });
    expect(
      signals.find((signal) => signal.key === "openExceptions")?.value,
    ).toBe("2 项");
  });

  it("counts uncommitted operations and avoids combining currencies", () => {
    const containers = createContainerSeed();
    containers[0].syncStatus.code = "received";
    const signals = createKpiSignals({
      containers,
      fees: [
        { type: "Demurrage", amount: "USD 100.00" },
        { type: "Storage", amount: "EUR 20.00" },
      ],
      exceptions: [],
    });

    expect(signals.find((signal) => signal.key === "pendingSync")?.value).toBe(
      "1 项",
    );
    expect(
      signals.find((signal) => signal.key === "feeExposure"),
    ).toMatchObject({
      value: "—",
      supportingText: "暂无可同币种汇总的金额",
    });
  });

  it("empty live fees and exceptions do not invent exposure", () => {
    const signals = createKpiSignals({
      containers: [],
      fees: [],
      exceptions: [],
    });

    expect(signals.find((signal) => signal.key === "online")).toMatchObject({
      value: "0 柜",
      helpText: "当前租户已经记下的货柜数量。",
    });
    expect(signals.find((signal) => signal.key === "feeExposure")?.value).toBe(
      "—",
    );
    expect(
      signals.find((signal) => signal.key === "openExceptions")?.value,
    ).toBe("0 项");
    expect(
      signals.find((signal) => signal.key === "online")?.helpText,
    ).not.toContain("useDemoOperationsStore");
  });
});

describe("createWorkspaceOverviewSignals", () => {
  it("只展示已有货柜数，不把空费用和空异常当成零", () => {
    const signals = createWorkspaceOverviewSignals([]);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      key: "online",
      value: "0 柜",
    });
    expect(signals.map((signal) => signal.label)).not.toEqual(
      expect.arrayContaining(["待服务器确认数", "高风险货柜数"]),
    );
  });

  it("同步没查到或都已落账时不挂还没记下", () => {
    expect(
      createWorkspaceOverviewSignals([liveRow("pending")], {
        syncReady: false,
      }).map((signal) => signal.key),
    ).toEqual(["online"]);
    expect(
      createWorkspaceOverviewSignals([liveRow("committed")], {
        syncReady: true,
      }).map((signal) => signal.key),
    ).toEqual(["online"]);
    expect(
      createWorkspaceOverviewSignals([liveRow("idle")], {
        syncReady: true,
      }).map((signal) => signal.label),
    ).not.toContain("还没记下");
  });

  it("查到未落账才挂还没记下，并去看提交", () => {
    const signals = createWorkspaceOverviewSignals(
      [liveRow("pending"), liveRow("commit_failed"), liveRow("committed")],
      { syncReady: true },
    );
    expect(signals.map((signal) => signal.key)).toEqual([
      "online",
      "pendingSync",
    ]);
    expect(signals[1]).toMatchObject({
      label: "还没记下",
      value: "2 柜",
      supportingText: "去看提交",
      to: "/real-operations",
    });
    expect(signals[1]?.helpText).not.toContain("全部已落账");
  });
});
