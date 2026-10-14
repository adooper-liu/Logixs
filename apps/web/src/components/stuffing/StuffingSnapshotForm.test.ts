import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StuffingSnapshotForm from "./StuffingSnapshotForm.vue";

const props = {
  containerNumber: "KOCU4960726",
  cargo: {
    containerRecordId: "44444444-4444-4444-8444-444444444444",
    allocationSetId: "55555555-5555-4555-8555-555555555555",
    allocationSetVersion: 2,
    items: [],
  },
  snapshot: null,
  saving: false,
  error: "",
  message: "",
};

describe("StuffingSnapshotForm work-session boundary", () => {
  it("reports local dirty state and can discard back to the hydrated baseline", async () => {
    const wrapper = mount(StuffingSnapshotForm, { props });
    const seal = wrapper.findAll("input")[1]!;

    await seal.setValue("NEW-SEAL");
    expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([true]);

    (wrapper.vm as unknown as { discardLocal(): void }).discardLocal();
    await wrapper.vm.$nextTick();
    expect((seal.element as HTMLInputElement).value).toBe("");
    expect(wrapper.emitted("dirty-change")?.at(-1)).toEqual([false]);
  });
});
