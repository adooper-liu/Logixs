import { describe, expect, it } from "vitest";
import {
  getWorkbenchHandoff,
  liveWorkbenchCodes,
  mainWorkbenchChain,
  prototypeWorkbenchCodes,
  supportingWorkbenches,
  workbenchHandoffs,
  workbenchNetwork,
} from "./workbenchNetwork";

describe("workbenchNetwork", () => {
  it("keeps workbench codes and paths unique", () => {
    expect(new Set(workbenchNetwork.map((item) => item.code)).size).toBe(
      workbenchNetwork.length,
    );
    expect(new Set(workbenchNetwork.map((item) => item.path)).size).toBe(
      workbenchNetwork.length,
    );
  });

  it("connects every adjacent main-chain workbench with one explicit handoff", () => {
    const handoffsByCode = new Map(
      workbenchHandoffs.map((handoff) => [handoff.code, handoff]),
    );

    for (let index = 0; index < mainWorkbenchChain.length - 1; index += 1) {
      const current = mainWorkbenchChain[index]!;
      const next = mainWorkbenchChain[index + 1]!;
      const handoff = handoffsByCode.get(current.outboundHandoffCode!);

      expect(handoff).toMatchObject({
        from: current.code,
        to: next.code,
      });
      expect(next.inboundHandoffCode).toBe(handoff?.code);
    }
  });

  it("maps the connected strategy and operational workbenches to their live routes", () => {
    expect(liveWorkbenchCodes).toEqual([
      "market_signals",
      "product_selection",
      "product_npi",
      "master_data",
      "cargo_ready",
      "stuffing",
      "dispatch",
      "customs",
      "pickup",
      "delivery",
      "unloading",
    ]);
    expect(
      workbenchNetwork
        .filter((item) => item.implementation === "live")
        .map((item) => item.path),
    ).toEqual([
      "/workspaces/market-signals",
      "/workspaces/product-selection",
      "/workspaces/product-npi",
      "/workspaces/master-data",
      "/workspaces/cargo-ready",
      "/workspaces/stuffing",
      "/workspaces/dispatch",
      "/workspaces/customs",
      "/workspaces/pickup",
      "/workspaces/delivery",
      "/workspaces/unloading",
    ]);
  });

  it("marks market signals and product selection as live after API integration", () => {
    expect(prototypeWorkbenchCodes).toEqual([]);
    expect(liveWorkbenchCodes).toEqual(
      expect.arrayContaining(["market_signals", "product_selection"]),
    );
  });

  it("allows ordinary gaps to follow the market opportunity handoff", () => {
    expect(getWorkbenchHandoff("market_opportunity")).toMatchObject({
      from: "market_signals",
      to: "product_selection",
      timing: "经营负责人决定交给选品评估时；普通资料缺失随交接继续保留",
      facts: ["信号标题", "已有事实与证据", "经营假设", "机会说明", "待补事项"],
    });
  });

  it("keeps fees and exceptions outside the lifecycle successor chain", () => {
    expect(supportingWorkbenches.map((item) => item.code)).toEqual([
      "charges",
      "exceptions",
    ]);
    expect(supportingWorkbenches.every((item) => item.sequence === null)).toBe(
      true,
    );
  });
});
