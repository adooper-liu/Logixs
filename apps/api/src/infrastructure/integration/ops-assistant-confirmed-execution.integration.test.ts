import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { CandidateNotFoundError } from "../../modules/ops-assistant/domain/task-action-candidate.repository";
import { normalizeTaskActionDecision } from "../../modules/ops-assistant/domain/task-action-candidate";
import { PrismaTaskActionCandidateRepository } from "../../modules/ops-assistant/infrastructure/prisma-task-action-candidate.repository";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
} from "../../modules/ops-assistant/application/task-action-candidate.services";
import { ClaimWorkOrderService } from "../../modules/work-execution/application/claim-work-order.service";
import { PrismaWorkClientOperationRepository } from "../../modules/work-execution/infrastructure/prisma-client-operation.repository";
import { PrismaWorkExecutionRepository } from "../../modules/work-execution/infrastructure/prisma-work-execution.repository";
import { TaskAssistantClaimExecutionAdapter } from "../../modules/work-execution/infrastructure/task-assistant-claim-execution.adapter";
import type { TaskActionCandidateRepository } from "../../modules/ops-assistant/domain/task-action-candidate.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

let prisma: PrismaClient;
let repository: PrismaTaskActionCandidateRepository;

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(DATABASE_URL, "public"),
  });
  await prisma.$connect();
  repository = new PrismaTaskActionCandidateRepository(prisma as never);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe("ops assistant confirmed execution PostgreSQL foundation", () => {
  it("persists a candidate and decision while preserving typed references", async () => {
    const row = candidateRow();
    await createCandidate(row);
    await expect(
      repository.appendDecision(decisionInput(row)),
    ).resolves.toMatchObject({
      idempotencyReplay: false,
      decision: { decision: "accepted", executionState: "pending" },
    });
    await expect(
      repository.findCandidate({
        candidateId: row.candidateId,
        tenantId: row.tenantId,
        actorId: row.actorId,
      }),
    ).resolves.toMatchObject({
      candidateId: row.candidateId,
      source: { inputRefs: row.source.inputRefs },
      decisions: [expect.objectContaining({ decision: "accepted" })],
    });
  });

  it("allows repeated historical candidates with the same business hash and enforces one terminal decision", async () => {
    const row = candidateRow();
    await createCandidate(row);
    const duplicate = {
      ...row,
      candidateId: randomUUID(),
      source: {
        ...row.source,
        generatedAt: new Date(row.source.generatedAt.getTime() + 1_000),
      },
    };
    await expect(repository.createCandidate(duplicate)).resolves.toMatchObject({
      candidateHash: row.candidateHash,
      actorId: row.actorId,
      tenantId: row.tenantId,
      workOrderId: row.workOrderId,
    });
    await repository.appendDecision(decisionInput(row));
    await expect(
      repository.appendDecision(
        decisionInput(row, {
          decisionId: randomUUID(),
          idempotencyKey: "another-key",
        }),
      ),
    ).rejects.toThrow("CANDIDATE_ALREADY_DECIDED");
  });

  it("fails closed when candidate tenant, container, or work-order parent does not match the task", async () => {
    const wrongTenant = candidateRow();
    await seedCandidateParents(wrongTenant);
    await expect(
      repository.createCandidate({
        ...wrongTenant,
        tenantId: `${wrongTenant.tenantId}-other`,
      }),
    ).rejects.toBeInstanceOf(CandidateNotFoundError);

    const wrongContainer = candidateRow();
    await seedCandidateParents(wrongContainer);
    await expect(
      repository.createCandidate({
        ...wrongContainer,
        context: {
          ...wrongContainer.context,
          subjectRef: {
            kind: "container",
            id: randomUUID(),
          },
        },
      }),
    ).rejects.toBeInstanceOf(CandidateNotFoundError);

    const taskScope = candidateRow();
    const foreignWorkOrder = candidateRow();
    await seedCandidateParents(taskScope);
    await seedCandidateParents(foreignWorkOrder);
    await expect(
      repository.createCandidate({
        ...taskScope,
        workOrderId: foreignWorkOrder.workOrderId,
      }),
    ).rejects.toBeInstanceOf(CandidateNotFoundError);
  });

  it("accepts only a client operation coherent with the candidate scope", async () => {
    const mismatchOverrides = [
      { tenantId: `ai0-${randomUUID()}` },
      { actorId: "other-actor" },
      { actionCode: "work_execution.complete_work_order" },
      { targetId: randomUUID() },
    ];

    for (const override of mismatchOverrides) {
      const row = candidateRow();
      await createCandidate(row);
      const operation = await seedClientOperation(row, override);
      await expect(
        repository.appendDecision(
          decisionInput(row, {
            clientOperationId: operation.id,
            executionState: "applied",
            resultRefs: [
              {
                kind: "client_operation",
                id: operation.id,
                version: null,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(CandidateNotFoundError);
      await expect(
        prisma.opsAssistantActionDecision.count({
          where: { candidateId: row.candidateId },
        }),
      ).resolves.toBe(0);
    }

    const row = candidateRow();
    await createCandidate(row);
    const operation = await seedClientOperation(row);
    await expect(
      repository.appendDecision(
        decisionInput(row, {
          clientOperationId: operation.id,
          executionState: "applied",
          resultRefs: [
            {
              kind: "client_operation",
              id: operation.id,
              version: null,
            },
          ],
        }),
      ),
    ).resolves.toMatchObject({
      decision: { clientOperationId: operation.id, executionState: "applied" },
    });
  });

  it("rejects non-normalized warnings and arbitrary or unsorted input refs", async () => {
    const duplicateWarnings = candidateRow();
    await seedCandidateParents(duplicateWarnings);
    await expect(
      repository.createCandidate({
        ...duplicateWarnings,
        warningCodes: ["confirm_required", "confirm_required"],
      }),
    ).rejects.toThrow();

    const unsortedRefs = candidateRow();
    await seedCandidateParents(unsortedRefs);
    await expect(
      repository.createCandidate({
        ...unsortedRefs,
        source: {
          ...unsortedRefs.source,
          inputRefs: [
            { kind: "work_order", id: unsortedRefs.workOrderId, version: 0 },
            {
              kind: "node_task",
              id: unsortedRefs.context.workRef.id,
              version: 0,
            },
          ],
        },
      }),
    ).rejects.toThrow();

    const arbitraryRef = candidateRow();
    await seedCandidateParents(arbitraryRef);
    await expect(
      repository.createCandidate({
        ...arbitraryRef,
        source: {
          ...arbitraryRef.source,
          inputRefs: [
            {
              kind: "node_task",
              id: arbitraryRef.context.workRef.id,
              version: 0,
              payload: { forged: true },
            } as never,
          ],
        },
      }),
    ).rejects.toThrow();

    const incompleteModelSource = candidateRow();
    await seedCandidateParents(incompleteModelSource);
    await expect(
      repository.createCandidate({
        ...incompleteModelSource,
        source: {
          ...incompleteModelSource.source,
          kind: "model",
          promptVersion: null,
          modelId: null,
        },
      } as never),
    ).rejects.toThrow();
  });

  it("converges concurrent identical decisions", async () => {
    const row = candidateRow();
    await createCandidate(row);
    const input = decisionInput(row);
    const results = await Promise.all([
      repository.appendDecision(input),
      repository.appendDecision(input),
    ]);
    expect(
      results.map(({ idempotencyReplay }) => idempotencyReplay).sort(),
    ).toEqual([false, true]);
    expect(results[0].decision.decisionId).toBe(results[1].decision.decisionId);
  });

  it("fails closed for cross-tenant and same-tenant other-actor lookup", async () => {
    const row = candidateRow();
    await createCandidate(row);
    await expect(
      repository.findCandidate({
        candidateId: row.candidateId,
        tenantId: `${row.tenantId}-other`,
        actorId: row.actorId,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.findCandidate({
        candidateId: row.candidateId,
        tenantId: row.tenantId,
        actorId: "other-actor",
      }),
    ).resolves.toBeNull();
  });

  it.each(["ops_assistant_action_candidate", "ops_assistant_action_decision"])(
    "rejects UPDATE and DELETE on append-only %s",
    async (table) => {
      const row = candidateRow();
      await createCandidate(row);
      const decision = decisionInput(row);
      if (table.endsWith("decision")) await repository.appendDecision(decision);
      const id = table.endsWith("decision")
        ? decision.decision.decisionId
        : row.candidateId;
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "recorded_at" = NOW() WHERE "id" = $1::uuid`,
          id,
        ),
      ).rejects.toThrow("append-only");
      await expect(
        prisma.$executeRawUnsafe(
          `DELETE FROM "${table}" WHERE "id" = $1::uuid`,
          id,
        ),
      ).rejects.toThrow("append-only");
    },
  );

  it("exposes candidate foreign keys and decision lookup indexes", async () => {
    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conrelid IN (
        'ops_assistant_action_candidate'::regclass,
        'ops_assistant_action_decision'::regclass
      )
    `;
    const indexes = await prisma.$queryRaw<
      Array<{ name: string; definition: string }>
    >`
      SELECT indexname AS name, indexdef AS definition
      FROM pg_indexes
      WHERE tablename IN (
        'ops_assistant_action_candidate',
        'ops_assistant_action_decision'
      )
    `;
    expect(constraints.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "ops_assistant_action_candidate_task_fkey",
        "ops_assistant_action_candidate_work_order_fkey",
        "ops_assistant_action_decision_candidate_fkey",
        "ops_assistant_action_decision_links_check",
      ]),
    );
    expect(indexes.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "ops_assistant_action_candidate_actor_idx",
        "ops_assistant_action_candidate_hash_idx",
        "ops_assistant_action_decision_candidate_idx",
      ]),
    );
    expect(
      indexes.find(
        ({ name }) => name === "ops_assistant_action_candidate_hash_idx",
      )?.definition,
    ).not.toContain("UNIQUE");
  });

  it("does not change existing free-text assistant session/message persistence", async () => {
    const session = await prisma.opsAssistantSession.create({
      data: { tenantId: `ai0-${randomUUID()}`, actorId: "actor-a" },
    });
    const message = await prisma.opsAssistantMessage.create({
      data: { sessionId: session.id, role: "user", body: "read-only question" },
    });
    await expect(
      prisma.opsAssistantMessage.findUnique({ where: { id: message.id } }),
    ).resolves.toMatchObject({ body: "read-only question", role: "user" });
  });
});

describe("AI1 confirmed claim PostgreSQL control chain", () => {
  it("closes tenant, actor and task scope while preserving the owner view", async () => {
    const runtime = buildRuntime();
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));

    await expect(
      runtime.get.execute(getCommand(context, generated.candidateId)),
    ).resolves.toMatchObject({ candidateId: generated.candidateId });
    await expect(
      runtime.get.execute({
        ...getCommand(context, generated.candidateId),
        tenantId: `${context.tenantId}-other`,
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      runtime.get.execute({
        ...getCommand(context, generated.candidateId),
        actorId: "actor-b",
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      runtime.get.execute({
        ...getCommand(context, generated.candidateId),
        taskId: randomUUID(),
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("rejects a drifted snapshot with zero business writes", async () => {
    const runtime = buildRuntime();
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));
    await prisma.nodeTask.update({
      where: { id: context.taskId },
      data: { version: { increment: 1 } },
    });

    await expect(
      runtime.confirm.execute(confirmCommand(context, generated)),
    ).rejects.toMatchObject({ status: 409 });
    await expect(decisionCount(generated.candidateId)).resolves.toBe(0);
    await expect(operationCount(context)).resolves.toBe(0);
    await expect(
      prisma.workOrder.findUnique({ where: { id: context.workOrderId } }),
    ).resolves.toMatchObject({
      assignmentState: "unassigned",
      assigneeId: null,
    });
  });

  it("reject writes one immutable decision and zero work-execution facts", async () => {
    const runtime = buildRuntime();
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));
    const input = rejectCommand(context, generated.candidateId);
    const first = await runtime.reject.execute(input);
    const replay = await runtime.reject.execute(input);

    expect(replay.decisionId).toBe(first.decisionId);
    await expect(decisionCount(generated.candidateId)).resolves.toBe(1);
    await expect(operationCount(context)).resolves.toBe(0);
    await expect(
      prisma.workOrder.findUnique({ where: { id: context.workOrderId } }),
    ).resolves.toMatchObject({
      assignmentState: "unassigned",
      assigneeId: null,
    });
  });

  it("converges same-key confirm replay and rejects a different second key", async () => {
    const runtime = buildRuntime();
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));
    const input = confirmCommand(context, generated);
    const first = await runtime.confirm.execute(input);
    const replay = await runtime.confirm.execute(input);

    expect(replay.idempotencyReplay).toBe(true);
    expect(replay.claimWorkOrderResult.clientOperationId).toBe(
      first.claimWorkOrderResult.clientOperationId,
    );
    await expect(
      runtime.confirm.execute({
        ...input,
        command: { ...input.command, idempotencyKey: "different-key" },
      }),
    ).rejects.toThrow("CANDIDATE_ALREADY_DECIDED");
    const persistedDecision =
      await prisma.opsAssistantActionDecision.findUnique({
        where: { candidateId: generated.candidateId },
      });
    const persistedOperation = await prisma.clientOperation.findUnique({
      where: { id: first.claimWorkOrderResult.clientOperationId },
    });
    expect(persistedDecision).toMatchObject({
      decision: "accepted",
      clientOperationId: first.claimWorkOrderResult.clientOperationId,
      traceId: persistedOperation?.traceId,
      executionState: "applied",
    });
    expect(persistedDecision?.resultRefs).toEqual(
      expect.arrayContaining([
        { kind: "container", id: context.containerId, version: null },
        { kind: "node_task", id: context.taskId, version: null },
        { kind: "work_order", id: context.workOrderId, version: null },
        {
          kind: "client_operation",
          id: first.claimWorkOrderResult.clientOperationId,
          version: null,
        },
      ]),
    );
    await expect(
      prisma.workOrder.findUnique({ where: { id: context.workOrderId } }),
    ).resolves.toMatchObject({
      assignmentState: "assigned",
      assigneeId: context.actorId,
    });
    await expect(
      prisma.nodeTask.findUnique({ where: { id: context.taskId } }),
    ).resolves.toMatchObject({ state: "in_progress" });
    await expect(decisionCount(generated.candidateId)).resolves.toBe(1);
    await expect(operationCount(context)).resolves.toBe(1);
  });

  it("serializes concurrent confirms at the PostgreSQL candidate lock", async () => {
    const gate = barrier(2);
    const realRepository = new PrismaTaskActionCandidateRepository(
      prisma as never,
    );
    const runtime = buildRuntime(withEntryBarrier(realRepository, gate));
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));
    const results = await Promise.all([
      runtime.confirm.execute(confirmCommand(context, generated)),
      runtime.confirm.execute(confirmCommand(context, generated)),
    ]);

    expect(
      results.map(({ idempotencyReplay }) => idempotencyReplay).sort(),
    ).toEqual([false, true]);
    expect(results[0].claimWorkOrderResult.clientOperationId).toBe(
      results[1].claimWorkOrderResult.clientOperationId,
    );
    await expect(decisionCount(generated.candidateId)).resolves.toBe(1);
    await expect(operationCount(context)).resolves.toBe(1);
  });

  it("serializes concurrent confirm and reject without a rejected-but-claimed split", async () => {
    const gate = barrier(2);
    const realRepository = new PrismaTaskActionCandidateRepository(
      prisma as never,
    );
    const runtime = buildRuntime(withEntryBarrier(realRepository, gate));
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));
    const settled = await Promise.allSettled([
      runtime.confirm.execute(confirmCommand(context, generated)),
      runtime.reject.execute(rejectCommand(context, generated.candidateId)),
    ]);

    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const decision = await prisma.opsAssistantActionDecision.findUnique({
      where: { candidateId: generated.candidateId },
    });
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: context.workOrderId },
    });
    expect(decision).not.toBeNull();
    if (decision?.decision === "rejected") {
      expect(workOrder).toMatchObject({
        assignmentState: "unassigned",
        assigneeId: null,
      });
      await expect(operationCount(context)).resolves.toBe(0);
    } else {
      expect(workOrder).toMatchObject({
        assignmentState: "assigned",
        assigneeId: context.actorId,
      });
      await expect(operationCount(context)).resolves.toBe(1);
    }
  });

  it("recovers the same receipt after claim commit but decision/response loss", async () => {
    const realRepository = new PrismaTaskActionCandidateRepository(
      prisma as never,
    );
    const requestTraces = [
      "server-first-request-trace",
      "server-second-request-trace",
    ];
    const traceFactory = () => requestTraces.shift() ?? randomUUID();
    const context = await seedClaimContext();
    const initial = buildRuntime(realRepository, traceFactory);
    const generated = await initial.generate.execute(generateCommand(context));
    const lossy = buildRuntime(
      responseLossAfterClaim(realRepository),
      traceFactory,
    );

    await expect(
      lossy.confirm.execute(confirmCommand(context, generated)),
    ).rejects.toThrow("SIMULATED_RESPONSE_LOSS");
    const committed = await prisma.clientOperation.findFirst({
      where: { tenantId: context.tenantId, idempotencyKey: "confirm-1" },
    });
    expect(committed).toMatchObject({ commitState: "committed" });
    await expect(decisionCount(generated.candidateId)).resolves.toBe(0);

    const recovered = await initial.confirm.execute(
      confirmCommand(context, generated),
    );
    expect(recovered.idempotencyReplay).toBe(true);
    expect(recovered.claimWorkOrderResult.clientOperationId).toBe(
      committed?.id,
    );
    const recoveredDecision =
      await prisma.opsAssistantActionDecision.findUnique({
        where: { candidateId: generated.candidateId },
      });
    expect(committed?.traceId).toBe("server-first-request-trace");
    expect(recoveredDecision?.traceId).toBe(committed?.traceId);
    expect(recoveredDecision?.traceId).not.toBe("server-second-request-trace");
    expect(requestTraces).toEqual([]);
    await expect(decisionCount(generated.candidateId)).resolves.toBe(1);
    await expect(operationCount(context)).resolves.toBe(1);
  });

  it("writes no accepted decision when the official claim conflicts", async () => {
    const runtime = buildRuntime();
    const context = await seedClaimContext();
    const generated = await runtime.generate.execute(generateCommand(context));
    const original = await runtime.execution.resolve({
      tenantId: context.tenantId,
      taskId: context.taskId,
      subjectRef: { kind: "container", id: context.containerId },
      workOrderId: context.workOrderId,
    });
    await prisma.workOrder.update({
      where: { id: context.workOrderId },
      data: { assignmentState: "assigned", assigneeId: "actor-b" },
    });
    const staleProjectionExecution = {
      ...runtime.execution,
      resolve: async () => original,
      claim: runtime.execution.claim.bind(runtime.execution),
      findClaimReceipt: runtime.execution.findClaimReceipt.bind(
        runtime.execution,
      ),
    };
    const confirm = new ConfirmTaskActionCandidateService(
      runtime.repository,
      staleProjectionExecution as never,
      randomUUID,
    );

    await expect(
      confirm.execute(confirmCommand(context, generated)),
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(decisionCount(generated.candidateId)).resolves.toBe(0);
  });
});

