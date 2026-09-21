import { describe, expect, it, vi } from "vitest";
import type { ReconcileAppliedLifecycleFactCommand } from "../reconcile-applied-lifecycle-fact.port";
import type {
  ApplyLifecycleFactReconciliationInput,
  ApplyLifecycleFactReconciliationResult,
  NodeTaskWithWorkOrders,
  WorkExecutionRepository,
  WorkOrderFactApplicationRecord,
} from "../domain/work-execution.repository";
import { hashAppliedLifecycleWorkFact } from "../domain/work-order-fact-application";
import { ReconcileAppliedLifecycleFactService } from "./reconcile-applied-lifecycle-fact.service";

const occurredAt = new Date("2026-09-21T08:00:00.000Z");
const receivedAt = new Date("2026-09-21T08:01:00.000Z");

function command(
  overrides: Partial<ReconcileAppliedLifecycleFactCommand> = {},
): ReconcileAppliedLifecycleFactCommand {
  return {
    tenantId: "tenant-1",
    containerId: "container-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "container_unloading",
    canonicalEventId: "event-1",
    eventCode: "unloaded",
    businessFactType: "canonical_lifecycle_event",
    domainFactId: "event-1",
    captureSource: "external_evidence",
    evidenceRefs: ["evidence-1"],
    occurredAt,
    receivedAt,
    actorOrServiceId: "outbox-service",
    traceId: "trace-1",
    idempotencyKey: "outbox-1",
    ...overrides,
  };
}

function bundle(
  overrides: Partial<NodeTaskWithWorkOrders["task"]> = {},
): NodeTaskWithWorkOrders {
  return {
    task: {
      id: "task-1",
      tenantId: "tenant-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "container_unloading",
      containerId: "container-1",
      taskDefinitionKey: "node-container_unloading",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      version: 0,
      createdAt: occurredAt,
      ...overrides,
    },
    workOrders: [
      {
        id: "work-1",
        nodeTaskId: "task-1",
        workOrderDefinitionKey: "wo-container_unloading",
        state: "ready",
        applicability: "required",
        assignmentState: "unassigned",
        assigneeId: null,
        dueAt: null,
        completedAt: null,
        version: 0,
        createdAt: occurredAt,
      },
    ],
    outcome: null,
  };
}

function buildRepository(options?: {
  task?: NodeTaskWithWorkOrders | null;
  existing?: WorkOrderFactApplicationRecord | null;
}) {
  const task = options?.task === undefined ? bundle() : options.task;
  const applyLifecycleFactReconciliation = vi.fn<
    (
      input: ApplyLifecycleFactReconciliationInput,
    ) => Promise<ApplyLifecycleFactReconciliationResult>
  >(async (input) => ({
    kind: "committed",
    factApplication: {
      id: input.factApplication.id,
      workOrderId: input.factApplication.workOrderId,
      businessFactKey: input.factApplication.businessFactKey,
      requestHash: input.factApplication.requestHash,
      decision: input.factApplication.decision.decision,
      decisionReason: input.factApplication.decision.reasonCode,
      previousState: input.factApplication.decision.previousState,
      resultingState: input.factApplication.decision.resultingState,
    },
    taskState: input.resultingTaskState,
    outcomeId: input.outcome?.id ?? null,
  }));
  const repository = {
    findTaskByNodeInstanceId: vi.fn().mockResolvedValue(task),
    findWorkOrderFactApplication: vi
      .fn()
      .mockResolvedValue(options?.existing ?? null),
    applyLifecycleFactReconciliation,
  };
  return repository as unknown as WorkExecutionRepository & typeof repository;
}

