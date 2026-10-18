import { describe, expect, it } from "vitest";
import {
  CollaborationValidationError,
  appendCollaborationMessage,
  assertReplyParentInThread,
  normalizeCollaborationPostCommand,
} from "./task-collaboration";

const SUBJECT_ID = "10000000-0000-4000-8000-000000000001";
const TASK_ID = "20000000-0000-4000-8000-000000000001";
const PARENT_ID = "30000000-0000-4000-8000-000000000001";
const ACTOR_A = "operator-1";
const ACTOR_B = "user-1";
const EVIDENCE_A = "50000000-0000-4000-8000-000000000001";
const EVIDENCE_B = "50000000-0000-4000-8000-000000000002";

const command = () => ({
  contractVersion: "task-collaboration-post-command.v1" as const,
  subjectRef: { kind: "container" as const, id: SUBJECT_ID },
  workRef: { kind: "node_task" as const, id: TASK_ID },
  body: "  Please verify the seal photos.  ",
  parentMessageId: PARENT_ID,
  mentionActorIds: [` ${ACTOR_B} `, ` ${ACTOR_A} `, ACTOR_B],
  evidenceRecordIds: [EVIDENCE_B, EVIDENCE_A, EVIDENCE_B],
  sourceRefs: [
    { kind: "result" as const, id: "result-2", version: 2 },
    { kind: "action" as const, id: "action-1" },
    { kind: "result" as const, id: "result-2", version: 2 },
  ],
  idempotencyKey: " post-1 ",
});