function buildRuntime(
  candidateRepository: TaskActionCandidateRepository = new PrismaTaskActionCandidateRepository(
    prisma as never,
  ),
  traceFactory: () => string = randomUUID,
) {
  const workRepository = new PrismaWorkExecutionRepository(prisma as never);
  const operations = new PrismaWorkClientOperationRepository(prisma as never);
  const claim = new ClaimWorkOrderService(workRepository, operations, {
    execute: async () => undefined,
  } as never);
  const execution = new TaskAssistantClaimExecutionAdapter(
    workRepository,
    operations,
    claim,
  );
  const explanation = {
    explainTaskClaim: async () => ({
      kind: "rule" as const,
      rationale: "The current work order is ready and unassigned.",
      impact: "Confirming assigns responsibility to the current actor.",
      warningCodes: ["confirm_required"],
      modelId: null,
      promptVersion: null,
    }),
  };
  return {
    repository: candidateRepository,
    execution,
    generate: new GenerateTaskActionCandidateService(
      candidateRepository,
      execution,
      explanation as never,
    ),
    get: new GetTaskActionCandidateService(candidateRepository, execution),
    reject: new RejectTaskActionCandidateService(candidateRepository),
    confirm: new ConfirmTaskActionCandidateService(
      candidateRepository,
      execution,
      traceFactory,
    ),
  };
}

