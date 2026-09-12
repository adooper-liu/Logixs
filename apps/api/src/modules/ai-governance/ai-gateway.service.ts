import { Injectable } from "@nestjs/common";
import { config } from "../../config/env";

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
}
