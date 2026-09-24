import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffCandidateDetail from "./HandoffCandidateDetail.vue";

describe("HandoffCandidateDetail", () => {
  it("turns gaps into direct actions without exposing implementation guidance", async () => {
    const wrapper = mount(HandoffCandidateDetail, {
      props: {
        candidate: {
          candidateRef: "MSNU9762671",
          decision: "review_required",
          containerNumber: "MSNU9762671",
          replenishmentOrderNumbers: ["26DSA01884"],
          billNumbers: ["1811F026PE36669R2"],
          originPortRaw: "福州",
          destinationPortRaw: "萨凡纳",
          departureRaw: "2026-09-23 00:00:00",
          issues: [
            issue("SOURCE_RANGE_METADATA_INVALID", "source_range", false),
            issue("UNKNOWN_REFERENCE_CODE", "origin_port_code", false),
            issue("DEPARTURE_PROOF_REQUIRED", "departure_proof", false),
            issue("CARGO_DETAIL_INCOMPLETE", "cargo_allocations", false),
            issue(
              "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
              "shipment_grouping",
              false,
            ),
          ],
        },
      },
    });

    expect(wrapper.text()).toContain("4 项待补");
    expect(wrapper.text()).toContain("确认起运港");
    expect(wrapper.text()).toContain("当前：福州");
    expect(wrapper.text()).toContain("当前：2026-09-23 00:00:00");
    expect(button(wrapper, "确认起运港").exists()).toBe(true);
    expect(button(wrapper, "补离港依据").exists()).toBe(true);
    expect(button(wrapper, "补 SKU 明细").exists()).toBe(true);
    expect(button(wrapper, "确认所属出运").exists()).toBe(true);
    expect(wrapper.text()).toContain("1 项已由系统处理");
    expect(wrapper.text()).not.toContain("怎么处理");
    expect(wrapper.text()).not.toContain("在哪里处理");
    expect(wrapper.text()).not.toContain("谁处理");
    expect(wrapper.text()).not.toContain("origin_port_code");
    expect(wrapper.text()).not.toContain("cargo_allocations");
    expect(
      Array.from(wrapper.get(".candidate-detail").element.children).map(
        (element) => element.className,
      ),
    ).toEqual(["route-block", "fact-section", "action-runway"]);
    expect(
      Array.from(wrapper.get(".route-progress").element.children).map(
        (element) => element.className,
      ),
    ).toEqual(["route-meta", "route-axis"]);
    expect(wrapper.find(".route-overview > .route-meta").exists()).toBe(false);

    await button(wrapper, "确认起运港").trigger("click");
    await button(wrapper, "补 SKU 明细").trigger("click");

    expect(wrapper.emitted("resolve")).toEqual([["origin_port"], ["cargo"]]);
  });
});

function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll("button").find((item) => item.text().includes(label))!;
}

function issue(code: string, fieldCode: string, blocking: boolean) {
  return {
    code: code as never,
    messageKey: `shipment_handoff_${code.toLowerCase()}`,
    fieldCodes: [fieldCode],
    blocking,
    resolutionState:
      code === "SOURCE_RANGE_METADATA_INVALID"
        ? ("system_handled" as const)
        : code === "CARGO_DETAIL_INCOMPLETE"
          ? ("upstream_action_required" as const)
          : ("operator_action_required" as const),
  };
}
