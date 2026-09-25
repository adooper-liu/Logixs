import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ShipmentPendingDocumentEditor from "./ShipmentPendingDocumentEditor.vue";
import { shipmentPendingDetailFixture } from "./shipmentPendingCompletionTestFixture";

describe("ShipmentPendingDocumentEditor", () => {
  it("allows an empty save to remain pending instead of blocking the operator", async () => {
    const wrapper = mount(ShipmentPendingDocumentEditor, {
      props: {
        detail: shipmentPendingDetailFixture(),
        saving: false,
        error: "",
        notice: "",
        result: null,
      },
    });

    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual([]);
  });

  it("uses visible container numbers and emits the selected document scope", async () => {
    const detail = shipmentPendingDetailFixture();
    const wrapper = mount(ShipmentPendingDocumentEditor, {
      props: {
        detail,
        saving: false,
        error: "",
        notice: "",
        result: null,
      },
    });

    expect(wrapper.text()).toContain("MSNU9762671");
    expect(wrapper.text()).not.toContain(
      detail.containers[0]!.containerRecordId,
    );
    await wrapper.get('select[name="documentType"]').setValue("mbl");
    await wrapper.get('input[name="documentNumber"]').setValue("NBOZ9FF56400");
    await wrapper.get('input[name="documentScac"]').setValue("HMMU");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual([
      {
        documentType: "mbl",
        documentNumber: "NBOZ9FF56400",
        scac: "HMMU",
        containerRecordIds: [detail.containers[0]!.containerRecordId],
      },
    ]);
  });
});
