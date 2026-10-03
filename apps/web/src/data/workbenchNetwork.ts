export type WorkbenchKind = "main" | "support";
export type WorkbenchPhase =
  "strategy" | "product" | "supply" | "shipment" | "arrival";
export type WorkbenchMaturity =
  "planned" | "facts_only" | "operational" | "validated";
export type WorkbenchSurface = "dedicated" | "catalog_stub";
export type WorkbenchRelationKind = "handoff" | "fact_dependency";
export type WorkbenchAssessmentState = "pending_assessment" | "assessed";

export type WorkbenchCode =
  | "market_signals"
  | "product_selection"
  | "product_npi"
  | "master_data"
  | "sourcing"
  | "demand_replenishment"
  | "procurement"
  | "supply_readiness"
  | "shipment_planning"
  | "booking"
  | "cargo_ready"
  | "stuffing"
  | "export_customs"
  | "dispatch"
  | "ocean_operations"
  | "customs"
  | "pickup"
  | "delivery"
  | "unloading"
  | "empty_return"
  | "compliance_operations"
  | "charges"
  | "exceptions";

export interface WorkbenchHandoff {
  code: string;
  name: string;
  from: WorkbenchCode;
  to: WorkbenchCode;
  timing: string;
  facts: readonly string[];
}

export interface WorkbenchStage {
  code: WorkbenchCode;
  title: string;
  path: string;
  kind: "main" | "support";
  phase: WorkbenchPhase;
  sequence: number | null;
  assessmentState: WorkbenchAssessmentState;
  maturity: WorkbenchMaturity | null;
  surface: WorkbenchSurface;
  ownerRole: string;
  roleResult: string;
  requiredFacts: readonly string[];
  implementation: WorkbenchImplementation;
  inboundHandoffCode: string | null;
  outboundHandoffCode: string | null;
  consumesHandoffCodes?: readonly string[];
}

type WorkbenchImplementation = "live" | "prototype" | "framework";

type LegacyWorkbenchStage = Omit<
  WorkbenchStage,
  "assessmentState" | "maturity" | "surface"
>;

type CatalogWorkbenchStage = WorkbenchStage;

export interface WorkbenchRelation {
  code: string;
  from: WorkbenchCode;
  to: WorkbenchCode;
  kind: WorkbenchRelationKind;
  handoffCode: string | null;
  label: string;
  facts: readonly string[];
}

export const workbenchBaseline = {
  version: "2026-10-03",
  total: 23,
  main: 20,
  support: 3,
} as const;

export const workbenchHandoffs = [
  handoff(
    "market_opportunity",
    "经营机会交接",
    "market_signals",
    "product_selection",
    "经营负责人决定交给选品评估时；普通资料缺失随交接继续保留",
    ["信号标题", "已有事实与证据", "经营假设", "机会说明", "待补事项"],
  ),
  handoff(
    "product_initiative",
    "选品立项交接",
    "product_selection",
    "product_npi",
    "机会完成评审并明确产品负责人和目标结果时",
    ["立项编号", "目标市场", "用户问题", "负责人", "评审结论"],
  ),
  handoff(
    "released_product_design",
    "产品设计发布",
    "product_npi",
    "master_data",
    "产品定义和 NPI 版本达到可建档基线时",
    ["产品规格版本", "NPI 阶段", "合规假设", "发布决定"],
  ),
  handoff(
    "sellable_sku_release",
    "可售 SKU 发布",
    "master_data",
    "sourcing",
    "产品、物料、BOM、SKU 和 Listing 身份可稳定引用时",
    ["产品与 SKU 身份", "BOM 版本", "Listing 范围", "关键属性"],
  ),
  handoff(
    "supplier_nomination",
    "供应商定点交接",
    "sourcing",
    "demand_replenishment",
    "供应商准入、报价、样品和定点结论完成时",
    ["供应商身份", "定点 SKU", "报价条件", "样品结论", "产能约束"],
  ),
  handoff(
    "replenishment_decision",
    "补货决策交接",
    "demand_replenishment",
    "procurement",
    "预测、库存策略和补货计算形成责任人决定时",
    ["SKU 与国家", "需求窗口", "建议量", "决定量", "决策依据"],
  ),
  handoff(
    "purchase_commitment",
    "采购承诺交接",
    "procurement",
    "supply_readiness",
    "采购订单已确认且供应商给出可追踪承诺时",
    ["采购订单", "供应商", "SKU 数量", "承诺日期", "交付条款"],
  ),
  handoff(
    "shippable_supply_lot",
    "可出运供给交接",
    "supply_readiness",
    "shipment_planning",
    "生产、验货和整改结论证明货物可进入出运计划时",
    ["供给批次", "可用 SKU 数量", "验货结论", "限制条件"],
  ),
  handoff(
    "shipment_plan_release",
    "出运计划发布",
    "shipment_planning",
    "cargo_ready",
    "国家、渠道、仓库、港口和装柜方案获批准时",
    ["计划身份", "货物范围", "国家与仓库", "港口", "整柜或拼柜方案"],
  ),
  handoff(
    "replenishment_ready_snapshot",
    "备货释放交接",
    "cargo_ready",
    "stuffing",
    "供应商收到明确备货范围且适用资料缺口可追踪时",
    ["备货单", "供应商", "SKU 计划量", "目的仓", "适用资料"],
  ),
  handoff(
    "stuffing_snapshot",
    "装箱事实交接",
    "stuffing",
    "dispatch",
    "柜、备货单行和实际 SKU 装载关系已形成版本快照时",
    ["货柜身份", "封号", "SKU 装载分配", "数量重量体积", "装箱证据"],
  ),
  handoff(
    "shipment_handoff",
    "已出运交接",
    "dispatch",
    "ocean_operations",
    "存在可信实际离港事实并可建立 Shipment 业务身份时",
    ["Shipment 身份", "货柜与货物", "路线", "ATD", "来源与证据"],
  ),
  handoff(
    "arrival_readiness",
    "到港准备交接",
    "ocean_operations",
    "customs",
    "在途变化已更新且到港、清关和提柜准备可开始时",
    ["最新 ETA", "航段与码头", "到港风险", "到货通知", "待准备事项"],
  ),
  handoff(
    "customs_release",
    "清关放行交接",
    "customs",
    "pickup",
    "适用申报完成且货柜级放行事实可信时",
    ["清关案件", "申报回执", "放行事实", "Hold 状态", "证据"],
  ),
  handoff(
    "gate_out_fact",
    "提柜出场交接",
    "pickup",
    "delivery",
    "联合可提条件满足并形成可信 Gate Out 事实时",
    ["货柜", "承运安排", "提柜时间", "Gate Out 证据", "失败与恢复"],
  ),
  handoff(
    "warehouse_arrival",
    "送仓到达交接",
    "delivery",
    "unloading",
    "货柜到达正确仓库并形成到仓或 POD 事实时",
    ["目的仓", "预约窗口", "到仓时间", "POD", "运输差异"],
  ),
  handoff(
    "empty_container_ready",
    "卸空交接",
    "unloading",
    "empty_return",
    "实收差异已记录且空箱可交给还箱责任方时",
    ["实收结果", "卸空时间", "空箱状态", "差异案件", "还箱要求"],
  ),
] as const satisfies readonly WorkbenchHandoff[];

