import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffAcceptancePanel from "./HandoffAcceptancePanel.vue";

describe("HandoffAcceptancePanel", () => {
  it("presents late-source absorption as supplementing the matched Shipment", async () => {
    const wrapper = mount(HandoffAcceptancePanel, {
      props: {
        candidate: {
          candidateRef: "MSNU9762671",
          decision: "ready",
          containerNumber: "MSNU9762671",
          replenishmentOrderNumbers: [],
          billNumbers: [],
          existingShipmentMatch: {
            shipmentId: "77777777-7777-4777-8777-777777777777",
            shipmentNumber: "SHP-2026-01884",
            expectedRelationshipVersion: 4,
            matchedBy: "container_active_link",
          },
          issues: [],
        },
        accepting: false,
        error: "",
        result: null,
        availableGroupCount: 1,
        acceptingAll: false,
        batchError: "",
        batchResult: null,
      },
    });

    expect(wrapper.text()).toContain("补入已有 Shipment");
    expect(wrapper.text()).toContain("SHP-2026-01884");
    expect(wrapper.findAll("button")[1]?.text()).toContain("补入已有 Shipment");

    await wrapper.setProps({
      result: {
        acceptedCandidateRefs: ["MSNU9762671"],
        handoff: {
          shipmentId: "88888888-8888-4888-8888-888888888888",
          issues: [],
        },
      } as never,
    });
    expect(wrapper.text()).toContain("Shipment SHP-2026-01884");
    expect(wrapper.text()).not.toContain(
      "88888888-8888-4888-8888-888888888888",
    );
  });

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
        availableGroupCount: 1,
        acceptingAll: false,
        batchError: "",
        batchResult: null,
      },
    });

    expect(wrapper.text()).toContain("0 项缺失资料");
    expect(wrapper.get("button").text()).toContain("接管全部可接管项（1 票）");
    expect(wrapper.findAll("button")[1]?.text()).toContain("接管当前 Shipment");
    expect(wrapper.text()).not.toContain("先接管，稍后补齐");
  });
});
