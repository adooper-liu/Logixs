import type { ShipmentHandoffIssueV1 } from "@logix/contracts";

export interface HandoffIssueInput {
  readonly code: ShipmentHandoffIssueV1["code"];
  readonly fieldCodes?: readonly string[];
  readonly blocking?: boolean;
}

const ISSUE_COPY: Record<ShipmentHandoffIssueV1["code"], string> = {
  SOURCE_RANGE_METADATA_INVALID: "文件范围标记异常，已按实际单元格读取",
  SOURCE_DATA_INCOMPLETE: "该柜的来源资料尚未到齐",
  FIELD_SEMANTIC_MISMATCH: "四份来源中的业务身份不一致",
  INVALID_SOURCE_VALUE: "来源行缺失或字段值无效",
  DEPARTURE_PROOF_REQUIRED: "实际离港时间缺少时区或权威证据",
  EXTERNAL_SHIPMENT_MATCH_REQUIRED: "需要确认这些货柜属于哪一票出运",
  UNKNOWN_REFERENCE_CODE: "港口、货主或其他主数据尚未完成映射",
  CARGO_DETAIL_INCOMPLETE: "缺少可核对的 SKU 装载明细",
  CONTAINER_ACTIVE_SHIPMENT_CONFLICT: "货柜已属于另一票活动出运",
  CONTAINER_SOURCE_IDENTITY_CONFLICT: "货柜来源身份与已有记录冲突",
  IDEMPOTENCY_PAYLOAD_CONFLICT: "同一来源批次提交了不同内容",
  SHIPMENT_SOURCE_IDENTITY_CONFLICT: "出运来源身份与已有记录冲突",
  SHIPMENT_NUMBER_CONFLICT: "出运号与已有记录冲突",
  SHIPMENT_RELATIONSHIP_VERSION_CONFLICT: "出运与货柜关系已被更新",
  SUPERSEDED_HANDOFF_NOT_FOUND: "找不到要更正的上一版交接",
  SOURCE_BATCH_REQUIRED: "缺少来源批次",
  MAPPING_VERSION_REQUIRED: "缺少已确认的字段映射版本",
  STUFFING_SNAPSHOT_REQUIRED: "缺少装箱快照",
  STUFFING_SNAPSHOT_VERSION_STALE: "装箱快照已不是最新版本",
  CARGO_ALLOCATION_REQUIRED: "缺少本柜实际装载分配",
  BILL_REFERENCE_NOT_FOUND: "提单引用无法匹配",
  DUPLICATE_REFERENCE: "同一来源出现重复业务身份",
};

export function handoffIssueCopy(issue: HandoffIssueInput): string {
  return ISSUE_COPY[issue.code];
}

export type HandoffResolutionTarget =
  | "sources"
  | "shipment_grouping"
  | "origin_port"
  | "destination_port"
  | "departure"
  | "cargo"
  | "cargo_owner";

export interface HandoffIssueAction {
  title: string;
  impact: string;
  actionLabel: string;
  target: HandoffResolutionTarget;
}

export function handoffIssueAction(
  issue: HandoffIssueInput,
): HandoffIssueAction {
  const fields = new Set(issue.fieldCodes ?? []);
  if (fields.has("origin_port_code")) {
    return {
      title: "起运港待确认",
      impact: "影响路线识别，不影响接管",
      actionLabel: "确认起运港",
      target: "origin_port",
    };
  }
  if (fields.has("destination_port_code")) {
    return {
      title: "目的港待确认",
      impact: "影响到港与清关准备，不影响接管",
      actionLabel: "确认目的港",
      target: "destination_port",
    };
  }
  if (issue.code === "DEPARTURE_PROOF_REQUIRED") {
    return {
      title: "离港依据待补",
      impact: "影响离港时间精度，不影响在途跟踪",
      actionLabel: "补离港依据",
      target: "departure",
    };
  }
  if (issue.code === "EXTERNAL_SHIPMENT_MATCH_REQUIRED") {
    return {
      title: "所属出运待确认",
      impact: "需要判断归入现有出运，还是建立一票独立出运",
      actionLabel: "确认所属出运",
      target: "shipment_grouping",
    };
  }
  if (
    issue.code === "CARGO_DETAIL_INCOMPLETE" ||
    issue.code === "CARGO_ALLOCATION_REQUIRED"
  ) {
    return {
      title: "SKU 装载明细待补",
      impact: "影响货物核对与后续资料准备",
      actionLabel: "补 SKU 明细",
      target: "cargo",
    };
  }
  if (
    fields.has("cargo_owner_reference_id") ||
    fields.has("sales_country_code")
  ) {
    return {
      title: "货主与销售国家待确认",
      impact: "影响责任主体与适用国家规则",
      actionLabel: "确认货主信息",
      target: "cargo_owner",
    };
  }
  return {
    title: handoffIssueCopy(issue),
    impact: isHandoffIssueBlocking(issue)
      ? "身份或引用冲突，解决后才能接管本柜"
      : "资料可后补，不影响已识别对象接管",
    actionLabel: isHandoffIssueBlocking(issue) ? "核对来源" : "补充来源",
    target: "sources",
  };
}

export function isHandoffIssueBlocking(issue: HandoffIssueInput): boolean {
  if (issue.blocking !== undefined) return issue.blocking;
  return BLOCKING_ISSUE_CODES.has(issue.code);
}

const BLOCKING_ISSUE_CODES = new Set<ShipmentHandoffIssueV1["code"]>([
  "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
  "CONTAINER_SOURCE_IDENTITY_CONFLICT",
  "IDEMPOTENCY_PAYLOAD_CONFLICT",
  "SHIPMENT_SOURCE_IDENTITY_CONFLICT",
  "SHIPMENT_NUMBER_CONFLICT",
  "SHIPMENT_RELATIONSHIP_VERSION_CONFLICT",
]);

export function handoffDecisionCopy(
  decision: "ready" | "review_required" | "rejected",
): string {
  return {
    ready: "可接管",
    review_required: "待补资料",
    rejected: "不能接管",
  }[decision];
}
