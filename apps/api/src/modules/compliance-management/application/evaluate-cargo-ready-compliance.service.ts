import { Inject, Injectable } from "@nestjs/common";
import {
  GET_PRODUCT_COMPLIANCE_PROFILE,
  type GetProductComplianceProfilePort,
  type ProductComplianceProfileRecord,
} from "../../master-data";
import {
  GET_CONTAINER_CARGO_COMPLIANCE_SCOPE,
  type GetContainerCargoComplianceScopePort,
} from "../../shipment-registry";
import type {
  CargoReadyComplianceGateResult,
  EvaluateCargoReadyCompliancePort,
} from "../evaluate-cargo-ready-compliance.port";
import { assessmentMatchesCurrentInputs } from "../domain/cargo-ready-compliance";
import { evaluateComplianceRuleApplicability } from "../domain/compliance-rule";
import {
  COMPLIANCE_RULE_REPOSITORY,
  type ComplianceRuleRepository,
} from "../domain/compliance-rule.repository";
import {
  CARGO_READY_COMPLIANCE_REPOSITORY,
  type CargoReadyComplianceRepository,
} from "../domain/cargo-ready-compliance.repository";

@Injectable()
export class EvaluateCargoReadyComplianceService implements EvaluateCargoReadyCompliancePort {
  constructor(
    @Inject(GET_CONTAINER_CARGO_COMPLIANCE_SCOPE)
    private readonly getScope: GetContainerCargoComplianceScopePort,
    @Inject(GET_PRODUCT_COMPLIANCE_PROFILE)
    private readonly getProfile: GetProductComplianceProfilePort,
    @Inject(COMPLIANCE_RULE_REPOSITORY)
    private readonly rules: ComplianceRuleRepository,
    @Inject(CARGO_READY_COMPLIANCE_REPOSITORY)
    private readonly repository: CargoReadyComplianceRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CargoReadyComplianceGateResult> {
    const assessment = await this.repository.findCurrent(input);
    if (!assessment) {
      return result("CARGO_READY_COMPLIANCE_NOT_ASSESSED", null, null);
    }
    const decision = assessment.currentDecision;
    if (
      !decision ||
      !["approved", "approved_with_conditions"].includes(decision.decisionCode)
    ) {
      return result(
        "CARGO_READY_COMPLIANCE_NOT_APPROVED",
        assessment.assessmentId,
        decision?.decisionId ?? null,
      );
    }
    const scope = await this.getScope.execute(input);
    const profiles = new Map<string, ProductComplianceProfileRecord | null>();
    for (const productSkuId of [
      ...new Set(scope?.items.map((item) => item.productSkuId) ?? []),
    ].sort()) {
      profiles.set(
        productSkuId,
        await this.getProfile.execute({
          tenantId: input.tenantId,
          productSkuId,
        }),
      );
    }
    const publishedRules = await this.rules.findPublishedForAssessment({
      tenantId: input.tenantId,
      jurisdictionCountryCode: assessment.jurisdictionCountryCode,
      assessmentDate: assessment.assessmentDate,
    });
    const currentRuleEvaluation = evaluateComplianceRuleApplicability({
      jurisdictionCountryCode: assessment.jurisdictionCountryCode,
      assessmentDate: assessment.assessmentDate,
      items:
        scope?.items.map((item) => ({
          replenishmentOrderLineId: item.replenishmentOrderLineId,
          productSkuId: item.productSkuId,
          productNumber: item.productNumber,
          complianceProfileId:
            profiles.get(item.productSkuId)?.profileId ?? null,
          complianceProfileVersion:
            profiles.get(item.productSkuId)?.version ?? null,
        })) ?? [],
      profiles,
      rules: publishedRules,
    });
    if (
      !assessmentMatchesCurrentInputs({
        allocationSetId: assessment.allocationSetId,
        items: assessment.items,
        ruleSnapshots: assessment.ruleSnapshots,
        scope,
        profiles,
        currentRuleSnapshots: currentRuleEvaluation.ruleSnapshots,
      })
    ) {
      return result(
        "CARGO_READY_COMPLIANCE_INPUTS_CHANGED",
        assessment.assessmentId,
        decision.decisionId,
      );
    }
    return {
      approved: true,
      reasonCode: "CARGO_READY_COMPLIANCE_APPROVED",
      assessmentId: assessment.assessmentId,
      decisionId: decision.decisionId,
    };
  }
}

function result(
  reasonCode: Exclude<
    CargoReadyComplianceGateResult["reasonCode"],
    "CARGO_READY_COMPLIANCE_APPROVED"
  >,
  assessmentId: string | null,
  decisionId: string | null,
): CargoReadyComplianceGateResult {
  return { approved: false, reasonCode, assessmentId, decisionId };
}
