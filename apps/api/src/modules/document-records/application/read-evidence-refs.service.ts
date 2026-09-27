import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRepository,
} from "../domain/evidence.repository";

@Injectable()
export class ReadEvidenceRefsService {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    subjectType: string;
    subjectIds: string[];
  }): Promise<Record<string, string[]>> {
    if (!input.tenantId.trim()) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const subjectIds = [...new Set(input.subjectIds)];
    const rows = await this.repository.listBySubjects({ ...input, subjectIds });
    const result = Object.fromEntries(
      subjectIds.map((id) => [id, [] as string[]]),
    );
    for (const row of rows) result[row.subjectId]!.push(row.id);
    return result;
  }

  async executeDetails(input: {
    tenantId: string;
    subjectType: string;
    subjectIds: string[];
  }): Promise<
    Array<{
      evidenceId: string;
      subjectId: string;
      sourceName: string;
      summary: string;
      contentRef: string;
      recordedAt: Date;
      verificationState: string;
    }>
  > {
    if (!input.tenantId.trim()) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const rows = await this.repository.listBySubjects({
      ...input,
      subjectIds: [...new Set(input.subjectIds)],
    });
    return rows.map((row) => ({
      evidenceId: row.id,
      subjectId: row.subjectId,
      sourceName:
        row.source.sourceReference ?? row.source.provider ?? row.contentRef,
      summary: row.source.sourceSummary ?? row.contentRef,
      contentRef: row.contentRef,
      recordedAt: row.recordedAt,
      verificationState: row.verificationState,
    }));
  }
}
