# 货柜工作台一期 实施计划

> **执行方式：** 每个 Task 使用一个全新子代理；主代理在进入下一 Task 前审查差异、权威契约和定向验证。共享文件任务不得并行写。步骤使用 checkbox（`- [ ]`）跟踪。

**Goal:** 让已经合法应用的规范事件/日期事实经 `WorkOrderFactApplication` 对账到对应工单，严格经过 WorkOrder 状态机、NodeTask 聚合和 NodeTaskOutcome/审计闭环；同时让货柜工作台首次铺满 14 站轨道，三轨（计划/预计/实际）预埋、无数据显式留空。

**Architecture:** `lifecycle-control` 继续独占过站，`work-execution` 继续独占任务/工单。节点应用成功时，在同一 lifecycle 本地事务写 `NodeEventApplication(applied)` 与专用 reconciliation Outbox；现有 Outbox 租约、重试、死信和重放链把完整因果范围交给公开 `RECONCILE_APPLIED_LIFECYCLE_FACT` 端口。端口按 `workOrderId + businessFactKey` 幂等，事务内写不可变 `WorkOrderFactApplication`、执行合法 WorkOrder 转换、确定性聚合 NodeTask、写 NodeTaskOutcome/审计；即使 lifecycle 已先提交，Outbox 重放仍可补齐任务侧，且不会再次过站。事实→节点继续使用 `ShipmentTimeFact.eventCode` → canonical-events 权威映射（旧影子表只作兼容兜底）。前端把 `MicroWorkbench` 重排为 L1 竖向堆叠，轨道画全 14 站，并新增**常驻**三轨展开卡。

**Tech Stack:** NestJS + Prisma + Vitest（后端）· Vue 3 `<script setup>` + vue-router + Vitest/happy-dom（前端）· pnpm workspace + turbo

**Spec:** `docs/superpowers/specs/2026-09-21-container-workbench-task-driving-design.md`

> 该 Spec 状态为待评审，仅提供产品方向。其“事实采信 → 任务完成 + 过站”的描述必须按正式 GC-005 展开为两条各自受控、可对账的链路，不授权 lifecycle 反向批量修改任务/工单；冲突时以 GC-005 和已接受模块依赖图为准。

## Global Constraints

- 提交信息用中文，动词开头，一句话说清改了什么（仓库既有风格）。
- **留空纪律**：无数据一律显式留空（`—` / `null`），**禁止**用 0、假日期或演示数据填充；空轨道**禁止**画进度条（`WORKSPACE_UI_INVENTORY §6`）。
- **不适用 ≠ 留空**：`applicability === "optional_not_applicable"` 的节点（中转 / 海铁）显示"不适用"，与"暂无数据"是两种呈现。
- **三轨槽位常驻**：`plannedAt` / `estimatedAt` / `actualAt` 三个字段始终存在于类型与模板中，无值时渲染 `—`，不因无数据而省略。
- **不改领域规则**："工单完成 ≠ 过站"保持不变。人工兜底路径是"人工补录事实"，不是"手工完成工单"。
- **禁止反向完成**：不得因为 lifecycle 节点已完成而直接 `UPDATE NodeTask/WorkOrder = completed`；节点应用只是可被工单完成谓词消费的业务事实。
- **本地事务边界**：lifecycle 过站事务与 work-execution 对账事务不伪装成一个分布式事务。前者把 `NodeEventApplication(applied)` 与 reconciliation Outbox 原子提交；后者失败时复用现有 Outbox 重试、死信和重放补齐。
- **同语义幂等**：同一 `workOrderId + businessFactKey`、同一 `requestHash` 返回原结果；同键异哈希明确 `IDEMPOTENCY_CONFLICT`，不得覆盖原应用。
- **状态守卫**：`draft`、`failed`、`cancelled` 工单不得被事实对账强改为 completed；cancelled NodeTask 也不得复活。需要恢复时走正式 ready/reopen/适用性命令后再重放。
- **正式 brief 顺序**：`p6-container-unloading-operational-flow.md` 已完成并由 `0b5b583` 实现、`9c2052e` 收口。因 GitHub CLI 登录失效，一期分支暂时叠在该精确提交之上继续开发；最终 PR 前必须确认前置提交已进入 `main`，不得把认证等待扩散成业务实现阻塞。
- **不改现有表单**：六个岗位工作台的表单一行不改。
- 后端测试：`pnpm --filter @logix/api test -- <path>`；前端测试：`pnpm --filter @logix/web test <path>`。
- 契约包改动后必须跑 `pnpm contract:generate` 重新生成 `packages/contracts/generated/contracts.d.ts`。

---

## 开工门禁与顺序

1. 以包含 `0b5b583` 和 `9c2052e` 的 `feat/container-workbench-phase1` 为明确堆叠基线；保留两份用户 `uv.lock` 修改。
2. 创建 `docs/planning/tasks/p6-container-workbench-phase1.md`，初始状态 `design`；`docs/INDEX.md` 同批登记。最终 PR 前先让前置卸柜提交进入 `main`，再核对本分支只剩一期差异。
3. brief 必须引用 GC-005、模块依赖图、本设计和本计划，并包含范围、非目标、风险、验证及以下四者协同矩阵：

| 岗位目标                           | 操作时需要看到什么                                                                   | 系统允许做什么                                                                      | 数据如何可靠保存                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 全局运营识别一柜当前站、历史和异常 | 14 站、当前/完成/不适用、计划/预计/实际、未关闭阻塞、数据来源/空态                   | 选择站点、查看三轨和缺口、跳转岗位台；本期不在货柜页直接办业务                      | lifecycle 查询投影；空值为 null；不从颜色或文案反推状态                         |
| 对应岗位完成节点工作               | 当前工单、完成谓词、已收/缺失事实、责任/时限、证据和不可执行原因                     | 录入/导入/API 接收事实，按服务端 allowed actions 领取或处理；不得手工指定 completed | 规范事实 → FactApplication → 状态机 → 聚合 → Outcome/审计；事务、版本和幂等受控 |
| 复核/运维处理失败和迟到事实        | 原规范事件、domain fact、target node、Outbox 状态、attempt、稳定 reasonCode、traceId | 重放 due/dead-letter 对账；更正走新事实，不覆盖历史                                 | 专用 reconciliation Outbox 复用既有租约/重试/死信；事实应用同键幂等、异载荷冲突 |

4. 实施顺序固定：Task 1~~4（事实对账主链）→ Task 5~~7（权威映射/目录/三轨 API）→ Task 8~11（前端类型、水平轨道、常驻三轨卡、L1 页面）。每个 Task 完成后由主代理审查再提交单一主题 commit。

---

## 文件结构

**后端 · work-execution**

| 文件                                                                          | 职责                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `reconcile-applied-lifecycle-fact.port.ts`（新建）                            | 对外端口：把已应用 lifecycle business fact 对账到任务/工单 |
| `application/reconcile-applied-lifecycle-fact.service.ts`（新建）             | 校验因果范围、幂等/冲突、状态守卫和事务编排                |
| `domain/work-order-fact-application.ts`（新建）                               | 规范化业务键/哈希与事实应用决定                            |
| `domain/state-rules.ts` / `domain/task-outcome.ts`（改）                      | 复用合法 WorkOrder 转换与 NodeTask 聚合，结果带事实因果    |
| `domain/work-execution.repository.ts`（改）                                   | 增加按范围查任务及原子应用事实的端口                       |
| `infrastructure/prisma-work-execution.repository.ts`（改）                    | 单事务写 FactApplication、状态、聚合、Outcome/审计         |
| `infrastructure/prisma-work-execution.repository.integration.test.ts`（新建） | 真实 PostgreSQL 约束、回滚、重放和并发验证                 |
| `domain/task-condition-fact.ts`（改）                                         | 加 `nodeCode` 字段                                         |
| `domain/task-conditions.ts`（改）                                             | 优先按 `fact.nodeCode` 匹配，`FACT_TARGET_NODE` 降为兜底   |
| `work-execution.module.ts` / `index.ts`（改）                                 | 注册并导出新端口                                           |
| `module.manifest.ts`（改）                                                    | 登记 `RECONCILE_APPLIED_LIFECYCLE_FACT` 公共端口           |

**后端 · shipment-registry**

