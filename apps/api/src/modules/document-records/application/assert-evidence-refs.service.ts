import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isQualifiedEvidence } from "../domain/evidence-rules";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRepository,
} from "../domain/evidence.repository";

export interface AssertEvidenceRefsInput {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  evidenceIds: string[];
}

@Injectable()
export class AssertEvidenceRefsService {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async execute(input: AssertEvidenceRefsInput): Promise<void> {
    if (!input.tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    if (input.evidenceIds.length === 0) {
      throw new HttpException(
        "EVIDENCE_REQUIRED: 缺少合格证据",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const rows = await this.repository.findByIds(input.evidenceIds);
    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const evidenceId of input.evidenceIds) {
      const row = byId.get(evidenceId);
      if (!row) {
        throw new HttpException(
          "EVIDENCE_REQUIRED: 缺少合格证据",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const verdict = isQualifiedEvidence({
        tenantId: row.tenantId,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        verificationState: row.verificationState,
        validity: row.validity,
        expectedTenantId: input.tenantId,
        expectedSubjectType: input.subjectType,
        expectedSubjectId: input.subjectId,
      });
      if (verdict === "tenant") {
        throw new HttpException(
          "AUTHORIZATION_SCOPE_DENIED: 租户不匹配",
          HttpStatus.FORBIDDEN,
        );
      }
      if (verdict === "unqualified") {
        throw new HttpException(
          "EVIDENCE_REQUIRED: 缺少合格证据",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
  }
}
