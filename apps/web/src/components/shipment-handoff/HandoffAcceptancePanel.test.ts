import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffAcceptancePanel from "./HandoffAcceptancePanel.vue";

describe("HandoffAcceptancePanel", () => {
  it("does not present a system-handled source note as missing business data", () => {
    const wrapper = mount(HandoffAcceptancePanel, {
      props: {
        candidate: {
          candidateRef: "MSNU9762671",
          decision: "ready",
          containerNumber: "MSNU9762671",
          replenishmentOrderNumbers: ["26DSA01884"],
          billNumbers: ["1811F026PE36669R2"],
          issues: [
            {
              code: "SOURCE_RANGE_METADATA_INVALID",
              messageKey: "shipment_handoff_source_range_metadata_invalid",
              blocking: false,
              resolutionState: "system_handled",
            },
          ],
        },
        accepting: false,
        error: "",
        result: null,
      },
    });

    expect(wrapper.text()).toContain("0 项缺失资料");
    expect(wrapper.get("button").text()).toContain("接管当前 Shipment");
    expect(wrapper.text()).not.toContain("先接管，稍后补齐");
  });
});