function withEntryBarrier(
  delegate: TaskActionCandidateRepository,
  wait: () => Promise<void>,
): TaskActionCandidateRepository {
  return {
    createCandidate: (input) => delegate.createCandidate(input),
    findCandidate: (input) => delegate.findCandidate(input),
    appendDecision: (input) => delegate.appendDecision(input),
    appendDecisionWithLock: async (input, build) => {
      await wait();
      return delegate.appendDecisionWithLock(input, build);
    },
  };
}

function responseLossAfterClaim(
  delegate: TaskActionCandidateRepository,
): TaskActionCandidateRepository {
  return {
    createCandidate: (input) => delegate.createCandidate(input),
    findCandidate: (input) => delegate.findCandidate(input),
    appendDecision: (input) => delegate.appendDecision(input),
    appendDecisionWithLock: async (input, build) => {
      const candidate = await delegate.findCandidate(input);
      if (!candidate) throw new Error("CANDIDATE_NOT_FOUND");
      await build(candidate);
      throw new Error("SIMULATED_RESPONSE_LOSS");
    },
  };
}

function barrier(parties: number) {
  let arrived = 0;
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === parties) release?.();
    await ready;
  };
}

async function seedClaimContext() {
  const suffix = randomUUID();
  const context = {
    tenantId: `ai1-${suffix}`,
    actorId: "actor-a",
    containerId: randomUUID(),
    taskId: randomUUID(),
    workOrderId: randomUUID(),
  };
  await prisma.nodeTask.create({
    data: {
      id: context.taskId,
      tenantId: context.tenantId,
      flowInstanceId: randomUUID(),
      nodeInstanceId: randomUUID(),
      nodeCode: "customs_clearance",
      containerId: context.containerId,
      taskDefinitionKey: "ai1-confirmed-claim",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
      version: 4,
    },
  });
  await prisma.workOrder.create({
    data: {
      id: context.workOrderId,
      nodeTaskId: context.taskId,
      workOrderDefinitionKey: "ai1-claim",
      state: "ready",
      applicability: "required",
      assignmentState: "unassigned",
      version: 2,
    },
  });
  return context;
}

