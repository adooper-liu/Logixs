import { RouterLinkStub, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffBatchAcceptanceReceipt from "./HandoffBatchAcceptanceReceipt.vue";

describe("HandoffBatchAcceptanceReceipt", () => {
  it("shows per-Shipment outcomes, trace ids and executable recovery actions", async () => {
    const wrapper = mount(HandoffBatchAcceptanceReceipt, {
      props: {
        result: {
          contractVersion: "post-departure-source-package-accept-result.v1",
          packageId: "a".repeat(64),
          items: [
            {
              candidateRefs: ["CONT-A"],
              status: "accepted",
              shipmentId: "55555555-5555-4555-8555-555555555555",
              errorCode: null,
              traceId: "trace-accepted",
              recoveryAction: "open_shipment",
            },
            {
              candidateRefs: ["CONT-B"],
              status: "rejected",
              shipmentId: null,
              errorCode: "SOURCE_CANDIDATE_REJECTED",
              traceId: "trace-rejected",
              recoveryAction: "review_candidate",
            },
            {
              candidateRefs: ["CONT-C"],
              status: "failed",
              shipmentId: null,
              errorCode: "SOURCE_PACKAGE_GROUP_ACCEPT_FAILED",
              traceId: "trace-failed",
              recoveryAction: "retry_package",
            },
          ],
          totals: {
            groups: 3,
            accepted: 1,
            duplicate: 0,
            conflict: 0,
            rejected: 1,
            failed: 1,
          },
        },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.text()).toContain("业务拒绝");
    expect(wrapper.text()).toContain("trace-rejected");
    expect(wrapper.getComponent(RouterLinkStub).props("to")).toContain(
      "shipmentId=55555555-5555-4555-8555-555555555555",
    );

    await wrapper.get('[data-action="review-candidate"]').trigger("click");
    expect(wrapper.emitted("reviewCandidate")).toEqual([["CONT-B"]]);
    await wrapper.get('[data-action="retry-package"]').trigger("click");
    expect(wrapper.emitted("retryPackage")).toEqual([[]]);
  });
});
