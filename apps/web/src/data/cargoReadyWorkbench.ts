import type { CargoReadyComplianceAssessment } from "../api/cargoReadyCompliance";
import type {
  ContainerCargoScope,
  ContainerCargoScopeItem,
  ContainerSummary,
} from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";
import type { ExternalWorkItem } from "../api/workItems";

export type CargoReadyQueueFilter =
  "mine" | "executable" | "blocked" | "due_soon" | "all";

export type CargoReadyReadinessState =
  "ready" | "attention" | "missing" | "unreviewed" | "not_required";

export interface CargoReadyQueueItem {
  task: NodeTaskDetail;
  container: ContainerSummary | null;
  title: string;
  responsibility: string;
  dueAt: string | null;
  urgencyLabel: string;
  urgencyRank: number;
  isMine: boolean;
  isExecutable: boolean;
  isBlocked: boolean;
  isDueSoon: boolean;
  blockerReason: string | null;
  actionLabel: string | null;
}

export interface CargoReadyFactorView {
  state: CargoReadyReadinessState;
  label: string;
}

export interface CargoReadySkuReadiness {
  item: ContainerCargoScopeItem;
  overall: CargoReadyReadinessState;
  battery: CargoReadyFactorView;
  dangerousGoods: CargoReadyFactorView;
  refrigerant: CargoReadyFactorView;
  inspection: CargoReadyFactorView;
  certificates: CargoReadyFactorView;
  missingReasons: string[];
  responsibleRole: string;
  nextAction: string;
}

const FINDING_COPY: Record<string, string> = {
  PRODUCT_COMPLIANCE_PROFILE_MISSING: "缺少 SKU 合规档案",
  PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED: "SKU 合规档案尚未核验",
  BATTERY_CLASSIFICATION_UNDETERMINED: "电池属性尚未确认",
  REFRIGERANT_CLASSIFICATION_UNDETERMINED: "制冷剂属性尚未确认",
  DANGEROUS_GOODS_CLASSIFICATION_UNDETERMINED: "危险品分类尚未确认",
  INSPECTION_REQUIREMENT_UNDETERMINED: "商检、植检等检验要求尚未确认",
  COMPLIANCE_RULE_COVERAGE_MISSING: "目标市场合规规则未覆盖",
  COMPLIANCE_RULE_APPLICABILITY_UNCOVERED: "当前商品不在已发布规则适用范围内",
  RULE_APPLICABILITY_UNDETERMINED: "规则适用性尚未确认",
  REQUIRED_CERTIFICATE_MISSING_OR_INVALID: "缺少有效产品证书",
};

const FACTOR_FINDINGS = {
  battery: new Set([
    "PRODUCT_COMPLIANCE_PROFILE_MISSING",
    "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED",
    "BATTERY_CLASSIFICATION_UNDETERMINED",
  ]),
  dangerousGoods: new Set([
    "PRODUCT_COMPLIANCE_PROFILE_MISSING",
    "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED",
    "DANGEROUS_GOODS_CLASSIFICATION_UNDETERMINED",
  ]),
  refrigerant: new Set([
    "PRODUCT_COMPLIANCE_PROFILE_MISSING",
    "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED",
    "REFRIGERANT_CLASSIFICATION_UNDETERMINED",
  ]),
  inspection: new Set([
    "PRODUCT_COMPLIANCE_PROFILE_MISSING",
    "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED",
    "INSPECTION_REQUIREMENT_UNDETERMINED",
  ]),
  certificates: new Set([
    "PRODUCT_COMPLIANCE_PROFILE_MISSING",
    "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED",
    "COMPLIANCE_RULE_COVERAGE_MISSING",
    "COMPLIANCE_RULE_APPLICABILITY_UNCOVERED",
    "RULE_APPLICABILITY_UNDETERMINED",
    "REQUIRED_CERTIFICATE_MISSING_OR_INVALID",
  ]),
} as const;