| 文件                                                  | 职责                                                    |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `domain/container-task-fact.ts`（改）                 | 加 `nodeCode` 字段                                      |
| `infrastructure/prisma-container.repository.ts`（改） | `listCurrentTaskFacts` 用 `eventCode` 解析出 `nodeCode` |

**后端 · lifecycle-control**

| 文件                                                       | 职责                                               |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `domain/work-fact-reconciliation-outbox.ts`（新建）        | 构造逐目标节点、可幂等重放的 reconciliation Outbox |
| `infrastructure/work-execution-outbox-delivery.ts`（新建） | 路由专用 Outbox 到 work-execution 公共对账端口     |
| `domain/lifecycle.repository.ts` / Prisma 实现（改）       | 节点应用与专用 Outbox 原子提交；读取完整因果范围   |
| `domain/lifecycle-nodes.ts`（改）                          | 投影加三轨时间字段                                 |
| `application/list-lifecycle-nodes.service.ts`（改）        | 取事实并传入投影                                   |
| `domain/lifecycle-date-fact.repository.ts`（改）           | 端口加批量按容器列当前事实的能力                   |
| `presentation/lifecycle-nodes.controller.ts`（改）         | DTO 透出三轨时间                                   |
| `domain/node-completion-mode.ts`（新建）                   | 从节点目录读 `completionMode`                      |

**契约**

| 文件                                                        | 职责                                              |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `packages/contracts/catalogs/v1/lifecycle-nodes.json`（改） | 每个节点加 `completionMode`，初值全 `fact_driven` |
| `packages/contracts/generated/contracts.d.ts`（再生成）     | —                                                 |

**数据库**

| 文件                                                                                    | 职责                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `database/schema.prisma`（改）                                                          | 落地 `WorkOrderFactApplication`、工单版本/适用性与 Outcome 因果字段 |
| `database/migrations/<timestamp>_add_work_order_fact_application/migration.sql`（新建） | expand → backfill → constrain；只追加迁移                           |
| `scripts/verify-work-order-fact-application.mts`（新建）                                | 验证租户范围、唯一键、状态与历史数据回填                            |
| `package.json`（改）                                                                    | 新增 `db:verify:work-order-fact-application` 稳定入口               |

**前端**

| 文件                                                 | 职责                                                 |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `api/lifecycleNodes.ts`（改）                        | `LifecycleNodeItem` 加三轨时间与 `blockedReasonRefs` |
| `data/liveNodeProjection.ts`（改）                   | `LiveNodeView` 加三轨时间与异常数                    |
| `components/container/LiveNodeRail.vue`（重写）      | 水平主轴：全 14 站、四态、每站摘要日期或 `—`         |
| `components/container/NodeTimeTrackCard.vue`（新建） | **常驻**三轨展开卡                                   |
| `views/MicroWorkbench.vue`（改）                     | L1 竖向堆叠 + 标记 / 异常槽位                        |

---

### Task 1: 冻结运行时对账命令与领域决定

**Authority:**

- `TASK_WORK_ORDER_CONTRACT_V1.md §5~§12`：工单合法转换、事实应用、聚合、结果和事务规则。
- `MODULE_DEPENDENCIES.md §2.1`：`lifecycle-control` 独占过站，`work-execution` 独占任务/工单。
- `packages/contracts/schemas/v1/work-execution.schema.json`：既有 `WorkOrderFactApplication` 与 `WorkExecutionCommand` 技术契约。本任务消费它们，不修改正式契约原文。

**Files:**

- Create: `apps/api/src/modules/work-execution/domain/work-order-fact-application.ts`
- Create: `apps/api/src/modules/work-execution/domain/work-order-fact-application.test.ts`
- Modify: `apps/api/src/modules/work-execution/domain/state-rules.ts`
- Modify: `apps/api/src/modules/work-execution/domain/state-rules.test.ts`
- Modify: `apps/api/src/modules/work-execution/domain/task-outcome.ts`
- Modify: `apps/api/src/modules/work-execution/domain/task-outcome.test.ts`
- Create: `apps/api/src/modules/work-execution/reconcile-applied-lifecycle-fact.port.ts`

**Public command:**

```ts
export interface ReconcileAppliedLifecycleFactCommand {
  tenantId: string;
  containerId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  canonicalEventId: string;
  eventCode: CanonicalEventCode;
  businessFactType: "lifecycle_date_fact" | "canonical_lifecycle_event";
  domainFactId: string;
  captureSource: CaptureSource;
  evidenceRefs: string[];
  occurredAt: Date;
  receivedAt: Date;
  actorOrServiceId: string;
  traceId: string;
  idempotencyKey: string;
}
```

有已核验日期事实时，`businessFactType = "lifecycle_date_fact"` 且 `domainFactId = CanonicalEvent.domainFactId`；没有关联日期事实但规范事件本身已合法应用时，`businessFactType = "canonical_lifecycle_event"` 且 `domainFactId = CanonicalEvent.id`。两者都引用真实不可变记录，不伪造 UUID，也不靠 `containerId + eventCode` 猜事实。

**稳定键与哈希：**

- `businessFactType` 使用命令中的两种受控值；`NodeEventApplication` 只说明该事实已作用到哪个目标节点。
- `businessFactKey = lifecycle-node-application/{canonicalEventId}/{nodeInstanceId}`。
- 每张匹配工单分别用 `workOrderId + businessFactKey` 幂等。
- `requestHash` 只覆盖规范化后的业务语义：tenant/container/flow/node instance/node code/event id/event code/domain fact/occurredAt/captureSource/排序去重后的 evidenceRefs；不把 traceId、receivedAt 或重试次数放进哈希。
- 同键同哈希返回原 `applied | rejected | no_op` 决定；同键异哈希返回 `IDEMPOTENCY_CONFLICT`。

- [x] **Step 1: 先写纯领域失败测试**

覆盖：

1. `ready | in_progress | blocked | reopened -> completed` 仍使用 `decideWorkOrderCompletion`。
2. `completed` 返回 `no_op`，不重复形成 Outcome。
3. `draft | failed | cancelled` 明确拒绝，绝不批量改成 completed。
4. cancelled NodeTask 不因迟到 lifecycle fact 复活。
5. required/conditional-required 全部完成才聚合 NodeTask；optional 不阻断；required failed/cancelled 仍为 blocked。
6. Outcome 只在 NodeTask 首次进入 completed 时产生，并携带 `evaluatedFactRefs`、`canonicalEventId`、`domainFactId`、`traceId`。
7. 业务键/哈希与 evidenceRefs 输入顺序无关。

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/domain/work-order-fact-application.test.ts src/modules/work-execution/domain/state-rules.test.ts src/modules/work-execution/domain/task-outcome.test.ts`

Expected: 新测试先 FAIL。

- [x] **Step 2: 实现纯规则和公开端口类型**

公开端口只接收稳定命令并返回：

```ts
type ReconcileDecision = "applied" | "rejected" | "no_op";

