import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Prisma } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { DecideEvidenceService } from "../../modules/document-records/application/decide-evidence.service";
import { ResolveTaskCollaborationEvidenceService } from "../../modules/document-records/application/resolve-task-collaboration-evidence.service";
import { PrismaEvidenceRepository } from "../../modules/document-records/infrastructure/prisma-evidence.repository";
import { PrismaTaskCollaborationEvidenceWrite } from "../../modules/document-records/infrastructure/prisma-task-collaboration-evidence-write";
import { ListTaskCollaborationService } from "../../modules/task-collaboration/application/list-task-collaboration.service";
import { PostTaskCollaborationService } from "../../modules/task-collaboration/application/post-task-collaboration.service";
import type { TaskCollaborationRepository } from "../../modules/task-collaboration/domain/task-collaboration.repository";
import { PrismaTaskCollaborationRepository } from "../../modules/task-collaboration/infrastructure/prisma-task-collaboration.repository";
import { PrismaWorkExecutionRepository } from "../../modules/work-execution/infrastructure/prisma-work-execution.repository";
import { PrismaTaskCollaborationWriteContext } from "../../modules/work-execution/infrastructure/prisma-task-collaboration-write-context";
import { WorkExecutionTaskCollaborationContext } from "../../modules/work-execution/work-execution.module";

const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const tenantA = `tc-${randomUUID()}-a`;
const tenantB = `tc-${randomUUID()}-b`;
const actorA = "field-operator-a";
const actorB = "dispatcher-b";
const containerA = randomUUID();
const containerB = randomUUID();
const taskA = randomUUID();
const taskB = randomUUID();
const completedTask = randomUUID();
const cancelledTask = randomUUID();
const nullContainerTask = randomUUID();
const evidenceA = randomUUID();
const evidenceB = randomUUID();
const evidenceRevoked = randomUUID();
const evidenceWrongContainer = randomUUID();
const capabilities = ["task.read", "task.collaborate", "evidence.read"];