function generateCommand(
  context: Awaited<ReturnType<typeof seedClaimContext>>,
) {
  return {
    tenantId: context.tenantId,
    actorId: context.actorId,
    capabilities: ["task.read"],
    taskId: context.taskId,
    command: {
      contractVersion: "task-action-candidate-generate.v1" as const,
      subjectRef: { kind: "container" as const, id: context.containerId },
      workRef: { kind: "node_task" as const, id: context.taskId },
    },
  };
}

function getCommand(
  context: Awaited<ReturnType<typeof seedClaimContext>>,
  candidateId: string,
) {
  return {
    tenantId: context.tenantId,
    actorId: context.actorId,
    capabilities: ["task.read"],
    taskId: context.taskId,
    candidateId,
  };
}

function confirmCommand(
  context: Awaited<ReturnType<typeof seedClaimContext>>,
  candidate: { candidateId: string; candidateHash: string },
) {
  return {
    ...getCommand(context, candidate.candidateId),
    capabilities: ["task.read", "task.execute"],
    command: {
      contractVersion: "task-action-candidate-confirm.v1" as const,
      candidateId: candidate.candidateId,
      candidateHash: candidate.candidateHash,
      idempotencyKey: "confirm-1",
    },
  };
}

function rejectCommand(
  context: Awaited<ReturnType<typeof seedClaimContext>>,
  candidateId: string,
) {
  return {
    ...getCommand(context, candidateId),
    command: {
      contractVersion: "task-action-candidate-reject.v1" as const,
      candidateId,
      reason: "not applicable now",
    },
  };
}

