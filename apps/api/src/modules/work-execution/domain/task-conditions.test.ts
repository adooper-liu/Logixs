import { describe, expect, it } from "vitest";
import { evaluateTaskConditions } from "./task-conditions";

const facts = [
  {
    id: "fact-customs",
    factCode: "customs_clearance_completed",
    eventCode: "container_customs_completed",
    nodeCode: "customs_clearance" as const,
    timeKind: "actual" as const,
    captureSource: "controlled_import" as const,
    evidenceRef: "11111111-1111-4111-8111-111111111111",
  },
  {
    id: "fact-empty-plan",
    factCode: "container_empty_estimated",
    eventCode: null,
    nodeCode: "empty_return" as const,
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

  it("事实自带节点时按节点匹配，无需影子表", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "container_unloading",
        isCurrent: false,
        facts: [
          {
            id: "fact-unload",
            factCode: "some_import_code",
            eventCode: "unloaded",
            nodeCode: "container_unloading",
            timeKind: "actual",
            captureSource: "controlled_import",
            evidenceRef: "22222222-2222-4222-8222-222222222222",
          },
        ],
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-unload"],
    });
  });

  it("事实无节点时回退到既有影子表", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "customs_clearance",
        isCurrent: false,
        facts: [
          {
            id: "fact-legacy",
            factCode: "customs_clearance_completed",
            eventCode: null,
            nodeCode: null,
            timeKind: "actual",
            captureSource: "controlled_import",
            evidenceRef: "33333333-3333-4333-8333-333333333333",
          },
        ],
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-legacy"],
    });
  });

  it("显式节点与旧事实码冲突时不回退到影子表", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "customs_clearance",
        isCurrent: false,
        facts: [
          {
            id: "fact-explicit",
            factCode: "customs_clearance_completed",
            eventCode: "returned_empty",
            nodeCode: "empty_return",
            timeKind: "actual",
            captureSource: "controlled_import",
            evidenceRef: "44444444-4444-4444-8444-444444444444",
          },
        ],
      }),
    ).toEqual({
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
    });
  });

  it("未知事实码且无节点时保持未匹配", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "container_unloading",
        isCurrent: false,
        facts: [
          {
            id: "fact-unknown",
            factCode: "future_unknown_fact",
            eventCode: null,
            nodeCode: null,
            timeKind: "actual",
            captureSource: "controlled_import",
            evidenceRef: "55555555-5555-4555-8555-555555555555",
          },
        ],
      }),
    ).toEqual({
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
    });
  });

  it("未知事件不借旧事实码回退", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "customs_clearance",
        isCurrent: false,
        facts: [
          {
            id: "fact-unknown-event",
            factCode: "customs_clearance_completed",
            eventCode: "future_unknown_event",
            nodeCode: null,
            timeKind: "actual",
            captureSource: "controlled_import",
            evidenceRef: "66666666-6666-4666-8666-666666666666",
          },
        ],
      }),
    ).toEqual({
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
    });
  });
});
