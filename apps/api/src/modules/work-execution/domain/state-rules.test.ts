import { describe, expect, it } from "vitest";
import {
  aggregateNodeTaskState,
  decideNodeTaskTransition,
  decideWorkOrderCompletion,
} from "./state-rules";

describe("decideWorkOrderCompletion", () => {
  it("ready 可以完成", () => {
    expect(decideWorkOrderCompletion("ready")).toEqual({
      kind: "apply",
      next: "completed",
    });
  });

  it("已完成重放不改写", () => {
    expect(decideWorkOrderCompletion("completed")).toEqual({
      kind: "already_done",
    });
  });

  it("cancelled 不能完成", () => {
    expect(decideWorkOrderCompletion("cancelled")).toEqual({
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "工单状态 cancelled 不能完成",
    });
  });
});

describe("aggregateNodeTaskState", () => {
  it("单张 required 完成后任务完成", () => {
    expect(
      aggregateNodeTaskState([
        { state: "completed", applicability: "required" },
      ]),
    ).toBe("completed");
  });

  it("多张 required 只完成部分时保持 in_progress", () => {
    expect(
      aggregateNodeTaskState([
        { state: "completed", applicability: "required" },
        { state: "ready", applicability: "required" },
      ]),
    ).toBe("in_progress");
  });

  it("optional 未完成不阻止聚合", () => {
    expect(
      aggregateNodeTaskState([
        { state: "completed", applicability: "required" },
        { state: "ready", applicability: "optional" },
      ]),
    ).toBe("completed");
  });

  it("required 工单 failed/cancelled 时任务不得完成", () => {
    expect(
      aggregateNodeTaskState([
        { state: "completed", applicability: "required" },
        { state: "failed", applicability: "required" },
      ]),
    ).toBe("blocked");
    expect(
      aggregateNodeTaskState([
        { state: "cancelled", applicability: "required" },
      ]),
    ).toBe("blocked");
  });

  it("全部仍是 draft/ready 时任务保持 pending", () => {
    expect(
      aggregateNodeTaskState([{ state: "ready", applicability: "required" }]),
    ).toBe("pending");
  });
});

describe("decideNodeTaskTransition", () => {
  it("pending → completed 由聚合器允许", () => {
    expect(decideNodeTaskTransition("pending", "completed")).toEqual({
      kind: "apply",
      next: "completed",
    });
  });

  it("已取消的任务保持 cancelled，不因工单迟到完成而复活", () => {
    expect(decideNodeTaskTransition("cancelled", "completed")).toEqual({
      kind: "already_done",
    });
  });

  it("completed 不能直接回到 in_progress", () => {
    expect(decideNodeTaskTransition("completed", "in_progress")).toEqual({
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "任务状态 completed 不能转到 in_progress",
    });
  });
});
