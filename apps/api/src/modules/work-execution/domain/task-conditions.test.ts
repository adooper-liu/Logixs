import { describe, expect, it } from "vitest";
import { evaluateTaskConditions } from "./task-conditions";

const facts = [
  {
    id: "fact-customs",
    factCode: "customs_clearance_completed",
    timeKind: "actual" as const,
    captureSource: "controlled_import" as const,
    evidenceRef: "11111111-1111-4111-8111-111111111111",
  },
  {
    id: "fact-empty-plan",
    factCode: "container_empty_estimated",
    timeKind: "estimated" as const,
    captureSource: "system_derived" as const,
    evidenceRef: null,
  },
];

describe("evaluateTaskConditions", () => {
  it("当前节点无需等待未来事实即可开工", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "cargo_ready",
        isCurrent: true,
        facts: [],
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
    });
  });

  it("未来节点默认进入计划池但等待条件", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "warehouse_delivery",
        isCurrent: false,
        facts: [],
      }),
    ).toEqual({
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
    });
  });

  it("已核验实际事实使对应任务可执行且具备完成资格", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "customs_clearance",
        isCurrent: false,
        facts,
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-customs"],
    });
  });

  it("预计事实只能使任务可准备，不能赋予完成资格", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "empty_return",
        isCurrent: false,
        facts,
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: ["fact-empty-plan"],
    });
  });
});
