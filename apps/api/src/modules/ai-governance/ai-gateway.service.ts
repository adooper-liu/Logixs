import { Injectable } from "@nestjs/common";
import type { OpsQuestionInput } from "@logix/contracts";
import { config } from "../../config/env";

export type { OpsQuestionInput } from "@logix/contracts";

export interface MappingSuggestion {
  column: string;
  fieldCode: string | null;
  confidence: number;
}

export interface TaskClaimExplanationInput {
  taskId: string;
  workOrderId: string;
  taskState: string;
  workOrderState: string;
  assignmentState: string;
  assigneeId: string | null;
}

export type TaskClaimExplanation = {
  rationale: string;
  impact: string;
  warningCodes: string[];
} & (
  | {
      kind: "rule";
      modelId: null;
      promptVersion: null;
    }
  | {
      kind: "model";
      modelId: string;
      promptVersion: string;
    }
);

// 业务 AI Gateway 的最小转发（ADR-006）：integration-import 经此调用 AI 能力，
// 禁止直连 AI Service / 模型供应商。完整治理（authorize/预算/审计）属 P5，本阶段只做转发。
@Injectable()
export class AiGatewayService {
  async explainTaskClaim(
    input: TaskClaimExplanationInput,
  ): Promise<TaskClaimExplanation> {
    const response = await fetch(
      `${config.aiServiceUrl}/capabilities/explain-task-claim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(2_000),
      },
    );
    if (!response.ok) throw new Error("TASK_CLAIM_EXPLANATION_UNAVAILABLE");
    return parseTaskClaimExplanation(await response.json());
  }

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

function parseTaskClaimExplanation(value: unknown): TaskClaimExplanation {
  exactObject(value, ["rationale", "impact", "warningCodes", "source"]);
  exactObject(value.source, ["kind", "modelId", "promptVersion"]);
  const rationale = boundedText(value.rationale, 4_000);
  const impact = boundedText(value.impact, 4_000);
  if (!Array.isArray(value.warningCodes) || value.warningCodes.length > 20) {
    throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
  }
  const warningCodes = [
    ...new Set(
      value.warningCodes.map((code) => {
        const normalized = boundedText(code, 100);
        if (!/^[a-z][a-z0-9_.-]*$/.test(normalized)) {
          throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
        }
        return normalized;
      }),
    ),
  ].sort();
  if (value.source.kind === "rule") {
    if (value.source.modelId !== null || value.source.promptVersion !== null) {
      throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
    }
    return {
      kind: "rule",
      rationale,
      impact,
      warningCodes,
      modelId: null,
      promptVersion: null,
    };
  }
  if (value.source.kind === "model") {
    return {
      kind: "model",
      rationale,
      impact,
      warningCodes,
      modelId: boundedText(value.source.modelId, 200),
      promptVersion: boundedText(value.source.promptVersion, 100),
    };
  }
  throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
}

function exactObject(
  value: unknown,
  keys: readonly string[],
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
  }
}

function boundedText(value: unknown, max: number): string {
  if (typeof value !== "string")
    throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new Error("TASK_CLAIM_EXPLANATION_INVALID");
  }
  return normalized;
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
