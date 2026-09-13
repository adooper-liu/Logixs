import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  DecideEvidenceService,
  type DecideEvidenceResult,
} from "../application/decide-evidence.service";
import { RegisterEvidenceService } from "../application/register-evidence.service";
import type { EvidenceRecord } from "../domain/evidence.repository";
import type { VerificationDecision } from "../domain/verification-decision";
import {
  EvidenceRecordDto,
  RegisterEvidenceRequestDto,
  VerifyEvidenceRequestDto,
} from "./evidence.dto";

@ApiTags("evidence")
@Controller("evidence")
export class EvidenceController {
  constructor(
    private readonly registerEvidence: RegisterEvidenceService,
    private readonly decideEvidence: DecideEvidenceService,
  ) {}

  @Post()
  @ApiOkResponse({ type: EvidenceRecordDto })
  async register(
    @Body() body: RegisterEvidenceRequestDto,
    @Req() request: { devIdentity: { tenantId: string } },
  ): Promise<EvidenceRecordDto> {
    return toDto({
      record: await this.registerEvidence.execute({
        tenantId: request.devIdentity.tenantId,
        evidenceType: body.evidenceType,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        authorityLevel: body.authorityLevel,
        contentRef: body.contentRef,
        contentHash: body.contentHash,
        sourceType: body.sourceType,
        originatorSystem: body.originatorSystem,
        authoritySystem: body.authoritySystem,
        ingestionChannel: body.ingestionChannel,
        captureSource: body.captureSource,
      }),
      decisionId: null,
    });
  }

  @Post(":id/verify")
  @ApiOkResponse({ type: EvidenceRecordDto })
  verify(
    @Param("id") id: string,
    @Body() body: VerifyEvidenceRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<EvidenceRecordDto> {
    return this.decide(id, "verified", body, request);
  }

  @Post(":id/reject")
  @ApiOkResponse({ type: EvidenceRecordDto })
  reject(
    @Param("id") id: string,
    @Body() body: VerifyEvidenceRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<EvidenceRecordDto> {
    return this.decide(id, "rejected", body, request);
  }

  @Post(":id/revoke")
  @ApiOkResponse({ type: EvidenceRecordDto })
  revoke(
    @Param("id") id: string,
    @Body() body: VerifyEvidenceRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<EvidenceRecordDto> {
    return this.decide(id, "revoked", body, request);
  }

  private async decide(
    id: string,
    decision: VerificationDecision,
    body: VerifyEvidenceRequestDto,
    request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<EvidenceRecordDto> {
    return toDto(
      await this.decideEvidence.execute({
        evidenceId: id,
        tenantId: request.devIdentity.tenantId,
        actorOrServiceId: request.devIdentity.operatorId,
        reasonCode: body.reasonCode,
        reason: body.reason,
        decision,
      }),
    );
  }
}

function toDto(
  result:
    | DecideEvidenceResult
    | { record: EvidenceRecord; decisionId: string | null },
): EvidenceRecordDto {
  return {
    evidenceId: result.record.id,
    tenantId: result.record.tenantId,
    evidenceType: result.record.evidenceType,
    subjectType: result.record.subjectType,
    subjectId: result.record.subjectId,
    verificationState: result.record.verificationState,
    validity: result.record.validity,
    recordedAt: result.record.recordedAt.toISOString(),
    verificationDecisionId: result.decisionId,
  };
}
