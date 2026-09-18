import { Injectable } from "@nestjs/common";
import type { OpsQuestionInput } from "@logix/contracts";
import { config } from "../../config/env";

export type { OpsQuestionInput } from "@logix/contracts";

export interface MappingSuggestion {
  column: string;
  fieldCode: string | null;
  confidence: number;
}

// 业务 AI Gateway 的最小转发（ADR-006）：integration-import 经此调用 AI 能力，
// 禁止直连 AI Service / 模型供应商。完整治理（authorize/预算/审计）属 P5，本阶段只做转发。
@Injectable()
export class AiGatewayService {
  async suggestImportMapping(columns: string[]): Promise<MappingSuggestion[]> {
    const response = await fetch(
      `${config.aiServiceUrl}/capabilities/suggest-import-mapping`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `AI 服务 suggest-import-mapping 失败: ${response.status}`,
      );
    }
    const data = (await response.json()) as {
      suggestions: MappingSuggestion[];
    };
    return data.suggestions;
  }

  /**
   * 只读运营问答。AI 服务不可用时回退为确定性摘要，保证通知→助手路径可测。
   */
  async answerOpsQuestion(input: OpsQuestionInput): Promise<string> {
    try {
      const response = await fetch(
        `${config.aiServiceUrl}/capabilities/answer-ops-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { answer?: string };
        if (data.answer?.trim()) return data.answer.trim();
      }
    } catch {
      // fall through to deterministic summary
    }
    return buildDeterministicOpsAnswer(input);
  }
}

export function buildDeterministicOpsAnswer(input: OpsQuestionInput): string {
  const lines = ["这是只读摘要（AI 服务未返回时的回退）。"];
  const notification = input.notificationContext?.trim();
  if (notification) lines.push(`相关问题：${notification}`);
  if (input.objectContext) {
    const { summary, allowedActions, actionSummary, readOnlyPolicy } =
      input.objectContext;
    lines.push(
      `货柜：${summary.containerNumber ?? "未绑定箱号"}（备货单 ${summary.orderNumber}）`,
      `当前状态：${summary.currentStatus}${summary.currentNodeCode ? `；当前节点 ${summary.currentNodeCode}` : ""}`,
      `下一动作：${actionSummary}`,
    );
    for (const action of allowedActions) {
      lines.push(
        `- ${action.explanation}${action.assigneeId ? `；负责人 ${action.assigneeId}` : ""}${action.dueAt ? `；截止 ${action.dueAt}` : ""}`,
      );
    }
    lines.push(readOnlyPolicy.explanation);
  } else if (!notification) {
    lines.push("请从具体问题通知或货柜档案打开助手后再问。");
  }
  lines.push(
    `你的问题：${input.question}`,
    "助手只能解释服务端返回的事实，不能领取、提交或改变业务状态。",
  );
  return lines.join("\n");
}
