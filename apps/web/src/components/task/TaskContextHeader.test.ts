import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  createContainerSeed,
  createTaskSeed,
  type SubmissionView,
  type TaskStatusCode,
} from "../../data/sample";
import TaskContextHeader from "./TaskContextHeader.vue";

const mountHeader = (
  taskId: string,
  options: { status?: TaskStatusCode; submission?: SubmissionView } = {},
) => {
  const task = createTaskSeed().find(
    (candidate) => candidate.taskId === taskId,
  );
  const container = createContainerSeed().find(
    (candidate) => candidate.containerRecordId === task?.containerRecordId,
  );

  expect(task).toBeDefined();
  expect(container).toBeDefined();
  if (options.status) task!.status = options.status;

  return mount(TaskContextHeader, {
    props: {
      task: task!,
      container: container!,
      submission: options.submission,
    },
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
    expect(wrapper.get("h2").text()).toBe("确认实际离港时间");
    expect(wrapper.text()).toContain("船司与码头离港记录相差 45 分钟");
    expect(wrapper.text()).toContain(
      "核对两条离港记录，选择采用时间并填写理由。",
    );
    expect(wrapper.text()).toContain("采用时间、来源和理由形成对账结论。");
    expect(wrapper.text()).toContain(
      "如需修正已入账时间，系统新增更正记录并保留原记录。",
    );
  });

  it("shows a committed result instead of pending instructions", () => {
    const wrapper = mountHeader("task_1027", {
      status: "completed",
      submission: {
        taskId: "task_1027",
        stage: "committed",
        resultSummary: "已采用码头离港记录 08-18 15:05，原记录已保留。",
      },
    });

    expect(wrapper.text()).toContain("完成结果");
    expect(wrapper.text()).toContain(
      "已采用码头离港记录 08-18 15:05，原记录已保留。",
    );
    expect(wrapper.text()).not.toContain("下一步");
    expect(wrapper.text()).not.toContain("核对两条离港记录");
  });
});