interface ReconcileAppliedLifecycleFactResult {
  nodeTaskId: string | null;
  factApplicationIds: string[];
  decision: ReconcileDecision;
  taskState: NodeTaskState | null;
  outcomeId: string | null;
  reasonCode: string | null;
}
```

不得提供 `setTaskCompleted`、`setWorkOrdersCompleted` 或通用 `setStatus` 方法。

- [x] **Step 3: 纯领域测试通过**

Run 同 Step 1。

Expected: PASS。

---

### Task 2: 落地 FactApplication、版本和因果审计

**Files:**

- Modify: `database/schema.prisma`
- Create: `database/migrations/<timestamp>_add_work_order_fact_application/migration.sql`
- Create: `scripts/verify-work-order-fact-application.mts`
- Modify: `package.json`
- Modify: `apps/api/src/modules/work-execution/domain/work-execution.repository.ts`

**Minimum physical parity with GC-005:**

1. `NodeTask` 增加 `tenantId`、`version`；租户与 container/flow/node scope 一起查询。
2. `WorkOrder` 增加 `version`、`applicability`；不得继续在聚合时把所有工单临时写死为 required。
3. 新增不可变 `WorkOrderFactApplication`，字段与既有 JSON Schema 一致，另保存 `canonicalEventId`、`nodeInstanceId` 作为可查询因果引用。
4. 唯一键至少为 `workOrderId + businessFactKey`；`requestHash` 使用 sha256 hex check。
5. `NodeTaskOutcome` 补 `evaluatedFactRefs`、`canonicalEventId`、`domainFactId`、`actorOrServiceId`、`traceId`。已有结果采用可解释默认/nullable 回填，不伪造业务事实。
6. 复用现有 `OutboxMessage` 保存逐 `canonicalEventId + nodeInstanceId` 的 reconciliation 消息；不在 `NodeEventApplication` 复制 retry/lease/dead-letter 状态机。迁移为既有 `applied` 节点应用补建未发布的专用 Outbox，确保历史滞留任务也可重放。

- [x] **Step 1: 写追加迁移**

迁移必须采用 expand → backfill → constrain：

- 从 `container_record.tenant_id` 回填既有 NodeTask 的 tenantId；无法唯一回填时迁移明确失败并给验证查询。
- 既有 WorkOrder `applicability` 按当前第一刀定义回填为 required，并在迁移说明中标明这是现状恢复，不是未来默认。
- version 从 0 开始。
- 不修改已共享的历史迁移。

- [x] **Step 2: 写迁移验证脚本**

验证：

- NodeTask 无空 tenantId，且与对应 ContainerRecord 租户一致。
- 没有重复 `work_order_id + business_fact_key`。
- FactApplication 决定、状态、哈希和时间字段满足约束。
- NodeTaskOutcome 旧行可读，新行能保存完整因果。
- 每条既有 `NodeEventApplication(applied)` 都有且只有一条可重放 reconciliation Outbox。

- [x] **Step 3: Prisma 校验与空库/旧库升级**

Run:

```bash
pnpm exec prisma validate --schema database/schema.prisma
pnpm db:generate
pnpm db:migrate
pnpm db:verify:work-order-fact-application
```

Expected: 空库升级和含既有任务数据的升级均通过；若仓库没有独立旧库 fixture，任务 brief 必须记录如何构造旧版本快照，不得只跑 `prisma validate` 代替迁移验证。

---

### Task 3: 实现 work-execution 原子事实对账

**Files:**

- Create: `apps/api/src/modules/work-execution/application/reconcile-applied-lifecycle-fact.service.ts`
- Create: `apps/api/src/modules/work-execution/application/reconcile-applied-lifecycle-fact.service.test.ts`
- Modify: `apps/api/src/modules/work-execution/domain/work-execution.repository.ts`
- Modify: `apps/api/src/modules/work-execution/infrastructure/prisma-work-execution.repository.ts`
- Create: `apps/api/src/modules/work-execution/infrastructure/prisma-work-execution.repository.integration.test.ts`
- Modify: `apps/api/src/modules/work-execution/work-execution.module.ts`
- Modify: `apps/api/src/modules/work-execution/index.ts`
- Modify: `apps/api/src/modules/work-execution/module.manifest.ts`

**Transaction:**

```text
按 tenantId + containerId + flowInstanceId + nodeInstanceId + nodeCode 找唯一 NodeTask
-> 校验 canonical event / domain fact 的对象因果范围
-> 按任务定义解析接受该 fact 的适用 WorkOrder，并检查 workOrderId + businessFactKey
-> 同键同哈希返回旧决定；同键异哈希冲突
-> expectedVersion 条件更新 WorkOrder
-> 写不可变 WorkOrderFactApplication
-> 用真实 applicability 确定性聚合 NodeTask
-> expectedVersion 条件更新 NodeTask
-> 首次 completed 时写 NodeTaskOutcome/审计
-> 提交
```

- [x] **Step 1: 写 Application 失败测试**

至少覆盖：

1. tenant/container/flow/node 任一不匹配均为 `AUTHORIZATION_SCOPE_DENIED` 或 `FACT_CAUSATION_MISMATCH`。
2. 找不到任务返回可重放的 `no_op/TASK_NOT_INITIALIZED`，不伪造任务；任务创建用例后续会按同一 business fact 重放。
3. 一张 required 工单从 ready 完成，NodeTask 聚合完成并写 Outcome。
4. 多 required 只匹配一张时其余未完成，NodeTask 保持 in_progress。
5. optional 未完成不阻断。
6. draft/failed/cancelled 工单和 cancelled NodeTask 均不误完成，并留下 rejected 决定与 reasonCode。
7. completed 工单重放返回 no_op，不重复 Outcome。
8. 同键同载荷返回原应用；同键异载荷 409。
9. 任何一步失败，FactApplication、WorkOrder、NodeTask、Outcome 全部回滚。
10. 一期现有实例只有一张 `required` 工单；仅当它的定义键与节点任务定义一致时才接受事实。出现多工单、零工单或定义不明时返回 `WORK_ORDER_DEFINITION_UNRESOLVED`，不得猜测或批量完成。后续多工单必须由版本化 `acceptedFactTypes/completionPredicates` 决定匹配范围。

- [x] **Step 2: 实现服务与 Repository 事务**

业务判断留在 Domain/Application；Repository 只执行显式决定和条件写。禁止在 Prisma adapter 内用 `state != completed` 批量完成。

并发策略：

- WorkOrder/NodeTask 使用 version 条件更新。
- 条件更新 0 行时重读事实应用：已存在同哈希则返回原结果；异哈希冲突；否则返回 `CONCURRENCY_VERSION_CONFLICT`，由用例进行有上限的重新求值。
- 唯一键冲突不得吞掉，必须转为上述幂等/冲突结果。

- [x] **Step 3: 注册公开 Port**

- `work-execution.module.ts` 同时注册 service 和 `{ provide: RECONCILE_APPLIED_LIFECYCLE_FACT, useExisting: ... }`，并 export token。
- `index.ts` 只导出端口、命令和结果类型，不导出 repository/Prisma 内部实现。
- `module.manifest.ts.publicPorts` 登记 `RECONCILE_APPLIED_LIFECYCLE_FACT`。

- [x] **Step 4: 真实 Prisma 集成和并发测试**

测试必须连接迁移后的 PostgreSQL，不能只 mock Prisma：

1. 两个并发同键同载荷请求最终只有一条 FactApplication、一次状态迁移、一个 Outcome，两者得到等价结果。
2. 两个并发同键异载荷一方成功、一方 `IDEMPOTENCY_CONFLICT`。
3. 中途抛错整笔回滚。
4. required failed/cancelled/draft 不被 updateMany 越过。
5. 租户/容器/节点错配没有写入。
6. 已完成 lifecycle fact 在稍后创建任务后可重放完成。

Run:

```bash
pnpm --filter @logix/api test -- src/modules/work-execution
pnpm --filter @logix/api test:integration -- src/modules/work-execution/infrastructure/prisma-work-execution.repository.integration.test.ts
```

若 `test:integration` 尚未配置，本任务需先增加稳定脚本入口；不得把 mock repository 测试称为数据库集成测试。

---

### Task 4: 用现有 Outbox 可靠投递 lifecycle 事实对账

**Files:**

- Create: `apps/api/src/modules/lifecycle-control/domain/work-fact-reconciliation-outbox.ts`
- Create: `apps/api/src/modules/lifecycle-control/domain/work-fact-reconciliation-outbox.test.ts`
- Create: `apps/api/src/modules/lifecycle-control/infrastructure/work-execution-outbox-delivery.ts`
- Create: `apps/api/src/modules/lifecycle-control/infrastructure/work-execution-outbox-delivery.test.ts`
- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle.repository.ts`
- Modify: `apps/api/src/modules/lifecycle-control/infrastructure/prisma-lifecycle.repository.ts`
- Modify: `apps/api/src/modules/lifecycle-control/lifecycle-control.module.ts`
- Modify: `apps/api/src/modules/lifecycle-control/application/publish-outbox-batch.service.test.ts`

**Behavior:**

