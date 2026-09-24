import type { CargoReadyComplianceAssessment } from "../api/cargoReadyCompliance";
import type {
  ReplenishmentOrderLine,
  ReplenishmentOrderWorkbenchItem,
} from "../api/replenishmentOrders";

export type CargoReadyQueueFilter = "mine" | "waiting_other" | "all";

export interface CargoReadyQueueItem {
  order: ReplenishmentOrderWorkbenchItem;
  title: string;
  detail: string;
  responsibility: "mine" | "waiting_other";
  relatedContainerLabel: string;
  lineCount: number;
  gapCount: number;
}

export interface CargoReadyEvidenceRequirement {
  productSkuId: string;
  certificateType: string;
  label: string;
  status: "verified" | "missing_or_invalid";
  reason: string;
}

export interface CargoReadySkuComplianceEvaluation {
  productSkuId: string;
  evaluated: boolean;
  requirements: CargoReadyEvidenceRequirement[];
}

export interface CargoReadySkuView {
  line: ReplenishmentOrderLine;
  overall: "ready" | "attention";
  attributeSummary: string[];
  requirementSummary: string;
  requirements: CargoReadyEvidenceRequirement[];
  gaps: Array<{ code: string; label: string; detail?: string }>;
}

const CERTIFICATE_LABELS: Record<string, string> = {
  un38_3: "UN38.3",
  sds: "SDS",
  transport_safety_assessment: "运输条件鉴定",
  ce: "CE 证书",
  ukca: "UKCA 证书",
  fcc: "FCC 证书",
  cpsc: "CPSC 证书",
  rohs: "RoHS 证书",
  reach: "REACH 证书",
  weee: "WEEE 资料",
  epr: "EPR 资料",
  battery_regulation: "电池法规资料",
  certificate_of_origin: "原产地证",
  wood_origin: "木材来源证明",
  phytosanitary_certificate: "植检证书",
  fumigation_certificate: "熏蒸证书",
  commodity_inspection_certificate: "商检证书",
  veterinary_certificate: "兽医证书",
  sanitary_certificate: "卫生证书",
  food_safety_certificate: "食品安全证书",
};

export function buildCargoReadyOrderQueue(
  orders: readonly ReplenishmentOrderWorkbenchItem[],
): CargoReadyQueueItem[] {
  return orders
    .map((order) => ({
      order,
      title: order.workReason.label,
      detail: order.workReason.detail,
      responsibility: order.workReason.responsibility,
      relatedContainerLabel: relatedContainerLabel(order),
      lineCount: order.lines.length,
      gapCount: order.lines.filter((line) => line.gaps.length > 0).length,
    }))
    .sort(
      (left, right) =>
        responsibilityRank(left.responsibility) -
          responsibilityRank(right.responsibility) ||
        right.order.updatedAt.localeCompare(left.order.updatedAt) ||
        left.order.id.localeCompare(right.order.id),
    );
}

export function filterCargoReadyQueue(
  items: readonly CargoReadyQueueItem[],
  filter: CargoReadyQueueFilter,
): CargoReadyQueueItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => item.responsibility === filter);
}

export function buildCargoReadySkuViews(
  order: ReplenishmentOrderWorkbenchItem,
  evaluations: readonly CargoReadySkuComplianceEvaluation[],
): CargoReadySkuView[] {
  const evaluationBySku = new Map(
    evaluations.map((evaluation) => [evaluation.productSkuId, evaluation]),
  );
  return order.lines.map((line) => {
    const evaluation = line.productSkuId
      ? evaluationBySku.get(line.productSkuId)
      : undefined;
    const requirements = evaluation?.requirements ?? [];
    const evidenceGaps = requirements
      .filter((requirement) => requirement.status === "missing_or_invalid")
      .map((requirement) => ({
        code: `certificate:${requirement.certificateType}`,
        label: `${requirement.label}缺失或无效`,
        detail: requirement.reason,
      }));
    const gaps = [...line.gaps, ...evidenceGaps];
    return {
      line,
      overall: gaps.length > 0 ? "attention" : "ready",
      attributeSummary: attributeSummary(line),
      requirements,
      gaps,
      requirementSummary: requirementSummary(evaluation, gaps.length),
    };
  });
}

