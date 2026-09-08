import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createKpiSignals } from "../../data/kpiProjection";
import {
  createContainerSeed,
  createExceptionSeed,
  feeRows,
} from "../../data/sample";
import KpiSignalStrip from "./KpiSignalStrip.vue";

describe("KpiSignalStrip", () => {
  it("renders five navigable signals with a source tooltip", async () => {
    const wrapper = mount(KpiSignalStrip, {
      props: {
        items: createKpiSignals({
          containers: createContainerSeed(),
          fees: feeRows,
          exceptions: createExceptionSeed(),
        }),
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

    expect(wrapper.findAll(".kpi-signal")).toHaveLength(5);
    expect(wrapper.find("[data-visual-bar]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("船期准点率");

    await wrapper
      .get('[aria-label="查看滞箱滞港费用占比口径"]')
      .trigger("click");
    expect(
      document.body.querySelector('[role="tooltip"]')?.textContent,
    ).toContain("Demurrage 与 Detention");
  });
});
