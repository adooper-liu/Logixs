import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createDisplayFieldSet } from "../ui/displayFieldContract";
import { createContainerSeed } from "../../data/sample";
import NodeFactPanel from "./NodeFactPanel.vue";

describe("NodeFactPanel", () => {
  it("makes lifecycle position, facts and the next action directly scannable", () => {
    const record = createContainerSeed()[1];
    const node = record.rail.find((candidate) => candidate.key === "unload");
    expect(node).toBeDefined();

    const wrapper = mount(NodeFactPanel, {
      props: {
        node: node!,
        fieldSet: createDisplayFieldSet(record.nodeDisplaySchema, node!),
        nodeIndex: 10,
        nodeCount: record.rail.length,
        nextActionHint: record.nextActionHint,
        linkedTaskId: "task_1026",
      },
      global: {
        stubs: { RouterLink: { template: "<a><slot /></a>" } },
      },
    });

    expect(wrapper.get('[data-testid="node-position"]').text()).toContain(
      "10 / 14",
    );
    expect(wrapper.get("h2").text()).toBe("卸柜");
    expect(wrapper.get('[aria-label="节点关键事实"]').text()).toContain(
      "计划09-10 09:00",
    );
    expect(wrapper.get('[aria-label="当前下一步"]').text()).toContain(
      "领取卸柜任务并先核对货柜身份",
    );
    expect(wrapper.get('[aria-label="当前下一步"]').text()).toContain(
      "进入关联任务",
    );
  });
});