export const workbenchNetwork = [
  liveStage(
    1,
    "market_signals",
    "市场与经营信号",
    "/workspaces/market-signals",
    "strategy",
    "经营与市场负责人",
    "把可信市场和经营信号整理成可评审机会",
    [
      "可识别标题",
      "已有市场与渠道（可后补）",
      "已有事实与来源（可后补）",
      "经营假设与待补事项",
    ],
    null,
    "market_opportunity",
  ),
  liveStage(
    2,
    "product_selection",
    "选品立项工作台",
    "/workspaces/product-selection",
    "strategy",
    "选品负责人",
    "判断机会是否值得投入并形成有责任人的产品立项",
    ["机会证据", "目标用户", "目标市场", "收益与风险假设"],
    "market_opportunity",
    "product_initiative",
  ),
  liveStage(
    3,
    "product_npi",
    "产品开发与 NPI 工作台",
    "/workspaces/product-npi",
    "product",
    "产品经理与 NPI 负责人",
    "把立项推进为可发布、可追溯版本的产品定义",
    ["立项目标", "产品规格", "里程碑", "验证与合规要求"],
    "product_initiative",
    "released_product_design",
  ),
  liveStage(
    4,
    "master_data",
    "商品与物料主数据工作台",
    "/workspaces/master-data",
    "product",
    "商品与主数据负责人",
    "建立产品、物料、BOM、SKU 和 Listing 的稳定业务身份",
    ["已发布产品设计", "编码规则", "BOM", "销售国家与渠道"],
    "released_product_design",
    "sellable_sku_release",
  ),
  liveStage(
    5,
    "sourcing",
    "寻源与供应商定点工作台",
    "/workspaces/sourcing",
    "supply",
    "采购开发与供应商质量负责人",
    "完成供应商准入、询报价、打样和定点",
    ["可售 SKU", "技术与质量要求", "候选供应商", "商务条件"],
    "sellable_sku_release",
    "supplier_nomination",
  ),
  stage(
    6,
    "demand_replenishment",
    "需求与补货工作台",
    "/workspaces/demand-replenishment",
    "supply",
    "需求计划与库存负责人",
    "把预测、库存策略和补货计算转成可解释的补货决定",
    ["SKU 与国家", "销售预测", "库存与在途", "库存策略"],
    "supplier_nomination",
    "replenishment_decision",
  ),
  stage(
    7,
    "procurement",
    "采购履约工作台",
    "/workspaces/procurement",
    "supply",
    "采购计划与跟单负责人",
    "形成可追踪的采购承诺并管理供应商履约偏差",
    ["补货决定", "供应商定点", "采购条款", "交付窗口"],
    "replenishment_decision",
    "purchase_commitment",
  ),
  stage(
    8,
    "supply_readiness",
    "生产验货与可出运供给工作台",
    "/workspaces/supply-readiness",
    "supply",
    "跟单、质量与供应协调负责人",
    "把生产、验货和整改结果汇成可出运供给池",
    ["采购承诺", "生产进度", "验货与整改", "可用数量"],
    "purchase_commitment",
    "shippable_supply_lot",
  ),
  stage(
    9,
    "shipment_planning",
    "出运计划工作台",
    "/workspaces/shipment-planning",
    "shipment",
    "出运计划负责人",
    "完成国家、渠道、仓库、港口和整柜或拼柜方案",
    ["可出运供给", "国家与渠道需求", "仓库容量", "港口与装柜约束"],
    "shippable_supply_lot",
    "shipment_plan_release",
  ),
  liveStage(
    10,
    "cargo_ready",
    "备货工作台",
    "/workspaces/cargo-ready",
    "shipment",
    "备货协调人员",
    "释放备货范围并跟踪供应商备货和适用资料",
    ["出运计划", "备货单", "SKU 属性", "供应商与目的仓"],
    "shipment_plan_release",
    "replenishment_ready_snapshot",
  ),
  liveStage(
    11,
    "stuffing",
    "装箱工作台",
    "/workspaces/stuffing",
    "shipment",
    "装箱协调人员",
    "记录柜、备货单和 SKU 的实际装载事实",
    ["备货范围", "货柜身份", "装载明细", "装箱证据"],
    "replenishment_ready_snapshot",
    "stuffing_snapshot",
  ),
  liveStage(
    12,
    "dispatch",
    "出运工作台",
    "/workspaces/dispatch",
    "shipment",
    "出运运营人员",
    "完成进港、装船和离港交接",
    ["装箱快照", "航线与提单", "实际离港事实", "来源证据"],
    "stuffing_snapshot",
    "shipment_handoff",
  ),
  stage(
    13,
    "ocean_operations",
    "海运运营工作台",
    "/workspaces/ocean-operations",
    "shipment",
    "海运运营人员",
    "跟踪航段、ETA 版本和到港风险并发起到港准备",
    ["已出运 Shipment", "航段计划", "承运人更新", "到货通知"],
    "shipment_handoff",
    "arrival_readiness",
  ),
  liveStage(
    14,
    "customs",
    "清关工作台",
    "/workspaces/customs",
    "arrival",
    "清关操作人员",
    "按销售国家和货物属性完成资料、申报、查验和放行交接",
    ["到港准备", "SKU 合规属性", "适用资料", "清关接收方"],
    "arrival_readiness",
    "customs_release",
  ),
  liveStage(
    15,
    "pickup",
    "提柜工作台",
    "/workspaces/pickup",
    "arrival",
    "提柜调度人员",
    "确认联合可提条件并完成可信 Gate Out",
    ["清关放行", "Carrier 与 Terminal 可提", "Hold", "免费期与车队"],
    "customs_release",
    "gate_out_fact",
  ),
  liveStage(
    16,
    "delivery",
    "送仓工作台",
    "/workspaces/delivery",
    "arrival",
    "内陆运输调度人员",
    "把已提货柜送达正确仓库并取得到仓回执",
    ["Gate Out", "目的仓", "预约窗口", "承运与路线"],
    "gate_out_fact",
    "warehouse_arrival",
  ),
  liveStage(
    17,
    "unloading",
    "卸柜工作台",
    "/workspaces/unloading",
    "arrival",
    "仓库收货人员",
    "记录实收差异、卸空事实并把空箱交给还箱责任方",
    ["到仓事实", "货物范围", "仓库实收", "空箱状态"],
    "warehouse_arrival",
    "empty_container_ready",
  ),
  stage(
    18,
    "empty_return",
    "还箱工作台",
    "/workspaces/empty-return",
    "arrival",
    "还箱调度人员",
    "安排取空、提交 EIR 并以场站接收事实关闭箱级责任",
    ["空箱可用", "还箱点", "截止时间", "EIR 与场站回执"],
    "empty_container_ready",
    null,
  ),
  supportStage(
    "charges",
    "费用结算工作台",
    "/workspaces/charges",
    "arrival",
    "费用与结算人员",
    "按真实生命周期事实核费、分摊、请款和结算",
    ["费用标准", "服务与时间事实", "账单", "分摊对象"],
    [
      "shipment_handoff",
      "arrival_readiness",
      "gate_out_fact",
      "empty_container_ready",
    ],
  ),
  supportStage(
    "exceptions",
    "异常中心",
    "/workspaces/exceptions",
    "arrival",
    "业务域负责人和协同人员",
    "集中分派跨域异常并把处理结果归还权威业务域",
    ["受影响对象", "来源事实", "责任方", "时限与恢复条件"],
    workbenchHandoffs.map((item) => item.code),
  ),
] as const satisfies readonly LegacyWorkbenchStage[];

