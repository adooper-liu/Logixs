# 架构决策记录（ADR）索引

> 约定（ENGINEERING_RULES §12 / 架构 §19）：替换数据库、工作流引擎、主后端/前端框架、引入新网关/Agent/向量库、允许新 L3/L4 操作、拆分微服务或引入 Kafka/Kubernetes、改变数据驻留等，必须先新增 ADR。
> 状态：`proposed`（草拟待 P1 评审）→ `accepted`（评审接受）→ `superseded` / `deprecated`。评审接受后，将对应 P1 清单项勾选并在此标注日期。

## P1 决策映射（2026-09-04 已接受）

| ADR | 清单项 | 一句话决策 | 状态 |
| --- | --- | --- | --- |
| [ADR-001](./ADR-001-modular-monolith.md) | P1-01 | 业务后端采用模块化单体：按能力分强边界模块，依赖向内，无隔离证据不拆微服务。 | accepted |
| [ADR-002](./ADR-002-pnpm-turborepo-uv.md) | P1-02 | TS 用 pnpm+Turborepo、Python 用 uv，双锁文件并存管理多语言 Monorepo。 | accepted |
| [ADR-003](./ADR-003-postgresql-prisma.md) | P1-03 | PostgreSQL+Prisma 承载事实/审计/AI 元数据，迁移只走唯一入口，禁 ORM 自动同步。 | accepted |
| [ADR-004](./ADR-004-temporal.md) | P1-04 | 用 Temporal 编排持久化工作流，Workflow 确定性、模型/IO 全部进 Activity。 | accepted |
| [ADR-005](./ADR-005-python-ai-service-workers.md) | P1-05 | FastAPI AI Service 独立实现 AI 能力（Python），业务确定性走 TS 双 Worker，Python 不写业务表。 | accepted |
| [ADR-006](./ADR-006-ai-gateway-litellm.md) | P1-06 | LiteLLM 管供应商路由，业务 AI Gateway 只做治理转发，业务代码不直连供应商。 | accepted |
| [ADR-007](./ADR-007-pgvector.md) | P1-07 | 初期用 pgvector 承担向量检索，规模/延迟/混合检索触发后再迁独立向量库。 | accepted |
| [ADR-008](./ADR-008-oidc-oauth.md) | P1-08 | OIDC/OAuth 2.1 + 自托管 IdP（Keycloak），RBAC/ABAC 服务端授权并预留租户维度。 | accepted |
| [ADR-009](./ADR-009-versioning-strategy.md) | P1-10 | 契约与运行物（Prompt/模型/Tool/Schema/评测）统一语义化版本，单一权威源 + Parity 防漂移。 | accepted |

## P1-09 模块依赖图（非 ADR 产物）

P1-09 要求「定义模块依赖图、公共入口和禁止依赖」。权威约束已固化于 [ENGINEERING_RULES §3](../../../ENGINEERING_RULES.md) 与 [架构 §6.2](../AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md)；实现期为各包 `package.json` 导出 + 依赖方向 lint（DEPCHECK）强制，产物随 P3-05 脚手架落地后在此补充链接。

## 模板

新建 ADR 复制 [_TEMPLATE.md](./_TEMPLATE.md)；已撤销/替换的 ADR 在头部标注 `superseded by ADR-NNN`，不删除（可追溯）。

## 评审记录

- 2026-09-04：ADR-001~009 草拟（proposed）。
- 2026-09-04：ADR-001~009 经项目负责人评审**接受**（accepted），对应 P1-01~P1-08 / P1-10 已勾选（见 [PROJECT_BOOTSTRAP_CHECKLIST](../../planning/PROJECT_BOOTSTRAP_CHECKLIST.md)）。P1-09 模块依赖图仍待随 P3-05 落地。
