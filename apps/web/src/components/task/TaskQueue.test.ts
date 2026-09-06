import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TaskQueue from "./TaskQueue.vue";
import { createTaskSeed } from "../../data/sample";

describe("TaskQueue", () => {
  it("shows only actionable work in risk and due-time order", () => {
    const tasks = createTaskSeed();
    tasks.find((task) => task.taskId === "task_1024")!.status = "completed";

    const wrapper = mount(TaskQueue, {
      props: { tasks, activeTaskId: "task_1027", selectionLocked: false },
    });

    const actionable = wrapper.findAll('[data-testid="actionable-task"]');
    expect(
      wrapper.get('[aria-label="待处理任务"]').attributes("aria-label"),
    ).toBe("待处理任务");
    expect(wrapper.get('[aria-label="任务列表"]').attributes("tabindex")).toBe(
      "0",
    );
    expect(actionable.map((row) => row.attributes("data-task-id"))).toEqual([
      "task_1027",
      "task_1025",
      "task_1026",
    ]);
    expect(wrapper.get('[data-testid="actionable-count"]').text()).toBe("3");
    expect(wrapper.text()).not.toContain("发送清关资料并等待受理");
    expect(wrapper.text()).not.toContain("现场人工执行");
  });
});
