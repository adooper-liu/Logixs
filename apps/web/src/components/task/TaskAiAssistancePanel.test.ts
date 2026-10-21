import { mount } from "@vue/test-utils";
import { shallowRef, type ShallowRef } from "vue";
import { describe, expect, it } from "vitest";
import type {
  TaskAiAssistancePanelModel,
  TaskAiAssistanceRetryTarget,
} from "../../composables/useTaskAiAssistance";
import TaskAiAssistancePanel from "./TaskAiAssistancePanel.vue";

describe("TaskAiAssistancePanel", () => {
  it("renders a committed replay as applied business work", () => {
    const state = model();
    state.receipt.value = {
      workOrderId: id(4),
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: "actor-1",
      taskId: id(2),
      taskState: "in_progress",
      applied: true,
      clientOperationId: id(6),
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    };
    state.idempotencyReplay.value = true;

    const wrapper = mount(TaskAiAssistancePanel, { props: { state } });

    expect(wrapper.text()).toContain("已应用");
    expect(wrapper.text()).not.toContain("未应用");
    expect(wrapper.text()).toContain("同一操作的幂等恢复回执");
  });
  it("renders the evidence spine and keeps an unaccepted proposal separate from task state", () => {
    const wrapper = mount(TaskAiAssistancePanel, {
      props: { state: model() },
    });

    expect(
      wrapper
        .findAll("[data-ai-spine-step]")
        .map((node) => node.attributes("data-ai-spine-step")),
    ).toEqual(["task", "source", "impact", "decision"]);
    expect(wrapper.text()).toContain("E2E-CN-01");
    expect(wrapper.text()).toContain("出口装箱");
    expect(wrapper.text()).toContain("领取");
    expect(wrapper.text()).toContain("待领取");
    expect(wrapper.text()).toContain("10/20 18:00");
    expect(wrapper.text()).toContain("规则建议");
    expect(wrapper.get('[data-ai-spine-step="task"]').text()).toContain(
      `当前领取工单 ${id(4)}`,
    );
    expect(wrapper.get('[data-ai-spine-step="source"]').text()).toContain(
      "task.claim-assistance / v1",
    );
    expect(wrapper.text()).toContain("未采信，不改变任务状态");
    expect(wrapper.text()).toContain(
      "确认后服务端会重新验证当前身份、task.execute、tenant/object scope、当前业务状态和并发版本。",
    );
  });

  it("marks an expired candidate as non-executable and rereads task context", async () => {
    const state = model();
    state.candidate.value = { ...state.candidate.value!, status: "expired" };
    const wrapper = mount(TaskAiAssistancePanel, { props: { state } });

    expect(wrapper.text()).toContain("建议已失效");
    expect(wrapper.text()).toContain("当前建议不可执行");
    expect(wrapper.text()).toContain("未改变任务状态");
    expect(wrapper.text()).not.toContain("等待你的决定");
    expect(wrapper.find('[data-testid="ai-confirm"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="ai-reject"]').exists()).toBe(false);

    await wrapper.get('[data-testid="ai-retry-context"]').trigger("click");
    expect(wrapper.emitted("retry")).toEqual([["context"]]);
  });

  it.each([
    ["rule", "规则建议"],
    ["model", "模型建议"],
    ["fallback", "确定性降级建议"],
  ] as const)(
    "maps source %s to %s without a provider badge",
    (kind, label) => {
      const state = model();
      state.candidate.value = {
        ...state.candidate.value!,
        source: { ...state.candidate.value!.source, kind },
      };
      const wrapper = mount(TaskAiAssistancePanel, { props: { state } });

      expect(wrapper.text()).toContain(label);
      expect(wrapper.text()).not.toContain("AI Provider");
    },
  );

  it("emits explicit confirm and optional reject reason without calling services", async () => {
    const wrapper = mount(TaskAiAssistancePanel, {
      props: { state: model() },
    });

    await wrapper.get('[data-testid="ai-confirm"]').trigger("click");
    await wrapper.get('[aria-label="拒绝原因（可选）"]').setValue("暂不领取");
    await wrapper.get('[data-testid="ai-reject"]').trigger("click");

    expect(wrapper.emitted("confirm")).toEqual([[]]);
    expect(wrapper.emitted("reject")).toEqual([["暂不领取"]]);
  });

  it("shows a rejected decision read-only and removes both decision buttons", () => {
    const state = model();
    state.candidate.value = { ...state.candidate.value!, status: "rejected" };
    state.decision.value = {
      decisionId: id(5),
      candidateId: id(3),
      decidedByActorId: "actor-1",
      decision: "rejected",
      reason: "暂不领取",
      idempotencyKey: id(9),
      decidedAt: "2026-10-20T08:01:00.000Z",
      clientOperationId: null,
      traceId: null,
      executionState: null,
      resultRefs: [],
    };
    const wrapper = mount(TaskAiAssistancePanel, { props: { state } });

    expect(wrapper.text()).toContain("已拒绝建议");
    expect(wrapper.text()).toContain("暂不领取");
    expect(wrapper.find('[data-testid="ai-confirm"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="ai-reject"]').exists()).toBe(false);
  });

  it("shows formal execution receipt after the decision and keeps technical details collapsed", () => {
    const state = model();
    state.candidate.value = { ...state.candidate.value!, status: "accepted" };
    const assigneeId = id(7);
    state.receipt.value = {
      workOrderId: id(4),
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId,
      taskId: id(2),
      taskState: "in_progress",
      applied: true,
      clientOperationId: "operation-1",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    };
    state.idempotencyReplay.value = true;
    const wrapper = mount(TaskAiAssistancePanel, { props: { state } });

    expect(
      wrapper
        .findAll("[data-ai-spine-step]")
        .map((node) => node.attributes("data-ai-spine-step")),
    ).toEqual(["task", "source", "impact", "decision", "receipt"]);
    expect(wrapper.text()).toContain("正式执行回执");
    expect(wrapper.text()).toContain("已应用");
    const receipt = wrapper.get('[data-ai-spine-step="receipt"]');
    expect(receipt.text()).toContain("当前负责人你");
    expect(receipt.text()).toContain("任务状态进行中");
    expect(receipt.text()).toContain("操作状态已接收 / 已确认 / 已入账");
    expect(receipt.text()).not.toContain(assigneeId);
    expect(receipt.text()).not.toContain("in_progress");
    expect(receipt.text()).not.toContain("received");
    expect(receipt.text()).not.toContain("accepted");
    expect(receipt.text()).not.toContain("committed");
    expect(wrapper.text()).toContain("幂等恢复");
    const details = wrapper.get("details");
    expect(details.attributes()).not.toHaveProperty("open");
    expect(details.text()).toContain("operation-1");
    expect(details.text()).toContain(assigneeId);
    expect(details.text()).toContain("in_progress");
    expect(details.text()).toContain("assigned");
    expect(details.text()).toContain("received");
    expect(details.text()).toContain("accepted");
    expect(details.text()).toContain("committed");
  });

  it("emits the correct recovery target for generate, confirmation, and context failures", async () => {
    const cases: Array<{
      state: TaskAiAssistancePanelModel;
      testId: string;
      target: TaskAiAssistanceRetryTarget;
    }> = [];
    const generateState = model();
    generateState.candidate.value = null;
    generateState.error.value = "暂时无法生成";
    generateState.retryable.value = true;
    generateState.primaryRetryTarget.value = "generate";
    cases.push({
      state: generateState,
      testId: "ai-retry-generate",
      target: "generate",
    });
    const confirmState = model();
    confirmState.confirmError.value = "响应丢失";
    confirmState.retryable.value = true;
    confirmState.pendingConfirmCommand.value = {
      contractVersion: "task-action-candidate-confirm.v1",
      candidateId: id(3),
      candidateHash: "candidate-hash",
      idempotencyKey: id(9),
    };
    cases.push({
      state: confirmState,
      testId: "ai-retry-confirm",
      target: "confirm",
    });
    const contextState = model();
    contextState.candidate.value = null;
    contextState.error.value = "请重新读取任务和授权";
    contextState.retryable.value = true;
    contextState.primaryRetryTarget.value = "context";
    cases.push({
      state: contextState,
      testId: "ai-retry-context",
      target: "context",
    });

    for (const item of cases) {
      const wrapper = mount(TaskAiAssistancePanel, {
        props: { state: item.state },
      });
      await wrapper.get(`[data-testid="${item.testId}"]`).trigger("click");
      expect(wrapper.emitted("retry")).toEqual([[item.target]]);
      wrapper.unmount();
    }
  });

  it.each(["confirm", "reject"] as const)(
    "keeps a non-retryable %s error visible without a recovery control",
    (action) => {
      const state = model();
      const message = "建议来源返回了无效响应";
      if (action === "confirm") state.confirmError.value = message;
      else state.rejectError.value = message;
      state.retryable.value = false;

      const wrapper = mount(TaskAiAssistancePanel, { props: { state } });
      const alert = wrapper.get('[role="alert"]');

      expect(alert.text()).toContain(message);
      expect(alert.find("button").exists()).toBe(false);
      expect(wrapper.emitted("refresh")).toBeUndefined();
      expect(wrapper.emitted("retry")).toBeUndefined();
    },
  );

  it("preserves explicit refresh after a conflict reloads a terminal candidate", async () => {
    const state = model();
    state.candidate.value = { ...state.candidate.value!, status: "rejected" };
    state.confirmError.value = "建议已发生冲突，已重新读取当前候选和任务。";

    const wrapper = mount(TaskAiAssistancePanel, { props: { state } });
    const refresh = wrapper.get('[role="alert"]').get("button");

    expect(refresh.text()).toContain("重新读取建议");
    await refresh.trigger("click");

    expect(wrapper.emitted("refresh")).toEqual([[]]);
  });

  it("does not create an inner vertical scroll owner", () => {
    const wrapper = mount(TaskAiAssistancePanel, {
      props: { state: model() },
    });

    expect(
      wrapper.findAll("*").filter((node) => {
        const style = getComputedStyle(node.element);
        return /(auto|scroll)/.test(`${style.overflow} ${style.overflowY}`);
      }),
    ).toHaveLength(0);
  });
});

