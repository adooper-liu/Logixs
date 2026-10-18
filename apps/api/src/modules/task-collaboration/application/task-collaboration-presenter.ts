import type {
  CollaborationMessageRecord,
  CollaborationThreadRecord,
} from "../domain/task-collaboration.repository";

export function presentThread(thread: CollaborationThreadRecord) {
  return {
    contractVersion: "task-collaboration-thread.v1" as const,
    threadId: thread.id,
    subjectRef: { kind: "container" as const, id: thread.subjectId },
    workRef: { kind: "node_task" as const, id: thread.workId },
    visibility: "task_scope" as const,
    policyVersion: thread.policyVersion,
    createdAt: thread.createdAt.toISOString(),
  };
}

export function presentMessage(
  message: CollaborationMessageRecord,
  readableEvidenceRecordIds: ReadonlySet<string>,
) {
  return {
    contractVersion: "task-collaboration-message.v1" as const,
    messageId: message.id,
    threadId: message.threadId,
    author: actorRef(message.authorActorId),
    body: message.body,
    parentMessageId: message.parentMessageId,
    mentions: message.mentions.map(actorRef),
    evidenceRefs: message.evidenceRecordIds
      .filter((id) => readableEvidenceRecordIds.has(id))
      .map((id) => ({
        kind: "evidence_record" as const,
        id,
      })),
    sourceRefs: message.sourceRefs.map((ref) => ({ ...ref })),
    occurredAt: message.occurredAt.toISOString(),
    recordedAt: message.recordedAt.toISOString(),
  };
}

export function actorRef(actorId: string) {
  return { kind: "actor" as const, id: actorId, displayName: actorId };
}