function decisionCount(candidateId: string) {
  return prisma.opsAssistantActionDecision.count({ where: { candidateId } });
}

function operationCount(context: Awaited<ReturnType<typeof seedClaimContext>>) {
  return prisma.clientOperation.count({
    where: {
      tenantId: context.tenantId,
      actorId: context.actorId,
      actionCode: "work_execution.claim_work_order",
      targetId: context.workOrderId,
    },
  });
}

function candidateRow() {
  const suffix = randomUUID();
  return {
    candidateId: randomUUID(),
    tenantId: `ai0-${suffix}`,
    actorId: "actor-a",
    context: {
      subjectRef: { kind: "container" as const, id: randomUUID() },
      workRef: { kind: "node_task" as const, id: randomUUID() },
    },
    workOrderId: randomUUID(),
    actionCode: "work_execution.claim_work_order" as const,
    actionVersion: 1 as const,
    title: "Claim current work order",
    rationale: "The work order is ready and unassigned.",
    impact: "Responsibility moves to the current actor.",
    riskLevel: "low" as const,
    warningCodes: ["confirm_required"],
    status: "proposed" as const,
    candidateHash: suffix.replaceAll("-", "").padEnd(64, "0").slice(0, 64),
    source: {
      kind: "rule" as const,
      capabilityId: "task.claim-assistance" as const,
      capabilityVersion: 1 as const,
      schemaVersion: 1 as const,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: "a".repeat(64),
      inputRefs: [] as const,
      generatedAt: new Date(),
    },
  };
}