const legacyStageByCode = new Map(
  workbenchNetwork.map((stage) => [stage.code, stage]),
);

const catalogStage = (
  code: WorkbenchCode,
  overrides: Partial<
    Pick<
      WorkbenchStage,
      | "title"
      | "path"
      | "kind"
      | "phase"
      | "sequence"
      | "assessmentState"
      | "maturity"
      | "surface"
      | "ownerRole"
      | "roleResult"
      | "requiredFacts"
    >
  > = {},
): CatalogWorkbenchStage => {
  const legacyStage = legacyStageByCode.get(code);

  if (!legacyStage) {
    throw new Error(`Missing legacy stage for ${code}`);
  }

  return {
    code,
    title: legacyStage.title,
    path: legacyStage.path,
    kind: legacyStage.kind,
    phase: legacyStage.phase,
    sequence: legacyStage.sequence,
    assessmentState: "pending_assessment",
    maturity: null,
    surface: "dedicated",
    ownerRole: legacyStage.ownerRole,
    roleResult: legacyStage.roleResult,
    requiredFacts: legacyStage.requiredFacts,
    implementation: legacyStage.implementation,
    inboundHandoffCode: legacyStage.inboundHandoffCode,
    outboundHandoffCode: legacyStage.outboundHandoffCode,
    consumesHandoffCodes: legacyStage.consumesHandoffCodes,
    ...overrides,
  };
};