1. `applyEventToNode` 首次成功时，在同一 Prisma 事务写 `NodeEventApplication(applied)` 和一条逐目标节点的 reconciliation Outbox；事务任一步失败则两者都回滚。
2. 专用 Outbox 使用稳定 `eventType`、`payloadRef`、`payloadHash` 和 `idempotencyKey`，完整引用 tenant/container/flow/node/canonical event/domain fact；不复制业务载荷到不可校验字符串。
3. 现有 `PublishOutboxBatchService`、租约、退避、dead-letter 和 replay 机制保持唯一可靠投递实现。delivery adapter 只对专用事件调用 `RECONCILE_APPLIED_LIFECYCLE_FACT`，其他既有 canonical event 仍走原投递路径。
4. work-execution 暂时失败时抛出可分类错误，由既有 Outbox 进入 `retry_wait`；节点不回退。`TASK_NOT_INITIALIZED` 视为可重试，不把消息提前标 published。
5. 业务 rejected（如 task cancelled、required failed 或定义不明）使用稳定非重试错误码进入 dead-letter；人工重放沿用原 business fact key。
6. 迁移为历史 `NodeEventApplication(applied)` 补建专用 reconciliation Outbox。重复送达由 FactApplication 幂等兜底，绝不再次调用 `applyEventToNode`、激活下一节点或重写日期事实。

- [x] **Step 1: 写事务 Outbox 与投递失败测试**

覆盖：

- 节点应用与专用 Outbox 同事务提交，任一步失败全部回滚。
- delivery 从权威记录组装命令，带完整 tenant/container/flow/node/event/domainFact scope。
- 第一次对账抛错后既有 publisher 标记 retry_wait；再次 drain 成功并标 published。
- 已应用 FactApplication 的 Outbox 重放返回同一业务结果，不重复 Outcome。
- 对账失败不把 lifecycle 节点改回 active。
- 同一事件可逐目标节点应用时，每个 target node 都有独立 business fact key。
- 既有 canonical event 投递不被专用 adapter 吞掉或改义。
- 历史 applied 节点应用的迁移回填无重复、可再次运行验证查询。

- [x] **Step 2: 接线并补 Nest 装配测试**

`LifecycleControlModule` 注册组合 delivery adapter 并注入 `RECONCILE_APPLIED_LIFECYCLE_FACT`；`WorkExecutionModule` 必须实际 export 该 token。补模块编译测试，防止漏 provider/export 或形成新的内部路径依赖。

- [x] **Step 3: 专项验证**

Run:

```bash
pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/work-fact-reconciliation-outbox.test.ts src/modules/lifecycle-control/infrastructure/work-execution-outbox-delivery.test.ts src/modules/lifecycle-control/application/publish-outbox-batch.service.test.ts
pnpm repo:check
```

Expected: 原子建 Outbox、既有重试/死信/重放、历史补偿与 DI 装配全部通过。

---

### Task 5: 任务条件的"事实→节点"改用规范事件权威映射

**Files:**

- Modify: `apps/api/src/modules/work-execution/domain/task-condition-fact.ts`
- Modify: `apps/api/src/modules/work-execution/domain/task-conditions.ts`
- Modify: `apps/api/src/modules/work-execution/domain/task-conditions.test.ts`
- Modify: `apps/api/src/modules/shipment-registry/domain/container-task-fact.ts`
- Modify: `apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.ts:74-103`
- Create: `apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.test.ts`

**Interfaces:**

- Consumes: `packages/contracts/catalogs/v1/canonical-events.json`（经 `@logix/contracts/canonical-events.json` 导入）、`ShipmentTimeFact.eventCode`
- Produces: `TaskConditionFact.eventCode: string | null`、`TaskConditionFact.nodeCode: LifecycleNodeCode | null`；`evaluateTaskConditions` 优先按 `nodeCode` 匹配，且仅 `eventCode === null` 时允许旧事实码兜底

- [x] **Step 1: 写失败测试**

在 `apps/api/src/modules/work-execution/domain/task-conditions.test.ts` 的 `facts` 数组里给两条 fixture 各加 `eventCode` 和 `nodeCode`，新增以下新旧路径测试，并补显式节点冲突、未知 `factCode`、未知 `eventCode` 不得回退三个边界：

```ts
it("事实自带节点时按节点匹配，无需影子表", () => {
  expect(
    evaluateTaskConditions({
      nodeCode: "container_unloading",
      isCurrent: false,
      facts: [
        {
          id: "fact-unload",
          factCode: "some_import_code",
          nodeCode: "container_unloading",
          timeKind: "actual" as const,
          captureSource: "controlled_import" as const,
          evidenceRef: "22222222-2222-4222-8222-222222222222",
        },
      ],
    }),
  ).toEqual({
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: ["fact-unload"],
  });
});

it("事实无节点时回退到既有影子表", () => {
  expect(
    evaluateTaskConditions({
      nodeCode: "customs_clearance",
      isCurrent: false,
      facts: [
        {
          id: "fact-legacy",
          factCode: "customs_clearance_completed",
          nodeCode: null,
          timeKind: "actual" as const,
          captureSource: "controlled_import" as const,
          evidenceRef: "33333333-3333-4333-8333-333333333333",
        },
      ],
    }),
  ).toEqual({
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: ["fact-legacy"],
  });
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/domain/task-conditions.test.ts`
Expected: FAIL —— `nodeCode` 不是已知属性 / 第一条断言拿到 `waiting_conditions`

- [x] **Step 3: 给事实类型加字段**

`apps/api/src/modules/work-execution/domain/task-condition-fact.ts` 全文改为：

```ts
import type { LifecycleNodeCode } from "@logix/contracts";

export interface TaskConditionFact {
  id: string;
  factCode: string;
  eventCode: string | null;
  nodeCode: LifecycleNodeCode | null;
  timeKind: "actual" | "estimated";
  captureSource: string;
  evidenceRef: string | null;
}
```

同样地，给 `apps/api/src/modules/shipment-registry/domain/container-task-fact.ts` 的 `ContainerTaskFact` 加 `eventCode: string | null` 和 `nodeCode: LifecycleNodeCode | null`（字段与上表一致）。

- [x] **Step 4: 改判定逻辑**

`apps/api/src/modules/work-execution/domain/task-conditions.ts` 全文改为：

```ts
import type {
  LifecycleNodeCode,
  TaskCompletionEligibility,
  TaskReadinessState,
} from "@logix/contracts";
import type { TaskConditionFact } from "./task-condition-fact";

// 兜底映射：仅用于 ShipmentTimeFact.eventCode 为空的事实（如 system_derived）。
// 权威路径是 fact.nodeCode，由 ShipmentTimeFact.eventCode 经 canonical-events 解析而来。
const FACT_TARGET_NODE: Readonly<Record<string, LifecycleNodeCode>> = {
  customs_clearance_completed: "customs_clearance",
  container_unloading_completed: "container_unloading",
  container_empty_confirmed: "empty_return",
  container_empty_estimated: "empty_return",
};

export interface TaskConditionDecision {
  readinessState: TaskReadinessState;
  completionEligibility: TaskCompletionEligibility;
  conditionFactRefs: string[];
}

function targetsNode(
  fact: TaskConditionFact,
  nodeCode: LifecycleNodeCode,
): boolean {
  if (fact.nodeCode) return fact.nodeCode === nodeCode;
  if (fact.eventCode !== null) return false;
  return FACT_TARGET_NODE[fact.factCode] === nodeCode;
}

export function evaluateTaskConditions(input: {
  nodeCode: LifecycleNodeCode;
  isCurrent: boolean;
  facts: readonly TaskConditionFact[];
}): TaskConditionDecision {
  const matched = input.facts.filter((fact) =>
    targetsNode(fact, input.nodeCode),
  );
  const completionFact = matched.some(
    (fact) =>
      fact.timeKind === "actual" &&
      fact.captureSource !== "system_derived" &&
      Boolean(fact.evidenceRef),
  );
  return {
    readinessState:
      input.isCurrent || matched.length > 0 ? "ready" : "waiting_conditions",
    completionEligibility: completionFact ? "eligible" : "awaiting_evidence",
    conditionFactRefs: matched.map((fact) => fact.id),
  };
}
```

