import type { NodeTaskDetail } from "../api/nodeTasks";

export interface NodeTaskQueueGuidance {
  attentionReason: string;
  conditionKind: "gap" | "next";
  conditionLabel: string;
}

export function buildNodeTaskQueueGuidance(
  task: NodeTaskDetail,
  nodeLabel: string,
): NodeTaskQueueGuidance {
  if (task.readinessState === "waiting_conditions") {
    const count = task.conditionFactRefs.length;
    return {
      attentionReason: `${nodeLabel}任务正在等待前置条件`,
      conditionKind: "gap",
      conditionLabel: count
        ? `${count} 项前置事实条件尚未满足`
        : "前置条件尚未满足",
    };
  }

  if (task.state === "blocked") {
    return {
      attentionReason: `${nodeLabel}任务已阻塞，需要处理`,
      conditionKind: "gap",
      conditionLabel: "任务阻断尚未解除",
    };
  }

  if (task.nextAction?.actionCode === "work_execution.claim_work_order") {
    return {
      attentionReason: `${nodeLabel}任务已进入共享任务池`,
      conditionKind: "next",
      conditionLabel: "领取后开始处理",
    };
  }

  if (task.nextAction?.actionCode === "work_execution.complete_work_order") {
    return {
      attentionReason: `${nodeLabel}任务已领取，等待完成`,
      conditionKind:
        task.completionEligibility === "awaiting_evidence" ? "gap" : "next",
      conditionLabel:
        task.completionEligibility === "awaiting_evidence"
          ? "完成凭证尚未补齐"
          : "完成当前工单",
    };
  }

  if (task.state === "completed") {
    return {
      attentionReason: `${nodeLabel}任务已完成`,
      conditionKind: "next",
      conditionLabel: "无需继续处理",
    };
  }

  return {
    attentionReason: `${nodeLabel}任务正在等待允许动作`,
    conditionKind: "gap",
    conditionLabel: "系统尚未给出可执行动作",
  };
}
