import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ObjectActivityTimeline from "./ObjectActivityTimeline.vue";

describe("ObjectActivityTimeline", () => {
  it("展示服务端投影的下一动作并原样发出目标路径", async () => {
    const wrapper = mount(ObjectActivityTimeline, {
      props: {
        items: [
          {
            id: "notification:n1",
            activityCode: "problem_notification_posted",
            sourceType: "ops_notification",
            sourceId: "n1",
            occurredAt: "2026-09-18T08:00:00.000Z",
            recordedAt: "2026-09-18T08:01:00.000Z",
            containerId: "c1",
            taskId: "t1",
            workOrderId: "w1",
            actorId: null,
            nodeCode: null,
            title: "资料缺失",
            detail: "请补提单",
            severity: "warning",
            targetPath: "/tasks?containerId=c1&task=t1",
          },
        ],
        nextActions: [
          {
            actionCode: "work_execution.complete_work_order",
            containerId: "c1",
            taskId: "t1",
            workOrderId: "w1",
            nodeCode: "customs_clearance",
            taskDefinitionKey: "node-customs_clearance",
            workOrderDefinitionKey: "wo-customs-clearance",
            assignmentState: "assigned",
            assigneeId: "operator-1",
            dueAt: "2026-09-19T08:00:00.000Z",
            targetPath: "/tasks?containerId=c1&task=t1",
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("完成工单");
    expect(wrapper.text()).toContain("operator-1");
    expect(wrapper.text()).toContain("资料缺失");
    const buttons = wrapper.findAll("button");
    await buttons[0]!.trigger("click");
    expect(wrapper.emitted("openTarget")?.[0]).toEqual([
      "/tasks?containerId=c1&task=t1",
    ]);
  });
});
