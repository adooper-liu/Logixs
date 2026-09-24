import {
  ForbiddenException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { AssertEvidenceAvailablePort } from "../assert-evidence-available.port";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRepository,
} from "../domain/evidence.repository";

@Injectable()
export class AssertEvidenceAvailableService implements AssertEvidenceAvailablePort {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    evidenceIds: string[];
  }): Promise<void> {
    const evidenceIds = [...new Set(input.evidenceIds)].sort();
    if (!input.tenantId.trim()) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (evidenceIds.length === 0) {
      throw new UnprocessableEntityException("EVIDENCE_REQUIRED");
    }
    const rows = await this.repository.findByIds(evidenceIds);
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const evidenceId of evidenceIds) {
      const row = byId.get(evidenceId);
      if (!row) throw new UnprocessableEntityException("EVIDENCE_REQUIRED");
      if (row.tenantId !== input.tenantId) {
        throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
      }
      if (
        row.verificationState !== "verified" ||
        row.validity !== "effective"
      ) {
        throw new UnprocessableEntityException("EVIDENCE_NOT_QUALIFIED");
      }
    }
  }
}