export function buildCargoReadyQueue(input: {
  tasks: readonly NodeTaskDetail[];
  containers: readonly ContainerSummary[];
  actorId: string;
  now?: Date;
}): CargoReadyQueueItem[] {
  const now = input.now ?? new Date();
  const dueSoonBoundary = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const containersById = new Map(
    input.containers.map((container) => [container.id, container]),
  );

  return input.tasks
    .filter((task) => task.nodeCode === "cargo_ready")
    .map((task) => {
      const dueAt = task.nextAction?.dueAt ?? earliestDueAt(task);
      const dueDate = dueAt ? new Date(dueAt) : null;
      const overdue = dueDate ? dueDate.getTime() < now.getTime() : false;
      const isDueSoon = dueDate
        ? dueDate.getTime() <= dueSoonBoundary.getTime()
        : false;
      const isBlocked =
        task.state === "blocked" ||
        task.readinessState === "waiting_conditions";
      const isExecutable = Boolean(task.nextAction);
      const assigneeId = task.nextAction?.assigneeId ?? assignedWorkOrder(task);
      return {
        task,
        container: task.containerId
          ? (containersById.get(task.containerId) ?? null)
          : null,
        title: "完成备货确认",
        responsibility: responsibilityLabel(task, assigneeId, input.actorId),
        dueAt,
        urgencyLabel: overdue
          ? "已逾期"
          : isDueSoon
            ? "临期"
            : isBlocked
              ? "受阻"
              : "常规",
        urgencyRank: overdue ? 0 : isDueSoon ? 1 : isBlocked ? 2 : 3,
        isMine: assigneeId === input.actorId,
        isExecutable,
        isBlocked,
        isDueSoon,
        blockerReason: blockerReason(task),
        actionLabel: actionLabel(task.nextAction?.actionCode),
      };
    })
    .sort(
      (left, right) =>
        left.urgencyRank - right.urgencyRank ||
        compareNullableDates(left.dueAt, right.dueAt) ||
        left.task.id.localeCompare(right.task.id),
    );
}

export function filterCargoReadyQueue(
  items: readonly CargoReadyQueueItem[],
  filter: CargoReadyQueueFilter,
): CargoReadyQueueItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => {
    if (filter === "mine") return item.isMine;
    if (filter === "executable") return item.isExecutable;
    if (filter === "blocked") return item.isBlocked;
    return item.isDueSoon;
  });
}

export function cargoReadyRoleLabel(roleCode: string): string {
  const labels: Record<string, string> = {
    cargo_ready_operator: "备货专员",
    compliance_operator: "商品合规专员",
    compliance_reviewer: "合规复核岗",
  };
  return labels[roleCode] ?? "合规责任岗";
}

export function buildCargoReadySkuReadiness(input: {
  cargo: ContainerCargoScope | null;
  assessment: CargoReadyComplianceAssessment | null;
  remediationItems: readonly ExternalWorkItem[];
}): CargoReadySkuReadiness[] {
  if (!input.cargo) return [];
  const assessmentIsCurrent = matchesCargoSnapshot(
    input.cargo,
    input.assessment,
  );
  return input.cargo.items.map((item) =>
    assessmentIsCurrent && input.assessment
      ? assessedReadiness(item, input.assessment, input.remediationItems)
      : unreviewedReadiness(
          item,
          input.assessment
            ? "装载明细已变化，需要重新评审"
            : "本柜尚未完成合规评审",
        ),
  );
}

function assessedReadiness(
  item: ContainerCargoScopeItem,
  assessment: CargoReadyComplianceAssessment,
  remediationItems: readonly ExternalWorkItem[],
): CargoReadySkuReadiness {
  const findings = assessment.findings.filter(
    (finding) =>
      finding.productSkuId === item.productSkuId ||
      finding.productSkuId === null,
  );
  const findingCodes = new Set(findings.map((finding) => finding.code));
  const requiredCertificateTypes = assessment.applicableRules
    .filter((rule) => rule.productSkuId === item.productSkuId)
    .flatMap((rule) => rule.requiredCertificateTypes);
  const missingReasons = findings.map(
    (finding) => FINDING_COPY[finding.code] ?? "存在待处理的合规缺口",
  );
  const hasRemediation = remediationItems.some(
    (workItem) =>
      workItem.state === "open" &&
      workItem.sourceRecordId === assessment.assessmentId,
  );

  return {
    item,
    overall: findings.length ? "missing" : "ready",
    battery: factorState(findingCodes, FACTOR_FINDINGS.battery),
    dangerousGoods: factorState(findingCodes, FACTOR_FINDINGS.dangerousGoods),
    refrigerant: factorState(findingCodes, FACTOR_FINDINGS.refrigerant),
    inspection: factorState(findingCodes, FACTOR_FINDINGS.inspection),
    certificates:
      requiredCertificateTypes.length === 0 &&
      !hasAny(findingCodes, FACTOR_FINDINGS.certificates)
        ? { state: "not_required", label: "当前规则未要求" }
        : factorState(findingCodes, FACTOR_FINDINGS.certificates),
    missingReasons,
    responsibleRole: findings.length
      ? hasRemediation
        ? "合规整改责任岗"
        : "商品合规专员"
      : "备货专员",
    nextAction: nextSkuAction(findingCodes, findings.length),
  };
}

