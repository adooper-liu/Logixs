# 模块依赖图 / 公共入口 / 禁止依赖（P1-09）

> 状态：**已接受** · P1-09 · 2026-09-04 · 负责人：刘志高。
> 依据：ADR-001~010、ENGINEERING_RULES §3、架构 §6.2 与 §7.2。实现期（P3-05）以各包 `package.json` 导出 + DEPCHECK/lint 强制，本图为权威约束的可读表述。

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
核心：shipment-registry  lifecycle-control  work-execution  booking-origin
      ocean-port-visibility  customs-compliance  inland-fulfillment
      charges-settlement  document-records  performance-improvement
支撑：integration-import  exception-management  identity  master-data
      notification  audit  workflow  ai-governance
```

| 规则           | 说明                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| 公共入口       | 每个模块只从公开入口（模块 `index`）导出；内部文件默认私有                    |
| 跨模块         | 只经 `packages/contracts`、领域事件与 Domain 能力，禁止 import 他模块内部路径 |
| Domain         | 纯业务规则，不依赖 NestJS/Prisma                                              |
| Infrastructure | 实现 Port/Adapter，被本模块 Domain/Application 反转依赖                       |
| ai-governance  | 只被 AI Gateway/治理面引用，业务模块不得绕过                                  |
| workflow       | 启动/查询/取消 Temporal 的唯一代理，其余模块经它                              |
| audit          | 写操作审计的公共服务，供各模块调用                                            |

### 2.1 所有权和调用方向

| 所有者                                        | 只能通过                         |
| --------------------------------------------- | -------------------------------- |
| shipment-registry：ContainerRecord            | Shipment公共查询/写端口          |
| lifecycle-control：FlowInstance、14节点状态机 | 流程命令和规范事件端口           |
| work-execution：NodeTask、WorkOrder、工单聚合 | 工单命令、任务查询和结果事件端口 |
| 专业模块：订舱/海运/清关/内陆作业事实         | 各自公开用例和领域事件           |
| charges/document/exception/performance        | 事实引用和幂等事件消费者         |
| integration-import                            | 各业务模块的写端口，不直写业务表 |

正常推进方向：WorkOrder结果 → NodeTask聚合 → 规范业务事件 → lifecycle-control合法转换。反向触发只发送“节点已进入”事件，由work-execution按节点任务定义生成工单。跨事务使用Transactional Outbox；禁止双向同步调用环和分布式事务。

## 3. 禁止依赖

- 禁止跨包引用对方内部实现（只走公共入口）。
- 禁止 apps/web 直连业务模块内部或数据库；一律经 `apps/api` / `api-client`。
- 禁止 AI Service / AI Worker 直接写生产业务表；禁止业务模块直接调模型供应商（只经 AI Gateway / AI Service）。
- 禁止 Python 与 TypeScript 包互相 import 运行时代码；只共享中性契约。
- 禁止 `packages/*` 依赖 `apps/*`；`contracts` 不带框架依赖。
- 数据库实体不得直接作为 API / AI 契约返回。

## 4. 落地与校验

- P3-05：按 [ADR-010](./decisions/ADR-010-bounded-context-modules.md) 创建模块公开入口、自有持久化目录和契约；依赖检查禁止跨模块内部路径及 Repository 访问。
- P1-10 / ADR-009：契约改动走单一权威源 + Parity 测试。
- 本图变更须评审，涉及架构 §19 触发条件时须新增 ADR。
