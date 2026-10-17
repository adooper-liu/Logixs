import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { NodeTaskOutcome } from "../../api/nodeTasks";
import {
  createContainerSeed,
  createTaskSeed,
  type ContainerProjection,
  type TaskItem,
} from "../../data/sample";
import TaskFrozenResultPanel from "./TaskFrozenResultPanel.vue";

const completedContext = (): {
  task: TaskItem;
  container: ContainerProjection;
} => {
  const task = createTaskSeed()[0]!;
  task.status = "completed";
  const container = createContainerSeed().find(
    (candidate) => candidate.containerRecordId === task.containerRecordId,
  )!;
  return { task, container };
};

describe("TaskFrozenResultPanel", () => {
  it("shows the formal frozen outcome and formation time without write controls", () => {
    const { task, container } = completedContext();
    const outcome: NodeTaskOutcome = {
      id: "outcome-1",
      previousState: "in_progress",
      nextState: "completed",
      resultPolicyMode: "all_required_work_orders_completed",
      eventCode: "customs_cleared",
      requiredWorkOrderIds: ["wo-1"],
      completedWorkOrderIds: ["wo-1"],
      evaluatedAt: "2026-10-17T03:04:05.000Z",
    };

    const wrapper = mount(TaskFrozenResultPanel, {
      props: { task, container, outcome },
      global: {
        stubs: { RouterLink: { template: "<a><slot /></a>" } },
      },
    });

    expect(wrapper.get('[data-testid="frozen-outcome"]').text()).toContain(
      "已完成",
    );
    expect(
      wrapper.get(".frozen-result__body time").attributes("datetime"),
    ).toBe(outcome.evaluatedAt);
    expect(wrapper.text()).not.toMatch(
      /领取|完成工单|补证|异常上报|提交|同步中/,
    );
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("states that the formal result is unknown when outcome is absent", () => {
    const { task, container } = completedContext();
    const wrapper = mount(TaskFrozenResultPanel, {
      props: { task, container, outcome: null },
      global: {
        stubs: { RouterLink: { template: "<a><slot /></a>" } },
      },
    });

    expect(wrapper.get('[data-testid="frozen-outcome-missing"]').text()).toBe(
      "尚无正式结果",
    );
    expect(wrapper.text()).toContain("结果形成时间未知");
    expect(wrapper.text()).not.toContain("已入账");
    expect(wrapper.text()).not.toContain("完成结果");
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
