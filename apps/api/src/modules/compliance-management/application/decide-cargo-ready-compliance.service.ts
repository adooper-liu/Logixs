import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import type { DecideCargoReadyCompliancePort } from "../decide-cargo-ready-compliance.port";
import {
  CargoReadyComplianceValidationError,
  normalizeCargoReadyDecision,
  type DecideCargoReadyComplianceCommand,
} from "../domain/cargo-ready-compliance";
import {
  CARGO_READY_COMPLIANCE_REPOSITORY,
  CargoReadyComplianceConflictError,
  CargoReadyComplianceNotFoundError,
  type CargoReadyComplianceRepository,
} from "../domain/cargo-ready-compliance.repository";

@Injectable()
export class DecideCargoReadyComplianceService implements DecideCargoReadyCompliancePort {
  constructor(
    @Inject(CARGO_READY_COMPLIANCE_REPOSITORY)
    private readonly repository: CargoReadyComplianceRepository,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
  ) {}

  async execute(command: DecideCargoReadyComplianceCommand) {
    try {
      const normalized = normalizeCargoReadyDecision(command);
      await this.assertEvidenceRefs.execute({
        tenantId: normalized.tenantId,
        subjectType: "cargo_ready_compliance_assessment",
        subjectId: normalized.assessmentId,
        evidenceIds: normalized.evidenceRefs,
      });
      return await this.repository.decide(normalized);
    } catch (error) {
      if (error instanceof CargoReadyComplianceValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof CargoReadyComplianceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CargoReadyComplianceConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
