import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ListTaskCollaborationService } from "./list-task-collaboration.service";
import { PostTaskCollaborationService } from "./post-task-collaboration.service";

const taskId = "20000000-0000-4000-8000-000000000001";
const containerId = "30000000-0000-4000-8000-000000000001";
const evidenceId = "40000000-0000-4000-8000-000000000001";
const evidenceIdB = "40000000-0000-4000-8000-000000000002";
const inaccessibleEvidenceId = "40000000-0000-4000-8000-000000000003";

describe("task collaboration application", () => {
  it("revalidates task scope and projects only current actor plus known assignees", async () => {
    const deps = fakes();
    deps.context.resolve.mockResolvedValue({
      taskId,
      state: "in_progress",
      containerId,
      assigneeActorIds: [" assignee-b ", "", "assignee-a", "assignee-a"],
    });
    const service = new ListTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    const page = await service.execute(listInput());

    expect(deps.context.resolve).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      taskId,
      subjectRef: { kind: "container", id: containerId },
    });
    expect(page.mentionOptions).toEqual([
      { kind: "actor", id: "actor-a", displayName: "actor-a" },
      { kind: "actor", id: "assignee-a", displayName: "assignee-a" },
      { kind: "actor", id: "assignee-b", displayName: "assignee-b" },
    ]);
  });

  it("keeps collaboration readable without evidence.read while hiding all evidence data", async () => {
    const deps = fakes();
    deps.repository.listMessages.mockResolvedValue([
      message(undefined, undefined, {
        evidenceRecordIds: [evidenceId],
        sourceRefs: [{ kind: "evidence", id: "source-a", version: 1 }],
      }),
    ]);
    const service = new ListTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    const page = await service.execute({
      ...listInput(),
      capabilities: ["task.read"],
    });

    expect(page.evidenceOptions).toEqual([]);
    expect(page.messages[0]).toMatchObject({
      body: "hello",
      mentions: [
        { kind: "actor", id: "assignee-a", displayName: "assignee-a" },
      ],
      evidenceRefs: [],
      sourceRefs: [{ kind: "evidence", id: "source-a", version: 1 }],
    });
    expect(deps.evidence.listOptions).not.toHaveBeenCalled();
    expect(deps.evidence.filterReadable).not.toHaveBeenCalled();
    expect(deps.evidence.resolveExact).not.toHaveBeenCalled();
  });

  it("batch reauthorizes current-page evidence refs and filters inaccessible history", async () => {
    const deps = fakes();
    deps.repository.listMessages.mockResolvedValue([
      message("50000000-0000-4000-8000-000000000002", undefined, {
        evidenceRecordIds: [evidenceId, inaccessibleEvidenceId],
      }),
      message("50000000-0000-4000-8000-000000000001", undefined, {
        evidenceRecordIds: [evidenceIdB, evidenceId],
      }),
    ]);
    deps.evidence.filterReadable.mockResolvedValue([
      { evidenceRecordId: evidenceId, label: evidenceId },
      { evidenceRecordId: evidenceIdB, label: evidenceIdB },
    ]);
    const service = new ListTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    const page = await service.execute(listInput());

    expect(deps.evidence.filterReadable).toHaveBeenCalledTimes(1);
    expect(deps.evidence.filterReadable).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      subjectRef: { kind: "container", id: containerId },
      evidenceRecordIds: [evidenceId, evidenceIdB, inaccessibleEvidenceId],
    });
    expect(page.messages.map(({ evidenceRefs }) => evidenceRefs)).toEqual([
      [{ kind: "evidence_record", id: evidenceId }],
      [
        { kind: "evidence_record", id: evidenceIdB },
        { kind: "evidence_record", id: evidenceId },
      ],
    ]);
  });

  it("rejects list without task.read and hides missing or mismatched task scope", async () => {
    const deps = fakes();
    const service = new ListTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    await expect(
      service.execute({ ...listInput(), capabilities: [] }),
    ).rejects.toThrow("AUTHORIZATION_FORBIDDEN");

    deps.context.resolve.mockResolvedValue(null);
    await expect(service.execute(listInput())).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
  });

  it("keeps completed tasks readable but reports posting disabled", async () => {
    const deps = fakes();
    deps.context.resolve.mockResolvedValue({
      taskId,
      state: "completed",
      containerId,
      assigneeActorIds: [],
    });
    const service = new ListTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    await expect(service.execute(listInput())).resolves.toMatchObject({
      canPost: false,
      postDisabledReason: "TASK_COMPLETED_READ_ONLY",
    });
  });

  it("binds cursors to the complete request scope and rejects corruption", async () => {
    const deps = fakes();
    deps.repository.listMessages.mockResolvedValue([
      message(
        "50000000-0000-4000-8000-000000000002",
        "2026-10-18T10:00:00.000Z",
      ),
      message(
        "50000000-0000-4000-8000-000000000001",
        "2026-10-18T09:00:00.000Z",
      ),
    ]);
    const service = new ListTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
      () => new Date("2026-10-18T12:00:00.000Z"),
    );

    const first = await service.execute({ ...listInput(), pageSize: "1" });
    expect(first.nextCursor).toBeTypeOf("string");
    await service.execute({
      ...listInput(),
      pageSize: "1",
      cursor: first.nextCursor!,
    });
    expect(deps.repository.listMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        asOf: new Date("2026-10-18T12:00:00.000Z"),
        after: {
          recordedAt: new Date("2026-10-18T10:00:00.000Z"),
          id: "50000000-0000-4000-8000-000000000002",
        },
      }),
    );

    await expect(
      service.execute({ ...listInput(), cursor: "not-a-cursor" }),
    ).rejects.toThrow("CURSOR_INVALID");
    await expect(
      service.execute({
        ...listInput(),
        subjectId: "30000000-0000-4000-8000-000000000002",
        cursor: first.nextCursor!,
      }),
    ).rejects.toThrow("CURSOR_INVALID");
  });

  it("requires both capabilities and rejects completed, unknown mention and invisible evidence", async () => {
    const deps = fakes();
    const service = new PostTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    await expect(
      service.execute({ ...postInput(), capabilities: ["task.read"] }),
    ).rejects.toThrow("AUTHORIZATION_FORBIDDEN");

    deps.context.resolve.mockResolvedValueOnce({
      taskId,
      state: "completed",
      containerId,
      assigneeActorIds: [],
    });
    await expect(service.execute(postInput())).rejects.toThrow(
      "BUSINESS_STATE_VIOLATION",
    );

    await expect(
      service.execute({
        ...postInput(),
        command: { ...postInput().command, mentionActorIds: ["stranger"] },
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");

    deps.evidence.resolveExact.mockRejectedValueOnce(
      new HttpException("RESOURCE_NOT_FOUND", 404),
    );
    await expect(service.execute(postInput())).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
  });

  it("passes normalized payload to one repository append and preserves replay", async () => {
    const deps = fakes();
    deps.repository.appendMessage.mockResolvedValue({
      thread: thread(),
      message: message(),
      idempotencyReplay: true,
    });
    const service = new PostTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    await expect(service.execute(postInput())).resolves.toMatchObject({
      contractVersion: "task-collaboration-post-result.v1",
      idempotencyReplay: true,
    });
    expect(deps.repository.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        authorActorId: "actor-a",
        command: expect.objectContaining({
          body: "hello",
          evidenceRecordIds: [evidenceId],
        }),
      }),
    );
  });

  it("allows posting without evidence.read when no EvidenceRef is present", async () => {
    const deps = fakes();
    const service = new PostTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    await expect(
      service.execute({
        ...postInput(),
        capabilities: ["task.read", "task.collaborate"],
        command: { ...postInput().command, evidenceRecordIds: [] },
      }),
    ).resolves.toMatchObject({ idempotencyReplay: false });
    expect(deps.evidence.resolveExact).not.toHaveBeenCalled();
    expect(deps.repository.appendMessage).toHaveBeenCalledTimes(1);
  });

  it("rejects posting EvidenceRefs without evidence.read before persistence or evidence access", async () => {
    const deps = fakes();
    const service = new PostTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    const failure = service.execute({
      ...postInput(),
      capabilities: ["task.read", "task.collaborate"],
    });

    await expect(failure).rejects.toMatchObject({ status: 403 });
    await expect(failure).rejects.toThrow("AUTHORIZATION_FORBIDDEN");
    expect(deps.evidence.resolveExact).not.toHaveBeenCalled();
    expect(deps.evidence.filterReadable).not.toHaveBeenCalled();
    expect(deps.evidence.listOptions).not.toHaveBeenCalled();
    expect(deps.repository.appendMessage).not.toHaveBeenCalled();
  });

  it("exactly reauthorizes posting EvidenceRefs when evidence.read is granted", async () => {
    const deps = fakes();
    const service = new PostTaskCollaborationService(
      deps.context,
      deps.evidence,
      deps.repository,
    );

    await service.execute(postInput());

    expect(deps.evidence.resolveExact).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      subjectRef: { kind: "container", id: containerId },
      evidenceRecordIds: [evidenceId],
    });
  });
});

