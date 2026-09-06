import type { TaskStatusCode, Tone } from "./sample";

export interface TaskLanguageDefinition {
  taskDefinitionKey: string;
  version: number;
  title: string;
  activeGuidance: string;
  blockedGuidance: string;
  waitingGuidance: string;
  completionCriteria: string;
  guardrail: string;
  completionResult: string;
}

export interface TaskStatusLanguage {
  label: string;
  tone: Tone;
}

const taskStatusLanguage = {
  available: { label: "待领取", tone: "info" },
  in_progress: { label: "进行中", tone: "info" },
  blocked: { label: "已阻塞", tone: "risk" },
  reported: { label: "已提交·待落账", tone: "warn" },
  waiting_external: { label: "等待外部", tone: "warn" },
  under_review: { label: "待复核", tone: "risk" },
  completed: { label: "已完成", tone: "ok" },
} as const satisfies Record<TaskStatusCode, TaskStatusLanguage>;

const definitions = [
  {
    taskDefinitionKey: "transmit_customs_documents",
    version: 1,
    title: "发送清关资料",
    activeGuidance: "核对本柜资料和接收方，确认无误后发送。",
    blockedGuidance: "补齐缺失资料后再发送。",
    waitingGuidance: "清关资料发送记录已落账，等待清关行受理。",
    completionCriteria: "资料包、接收方与发送记录均已确认。",
    guardrail: "发送完成不代表清关行已经受理。",
    completionResult: "清关资料发送记录已落账。",
  },
  {
    taskDefinitionKey: "check_pickup_readiness",
    version: 1,
    title: "核对提柜前置条件",
    activeGuidance: "核对放行、码头可提、费用和预约条件。",
    blockedGuidance: "等待海关放行；条件齐全后才能安排派拖。",
    waitingGuidance: "等待外部条件更新后重新核验。",
    completionCriteria: "所有前置条件有权威事实，形成可派拖或继续等待结论。",
    guardrail: "可以派拖不代表已经提柜。",
    completionResult: "提柜前置条件核验结论已落账，货柜状态未推进。",
  },
  {
    taskDefinitionKey: "execute_unload",
    version: 1,
    title: "卸柜并核对实收数量",
    activeGuidance: "先核对柜号和卸柜清单，全部卸完后核对实收数量。",
    blockedGuidance: "处理阻塞项或上报异常后再继续卸柜。",
    waitingGuidance: "等待卸柜结果落账。",
    completionCriteria: "货柜身份、实收数量与差异均已核对，必需证据齐全。",
    guardrail: "短少、破损或柜号不符时先上报异常，不得提交正常完成。",
    completionResult: "卸柜结果已落账，实收数量已核对。",
  },
  {
    taskDefinitionKey: "resolve_departure_conflict",
    version: 1,
    title: "确认实际离港时间",
    activeGuidance: "核对两条离港记录，选择采用时间并填写理由。",
    blockedGuidance: "补齐原始记录或复核权限后继续处理。",
    waitingGuidance: "等待离港时间对账结论落账。",
    completionCriteria: "采用时间、来源和理由形成对账结论。",
    guardrail: "如需修正已入账时间，系统新增更正记录并保留原记录。",
    completionResult: "离港时间对账结论已落账，原记录已保留。",
  },
  {
    taskDefinitionKey: "monitor_port_arrival",
    version: 1,
    title: "监控到港与卸船事件",
    activeGuidance: "持续接收权威到港与卸船事件。",
    blockedGuidance: "事件源不可用，等待恢复或派生人工调查任务。",
    waitingGuidance: "等待权威到港或卸船事件。",
    completionCriteria: "权威到港或卸船事件已接收并落账。",
    guardrail: "正常监控不生成员工待办；超时或冲突才派生人工任务。",
    completionResult: "权威到港或卸船事件已落账。",
  },
] as const satisfies readonly TaskLanguageDefinition[];

const taskLanguageByVersion = new Map(
  definitions.map((definition) => [
    `${definition.taskDefinitionKey}@${definition.version}`,
    definition,
  ]),
);

export const getTaskStatusLanguage = (
  status: TaskStatusCode,
): TaskStatusLanguage => taskStatusLanguage[status];

export const getTaskLanguageDefinition = (
  taskDefinitionKey: string,
  version: number,
): TaskLanguageDefinition => {
  const key = `${taskDefinitionKey}@${version}`;
  const definition = taskLanguageByVersion.get(key);
  if (!definition) throw new Error(`未知任务语言定义：${key}`);
  return definition;
};
