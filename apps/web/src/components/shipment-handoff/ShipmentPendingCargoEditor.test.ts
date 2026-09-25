import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { shipmentPendingDetailFixture } from "./shipmentPendingCompletionTestFixture";
import ShipmentPendingCargoEditor from "./ShipmentPendingCargoEditor.vue";

describe("ShipmentPendingCargoEditor", () => {
  it("saves a business row with the selected visible container", async () => {
    const wrapper = mount(ShipmentPendingCargoEditor, {
      props: {
        detail: shipmentPendingDetailFixture(),
        saving: false,
        error: "",
        notice: "",
        result: null,
      },
    });

    await wrapper.get('[aria-label="第 1 行 SKU"]').setValue("SKU-001");
    await wrapper.get('[aria-label="第 1 行数量"]').setValue("10");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual([
      {
        containerRecordId: "77777777-7777-4777-8777-777777777777",
        productNumber: "SKU-001",
        quantity: "10",
        quantityUnit: "piece",
      },
    ]);
    expect(wrapper.text()).toContain("MSNU9762671");
  });

  it("allows an empty save so the task remains pending", async () => {
    const wrapper = mount(ShipmentPendingCargoEditor, {
      props: {
        detail: shipmentPendingDetailFixture(),
        saving: false,
        error: "",
        notice: "",
        result: null,
      },
    });

    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("save")).toEqual([[[]]]);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