type TestPanelModel = TaskAiAssistancePanelModel & {
  primaryRetryTarget: ShallowRef<"generate" | "context" | null>;
};

function model(): TestPanelModel {
  return {
    facts: {
      objectLabel: "E2E-CN-01",
      taskLabel: "出口装箱",
      actionLabel: "领取",
      responsibilityLabel: "待领取",
      dueLabel: "10/20 18:00",
      fixtureLabel: "当前测试 fixture",
    },
    loading: shallowRef(false),
    error: shallowRef(""),
    retryable: shallowRef(false),
    primaryRetryTarget: shallowRef(null),
    candidate: shallowRef({
      candidateId: id(3),
      candidateHash: "candidate-hash",
      context: {
        subjectRef: { kind: "container", id: id(1) },
        workRef: { kind: "node_task", id: id(2) },
      },
      workOrderId: id(4),
      actionCode: "work_execution.claim_work_order",
      actionVersion: 1,
      title: "建议领取当前任务",
      rationale: "当前工单处于可领取状态。",
      impact: "确认后将由服务端重新验证并领取。",
      riskLevel: "low",
      warningCodes: [],
      status: "proposed",
      source: {
        kind: "rule",
        capabilityId: "task.claim-assistance",
        capabilityVersion: 1,
        schemaVersion: 1,
        promptVersion: null,
        modelId: null,
        inputSnapshotHash: "snapshot-hash",
        inputRefs: [],
        generatedAt: "2026-10-20T08:00:00.000Z",
      },
    }),
    decision: shallowRef(null),
    confirming: shallowRef(false),
    rejecting: shallowRef(false),
    confirmError: shallowRef(""),
    rejectError: shallowRef(""),
    pendingConfirmCommand: shallowRef(null),
    receipt: shallowRef(null),
    idempotencyReplay: shallowRef(null),
    confirm: async () => undefined,
    reject: async () => undefined,
    retry: async () => undefined,
    refresh: async () => undefined,
  };
}

function id(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}
