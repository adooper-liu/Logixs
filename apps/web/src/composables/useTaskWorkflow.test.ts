import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDemoOperations } from "./useDemoOperationsStore";
import { useTaskWorkflow } from "./useTaskWorkflow";
import { withSetup } from "../test/withSetup";

describe("useTaskWorkflow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDemoOperations();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("commits unload as a task result and advances the linked container only", async () => {
    const [workflow, app] = withSetup(() =>
      useTaskWorkflow({ stepDelayMs: 1 }),
    );
    workflow.selectTask("task_1026");
    workflow.claimTask();
    workflow.acknowledgeInput("unload_sheet");
    workflow.verifyEvidence("container_scan", "TRLU-9912034");
    workflow.verifyEvidence("quantity_check");
    workflow.executeAction("candidate_submit_unload_result");

    await vi.runAllTimersAsync();
    await nextTick();

    expect(workflow.activeTask.value.status).toBe("completed");
    expect(workflow.activeContainer.value.currentStatus.code).toBe("unloaded");
    expect(workflow.activeSubmission.value.resultEventCode).toBe("unloaded");
    expect(
      workflow.containers.value.find(
        (item) => item.containerRecordId === "cr_01J9LAX7K2D4",
      )?.currentStatus.code,
    ).toBe("at_port");
    app.unmount();
  });

  it("keeps a completed task immutable when a later exception is reported", async () => {
    const [workflow, app] = withSetup(() =>
      useTaskWorkflow({ stepDelayMs: 1 }),
    );
    workflow.selectTask("task_1026");
    workflow.claimTask();
    workflow.acknowledgeInput("unload_sheet");
    workflow.verifyEvidence("container_scan", "TRLU9912034");
    workflow.verifyEvidence("quantity_check");
    workflow.executeAction("candidate_submit_unload_result");
    await vi.runAllTimersAsync();

    workflow.reportException("卸柜完成后发现外箱破损");
    await vi.runAllTimersAsync();

    expect(workflow.activeTask.value.status).toBe("completed");
    expect(workflow.exceptions.value.at(-1)).toMatchObject({
      sourceTaskId: "task_1026",
      containerRecordId: "cr_01J9LAX8M5Q7",
      status: "reported",
    });
    app.unmount();
  });

  it("records a wrong-container scan as a business rejection without accepting evidence", () => {
    const [workflow, app] = withSetup(() =>
      useTaskWorkflow({ stepDelayMs: 1 }),
    );
    workflow.selectTask("task_1026");
    workflow.claimTask();
    workflow.verifyEvidence("container_scan", "TCLU2387642");

    const evidence = workflow.activeTask.value.evidenceRequirements.find(
      (item) => item.id === "container_scan",
    );
    expect(evidence?.state).toBe("pending");
    expect(workflow.activeSubmission.value.stage).toBe("rejected");
    expect(workflow.activeSubmission.value.errorCode).toBe(
      "TASK_CONTAINER_MISMATCH",
    );
    expect(workflow.activeSubmission.value.receivedAt).toBeTruthy();
    expect(workflow.activeSubmission.value.acceptedAt).toBeUndefined();
    app.unmount();
  });

  it("retains the exact operation receipt after switching tasks", async () => {
    const [workflow, app] = withSetup(() =>
      useTaskWorkflow({ stepDelayMs: 1 }),
    );
    workflow.selectTask("task_1026");
    workflow.claimTask();
    const operationId = workflow.activeSubmission.value.clientOperationId;

    workflow.selectTask("task_1024");
    workflow.selectTask("task_1026");
    await nextTick();

    expect(workflow.activeSubmission.value.clientOperationId).toBe(operationId);
    expect(workflow.activeSubmission.value.resultRef).toContain("assignment_");
    app.unmount();
  });
});
