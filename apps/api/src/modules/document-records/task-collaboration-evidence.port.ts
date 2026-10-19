export const TASK_COLLABORATION_EVIDENCE = Symbol.for(
  "logix.TaskCollaborationEvidence",
);

export interface TaskCollaborationEvidenceOption {
  evidenceRecordId: string;
  label: string;
}

export interface TaskCollaborationEvidencePort {
  resolveExact(input: {
    tenantId: string;
    subjectRef: { kind: "container"; id: string };
    evidenceRecordIds: string[];
  }): Promise<TaskCollaborationEvidenceOption[]>;
  filterReadable(input: {
    tenantId: string;
    subjectRef: { kind: "container"; id: string };
    evidenceRecordIds: string[];
  }): Promise<TaskCollaborationEvidenceOption[]>;
  listOptions(input: {
    tenantId: string;
    subjectRef: { kind: "container"; id: string };
  }): Promise<TaskCollaborationEvidenceOption[]>;
}
