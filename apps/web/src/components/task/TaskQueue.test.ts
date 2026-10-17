import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TaskQueue from "./TaskQueue.vue";
import { createTaskSeed } from "../../data/sample";

describe("TaskQueue", () => {
  it("keeps actionable ordering and count while exposing completed tasks separately", async () => {
    const tasks = createTaskSeed();
    const firstCompleted = tasks.find((task) => task.taskId === "task_1024")!;
    const secondCompleted = tasks.find((task) => task.taskId === "task_1025")!;
    firstCompleted.status = "completed";
    secondCompleted.status = "completed";

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
      "task_1026",
    ]);
    expect(wrapper.get('[data-testid="actionable-count"]').text()).toBe("2");

    const completed = wrapper.findAll('[data-testid="completed-task"]');
    expect(completed.map((row) => row.attributes("data-task-id"))).toEqual([
      "task_1024",
      "task_1025",
    ]);
    expect(wrapper.get('[data-testid="completed-count"]').text()).toBe("2");
    expect(completed[0]?.attributes("disabled")).toBeUndefined();

    await completed[0]!.trigger("click");
    expect(wrapper.emitted("select")).toEqual([["task_1024"]]);
    const completedGroup = wrapper.get(".completed-zone");
    expect(completedGroup.text()).not.toContain("领取");
    expect(completedGroup.text()).not.toContain("提交");
  });
});
