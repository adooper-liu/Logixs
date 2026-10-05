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

  it("已交 NPI 的机会不把历史交接缺口显示为当前待补", () => {
    const handoffId = "11111111-1111-4111-8111-111111111111";
    const item = opportunity(handoffId, "已立项机会");
    item.handoff.pendingFieldCodes = ["channel_code", "category_ref"];
    const wrapper = mount(ProductOpportunityQueue, {
      props: {
        items: [item],
        selectedId: handoffId,
        initiatives: new Map([
          [handoffId, initiative(handoffId, "standard", null, "handed_off")],
        ]),
      },
    });

    expect(wrapper.get(".queue-item").text()).toContain("已立项");
    expect(wrapper.get(".queue-item").text()).not.toContain("待补");
  });

  it("结果态只保留当前立项机会和聚合的历史缺失", () => {
    const handoffId = "11111111-1111-4111-8111-111111111111";
    const item = opportunity(handoffId, "已立项机会");
    item.handoff.pendingFieldCodes = ["channel_code", "category_ref"];
    const wrapper = mount(ProductOpportunityQueue, {
      props: {
        items: [
          item,
          opportunity("22222222-2222-4222-8222-222222222222", "其他机会"),
        ],
        selectedId: handoffId,
        resultMode: true,
        initiatives: new Map([
          [handoffId, initiative(handoffId, "standard", null, "handed_off")],
        ]),
      },
    });

    expect(wrapper.text()).toContain("已立项");
    expect(wrapper.text()).toContain("历史缺失 2 类");
    expect(wrapper.text()).not.toContain("先处理什么");
    expect(wrapper.text()).not.toContain("其他机会");
    expect(wrapper.text()).not.toContain("待补");
    expect(wrapper.findAll(".queue-item")).toHaveLength(1);
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
  currentDestination: ProductInitiativeQueueEntryV1["currentDestination"] = "deferred",
): ProductInitiativeQueueEntryV1 {
  return {
    handoffId,
    outcome: "defer",
    currentDestination,
    queueGroup,
    reconsiderationDate,
    pendingFieldCodes: [],
    updatedAt: "2026-10-04T00:00:00.000Z",
  };
}
