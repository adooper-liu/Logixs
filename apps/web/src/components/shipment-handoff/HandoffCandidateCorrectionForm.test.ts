import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HandoffCandidateCorrectionForm from "./HandoffCandidateCorrectionForm.vue";

describe("HandoffCandidateCorrectionForm", () => {
  it("saves an empty draft and leaves every missing field pending", async () => {
    const wrapper = mount(HandoffCandidateCorrectionForm, {
      props: {
        candidate: { ...candidate(), departureRaw: undefined },
        shipmentOptions: [],
        loadingShipmentOptions: false,
        shipmentOptionsError: "",
        originOptions: [],
        destinationOptions: [],
        searchingOrigin: false,
        searchingDestination: false,
        saving: false,
        error: "",
        focusTarget: "shipment_grouping",
        result: null,
      },
    });

    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      shipmentGrouping: null,
      originPortCode: "",
      destinationPortCode: "",
      departureLocal: "",
      sourceTimezone: "",
      evidenceRef: "",
    });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("prefills the source-local departure date without a timezone shift", () => {
    const wrapper = mount(HandoffCandidateCorrectionForm, {
      props: {
        candidate: { ...candidate(), departureRaw: "9/22/2026 00:00:00" },
        shipmentOptions: [],
        loadingShipmentOptions: false,
        shipmentOptionsError: "",
        originOptions: [],
        destinationOptions: [],
        searchingOrigin: false,
        searchingDestination: false,
        saving: false,
        error: "",
        focusTarget: "departure",
        result: null,
      },
    });

    expect(
      wrapper.get<HTMLInputElement>('input[type="datetime-local"]').element
        .value,
    ).toBe("2026-09-22T00:00");
  });

  it("uses a controlled Shipment choice instead of a free-text identity", async () => {
    const origin = port(
      "11111111-1111-4111-8111-111111111111",
      "CNFZG",
      "Fuzhou",
    );
    const destination = port(
      "22222222-2222-4222-8222-222222222222",
      "USSAV",
      "Savannah",
    );
    const wrapper = mount(HandoffCandidateCorrectionForm, {
      props: {
        candidate: candidate(),
        shipmentOptions: [shipment()],
        loadingShipmentOptions: false,
        shipmentOptionsError: "",
        originOptions: [origin],
        destinationOptions: [destination],
        searchingOrigin: false,
        searchingDestination: false,
        saving: false,
        error: "",
        focusTarget: "origin_port",
        result: null,
      },
    });

    expect(wrapper.find('input[aria-label="出运归组"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("系统建议");
    expect(wrapper.text()).toContain("SHIP-2026-0001");
    expect(wrapper.text()).toContain("CNFZG → USSAV");
    expect(wrapper.find(".port-fields").exists()).toBe(true);
    expect(wrapper.findAll(".port-fields > .port-fieldset")).toHaveLength(2);
    expect(wrapper.find(".departure-fields").exists()).toBe(true);
    expect(wrapper.find(".form-footer").exists()).toBe(true);
    expect(wrapper.find(".save-action").exists()).toBe(true);
    expect(wrapper.find(".cancel-action").exists()).toBe(true);
    await wrapper
      .get('[data-testid="existing-shipment-SHIP-2026-0001"]')
      .trigger("click");
    const optionButtons = wrapper
      .findAll(".port-options button")
      .filter(
        (button) =>
          button.text().includes("CNFZG") || button.text().includes("USSAV"),
      );
    await optionButtons[0]!.trigger("click");
    await optionButtons[1]!.trigger("click");
    await wrapper
      .get('input[type="datetime-local"]')
      .setValue("2026-09-23T00:00");
    await wrapper.get("select").setValue("Asia/Shanghai");
    await wrapper
      .get('input[placeholder="附件链接、船司记录号或来源单据号"]')
      .setValue("船司离港记录 ATD-1");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      shipmentGrouping: {
        kind: "existing_shipment",
        shipmentId: "33333333-3333-4333-8333-333333333333",
        expectedRelationshipVersion: 4,
      },
      originPortCode: "CNFZG",
      destinationPortCode: "USSAV",
      departureLocal: "2026-09-23T00:00",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "船司离港记录 ATD-1",
    });
    expect(wrapper.text()).toContain("无需填写证据 UUID");

    await wrapper.get(".cancel-action").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("allows a new independent Shipment without asking for an internal number", async () => {
    const wrapper = mount(HandoffCandidateCorrectionForm, {
      props: {
        candidate: candidate(),
        shipmentOptions: [],
        loadingShipmentOptions: false,
        shipmentOptionsError: "",
        originOptions: [],
        destinationOptions: [],
        searchingOrigin: false,
        searchingDestination: false,
        saving: false,
        error: "",
        focusTarget: "shipment_grouping",
        result: null,
      },
    });

    expect(wrapper.text()).toContain("新建独立出运");
    expect(wrapper.find('input[placeholder*="SHIP-"]').exists()).toBe(false);
    expect(
      wrapper.findAll('[data-testid="new-independent-shipment"]'),
    ).toHaveLength(1);
    expect(
      wrapper
        .get('[data-testid="new-independent-shipment"]')
        .attributes("aria-pressed"),
    ).toBe("false");
    await wrapper
      .get('[data-testid="new-independent-shipment"]')
      .trigger("click");

    expect(
      wrapper
        .get('[data-testid="new-independent-shipment"]')
        .attributes("aria-pressed"),
    ).toBe("true");
  });
});

function candidate() {
  return {
    candidateRef: "MSNU9762671",
    decision: "review_required" as const,
    containerNumber: "MSNU9762671",
    replenishmentOrderNumbers: ["26DSA01884"],
    billNumbers: ["1811F026PE36669R2"],
    originPortRaw: "福州",
    destinationPortRaw: "萨凡纳",
    departureRaw: "2026-09-23 00:00:00",
    issues: [],
  };
}

function port(portId: string, unlocode: string, officialName: string) {
  return { portId, unlocode, officialName, areaCode: unlocode.slice(0, 2) };
}

function shipment() {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    shipmentNumber: "SHIP-2026-0001",
    transportMode: "ocean",
    carrierCode: "HMM",
    vesselName: "YM WITNESS",
    voyageNumber: "003E",
    originCountryCode: "CN",
    originUnlocode: "CNFZG",
    destinationCountryCode: "US",
    destinationUnlocode: "USSAV",
    salesCountryCode: "US",
    cargoOwnerReferenceId: null,
    cargoOwnerName: "AOSOM LLC",
    atdAt: "2026-09-23T00:00:00.000Z",
    etaAt: "2026-10-20T00:00:00.000Z",
    currentLifecycleStatus: "departed" as const,
    lifecycleVersion: 1,
    relationshipVersion: 4,
    activeContainerCount: 2,
    activeCargoLineCount: 15,
    lifecycleInitializationState: "ready" as const,
    updatedAt: "2026-09-24T00:00:00.000Z",
  };
}
