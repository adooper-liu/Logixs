# 模块依赖图 / 公共入口 / 禁止依赖（P1-09）

> 状态：**已接受** · P1-09 · 2026-09-04 · 负责人：刘志高。
> 依据：ADR-001~009、ENGINEERING_RULES §3、架构 §6.2 与 §7.2。实现期（P3-05）以各包 `package.json` 导出 + DEPCHECK/lint 强制，本图为权威约束的可读表述。

## 1. 顶层层级（App / Package）

```text
apps/web ──REST/SSE/WS──▶ apps/api
apps/api ──▶ packages/{domain, contracts, workflow-contracts, config}
apps/api ──▶ database/migrations（唯一写库入口，Prisma）
apps/api ──▶ 业务 AI Gateway ──HTTP──▶ apps/ai-service     （AI 能力，见下）
apps/api ──▶ Temporal（发起/查询/取消工作流）
workers/business-worker ──▶ packages/{domain, contracts, workflow-contracts}
workers/business-worker ──▶ Temporal（订阅调度）；写库走自身 adapter（业务 Activity）
workers/ai-worker ──▶ apps/ai-service（HTTP）· packages/ai-contracts
apps/ai-service ──▶ packages/ai-contracts（JSON Schema）· LiteLLM Proxy · 对象存储
packages/api-client（OpenAPI 生成）──▶ packages/contracts
packages/*（domain/contracts/config/testing）不依赖任何 apps/*
```

AI Service 与 AI Worker 属 Python（uv）；其余上层为 TypeScript（pnpm）。跨语言共享面只走 `packages/ai-contracts` / JSON Schema / OpenAPI，配合 Contract Parity 测试（ADR-009）。

## 2. 业务 API 内部模块（apps/api）

依赖方向固定 `Controller → Application Use Case → Domain ← Infrastructure`。

```text
identity  shipment  logistics-status  import  dictionary  integration
exception-management  notification  reporting  ai-governance  audit
```

| 规则 | 说明 |
| --- | --- |
| 公共入口 | 每个模块只从公开入口（模块 `index`）导出；内部文件默认私有 |
| 跨模块 | 只经 `packages/contracts`、领域事件与 Domain 能力，禁止 import 他模块内部路径 |
| Domain | 纯业务规则，不依赖 NestJS/Prisma |
| Infrastructure | 实现 Port/Adapter，被本模块 Domain/Application 反转依赖 |
| ai-governance | 只被 AI Gateway/治理面引用，业务模块不得绕过 |
| workflow | 启动/查询/取消 Temporal 的唯一代理，其余模块经它 |
| audit | 写操作审计的公共服务，供各模块调用 |

## 3. 禁止依赖

- 禁止跨包引用对方内部实现（只走公共入口）。
- 禁止 apps/web 直连业务模块内部或数据库；一律经 `apps/api` / `api-client`。
- 禁止 AI Service / AI Worker 直接写生产业务表；禁止业务模块直接调模型供应商（只经 AI Gateway / AI Service）。
- 禁止 Python 与 TypeScript 包互相 import 运行时代码；只共享中性契约。
- 禁止 `packages/*` 依赖 `apps/*`；`contracts` 不带框架依赖。
- 数据库实体不得直接作为 API / AI 契约返回。

## 4. 落地与校验

- P3-05：为各包配置 `package.json` 导出与依赖方向；DEPCHECK/lint 规则注册到 `validate`。
- P1-10 / ADR-009：契约改动走单一权威源 + Parity 测试。
- 本图变更须评审，涉及架构 §19 触发条件时须新增 ADR。
