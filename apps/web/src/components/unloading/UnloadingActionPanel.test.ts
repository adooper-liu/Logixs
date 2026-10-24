import { mount } from "@vue/test-utils";
import type { ContainerUnloadingReport } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import UnloadingActionPanel from "./UnloadingActionPanel.vue";

const instruction = {
  instructionId: "11111111-1111-4111-8111-111111111111",
  containerRecordId: "c-1",
  version: 2,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  warehouseCode: "VLS",
  warehouseName: "VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  evidenceRefs: [],
  actorId: "a",
  reasonCode: "x",
  createdAt: "2026-01-01T00:00:00Z",
  duplicate: false,
};
const report = {
  reportId: "r-1",
  containerRecordId: "c-1",
  version: 3,
  warehouseLocationId: instruction.warehouseLocationId,
  operationState: "partial",
  startedAt: "2026-04-23T06:00:00.000Z",
  completedAt: null,
  expectedQuantity: "10",
  unloadedQuantity: "4",
  remainingQuantity: "6",
  damagedQuantity: "0",
  shortageQuantity: "0",
  quantityUnit: "carton",
  sealCheck: "matched",
  exceptionResolved: false,
  exceptionNotes: null,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "a",
  reasonCode: "x",
  createdAt: "2026-01-01T00:00:00Z",
  duplicate: false,
} as ContainerUnloadingReport;

describe("UnloadingActionPanel", () => {
  it("hydrates using destination timezone and preserves dirty values on report refresh", async () => {
    const wrapper = mount(UnloadingActionPanel, {
      props: {
        instruction,
        report,
        draftIdentity: "c-1|i-1",
        task: null,
        submitting: false,
        taskSubmitting: false,
        factResult: null,
        error: "",
      },
    });
    const started = wrapper.get('input[type="datetime-local"]');
    expect((started.element as HTMLInputElement).value).toBe(
      "2026-04-23T08:00",
    );
    await started.setValue("2026-04-24T09:15");
    await wrapper.setProps({
      report: { ...report, startedAt: "2026-04-25T06:00:00.000Z", version: 4 },
    });
    expect((started.element as HTMLInputElement).value).toBe(
      "2026-04-24T09:15",
    );
  });

  it("resets the draft on a real container identity change", async () => {
    const wrapper = mount(UnloadingActionPanel, {
      props: {
        instruction,
        report: null,
        draftIdentity: "c-1|task-a|1",
        task: null,
        submitting: false,
        taskSubmitting: false,
        factResult: null,
        error: "",
      },
    });
    const input = wrapper.get('input[type="datetime-local"]');
    await input.setValue("2026-04-24T09:15");
    await wrapper.setProps({ draftIdentity: "c-1|task-b|2" });
    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("keeps a started report as started and exposes an explicit semantic recovery", async () => {
    const wrapper = mount(UnloadingActionPanel, {
      props: {
        instruction,
        report: {
          ...report,
          operationState: "started",
          warehouseLocationId: instruction.warehouseLocationId,
        },
        draftIdentity: "c-1|i-1",
        task: null,
        submitting: false,
        taskSubmitting: false,
        factResult: null,
        error: "",
        attemptStage: "date",
      },
    });
    expect(wrapper.get('[aria-label="卸货作业状态"] .active').text()).toContain(
      "开始卸货",
    );
    expect(wrapper.get('[aria-label="未完成卸柜尝试"]')).toBeTruthy();
  });

  it("blocks a dirty draft when the destination semantics change", async () => {
    const wrapper = mount(UnloadingActionPanel, {
      props: {
        instruction,
        report: null,
        draftIdentity: "c-1|i-1",
        task: null,
        submitting: false,
        taskSubmitting: false,
        factResult: null,
        error: "",
      },
    });
    const input = wrapper.get('input[type="datetime-local"]');
    await input.setValue("2026-04-24T09:15");
    await wrapper.setProps({
      instruction: {
        ...instruction,
        timezone: "UTC",
        warehouseLocationId: "44444444-4444-4444-8444-444444444444",
      },
    });
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "目的仓或时区已变更",
    );
    expect(wrapper.get("button.secondary").text()).toContain("重新核对");
  });

  it("renders reusable task submission recovery and emits retry", async () => {
    const wrapper = mount(UnloadingActionPanel, {
      props: {
        instruction,
        report: null,
        draftIdentity: "c-1|task-a|1",
        task: {
          id: "task-a",
          nextAction: {
            actionCode: "work_execution.claim_work_order",
            workOrderId: "work-a",
          },
        } as never,
        submitting: false,
        taskSubmitting: false,
        factResult: null,
        error: "",
        submission: {
          taskId: "task-a",
          actionCode: "work_execution.claim_work_order",
          stage: "rejected",
          message: "网络结果未知，请使用原编号重试",
          canRetry: true,
        },
      },
    });
    const retry = wrapper.get("button.retry");
    expect(retry.text()).toContain("原编号");
    await retry.trigger("click");
    expect(wrapper.emitted("retryTask")).toHaveLength(1);
  });
});
