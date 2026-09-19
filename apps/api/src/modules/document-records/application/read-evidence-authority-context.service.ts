import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRepository,
} from "../domain/evidence.repository";
import type {
  EvidenceAuthorityContext,
  ReadEvidenceAuthorityContextPort,
} from "../read-evidence-authority-context.port";

@Injectable()
export class ReadEvidenceAuthorityContextService implements ReadEvidenceAuthorityContextPort {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    subjectType: string;
    subjectId: string;
    evidenceIds: string[];
  }): Promise<EvidenceAuthorityContext[]> {
    const rows = await this.repository.findByIds(input.evidenceIds);
    if (rows.some((row) => row.tenantId !== input.tenantId)) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const requested = new Set(input.evidenceIds);
    return rows
      .filter(
        (row) =>
          requested.has(row.id) &&
          row.subjectType === input.subjectType &&
          row.subjectId === input.subjectId,
      )
      .map((row) => ({
        id: row.id,
        evidenceType: row.evidenceType,
        authorityLevel: row.authorityLevel,
        sourceType: row.source.sourceType,
        authoritySystem: row.source.authoritySystem,
        verificationState: row.verificationState,
        validity: row.validity,
      }));
  }
}