export function buildCargoReadyComplianceEvaluations(
  assessments: readonly CargoReadyComplianceAssessment[],
): CargoReadySkuComplianceEvaluation[] {
  const evaluations = new Map<string, CargoReadySkuComplianceEvaluation>();
  for (const assessment of assessments) {
    for (const item of assessment.items) {
      const current = evaluations.get(item.productSkuId) ?? {
        productSkuId: item.productSkuId,
        evaluated: true,
        requirements: [],
      };
      const existingKeys = new Set(
        current.requirements.map(
          (requirement) =>
            `${requirement.certificateType}:${requirement.reason}`,
        ),
      );
      for (const rule of assessment.applicableRules.filter(
        (candidate) => candidate.productSkuId === item.productSkuId,
      )) {
        for (const certificateType of rule.requiredCertificateTypes) {
          const reason = `${rule.ruleCode} v${rule.version} 要求`;
          const key = `${certificateType}:${reason}`;
          if (existingKeys.has(key)) continue;
          const missing = assessment.findings.some(
            (finding) =>
              finding.code === "REQUIRED_CERTIFICATE_MISSING_OR_INVALID" &&
              finding.productSkuId === item.productSkuId &&
              finding.ruleVersionId === rule.ruleVersionId,
          );
          current.requirements.push({
            productSkuId: item.productSkuId,
            certificateType,
            label: certificateLabel(certificateType),
            status: missing ? "missing_or_invalid" : "verified",
            reason,
          });
          existingKeys.add(key);
        }
      }
      evaluations.set(item.productSkuId, current);
    }
  }
  return [...evaluations.values()];
}

export function cargoReadyRoleLabel(roleCode: string): string {
  const labels: Record<string, string> = {
    cargo_ready_operator: "备货专员",
    compliance_operator: "商品合规专员",
    compliance_reviewer: "合规复核岗",
  };
  return labels[roleCode] ?? "合规责任岗";
}

function attributeSummary(line: ReplenishmentOrderLine): string[] {
  if (!line.productSkuId) return ["SKU 身份待确认"];
  if (!line.profile) return ["物料属性档案待补充"];
  return [
    batteryLabel(
      line.profile.battery.presenceState,
      line.profile.battery.packingMode,
    ),
    dangerousGoodsLabel(line.profile.dangerousGoods.classificationState),
    refrigerantLabel(line.profile.refrigerant.presenceState),
  ];
}

function batteryLabel(
  presenceState: string,
  packingMode: string | null,
): string {
  if (presenceState === "absent") return "不含电池";
  if (presenceState === "unknown") return "电池属性待确认";
  const mode =
    packingMode === "packed_with_equipment"
      ? "随设备包装"
      : packingMode === "contained_in_equipment"
        ? "内置于设备"
        : packingMode === "battery_only"
          ? "单独电池"
          : "包装方式待确认";
  return `含电池 · ${mode}`;
}

function dangerousGoodsLabel(classificationState: string): string {
  if (classificationState === "not_regulated") return "非危险品";
  if (classificationState === "regulated") return "危险品";
  return "危险品属性待确认";
}

function refrigerantLabel(presenceState: string): string {
  if (presenceState === "absent") return "不含制冷剂";
  if (presenceState === "present") return "含制冷剂";
  return "制冷剂属性待确认";
}

function requirementSummary(
  evaluation: CargoReadySkuComplianceEvaluation | undefined,
  gapCount: number,
): string {
  if (!evaluation?.evaluated) return "合规要求待出运上下文确认";
  if (evaluation.requirements.length === 0) return "本次无需补充合规资料";
  if (gapCount > 0) return "存在需要处理的资料缺口";
  return "本次适用资料已核验";
}

function certificateLabel(certificateType: string): string {
  return CERTIFICATE_LABELS[certificateType] ?? certificateType;
}

function relatedContainerLabel(order: ReplenishmentOrderWorkbenchItem): string {
  if (order.relatedContainers.length === 0) return "尚未分配货柜";
  if (order.relatedContainers.length === 1)
    return order.relatedContainers[0]!.containerNumber ?? "货柜号待补充";
  return `已分配 ${order.relatedContainers.length} 个货柜`;
}

function responsibilityRank(value: "mine" | "waiting_other"): number {
  return value === "mine" ? 0 : 1;
}
