export const TASK_COLLABORATION_EVIDENCE_WRITE = Symbol.for(
  "logix.TaskCollaborationEvidenceWrite",
);

export interface TaskCollaborationEvidenceWriteTransaction {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

export interface TaskCollaborationEvidenceWritePort {
  lockExact(
    transaction: TaskCollaborationEvidenceWriteTransaction,
    input: {
      tenantId: string;
      subjectRef: { kind: "container"; id: string };
      evidenceRecordIds: string[];
    },
  ): Promise<boolean>;
}