describe("normalizeCollaborationPostCommand", () => {
  it("normalizes fixed task scope input and deduplicates references", () => {
    expect(normalizeCollaborationPostCommand(command())).toMatchObject({
      contractVersion: "task-collaboration-post-command.v1",
      visibility: "task_scope",
      subjectRef: { kind: "container", id: SUBJECT_ID },
      workRef: { kind: "node_task", id: TASK_ID },
      body: "Please verify the seal photos.",
      parentMessageId: PARENT_ID,
      mentionActorIds: [ACTOR_A, ACTOR_B],
      evidenceRecordIds: [EVIDENCE_A, EVIDENCE_B],
      sourceRefs: [
        { kind: "action", id: "action-1", version: null },
        { kind: "result", id: "result-2", version: 2 },
      ],
      idempotencyKey: "post-1",
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("produces the same payload hash for equivalent reference ordering", () => {
    const first = normalizeCollaborationPostCommand(command());
    const second = normalizeCollaborationPostCommand({
      ...command(),
      mentionActorIds: [ACTOR_B, ACTOR_A],
      evidenceRecordIds: [EVIDENCE_A, EVIDENCE_B],
      sourceRefs: [
        { kind: "action", id: "action-1" },
        { kind: "result", id: "result-2", version: 2 },
      ],
      idempotencyKey: "another-retry-key",
    });

    expect(second.payloadHash).toBe(first.payloadHash);
  });

  it("changes the payload hash when the business payload changes", () => {
    const first = normalizeCollaborationPostCommand(command());
    const second = normalizeCollaborationPostCommand({
      ...command(),
      body: "Please verify the bill of lading.",
    });

    expect(second.payloadHash).not.toBe(first.payloadHash);
  });

  it.each(["", "   ", "x".repeat(4001)])(
    "rejects invalid message body %j",
    (body) => {
      expect(() =>
        normalizeCollaborationPostCommand({ ...command(), body }),
      ).toThrowError(CollaborationValidationError);
    },
  );

  it("rejects client-selected visibility", () => {
    expect(() =>
      normalizeCollaborationPostCommand({
        ...command(),
        visibility: "private",
      } as unknown as Parameters<typeof normalizeCollaborationPostCommand>[0]),
    ).toThrowError(
      new CollaborationValidationError("VALIDATION_FORBIDDEN: visibility"),
    );
  });

  it.each(["tenantId", "authorActorId", "visibility"])(
    "rejects client-controlled %s",
    (field) => {
      expect(() =>
        normalizeUnsafe({ ...command(), [field]: "forged-value" }),
      ).toThrowError(
        new CollaborationValidationError(`VALIDATION_FORBIDDEN: ${field}`),
      );
    },
  );

  it.each([
    ["contractVersion", "task-collaboration-post-command.v2"],
    ["subjectRef.kind", "shipment"],
    ["workRef.kind", "work_order"],
  ])("rejects invalid %s", (field, value) => {
    const input = command();
    if (field === "contractVersion") {
      Object.assign(input, { contractVersion: value });
    } else if (field === "subjectRef.kind") {
      Object.assign(input.subjectRef, { kind: value });
    } else {
      Object.assign(input.workRef, { kind: value });
    }
    expect(() => normalizeUnsafe(input)).toThrowError(
      CollaborationValidationError,
    );
  });

  it.each(["", "   ", "x".repeat(129)])(
    "rejects invalid mention actor ID %j",
    (actorId) => {
      expect(() =>
        normalizeUnsafe({ ...command(), mentionActorIds: [actorId] }),
      ).toThrowError(CollaborationValidationError);
    },
  );

  it.each(["not-a-uuid", "", "   "])(
    "rejects invalid EvidenceRef ID %j",
    (evidenceId) => {
      expect(() =>
        normalizeUnsafe({ ...command(), evidenceRecordIds: [evidenceId] }),
      ).toThrowError(CollaborationValidationError);
    },
  );

  it.each([
    [{ kind: "unknown", id: "source-1" }],
    [{ kind: "action", id: "   " }],
    [{ kind: "action", id: "x".repeat(201) }],
    [{ kind: "action", id: "source-1", version: 0 }],
    [{ kind: "action", id: "source-1", version: 1.5 }],
  ])("rejects invalid source refs %#", (sourceRefs) => {
    expect(() => normalizeUnsafe({ ...command(), sourceRefs })).toThrowError(
      CollaborationValidationError,
    );
  });

  it.each([
    [
      "mentionActorIds",
      Array.from({ length: 21 }, (_, index) => `actor-${index}`),
    ],
    [
      "evidenceRecordIds",
      Array.from(
        { length: 21 },
        (_, index) =>
          `50000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      ),
    ],
    [
      "sourceRefs",
      Array.from({ length: 21 }, (_, index) => ({
        kind: "action",
        id: `action-${index}`,
      })),
    ],
  ])("rejects %s beyond 20 entries", (field, values) => {
    expect(() =>
      normalizeUnsafe({ ...command(), [field]: values }),
    ).toThrowError(CollaborationValidationError);
  });
});

describe("reply and append-only invariants", () => {
  it("requires the parent message to belong to the same thread", () => {
    expect(() =>
      assertReplyParentInThread("thread-1", PARENT_ID, {
        messageId: PARENT_ID,
        threadId: "thread-2",
      }),
    ).toThrowError(new CollaborationValidationError("PARENT_THREAD_MISMATCH"));
  });

  it("rejects a missing parent message", () => {
    expect(() =>
      assertReplyParentInThread("thread-1", PARENT_ID, null),
    ).toThrowError(new CollaborationValidationError("PARENT_NOT_FOUND"));
  });

  it("rejects an unexpected parent record", () => {
    expect(() =>
      assertReplyParentInThread("thread-1", null, {
        messageId: PARENT_ID,
        threadId: "thread-1",
      }),
    ).toThrowError(new CollaborationValidationError("PARENT_UNEXPECTED"));
  });

  it("appends without mutating the existing message collection", () => {
    const existing = Object.freeze([
      Object.freeze({ messageId: "message-1", threadId: "thread-1" }),
    ]);
    const appended = appendCollaborationMessage(existing, {
      messageId: "message-2",
      threadId: "thread-1",
    });

    expect(existing).toHaveLength(1);
    expect(appended.map(({ messageId }) => messageId)).toEqual([
      "message-1",
      "message-2",
    ]);
    expect(Object.isFrozen(appended)).toBe(true);
  });

  it("rejects a duplicate message identity", () => {
    expect(() =>
      appendCollaborationMessage(
        [{ messageId: "message-1", threadId: "thread-1" }],
        { messageId: "message-1", threadId: "thread-1" },
      ),
    ).toThrowError(new CollaborationValidationError("MESSAGE_ALREADY_EXISTS"));
  });

  it("rejects appending to a mixed-thread collection", () => {
    expect(() =>
      appendCollaborationMessage(
        [{ messageId: "message-1", threadId: "thread-1" }],
        { messageId: "message-2", threadId: "thread-2" },
      ),
    ).toThrowError(new CollaborationValidationError("MESSAGE_THREAD_MISMATCH"));
  });
});

function normalizeUnsafe(input: unknown) {
  return normalizeCollaborationPostCommand(
    input as Parameters<typeof normalizeCollaborationPostCommand>[0],
  );
}
