import { Injectable } from "@nestjs/common";
import { config } from "../../config/env";

export interface MappingSuggestion {
  column: string;
  fieldCode: string | null;
  confidence: number;
}

export interface OpsQuestionInput {
  question: string;
  notificationContext: string | null;
  history: ReadonlyArray<{ role: string; body: string }>;
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
  const context = input.notificationContext?.trim();
  if (context) {
    return [
      "这是只读摘要（AI 服务未返回时的回退）。",
      `相关问题：${context}`,
      `你的问题：${input.question}`,
      "请到「看失败」核对死信并按授权重放；本助手本刀不能改写业务状态。",
    ].join("\n");
  }
  return [
    "这是只读摘要（AI 服务未返回时的回退）。",
    `你的问题：${input.question}`,
    "请补充通知上下文或打开具体问题通知后再问。",
  ].join("\n");
}