const plannedCatalogStage = (
  sequence: number,
  code: WorkbenchCode,
  title: string,
  path: string,
  phase: WorkbenchPhase,
  ownerRole: string,
  roleResult: string,
  requiredFacts: readonly string[],
): CatalogWorkbenchStage => ({
  code,
  title,
  path,
  kind: "main",
  phase,
  sequence,
  assessmentState: "assessed",
  maturity: "planned",
  surface: "catalog_stub",
  ownerRole,
  roleResult,
  requiredFacts,
  implementation: "framework",
  inboundHandoffCode: null,
  outboundHandoffCode: null,
});

const plannedSupportCatalogStage = (
  code: WorkbenchCode,
  title: string,
  path: string,
  phase: WorkbenchPhase,
  ownerRole: string,
  roleResult: string,
  requiredFacts: readonly string[],
): CatalogWorkbenchStage => ({
  code,
  title,
  path,
  kind: "support",
  phase,
  sequence: null,
  assessmentState: "assessed",
  maturity: "planned",
  surface: "catalog_stub",
  ownerRole,
  roleResult,
  requiredFacts,
  implementation: "framework",
  inboundHandoffCode: null,
  outboundHandoffCode: null,
});

export const workbenchStages = [
  catalogStage("market_signals"),
  catalogStage("product_selection"),
  catalogStage("product_npi"),
  catalogStage("master_data"),
  catalogStage("sourcing"),
  catalogStage("demand_replenishment"),
  catalogStage("procurement"),
  catalogStage("supply_readiness"),
  catalogStage("shipment_planning"),
  plannedCatalogStage(
    10,
    "booking",
    "订舱",
    "/workspaces/booking",
    "shipment",
    "订舱运营人员",
    "取得并维护承运人确认、当前有效且可执行的订舱承诺",
    ["获批出运边界", "承运人确认", "运价与合同适用性"],
  ),
  catalogStage("cargo_ready", { sequence: 11 }),
  catalogStage("stuffing", { sequence: 12 }),
  plannedCatalogStage(
    13,
    "export_customs",
    "出口报关",
    "/workspaces/export-customs",
    "shipment",
    "出口报关操作人员",
    "形成全部必要出口案卷已可信放行的结果",
    ["出口案卷", "申报资料", "外部海关放行证据"],
  ),
  catalogStage("dispatch", { sequence: 14 }),
  catalogStage("ocean_operations", { sequence: 15 }),
  catalogStage("customs", { sequence: 16, title: "进口清关" }),
  catalogStage("pickup", { sequence: 17 }),
  catalogStage("delivery", { sequence: 18 }),
  catalogStage("unloading", { sequence: 19 }),
  catalogStage("empty_return", { sequence: 20 }),
  plannedSupportCatalogStage(
    "compliance_operations",
    "合规运营",
    "/workspaces/compliance-operations",
    "product",
    "合规运营人员",
    "形成有证据、可追溯、在有效期内的准入决定及变化影响",
    ["产品版本", "制造主体", "目标国家", "用途", "业务日期"],
  ),
  catalogStage("charges"),
  catalogStage("exceptions"),
] as const satisfies readonly CatalogWorkbenchStage[];

export const workbenchRelations = [
  relation(
    "shipment_planning_to_booking",
    "shipment_planning",
    "booking",
    "出运计划提供获批订舱边界",
    ["获批计划", "路线", "货物范围"],
  ),
  relation(
    "shipment_planning_to_cargo_ready",
    "shipment_planning",
    "cargo_ready",
    "出运计划提供备货范围",
    ["计划身份", "货物范围", "目的仓"],
  ),
  relation(
    "supply_readiness_to_cargo_ready",
    "supply_readiness",
    "cargo_ready",
    "供给准备提供可出运数量和限制",
    ["可用数量", "验货结论", "限制条件"],
  ),
  relation(
    "booking_to_stuffing",
    "booking",
    "stuffing",
    "订舱提供当前有效装箱窗口和承运人要求",
    ["订舱确认", "装箱窗口", "VGM 要求"],
  ),
  relation(
    "cargo_ready_to_stuffing",
    "cargo_ready",
    "stuffing",
    "备货提供可装产品行",
    ["备货单", "可装产品行", "适用资料"],
  ),
  relation(
    "booking_to_export_customs",
    "booking",
    "export_customs",
    "订舱提供申报运输范围",
    ["订舱确认", "航线", "货柜计划"],
  ),
  relation(
    "stuffing_to_export_customs",
    "stuffing",
    "export_customs",
    "装箱提供出口申报所需实际事实",
    ["货柜身份", "货物装载", "VGM"],
  ),
  relation(
    "booking_to_dispatch",
    "booking",
    "dispatch",
    "订舱提供当前有效承运人承诺",
    ["订舱确认", "航次", "截点"],
  ),
  relation(
    "stuffing_to_dispatch",
    "stuffing",
    "dispatch",
    "装箱提供实际柜货和 VGM 事实",
    ["货柜身份", "装载事实", "VGM"],
  ),
  relation(
    "export_customs_to_dispatch",
    "export_customs",
    "dispatch",
    "出口报关提供可信出口放行",
    ["出口放行", "案卷范围", "限制条件"],
  ),
] as const satisfies readonly WorkbenchRelation[];

