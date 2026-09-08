import { describe, expect, it } from "vitest";
import { createKpiSignals } from "./kpiProjection";
import { createContainerSeed, createExceptionSeed, feeRows } from "./sample";

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
    expect(signals.find((signal) => signal.key === "online")?.value).toBe(
      "3 柜",
    );
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
});
