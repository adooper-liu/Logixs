import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ShipmentPendingFactsEditor from "./ShipmentPendingFactsEditor.vue";
import { pendingCompletionItemFixture } from "./shipmentPendingCompletionTestFixture";

describe("ShipmentPendingFactsEditor", () => {
  it("shows current Shipment facts and submits a partial draft without requiring every field", async () => {
    const wrapper = mount(ShipmentPendingFactsEditor, {
      props: {
        selected: pendingCompletionItemFixture(),
        saving: false,
        error: "",
        notice: "",
        result: null,
      },
    });

    const inputs = wrapper.findAll("input");
    expect((inputs[0]!.element as HTMLInputElement).value).toBe("HMM");
    await inputs[1]!.setValue("");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual(
      expect.objectContaining({
        carrierCode: "HMM",
        vesselName: "",
        originPortCode: "CNNGB",
      }),
    );
  });
});
