import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { DecideCargoReadyAndReplayService } from "../application/decide-cargo-ready-and-replay.service";
import { AssessCargoReadyAndProjectService } from "../application/assess-cargo-ready-and-project.service";
import {
  AssessCargoReadyComplianceRequestDto,
  CargoReadyComplianceAssessmentWriteResponseDto,
  CargoReadyComplianceDecisionResponseDto,
  DecideCargoReadyComplianceRequestDto,
} from "./cargo-ready-decision.dto";

@ApiTags("compliance")
@Controller("containers/:containerId/compliance/cargo-ready")
export class CargoReadyDecisionController {
  constructor(
    private readonly decide: DecideCargoReadyAndReplayService,
    private readonly assess: AssessCargoReadyAndProjectService,
  ) {}

  @Post("assessments")
  @RequireCapabilities("compliance.review")
  @ApiOkResponse({ type: CargoReadyComplianceAssessmentWriteResponseDto })
  async createAssessment(
    @Param("containerId") containerRecordId: string,
    @Body() body: AssessCargoReadyComplianceRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<CargoReadyComplianceAssessmentWriteResponseDto> {
    const result = await this.assess.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      jurisdictionCountryCode: body.jurisdictionCountryCode,
      assessmentDate: body.assessmentDate,
      expectedAssessmentVersion: body.expectedAssessmentVersion,
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
    return {
      assessmentId: result.record.assessmentId,
      version: result.record.version,
      state: result.record.state,
      duplicate: result.duplicate,
      remediationCreated: result.projection.created,
      remediationCancelled: result.projection.cancelled,
    };
  }

  @Post("decisions")
  @RequireCapabilities("compliance.review")
  @ApiOkResponse({ type: CargoReadyComplianceDecisionResponseDto })
  async createDecision(
    @Param("containerId") containerRecordId: string,
    @Body() body: DecideCargoReadyComplianceRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<CargoReadyComplianceDecisionResponseDto> {
    const result = await this.decide.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      assessmentId: body.assessmentId,
      expectedDecisionVersion: body.expectedDecisionVersion,
      decisionCode: body.decisionCode,
      conditionRefs: body.conditionRefs,
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
    return {
      assessmentId: result.record.assessmentId,
      version: result.record.version,
      state: result.record.state,
      duplicate: result.duplicate,
      replay: result.replay,
    };
  }
}