export const mainWorkbenchChain = workbenchStages.filter(
  (item) => item.kind === "main",
);
export const supportingWorkbenches = workbenchStages.filter(
  (item) => item.kind === "support",
);
export const frameworkWorkbenchStages = workbenchStages.filter(
  (item) => item.implementation === "framework" && item.surface === "dedicated",
);
export const liveWorkbenchCodes = workbenchNetwork
  .filter((item) => item.implementation === "live")
  .map((item) => item.code);
export const prototypeWorkbenchCodes = workbenchNetwork
  .filter((item) => item.implementation === "prototype")
  .map((item) => item.code);

/**
 * 负责人确认的岗位操作规格串行重审顺序。
 *
 * 必须与 workbenchNetwork 全集严格相等；顺序表达评审优先级，不改变业务主链顺序。
 */
export const workbenchOperationalReviewOrder = [
  "sourcing",
  "product_selection",
  "product_npi",
  "demand_replenishment",
  "procurement",
  "supply_readiness",
  "shipment_planning",
  "ocean_operations",
  "empty_return",
  "charges",
  "exceptions",
  "market_signals",
  "master_data",
  "cargo_ready",
  "stuffing",
  "dispatch",
  "customs",
  "pickup",
  "delivery",
  "unloading",
] as const satisfies readonly WorkbenchCode[];

export const workbenchPhaseLabels: Record<WorkbenchPhase, string> = {
  strategy: "机会与立项",
  product: "产品与主数据",
  supply: "供应与采购",
  shipment: "出运准备与在途",
  arrival: "到港执行与收口",
};

/**
 * 岗位作业规格：网络只声明"这个岗位在链上的位置"，这里说明"他具体怎么干"。
 *
 * 四项都属于"人怎么工作"，不属于数据结构；缺了它们，"岗位作业"就只剩位置描述。
 * 一个工作台建成一个补一个 —— 未列入 = 尚未定义，不是"没有要求"。
 */
export interface WorkbenchOperationalSpec {
  code: WorkbenchCode;
  /** 他在页面上能做的动作。只列服务端授权的，不列"看得到但点不了"的。 */
  allowedActions: readonly string[];
  /** 系统替他完成什么：自动关联、计算、校验。 */
  systemDoes: readonly string[];
  /** 缺资料时能否继续、谁补、何时必须补。 */
  missingHandling: string;
  /** 什么不许猜、不许覆盖、必须留痕。 */
  discipline: readonly string[];
}

