import type { TaskStatusCode, Tone } from "./sample";
import { taskStatusCopy, uiCopy } from "./uiCopyCatalog";

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

const definitions = [
  {
    taskDefinitionKey: "transmit_customs_documents",
    version: 1,
    title: "发送清关资料",
    activeGuidance: "核对本柜资料和接收方，确认无误后发送。",
    blockedGuidance: "补齐缺失资料后再发送。",
    waitingGuidance: "发送记录已入账，等待清关行受理。",
    completionCriteria: "资料包、接收方与发送记录均已确认。",
    guardrail: "发送完成不代表清关行已经受理。",
    completionResult: "发送记录已入账。",
  },
  {
    taskDefinitionKey: "check_pickup_readiness",
    version: 1,
    title: "核对提柜条件",
    activeGuidance: "核对放行、码头可提、费用和预约条件。",
    blockedGuidance: "等海关放行；条件齐了才能派拖车。",
    waitingGuidance: "等待外部条件更新后再核验。",
    completionCriteria: "所有先决条件都有权威记录，得出可派拖或继续等的结论。",
    guardrail: "可以派拖不代表已经提柜。",
    completionResult: "提柜条件已入账。货柜状态未变更。",
  },
  {
    taskDefinitionKey: "execute_unload",
    version: 1,
    title: "卸柜并核对实收数量",
    activeGuidance: "先核对柜号和卸柜清单，全部卸完后核对实收数量。",
    blockedGuidance: "处理卡住的项或上报异常后再继续卸柜。",
    waitingGuidance: "等待卸柜结果入账。",
    completionCriteria: "货柜身份、实收数量与差异均已核对，必需单证齐全。",
    guardrail: "短少、破损或柜号不符时先上报异常，不得按正常完成报。",
    completionResult: "卸柜结果已入账，实收数量已核对。",
  },
  {
    taskDefinitionKey: "resolve_departure_conflict",
    version: 1,
    title: "确认实际离港时间",
    activeGuidance: "核对两条离港记录，选择采用时间并填写理由。",
    blockedGuidance: "补齐原始记录或复核权限后继续处理。",
    waitingGuidance: "等待离港时间核对结果入账。",
    completionCriteria: "采用时间、来源和理由形成核对结论。",
    guardrail: "如需修正已入账的时间，系统新增更正记录并保留原记录。",
    completionResult: "离港时间已入账，原记录保留。",
  },
  {
    taskDefinitionKey: "monitor_port_arrival",
    version: 1,
    title: "盯到港和卸船",
    activeGuidance: "持续接收权威到港与卸船记录。",
    blockedGuidance: "事件源不可用，等待恢复或派人去查。",
    waitingGuidance: "等到港或卸船记录。",
    completionCriteria: "权威到港或卸船记录已接到并入账。",
    guardrail: "系统自动监控，异常时才生成任务。",
    completionResult: "到港或卸船事件已入账。",
  },
  {
    taskDefinitionKey: "live_node_task",
    version: 1,
    title: "做完这一站",
    activeGuidance: uiCopy.chrome.liveGuidance,
    blockedGuidance: uiCopy.chrome.liveBlocked,
    waitingGuidance: uiCopy.chrome.liveWaiting,
    completionCriteria: uiCopy.chrome.liveCompletion,
    guardrail: uiCopy.chrome.liveGuardrail,
    completionResult: uiCopy.chrome.liveDone,
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
): TaskStatusLanguage => taskStatusCopy(status);

export const getTaskLanguageDefinition = (
  taskDefinitionKey: string,
  version: number,
): TaskLanguageDefinition => {
  const key = `${taskDefinitionKey}@${version}`;
  const definition = taskLanguageByVersion.get(key);
  if (!definition) throw new Error(`未知任务语言定义：${key}`);
  return definition;
};
