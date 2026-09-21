import {
  ASSERT_EVIDENCE_REFS,
  type AssertEvidenceRefsPort,
} from "../../document-records";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  GET_PRODUCT_COMPLIANCE_PROFILE,
  type GetProductComplianceProfilePort,
} from "../../master-data";
import {
  GET_CONTAINER_CARGO_COMPLIANCE_SCOPE,
  ASSERT_CONTAINER_TENANT,
  type AssertContainerTenantPort,
  type GetContainerCargoComplianceScopePort,
} from "../../shipment-registry";
import type { AssessCargoReadyCompliancePort } from "../assess-cargo-ready-compliance.port";
import {
  buildCargoReadyAssessment,
  assertCargoReadyAssessmentCommand,
  CargoReadyComplianceValidationError,
  type CreateCargoReadyAssessmentCommand,
} from "../domain/cargo-ready-compliance";
import { evaluateComplianceRuleApplicability } from "../domain/compliance-rule";
import {
  COMPLIANCE_RULE_REPOSITORY,
  type ComplianceRuleRepository,
} from "../domain/compliance-rule.repository";
import {
  CARGO_READY_COMPLIANCE_REPOSITORY,
  CargoReadyComplianceConflictError,
  type CargoReadyComplianceRepository,
} from "../domain/cargo-ready-compliance.repository";

@Injectable()
export class AssessCargoReadyComplianceService implements AssessCargoReadyCompliancePort {
  constructor(
    @Inject(ASSERT_CONTAINER_TENANT)
    private readonly assertContainerTenant: AssertContainerTenantPort,
    @Inject(ASSERT_EVIDENCE_REFS)
    private readonly assertEvidenceRefs: AssertEvidenceRefsPort,
    @Inject(GET_CONTAINER_CARGO_COMPLIANCE_SCOPE)
    private readonly getScope: GetContainerCargoComplianceScopePort,
    @Inject(GET_PRODUCT_COMPLIANCE_PROFILE)
    private readonly getProfile: GetProductComplianceProfilePort,
    @Inject(COMPLIANCE_RULE_REPOSITORY)
    private readonly rules: ComplianceRuleRepository,
    @Inject(CARGO_READY_COMPLIANCE_REPOSITORY)
    private readonly repository: CargoReadyComplianceRepository,
  ) {}

  async execute(command: CreateCargoReadyAssessmentCommand) {
    try {
      assertCargoReadyAssessmentCommand(command);
    } catch (error) {
      if (error instanceof CargoReadyComplianceValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await this.assertContainerTenant.execute({
      tenantId: command.tenantId,
      containerId: command.containerRecordId,
    });
    await this.assertEvidenceRefs.execute({
      tenantId: command.tenantId,
      subjectType: "container",
      subjectId: command.containerRecordId,
      evidenceIds: command.evidenceRefs,
    });
    const scope = await this.getScope.execute({
      tenantId: command.tenantId,
      containerRecordId: command.containerRecordId,
    });
    const profiles = new Map();
    for (const productSkuId of [
      ...new Set(scope?.items.map((item) => item.productSkuId) ?? []),
    ].sort()) {
      profiles.set(
        productSkuId,
        await this.getProfile.execute({
          tenantId: command.tenantId,
          productSkuId,
        }),
      );
    }
    const publishedRules = await this.rules.findPublishedForAssessment({
      tenantId: command.tenantId,
      jurisdictionCountryCode: command.jurisdictionCountryCode.toUpperCase(),
      assessmentDate: command.assessmentDate,
    });
    const items =
      scope?.items.map((item) => ({
        replenishmentOrderLineId: item.replenishmentOrderLineId,
        productSkuId: item.productSkuId,
        productNumber: item.productNumber,
        complianceProfileId: profiles.get(item.productSkuId)?.profileId ?? null,
        complianceProfileVersion:
          profiles.get(item.productSkuId)?.version ?? null,
      })) ?? [];
    const ruleEvaluation = evaluateComplianceRuleApplicability({
      jurisdictionCountryCode: command.jurisdictionCountryCode.toUpperCase(),
      assessmentDate: command.assessmentDate,
      items,
      profiles,
      rules: publishedRules,
    });
    try {
      return await this.repository.replaceAssessment(
        buildCargoReadyAssessment({
          command,
          scope,
          profiles,
          ruleEvaluation,
        }),
      );
    } catch (error) {
      if (error instanceof CargoReadyComplianceValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof CargoReadyComplianceConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
