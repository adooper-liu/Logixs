import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EVIDENCE_REPOSITORY,
  type EvidenceRecord,
  type EvidenceRepository,
} from "../domain/evidence.repository";
import {
  decideVerificationTransition,
  type VerificationDecision,
} from "../domain/verification-decision";

export interface DecideEvidenceInput {
  evidenceId: string;
  tenantId: string;
  actorOrServiceId: string;
  reasonCode: string;
  reason?: string;
  decision: VerificationDecision;
}

export interface DecideEvidenceResult {
  record: EvidenceRecord;
  decisionId: string | null;
  appended: boolean;
}

@Injectable()
export class DecideEvidenceService {
  constructor(
    @Inject(EVIDENCE_REPOSITORY)
    private readonly repository: EvidenceRepository,
  ) {}

  async execute(input: DecideEvidenceInput): Promise<DecideEvidenceResult> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (!input.actorOrServiceId?.trim() || input.actorOrServiceId.length > 128) {
      throw new HttpException(
        "VALIDATION_FORMAT: actorOrServiceId 无效",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!input.reasonCode?.trim() || input.reasonCode.length > 64) {
      throw new HttpException(
        "VALIDATION_FORMAT: reasonCode 无效",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.reason !== undefined && input.reason.length > 500) {
      throw new HttpException(
        "VALIDATION_FORMAT: reason 无效",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.repository.findById(input.evidenceId);
    if (!existing) throw new NotFoundException("RESOURCE_NOT_FOUND");
    if (existing.tenantId !== input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }

    const latestVerifiedDecisionId =
      input.decision === "revoked"
        ? await this.repository.findLatestVerifiedDecisionId(existing.id)
        : null;
    const transition = decideVerificationTransition({
      currentState: existing.verificationState,
      currentValidity: existing.validity,
      decision: input.decision,
      latestVerifiedDecisionId,
    });
    if (transition.kind === "already_done") {
      return { record: existing, decisionId: null, appended: false };
    }
    if (transition.kind === "reject") {
      throw new HttpException(
        `${transition.code}: ${transition.message}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.repository.appendDecision({
      evidenceId: existing.id,
      decision: input.decision,
      nextState: transition.nextState,
      nextValidity: transition.nextValidity,
      actorOrServiceId: input.actorOrServiceId.trim(),
      reasonCode: input.reasonCode.trim(),
      reason: input.reason?.trim() || undefined,
      previousDecisionId:
        input.decision === "revoked" ? latestVerifiedDecisionId : undefined,
    });
  }
}
