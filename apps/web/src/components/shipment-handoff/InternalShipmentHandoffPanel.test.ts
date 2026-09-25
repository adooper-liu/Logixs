import { RouterLinkStub, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { InternalShipmentHandoffCandidateV1 } from "../../api/shipments";
import InternalShipmentHandoffPanel from "./InternalShipmentHandoffPanel.vue";

const candidateRef = `internal:${"a".repeat(64)}`;

describe("InternalShipmentHandoffPanel", () => {
  it("offers one batch primary action while keeping per-Shipment exception handling", async () => {
    const wrapper = mount(InternalShipmentHandoffPanel, {
      props: {
        candidates: [candidate()],
        loading: false,
        acceptingRef: "",
        acceptingAll: false,
        batchResult: null,
        error: "",
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.text()).toContain("接管全部 1 票");
    expect(wrapper.text()).toContain("接管 Shipment");

    const buttons = wrapper.findAll("button");
    await buttons
      .find((button) => button.text().includes("接管全部"))!
      .trigger("click");
    expect(wrapper.emitted("acceptAll")).toEqual([[]]);

    await buttons
      .find((button) => button.text().includes("接管 Shipment"))!
      .trigger("click");
    expect(wrapper.emitted("accept")).toEqual([[candidateRef]]);
  });

  it("shows every outcome from a partially successful batch", () => {
    const wrapper = mount(InternalShipmentHandoffPanel, {
      props: {
        candidates: [candidate()],
        loading: false,
        acceptingRef: "",
        acceptingAll: false,
        error: "",
        batchResult: {
          contractVersion: "internal-shipment-handoff-batch-accept-result.v1",
          items: [
            {
              candidateRefs: [candidateRef],
              status: "accepted",
              shipmentId: "11111111-1111-4111-8111-111111111111",
              errorCode: null,
              traceId: "trace-accepted",
              recoveryAction: "open_shipment",
            },
            {
              candidateRefs: [`internal:${"b".repeat(64)}`],
              status: "conflict",
              shipmentId: null,
              errorCode: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
              traceId: "trace-conflict",
              recoveryAction: "review_candidate",
            },
          ],
          totals: {
            groups: 2,
            accepted: 1,
            duplicate: 0,
            conflict: 1,
            rejected: 0,
            failed: 0,
          },
        },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.text()).toContain("1 票新接管");
    expect(wrapper.text()).toContain("1 票冲突");
    expect(wrapper.text()).toContain("trace-accepted");
    expect(wrapper.text()).toContain("trace-conflict");
  });
});

function candidate(): InternalShipmentHandoffCandidateV1 {
  return {
    candidateRef,
    bookingNumber: "BK-001",
    carrierCode: "HMM",
    vesselName: "ONE INNOVATION",
    voyageNumber: "001E",
    originPortCode: "CNSHA",
    destinationPortCode: "USLAX",
    departedAt: "2026-09-24T00:00:00.000Z",
    departureSourceTimezone: "Asia/Shanghai",
    departureEvidenceRef: null,
    containers: [
      {
        containerRecordId: "11111111-1111-4111-8111-111111111111",
        containerNumber: "HMMU4956442",
        containerTypeCode: "40HQ",
        stuffingSnapshotRef: "22222222-2222-4222-8222-222222222222",
      },
    ],
    replenishmentOrders: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        orderNumber: "26DSC01812",
      },
    ],
    cargoLines: [],
    transportDocuments: [],
    pendingItems: [],
  };
}