export const workbenchOperationalSpecs: readonly WorkbenchOperationalSpec[] = [
  {
    code: "market_signals",
    allowedActions: [
      "登记信号（标题必填，其余可后补）",
      "补通用缺口：市场、渠道、商品类别、观察事实、经营假设",
      "登记来源证据（来源名称、链接、内容）",
      "给信号一个去向：继续观察 / 交给选品评估 / 不采纳",
      "补本次判断依据",
    ],
    systemDoes: [
      "每次返回信号时按当前事实实时重算待补字段，不把缺口存成库里的人工状态",
      "填写来源名称或链接后自动建立证据关系，并重新读取缺口",
      "决定交给选品时自动形成经营机会交接，带过去信号标题、已有事实与证据、经营假设、机会说明、待补事项",
      "登记与决定都带幂等键，重复提交不会产生第二条",
    ],
    missingHandling:
      "普通字段缺失不阻断：形成待补项并随处理结果继续保留，队列上直接写“仍待补 N 项，不影响先处理”。只有内部身份或引用冲突才局部拒绝。交给选品时未补内容继续作为待补事项交接。",
    discipline: [
      "不采纳必须保留来源和本次判断，原因可后补但不能丢",
      "选品阶段补的证据作为“来源事实”登记回来源信号，不改写原证据记录",
      "来源名称不是服务端待补字段：只在已有证据缺来源名时由前端判定，与“完全没有证据”区分",
      "服务端未列为待补的字段不得在前端伪装成缺口",
    ],
  },
  {
    code: "product_selection",
    allowedActions: [
      "领取此机会（领取后由你负责完成立项判断）",
      "接受并进入立项判断",
      "为适用的专业要求添加证据：竞争供给证据、目标价格带、售后原声",
      "重新加载以取得同一信号的最新交接版本",
    ],
    systemDoes: [
      "按适用规则生成专业要求：选定商品范围后出竞争供给与价格带，进入评估后出售后原声",
      "缺前置条件的要求进入“暂时生成不了”并写明缺什么，与“不适用”分开",
      "领取与接受带幂等键和期望版本，并发变化时拒绝而不是覆盖",
      "同一信号的新交接版本自动替代旧版本，旧版本标记为已被替代",
    ],
    missingHandling:
      "领取不要求先补齐经营团队留下的普通缺口。缺商品范围时专业要求不生成，但必须显式说明“尚未选定商品范围”而不是静默消失。服务端拒绝时重新加载取得最新版本，不本地猜测结果。",
    discipline: [
      "领取不等于立项，接受也不等于立项结论；本岗位只确认是否接手",
      "专业要求只能在选定商品范围或进入评估动作后生成，不得进入信号登记阶段",
      "不适用的要求与“还判断不了”必须分开呈现，不得都表现为“没有要求”",
      "补的证据登记回来源信号作为来源事实，不改写原证据记录",
    ],
  },
  {
    code: "product_npi",
    allowedActions: [
      "从产品侧待办队列领取立项（领取后由你负责推进到可发布的产品定义）",
      "查看立项快照：立项目标、机会说明、四项评审结论及各自依据",
    ],
    systemDoes: [
      "立项交接按不可变快照带入，不要求重录立项目标与评审结论",
      "待办按“等我接手／我负责的／已在他人手上”分组，一眼看出这一票等谁动",
      "领取带期望版本与幂等键，两人同时领取只会成一个人；重复提交不写第二条回执",
    ],
    missingHandling:
      "立项阶段的缺失不在本岗位补：那是选品侧的事，快照只读。本岗位自己的缺失（产品规格、里程碑、发布决定）属于下一片，届时才形成待补项。",
    discipline: [
      "领取不等于立项成立，也不等于产品定义发布；本岗位只改“谁负责推进”",
      "立项快照只读 —— 不得改写立项阶段的任何结论；要改只能由选品侧走退回或新版本",
      "不伪造立项结论，也不在本岗位下“是否合规”的结论",
      "转交与放手未列入：还没有真实诉求，不摆按不动的按钮",
    ],
  },
  {
    code: "master_data",
    allowedActions: [
      "从待建档队列选一票已发布的产品设计",
      "建立产品身份：品类、品牌、功能名、原产国、HS 编码、目标市场、认证",
      "在产品下建 SKU（编号租户内唯一），逐个填颜色、尺码、尺寸重量、包装层级、条码、电池",
      "登记危险品分类与订货条件（提前期、最小起订量、订货倍数）",
      "发布可售 SKU，交给寻源侧",
    ],
    systemDoes: [
      "对外产品号按来源派生（同一份设计永远同一个号），也可由人改；内部代理键永不变",
      "已发布的产品设计按不可变快照带入，不要求重录规格与 NPI 阶段",
      "缺项进待补、随交接带下去；只在发布那一刻逐项列出还差什么",
      "同一 SKU 编号重复或跨产品撞号时明确失败，不静默改写",
      "从产品下移走的 SKU 解除归属而不是删除 —— 下游可能在引用",
    ],
    missingHandling:
      "普通缺失不阻断：主数据是逐步查清的，缺 HS 编码、尺寸重量都能先存一版，缺口记在待补里。发布时才要求齐（产品号、至少一个 SKU、品类、功能名、原产国、HS 编码、目标国家）。BOM 与 Listing 由后续切片补，本片作为待补随交接带下去。",
    discipline: [
      "内部代理键与对外编号分列：改产品号不动内部键，编号里也不承载业务含义",
      "不替人选品类或编 HS 编码 —— 这些是要人去查的事实，不是系统的猜测",
      "危险品用「有没有」加结构化字段表达：null 是「没有」，全空对象是「有但还没查」",
      "SKU 编号租户内唯一：撞号是业务冲突，明确报错而不是自动改名",
    ],
  },
  {
    code: "cargo_ready",
    allowedActions: [
      "领取备货工单 / 完成备货工单",
      "导入备货单（当前动作码为 replenishment.import 时）",
      "处理合规整改项并进入合规处理",
      "沿 Shipment 交接链接跟进已出运的后续",
    ],
    systemDoes: [
      "从备货单出发复用已有 SKU、合规与任务事实，不要求重复录入",
      "当前可执行动作由服务端任务返回的动作码决定，前端不推断也不放行",
      "服务端尚未返回可执行动作时，逐案说明缺的是哪个服务的什么能力，而不是把按钮置灰",
      "交接完成后在备货单上下文里显示 Shipment 去向",
    ],
    missingHandling:
      "普通缺口定位出具体原因但不阻断处理。四种“暂无可执行写入口”各有明确说法：物料属性需主数据服务返回可提交动作、SKU 匹配需导入或主数据服务返回候选、装柜分配需装载服务返回候选货柜与数量校验、备货工单需等待节点初始化。合规整改开放项单列，与节点任务分栏。",
    discipline: [
      "整改或工单完成不等于合规批准，也不等于生命周期过站",
      "不在前端直接落库 SKU 身份或装柜分配；没有服务端动作就说没有，不伪装成可执行",
      "导入的备货单与原生流程共用同一生命周期，不建立第二套",
    ],
  },
  {
    code: "stuffing",
    allowedActions: [
      "保存装箱结果快照：箱号、封号、包装数、毛重、净重、体积，可同时记录 VGM",
      "登记装箱证据",
      "提交实际装箱时间",
      "领取装箱工单 / 完成装箱工单",
    ],
    systemDoes: [
      "快照版本化：更正形成新版本，上一版保留可追溯",
      "实际装箱时间走统一日期事实链，回执区分“已应用并过站 / 被拒绝 / 已保存待复核 / 等待条件满足后自动重放”",
      "实际时间表单在快照保存后才开放，避免用未定稿的装载数据登记事实",
      "工单能否领取或完成由服务端任务返回的动作码决定",
    ],
    missingHandling:
      "没有装载明细时不开放快照表单，并说明“先形成当前装载明细，才能保存装箱结果”。没有快照时不开放实际时间，并说明先保存装箱记录。两种情况都是说明前置条件，不是把按钮置灰。",
    discipline: [
      "工单完成只记录工作结果，不代表装箱事实已经发生，也不代替过站",
      "更正不抹掉上一版；数量单位不同不得直接相加",
      "实装量超过可装数量必须立即提示，不得静默写入",
    ],
  },
  {
    code: "dispatch",
    allowedActions: [
      "从内部已有交接接管 Shipment（默认路径，排在页面最前）",
      "用标准模板接管已出运数据（次级批量工具）",
      "兼容旧系统四表导入（折叠入口）",
      "逐候选修正：货柜归组、起运港、目的港、离港时间、SKU 装载明细",
      "批量接管正常候选；异常候选保留逐条恢复路径",
      "在“已接管待补”里持续补录事实、货物与单证",
    ],
    systemDoes: [
      "预检按固定表名与字段码确定性解析，不调用 AI 猜列、不要求人工映射",
      "单文件原子接收；同文件重复上传幂等；同幂等键异内容明确冲突",
      "缺口按当前事实实时重算，接管后继续提示并可后补",
      "同一 Shipment 的多柜、同一柜的多备货单与多 SKU 自动归组",
    ],
    missingHandling:
      "普通业务字段或 SKU 明细缺失仍可预检、接管并进入持久待补。只有 Shipment/货柜身份缺失、已填写但非法、无效引用或不兼容的活动 Shipment 关系才阻断受影响候选，其余候选照常接管。",
    discipline: [
      "已出运接管默认从工作台业务建档与内部事实交接开始；标准模板是次级批量工具，四表只是旧系统兼容入口",
      "历史导入记录不得显示仍可执行的误导动作；确需纠正走“发起历史更正”并说明影响哪些下游事实",
      "接管只登记已发生的事实，不提前写未发生的事件",
    ],
  },
  {
    code: "customs",
    allowedActions: [
      "建立或更正清关案件：进口辖区、清关行档案、申报编号、申报状态、海关决定、活动扣留码、证据",
      "提交实际清关时间",
      "领取清关工单 / 完成清关工单",
    ],
    systemDoes: [
      "案件版本化，更正带期望版本，并发变化时拒绝而不是覆盖",
      "变更原因码自动区分“建立”与“更正”",
      "实际清关时间走统一日期事实链，回执区分应用、拒绝、待复核与等待自动重放",
      "字段间约束即时反馈：申报后必须有清关行与申报编号；扣留必须给扣留码；放行必须申报已受理且有证据",
    ],
    missingHandling:
      "未放行时不开放实际清关，说明“海关放行并清除活动扣留后，才能提交实际清关时间”。缺证据时“放行”不可保存。都是说明缺什么，不是把按钮置灰。",
    discipline: [
      "完成清关工单不等于海关放行，也不代替生命周期过站",
      "“已申报”与“已放行”必须分开，查验与扣留是异常轨道、不覆盖清关主状态",
      "前端字段约束只是即时反馈，权威判定在服务端；不因前端通过就认为业务成立",
    ],
  },
  {
    code: "pickup",
    allowedActions: [
      "登记目的码头：地点层级（码头 / 港口）、UN/LOCODE、码头档案 ID、IANA 时区、Port Call ID",
      "登记码头可提（时间 + 证据）",
      "登记重柜 Gate Out（时间 + EIR / 出场证据）",
      "领取提柜工单 / 完成提柜工单",
    ],
    systemDoes: [
      "地点校验：UN/LOCODE 必须 2 位字母加 3 位字母数字、时区必填、码头档案 ID 给了就必须是 UUID",
      "两个事实共用同一份地点，改一次两处一致",
      "可提与 Gate Out 各走日期事实链，回执区分应用、拒绝、待复核与等待自动重放",
      "已采信的当前事实回填到表单，作为更正基线",
    ],
    missingHandling:
      "地点无效或缺少时间、证据时不提交，并就地说明差哪一项。已登记的可提若未采信，界面直接说明“码头可提已登记，仍需实际 Gate Out 才能完成提柜”，而不是显示成完成。",
    discipline: [
      "工单完成只代表岗位作业完成；只有经采信的 Gate Out 才代表货柜已提走",
      "可提不等于已提走；登记可提不代替 Gate Out",
      "地点必须是权威码头或港口，不猜、不用默认值替代未知地点",
    ],
  },
  {
    code: "delivery",
    allowedActions: [
      "锁定目的仓与预约：仓库地点、代码、名称、UN/LOCODE、时区、预约窗口与参考、调度指令证据",
      "登记实际送仓，选择依据类型：POD / 签收，或仓库 / WMS 到场",
      "更正已登记的实际送仓（带被替代事实引用）",
      "领取送仓工单 / 完成送仓工单",
    ],
    systemDoes: [
      "目的仓未锁定前不开放事实登记，并说明原因",
      "两种完成依据共用一套时间与证据录入，切换类型只改依据标签",
      "更正时自动引用被替代的旧事实，保留追溯",
      "回执区分“已采信并通过门禁”与“已保存，等待另一名复核人采信”，四眼复核状态不合并",
    ],
    missingHandling:
      "未锁定目的仓时不开放登记，说明“先锁定当前目的仓，系统才能核对实际到仓地点”。缺证据或时间不提交并就地说明。已登记但未采信的事实明确显示为等待复核，不显示成完成。",
    discipline: [
      "工单完成只代表岗位作业完成；只有经采信且目的仓匹配的实际送仓事实才代表货柜到仓",
      "到仓不等于卸柜完成，下一步归卸柜岗位",
      "修改实际仓库必须走“改仓”动作并说明原因，不直接改写计划",
    ],
  },
  {
    code: "unloading",
    allowedActions: [
      "登记卸柜报告：作业状态（已开始 / 部分卸货 / 已完成）、开始与完成时间、封号核对结果",
      "按数量记录实收：预期、已卸、剩余、破损、短少与单位",
      "登记差异是否已解决及异常说明",
      "登记卸柜证据",
      "领取卸柜工单 / 完成卸柜工单",
    ],
    systemDoes: [
      "差异用结构化数量字段承载，不用自由文本；进入报告后可与预期量对账",
      "部分卸货可保存进度，再次打开时回填上次结果作为基线",
      "作业状态与异常是否解决分开记录，有差异不自动阻止继续卸货",
      "完成时间走统一日期事实链，回执区分应用、拒绝与待复核",
    ],
    missingHandling:
      "未到仓或未取得到仓事实时不开放卸柜报告。证据与数量可分批补，部分卸货期间保留已登记进度，不要求一次填完。",
    discipline: [
      "工单完成只代表岗位作业完成，不等于卸柜事实已发生",
      "有差异不一定阻止卸空，但差异必须形成记录并指定下一责任人",
      "封号核对与数量差异不得用自由文本绕过；数量单位不同不得直接相加",
      "卸柜完成不等于卸空确认：卸柜（第 12 站）与卸空（第 13 站）是生命周期上两个独立站点、两个独立事件（unloaded / unstuffed）。本工作台目前只登记卸柜事实，卸空尚无登记入口 —— 这是已知缺口，不是可以合并的两件事。",
    ],
  },
];

