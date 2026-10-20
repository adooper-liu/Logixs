import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiGatewayService,
  buildDeterministicOpsAnswer,
} from "./ai-gateway.service";

afterEach(() => vi.unstubAllGlobals());

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

describe("AiGatewayService claim explanation", () => {
  it("accepts only the provider-neutral structured envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            rationale: "Ready and unassigned.",
            impact: "The current actor becomes responsible.",
            warningCodes: ["confirm_required"],
            source: {
              kind: "model",
              modelId: "model-a",
              promptVersion: "claim-v1",
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      new AiGatewayService().explainTaskClaim({
        taskId: "10000000-0000-4000-8000-000000000001",
        workOrderId: "20000000-0000-4000-8000-000000000001",
        taskState: "in_progress",
        workOrderState: "ready",
        assignmentState: "unassigned",
        assigneeId: null,
      }),
    ).resolves.toMatchObject({ kind: "model", modelId: "model-a" });
  });

  it.each([
    ["non-2xx", new Response("unavailable", { status: 503 })],
    ["invalid json", new Response("not-json", { status: 200 })],
    [
      "extra keys",
      new Response(
        JSON.stringify({
          rationale: "Ready.",
          impact: "Responsibility changes.",
          warningCodes: [],
          source: { kind: "rule", modelId: null, promptVersion: null },
          actionCode: "forged",
        }),
        { status: 200 },
      ),
    ],
    [
      "bounds",
      new Response(
        JSON.stringify({
          rationale: "x".repeat(4001),
          impact: "Responsibility changes.",
          warningCodes: [],
          source: { kind: "rule", modelId: null, promptVersion: null },
        }),
        { status: 200 },
      ),
    ],
  ])("rejects %s so application can use fallback", async (_name, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      new AiGatewayService().explainTaskClaim({
        taskId: "10000000-0000-4000-8000-000000000001",
        workOrderId: "20000000-0000-4000-8000-000000000001",
        taskState: "in_progress",
        workOrderState: "ready",
        assignmentState: "unassigned",
        assigneeId: null,
      }),
    ).rejects.toThrow();
  });
});