- [x] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/domain/task-conditions.test.ts`
Expected: PASS（4 条既有 + 5 条新增）

- [x] **Step 6: 查询侧填 nodeCode**

在 `apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.ts` 的 `listCurrentTaskFacts` 里：

1. 文件顶部加 `import canonicalEvents from "@logix/contracts/canonical-events.json";` 与 `import type { LifecycleNodeCode } from "@logix/contracts";`
2. 模块作用域（`listCurrentTaskFacts` 之外）加一张查表：

```ts
const EVENT_DEFAULT_NODE = new Map<string, LifecycleNodeCode>(
  canonicalEvents
    .filter((event) => Boolean(event.defaultNodeCode))
    .map((event) => [
      event.eventCode,
      event.defaultNodeCode as LifecycleNodeCode,
    ]),
);
```

3. `select` 里补 `eventCode: true`，并把 `map` 改为：

```ts
      .map((row) => ({
        id: row.id,
        factCode: row.factCode,
        eventCode: row.eventCode,
        nodeCode: row.eventCode
          ? (EVENT_DEFAULT_NODE.get(row.eventCode) ?? null)
          : null,
        timeKind: row.timeKind as "actual" | "estimated",
        captureSource: row.captureSource,
        evidenceRef: row.evidenceRef,
      }));
```

4. 新增 `prisma-container.repository.test.ts`，覆盖规范事件成功解析、未知事件和无默认节点事件均保持 `nodeCode: null`。

- [x] **Step 7: 全模块测试 + 提交**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/shipment-registry src/modules/lifecycle-control`
Expected: PASS

```bash
git add apps/api/src/modules/work-execution apps/api/src/modules/shipment-registry
git commit -m "feat(work-execution): 任务条件改用规范事件解析节点，影子表降为兜底"
```

---

### Task 6: 节点目录加 `completionMode`

**Files:**

- Modify: `packages/contracts/schemas/v1/common.schema.json`
- Modify: `packages/contracts/catalogs/v1/lifecycle-nodes.json`
- Modify: `packages/contracts/package.json`
- Modify: `scripts/generate-contracts.mjs`
- Modify: `scripts/validate-contract-schemas.mjs`
- Modify: `packages/contracts/generated/contracts.d.ts`（由脚本生成）
- Create: `packages/contracts/lifecycle-nodes-json.d.ts`（由脚本生成）
- Create: `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.ts`
- Create: `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.test.ts`

**Interfaces:**

- Produces: `CompletionMode = "fact_driven" | "needs_manual_fact"`；`completionModeOf(nodeCode): CompletionMode`

- [x] **Step 1: 改目录**

`packages/contracts/catalogs/v1/lifecycle-nodes.json` —— 给 **14 个**节点对象各加一个字段，值一律为 `"fact_driven"`。前两项示例（其余 12 项同样处理，保持既有键序 `sequence` / `nodeCode` / `applicability` / `completionMode`）：

```json
  {
    "sequence": 1,
    "nodeCode": "cargo_ready",
    "applicability": "required",
    "completionMode": "fact_driven"
  },
```

- [x] **Step 2: 重新生成契约**

Run: `pnpm contract:generate`
Expected: 脚本成功；`contracts.d.ts` 出现 `CompletionMode`，并生成可公开导入的 `lifecycle-nodes-json.d.ts`

Run: `pnpm contract:drift`
Expected: 通过（无 drift）

- [x] **Step 3: 写失败测试**

新建 `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.test.ts`：

```ts
import type { LifecycleNodeCode } from "@logix/contracts";
import lifecycleNodes from "@logix/contracts/lifecycle-nodes.json";
import { describe, expect, it } from "vitest";
import { completionModeOf } from "./node-completion-mode";

describe("completionModeOf", () => {
  it("14 站全部读取目录中的明确完成模式", () => {
    expect(lifecycleNodes).toHaveLength(14);
    for (const node of lifecycleNodes) {
      expect(completionModeOf(node.nodeCode)).toBe(node.completionMode);
    }
  });

  it("目录外节点明确失败，不使用静默默认值", () => {
    expect(() => completionModeOf("unknown" as LifecycleNodeCode)).toThrow(
      "LIFECYCLE_NODE_COMPLETION_MODE_UNDEFINED:unknown",
    );
  });
});
```

- [x] **Step 4: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/node-completion-mode.test.ts`
Expected: FAIL —— 找不到模块 `./node-completion-mode`

- [x] **Step 5: 实现读取**

新建 `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.ts`：

```ts
import type { CompletionMode, LifecycleNodeCode } from "@logix/contracts";
import lifecycleNodes from "@logix/contracts/lifecycle-nodes.json";

// 权威：packages/contracts/catalogs/v1/lifecycle-nodes.json 的 completionMode。
const MODE_BY_NODE = new Map<LifecycleNodeCode, CompletionMode>();

for (const node of lifecycleNodes) {
  if (MODE_BY_NODE.has(node.nodeCode)) {
    throw new Error(
      `LIFECYCLE_NODE_COMPLETION_MODE_DUPLICATE:${node.nodeCode}`,
    );
  }
  MODE_BY_NODE.set(node.nodeCode, node.completionMode);
}

export function completionModeOf(nodeCode: LifecycleNodeCode): CompletionMode {
  const mode = MODE_BY_NODE.get(nodeCode);
  if (!mode) {
    throw new Error(`LIFECYCLE_NODE_COMPLETION_MODE_UNDEFINED:${nodeCode}`);
  }
  return mode;
}
```

- [x] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/node-completion-mode.test.ts`
Expected: PASS

- [x] **Step 7: 提交**

```bash
git add packages/contracts apps/api/src/modules/lifecycle-control
git commit -m "feat(contracts): 节点目录新增 completionMode，默认事实驱动"
```

---

### Task 7: 时间事实聚合投影（三轨数据源）

**Files:**

- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle-date-fact.repository.ts`
- Modify: `apps/api/src/modules/lifecycle-control/infrastructure/prisma-lifecycle-date-fact.repository.ts`
- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.ts`
- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts`（若无则新建）
- Modify: `apps/api/src/modules/lifecycle-control/application/list-lifecycle-nodes.service.ts`
- Modify: `apps/api/src/modules/lifecycle-control/application/list-container-lifecycle-nodes.service.ts`
- Modify: `apps/api/src/modules/lifecycle-control/presentation/lifecycle-nodes.controller.ts`
- Modify: `apps/api/src/modules/lifecycle-control/presentation/lifecycle.dto.ts`
- Modify: `apps/api/src/modules/lifecycle-control/presentation/lifecycle-nodes-batch.controller.ts`

**Interfaces:**

- Consumes: `LifecycleDateFactProjectionRecord[]`（含 `containerId / nodeCode / eventCode / timeKind / occurredAt / verificationState / confidenceState / validity / authorityPolicyRef / applicationState`）
- Produces: `LifecycleNodeTimeTrack { plannedAt: Date | null; estimatedAt: Date | null; actualAt: Date | null }`；`LifecycleNodeProjection` 上新增 `times: LifecycleNodeTimeTrack`

> 2026-09-21 实施裁决：三轨是“节点完成摘要轨”，只消费公共事件目录中对该节点 `completionEligible` 的当前有效事实，按 `completionEligibleNodeCodes` 投影全部完成目标，不把事实默认 `nodeCode` 误当唯一目标；子里程碑不进入摘要。actual 还须 `verified + confirmed + effective`、命中来源权威策略，并已进入 `pending_application | applied | rejected`；`review_required` 不得展示为权威 actual。同一节点同一轨若仍有多个完成候选，V1 返回 `null`，不按数据库顺序、最早或最晚时间猜测；后续明细投影须显式返回歧义及候选。单柜和批量接口共用一次批量查询，不设会静默截断事实的固定 `take`。

- [x] **Step 1: 写失败测试**

在 `apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts` 加（若文件不存在则新建，`FlowWithNodes` fixture 用现有测试里的写法造）：

```ts
it("三轨槽位常驻，无事实时显式留空", () => {
  const view = projectLifecycleNodes(
    flowWith({ nodeCode: "cargo_ready", state: "active" }),
    {
      facts: [],
    },
  );
  expect(view.nodes[0]?.times).toEqual({
    plannedAt: null,
    estimatedAt: null,
    actualAt: null,
  });
});

it("同一节点的三种时间各归各轨", () => {
  const occurredAt = new Date("2026-09-21T00:00:00.000Z");
  const view = projectLifecycleNodes(
    flowWith({ nodeCode: "cargo_ready", state: "completed" }),
    {
      facts: [
        fact("cargo_ready", "planned", occurredAt),
        fact("cargo_ready", "estimated", occurredAt),
        fact("cargo_ready", "actual", occurredAt),
      ],
    },
  );
  expect(view.nodes[0]?.times).toEqual({
    plannedAt: occurredAt,
    estimatedAt: occurredAt,
    actualAt: occurredAt,
  });
});