export function getWorkbenchOperationalSpec(
  code: string,
): WorkbenchOperationalSpec | undefined {
  return workbenchOperationalSpecs.find((item) => item.code === code);
}

export function workbenchStage(
  code: WorkbenchCode,
): WorkbenchStage | undefined {
  return workbenchStages.find((item) => item.code === code);
}

export function getInboundWorkbenchRelations(code: WorkbenchCode) {
  return workbenchRelations.filter(({ to }) => to === code);
}

export function getOutboundWorkbenchRelations(code: WorkbenchCode) {
  return workbenchRelations.filter(({ from }) => from === code);
}

export function getUpstreamWorkbenchStages(code: WorkbenchCode) {
  return getInboundWorkbenchRelations(code).flatMap(({ from }) => {
    const stage = workbenchStage(from);
    return stage ? [stage] : [];
  });
}

export function getDownstreamWorkbenchStages(code: WorkbenchCode) {
  return getOutboundWorkbenchRelations(code).flatMap(({ to }) => {
    const stage = workbenchStage(to);
    return stage ? [stage] : [];
  });
}

export function isProductionMaturity(maturity: WorkbenchMaturity | null) {
  return maturity === "operational" || maturity === "validated";
}

export function getWorkbenchStage(
  code: string,
): CatalogWorkbenchStage | undefined {
  return workbenchNetwork.find(
    (item): item is CatalogWorkbenchStage => item.code === code,
  );
}

