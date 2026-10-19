import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { CandidateNotFoundError } from "../../modules/ops-assistant/domain/task-action-candidate.repository";
import { normalizeTaskActionDecision } from "../../modules/ops-assistant/domain/task-action-candidate";
import { PrismaTaskActionCandidateRepository } from "../../modules/ops-assistant/infrastructure/prisma-task-action-candidate.repository";
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
