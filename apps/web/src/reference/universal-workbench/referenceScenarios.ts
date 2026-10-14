import type { WorkbenchResponsibilityItem } from "../../components/workbench/workbenchLayout.types";

export type ReferenceScenarioKey =
  "working" | "waiting" | "failed" | "conflict" | "readonly" | "dirty-session";

export interface ReferenceScenario {
  key: ReferenceScenarioKey;
  conclusion: string;
  progressLabel?: string;
  responsibility: readonly WorkbenchResponsibilityItem[];
  detailTitle: string;
  detailBody: readonly string[];
  contextTitle: string;
  contextBody: readonly string[];
  disabledReason?: string;
}

const baseResponsibility: readonly WorkbenchResponsibilityItem[] = [
  { label: "当前对象", value: "合成机会 REF-001", state: "known" },
  { label: "本次结果", value: "形成可交接的立项结论", state: "known" },
  { label: "当前责任", value: "选品岗位", state: "known" },
  { label: "下一责任", value: "产品开发岗位", state: "known" },
  { label: "截至时间", value: "2026-10-14T17:00:00+08:00", state: "known" },
];

export const referenceScenarios: Readonly<
  Record<ReferenceScenarioKey, ReferenceScenario>
> = {
  working: {
    key: "working",
    conclusion: "办理中 · 当前门槛未满足",
    progressLabel: "3/5",
    responsibility: baseResponsibility,
    detailTitle: "事实、缺口与推进任务",
    detailBody: ["品类定义待补", "风险依据待确认", "证据版本 v3"],
    contextTitle: "当前事项操作上下文",
    contextBody: ["补齐价格带证据", "保存后重新校验"],
    disabledReason: "还缺价格带证据和风险依据",
  },
  waiting: {
    key: "waiting",
    conclusion: "等待外部证据",
    progressLabel: "3/5",
    responsibility: [
      ...baseResponsibility.slice(0, 3),
      { label: "等待对象", value: "供应商", state: "known" },
      { label: "截至时间", value: "2026-10-14T12:00:00+08:00", state: "known" },
    ],
    detailTitle: "已完成事实与等待事项",
    detailBody: ["已完成商业事实", "等待样品标签证据"],
    contextTitle: "等待与恢复",
    contextBody: ["等待供应商", "到期后可催办"],
  },
  failed: {
    key: "failed",
    conclusion: "保存失败 · 当前输入已保留",
    responsibility: baseResponsibility,
    detailTitle: "失败事实与最近成功版本",
    detailBody: ["最近成功版本 v3", "当前输入未丢失"],
    contextTitle: "失败恢复",
    contextBody: ["错误码 WB_SAVE_FAILED", "追踪 ID trace-ref-001", "安全重试"],
  },
  conflict: {
    key: "conflict",
    conclusion: "版本冲突 · 需重读",
    responsibility: baseResponsibility,
    detailTitle: "冲突差异",
    detailBody: ["已查看版本 v3", "服务端版本 v4"],
    contextTitle: "冲突处置",
    contextBody: ["重读最新事实", "比较后重新提交"],
  },
  readonly: {
    key: "readonly",
    conclusion: "结论已冻结",
    progressLabel: "5/5",
    responsibility: [
      ...baseResponsibility.slice(0, 2),
      { label: "当前责任", value: "已完成岗位", state: "known" },
      { label: "下一责任", value: "产品开发岗位已接收", state: "known" },
      { label: "完成时间", value: "2026-10-11T10:42:00+08:00", state: "known" },
    ],
    detailTitle: "冻结结果与证据",
    detailBody: ["最终结论 v4", "不可变交接快照"],
    contextTitle: "只读结果上下文",
    contextBody: ["当前责任去向", "后续工作台入口"],
  },
  "dirty-session": {
    key: "dirty-session",
    conclusion: "存在未保存草稿",
    responsibility: baseResponsibility,
    detailTitle: "当前草稿",
    detailBody: ["品类定义编辑中", "版本 v3"],
    contextTitle: "离开前处理",
    contextBody: ["保存草稿并切换", "放弃本地改动", "留在当前页面"],
  },
};

export const referenceSessions = [
  {
    id: "selection",
    label: "选品 · 合成机会 REF-001",
    status: "current" as const,
  },
  {
    id: "sourcing",
    label: "寻源 · 合成 SKU REF-002",
    status: "resumable" as const,
  },
  {
    id: "unloading",
    label: "卸货 · 合成货柜 REF-003",
    status: "draft_saved" as const,
  },
] as const;

export const syntheticNotice = "合成结构演练数据，不是生产记录";