function fakes() {
  return {
    context: {
      resolve: vi.fn().mockResolvedValue({
        taskId,
        state: "in_progress",
        containerId,
        assigneeActorIds: ["assignee-a"],
      }),
    },
    evidence: {
      resolveExact: vi
        .fn()
        .mockResolvedValue([
          { evidenceRecordId: evidenceId, label: evidenceId },
        ]),
      listOptions: vi.fn().mockResolvedValue([]),
      filterReadable: vi.fn().mockResolvedValue([]),
    },
    repository: {
      findThread: vi.fn().mockResolvedValue(thread()),
      listMessages: vi.fn().mockResolvedValue([]),
      appendMessage: vi.fn().mockResolvedValue({
        thread: thread(),
        message: message(),
        idempotencyReplay: false,
      }),
    },
  };
}

function listInput() {
  return {
    tenantId: "tenant-a",
    actorId: "actor-a",
    capabilities: ["task.read", "task.collaborate", "evidence.read"],
    taskId,
    subjectKind: "container",
    subjectId: containerId,
    pageSize: "20",
  };
}

function postInput() {
  return {
    tenantId: "tenant-a",
    actorId: "actor-a",
    capabilities: ["task.read", "task.collaborate", "evidence.read"],
    taskId,
    command: {
      contractVersion: "task-collaboration-post-command.v1" as const,
      subjectRef: { kind: "container" as const, id: containerId },
      workRef: { kind: "node_task" as const, id: taskId },
      body: " hello ",
      parentMessageId: null,
      mentionActorIds: ["assignee-a"],
      evidenceRecordIds: [evidenceId],
      sourceRefs: [],
      idempotencyKey: "key-1",
    },
  };
}

function thread() {
  return {
    id: "60000000-0000-4000-8000-000000000001",
    tenantId: "tenant-a",
    subjectKind: "container" as const,
    subjectId: containerId,
    workKind: "node_task" as const,
    workId: taskId,
    visibilityScope: "task_scope" as const,
    policyVersion: 1,
    createdAt: new Date("2026-10-18T08:00:00.000Z"),
  };
}

function message(
  id = "50000000-0000-4000-8000-000000000001",
  recordedAt = "2026-10-18T10:00:00.000Z",
  override: {
    evidenceRecordIds?: string[];
    sourceRefs?: Array<{
      kind: "action" | "result" | "evidence";
      id: string;
      version: number | null;
    }>;
  } = {},
) {
  return {
    id,
    threadId: thread().id,
    authorActorId: "actor-a",
    parentMessageId: null,
    body: "hello",
    occurredAt: new Date(recordedAt),
    recordedAt: new Date(recordedAt),
    mentions: ["assignee-a"],
    evidenceRecordIds: override.evidenceRecordIds ?? [evidenceId],
    sourceRefs: override.sourceRefs ?? [],
  };
}