function unreviewedReadiness(
  item: ContainerCargoScopeItem,
  reason: string,
): CargoReadySkuReadiness {
  const unreviewed = { state: "unreviewed" as const, label: "未评审" };
  return {
    item,
    overall: "unreviewed",
    battery: unreviewed,
    dangerousGoods: unreviewed,
    refrigerant: unreviewed,
    inspection: unreviewed,
    certificates: unreviewed,
    missingReasons: [reason],
    responsibleRole: "合规评审岗",
    nextAction: "发起本柜合规评审",
  };
}

function matchesCargoSnapshot(
  cargo: ContainerCargoScope,
  assessment: CargoReadyComplianceAssessment | null,
): assessment is CargoReadyComplianceAssessment {
  if (!assessment || !cargo.allocationSetId) return false;
  return (
    assessment.allocationSetId === cargo.allocationSetId &&
    assessment.allocationSetVersion === cargo.allocationSetVersion &&
    assessment.items.length === cargo.items.length &&
    assessment.items.every((assessmentItem) =>
      cargo.items.some(
        (cargoItem) =>
          cargoItem.replenishmentOrderLineId ===
            assessmentItem.replenishmentOrderLineId &&
          cargoItem.productSkuId === assessmentItem.productSkuId,
      ),
    )
  );
}

function factorState(
  codes: ReadonlySet<string>,
  relevant: ReadonlySet<string>,
): CargoReadyFactorView {
  if (hasAny(codes, relevant)) return { state: "attention", label: "待确认" };
  return { state: "ready", label: "已确认" };
}

function hasAny(
  values: ReadonlySet<string>,
  expected: ReadonlySet<string>,
): boolean {
  return [...expected].some((value) => values.has(value));
}

function nextSkuAction(
  codes: ReadonlySet<string>,
  findingCount: number,
): string {
  if (codes.has("PRODUCT_COMPLIANCE_PROFILE_MISSING"))
    return "建立 SKU 合规档案";
  if (codes.has("PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED"))
    return "核验 SKU 合规档案";
  if (codes.has("REQUIRED_CERTIFICATE_MISSING_OR_INVALID"))
    return "补齐并核验产品证书";
  if (codes.has("BATTERY_CLASSIFICATION_UNDETERMINED")) return "确认电池属性";
  if (codes.has("DANGEROUS_GOODS_CLASSIFICATION_UNDETERMINED"))
    return "确认危险品分类";
  if (codes.has("REFRIGERANT_CLASSIFICATION_UNDETERMINED"))
    return "确认制冷剂属性";
  if (codes.has("INSPECTION_REQUIREMENT_UNDETERMINED")) return "确认检验要求";
  return findingCount ? "进入合规评审处理缺口" : "等待或完成备货任务";
}

function blockerReason(task: NodeTaskDetail): string | null {
  if (task.readinessState === "waiting_conditions") return "前序条件尚未具备";
  if (task.state === "blocked") return "任务已阻塞，需要处理缺口";
  if (!task.nextAction && task.state !== "completed")
    return "等待系统给出下一动作";
  return null;
}

function responsibilityLabel(
  task: NodeTaskDetail,
  assigneeId: string | null,
  actorId: string,
): string {
  if (assigneeId === actorId) return "我负责";
  if (assigneeId) return `已分配：${assigneeId}`;
  if (task.nextAction?.assignmentState === "automatic") return "系统自动处理";
  return "备货共享池";
}

function assignedWorkOrder(task: NodeTaskDetail): string | null {
  return (
    task.workOrders.find((workOrder) => workOrder.assigneeId)?.assigneeId ??
    null
  );
}

function earliestDueAt(task: NodeTaskDetail): string | null {
  return (
    task.workOrders
      .map((workOrder) => workOrder.dueAt)
      .filter((dueAt): dueAt is string => Boolean(dueAt))
      .sort()[0] ?? null
  );
}

function actionLabel(actionCode: string | undefined): string | null {
  if (actionCode === "work_execution.claim_work_order") return "领取任务";
  if (actionCode === "work_execution.complete_work_order") return "完成备货";
  return actionCode ? "处理当前任务" : null;
}

function compareNullableDates(
  left: string | null,
  right: string | null,
): number {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}