it("不适用节点与留空是两种呈现", () => {
  const view = projectLifecycleNodes(
    flowWith({
      nodeCode: "transshipment",
      state: "pending",
      applicability: "optional_not_applicable",
    }),
    { facts: [] },
  );
  expect(view.nodes[0]?.applicability).toBe("optional_not_applicable");
  expect(view.nodes[0]?.times.actualAt).toBeNull();
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts`
Expected: FAIL —— `projectLifecycleNodes` 只接受 1 个参数 / `times` 不存在

- [x] **Step 3: 改投影为纯函数（新增第二参数）**

`apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.ts` —— 在 `LifecycleNodeProjection` 上加：

```ts
export interface LifecycleNodeTimeTrack {
  plannedAt: Date | null;
  estimatedAt: Date | null;
  actualAt: Date | null;
}
```

并在接口里加一行 `times: LifecycleNodeTimeTrack;`。把函数签名改为：

```ts
export interface LifecycleNodeFactsInput {
  facts: readonly LifecycleNodeTimeFact[];
}

export function projectLifecycleNodes(
  flow: FlowWithNodes | null,
  input: LifecycleNodeFactsInput = { facts: [] },
): LifecycleNodesView {
```

在 `map` 之前按 `nodeCode + timeKind` 归拢通过上述资格判定的完成事实。每槽恰有一个候选才赋值；零个或多个候选都保持 `null`，不得依赖查询顺序选择。

在 `map` 的返回对象里加：

```ts
      times: timesByNode.get(node.nodeCode) ?? {
        plannedAt: null,
        estimatedAt: null,
        actualAt: null,
      },
```

- [x] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts`
Expected: PASS

- [x] **Step 5: 仓储端口暴露“列当前事实”**

仓储实现 `listCurrentForNodeProjection({ tenantId, containerIds })`，一次返回单柜或批量货柜的全部 current 候选，并携带 `eventCode / verificationState / confidenceState / validity / authorityPolicyRef / applicationState`。查询不设固定 `take`，避免合法航段或候选被静默截断。

- [x] **Step 6: 服务接线**

`apps/api/src/modules/lifecycle-control/application/list-lifecycle-nodes.service.ts`：构造函数加

```ts
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly dateFacts: LifecycleDateFactRepository,
```

单柜服务与批量服务都注入日期事实仓储。批量端点对全部 `containerIds` 只查一次，再按 `containerId` 分组交给纯投影。

- [x] **Step 7: DTO 透出**

`lifecycle.dto.ts` 的 `LifecycleNodeItemDto` 加：

```ts
  @ApiProperty({
    description: "三轨时间；无数据时为 null，不得用假值填充",
  })
  times!: {
    plannedAt: string | null;
    estimatedAt: string | null;
    actualAt: string | null;
  };
```

`lifecycle-nodes.controller.ts` 与 `lifecycle-nodes-batch.controller.ts` 的映射里各加：

```ts
        times: {
          plannedAt: node.times.plannedAt?.toISOString() ?? null,
          estimatedAt: node.times.estimatedAt?.toISOString() ?? null,
          actualAt: node.times.actualAt?.toISOString() ?? null,
        },
```

- [x] **Step 8: 全模块测试 + 提交**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control`
Expected: PASS

```bash
git add apps/api/src/modules/lifecycle-control
git commit -m "feat(lifecycle): 节点投影补三轨时间，无数据显式留空"
```

---

### Task 8: 前端类型与视图模型带上三轨与异常

**Files:**

- Modify: `apps/web/src/api/lifecycleNodes.ts`
- Modify: `apps/web/src/data/liveNodeProjection.ts`
- Modify: `apps/web/src/data/liveNodeProjection.test.ts`（若无则新建）

**Interfaces:**

- Consumes: Task 7 的 DTO 形状
- Produces: `LiveNodeView.times` / `LiveNodeView.blockedCount` / `LiveNodeView.isNotApplicable`

- [x] **Step 1: 写失败测试**

新建或追加 `apps/web/src/data/liveNodeProjection.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { toLiveNode } from "./liveNodeProjection";

const base = {
  nodeInstanceId: "n1",
  nodeCode: "cargo_ready",
  sequence: 1,
  state: "active",
  applicability: "required",
  completedAt: null,
  blockedReasonRefs: [],
  isCurrent: true,
  times: { plannedAt: null, estimatedAt: null, actualAt: null },
};

describe("toLiveNode", () => {
  it("三轨无数据时保持 null，不用占位值", () => {
    const view = toLiveNode(base);
    expect(view.times).toEqual({
      plannedAt: null,
      estimatedAt: null,
      actualAt: null,
    });
  });

  it("未关闭阻塞计数来自 blockedReasonRefs", () => {
    expect(
      toLiveNode({ ...base, blockedReasonRefs: ["b1", "b2"] }).blockedCount,
    ).toBe(2);
  });

  it("optional_not_applicable 标为不适用，与留空区分", () => {
    const view = toLiveNode({
      ...base,
      applicability: "optional_not_applicable",
    });
    expect(view.isNotApplicable).toBe(true);
    expect(view.times.actualAt).toBeNull();
  });
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/data/liveNodeProjection.test.ts`
Expected: FAIL —— `blockedReasonRefs` / `times` 不在 `LifecycleNodeItem` 上

- [x] **Step 3: 扩前端 DTO**

`apps/web/src/api/lifecycleNodes.ts` 的 `LifecycleNodeItem` 改为：

```ts
export interface LifecycleNodeTimes {
  plannedAt: string | null;
  estimatedAt: string | null;
  actualAt: string | null;
}

export interface LifecycleNodeItem {
  nodeInstanceId: string;
  nodeCode: string;
  sequence: number;
  state: string;
  applicability: string;
  completedAt: string | null;
  blockedReasonRefs: string[];
  isCurrent: boolean;
  times: LifecycleNodeTimes;
}
```

- [x] **Step 4: 扩视图模型**

`apps/web/src/data/liveNodeProjection.ts` 改为：

```ts
import type {
  LifecycleNodeItem,
  LifecycleNodeTimes,
} from "../api/lifecycleNodes";
import { nodeScreenName } from "./uiCopyCatalog";

export interface LiveNodeView {
  nodeInstanceId: string;
  nodeCode: string;
  sequence: number;
  name: string;
  stateLabel: string;
  completedAt: string | null;
  isCurrent: boolean;
  isNotApplicable: boolean;
  blockedCount: number;
  times: LifecycleNodeTimes;
}

const NODE_STATE_LABELS: Record<string, string> = {
  pending: "未开始",
  active: "进行中",
  completed: "已完成",
};

export function toLiveNode(item: LifecycleNodeItem): LiveNodeView {
  const notApplicable = item.applicability === "optional_not_applicable";
  return {
    nodeInstanceId: item.nodeInstanceId,
    nodeCode: item.nodeCode,
    sequence: item.sequence,
    name: nodeScreenName(item.nodeCode),
    stateLabel: notApplicable
      ? "不适用"
      : (NODE_STATE_LABELS[item.state] ?? item.state),
    completedAt: item.completedAt,
    isCurrent: item.isCurrent,
    isNotApplicable: notApplicable,
    blockedCount: item.blockedReasonRefs.length,
    times: item.times,
  };
}
```

> 实施裁决：Task 7 已将 `blockedReasonRefs` 与 `times` 定义为响应必填字段。前端不为缺失字段静默补零或空三轨，避免把契约漂移伪装成真实业务空值。

- [x] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/data/liveNodeProjection.test.ts`
Expected: PASS

- [x] **Step 6: 提交**

```bash
git add apps/web/src/api/lifecycleNodes.ts apps/web/src/data/liveNodeProjection.ts apps/web/src/data/liveNodeProjection.test.ts
git commit -m "feat(web): 节点视图模型补三轨时间与未关闭阻塞计数"
```

---

### Task 9: 轨道改成水平主轴，铺满 14 站

**Files:**

- Rewrite: `apps/web/src/components/container/LiveNodeRail.vue`
- Create: `apps/web/src/components/container/LiveNodeRail.test.ts`

**Interfaces:**

- Consumes: `LiveNodeView`（Task 8）
- Produces: `LiveNodeRail` 组件；`emits: select: [nodeInstanceId: string]`

- [x] **Step 1: 写失败测试**

新建 `apps/web/src/components/container/LiveNodeRail.test.ts`：

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LiveNodeRail from "./LiveNodeRail.vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

function node(overrides: Partial<LiveNodeView>): LiveNodeView {
  return {
    nodeInstanceId: "n",
    nodeCode: "cargo_ready",
    sequence: 1,
    name: "备货",
    stateLabel: "未开始",
    completedAt: null,
    isCurrent: false,
    isNotApplicable: false,
    blockedCount: 0,
    times: { plannedAt: null, estimatedAt: null, actualAt: null },
    ...overrides,
  };
}

describe("LiveNodeRail", () => {
  it("每站显示摘要日期，无数据写 —", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        nodes: [
          node({
            nodeInstanceId: "n1",
            completedAt: "2026-09-19T00:00:00.000Z",
          }),
          node({
            nodeInstanceId: "n2",
            nodeCode: "container_stuffing",
            sequence: 2,
            name: "装箱",
          }),
        ],
      },
    });
    const cells = wrapper.findAll('[data-testid="rail-node"]');
    expect(cells).toHaveLength(2);
    expect(cells[0]?.text()).toContain("09-19");
    expect(cells[1]?.text()).toContain("—");
  });

  it("不适用节点写不适用，不写成留空", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        nodes: [
          node({
            nodeInstanceId: "n1",
            name: "中转",
            isNotApplicable: true,
            stateLabel: "不适用",
          }),
        ],
      },
    });
    expect(wrapper.text()).toContain("不适用");
  });

  it("点击节点抛出选择事件", async () => {
    const wrapper = mount(LiveNodeRail, {
      props: { nodes: [node({ nodeInstanceId: "n7" })] },
    });
    await wrapper.get('[data-testid="rail-node"]').trigger("click");
    expect(wrapper.emitted("select")).toEqual([["n7"]]);
  });
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/components/container/LiveNodeRail.test.ts`
Expected: FAIL —— 没有 `data-testid="rail-node"`，且无 `select` 事件

- [x] **Step 3: 重写组件**

`apps/web/src/components/container/LiveNodeRail.vue`（script + template 部分）：

```vue
<script setup lang="ts">
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  nodes: readonly LiveNodeView[];
}>();

