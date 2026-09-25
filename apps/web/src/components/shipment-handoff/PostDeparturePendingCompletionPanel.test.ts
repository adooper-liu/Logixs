import { RouterLinkStub, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PostDeparturePendingCompletionPanel from "./PostDeparturePendingCompletionPanel.vue";
import ShipmentPendingFactsEditor from "./ShipmentPendingFactsEditor.vue";
import ShipmentPendingCargoEditor from "./ShipmentPendingCargoEditor.vue";
import ShipmentPendingDocumentEditor from "./ShipmentPendingDocumentEditor.vue";
import ShipmentPendingSkuBindingEditor from "./ShipmentPendingSkuBindingEditor.vue";
import {
  pendingCompletionItemFixture,
  shipmentPendingDetailFixture,
  shipmentPendingItemFixture,
} from "./shipmentPendingCompletionTestFixture";

describe("PostDeparturePendingCompletionPanel", () => {
  it("shows a persisted task with its facts, gaps and direct action", async () => {
    const item = pendingCompletionItemFixture();
    const wrapper = mount(PostDeparturePendingCompletionPanel, {
      props: {
        items: [item],
        selected: item,
        loading: false,
        error: "",
        savingFacts: false,
        saveError: "",
        saveNotice: "",
        saveResult: null,
        detail: shipmentPendingDetailFixture(),
        loadingDetail: false,
        detailError: "",
        savingCargo: false,
        cargoError: "",
        cargoNotice: "",
        cargoResult: null,
        bindingSkuLineId: "",
        skuBindingError: "",
        skuBindingNotice: "",
        skuBindingResult: null,
        savingDocuments: false,
        documentError: "",
        documentNotice: "",
        documentResult: null,
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.text()).toContain("SHIP-001");
    expect(wrapper.text()).toContain("补充 SKU 装载明细");
    expect(wrapper.text()).toContain("出运运营");
    expect(wrapper.text()).toContain("未设定");
    expect(wrapper.text()).toContain("暂无可靠候选");
    expect(wrapper.text()).toContain("当前不限制流程");
    expect(wrapper.findComponent(ShipmentPendingCargoEditor).exists()).toBe(
      true,
    );
    await wrapper.find(".pending-queue > button").trigger("click");
    expect(wrapper.emitted("select")).toEqual([
      ["55555555-5555-4555-8555-555555555555"],
    ]);
  });

  it("opens the inline editor for a core Shipment gap and forwards partial saves", async () => {
    const item = pendingCompletionItemFixture();
    item.pendingItems = [
      shipmentPendingItemFixture({
        code: "carrier_missing",
        label: "补充船公司",
        subjectType: "shipment",
        subjectRef: item.shipment.id,
        directAction: {
          code: "edit_shipment_facts",
          label: "补录船公司",
        },
      }),
    ];
    item.shipment.carrierCode = null;
    const wrapper = mount(PostDeparturePendingCompletionPanel, {
      props: {
        items: [item],
        selected: item,
        loading: false,
        error: "",
        savingFacts: false,
        saveError: "",
        saveNotice: "",
        saveResult: null,
        detail: shipmentPendingDetailFixture(),
        loadingDetail: false,
        detailError: "",
        savingCargo: false,
        cargoError: "",
        cargoNotice: "",
        cargoResult: null,
        bindingSkuLineId: "",
        skuBindingError: "",
        skuBindingNotice: "",
        skuBindingResult: null,
        savingDocuments: false,
        documentError: "",
        documentNotice: "",
        documentResult: null,
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.findComponent(ShipmentPendingFactsEditor).exists()).toBe(
      true,
    );
    await wrapper.findComponent(ShipmentPendingFactsEditor).vm.$emit("save", {
      carrierCode: "HMM",
      vesselName: "",
      voyageNumber: "",
      originPortCode: "",
      destinationPortCode: "",
      departureLocal: "",
      sourceTimezone: "",
      evidenceRef: "",
    });
    expect(wrapper.emitted("saveFacts")?.[0]?.[0]).toEqual(
      expect.objectContaining({ carrierCode: "HMM" }),
    );
  });

  it("forwards directly entered SKU loading rows", async () => {
    const item = pendingCompletionItemFixture();
    const wrapper = mount(PostDeparturePendingCompletionPanel, {
      props: {
        items: [item],
        selected: item,
        loading: false,
        error: "",
        savingFacts: false,
        saveError: "",
        saveNotice: "",
        saveResult: null,
        detail: shipmentPendingDetailFixture(),
        loadingDetail: false,
        detailError: "",
        savingCargo: false,
        cargoError: "",
        cargoNotice: "",
        cargoResult: null,
        bindingSkuLineId: "",
        skuBindingError: "",
        skuBindingNotice: "",
        skuBindingResult: null,
        savingDocuments: false,
        documentError: "",
        documentNotice: "",
        documentResult: null,
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    const editor = wrapper.getComponent(ShipmentPendingCargoEditor);
    await editor.vm.$emit("save", [
      {
        containerRecordId: "77777777-7777-4777-8777-777777777777",
        productNumber: "SKU-001",
        quantity: "10",
        quantityUnit: "piece",
      },
    ]);

    expect(wrapper.emitted("saveCargo")?.[0]?.[0]).toEqual([
      expect.objectContaining({ productNumber: "SKU-001", quantity: "10" }),
    ]);
  });

  it("opens direct SKU matching and bill-of-lading actions without a placeholder route", async () => {
    const item = pendingCompletionItemFixture();
    item.pendingItems = [
      shipmentPendingItemFixture({
        code: "product_sku_missing",
        label: "匹配 SKU SKU-NEW",
        subjectType: "cargo",
        subjectRef: "88888888-8888-4888-8888-888888888888",
        sourceValue: "SKU-NEW",
        directAction: { code: "bind_product_sku", label: "匹配 SKU" },
      }),
      shipmentPendingItemFixture({
        code: "bill_of_lading_missing",
        label: "补充提单资料",
        subjectType: "document",
        subjectRef: item.shipment.id,
        directAction: {
          code: "add_transport_document",
          label: "补录提单",
        },
      }),
    ];
    const detail = shipmentPendingDetailFixture();
    detail.pendingItems = item.pendingItems;
    detail.cargoLines = [
      {
        id: "88888888-8888-4888-8888-888888888888",
        lineNo: 1,
        productSkuId: null,
        productNumber: "SKU-NEW",
        quantity: "10",
        quantityUnit: "piece",
        packageCount: null,
        packageUnit: null,
        grossWeight: null,
        weightUnit: null,
        volume: null,
        volumeUnit: null,
        replenishmentOrderLineId: null,
        sourceLineId: "source-1",
        version: 1,
      },
    ];
    const wrapper = mount(PostDeparturePendingCompletionPanel, {
      props: {
        items: [item],
        selected: item,
        loading: false,
        error: "",
        savingFacts: false,
        saveError: "",
        saveNotice: "",
        saveResult: null,
        detail,
        loadingDetail: false,
        detailError: "",
        savingCargo: false,
        cargoError: "",
        cargoNotice: "",
        cargoResult: null,
        bindingSkuLineId: "",
        skuBindingError: "",
        skuBindingNotice: "",
        skuBindingResult: null,
        savingDocuments: false,
        documentError: "",
        documentNotice: "",
        documentResult: null,
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(
      wrapper.findComponent(ShipmentPendingSkuBindingEditor).exists(),
    ).toBe(true);
    const billAction = wrapper
      .findAll(".pending-item__heading button")
      .find((button) => button.text().includes("补录提单"));
    await billAction!.trigger("click");
    expect(wrapper.findComponent(ShipmentPendingDocumentEditor).exists()).toBe(
      true,
    );
  });
});
