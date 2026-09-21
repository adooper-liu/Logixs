import { Controller, Get, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { GetCargoReadyComplianceAssessmentService } from "../application/get-cargo-ready-compliance-assessment.service";
import type { CargoReadyAssessmentRecord } from "../domain/cargo-ready-compliance.repository";
import { CargoReadyComplianceAssessmentResponseDto } from "./cargo-ready-compliance.dto";

@ApiTags("compliance")
@Controller("containers/:containerId/compliance/cargo-ready")
export class CargoReadyComplianceController {
  constructor(
    private readonly getCurrent: GetCargoReadyComplianceAssessmentService,
  ) {}

  @Get()
  @RequireCapabilities("compliance.read")
  @ApiOkResponse({ type: CargoReadyComplianceAssessmentResponseDto })
  async get(
    @Param("containerId") containerRecordId: string,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<CargoReadyComplianceAssessmentResponseDto | null> {
    const record = await this.getCurrent.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
    });
    return record ? toResponse(record) : null;
  }
}

function toResponse(
  record: CargoReadyAssessmentRecord,
): CargoReadyComplianceAssessmentResponseDto {
  return {
    assessmentId: record.assessmentId,
    containerRecordId: record.containerRecordId,
    version: record.version,
    state: record.state,
    jurisdictionCountryCode: record.jurisdictionCountryCode,
    assessmentDate: record.assessmentDate,
    allocationSetId: record.allocationSetId,
    allocationSetVersion: record.allocationSetVersion,
    items: record.items,
    findings: record.findings,
    applicableRules: record.ruleSnapshots,
    evidenceRefs: record.evidenceRefs,
    actorId: record.actorId,
    reasonCode: record.reasonCode,
    currentDecision: record.currentDecision,
    createdAt: record.createdAt,
  };
}