export function getWorkbenchHandoff(
  code: string | null,
): WorkbenchHandoff | null {
  if (!code) return null;
  return workbenchHandoffs.find((item) => item.code === code) ?? null;
}

function relation(
  code: string,
  from: WorkbenchCode,
  to: WorkbenchCode,
  label: string,
  facts: readonly string[],
): WorkbenchRelation {
  return {
    code,
    from,
    to,
    kind: "fact_dependency",
    handoffCode: null,
    label,
    facts,
  };
}

function handoff(
  code: string,
  name: string,
  from: WorkbenchCode,
  to: WorkbenchCode,
  timing: string,
  facts: readonly string[],
): WorkbenchHandoff {
  return { code, name, from, to, timing, facts };
}

function stage(
  sequence: number,
  code: WorkbenchCode,
  title: string,
  path: string,
  phase: WorkbenchPhase,
  ownerRole: string,
  roleResult: string,
  requiredFacts: readonly string[],
  inboundHandoffCode: string | null,
  outboundHandoffCode: string | null,
): LegacyWorkbenchStage {
  return {
    code,
    title,
    path,
    kind: "main",
    phase,
    sequence,
    implementation: "framework",
    ownerRole,
    roleResult,
    requiredFacts,
    inboundHandoffCode,
    outboundHandoffCode,
  };
}

function liveStage(
  sequence: number,
  code: WorkbenchCode,
  title: string,
  path: string,
  phase: WorkbenchPhase,
  ownerRole: string,
  roleResult: string,
  requiredFacts: readonly string[],
  inboundHandoffCode: string | null,
  outboundHandoffCode: string | null,
): LegacyWorkbenchStage {
  return {
    ...stage(
      sequence,
      code,
      title,
      path,
      phase,
      ownerRole,
      roleResult,
      requiredFacts,
      inboundHandoffCode,
      outboundHandoffCode,
    ),
    implementation: "live",
  };
}

function supportStage(
  code: WorkbenchCode,
  title: string,
  path: string,
  phase: WorkbenchPhase,
  ownerRole: string,
  roleResult: string,
  requiredFacts: readonly string[],
  consumesHandoffCodes: readonly string[],
): LegacyWorkbenchStage {
  return {
    code,
    title,
    path,
    kind: "support",
    phase,
    sequence: null,
    implementation: "framework",
    ownerRole,
    roleResult,
    requiredFacts,
    inboundHandoffCode: null,
    outboundHandoffCode: null,
    consumesHandoffCodes,
  };
}
