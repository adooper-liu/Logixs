import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createContainerSeed } from "../../data/sample";
import OperationsFlowMap from "./OperationsFlowMap.vue";

describe("OperationsFlowMap", () => {
  it("keeps every container on its actual lifecycle node", () => {
    const rows = createContainerSeed();
    const wrapper = mount(OperationsFlowMap, {
      props: { rows },
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    expect(wrapper.findAll(".trace-row")).toHaveLength(rows.length);
    expect(wrapper.findAll(".node-cell.occupied")).toHaveLength(rows.length);
    expect(wrapper.findAll(".node-sequence")).toHaveLength(14);
    expect(wrapper.findAll(".node-sequence")[0].text()).toBe("01");
    expect(wrapper.findAll(".node-sequence")[13].text()).toBe("14");
    expect(
      wrapper
        .findAll(".trace-track")
        .every((track) =>
          track.attributes("style")?.includes("--progress-end"),
        ),
    ).toBe(true);
    expect(wrapper.text()).toContain("TCLU-2387642");
    expect(wrapper.text()).toContain("目的港到港");
    expect(wrapper.text()).toContain("TRLU-9912034");
    expect(wrapper.text()).toContain("送仓");
    expect(wrapper.text()).toContain("MSKU-5521087");
    expect(wrapper.text()).toContain("海运在途");
  });

  it("bounds rendered traces while retaining aggregate node counts", () => {
    const seeds = createContainerSeed();
    const rows = Array.from({ length: 8 }, (_, index) => ({
      ...seeds[index % seeds.length],
      containerRecordId: `record-${index}`,
      containerNumber: `CONTAINER-${index}`,
    }));
    const wrapper = mount(OperationsFlowMap, {
      props: { rows },
      global: {
        stubs: {
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    expect(wrapper.findAll(".trace-row")).toHaveLength(6);
    expect(wrapper.text()).toContain("8 柜在线 · 展示 6 个重点");
    expect(
      wrapper
        .findAll(".node-cell.occupied i")
        .reduce((sum, node) => sum + Number(node.text()), 0),
    ).toBe(8);
  });
});
