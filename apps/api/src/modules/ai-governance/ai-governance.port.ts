// AI 治理端口（ADR-006）：业务 AI Gateway 的治理职责占位，骨架阶段不实现。
// 真实实现（P5/P6）须覆盖：租户/权限校验、输入裁剪与数据驻留、预算/限流/超时/降级、
// Prompt/Tool/模型/Schema 版本绑定、结构化输出与业务规则复核、调用与成本审计。
// 业务模块只能经此端口调用 AI 能力，禁止直连模型供应商或 AI Service。
export const AI_GOVERNANCE_PORT = Symbol("AiGovernancePort");

export interface AiGovernancePort {
  authorize(tenantId: string, capability: string): Promise<void>;
  checkBudget(tenantId: string, capability: string): Promise<void>;
  audit(entry: unknown): Promise<void>;
}