describe("ReconcileAppliedLifecycleFactService", () => {
  it("没有任务时返回可重放的 TASK_NOT_INITIALIZED，且不伪造记录", async () => {
    const repository = buildRepository({ task: null });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).resolves.toEqual({
      nodeTaskId: null,
      factApplicationIds: [],
      decision: "no_op",
      taskState: null,
      outcomeId: null,
      reasonCode: "TASK_NOT_INITIALIZED",
    });
    expect(repository.applyLifecycleFactReconciliation).not.toHaveBeenCalled();
  });

  it.each([
    ["container", { containerId: "other-container" }],
    ["flow", { flowInstanceId: "other-flow" }],
    ["node", { nodeInstanceId: "other-node" }],
    ["nodeCode", { nodeCode: "empty_return" }],
  ] as const)("自身 %s 作用域错配拒绝且不写入", async (_label, scope) => {
    const repository = buildRepository({ task: bundle(scope) });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).rejects.toThrow(
      "FACT_CAUSATION_MISMATCH",
    );
    expect(repository.applyLifecycleFactReconciliation).not.toHaveBeenCalled();
  });

  it("租户错配返回授权范围拒绝", async () => {
    const repository = buildRepository({
      task: bundle({ tenantId: "other-tenant" }),
    });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).rejects.toMatchObject({
      status: 403,
      message: "AUTHORIZATION_SCOPE_DENIED",
    });
  });

  it("命令保留规范事件与 domain fact 的稳定因果标识", async () => {
    const repository = buildRepository();
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(
      service.execute(
        command({
          businessFactType: "lifecycle_date_fact",
          domainFactId: "fact-1",
        }),
      ),
    ).resolves.toMatchObject({ decision: "applied" });

    const invalidRepository = buildRepository();
    const invalidService = new ReconcileAppliedLifecycleFactService(
      invalidRepository,
    );
    await expect(
      invalidService.execute(command({ domainFactId: "other-event" })),
    ).rejects.toThrow("FACT_CAUSATION_MISMATCH");
  });

  it("唯一 required 工单经状态机完成，聚合任务并写因果 Outcome", async () => {
    const repository = buildRepository();
    const service = new ReconcileAppliedLifecycleFactService(repository);

    const result = await service.execute(command());

    expect(result).toMatchObject({
      nodeTaskId: "task-1",
      decision: "applied",
      taskState: "completed",
      reasonCode: null,
    });
    expect(result.factApplicationIds).toHaveLength(1);
    expect(result.outcomeId).toBeTruthy();
    expect(repository.applyLifecycleFactReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderUpdate: expect.objectContaining({
          expectedVersion: 0,
          resultingState: "completed",
        }),
        taskUpdate: expect.objectContaining({
          expectedVersion: 0,
          resultingState: "completed",
        }),
        outcome: expect.objectContaining({
          resultPolicyMode: "reference_existing_event",
          canonicalEventId: "event-1",
          domainFactId: "event-1",
          actorOrServiceId: "outbox-service",
          traceId: "trace-1",
        }),
      }),
    );
  });

  it("optional 工单可共存且不阻断唯一 required 工单完成", async () => {
    const task = bundle();
    task.workOrders.push({
      ...task.workOrders[0]!,
      id: "work-optional",
      applicability: "optional",
      workOrderDefinitionKey: "wo-optional-report",
    });
    const repository = buildRepository({ task });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      decision: "applied",
      taskState: "completed",
    });
  });

  it("一期不提前接受 conditional_required 工单", async () => {
    const task = bundle();
    task.workOrders[0]!.applicability = "conditional_required";
    const repository = buildRepository({ task });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      decision: "rejected",
      reasonCode: "WORK_ORDER_DEFINITION_UNRESOLVED",
      factApplicationIds: [],
    });
  });

  it.each(["draft", "failed", "cancelled"] as const)(
    "%s 工单留下 rejected 决定，不能被事实强制完成",
    async (state) => {
      const task = bundle();
      task.workOrders[0]!.state = state;
      const repository = buildRepository({ task });
      const service = new ReconcileAppliedLifecycleFactService(repository);

      await expect(service.execute(command())).resolves.toMatchObject({
        decision: "rejected",
        reasonCode: "WORK_ORDER_STATE_NOT_COMPLETABLE",
      });
      const write =
        repository.applyLifecycleFactReconciliation.mock.calls[0]![0];
      expect(write.workOrderUpdate).toBeNull();
      expect(write.factApplication.decision.resultingState).toBe(state);
    },
  );

  it("cancelled NodeTask 留下 rejected 决定且不复活", async () => {
    const repository = buildRepository({
      task: bundle({ state: "cancelled" }),
    });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      decision: "rejected",
      taskState: "cancelled",
      reasonCode: "NODE_TASK_CANCELLED",
      outcomeId: null,
    });
    expect(
      repository.applyLifecycleFactReconciliation.mock.calls[0]![0].taskUpdate,
    ).toBeNull();
  });

  it("completed 工单首次收到该事实时记 no_op，不重复 Outcome", async () => {
    const task = bundle({ state: "completed" });
    task.workOrders[0]!.state = "completed";
    const repository = buildRepository({ task });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      decision: "no_op",
      taskState: "completed",
      outcomeId: null,
      reasonCode: "WORK_ORDER_ALREADY_COMPLETED",
    });
    expect(
      repository.applyLifecycleFactReconciliation.mock.calls[0]![0].outcome,
    ).toBeNull();
  });

  it("同键同哈希返回原应用，同键异哈希明确冲突", async () => {
    const input = command();
    const existing: WorkOrderFactApplicationRecord = {
      id: "application-1",
      workOrderId: "work-1",
      businessFactKey: "lifecycle-node-application/event-1/node-1",
      requestHash: hashAppliedLifecycleWorkFact(input),
      decision: "applied",
      decisionReason: null,
      previousState: "ready",
      resultingState: "completed",
    };
    const replayRepository = buildRepository({ existing });
    const replayService = new ReconcileAppliedLifecycleFactService(
      replayRepository,
    );
    await expect(replayService.execute(input)).resolves.toMatchObject({
      factApplicationIds: ["application-1"],
      decision: "applied",
    });
    expect(
      replayRepository.applyLifecycleFactReconciliation,
    ).not.toHaveBeenCalled();

    const conflictRepository = buildRepository({ existing });
    const conflictService = new ReconcileAppliedLifecycleFactService(
      conflictRepository,
    );
    await expect(
      conflictService.execute(command({ captureSource: "manual_backfill" })),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it.each(["zero", "multiple", "unresolved"] as const)(
    "%s required 定义不唯一时返回 WORK_ORDER_DEFINITION_UNRESOLVED",
    async (kind) => {
      const task = bundle();
      if (kind === "zero") task.workOrders = [];
      if (kind === "multiple") {
        task.workOrders.push({ ...task.workOrders[0]!, id: "work-2" });
      }
      if (kind === "unresolved") {
        task.workOrders[0]!.workOrderDefinitionKey = "wo-other";
      }
      const repository = buildRepository({ task });
      const service = new ReconcileAppliedLifecycleFactService(repository);

      await expect(service.execute(command())).resolves.toMatchObject({
        decision: "rejected",
        reasonCode: "WORK_ORDER_DEFINITION_UNRESOLVED",
        factApplicationIds: [],
      });
      expect(
        repository.applyLifecycleFactReconciliation,
      ).not.toHaveBeenCalled();
    },
  );

  it("版本冲突后有上限地重读并重新求值", async () => {
    const repository = buildRepository();
    repository.applyLifecycleFactReconciliation
      .mockResolvedValueOnce({ kind: "version_conflict" })
      .mockImplementationOnce(
        async (input: ApplyLifecycleFactReconciliationInput) => ({
          kind: "committed" as const,
          factApplication: {
            id: input.factApplication.id,
            workOrderId: input.factApplication.workOrderId,
            businessFactKey: input.factApplication.businessFactKey,
            requestHash: input.factApplication.requestHash,
            decision: input.factApplication.decision.decision,
            decisionReason: input.factApplication.decision.reasonCode,
            previousState: input.factApplication.decision.previousState,
            resultingState: input.factApplication.decision.resultingState,
          },
          taskState: input.resultingTaskState,
          outcomeId: input.outcome?.id ?? null,
        }),
      );
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).resolves.toMatchObject({
      decision: "applied",
    });
    expect(repository.findTaskByNodeInstanceId).toHaveBeenCalledTimes(2);
    expect(repository.applyLifecycleFactReconciliation).toHaveBeenCalledTimes(
      2,
    );
  });

  it("连续版本冲突达到上限后返回稳定冲突码", async () => {
    const repository = buildRepository();
    repository.applyLifecycleFactReconciliation.mockResolvedValue({
      kind: "version_conflict",
    });
    const service = new ReconcileAppliedLifecycleFactService(repository);

    await expect(service.execute(command())).rejects.toThrow(
      "CONCURRENCY_VERSION_CONFLICT",
    );
    expect(repository.applyLifecycleFactReconciliation).toHaveBeenCalledTimes(
      3,
    );
  });
});
