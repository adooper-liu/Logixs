import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import OpsAssistantPanel from "./OpsAssistantPanel.vue";

describe("OpsAssistantPanel", () => {
  it("renders server-projected action and emits questions", async () => {
    const wrapper = mount(OpsAssistantPanel, {
      props: {
        sending: false,
        session: {
          sessionId: "session-1",
          notificationId: null,
          containerId: "container-1",
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
          messages: [],
        },
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain("MSKU1");
    expect(wrapper.text()).toContain("可在任务工作台领取");
    await wrapper
      .get('input[aria-label="给运营助手的问题"]')
      .setValue("下一步是什么？");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("send")?.[0]).toEqual(["下一步是什么？"]);
  });
});