const emit = defineEmits<{
  select: [nodeInstanceId: string];
}>();

// 摘要层只显示一个日期：实际 > 预计 > 计划 > 完成时间；四者皆无则写 —（不得用假值）。
// completedAt 作为最后兜底：老数据的节点可能有完成时间却没有对应的 actual 事实。
function summaryDate(node: LiveNodeView): string {
  const value =
    node.times.actualAt ??
    node.times.estimatedAt ??
    node.times.plannedAt ??
    node.completedAt;
  if (!value) return "—";
  return value.slice(5, 10);
}

function tone(node: LiveNodeView): string {
  if (node.isNotApplicable) return "na";
  if (node.completedAt) return "done";
  if (node.isCurrent) return "cur";
  return "";
}
</script>

<template>
  <nav class="rail" aria-label="货柜节点">
    <ol class="rail-track">
      <li
        v-for="node in nodes"
        :key="node.nodeInstanceId"
        data-testid="rail-node"
        class="rail-node"
        :class="[tone(node), { blocked: node.blockedCount > 0 }]"
        @click="emit('select', node.nodeInstanceId)"
      >
        <span class="line" aria-hidden="true" />
        <span class="dot" aria-hidden="true" />
        <span class="copy">
          <b>{{ node.name }}</b>
          <span class="date">{{
            node.isNotApplicable ? "不适用" : summaryDate(node)
          }}</span>
          <span
            v-if="node.blockedCount > 0"
            class="blocked-mark"
            aria-hidden="true"
            >⚠</span
          >
        </span>
      </li>
    </ol>
  </nav>
</template>
```

样式（`<style scoped>` 部分，追加在 template 之后）：

```vue
<style scoped>
.rail {
  margin: 0 0 12px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  overflow-x: auto;
}

.rail-track {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 840px;
}

.rail-node {
  flex: 1;
  min-width: 0;
  position: relative;
  text-align: center;
  cursor: pointer;
  background: none;
  border: 0;
}

/* 贯穿横线：首尾各收一半，避免线段溢出轨道两端 */
.line {
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--line);
}

.rail-node:first-child .line {
  left: 50%;
}

.rail-node:last-child .line {
  right: 50%;
}

.dot {
  position: relative;
  z-index: 1;
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
}

/* 四态互不混同：已完成 / 当前 / 未发生 / 不适用 */
.rail-node.done .dot {
  border-color: var(--ok);
  background: var(--ok);
}

.rail-node.done .line {
  background: var(--ok);
}

.rail-node.cur .dot {
  width: 18px;
  height: 18px;
  border-width: 4px;
  border-color: var(--brand);
}

.rail-node.na .dot {
  border-style: dashed;
  background: transparent;
}

.rail-node.na .line {
  height: 0;
  border-top: 2px dashed var(--line);
  background: transparent;
}

.rail-node.blocked .dot {
  border-color: var(--risk);
}

.copy {
  display: block;
  margin-top: 7px;
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}

.copy b {
  display: block;
  color: var(--ink);
  font-size: 10.5px;
  font-weight: 600;
}

.rail-node.na .copy b,
.rail-node.na .date {
  color: var(--muted);
}

.date {
  font-variant-numeric: tabular-nums;
}

.blocked-mark {
  color: var(--risk);
  margin-left: 3px;
}
</style>
```

> 若 `--ok` 变量不存在，用仓库既有的语义色变量替代（`UI_SYSTEM §7.1` 的 `brand / ok / warn / risk / info` 五色）。**不要**在这里新造颜色。

- [x] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/components/container/LiveNodeRail.test.ts`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add apps/web/src/components/container/LiveNodeRail.vue apps/web/src/components/container/LiveNodeRail.test.ts
git commit -m "feat(web): 轨道改为水平主轴，铺满 14 站并显式留空"
```

---

### Task 10: 常驻的三轨展开卡

**Files:**

- Create: `apps/web/src/components/container/NodeTimeTrackCard.vue`
- Create: `apps/web/src/components/container/NodeTimeTrackCard.test.ts`

**Interfaces:**

- Consumes: `LiveNodeView`（Task 8）
- Produces: `NodeTimeTrackCard` 组件；props `{ node: LiveNodeView | null }`

- [ ] **Step 1: 写失败测试**

新建 `apps/web/src/components/container/NodeTimeTrackCard.test.ts`：

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import NodeTimeTrackCard from "./NodeTimeTrackCard.vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

const node: LiveNodeView = {
  nodeInstanceId: "n3",
  nodeCode: "shipment_dispatch",
  sequence: 3,
  name: "出运",
  stateLabel: "进行中",
  completedAt: null,
  isCurrent: true,
  isNotApplicable: false,
  blockedCount: 1,
  times: {
    plannedAt: "2026-09-22T00:00:00.000Z",
    estimatedAt: "2026-09-22T00:00:00.000Z",
    actualAt: null,
  },
};

describe("NodeTimeTrackCard", () => {
  it("三轨槽位常驻，实际为空时写 —", () => {
    const wrapper = mount(NodeTimeTrackCard, { props: { node } });
    expect(wrapper.text()).toContain("计划");
    expect(wrapper.text()).toContain("预计");
    expect(wrapper.text()).toContain("实际");
    expect(wrapper.text()).toContain("2026-09-22");
    expect(wrapper.text()).toContain("—");
  });

  it("三轨全空时仍然渲染三行，不是不渲染", () => {
    const wrapper = mount(NodeTimeTrackCard, {
      props: {
        node: {
          ...node,
          times: { plannedAt: null, estimatedAt: null, actualAt: null },
        },
      },
    });
    expect(wrapper.text()).toContain("计划");
    expect(wrapper.text()).toContain("预计");
    expect(wrapper.text()).toContain("实际");
  });

  it("无选中节点时给出人话空态", () => {
    const wrapper = mount(NodeTimeTrackCard, { props: { node: null } });
    expect(wrapper.text()).toContain("选择上方任一站点");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/components/container/NodeTimeTrackCard.test.ts`
Expected: FAIL —— 找不到模块

