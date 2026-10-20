// ai-governance 公开入口：业务模块经此调用 AI 能力（禁止直连 AI Service）。
export * from "./ai-governance.module";
export {
  AiGatewayService,
  type MappingSuggestion,
  type OpsQuestionInput,
  type TaskClaimExplanation,
  type TaskClaimExplanationInput,
  buildDeterministicOpsAnswer,
} from "./ai-gateway.service";
export {
  AI_GOVERNANCE_PORT,
  type AiGovernancePort,
  TASK_CLAIM_EXPLANATION,
  type TaskClaimExplanationPort,
} from "./ai-governance.port";
