import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffCandidateQueue from "./HandoffCandidateQueue.vue";

describe("HandoffCandidateQueue", () => {
  it("treats an unspecified business-data gap as pending rather than blocking", () => {
    const wrapper = mount(HandoffCandidateQueue, {
      props: {
        selectedCandidateRef: "MSNU9762671",
        candidates: [
          {
            candidateRef: "MSNU9762671",
            decision: "review_required",
            containerNumber: "MSNU9762671",
            replenishmentOrderNumbers: ["26DSA01884"],
            billNumbers: ["1811F026PE36669R2"],
            issues: [
              {
                code: "UNKNOWN_REFERENCE_CODE",
                messageKey: "shipment_handoff_unknown_reference_code",
                fieldCodes: ["origin_port_code"],
                resolutionState: "operator_action_required",
              },
            ],
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("0 项阻断 · 1 项待补");
  });
});
