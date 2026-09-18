import { describe, expect, it } from "vitest";
import { buildDeterministicOpsAnswer } from "./ai-gateway.service";

describe("buildDeterministicOpsAnswer", () => {
  it("includes notification context when present", () => {
    const answer = buildDeterministicOpsAnswer({
      question: "怎么办？",
      notificationContext: "outbox_dead_letter: 死信",
      objectContext: null,
      history: [],
    });
    expect(answer).toContain("outbox_dead_letter");
    expect(answer).toContain("怎么办？");
    expect(answer).toContain("不能领取、提交或改变业务状态");
  });

  it("includes server-projected object summary and allowed actions", () => {
    const answer = buildDeterministicOpsAnswer({
      question: "下一步是什么？",
      notificationContext: null,
      objectContext: {
        summary: {
          containerId: "container-1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "in_transit",
          currentNodeCode: "customs_clearance",
          flowState: "active",
          updatedAt: "2026-09-18T01:00:00.000Z",
        },
        allowedActions: [
          {
            actionCode: "work_execution.claim_work_order",
            explanation: "可在任务工作台领取。",
            containerId: "container-1",
            taskId: "task-1",
            workOrderId: "work-order-1",
            nodeCode: "customs_clearance",
            assigneeId: null,
            dueAt: null,
            actorCanExecute: true,
            targetPath: "/tasks?containerId=container-1&task=task-1",
          },
        ],
        actionSummary: "当前有 1 个下一动作。",
        readOnlyPolicy: {
          assistantCanExecute: false,
          actorCanExecuteActions: true,
          explanation: "助手只解释现状。",
        },
      },
      history: [],
    });
    expect(answer).toContain("MSKU1");
    expect(answer).toContain("customs_clearance");
    expect(answer).toContain("可在任务工作台领取");
  });
});
