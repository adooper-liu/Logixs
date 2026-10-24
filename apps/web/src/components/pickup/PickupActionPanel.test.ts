import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { LifecycleDateFact } from "../../api/lifecycleDateFacts";
import PickupActionPanel from "./PickupActionPanel.vue";

function fact(unlocode = "USLAX"): LifecycleDateFact {
  return {
    factId: "available-1",
    nodeCode: "container_pickup",
    eventCode: "available",
    timeKind: "actual",
    occurredAt: "2026-09-21T16:00:00Z",
    rawValue: "2026-09-21T09:00",
    sourceUtcOffset: "-07:00",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix.manual",
    authoritySystem: "terminal-operator",
    verificationState: "pending",
    confidenceState: "unknown",
    validity: "effective",
    authorityPolicyRef: null,
    location: {
      locationType: "terminal",
      unlocode,
      timezone: "America/Los_Angeles",
    },
    evidenceRefs: [],
    applicationState: "review_required",
    applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
    canonicalEventId: null,
    projectionVersion: 1,
    recordedAt: "2026-09-21T16:00:00Z",
  };
}

function setup() {
  return mount(PickupActionPanel, {
    props: {
      draftIdentity: "container-a",
      availableFact: fact(),
      gateOutFact: null,
      task: null,
      submitting: null,
      error: "",
      results: {},
      taskSubmitting: false,
    },
  });
}

describe("PickupActionPanel professional drafts", () => {
  it("renders the shared receipt with its original action label and guards retry while disabled", async () => {
    const wrapper = setup();
    await wrapper.setProps({
      submission: {
        taskId: "task-a",
        actionCode: "work_execution.claim_work_order",
        clientOperationId: "op-a",
        stage: "rejected",
        message: "network failed",
        canRetry: true,
      },
    });
    expect(wrapper.get('[aria-label="本次操作记录"]').text()).toContain(
      "领取提柜任务",
    );
    await wrapper.get("button.retry").trigger("click");
    expect(wrapper.emitted("retryTask")).toHaveLength(1);
    await wrapper.setProps({ disabled: true });
    await wrapper.get("button.retry").trigger("click");
    expect(wrapper.emitted("retryTask")).toHaveLength(1);
    wrapper.unmount();
  });
  it("keeps dirty location, both dates/evidence and the form instance on non-null fact reload", async () => {
    const wrapper = setup();
    const fields = wrapper.findAll("input, textarea, select");
    const values = [
      "port",
      "USNYC",
      "11111111-1111-4111-8111-111111111111",
      "America/New_York",
      "call-draft",
      "2026-09-21T09:00",
      "available-draft",
      "2026-09-21T10:00",
      "gate-draft",
    ];
    for (const [i, field] of fields.entries()) await field.setValue(values[i]);
    const instance = wrapper.vm.$;
    const elements = fields.map((field) => field.element);
    await wrapper.setProps({
      availableFact: fact("CNSHA"),
      gateOutFact: { ...fact("CNNGB"), eventCode: "gate_out" },
    });
    expect(wrapper.vm.$).toBe(instance);
    wrapper
      .findAll("input, textarea, select")
      .forEach((field, index) => expect(field.element).toBe(elements[index]));
    expect(
      fields.map((field) => (field.element as HTMLInputElement).value),
    ).toEqual(values);
    expect(wrapper.emitted("dirtyChange")?.at(-1)).toEqual([true]);
    wrapper.unmount();
  });

  it("accepts changed authoritative location while clean and resets every draft on identity change", async () => {
    const wrapper = setup();
    expect(wrapper.emitted("dirtyChange")?.at(-1)).toEqual([false]);
    await wrapper.setProps({ availableFact: fact("CNSHA") });
    expect(
      (wrapper.findAll("input")[0]!.element as HTMLInputElement).value,
    ).toBe("CNSHA");
    for (const field of wrapper.findAll("textarea"))
      await field.setValue("old A input");
    for (const field of wrapper.findAll('input[type="datetime-local"]'))
      await field.setValue("2026-09-21T10:00");
    await wrapper
      .findAll("input")[1]!
      .setValue("11111111-1111-4111-8111-111111111111");
    await wrapper.findAll("input")[3]!.setValue("old-port-call");
    await wrapper.setProps({
      draftIdentity: "container-b",
      availableFact: fact("CNNGB"),
    });
    expect(
      (wrapper.findAll("input")[0]!.element as HTMLInputElement).value,
    ).toBe("CNNGB");
    expect(
      (wrapper.findAll("input")[1]!.element as HTMLInputElement).value,
    ).toBe("");
    expect(
      (wrapper.findAll("input")[3]!.element as HTMLInputElement).value,
    ).toBe("");
    expect(
      wrapper
        .findAll("textarea")
        .map((field) => (field.element as HTMLTextAreaElement).value),
    ).toEqual(["", ""]);
    expect(
      wrapper
        .findAll('input[type="datetime-local"]')
        .every((field) => !(field.element as HTMLInputElement).value),
    ).toBe(true);
    expect(wrapper.emitted("dirtyChange")?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });

  it("blocks submission while the consumer is not ready", async () => {
    const wrapper = setup();
    await wrapper
      .findAll('input[type="datetime-local"]')[0]!
      .setValue("2026-09-21T09:00");
    await wrapper.findAll("textarea")[0]!.setValue("evidence");
    await wrapper.setProps({ disabled: true });
    await wrapper.get('[aria-label="码头可提事实"] button').trigger("click");
    expect(wrapper.emitted("submit")).toBeUndefined();
    wrapper.unmount();
  });

  it("does not hydrate a new identity from the prior identity's unchanged fact props", async () => {
    const wrapper = setup();
    await wrapper.findAll("input")[0]!.setValue("USNYC");
    await wrapper.setProps({ draftIdentity: "container-b" });
    expect(
      (wrapper.findAll("input")[0]!.element as HTMLInputElement).value,
    ).toBe("");
    await wrapper.setProps({ availableFact: fact("CNNGB") });
    expect(
      (wrapper.findAll("input")[0]!.element as HTMLInputElement).value,
    ).toBe("CNNGB");
    expect(wrapper.emitted("dirtyChange")?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });
});
