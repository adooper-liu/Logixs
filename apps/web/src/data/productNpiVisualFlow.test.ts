import { describe, expect, it } from "vitest";
import {
  currentRailStage,
  npiCompleteness,
  npiCompletenessLabel,
  railStageState,
} from "./productNpiVisualFlow";

describe("productNpiVisualFlow", () => {
  it("齐/半/缺按结论与依据离散判定", () => {
    expect(npiCompleteness(null)).toBe("missing");
    expect(npiCompleteness({ conclusion: "功能过关", evidenceRefs: [] })).toBe(
      "partial",
    );
    expect(
      npiCompleteness({
        conclusion: "",
        evidenceRefs: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).toBe("partial");
    expect(
      npiCompleteness({
        conclusion: "功能过关",
        evidenceRefs: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).toBe("complete");
    expect(npiCompletenessLabel("complete")).toBe("齐");
  });

  it("未领取落在概念；领取后落在定义阶段", () => {
    expect(currentRailStage(null, false)).toBe("concept");
    expect(currentRailStage("dvt", true)).toBe("dvt");
    expect(railStageState("evt", "dvt")).toBe("done");
    expect(railStageState("dvt", "dvt")).toBe("current");
    expect(railStageState("mp", "dvt")).toBe("upcoming");
  });
});
