---
status: accepted
date: 2026-09-04
decider: 刘志高
---

# ADR-005：独立 Python AI Service + TS/Python 双 Worker

> 状态：`accepted` · 日期：2026-09-04 · 决定人：刘志高（2026-09-04 接受）

## 背景

AI 能力（映射、抽取、RAG、解释、草稿、预测）与文档/模型生态多在 Python；而业务事实与写入在 TS。需要让「AI 能力实现」与「确定性业务」清晰隔离、可替换，并承载 Temporal 中的 AI Activity。

## 决策

- **`apps/ai-service`（FastAPI）独立实现全部 AI 业务能力**，经 LiteLLM Proxy 统一调用模型；业务 API 的 AI Gateway 只治理转发（ADR-006）。Python 仅用于 AI 边界，**不直接写生产业务表**。
- **双 Worker**：`workers/business-worker`（TS）执行确定性 Activity；`workers/ai-worker`（Python）执行 AI Activity，调用 AI Service 能力。
- 语言边界：业务服务端与前端为 TS；跨语言共享面走 JSON Schema / OpenAPI + Contract Parity 测试（ENGINEERING_RULES §7）。
- 与 AI Service 的所有能力调用均须版本化、可观测、可审计（架构 §7.2/§10.3）。

## 后果

- 正面：模型/供应商/Prompt 可替换而不污染领域代码；AI 能力在独立服务内演进；AI Activity 与业务 Activity 各自部署。
- 代价：多一个部署单元与跨服务调用链；TS/Python 双语言带来契约一致性负担。
- 连锁：影响 P2-10（能力 Schema）、P3-04/05 脚手架、§15 部署拓扑（ai-service/ai-worker）。

## 备选方案

| 方案 | 取舍 | 为何未选 |
| --- | --- | --- |
| 全部 TS（含 AI） | 单语言 | Python 文档/NLP/评测生态不可让渡；AI 能力质量受限 |
| Python 实现整个后端 | 单语言 | 业务/契约/前端已定 TS；Python 承担业务事务/权限不利 |
| AI 逻辑内嵌业务 Worker | 少部署单元 | 破坏确定性/治理边界；模型调用应独立超时与隔离 |

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 跨语言契约漂移 | 单一权威源 + Parity 测试（P3-13） |
| 多服务调用链延迟/故障 | AI Gateway 超时/重试/降级；全链路 Trace（§14） |

## 迁移与撤销条件

若某能力长期无 AI 价值或评测不达标，可从 AI Service 收敛为确定性规则（下沉业务侧）；若模型生态迁出 Python 且证据充分，可评估收敛单语言——均须新增 ADR。
