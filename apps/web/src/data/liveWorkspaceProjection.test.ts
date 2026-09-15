import { describe, expect, it } from "vitest";
import {
  attachCurrentNodes,
  attachLiveNodes,
  attachOpenTasks,
  LIVE_TASK_DEFINITION_KEY,
  parseClaimActionCode,
  parseCompleteActionCode,
  toLiveContainer,
  toLiveTask,
} from "./liveWorkspaceProjection";

const container = {
  id: "c1",
  orderNumber: "PO-1",
  containerNumber: "MSCU1",
  currentStatus: "in_transit" as const,
  updatedAt: "2026-09-13T03:00:00.000Z",
};

const detail = {
  id: "t1",
  flowInstanceId: "f1",
  nodeInstanceId: "n1",
  nodeCode: "customs_clearance",
  containerId: "c1",
  taskDefinitionKey: "node-customs_clearance",
  state: "pending",
  workOrders: [
    {
      id: "w1",
      workOrderDefinitionKey: "wo-customs",
      state: "ready",
      assignmentState: "unassigned",
      assigneeId: null,
      completedAt: null,
    },
  ],
  outcome: null,
};

describe("liveWorkspaceProjection", () => {
  it("货柜只填 API 已有列，空字段不编造 ETA/提单", () => {
    const row = toLiveContainer(container);
    expect(row.containerRecordId).toBe("c1");
    expect(row.currentStatus.label).toBe("在途");
    expect(row.billOfLading).toBe("");
    expect(row.eta).toBe("");
    expect(row.rail).toEqual([]);
    expect(row.currentNode).toBe("");
    expect(row.taskStatus.label).toBe("");
    expect(row.syncStatus.label).toBe("");
  });

  it("只把未完成任务挂到对应货柜，不把已完成当成待办", () => {
    const rows = attachOpenTasks(
      [toLiveContainer(container)],
      [
        { ...detail, state: "completed", workOrders: [] },
        {
          ...detail,
          id: "t2",
          nodeCode: "container_stuffing",
          state: "pending",
        },
      ],
    );
    expect(rows[0]?.taskStatus.label).toBe("装箱完成 · 进行中");
    expect(rows[0]?.taskStatus.code).toBe("in_progress");
    expect(
      attachOpenTasks([toLiveContainer(container)], []).map(
        (row) => row.taskStatus.code,
      ),
    ).toEqual(["idle"]);
  });

  it("只把已有流程的当前站挂上，不把八态当成站点", () => {
    const rows = attachCurrentNodes(
      [toLiveContainer(container)],
      [{ containerId: "c1", currentNodeCode: "shipment_dispatch" }],
    );
    expect(rows[0]?.currentNode).toBe("出运");
    expect(
      attachCurrentNodes([toLiveContainer(container)], [])[0]?.currentNode,
    ).toBe("");
  });

  it("只把已落库节点挂成迷你轨，不补空站", () => {
    const rows = attachLiveNodes(
      [toLiveContainer(container)],
      [
        {
          containerId: "c1",
          nodes: [
            {
              nodeInstanceId: "n1",
              nodeCode: "cargo_ready",
              sequence: 1,
              state: "completed",
              applicability: "required",
              completedAt: "2026-09-01T00:00:00.000Z",
              isCurrent: false,
            },
            {
              nodeInstanceId: "n2",
              nodeCode: "shipment_dispatch",
              sequence: 3,
              state: "active",
              applicability: "required",
              completedAt: null,
              isCurrent: true,
            },
          ],
        },
      ],
    );
    expect(rows[0]?.rail.map((node) => node.name)).toEqual(["备货", "出运"]);
    expect(rows[0]?.rail[1]?.isCurrentStatus).toBe(true);
    expect(
      rows[0]?.rail.every((node) => !node.planned && !node.estimated),
    ).toBe(true);
    expect(attachLiveNodes([toLiveContainer(container)], [])[0]?.rail).toEqual(
      [],
    );
  });

  it("可领工单只出领取，不出现完成工单", () => {
    const task = toLiveTask(detail, container);
    expect(task.taskDefinitionKey).toBe(LIVE_TASK_DEFINITION_KEY);
    expect(task.nodeName).toBe("清关");
    expect(task.status).toBe("in_progress");
    expect(task.dueAt).toBe("");
    expect(task.preconditions).toEqual([]);
    expect(task.assignment.mode).toBe("pool");
    expect(task.assignment.assignee).toBeUndefined();
    expect(task.actions).toEqual([
      expect.objectContaining({
        actionCode: "work_execution.claim_work_order:w1",
        intent: "claim",
        label: "领取",
      }),
    ]);
    expect(parseClaimActionCode(task.actions[0]!.actionCode)).toBe("w1");
    expect(task.evidenceRequirements).toEqual([]);
  });

  it("自己已领才出完成工单", () => {
    const task = toLiveTask(
      {
        ...detail,
        workOrders: [
          {
            ...detail.workOrders[0]!,
            assignmentState: "assigned",
            assigneeId: "dev-operator",
          },
        ],
      },
      container,
    );
    expect(task.assignment.mode).toBe("assigned");
    expect(task.assignment.assignee).toBe("dev-operator");
    expect(task.actions[0]?.actionCode).toBe(
      "work_execution.complete_work_order:w1",
    );
    expect(parseCompleteActionCode(task.actions[0]!.actionCode)).toBe("w1");
    expect(task.actions.every((action) => action.intent !== "claim")).toBe(
      true,
    );
    expect(task.evidenceRequirements).toEqual([
      expect.objectContaining({
        required: false,
        kind: "scan",
        label: "单证编号（可选）",
      }),
    ]);
  });

  it("装箱已领后单证为必填", () => {
    const task = toLiveTask(
      {
        ...detail,
        nodeCode: "container_stuffing",
        workOrders: [
          {
            ...detail.workOrders[0]!,
            assignmentState: "assigned",
            assigneeId: "dev-operator",
          },
        ],
      },
      container,
    );
    expect(task.evidenceRequirements).toEqual([
      expect.objectContaining({
        required: true,
        kind: "scan",
        label: "单证编号",
      }),
    ]);
  });
});
