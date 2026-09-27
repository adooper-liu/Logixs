import { describe, expect, it } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { buildNodeTaskQueueGuidance } from "./nodeTaskQueueGuidance";

describe("node task queue guidance", () => {
  it("explains why an unassigned ready task needs attention", () => {
    const guidance = buildNodeTaskQueueGuidance(task(), "清关");

    expect(guidance.attentionReason).toBe("清关任务已进入共享任务池");
    expect(guidance.conditionKind).toBe("next");
    expect(guidance.conditionLabel).toBe("领取后开始处理");
  });

  it("uses server readiness facts to explain an unmet condition", () => {
    const guidance = buildNodeTaskQueueGuidance(
      task({
        readinessState: "waiting_conditions",
        conditionFactRefs: ["customs-release", "terminal-available"],
        nextAction: null,
      }),
      "提柜",
    );

    expect(guidance.attentionReason).toBe("提柜任务正在等待前置条件");
    expect(guidance.conditionKind).toBe("gap");
    expect(guidance.conditionLabel).toBe("2 项前置事实条件尚未满足");
  });

  it("identifies evidence as the missing completion condition", () => {
    const guidance = buildNodeTaskQueueGuidance(
      task({
        completionEligibility: "awaiting_evidence",
        nextAction: {
          ...task().nextAction!,
          actionCode: "work_execution.complete_work_order",
          assignmentState: "assigned",
          assigneeId: "operator-1",
        },
      }),
      "卸柜",
    );

    expect(guidance.attentionReason).toBe("卸柜任务已领取，等待完成");
    expect(guidance.conditionKind).toBe("gap");
    expect(guidance.conditionLabel).toBe("完成凭证尚未补齐");
  });
});

function task(overrides: Partial<NodeTaskDetail> = {}): NodeTaskDetail {
  return {
    id: "task-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "customs_clearance",
    containerId: "container-1",
    taskDefinitionKey: "node-customs_clearance",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: "work-1",
      workOrderDefinitionKey: "customs",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
    ...overrides,
  };
}