function decisionInput(
  candidate: ReturnType<typeof candidateRow>,
  override: Partial<{
    decisionId: string;
    decision: "accepted" | "rejected";
    reason: string | null;
    idempotencyKey: string;
    decidedAt: string;
    clientOperationId: string | null;
    traceId: string | null;
    executionState: "pending" | "applied" | "failed" | null;
    resultRefs: ReadonlyArray<{
      kind: "container" | "node_task" | "work_order" | "client_operation";
      id: string;
      version: number | null;
    }>;
  }> = {},
) {
  const decisionId = randomUUID();
  return {
    candidateId: candidate.candidateId,
    tenantId: candidate.tenantId,
    actorId: candidate.actorId,
    decision: normalizeTaskActionDecision({
      decisionId,
      decision: "accepted" as const,
      reason: null,
      idempotencyKey: `confirm-${decisionId}`,
      decidedAt: new Date().toISOString(),
      clientOperationId: null,
      traceId: null,
      executionState: "pending" as const,
      resultRefs: [] as const,
      ...override,
    }),
  };
}

async function seedClientOperation(
  candidate: ReturnType<typeof candidateRow>,
  override: Partial<{
    tenantId: string;
    actorId: string;
    actionCode: string;
    targetId: string;
  }> = {},
) {
  const id = randomUUID();
  return prisma.clientOperation.create({
    data: {
      id,
      tenantId: candidate.tenantId,
      actorType: "user",
      actorId: candidate.actorId,
      actionCode: "work_execution.claim_work_order",
      actionVersion: 1,
      targetType: "work_order",
      targetId: candidate.workOrderId,
      targetOwnerModule: "work-execution",
      correlationId: randomUUID(),
      causationId: null,
      traceId: `trace-${id}`,
      idempotencyKey: `claim-${id}`,
      requestHash: "c".repeat(64),
      receptionState: "accepted",
      businessDecisionState: "accepted",
      commitState: "committed",
      resultRefs: [],
      rejectionReasonCode: null,
      ...override,
    },
  });
}

async function createCandidate(candidate: ReturnType<typeof candidateRow>) {
  await seedCandidateParents(candidate);
  return repository.createCandidate(candidate);
}

async function seedCandidateParents(
  candidate: ReturnType<typeof candidateRow>,
) {
  await prisma.nodeTask.create({
    data: {
      id: candidate.context.workRef.id,
      tenantId: candidate.tenantId,
      flowInstanceId: randomUUID(),
      nodeInstanceId: randomUUID(),
      nodeCode: "customs_clearance",
      containerId: candidate.context.subjectRef.id,
      taskDefinitionKey: "ai0-confirmed-claim",
      state: "in_progress",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "awaiting_evidence",
      conditionFactRefs: [],
    },
  });
  await prisma.workOrder.create({
    data: {
      id: candidate.workOrderId,
      nodeTaskId: candidate.context.workRef.id,
      workOrderDefinitionKey: "ai0-claim",
      state: "ready",
      applicability: "required",
      assignmentState: "unassigned",
    },
  });
}
