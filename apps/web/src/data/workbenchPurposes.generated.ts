// Generated from doc/cross-border-supply-chain/08-role-workbenches.md; do not edit by hand.
// 禁止手工修改：运行 workbench-purposes:generate 更新此文件。

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

export interface WorkbenchPurpose {
  readonly code: WorkbenchCode;
  readonly title: string;
  readonly businessPurpose: string;
}

export const workbenchPurposes: readonly WorkbenchPurpose[] = [
  {
    code: "market_signals",
    title: "市场与经营信号",
    businessPurpose:
      "把经过最低验证的真实市场信号形成不可变新品候选交接，并披露证据、反证和未决不确定性",
  },
  {
    code: "product_selection",
    title: "选品立项",
    businessPurpose: "完成商业论证和资源取舍，决定是否形成有责任人的产品立项",
  },
  {
    code: "product_npi",
    title: "产品开发与 NPI",
    businessPurpose:
      "在重大投入扩大前作继续、返工、暂停或终止决定，并发布经过验证的产品定义",
  },
  {
    code: "master_data",
    title: "商品与物料主数据",
    businessPurpose:
      "建立无歧义、可追溯的产品、物料、BOM、SKU 和 Listing 身份，使寻源可直接引用",
  },
  {
    code: "sourcing",
    title: "寻源与供应商定点",
    businessPurpose: "为指定产品、物料或供应范围形成并批准可执行的稳定供给方案",
  },
  {
    code: "demand_replenishment",
    title: "需求与补货",
    businessPurpose:
      "在缺货与过量之间形成经批准的执行需求：哪里需要多少、何时要，以及不处理风险",
  },
  {
    code: "procurement",
    title: "采购履约",
    businessPurpose:
      "对获批采购需求取得并维护可追溯的供应商书面商业承诺，处理数量、日期和条款偏差",
  },
  {
    code: "supply_readiness",
    title: "生产验货与可出运供给",
    businessPurpose:
      "形成真实可出运数量、可信时间窗和当前限制，并及时反映生产、短装、验货和整改偏差",
  },
  {
    code: "shipment_planning",
    title: "出运计划",
    businessPurpose:
      "把已批需求与可用供给形成版本化、可执行的分配、路线、港口和整拼柜方案",
  },
  {
    code: "booking",
    title: "订舱",
    businessPurpose:
      "在获批边界内取得并维持承运人确认、当前有效且可执行的订舱承诺",
  },
  {
    code: "cargo_ready",
    title: "备货",
    businessPurpose:
      "在装箱窗口前形成按时、足量、按版本且满足本节点要求的可装产品行",
  },
  {
    code: "stuffing",
    title: "装箱",
    businessPurpose: "形成可信的实际柜货关系、柜封、件重体及 VGM 生成版本",
  },
  {
    code: "export_customs",
    title: "出口报关",
    businessPurpose: "让全部必要出口案卷取得范围正确、来源可信的出口放行",
  },
  {
    code: "dispatch",
    title: "出运",
    businessPurpose:
      "汇合当前有效订舱、装箱/VGM、出口放行和码头条件，确认可信实际离港并交海运运营",
  },
  {
    code: "ocean_operations",
    title: "海运运营",
    businessPurpose:
      "从可信离港开始裁决航段、港序、ETA 和重大变化，使下游及时获得可行动信息",
  },
  {
    code: "customs",
    title: "进口清关",
    businessPurpose: "形成可信进口放行和未解除限制，交给提柜作联合可提判断",
  },
  {
    code: "pickup",
    title: "提柜",
    businessPurpose: "汇合联合可提条件并取得正确货柜的可信重柜 Gate Out",
  },
  {
    code: "delivery",
    title: "送仓",
    businessPurpose:
      "把已提货柜送至正确目的仓，并取得仓库、WMS、门岗或合格 POD 的权威接收",
  },
  {
    code: "unloading",
    title: "卸柜",
    businessPurpose: "形成实收完成和独立卸空确认两个事实，并把可执行空箱交还箱",
  },
  {
    code: "empty_return",
    title: "还箱",
    businessPurpose:
      "在期限内把空箱还到当前有效场站并取得 EIR/接收证据，关闭柜级设备物流责任",
  },
  {
    code: "compliance_operations",
    title: "合规运营",
    businessPurpose:
      "对产品版本、制造主体、目标国家、用途和业务日期形成有证据、可追溯、在有效期内的准入决定及变化影响",
  },
  {
    code: "charges",
    title: "费用结算",
    businessPurpose:
      "以真实业务事件为依据，形成从费用暴露到核定、分摊、支付、贷项和争议的唯一金额账本",
  },
  {
    code: "exceptions",
    title: "异常中心",
    businessPurpose:
      "协调跨域异常在最早业务期限前取得专业处置或允许的风险决定，并把可执行结果归还原业务域接受",
  },
];

export const workbenchPurposeByCode: Readonly<
  Record<WorkbenchCode, WorkbenchPurpose>
> = Object.fromEntries(
  workbenchPurposes.map((purpose) => [purpose.code, purpose]),
) as Record<WorkbenchCode, WorkbenchPurpose>;
