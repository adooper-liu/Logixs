import { mount } from "@vue/test-utils";
import type {
  ProductInitiativeQueueEntryV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import { describe, expect, it } from "vitest";
import ProductOpportunityQueue from "./ProductOpportunityQueue.vue";

describe("ProductOpportunityQueue", () => {
  it("把服务端标记的暂缓到期项放在第一组", () => {
    const dueId = "11111111-1111-4111-8111-111111111111";
    const standardId = "22222222-2222-4222-8222-222222222222";
    const wrapper = mount(ProductOpportunityQueue, {
      props: {
        items: [
          opportunity(standardId, "普通机会"),
          opportunity(dueId, "到期机会"),
        ],
        selectedId: "",
        initiatives: new Map([
          [standardId, initiative(standardId, "standard", null)],
          [dueId, initiative(dueId, "defer_reconsideration_due", "2026-10-04")],
        ]),
      },
    });

    expect(wrapper.findAll(".queue-group").map((node) => node.text())).toEqual([
      "暂缓到期",
      "其他机会",
    ]);
    expect(
      wrapper.findAll(".queue-item strong").map((node) => node.text()),
    ).toEqual(["到期机会", "普通机会"]);
  });
});

function opportunity(handoffId: string, title: string): ProductOpportunityV1 {
  return {
    handoff: {
      handoffId,
      title,
      marketCode: "CA",
      channelCode: "amazon",
      pendingFieldCodes: [],
    },
    intakeState: "accepted",
  } as unknown as ProductOpportunityV1;
}

function initiative(
  handoffId: string,
  queueGroup: ProductInitiativeQueueEntryV1["queueGroup"],
  reconsiderationDate: string | null,
): ProductInitiativeQueueEntryV1 {
  return {
    handoffId,
    outcome: "defer",
    currentDestination: "deferred",
    queueGroup,
    reconsiderationDate,
    pendingFieldCodes: [],
    updatedAt: "2026-10-04T00:00:00.000Z",
  };
}
