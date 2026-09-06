import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  createContainerSeed,
  createTaskSeed,
  type SubmissionView,
} from "../../data/sample";
import TaskExecutionPanel from "./TaskExecutionPanel.vue";

describe("TaskExecutionPanel", () => {
  it("keeps the current work visible and progressively discloses supporting requirements", async () => {
    const task = createTaskSeed().find(
      (candidate) => candidate.taskId === "task_1027",
    );
    const container = createContainerSeed().find(
      (candidate) => candidate.containerRecordId === task?.containerRecordId,
    );
    const submission: SubmissionView = { taskId: "task_1027", stage: "idle" };

    expect(task).toBeDefined();
    expect(container).toBeDefined();

    const wrapper = mount(TaskExecutionPanel, {
      props: {
        task: task!,
        container: container!,
        submission,
        canSubmit: false,
        isSubmitting: false,
      },
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" },
          ElDialog: { template: "<div><slot /><slot name='footer' /></div>" },
        },
      },
    });

    const currentWorkspace = wrapper.get('[data-testid="current-workspace"]');
    expect(currentWorkspace.text()).toContain("完成证据");
    expect(currentWorkspace.text()).toContain("采纳理由");
    expect(currentWorkspace.text()).not.toContain("前置条件");
    expect(currentWorkspace.text()).not.toContain("资料与资源");
    expect(
      wrapper.find('[data-testid="supporting-requirements"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="submission-progress"]').exists()).toBe(
      false,
    );

    const disclosure = wrapper.get('[data-testid="requirements-disclosure"]');
    expect(disclosure.attributes("aria-expanded")).toBe("false");
    await disclosure.trigger("click");

    expect(disclosure.attributes("aria-expanded")).toBe("true");
    const supporting = wrapper.get('[data-testid="supporting-requirements"]');
    expect(supporting.text()).toContain("前置条件");
    expect(supporting.text()).toContain("资料与资源");

    await wrapper.setProps({
      submission: {
        taskId: "task_1027",
        actionCode: "candidate_submit_departure_reconciliation",
        stage: "received",
        clientOperationId: "op_test_1027",
        receivedAt: "10:12:06",
      },
    });
    expect(wrapper.get('[data-testid="submission-progress"]').text()).toContain(
      "服务器已收到",
    );
    expect(wrapper.get('[data-testid="submission-progress"]').text()).toContain(
      "操作记录",
    );
    expect(wrapper.get('[data-testid="submission-progress"]').text()).toContain(
      "提交对账结论",
    );
    expect(
      wrapper.get('[data-testid="submission-progress"]').text(),
    ).not.toContain("op_test_1027");
    expect(
      wrapper.get('[data-testid="submission-progress"]').text(),
    ).not.toContain("candidate_submit_departure_reconciliation");
  });
});
