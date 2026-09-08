import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { raciRows } from "../../data/sample";
import RaciMatrixPanel from "./RaciMatrixPanel.vue";

describe("RaciMatrixPanel", () => {
  it("renders fourteen node rows, eight role columns and node drill-down links", () => {
    const wrapper = mount(RaciMatrixPanel, {
      props: {
        rows: raciRows,
        containerRecordId: "cr_demo",
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

    expect(wrapper.findAll("tbody tr")).toHaveLength(14);
    expect(wrapper.findAll("thead th")).toHaveLength(9);
    expect(wrapper.findAll(".accountable")).toHaveLength(14);
    expect(wrapper.get("tbody a").attributes("href")).toBe(
      "/container/cr_demo?node=ready",
    );
  });
});