- [ ] **Step 3: 实现组件**

新建 `apps/web/src/components/container/NodeTimeTrackCard.vue`：

```vue
<script setup lang="ts">
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  node: LiveNodeView | null;
}>();

// 留空一律显示 —，不得用 0 或假日期冒充分已接通。
function show(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}
</script>

<template>
  <section class="track-card" aria-label="节点三轨时间">
    <p v-if="!node" class="empty">
      选择上方任一站点，查看它的计划 / 预计 / 实际时间。
    </p>
    <template v-else>
      <header>
        <b>{{ node.sequence.toString().padStart(2, "0") }} {{ node.name }}</b>
        <span>{{ node.stateLabel }}</span>
      </header>
      <dl class="tracks">
        <div>
          <dt>计划</dt>
          <dd :class="{ blank: !node.times.plannedAt }">
            {{ node.isNotApplicable ? "不适用" : show(node.times.plannedAt) }}
          </dd>
        </div>
        <div>
          <dt>预计</dt>
          <dd :class="{ blank: !node.times.estimatedAt }">
            {{ node.isNotApplicable ? "不适用" : show(node.times.estimatedAt) }}
          </dd>
        </div>
        <div>
          <dt>实际</dt>
          <dd :class="{ blank: !node.times.actualAt }">
            {{ node.isNotApplicable ? "不适用" : show(node.times.actualAt) }}
          </dd>
        </div>
      </dl>
      <p v-if="node.blockedCount > 0" class="blocked" role="alert">
        有 {{ node.blockedCount }} 项未关闭的阻塞
      </p>
    </template>
  </section>
</template>
```

样式用 `--surface` / `--line` / `--muted` / `--risk` 变量，`.blank` 用 `color: var(--muted)`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/components/container/NodeTimeTrackCard.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/container/NodeTimeTrackCard.vue apps/web/src/components/container/NodeTimeTrackCard.test.ts
git commit -m "feat(web): 新增常驻的节点三轨展开卡"
```

---

### Task 11: 一柜一档改成 L1 竖向堆叠

**Files:**

- Modify: `apps/web/src/views/MicroWorkbench.vue`
- Modify: `apps/web/src/views/MicroWorkbench.test.ts`

**Interfaces:**

- Consumes: `LiveNodeRail`（Task 9）、`NodeTimeTrackCard`（Task 10）
- Produces: 页面结构 = 柜头（含标记 / 异常槽位）→ 轨道 + 展开卡 → 下一步

- [ ] **Step 1: 写失败测试**

在 `apps/web/src/views/MicroWorkbench.test.ts` 加两条：

```ts
it("标记槽位常驻，无数据写 —", async () => {
  getContainer.mockResolvedValue({
    id: "c1",
    orderNumber: "SO-1",
    containerNumber: "MSKU1",
    currentStatus: "in_transit",
    updatedAt: "2026-09-13T03:00:00.000Z",
  });
  const wrapper = await mountPage("c1");
  expect(wrapper.text()).toContain("标记");
  expect(wrapper.text()).toContain("—");
});

it("有未关闭阻塞时异常槽位露出数量", async () => {
  getContainer.mockResolvedValue({
    id: "c1",
    orderNumber: "SO-1",
    containerNumber: "MSKU1",
    currentStatus: "in_transit",
    updatedAt: "2026-09-13T03:00:00.000Z",
  });
  listLifecycleNodes.mockResolvedValue({
    flow: {
      id: "f1",
      state: "active",
      currentNodeCode: "cargo_ready",
      version: 0,
    },
    nodes: [
      {
        nodeInstanceId: "n1",
        nodeCode: "cargo_ready",
        sequence: 1,
        state: "active",
        applicability: "required",
        completedAt: null,
        blockedReasonRefs: ["b1"],
        isCurrent: true,
        times: { plannedAt: null, estimatedAt: null, actualAt: null },
      },
    ],
    asOf: "2026-09-13T03:00:00.000Z",
    projectionVersion: 0,
  });
  const wrapper = await mountPage("c1");
  expect(wrapper.text()).toContain("异常");
  expect(wrapper.text()).toContain("1");
});
```

同时，`mountPage` 里既有的 `LiveNodeRail` stub 需要改成暴露 `nodes` 的写法（保持既有断言可过）；并给 `NodeTimeTrackCard` 加一个 stub：

```ts
        NodeTimeTrackCard: {
          props: ["node"],
          template: '<section aria-label="节点三轨时间" />',
        },
```

另外，既有 fixture `listLifecycleNodes.mockResolvedValue` 里的每个 node 都要补 `blockedReasonRefs: []` 与 `times: { plannedAt: null, estimatedAt: null, actualAt: null }`，否则类型不过。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/views/MicroWorkbench.test.ts`
Expected: FAIL —— 页面里没有"标记"槽位

- [ ] **Step 3: 改页面**

`apps/web/src/views/MicroWorkbench.vue` 的 `<template>` 里，`<PageHeader>` 之后改为：

```vue
<PageHeader title="一柜一档" />

<ObjectContextBar :record="record" />

<section class="slot-band" aria-label="标记与异常">
        <span><small>标记</small><b>—</b></span>
        <span>
          <small>异常</small>
          <b :class="{ risk: blockedTotal > 0 }">{{ blockedTotal > 0 ? blockedTotal : "—" }}</b>
        </span>
      </section>

<LiveNodeRail
  v-if="nodes.length"
  :nodes="nodes"
  @select="selectedNodeId = $event"
/>
<p v-else class="hint">{{ uiCopy.chrome.emptyFlow }}</p>

<NodeTimeTrackCard :node="selectedNode" />
```

`<script setup>` 里加：

```ts
import NodeTimeTrackCard from "../components/container/NodeTimeTrackCard.vue";

const selectedNodeId = ref("");
const blockedTotal = computed(() =>
  nodes.value.reduce((sum, node) => sum + node.blockedCount, 0),
);
// 默认展开当前站；当前站不存在时退回第一个。
const selectedNode = computed(
  () =>
    nodes.value.find((node) => node.nodeInstanceId === selectedNodeId.value) ??
    nodes.value.find((node) => node.isCurrent) ??
    nodes.value[0] ??
    null,
);
```

`load()` 里在 `nodes.value = ...` 之后加一行 `selectedNodeId.value = "";` 以重置选择。

**注意**：`标记槽位` 当前恒为 `—`，这是**有意的**——标记模型尚不存在（spec §7.1），槽位先立、数据后填。实施时不要为了"看起来有内容"而塞演示数据。

原有 `<section class="next-step">` 保留在最后；其中 `v-if="!nodes.length"` 那条空态提示已上移到轨道处，去重后只留事件为空与"去做这柜的任务"链接。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/views/MicroWorkbench.test.ts`
Expected: PASS（含全部既有用例）

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm --filter @logix/web validate`
Expected: lint / format / typecheck / test / e2e / build 全通过

```bash
git add apps/web/src/views/MicroWorkbench.vue apps/web/src/views/MicroWorkbench.test.ts
git commit -m "feat(web): 一柜一档改为竖向堆叠，补齐标记与异常槽位"
```

---

## 收尾校验

- [ ] `pnpm contract:drift` —— 契约无漂移
- [ ] `pnpm --filter @logix/api test` —— 后端全绿
- [ ] `pnpm --filter @logix/web validate` —— 前端全绿
- [ ] `pnpm validate`（仓库根，高风险切片门禁）—— 全绿
- [ ] 手工确认：找一个已过站的柜，打开 `/container/:id`，确认那一站的任务不再出现在 `/tasks`
- [ ] 手工确认：找一个刚建柜的柜，确认轨道**铺满 14 站**、三轨槽位全部在位且写作 `—`、中转/海铁显示"不适用"

## 已知不做（本计划范围外）

- **`标记` 的真实数据**：模型不存在（spec §7.1），槽位先立、留空。
- **缺口清单与"下一步"块**：二期。
- **`completionMode` 的判据**：字段已立于节点目录（Task 6），但一期没有生产者，`needs_manual_fact` 不会被写入（spec §7.3 已记录为预期）。
- **计划轨的数据**：全系统无 `planned` 事实生产者，该轨将长期留空（spec §7.2 已记录为预期）。
- **侧栏按组织分组**：D5 已决策，排在三期。
