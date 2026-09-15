import type { SubmissionView, TaskItem, Tone } from "../../data/sample";
import { LIVE_TASK_DEFINITION_KEY } from "../../data/liveWorkspaceProjection";
import {
  getTaskLanguageDefinition,
  getTaskStatusLanguage,
} from "../../data/taskLanguageCatalog";
import { NODE_PURPOSE_LABELS, uiCopy } from "../../data/uiCopyCatalog";

export interface TaskLanguageProjection {
  title: string;
  statusLabel: string;
  tone: Tone;
  triggerReason: string;
  showTriggerReason: boolean;
  guidanceLabel: "下一步" | "当前等待" | "完成结果";
  guidance: string;
  completionCriteria: string;
  guardrail: string;
}

export const projectTaskLanguage = (
  task: TaskItem,
  submission?: SubmissionView,
): TaskLanguageProjection => {
  const definition = getTaskLanguageDefinition(
    task.taskDefinitionKey,
    task.taskDefinitionVersion,
  );
  const status = getTaskStatusLanguage(task.status);

  const title =
    task.taskDefinitionKey === LIVE_TASK_DEFINITION_KEY
      ? (NODE_PURPOSE_LABELS[task.nodeKey] ?? task.nodeName)
      : definition.title;

  if (task.status === "completed") {
    const committedResult =
      submission?.stage === "committed" ? submission.resultSummary : undefined;
    return {
      title,
      statusLabel: status.label,
      tone: status.tone,
      triggerReason: task.triggerReason,
      showTriggerReason: false,
      guidanceLabel: "完成结果",
      guidance: committedResult ?? definition.completionResult,
      completionCriteria: definition.completionCriteria,
      guardrail: definition.guardrail,
    };
  }

  const isWaiting = ["blocked", "reported", "waiting_external"].includes(
    task.status,
  );
  const guidance =
    task.status === "blocked"
      ? definition.blockedGuidance
      : task.status === "reported"
        ? uiCopy.receipt.reported
        : task.status === "waiting_external"
          ? definition.waitingGuidance
          : definition.activeGuidance;

  return {
    title,
    statusLabel: status.label,
    tone: status.tone,
    triggerReason: task.triggerReason,
    showTriggerReason: true,
    guidanceLabel: isWaiting ? "当前等待" : "下一步",
    guidance,
    completionCriteria: definition.completionCriteria,
    guardrail: definition.guardrail,
  };
};
