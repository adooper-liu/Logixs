import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffCargoLinesEditor from "./HandoffCargoLinesEditor.vue";

describe("HandoffCargoLinesEditor", () => {
  it("parses pasted business columns and emits editable SKU loading lines", async () => {
    const wrapper = mount(HandoffCargoLinesEditor, {
      props: {
        candidate: candidate(),
        saving: false,
        error: "",
        result: null,
      },
    });

    await wrapper.get(".editor-actions button").trigger("click");
    await wrapper
      .get("textarea")
      .setValue(
        "备货单号\tSKU\t数量\t单位\n26DSA01884\tSKU-001\t10\t件\n26DSA01885\tSKU-002\t5.5\t箱",
      );
    await wrapper.get(".paste-panel button").trigger("click");
    await wrapper.get(".save-action").trigger("click");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual([
      {
        replenishmentOrderNumber: "26DSA01884",
        productNumber: "SKU-001",
        quantity: "10",
        quantityUnit: "piece",
      },
      {
        replenishmentOrderNumber: "26DSA01885",
        productNumber: "SKU-002",
        quantity: "5.5",
        quantityUnit: "carton",
      },
    ]);
  });

  it("keeps invalid rows in place and identifies the exact row", async () => {
    const wrapper = mount(HandoffCargoLinesEditor, {
      props: {
        candidate: candidate(),
        saving: false,
        error: "",
        result: null,
      },
    });
    await wrapper.get('input[aria-label="第 1 行 SKU"]').setValue("SKU-001");
    await wrapper.get('input[aria-label="第 1 行数量"]').setValue("0");
    await wrapper.get(".save-action").trigger("click");

    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.text()).toContain("第 1 行：数量必须大于 0，最多 3 位小数");
  });
});

function candidate() {
  return {
    candidateRef: "MSNU9762671",
    decision: "review_required" as const,
    containerNumber: "MSNU9762671",
    replenishmentOrderNumbers: ["26DSA01884", "26DSA01885"],
    billNumbers: ["1811F026PE36669R2"],
    issues: [
      {
        code: "CARGO_DETAIL_INCOMPLETE" as const,
        messageKey: "shipment_handoff_cargo_detail_incomplete",
      },
    ],
    correction: {
      correctionId: "44444444-4444-4444-8444-444444444444",
      version: 1,
      shipmentGrouping: {
        kind: "authorized_new_shipment" as const,
        shipmentNumber: "SHIP-2026-0001",
      },
      originPort: {
        portId: "11111111-1111-4111-8111-111111111111",
        unlocode: "CNFZG",
        officialName: "Fuzhou",
        areaCode: "CN",
      },
      destinationPort: {
        portId: "22222222-2222-4222-8222-222222222222",
        unlocode: "USSAV",
        officialName: "Savannah",
        areaCode: "US",
      },
      departureProof: {
        kind: "actual_departure_time" as const,
        occurredAt: "2026-09-22T16:00:00Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "33333333-3333-4333-8333-333333333333",
      },
      reasonCode: "source_fact_confirmed",
      correctedAt: "2026-09-24T01:00:00Z",
    },
  };
}
