import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRecord,
  type EvidenceRepository,
} from "../domain/evidence.repository";
import type {
  TaskCollaborationEvidenceOption,
  TaskCollaborationEvidencePort,
} from "../task-collaboration-evidence.port";

@Injectable()
export class ResolveTaskCollaborationEvidenceService implements TaskCollaborationEvidencePort {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async resolveExact(input: {
    tenantId: string;
    subjectRef: { kind: "container"; id: string };
    evidenceRecordIds: string[];
  }): Promise<TaskCollaborationEvidenceOption[]> {
    const ids = [...new Set(input.evidenceRecordIds)].sort();
    if (ids.length === 0) return [];
    const rows = await this.findReadable(input, ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const resolved = ids.map((id) => byId.get(id));
    if (
      resolved.some(
        (row) =>
          !row || !this.isReadable(row, input.tenantId, input.subjectRef.id),
      )
    ) {
      throw new NotFoundException("RESOURCE_NOT_FOUND");
    }
    return ids.map(toOption);
  }

  async filterReadable(input: {
    tenantId: string;
    subjectRef: { kind: "container"; id: string };
    evidenceRecordIds: string[];
  }): Promise<TaskCollaborationEvidenceOption[]> {
    const ids = [...new Set(input.evidenceRecordIds)].sort();
    if (ids.length === 0) return [];
    const requestedIds = new Set(ids);
    const rows = await this.findReadable(input, ids);
    return rows
      .filter(
        (row) =>
          requestedIds.has(row.id) &&
          this.isReadable(row, input.tenantId, input.subjectRef.id),
      )
      .map(({ id }) => toOption(id))
      .sort((left, right) =>
        left.evidenceRecordId.localeCompare(right.evidenceRecordId),
      );
  }

  async listOptions(input: {
    tenantId: string;
    subjectRef: { kind: "container"; id: string };
  }): Promise<TaskCollaborationEvidenceOption[]> {
    const rows = await this.repository.listBySubjects({
      tenantId: input.tenantId,
      subjectType: "container",
      subjectIds: [input.subjectRef.id],
    });
    return rows
      .filter((row) =>
        this.isReadable(row, input.tenantId, input.subjectRef.id),
      )
      .map(({ id }) => toOption(id))
      .sort((left, right) =>
        left.evidenceRecordId.localeCompare(right.evidenceRecordId),
      )
      .slice(0, 100);
  }

  private isReadable(
    row: EvidenceRecord,
    tenantId: string,
    subjectId: string,
  ): boolean {
    return (
      row.tenantId === tenantId &&
      row.subjectType === "container" &&
      row.subjectId === subjectId &&
      row.validity === "effective"
    );
  }

  private findReadable(
    input: {
      tenantId: string;
      subjectRef: { kind: "container"; id: string };
    },
    evidenceRecordIds: string[],
  ): Promise<EvidenceRecord[]> {
    return this.repository.findTaskCollaborationEvidence({
      tenantId: input.tenantId,
      subjectType: "container",
      subjectId: input.subjectRef.id,
      validity: "effective",
      evidenceRecordIds,
    });
  }
}

function toOption(evidenceRecordId: string): TaskCollaborationEvidenceOption {
  return { evidenceRecordId, label: evidenceRecordId };
}
