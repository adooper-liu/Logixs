import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { WarehouseDeliveryInstruction } from "@logix/contracts";
import DeliveryActionPanel from "./DeliveryActionPanel.vue";

const instruction: WarehouseDeliveryInstruction = {
  instructionId: "22222222-2222-4222-8222-222222222222",
  containerRecordId: "container-a",
  version: 1,
  warehouseLocationId: "44444444-4444-4444-8444-444444444444",
  warehouseCode: "VLS",
  warehouseName: "Madrid",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  evidenceRefs: [],
  actorId: "operator",
  reasonCode: "delivery_instruction_confirmed",
  createdAt: "2026-09-21T00:00:00Z",
  duplicate: false,
};
function setup() {
  return mount(DeliveryActionPanel, {
    props: {
      instruction,
      draftIdentity: "container-a",
      disabled: false,
      deliveredFact: null,
      warehouseArrivalFact: null,
      task: null,
      submitting: null,
      taskSubmitting: false,
      results: {},
      error: "",
    },
  });
}
async function fill(wrapper: ReturnType<typeof setup>) {
  await wrapper.get("input").setValue("2026-09-21T10:30");
  await wrapper.get("textarea").setValue("POD-draft");
}
function replace(
  current: WarehouseDeliveryInstruction,
  changes: Partial<WarehouseDeliveryInstruction> = {},
): WarehouseDeliveryInstruction {
  return {
    ...current,
    ...changes,
    instructionId: crypto.randomUUID(),
    version: current.version + 1,
  };
}
describe("DeliveryActionPanel draft semantics", () => {
  it.each([
    {
      appointmentStartAt: "2026-09-22T08:00:00Z",
      appointmentEndAt: "2026-09-22T09:00:00Z",
    },
    { appointmentReference: "corrected-reference" },
    { evidenceRefs: ["55555555-5555-4555-8555-555555555555"] },
  ])(
    "UIPS-SP4-PROF-003 preserves dirty DOM through new-ID equivalent replacement %j",
    async (changes) => {
      const wrapper = setup();
      await fill(wrapper);
      const input = wrapper.get("input").element;
      const textarea = wrapper.get("textarea").element;
      const replacement = replace(instruction, changes);
      expect(replacement.instructionId).not.toBe(instruction.instructionId);
      expect(replacement.version).toBe(2);
      await wrapper.setProps({ instruction: null, disabled: true });
      await wrapper.setProps({
        instruction: replacement,
        disabled: false,
      });
      expect(wrapper.get("input").element).toBe(input);
      expect(wrapper.get("textarea").element).toBe(textarea);
      expect((input as HTMLInputElement).value).toBe("2026-09-21T10:30");
      expect((textarea as HTMLTextAreaElement).value).toBe("POD-draft");
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      await wrapper.get("button.primary").trigger("click");
      expect(wrapper.emitted("submit")?.at(-1)?.[0]).toMatchObject({
        kind: "delivered",
        evidenceInputs: ["POD-draft"],
      });
    },
  );
  it.each([
    { warehouseLocationId: "66666666-6666-4666-8666-666666666666" },
    { timezone: "UTC" },
  ])(
    "requires explicit re-entry after new-ID semantic change %j, including a dirty null gap",
    async (changes) => {
      const wrapper = setup();
      await fill(wrapper);
      await wrapper.setProps({ instruction: null, disabled: true });
      await wrapper.setProps({
        instruction: replace(instruction, changes),
        disabled: false,
      });
      expect(wrapper.text()).toContain("目的仓或时区已变化");
      await wrapper.get("button.primary").trigger("click");
      expect(wrapper.emitted("submit")).toBeUndefined();
      await wrapper.get("[data-recheck-delivery]").trigger("click");
      expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
      expect(
        (wrapper.get("textarea").element as HTMLTextAreaElement).value,
      ).toBe("");
      await fill(wrapper);
      await wrapper.get("button.primary").trigger("click");
      expect(wrapper.emitted("submit")).toHaveLength(1);
    },
  );
  it.each([
    { warehouseLocationId: instruction.warehouseLocationId },
    { timezone: instruction.timezone },
  ])(
    "UIPS-SP4-PROF-001 ends a fully cleared draft and binds new input to current authority %j",
    async (changes) => {
      const wrapper = setup();
      await fill(wrapper);
      await wrapper.get("input").setValue("");
      expect(wrapper.attributes("data-dirty")).toBe("true");
      await wrapper.get("textarea").setValue("");
      expect(wrapper.attributes("data-dirty")).toBe("false");
      const current = replace(instruction, {
        warehouseLocationId: "66666666-6666-4666-8666-666666666666",
        timezone: "UTC",
      });
      await wrapper.setProps({ instruction: current });
      await fill(wrapper);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      await wrapper.get("button.primary").trigger("click");
      expect(wrapper.emitted("submit")).toHaveLength(1);
      await wrapper.setProps({ instruction: null, disabled: true });
      await wrapper.setProps({
        instruction: replace(current, changes),
        disabled: false,
      });
      expect(wrapper.text()).toContain("目的仓或时区已变化");
      await wrapper.get("button.primary").trigger("click");
      expect(wrapper.emitted("submit")).toHaveLength(1);
    },
  );
  it("UIPS-SP4-PROF-002 restores default POD on container switch and clears input on explicit kind switches", async () => {
    const wrapper = setup();
    await fill(wrapper);
    await wrapper.findAll(".segmented button")[1]!.trigger("click");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    await fill(wrapper);
    await wrapper.setProps({ draftIdentity: "container-b", instruction: null });
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    await wrapper.setProps({
      instruction: { ...instruction, containerRecordId: "container-b" },
    });
    expect(wrapper.get(".segmented .active").text()).toBe("POD / 签收");
    await fill(wrapper);
    await wrapper.get("button.primary").trigger("click");
    expect(wrapper.emitted("submit")?.at(-1)?.[0]).toMatchObject({
      kind: "delivered",
    });
    await wrapper.findAll(".segmented button")[1]!.trigger("click");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    await fill(wrapper);
    await wrapper.get("button.primary").trigger("click");
    expect(wrapper.emitted("submit")?.at(-1)?.[0]).toMatchObject({
      kind: "warehouse_arrival",
    });
    await wrapper.findAll(".segmented button")[0]!.trigger("click");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });
  it("guards synthetic submit and task events while disabled", async () => {
    const wrapper = setup();
    await fill(wrapper);
    await wrapper.setProps({ disabled: true });
    await wrapper.get("button.primary").trigger("click");
    expect(wrapper.emitted("submit")).toBeUndefined();
  });
});
