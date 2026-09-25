import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ShipmentPendingSkuBindingEditor from "./ShipmentPendingSkuBindingEditor.vue";
import { shipmentPendingDetailFixture } from "./shipmentPendingCompletionTestFixture";

describe("ShipmentPendingSkuBindingEditor", () => {
  it("shows the cargo snapshot and emits a versioned bind action without exposing IDs", async () => {
    const detail = shipmentPendingDetailFixture();
    detail.cargoLines = [
      {
        id: "88888888-8888-4888-8888-888888888888",
        lineNo: 1,
        productSkuId: null,
        productNumber: "SKU-NEW",
        quantity: "12",
        quantityUnit: "piece",
        packageCount: null,
        packageUnit: null,
        grossWeight: null,
        weightUnit: null,
        volume: null,
        volumeUnit: null,
        replenishmentOrderLineId: null,
        sourceLineId: "source-1",
        version: 3,
      },
    ];
    const wrapper = mount(ShipmentPendingSkuBindingEditor, {
      props: {
        detail,
        savingLineId: "",
        error: "",
        notice: "",
        result: null,
      },
    });

    expect(wrapper.text()).toContain("SKU-NEW");
    expect(wrapper.text()).toContain("12 piece");
    expect(wrapper.text()).not.toContain(detail.cargoLines[0]!.id);
    await wrapper.get('button[name="skuBindingAction"]').trigger("click");
    expect(wrapper.emitted("bind")?.[0]?.[0]).toEqual({
      cargoLineId: detail.cargoLines[0]!.id,
      expectedCargoLineVersion: 3,
    });
  });
});
