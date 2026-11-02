import type { SourceObservation } from "./ocean-operations-source-review";

export interface OceanFocusItem {
  code:
    | "progress"
    | "arrival_change"
    | "route_risk"
    | "information"
    | "coordination";
  title: string;
  status: "information" | "attention" | "unavailable";
  summary: string;
  evidence: string[];
  standard: string;
  trigger: string | null;
  actions: ("view_sources" | "record_assessment")[];
}

export interface OceanFocusInput {
  shipmentLinked: boolean;
  actualDepartureAt: string | null;
  observations: SourceObservation[];
  history: SourceObservation[];
}

export function comparableObservations(
  a: SourceObservation,
  b: SourceObservation,
): boolean {
  return Boolean(
    a.nodeCode &&
    a.unlocode &&
    a.timeKind &&
    a.nodeCode === b.nodeCode &&
    a.unlocode === b.unlocode &&
    a.semanticKey === b.semanticKey &&
    a.timeKind === b.timeKind &&
    (a.segmentId ?? null) === (b.segmentId ?? null) &&
    a.sourcePrecision === b.sourcePrecision,
  );
}

export function isDestinationEta(item: SourceObservation): boolean {
  return (
    item.semanticKey === "arrived" &&
    item.nodeCode === "destination_arrival" &&
    item.timeKind === "estimated" &&
    item.isCurrent
  );
}

export function buildOceanFocus(input: OceanFocusInput): OceanFocusItem[] {
  const current = input.observations.filter((item) => item.isCurrent);
  const etas = current.filter(isDestinationEta);
  const eta = etas.length === 1 ? etas[0] : undefined;
  const previous = eta?.supersedesObservationId
    ? input.history.find(
        (item) =>
          item.id === eta.supersedesObservationId &&
          comparableObservations(eta, item),
      )
    : undefined;
  const different = current.some((a, index) =>
    current
      .slice(index + 1)
      .some(
        (b) =>
          comparableObservations(a, b) &&
          a.normalizedValue &&
          b.normalizedValue &&
          (a.sourcePrecision === "date-only"
            ? a.rawValue !== b.rawValue
            : Date.parse(a.normalizedValue) !== Date.parse(b.normalizedValue)),
      ),
  );
  const pending = current.filter(
    (item) => item.reviewRequired || !item.normalizedValue,
  );
  const informationIssues = [
    ...(!input.shipmentLinked ? ["本次运输关联未明确，需核对柜单关系"] : []),
    ...(different ? ["同一事件存在不同日期观察，需核对采用依据"] : []),
    ...(pending.length
      ? [`${pending.length} 项来源信息待核，不代表已证实运输异常`]
      : []),
  ];
  const recordable = input.shipmentLinked && etas.length > 0;
  return [
    {
      code: "progress",
      title: "运输进展",
      status: "information",
      summary: input.actualDepartureAt
        ? "已有实际离港信息，按当前运输事实继续跟踪"
        : "实际离港信息尚未取得，不从预计日期推断进展",
      evidence: input.actualDepartureAt
        ? [`实际离港：${input.actualDepartureAt}`]
        : [],
      standard: "实际进展读取业务事实；到港、卸船和可提分别确认。",
      trigger: null,
      actions: ["view_sources"],
    },
    {
      code: "arrival_change",
      title: "到港时间变化",
      status: "information",
      summary: eta
        ? `当前预计抵港 ${eta.rawValue}；${previous ? "已有可比更正记录" : "没有可比前值，不判断提前或延误"}`
        : etas.length
          ? "有多个目的港 ETA 观察，尚未明确唯一采用值"
          : "目的港 ETA 尚未取得",
      evidence:
        previous && eta
          ? [`预计抵港由 ${previous.rawValue} 更新为 ${eta.rawValue}`]
          : etas.map(
              (item) => `预计抵港：${item.rawValue} · ${item.sourceVersion}`,
            ),
      standard:
        "比较同一运输事件及已交接依据；日期变化不自动等于异常或实际到港。",
      trigger: null,
      actions: recordable
        ? ["view_sources", "record_assessment"]
        : ["view_sources"],
    },
    {
      code: "route_risk",
      title: "航程及承运风险",
      status: "unavailable",
      summary: "航程风险信号尚未接入，不能据此判断无风险",
      evidence: [],
      standard:
        "具体风险信号可先核查和提醒；正式变更须有依据，不按日期差推断换船或甩柜。",
      trigger: null,
      actions: ["view_sources"],
    },
    {
      code: "information",
      title: "信息缺失或冲突",
      status: informationIssues.length ? "attention" : "information",
      summary:
        informationIssues.join("；") ||
        "当前未识别需核对的信息项，不代表全部事实已采信",
      evidence: pending.map(
        (item) => `${item.rawValue} · ${item.sourceVersion}`,
      ),
      standard:
        "只核对影响具体动作的信息；单一来源不当然无效，待核不阻断信息流转。",
      trigger: informationIssues.length ? informationIssues.join("；") : null,
      actions: recordable
        ? ["view_sources", "record_assessment"]
        : ["view_sources"],
    },
    {
      code: "coordination",
      title: "下游信息与协同",
      status: "unavailable",
      summary:
        "已有信息供准备参考，不以海运判断或接收回执作为准备工作的开工许可；下游需求和接收记录尚未接通",
      evidence: etas.map((item) => `可参考的预计抵港：${item.rawValue}`),
      standard:
        "信息共享、责任接收和专业执行分开；只限制真正依赖缺失条件的动作。",
      trigger: null,
      actions: recordable
        ? ["view_sources", "record_assessment"]
        : ["view_sources"],
    },
  ];
}
