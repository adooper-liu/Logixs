import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { ResolveTaskCollaborationEvidenceService } from "../../modules/document-records/application/resolve-task-collaboration-evidence.service";
import { PrismaEvidenceRepository } from "../../modules/document-records/infrastructure/prisma-evidence.repository";
import { ListTaskCollaborationService } from "../../modules/task-collaboration/application/list-task-collaboration.service";
import { PostTaskCollaborationService } from "../../modules/task-collaboration/application/post-task-collaboration.service";
import { PrismaTaskCollaborationRepository } from "../../modules/task-collaboration/infrastructure/prisma-task-collaboration.repository";
import { PrismaWorkExecutionRepository } from "../../modules/work-execution/infrastructure/prisma-work-execution.repository";
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
  const repository = new PrismaTaskCollaborationRepository(prisma as never);
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

  it("allows completed GET but rejects POST without writing", async () => {
    await expect(
      listService.execute(listInput(completedTask, containerA)),
    ).resolves.toMatchObject({
      canPost: false,
      postDisabledReason: "TASK_COMPLETED_READ_ONLY",
    });
    const before = await prisma.taskCollaborationMessage.count();
    await expect(
      postService.execute(postInput(completedTask, containerA, "completed")),
    ).rejects.toThrow("BUSINESS_STATE_VIOLATION");
    await expect(prisma.taskCollaborationMessage.count()).resolves.toBe(before);
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

  it("atomically writes joins and replays the same key while conflicting on another payload", async () => {
    const input = postInput(taskA, containerA, "replay-key", {
      mentionActorIds: [actorB],
      evidenceRecordIds: [evidenceA],
      sourceRefs: [{ kind: "action", id: "work-action", version: null }],
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
      postInput(taskA, containerA, `parent-${randomUUID()}`, {
        sourceRefs: [{ kind: "result", id: "nullable-source", version: null }],
      }),
    );
    const other = await postService.execute(
      postInput(taskB, containerB, `other-${randomUUID()}`),
    );

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
        sourceRefs: [{ kind: "evidence", id: "immutable", version: 1 }],
      }),
    );
    const messageId = created.message.messageId;
    const threadId = created.message.threadId;
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
