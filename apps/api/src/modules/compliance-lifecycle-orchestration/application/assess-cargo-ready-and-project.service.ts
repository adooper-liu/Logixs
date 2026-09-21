import { Inject, Injectable } from "@nestjs/common";
import {
  ASSESS_CARGO_READY_COMPLIANCE,
  type AssessCargoReadyCompliancePort,
  type CreateCargoReadyAssessmentCommand,
} from "../../compliance-management";
import {
  PROJECT_EXTERNAL_WORK_ITEMS,
  type ProjectExternalWorkItemsPort,
} from "../../work-execution";

const FINDING_LABELS: Record<string, string> = {
  CARGO_ALLOCATION_MISSING: "补齐货柜装载明细",
  PRODUCT_COMPLIANCE_PROFILE_MISSING: "建立 SKU 合规档案",
  PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED: "核验 SKU 合规档案",
  BATTERY_CLASSIFICATION_UNDETERMINED: "确认电池分类",
  REFRIGERANT_CLASSIFICATION_UNDETERMINED: "确认制冷剂分类",
  DANGEROUS_GOODS_CLASSIFICATION_UNDETERMINED: "确认危险品分类",
  INSPECTION_REQUIREMENT_UNDETERMINED: "确认商检或植检要求",
  COMPLIANCE_RULE_COVERAGE_MISSING: "补齐司法辖区规则覆盖",
  COMPLIANCE_RULE_APPLICABILITY_UNCOVERED: "补齐 SKU 适用规则",
  RULE_APPLICABILITY_UNDETERMINED: "核实规则适用条件",
  REQUIRED_CERTIFICATE_MISSING_OR_INVALID: "补齐或核验证书",
};

@Injectable()
export class AssessCargoReadyAndProjectService {
  constructor(
    @Inject(ASSESS_CARGO_READY_COMPLIANCE)
    private readonly assess: AssessCargoReadyCompliancePort,
    @Inject(PROJECT_EXTERNAL_WORK_ITEMS)
    private readonly projectWorkItems: ProjectExternalWorkItemsPort,
  ) {}

  async execute(command: CreateCargoReadyAssessmentCommand) {
    const assessment = await this.assess.execute(command);
    const findings = [...assessment.record.findings].sort(findingOrder);
    const projection = await this.projectWorkItems.execute({
      tenantId: command.tenantId,
      sourceModule: "compliance-management",
      sourceType: "cargo_ready_compliance_assessment",
      sourceScopeId: `container:${command.containerRecordId}:cargo_ready`,
      sourceRecordId: assessment.record.assessmentId,
      sourceVersion: assessment.record.version,
      containerId: command.containerRecordId,
      items: findings.map((finding, index) => ({
        sourceItemKey: [
          finding.code,
          finding.productSkuId ?? "container",
          finding.ruleVersionId ?? "no-rule",
          String(index),
        ].join(":"),
        taskDefinitionKey: `compliance-remediation:${finding.code}`,
        title: FINDING_LABELS[finding.code] ?? "处理合规整改项",
        detail: finding.detail,
        priority: "high",
        assignedRoleCode: "review_supervisor",
        evidenceRefs: assessment.record.evidenceRefs,
      })),
    });
    return { ...assessment, projection };
  }
}

function findingOrder(
  left: {
    code: string;
    productSkuId: string | null;
    ruleVersionId: string | null;
    detail: string;
  },
  right: {
    code: string;
    productSkuId: string | null;
    ruleVersionId: string | null;
    detail: string;
  },
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.productSkuId ?? "").localeCompare(right.productSkuId ?? "") ||
    (left.ruleVersionId ?? "").localeCompare(right.ruleVersionId ?? "") ||
    left.detail.localeCompare(right.detail)
  );
}
