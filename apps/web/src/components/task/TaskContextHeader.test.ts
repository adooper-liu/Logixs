import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createContainerSeed, createTaskSeed } from "../../data/sample";
import TaskContextHeader from "./TaskContextHeader.vue";

const mountHeader = (taskId: string) => {
  const task = createTaskSeed().find(
    (candidate) => candidate.taskId === taskId,
  );
  const container = createContainerSeed().find(
    (candidate) => candidate.containerRecordId === task?.containerRecordId,
  );

  expect(task).toBeDefined();
  expect(container).toBeDefined();

  return mount(TaskContextHeader, {
    props: { task: task!, container: container! },
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
      },
    },
  });
};

describe("TaskContextHeader", () => {
  it("makes task progress primary and container progress contextual", () => {
    const wrapper = mountHeader("task_1026");

    expect(wrapper.get('[aria-label="任务状态：待领取"]').text()).toContain(
      "待领取",
    );
    expect(wrapper.get('[aria-label="货柜状态：已提柜"]').text()).toContain(
      "已提柜",
    );
    expect(wrapper.text()).not.toContain("现场人工执行");
    expect(wrapper.text()).not.toContain("本任务无待确认操作");
    expect(wrapper.text()).not.toContain("同步状态");
  });

  it("keeps an execution qualifier only when it changes how work is handled", () => {
    const wrapper = mountHeader("task_1027");

    expect(wrapper.text()).toContain("授权人员复核");
  });
});
