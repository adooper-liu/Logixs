import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DeliveryInstructionPanel from "./DeliveryInstructionPanel.vue";
import type { WarehouseDeliveryInstruction } from "@logix/contracts";

const instruction: WarehouseDeliveryInstruction = {
  instructionId: "22222222-2222-4222-8222-222222222222",
  containerRecordId: "container-a",
  version: 1,
  warehouseLocationId: "44444444-4444-4444-8444-444444444444",
  warehouseCode: "VLS",
  warehouseName: "Madrid",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: "2026-09-21T08:00:00Z",
  appointmentEndAt: "2026-09-21T09:00:00Z",
  appointmentReference: null,
  evidenceRefs: [],
  actorId: "operator",
  reasonCode: "delivery_instruction_confirmed",
  createdAt: "2026-09-21T00:00:00Z",
  duplicate: false,
};
const setup = () =>
  mount(DeliveryInstructionPanel, {
    props: {
      instruction,
      draftIdentity: "container-a",
      saving: false,
      disabled: false,
    },
  });

describe("DeliveryInstructionPanel draft", () => {
  it("preserves dirty form and instance on same-container refresh, resets on another container", async () => {
    const wrapper = setup();
    const name = wrapper.findAll("input")[2]!;
    const element = name.element;
    await name.setValue("Local warehouse draft");
    await wrapper.get("textarea").setValue("POD-local");
    await wrapper.setProps({
      instruction: {
        ...instruction,
        version: 2,
        warehouseName: "Server update",
      },
    });
    expect((name.element as HTMLInputElement).value).toBe(
      "Local warehouse draft",
    );
    expect(wrapper.findAll("input")[2]!.element).toBe(element);
    expect(wrapper.emitted("dirtyChange")?.at(-1)).toEqual([true]);
    await wrapper.setProps({ draftIdentity: "container-b", instruction: null });
    expect((name.element as HTMLInputElement).value).toBe("");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });
  it("hydrates clean authority in its IANA timezone rather than the host timezone", async () => {
    const wrapper = setup();
    expect(
      (
        wrapper.findAll('input[type="datetime-local"]')[0]!
          .element as HTMLInputElement
      ).value,
    ).toBe("2026-09-21T10:00");
    await wrapper.setProps({
      instruction: { ...instruction, warehouseName: "Clean update" },
    });
    expect(
      (wrapper.findAll("input")[2]!.element as HTMLInputElement).value,
    ).toBe("Clean update");
  });
  it("guards the event entry while disabled and reports saved instruction separately from appointment confirmation", async () => {
    const wrapper = setup();
    await wrapper.get("textarea").setValue("evidence");
    await wrapper.setProps({ disabled: true });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("save")).toBeUndefined();
    await wrapper.setProps({ disabled: false, result: instruction });
    expect(wrapper.text()).toContain("指令已保存");
    expect(wrapper.text()).toContain("不代表仓方已确认预约");
  });
});
