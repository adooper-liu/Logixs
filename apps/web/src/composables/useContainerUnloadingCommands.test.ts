import type {
  ContainerUnloadingReport,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { computed } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContainerUnloadingCommands } from "./useContainerUnloadingCommands";

const appendReport = vi.fn();
const registerEvidence = vi.fn();
const recordDateFact = vi.fn();

vi.mock("../api/containerUnloading", () => ({
  appendContainerUnloadingReport: (...args: unknown[]) => appendReport(...args),
}));
vi.mock("../api/evidence", () => ({
  isEvidenceUuid: () => false,
  registerAndVerifyFloorEvidence: (...args: unknown[]) =>
    registerEvidence(...args),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  recordLifecycleDateFact: (...args: unknown[]) => recordDateFact(...args),
}));

const instruction = {
  instructionId: "11111111-1111-4111-8111-111111111111",
  containerRecordId: "container-1",
  version: 1,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  warehouseCode: "VLS",
  warehouseName: "Barcelona VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "delivery_instruction_confirmed",
  createdAt: "2026-09-21T00:00:00Z",
  duplicate: false,
} as WarehouseDeliveryInstruction;

describe("useContainerUnloadingCommands", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    appendReport.mockReset();
    registerEvidence.mockReset().mockResolvedValue("evidence-1");
    recordDateFact.mockReset().mockResolvedValue({
      factId: "fact-1",
      applicationState: "review_required",
    });
    let key = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `idempotency-${++key}` });
  });

  it("saves partial progress without creating a lifecycle completion fact", async () => {
    appendReport.mockResolvedValue(report("partial", null));
    const reload = vi.fn().mockResolvedValue(undefined);
    const commands = useContainerUnloadingCommands(reload);
    await commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
    );
    expect(appendReport).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({ operationState: "partial" }),
    );
    expect(recordDateFact).not.toHaveBeenCalled();
  });

  it("uses the completed report time and evidence for unloaded review", async () => {
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
    );
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );
    expect(registerEvidence).toHaveBeenCalledWith(
      "container-1",
      "WAREHOUSE-RECEIPT-1",
      expect.objectContaining({
        evidenceType: "receipt",
        sourceType: "organization",
        authoritySystem: "warehouse-receiving",
      }),
    );
    expect(recordDateFact).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({
        nodeCode: "container_unloading",
        eventCode: "unloaded",
        timeKind: "actual",
        occurredAt: "2026-04-23T08:30:00.000Z",
        sourceUtcOffset: "+02:00",
        authoritySystem: "warehouse-receiving",
        evidenceRefs: ["evidence-1"],
        expectedVersion: 4,
      }),
    );
  });

  it("retries a failed date fact without replaying the known successful report", async () => {
    registerEvidence
      .mockResolvedValueOnce("evidence-1")
      .mockResolvedValueOnce("evidence-2");
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    recordDateFact
      .mockRejectedValueOnce(new Error("temporary date fact failure"))
      .mockResolvedValueOnce({
        factId: "fact-1",
        applicationState: "review_required",
      });
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
    );

    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );

    expect(appendReport).toHaveBeenCalledTimes(1);
    expect(recordDateFact).toHaveBeenCalledTimes(2);
    expect(recordDateFact.mock.calls[0]?.[1].idempotencyKey).toBe(
      recordDateFact.mock.calls[1]?.[1].idempotencyKey,
    );
    expect(registerEvidence).toHaveBeenCalledTimes(1);
  });

  it("retries reload without replaying completed report or date writes", async () => {
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    const reload = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh unavailable"))
      .mockResolvedValueOnce(undefined);
    const commands = useContainerUnloadingCommands(reload);
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("completed"),
    );
    await commands.resumeAttempt("container-1");
    expect(appendReport).toHaveBeenCalledTimes(1);
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(2);
  });
  it("keeps an unresolved completed attempt and refuses edited values until explicit recovery", async () => {
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    recordDateFact.mockRejectedValueOnce(new Error("date unavailable"));
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
    );
    const original = draft("completed");
    await commands.submitReport("container-1", 2, 4, instruction, original);
    const edited = { ...original, completedLocal: "2026-04-23T12:00" };
    await commands.submitReport("container-1", 2, 4, instruction, edited);
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(commands.attemptStage.value).toBe("date");
    expect(commands.error.value).toContain("未完成");
    await commands.resumeAttempt("container-1");
    expect(recordDateFact).toHaveBeenCalledTimes(2);
  });

  it("does not publish a late A response after a B request takes ownership", async () => {
    const releaseA = deferred<ContainerUnloadingReport>();
    appendReport.mockImplementation((containerId: string) =>
      containerId === "container-a"
        ? releaseA.promise
        : Promise.resolve({
            ...report("partial", null),
            containerRecordId: containerId,
          }),
    );
    const reload = vi.fn().mockResolvedValue(undefined);
    const commands = useContainerUnloadingCommands(reload);
    const aInstruction = { ...instruction, containerRecordId: "container-a" };
    const bInstruction = { ...instruction, containerRecordId: "container-b" };
    const a = commands.submitReport(
      "container-a",
      1,
      3,
      aInstruction,
      draft("partial"),
    );
    await Promise.resolve();
    await commands.submitReport(
      "container-b",
      1,
      3,
      bInstruction,
      draft("partial"),
    );
    expect(commands.reportResult.value?.containerRecordId).toBe("container-b");
    releaseA.resolve({
      ...report("partial", null),
      containerRecordId: "container-a",
    });
    await a;
    expect(commands.reportResult.value?.containerRecordId).toBe("container-b");
  });

  it("fails closed when the selection changes before the report write", async () => {
    const evidence = deferred<string>();
    registerEvidence.mockReturnValueOnce(evidence.promise);
    appendReport.mockResolvedValue(report("partial", null));
    const authority = {
      containerId: "container-1",
      selectionKey: "container-1|task-a|1",
      instruction,
      reportVersion: 1,
      projectionVersion: 3,
    };
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
      () => authority,
    );
    const pending = commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
      { taskId: "task-a", selectionKey: authority.selectionKey, generation: 1 },
    );
    await Promise.resolve();
    authority.selectionKey = "container-1|task-b|2";
    evidence.resolve("evidence-1");
    await pending;
    expect(appendReport).not.toHaveBeenCalled();
    expect(commands.reportResult.value).toBeNull();
  });

  it("explicitly rebinds A's unfinished date attempt after B and A are selected", async () => {
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    recordDateFact
      .mockRejectedValueOnce(new Error("date unavailable"))
      .mockResolvedValueOnce({
        factId: "fact-1",
        applicationState: "review_required",
      });
    const authority = {
      containerId: "container-1",
      selectionKey: "container-1|task-a|1",
      instruction,
      reportVersion: 2,
      projectionVersion: 4,
    };
    const commands = useContainerUnloadingCommands(
      vi.fn().mockResolvedValue(undefined),
      () => authority,
    );
    const completed = draft("completed");
    await commands.submitReport("container-1", 2, 4, instruction, completed, {
      taskId: "task-a",
      selectionKey: authority.selectionKey,
      generation: 1,
    });
    expect(
      commands.attemptStageFor("container-1", {
        taskId: "task-b",
        selectionKey: "container-1|task-b|2",
        generation: 2,
      }),
    ).toBeNull();
    authority.selectionKey = "container-1|task-b|2";
    authority.selectionKey = "container-1|task-a|3";
    expect(
      commands.attemptStageFor("container-1", {
        taskId: "task-a",
        selectionKey: authority.selectionKey,
        generation: 3,
      }),
    ).toBe("date");
    await commands.resumeAttempt("container-1", {
      taskId: "task-a",
      selectionKey: authority.selectionKey,
      generation: 3,
    });
    expect(recordDateFact).toHaveBeenCalledTimes(2);
    expect(recordDateFact.mock.calls[0]?.[1].expectedVersion).toBe(4);
    expect(recordDateFact.mock.calls[1]?.[1].expectedVersion).toBe(4);
  });

  it("publishes busy and attempt stage reactively while the selected report is pending", async () => {
    const release = deferred<ContainerUnloadingReport>();
    appendReport.mockReturnValueOnce(release.promise);
    const key = "container-1|task-a|1";
    const commands = useContainerUnloadingCommands(vi.fn(), () => ({
      containerId: "container-1",
      selectionKey: key,
      taskId: "task-a",
      generation: 1,
      instruction,
      reportVersion: 1,
      projectionVersion: 3,
    }));
    const busy = computed(() => commands.isSubmittingFor(key));
    const stage = computed(() =>
      commands.attemptStageFor("container-1", {
        taskId: "task-a",
        selectionKey: key,
        generation: 1,
      }),
    );
    expect(busy.value).toBe(false);
    expect(stage.value).toBeNull();
    const pending = commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
      { taskId: "task-a", selectionKey: key, generation: 1 },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(busy.value).toBe(true);
    expect(stage.value).toBe("report");
    release.resolve(report("partial", null));
    await pending;
  });

  it("does not publish an old A failure after the selection moves to B without a B request", async () => {
    const release = deferred<ContainerUnloadingReport>();
    appendReport.mockReturnValueOnce(release.promise);
    const authority = {
      containerId: "container-1",
      selectionKey: "container-1|task-a|1",
      taskId: "task-a",
      generation: 1,
      instruction,
      reportVersion: 1,
      projectionVersion: 3,
    };
    const commands = useContainerUnloadingCommands(vi.fn(), () => authority);
    const pending = commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
      { taskId: "task-a", selectionKey: authority.selectionKey, generation: 1 },
    );
    await vi.waitFor(() => expect(appendReport).toHaveBeenCalledTimes(1));
    authority.selectionKey = "container-1|task-b|2";
    authority.taskId = "task-b";
    authority.generation = 2;
    release.reject(new Error("A failed"));
    await pending;
    expect(commands.error.value).toBe("");
    expect(commands.reportResult.value).toBeNull();
  });

  it("does not let A bypass an unresolved older A generation after B is selected", async () => {
    const first = deferred<ContainerUnloadingReport>();
    appendReport.mockReturnValueOnce(first.promise);
    const authority = {
      containerId: "container-1",
      selectionKey: "container-1|task-a|1",
      taskId: "task-a",
      generation: 1,
      instruction,
      reportVersion: 1,
      projectionVersion: 3,
    };
    const commands = useContainerUnloadingCommands(vi.fn(), () => authority);
    const oldA = commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
      {
        taskId: "task-a",
        selectionKey: authority.selectionKey,
        generation: 1,
      },
    );
    await vi.waitFor(() => expect(appendReport).toHaveBeenCalledTimes(1));
    authority.selectionKey = "container-1|task-b|2";
    authority.taskId = "task-b";
    authority.generation = 2;
    await Promise.resolve();
    authority.selectionKey = "container-1|task-a|3";
    authority.taskId = "task-a";
    authority.generation = 3;
    const newA = commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
      {
        taskId: "task-a",
        selectionKey: authority.selectionKey,
        generation: 3,
      },
    );
    await newA;
    expect(appendReport).toHaveBeenCalledTimes(1);
    expect(commands.error.value).toContain("未完成");
    first.resolve({ ...report("partial", null), reportId: "old-a" });
    await oldA;
    expect(commands.reportResult.value).toBeNull();
  });

  it("blocks A's ordinary save while an older same-task A response is still held", async () => {
    const heldA = deferred<ContainerUnloadingReport>();
    appendReport.mockReturnValueOnce(heldA.promise).mockResolvedValueOnce({
      ...report("partial", null),
      containerRecordId: "container-1",
      reportId: "b-report",
    });
    const authority = {
      containerId: "container-1",
      selectionKey: "container-1|task-a|1",
      taskId: "task-a",
      generation: 1,
      instruction,
      reportVersion: 1,
      projectionVersion: 3,
    };
    const commands = useContainerUnloadingCommands(vi.fn(), () => authority);
    const oldA = commands.submitReport(
      "container-1",
      1,
      3,
      instruction,
      draft("partial"),
      { taskId: "task-a", selectionKey: authority.selectionKey, generation: 1 },
    );
    await vi.waitFor(() => expect(appendReport).toHaveBeenCalledTimes(1));

    authority.selectionKey = "container-1|task-b|2";
    authority.taskId = "task-b";
    authority.generation = 2;
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("partial"),
      { taskId: "task-b", selectionKey: authority.selectionKey, generation: 2 },
    );
    expect(appendReport).toHaveBeenCalledTimes(2);

    authority.selectionKey = "container-1|task-a|3";
    authority.taskId = "task-a";
    authority.generation = 3;
    await commands.submitReport(
      "container-1",
      2,
      4,
      instruction,
      draft("partial"),
      { taskId: "task-a", selectionKey: authority.selectionKey, generation: 3 },
    );
    expect(appendReport).toHaveBeenCalledTimes(2);
    expect(commands.error.value).toContain("未完成");

    heldA.resolve({ ...report("partial", null), reportId: "a-report" });
    await oldA;
  });

  it("requires explicit reload-only recovery after both writes have succeeded", async () => {
    appendReport.mockResolvedValue(
      report("completed", "2026-04-23T08:30:00.000Z"),
    );
    recordDateFact.mockResolvedValue({
      factId: "fact-1",
      applicationState: "review_required",
    });
    const reload = vi
      .fn()
      .mockRejectedValueOnce(new Error("read unavailable"))
      .mockResolvedValueOnce(undefined);
    const authority = {
      containerId: "container-1",
      selectionKey: "container-1|task-a|1",
      taskId: "task-a",
      generation: 1,
      instruction,
      reportVersion: 2,
      projectionVersion: 4,
    };
    const commands = useContainerUnloadingCommands(reload, () => authority);
    const completed = draft("completed");
    await commands.submitReport("container-1", 2, 4, instruction, completed, {
      taskId: "task-a",
      selectionKey: authority.selectionKey,
      generation: 1,
    });
    expect(commands.attemptStage.value).toBe("reload");
    authority.selectionKey = "container-1|task-b|2";
    authority.taskId = "task-b";
    authority.generation = 2;
    authority.selectionKey = "container-1|task-a|3";
    authority.taskId = "task-a";
    authority.generation = 3;
    await commands.submitReport("container-1", 2, 4, instruction, completed, {
      taskId: "task-a",
      selectionKey: authority.selectionKey,
      generation: 3,
    });
    expect(appendReport).toHaveBeenCalledTimes(1);
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    await commands.resumeAttempt("container-1", {
      taskId: "task-a",
      selectionKey: authority.selectionKey,
      generation: 3,
    });
    expect(appendReport).toHaveBeenCalledTimes(1);
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function draft(operationState: "partial" | "completed") {
  return {
    operationState,
    startedLocal: "2026-04-23T08:00",
    completedLocal: operationState === "completed" ? "2026-04-23T10:30" : "",
    expectedQuantity: "524",
    unloadedQuantity: operationState === "completed" ? "524" : "300",
    remainingQuantity: operationState === "completed" ? "0" : "224",
    damagedQuantity: "0",
    shortageQuantity: "0",
    quantityUnit: "carton" as const,
    sealCheck: "matched" as const,
    exceptionResolved: false,
    exceptionNotes: "",
    evidenceInputs: ["WAREHOUSE-RECEIPT-1"],
  };
}

function report(
  operationState: "partial" | "completed",
  completedAt: string | null,
): ContainerUnloadingReport {
  return {
    reportId: "44444444-4444-4444-8444-444444444444",
    containerRecordId: "container-1",
    version: operationState === "completed" ? 3 : 2,
    warehouseLocationId: instruction.warehouseLocationId,
    operationState,
    startedAt: "2026-04-23T06:00:00.000Z",
    completedAt,
    expectedQuantity: "524",
    unloadedQuantity: operationState === "completed" ? "524" : "300",
    remainingQuantity: operationState === "completed" ? "0" : "224",
    damagedQuantity: "0",
    shortageQuantity: "0",
    quantityUnit: "carton",
    sealCheck: "matched",
    exceptionResolved: false,
    exceptionNotes: null,
    evidenceRefs: ["evidence-1"],
    actorId: "operator-a",
    reasonCode: "unloading_progress_reported",
    createdAt: "2026-09-21T00:00:00Z",
    duplicate: false,
  };
}