let prisma: PrismaClient;
let listService: ListTaskCollaborationService;
let postService: PostTaskCollaborationService;
let context: WorkExecutionTaskCollaborationContext;
let evidence: ResolveTaskCollaborationEvidenceService;
let repository: PrismaTaskCollaborationRepository;

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(DATABASE_URL, "public"),
  });
  await prisma.$connect();
  await seed();
  context = new WorkExecutionTaskCollaborationContext(
    new PrismaWorkExecutionRepository(prisma as never),
  );
  evidence = new ResolveTaskCollaborationEvidenceService(
    new PrismaEvidenceRepository(prisma as never),
  );
  repository = new PrismaTaskCollaborationRepository(
    prisma as never,
    new PrismaTaskCollaborationWriteContext(),
    new PrismaTaskCollaborationEvidenceWrite(),
  );
  listService = new ListTaskCollaborationService(context, evidence, repository);
  postService = new PostTaskCollaborationService(context, evidence, repository);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe("task collaboration PostgreSQL integration", () => {
  it("resolves only the exact tenant/task/container and projects deduped assignees", async () => {
    await expect(
      context.resolve({
        tenantId: tenantA,
        taskId: taskA,
        subjectRef: { kind: "container", id: containerA },
      }),
    ).resolves.toMatchObject({
      taskId: taskA,
      state: "in_progress",
      containerId: containerA,
      assigneeActorIds: [actorB],
    });
    for (const input of [
      { tenantId: tenantB, taskId: taskA, containerId: containerA },
      { tenantId: tenantA, taskId: taskA, containerId: containerB },
      { tenantId: tenantA, taskId: randomUUID(), containerId: containerA },
      { tenantId: tenantA, taskId: nullContainerTask, containerId: containerA },
    ]) {
      await expect(
        context.resolve({
          tenantId: input.tenantId,
          taskId: input.taskId,
          subjectRef: { kind: "container", id: input.containerId },
        }),
      ).resolves.toBeNull();
    }
  });

  it("revalidates exact EvidenceRefs without exposing content", async () => {
    await expect(
      evidence.resolveExact({
        tenantId: tenantA,
        subjectRef: { kind: "container", id: containerA },
        evidenceRecordIds: [evidenceA],
      }),
    ).resolves.toEqual([{ evidenceRecordId: evidenceA, label: evidenceA }]);

    for (const evidenceRecordId of [
      randomUUID(),
      evidenceB,
      evidenceRevoked,
      evidenceWrongContainer,
    ]) {
      await expect(
        evidence.resolveExact({
          tenantId: tenantA,
          subjectRef: { kind: "container", id: containerA },
          evidenceRecordIds: [evidenceRecordId],
        }),
      ).rejects.toThrow("RESOURCE_NOT_FOUND");
    }
  });

  it("filters historical EvidenceRefs per request capability and current database scope", async () => {
    const posted = await postService.execute(
      postInput(taskA, containerA, `evidence-filter-${randomUUID()}`),
    );
    await prisma.taskCollaborationMessageEvidenceRef.createMany({
      data: [evidenceA, evidenceB, evidenceRevoked, evidenceWrongContainer].map(
        (evidenceRecordId) => ({
          messageId: posted.message.messageId,
          evidenceRecordId,
        }),
      ),
    });
    await prisma.taskCollaborationMessageSourceRef.create({
      data: {
        messageId: posted.message.messageId,
        sourceKind: "action",
        sourceId: "historical-unresolved-source",
        sourceVersion: 1,
      },
    });

    const readable = await listService.execute({
      ...listInput(taskA, containerA),
      pageSize: "100",
    });
    const readableMessage = readable.messages.find(
      ({ messageId }) => messageId === posted.message.messageId,
    );
    expect(readableMessage?.evidenceRefs).toEqual([
      { kind: "evidence_record", id: evidenceA },
    ]);
    expect(readableMessage?.sourceRefs).toEqual([]);

    const redacted = await listService.execute({
      ...listInput(taskA, containerA),
      capabilities: ["task.read"],
      pageSize: "100",
    });
    const redactedMessage = redacted.messages.find(
      ({ messageId }) => messageId === posted.message.messageId,
    );
    expect(redactedMessage).toMatchObject({
      body: "integration collaboration message",
      evidenceRefs: [],
    });
    expect(redacted.evidenceOptions).toEqual([]);
  });

  it("allows evidence-free posts without evidence.read but rejects EvidenceRefs", async () => {
    await expect(
      postService.execute({
        ...postInput(taskA, containerA, `no-evidence-cap-${randomUUID()}`),
        capabilities: ["task.read", "task.collaborate"],
      }),
    ).resolves.toMatchObject({ idempotencyReplay: false });

    const before = await prisma.taskCollaborationMessage.count();
    await expect(
      postService.execute({
        ...postInput(taskA, containerA, `forbidden-evidence-${randomUUID()}`, {
          evidenceRecordIds: [evidenceA],
        }),
        capabilities: ["task.read", "task.collaborate"],
      }),
    ).rejects.toThrow("AUTHORIZATION_FORBIDDEN");
    await expect(prisma.taskCollaborationMessage.count()).resolves.toBe(before);
  });

  it.each([
    [completedTask, "TASK_COMPLETED_READ_ONLY"],
    [cancelledTask, "TASK_CANCELLED_READ_ONLY"],
  ])(
    "allows terminal GET for %s but rejects POST without writing",
    async (taskId, reason) => {
      await expect(
        listService.execute(listInput(taskId, containerA)),
      ).resolves.toMatchObject({
        canPost: false,
        postDisabledReason: reason,
      });
      const before = await prisma.taskCollaborationMessage.count();
      await expect(
        postService.execute(
          postInput(taskId, containerA, `terminal-${taskId}`),
        ),
      ).rejects.toThrow("BUSINESS_STATE_VIOLATION");
      await expect(prisma.taskCollaborationMessage.count()).resolves.toBe(
        before,
      );
    },
  );

  it("rejects non-empty sourceRefs with zero collaboration writes", async () => {
    const scenario = await createScenario();
    const before = await collaborationCounts();

    await expect(
      postService.execute(
        postInput(scenario.taskId, scenario.containerId, randomUUID(), {
          sourceRefs: [{ kind: "action", id: "unsupported", version: null }],
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(collaborationCounts()).resolves.toEqual(before);
  });

  it("rejects cross-scope task, unknown Mention, invisible EvidenceRef and invalid parent", async () => {
    await expect(
      postService.execute(postInput(taskA, containerB, "wrong-subject")),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      postService.execute({
        ...postInput(taskA, containerA, "unknown-mention"),
        command: {
          ...postInput(taskA, containerA, "unknown-mention").command,
          mentionActorIds: ["unknown-actor"],
        },
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      postService.execute({
        ...postInput(taskA, containerA, "invisible-evidence"),
        command: {
          ...postInput(taskA, containerA, "invisible-evidence").command,
          evidenceRecordIds: [evidenceB],
        },
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      postService.execute({
        ...postInput(taskA, containerA, "missing-parent"),
        command: {
          ...postInput(taskA, containerA, "missing-parent").command,
          parentMessageId: randomUUID(),
        },
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("atomically writes supported joins and replays the same key while conflicting on another payload", async () => {
    const input = postInput(taskA, containerA, "replay-key", {
      mentionActorIds: [actorB],
      evidenceRecordIds: [evidenceA],
    });
    const first = await postService.execute(input);
    const replay = await postService.execute(input);

    expect(replay.idempotencyReplay).toBe(true);
    expect(replay.message.messageId).toBe(first.message.messageId);
    await expect(
      postService.execute({
        ...input,
        command: { ...input.command, body: "different body" },
      }),
    ).rejects.toThrow("IDEMPOTENCY_KEY_CONFLICT");
    await expect(
      prisma.taskCollaborationMessageMention.count({
        where: { messageId: first.message.messageId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.taskCollaborationMessageEvidenceRef.count({
        where: { messageId: first.message.messageId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.taskCollaborationMessageSourceRef.count({
        where: { messageId: first.message.messageId },
      }),
    ).resolves.toBe(0);
  });

  it.each(["task", "evidence"] as const)(
    "revalidates and locks mutable %s state after the application precheck barrier",
    async (target) => {
      const scenario = await createScenario();
      const before = await collaborationCounts();
      const barrier = appendBarrier(repository);
      const service = new PostTaskCollaborationService(
        context,
        evidence,
        barrier.repository,
      );
      const posting = service.execute(
        postInput(scenario.taskId, scenario.containerId, randomUUID(), {
          evidenceRecordIds: target === "evidence" ? [scenario.evidenceId] : [],
        }),
      );

      await barrier.entered;
      if (target === "task") {
        await prisma.nodeTask.update({
          where: { id: scenario.taskId },
          data: { state: "cancelled" },
        });
      } else {
        await prisma.evidenceRecord.update({
          where: { id: scenario.evidenceId },
          data: { validity: "revoked" },
        });
      }
      barrier.release();

      await expect(posting).rejects.toThrow(
        target === "task" ? "BUSINESS_STATE_VIOLATION" : "RESOURCE_NOT_FOUND",
      );
      await expect(collaborationCounts()).resolves.toEqual(before);
    },
  );

  it("replays a response-loss submission before changed task, evidence, and assignee facts", async () => {
    const scenario = await createScenario();
    const input = postInput(
      scenario.taskId,
      scenario.containerId,
      randomUUID(),
      {
        mentionActorIds: [actorB],
        evidenceRecordIds: [scenario.evidenceId],
      },
    );
    const first = await postService.execute(input);

    await prisma.nodeTask.update({
      where: { id: scenario.taskId },
      data: { state: "completed" },
    });
    const afterCompletion = await postService.execute(input);
    expect(afterCompletion).toMatchObject({
      idempotencyReplay: true,
      message: {
        messageId: first.message.messageId,
        evidenceRefs: [{ kind: "evidence_record", id: scenario.evidenceId }],
      },
    });

    await prisma.evidenceRecord.update({
      where: { id: scenario.evidenceId },
      data: { validity: "revoked" },
    });
    const afterRevocation = await postService.execute(input);
    expect(afterRevocation).toMatchObject({
      idempotencyReplay: true,
      message: { messageId: first.message.messageId, evidenceRefs: [] },
    });

    await prisma.workOrder.update({
      where: { id: scenario.workOrderId },
      data: { assigneeId: "replacement-assignee" },
    });
    const afterAssigneeChange = await postService.execute(input);
    expect(afterAssigneeChange).toMatchObject({
      idempotencyReplay: true,
      message: { messageId: first.message.messageId, evidenceRefs: [] },
    });
    await expect(
      prisma.taskCollaborationMessage.count({
        where: { id: first.message.messageId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.taskCollaborationMessageMention.count({
        where: { messageId: first.message.messageId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.taskCollaborationMessageEvidenceRef.count({
        where: { messageId: first.message.messageId },
      }),
    ).resolves.toBe(1);
  });

  it("serializes concurrent first post to one thread and converges concurrent replay", async () => {
    const firstKey = `first-${randomUUID()}`;
    const results = await Promise.all([
      postService.execute(postInput(taskB, containerB, firstKey)),
      postService.execute(postInput(taskB, containerB, `${firstKey}-other`)),
    ]);
    expect(new Set(results.map(({ message }) => message.threadId)).size).toBe(
      1,
    );
    await expect(
      prisma.taskCollaborationThread.count({
        where: { tenantId: tenantB, workId: taskB, subjectId: containerB },
      }),
    ).resolves.toBe(1);

    const same = postInput(taskB, containerB, `same-${randomUUID()}`);
    const sameResults = await Promise.all([
      postService.execute(same),
      postService.execute(same),
    ]);
    expect(
      new Set(sameResults.map(({ message }) => message.messageId)).size,
    ).toBe(1);
  });

  it("runs readiness refresh and collaboration append with one work-order-first lock order", async () => {
    const scenario = await createReadinessScenario();
    const readinessLock = transactionQueryBarrier(
      (sql) => sql.includes('FROM "work_order"'),
      "after",
    );
    const refreshRepository = new PrismaWorkExecutionRepository({
      $transaction: <T>(
        callback: (transaction: Prisma.TransactionClient) => Promise<T>,
      ) =>
        prisma.$transaction((transaction) =>
          callback(readinessLock.wrap(transaction)),
        ),
    } as never);
    const collaborationAttempt = signalBarrier();
    const overlapRepository = new PrismaTaskCollaborationRepository(
      prisma as never,
      {
        lock: async (transaction, input) => {
          collaborationAttempt.enter();
          return new PrismaTaskCollaborationWriteContext().lock(
            transaction,
            input,
          );
        },
      },
      new PrismaTaskCollaborationEvidenceWrite(),
    );
    const overlapService = new PostTaskCollaborationService(
      context,
      evidence,
      overlapRepository,
    );

    const refreshing = refreshRepository.upsertTaskWithRequiredWorkOrder({
      tenantId: tenantA,
      flowInstanceId: scenario.flowInstanceId,
      nodeInstanceId: scenario.nodeInstanceId,
      nodeCode: "container_stuffing",
      containerId: scenario.containerId,
      taskDefinitionKey: "task-collaboration-readiness",
      workOrderDefinitionKey: "collaboration-assignee",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["readiness-fact"],
    });
    await readinessLock.entered;
    const posting = overlapService.execute(
      postInput(scenario.taskId, scenario.containerId, randomUUID(), {
        mentionActorIds: [actorB],
        evidenceRecordIds: [scenario.evidenceId],
      }),
    );
    await collaborationAttempt.entered;
    readinessLock.release();

    const [refreshed, posted] = await Promise.all([refreshing, posting]);
    expect(refreshed.task).toMatchObject({
      id: scenario.taskId,
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["readiness-fact"],
    });
    await expect(
      prisma.workOrder.findUnique({ where: { id: scenario.workOrderId } }),
    ).resolves.toMatchObject({ state: "ready" });
    await expect(
      prisma.taskCollaborationMessage.findUnique({
        where: { id: posted.message.messageId },
        include: { mentions: true, evidenceRefs: true },
      }),
    ).resolves.toMatchObject({
      mentions: [{ actorId: actorB }],
      evidenceRefs: [{ evidenceRecordId: scenario.evidenceId }],
    });
  }, 15_000);

  it("serializes collaboration-first evidence revoke without deadlock or stale joins", async () => {
    const scenario = await createVerifiedScenario();
    const collaborationEvidenceLock = signalBarrier();
    const overlapRepository = new PrismaTaskCollaborationRepository(
      prisma as never,
      new PrismaTaskCollaborationWriteContext(),
      {
        lockExact: async (transaction, input) => {
          const valid =
            await new PrismaTaskCollaborationEvidenceWrite().lockExact(
              transaction,
              input,
            );
          collaborationEvidenceLock.enter();
          await collaborationEvidenceLock.released;
          return valid;
        },
      },
    );
    const overlapService = new PostTaskCollaborationService(
      context,
      evidence,
      overlapRepository,
    );
    const revokeAttempt = transactionQueryBarrier(
      (sql) => sql.includes('FROM "evidence_record"'),
      "before",
    );
    const revokeService = decisionService(revokeAttempt);

    const posting = overlapService.execute(
      postInput(scenario.taskId, scenario.containerId, randomUUID(), {
        evidenceRecordIds: [scenario.evidenceId],
      }),
    );
    await collaborationEvidenceLock.entered;
    const revoking = revokeService.execute(
      revokeInput(scenario.evidenceId, "collaboration-first"),
    );
    await revokeAttempt.entered;
    revokeAttempt.release();
    collaborationEvidenceLock.release();

    const [posted, revoked] = await Promise.all([posting, revoking]);
    expect(revoked).toMatchObject({ appended: true });
    await expect(
      prisma.taskCollaborationMessageEvidenceRef.count({
        where: {
          messageId: posted.message.messageId,
          evidenceRecordId: scenario.evidenceId,
        },
      }),
    ).resolves.toBe(1);
    await expect(decisionFacts(scenario.evidenceId)).resolves.toEqual([
      expect.objectContaining({
        verificationSequence: 1,
        decision: "verified",
        previousDecisionId: null,
      }),
      expect.objectContaining({
        verificationSequence: 2,
        decision: "revoked",
        previousDecisionId: scenario.verifiedDecisionId,
      }),
    ]);
  }, 15_000);

  it("serializes revoke-first collaboration to a stable rejection with zero writes", async () => {
    const scenario = await createVerifiedScenario();
    const before = await collaborationCountsForTask(scenario.taskId);
    const revokeLock = transactionQueryBarrier(
      (sql) => sql.includes('FROM "evidence_record"'),
      "after",
    );
    const revokeService = decisionService(revokeLock);
    const collaborationEvidenceAttempt = signalBarrier();
    const overlapRepository = new PrismaTaskCollaborationRepository(
      prisma as never,
      new PrismaTaskCollaborationWriteContext(),
      {
        lockExact: async (transaction, input) => {
          collaborationEvidenceAttempt.enter();
          return new PrismaTaskCollaborationEvidenceWrite().lockExact(
            transaction,
            input,
          );
        },
      },
    );
    const overlapService = new PostTaskCollaborationService(
      context,
      evidence,
      overlapRepository,
    );

    const revoking = revokeService.execute(
      revokeInput(scenario.evidenceId, "revoke-first"),
    );
    await revokeLock.entered;
    const posting = overlapService.execute(
      postInput(scenario.taskId, scenario.containerId, randomUUID(), {
        evidenceRecordIds: [scenario.evidenceId],
      }),
    );
    await collaborationEvidenceAttempt.entered;
    revokeLock.release();

    await expect(revoking).resolves.toMatchObject({ appended: true });
    await expect(posting).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(collaborationCountsForTask(scenario.taskId)).resolves.toEqual(
      before,
    );
    await expect(decisionFacts(scenario.evidenceId)).resolves.toEqual([
      expect.objectContaining({
        verificationSequence: 1,
        decision: "verified",
      }),
      expect.objectContaining({
        verificationSequence: 2,
        decision: "revoked",
        previousDecisionId: scenario.verifiedDecisionId,
      }),
    ]);
  }, 15_000);

  it("filters evidence after concurrent requests converge to an in-transaction replay", async () => {
    const scenario = await createVerifiedScenario();
    const input = postInput(
      scenario.taskId,
      scenario.containerId,
      randomUUID(),
      { evidenceRecordIds: [scenario.evidenceId] },
    );
    const earlyLookups = twoPartyLookupBarrier(repository);
    const replayFilter = signalBarrier();
    const guardedEvidence = {
      resolveExact: (request: Parameters<typeof evidence.resolveExact>[0]) =>
        evidence.resolveExact(request),
      listOptions: (request: Parameters<typeof evidence.listOptions>[0]) =>
        evidence.listOptions(request),
      filterReadable: async (
        request: Parameters<typeof evidence.filterReadable>[0],
      ) => {
        replayFilter.enter();
        await replayFilter.released;
        return evidence.filterReadable(request);
      },
    };
    const overlapService = new PostTaskCollaborationService(
      context,
      guardedEvidence,
      earlyLookups,
    );

    const first = overlapService.execute(input);
    const second = overlapService.execute(input);
    await replayFilter.entered;
    await decisionService().execute(
      revokeInput(scenario.evidenceId, "late-replay-filter"),
    );
    replayFilter.release();

    const results = await Promise.all([first, second]);
    const replay = results.find(({ idempotencyReplay }) => idempotencyReplay);
    expect(replay).toMatchObject({
      idempotencyReplay: true,
      message: { evidenceRefs: [] },
    });
    expect(new Set(results.map(({ message }) => message.messageId)).size).toBe(
      1,
    );
    const messageId = results[0]!.message.messageId;
    await expect(
      prisma.taskCollaborationMessage.count({ where: { id: messageId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.taskCollaborationMessageEvidenceRef.count({
        where: { messageId },
      }),
    ).resolves.toBe(1);
    await expect(
      overlapService.execute({
        ...input,
        command: { ...input.command, body: "different payload" },
      }),
    ).rejects.toThrow("IDEMPOTENCY_KEY_CONFLICT");
  }, 15_000);

  it("keeps later messages out of an asOf pagination snapshot", async () => {
    await postService.execute(
      postInput(taskA, containerA, `page-1-${randomUUID()}`),
    );
    await postService.execute(
      postInput(taskA, containerA, `page-2-${randomUUID()}`),
    );
    const first = await listService.execute({
      ...listInput(taskA, containerA),
      pageSize: "1",
    });
    expect(first.nextCursor).not.toBeNull();
    const late = await postService.execute(
      postInput(taskA, containerA, `page-late-${randomUUID()}`),
    );
    const second = await listService.execute({
      ...listInput(taskA, containerA),
      pageSize: "100",
      cursor: first.nextCursor!,
    });
    expect(second.asOf).toBe(first.asOf);
    expect(second.messages.map(({ messageId }) => messageId)).not.toContain(
      late.message.messageId,
    );
  });

  it("enforces composite parent FK and NULLS NOT DISTINCT source uniqueness", async () => {
    const parent = await postService.execute(
      postInput(taskA, containerA, `parent-${randomUUID()}`),
    );
    const other = await postService.execute(
      postInput(taskB, containerB, `other-${randomUUID()}`),
    );

    await prisma.taskCollaborationMessageSourceRef.create({
      data: {
        messageId: parent.message.messageId,
        sourceKind: "result",
        sourceId: "nullable-source",
        sourceVersion: null,
      },
    });
    await expect(
      prisma.$executeRaw`
        INSERT INTO "task_collaboration_message" (
          "id", "thread_id", "author_actor_id", "parent_message_id", "body",
          "occurred_at", "idempotency_key", "payload_hash"
        ) VALUES (
          ${randomUUID()}::uuid, ${other.message.threadId}::uuid, ${actorA},
          ${parent.message.messageId}::uuid, 'cross-thread parent', NOW(),
          ${`fk-${randomUUID()}`}, ${"a".repeat(64)}
        )
      `,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`
        INSERT INTO "task_collaboration_message_source_ref" (
          "id", "message_id", "source_kind", "source_id", "source_version"
        ) VALUES (
          ${randomUUID()}::uuid, ${parent.message.messageId}::uuid,
          'result', 'nullable-source', NULL
        )
      `,
    ).rejects.toThrow();
  });

  it("enforces append-only triggers on all five collaboration tables", async () => {
    const created = await postService.execute(
      postInput(taskA, containerA, `immutable-${randomUUID()}`, {
        mentionActorIds: [actorB],
        evidenceRecordIds: [evidenceA],
      }),
    );
    const messageId = created.message.messageId;
    const threadId = created.message.threadId;
    await prisma.taskCollaborationMessageSourceRef.create({
      data: {
        messageId,
        sourceKind: "evidence",
        sourceId: "immutable",
        sourceVersion: 1,
      },
    });
    const mutations = [
      () =>
        prisma.$executeRaw`UPDATE "task_collaboration_thread" SET "policy_version" = "policy_version" WHERE "id" = ${threadId}::uuid`,
      () =>
        prisma.$executeRaw`UPDATE "task_collaboration_message" SET "body" = "body" WHERE "id" = ${messageId}::uuid`,
      () =>
        prisma.$executeRaw`UPDATE "task_collaboration_message_mention" SET "actor_id" = "actor_id" WHERE "message_id" = ${messageId}::uuid`,
      () =>
        prisma.$executeRaw`UPDATE "task_collaboration_message_evidence_ref" SET "evidence_record_id" = "evidence_record_id" WHERE "message_id" = ${messageId}::uuid`,
      () =>
        prisma.$executeRaw`UPDATE "task_collaboration_message_source_ref" SET "source_id" = "source_id" WHERE "message_id" = ${messageId}::uuid`,
    ];
    for (const mutate of mutations) {
      await expect(mutate()).rejects.toThrow("append-only");
    }
  });
});

async function seed(): Promise<void> {
  for (const input of [
    {
      id: taskA,
      tenantId: tenantA,
      containerId: containerA,
      state: "in_progress",
    },
    {
      id: completedTask,
      tenantId: tenantA,
      containerId: containerA,
      state: "completed",
    },
    {
      id: cancelledTask,
      tenantId: tenantA,
      containerId: containerA,
      state: "cancelled",
    },
    {
      id: taskB,
      tenantId: tenantB,
      containerId: containerB,
      state: "in_progress",
    },
    {
      id: nullContainerTask,
      tenantId: tenantA,
      containerId: null,
      state: "in_progress",
    },
  ]) {
    await prisma.nodeTask.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        flowInstanceId: randomUUID(),
        nodeInstanceId: randomUUID(),
        nodeCode: "container_stuffing",
        containerId: input.containerId,
        taskDefinitionKey: "task-collaboration-integration",
        state: input.state,
      },
    });
  }
  await prisma.workOrder.createMany({
    data: [
      workOrder(taskA, actorB),
      workOrder(taskA, ` ${actorB} `),
      workOrder(taskA, null),
      workOrder(taskB, actorA),
    ],
  });
  await prisma.evidenceRecord.createMany({
    data: [
      evidenceRecord(evidenceA, tenantA, containerA, "effective"),
      evidenceRecord(evidenceB, tenantB, containerB, "effective"),
      evidenceRecord(evidenceRevoked, tenantA, containerA, "revoked"),
      evidenceRecord(evidenceWrongContainer, tenantA, containerB, "effective"),
    ],
  });
}

async function createScenario() {
  const taskId = randomUUID();
  const containerId = randomUUID();
  const evidenceId = randomUUID();
  const workOrderId = randomUUID();
  await prisma.nodeTask.create({
    data: {
      id: taskId,
      tenantId: tenantA,
      flowInstanceId: randomUUID(),
      nodeInstanceId: randomUUID(),
      nodeCode: "container_stuffing",
      containerId,
      taskDefinitionKey: "task-collaboration-scenario",
      state: "in_progress",
    },
  });
  await prisma.workOrder.create({
    data: { ...workOrder(taskId, actorB), id: workOrderId },
  });
  await prisma.evidenceRecord.create({
    data: evidenceRecord(evidenceId, tenantA, containerId, "effective"),
  });
  return { taskId, containerId, evidenceId, workOrderId };
}

async function createReadinessScenario() {
  const taskId = randomUUID();
  const containerId = randomUUID();
  const evidenceId = randomUUID();
  const workOrderId = randomUUID();
  const flowInstanceId = randomUUID();
  const nodeInstanceId = randomUUID();
  await prisma.nodeTask.create({
    data: {
      id: taskId,
      tenantId: tenantA,
      flowInstanceId,
      nodeInstanceId,
      nodeCode: "container_stuffing",
      containerId,
      taskDefinitionKey: "task-collaboration-readiness",
      state: "pending",
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
    },
  });
  await prisma.workOrder.create({
    data: {
      ...workOrder(taskId, actorB),
      id: workOrderId,
      state: "draft",
    },
  });
  await prisma.evidenceRecord.create({
    data: evidenceRecord(evidenceId, tenantA, containerId, "effective"),
  });
  return {
    taskId,
    containerId,
    evidenceId,
    workOrderId,
    flowInstanceId,
    nodeInstanceId,
  };
}

async function createVerifiedScenario() {
  const scenario = await createScenario();
  const verified = await decisionService().execute({
    evidenceId: scenario.evidenceId,
    tenantId: tenantA,
    actorOrServiceId: actorA,
    reasonCode: "integration_verify",
    decision: "verified",
  });
  if (!verified.decisionId)
    throw new Error("verification decision was not created");
  return { ...scenario, verifiedDecisionId: verified.decisionId };
}

function revokeInput(evidenceId: string, reasonCode: string) {
  return {
    evidenceId,
    tenantId: tenantA,
    actorOrServiceId: actorA,
    reasonCode,
    decision: "revoked" as const,
  };
}

function decisionService(barrier?: ReturnType<typeof transactionQueryBarrier>) {
  const repositoryPrisma = barrier
    ? {
        evidenceRecord: prisma.evidenceRecord,
        evidenceVerificationDecision: prisma.evidenceVerificationDecision,
        $transaction: <T>(
          callback: (transaction: Prisma.TransactionClient) => Promise<T>,
        ) =>
          prisma.$transaction((transaction) =>
            callback(barrier.wrap(transaction)),
          ),
      }
    : prisma;
  return new DecideEvidenceService(
    new PrismaEvidenceRepository(repositoryPrisma as never),
  );
}

async function decisionFacts(evidenceId: string) {
  return prisma.evidenceVerificationDecision.findMany({
    where: { evidenceId },
    orderBy: { verificationSequence: "asc" },
    select: {
      verificationSequence: true,
      decision: true,
      previousDecisionId: true,
    },
  });
}

async function collaborationCounts() {
  const [threads, messages, mentions, evidenceRefs, sourceRefs] =
    await Promise.all([
      prisma.taskCollaborationThread.count(),
      prisma.taskCollaborationMessage.count(),
      prisma.taskCollaborationMessageMention.count(),
      prisma.taskCollaborationMessageEvidenceRef.count(),
      prisma.taskCollaborationMessageSourceRef.count(),
    ]);
  return { threads, messages, mentions, evidenceRefs, sourceRefs };
}

async function collaborationCountsForTask(taskId: string) {
  const threads = await prisma.taskCollaborationThread.findMany({
    where: { workId: taskId },
    select: { id: true },
  });
  const threadIds = threads.map(({ id }) => id);
  const messages = await prisma.taskCollaborationMessage.findMany({
    where: { threadId: { in: threadIds } },
    select: { id: true },
  });
  const messageIds = messages.map(({ id }) => id);
  const [mentions, evidenceRefs, sourceRefs] = await Promise.all([
    prisma.taskCollaborationMessageMention.count({
      where: { messageId: { in: messageIds } },
    }),
    prisma.taskCollaborationMessageEvidenceRef.count({
      where: { messageId: { in: messageIds } },
    }),
    prisma.taskCollaborationMessageSourceRef.count({
      where: { messageId: { in: messageIds } },
    }),
  ]);
  return {
    threads: threads.length,
    messages: messages.length,
    mentions,
    evidenceRefs,
    sourceRefs,
  };
}

function signalBarrier() {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { enter, entered, release, released };
}

function transactionQueryBarrier(
  matches: (sql: string) => boolean,
  pause: "before" | "after",
) {
  const barrier = signalBarrier();
  let pending = true;
  return {
    ...barrier,
    wrap(transaction: Prisma.TransactionClient): Prisma.TransactionClient {
      return new Proxy(transaction, {
        get(target, property, receiver) {
          if (property !== "$queryRaw") {
            return Reflect.get(target, property, receiver);
          }
          const queryRaw = target.$queryRaw.bind(target) as <T>(
            strings: TemplateStringsArray,
            ...values: unknown[]
          ) => Promise<T>;
          return async <T>(
            strings: TemplateStringsArray,
            ...values: unknown[]
          ) => {
            const shouldPause = pending && matches(strings.join(" "));
            if (shouldPause && pause === "before") {
              pending = false;
              barrier.enter();
              await barrier.released;
            }
            const result = await queryRaw<T>(strings, ...values);
            if (shouldPause && pause === "after") {
              pending = false;
              barrier.enter();
              await barrier.released;
            }
            return result;
          };
        },
      });
    },
  };
}

function twoPartyLookupBarrier(delegate: TaskCollaborationRepository) {
  let completedLookups = 0;
  let releaseLookups!: () => void;
  const bothCompleted = new Promise<void>((resolve) => {
    releaseLookups = resolve;
  });
  return {
    findThread: (input: Parameters<typeof delegate.findThread>[0]) =>
      delegate.findThread(input),
    listMessages: (input: Parameters<typeof delegate.listMessages>[0]) =>
      delegate.listMessages(input),
    findIdempotentMessage: async (
      input: Parameters<typeof delegate.findIdempotentMessage>[0],
    ) => {
      const result = await delegate.findIdempotentMessage(input);
      completedLookups += 1;
      if (completedLookups === 2) releaseLookups();
      await bothCompleted;
      return result;
    },
    appendMessage: (input: Parameters<typeof delegate.appendMessage>[0]) =>
      delegate.appendMessage(input),
  } satisfies TaskCollaborationRepository;
}

function appendBarrier(delegate: TaskCollaborationRepository) {
  let enter!: () => void;
  let resume!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const barrierRepository: TaskCollaborationRepository = {
    findThread: (input) => delegate.findThread(input),
    listMessages: (input) => delegate.listMessages(input),
    findIdempotentMessage: (input) => delegate.findIdempotentMessage(input),
    appendMessage: async (input) => {
      enter();
      await released;
      return delegate.appendMessage(input);
    },
  };
  return {
    repository: barrierRepository,
    entered,
    release: resume,
  };
}

function workOrder(nodeTaskId: string, assigneeId: string | null) {
  return {
    id: randomUUID(),
    nodeTaskId,
    workOrderDefinitionKey: "collaboration-assignee",
    state: "in_progress",
    applicability: "required",
    assignmentState: assigneeId ? "assigned" : "unassigned",
    assigneeId,
  };
}

function evidenceRecord(
  id: string,
  tenantId: string,
  subjectId: string,
  validity: string,
) {
  const now = new Date();
  return {
    id,
    tenantId,
    idempotencyKey: `evidence-${id}`,
    evidenceType: "document",
    subjectType: "container",
    subjectId,
    authorityLevel: "operational",
    contentRef: `private://${id}`,
    contentHash: "b".repeat(64),
    source: {
      sourceId: id,
      sourceType: "system",
      originatorSystem: "integration-test",
      authoritySystem: "integration-test",
      ingestionChannel: "system_internal",
      captureSource: "internal_operation",
    },
    verificationState: "pending",
    confidenceState: "unknown",
    validity,
    receivedAt: now,
    recordedAt: now,
  };
}

function listInput(taskId: string, subjectId: string) {
  return {
    tenantId: taskId === taskB ? tenantB : tenantA,
    actorId: actorA,
    capabilities,
    taskId,
    subjectKind: "container",
    subjectId,
  };
}

function postInput(
  taskId: string,
  subjectId: string,
  idempotencyKey: string,
  override: {
    mentionActorIds?: string[];
    evidenceRecordIds?: string[];
    sourceRefs?: Array<{
      kind: "action" | "result" | "evidence";
      id: string;
      version: number | null;
    }>;
  } = {},
) {
  return {
    tenantId: taskId === taskB ? tenantB : tenantA,
    actorId: actorA,
    capabilities,
    taskId,
    command: {
      contractVersion: "task-collaboration-post-command.v1" as const,
      subjectRef: { kind: "container" as const, id: subjectId },
      workRef: { kind: "node_task" as const, id: taskId },
      body: "integration collaboration message",
      parentMessageId: null,
      mentionActorIds: override.mentionActorIds ?? [],
      evidenceRecordIds: override.evidenceRecordIds ?? [],
      sourceRefs: override.sourceRefs ?? [],
      idempotencyKey,
    },
  };
}
