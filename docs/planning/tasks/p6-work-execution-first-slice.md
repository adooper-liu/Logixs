---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-12）：pnpm --filter @logix/api test -- src/modules/work-execution 20 项通过；typecheck / lint / repo:check 通过；迁移 20260912213000 与 20260912214000 已应用到 localhost:5433；HTTP 冒烟 POST /api/node-tasks → POST /api/work-orders/:id/complete → GET 得到 resultPolicy=none 结果快照，重放 applied=false，未知节点 400。未执行：完整 pnpm validate、前端、向 lifecycle-control 发规范事件。
---

# 任务：work-execution 第一刀（任务/工单状态机）

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准；同一时刻仅一个进行中任务。

## 目标

按 [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) 落地 `work-execution` 最小可写链路：为已有节点创建 `NodeTask` + 一张 required 工单，报工完成后按「全部 required 完成」聚合任务状态。工单完成不等于工序完成，更不等于主流程前进。

## 权威入口

- [AGENTS.md](../../../AGENTS.md)、[ENGINEERING_RULES.md](../../../ENGINEERING_RULES.md) §3
- [ADR-010](../../architecture/decisions/ADR-010-bounded-context-modules.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)（GC-005）
- 样板：`lifecycle-control` 的 Controller → Use Case → Port ← Adapter

## 边界 / 不做

- 不写 `FlowInstance` / 不调用 lifecycle-control / 不发布规范事件。
- 不做分派、Block、重开、取消、事实应用、Outbox、ClientOperation、租户版本全字段。
- 第一刀完成政策固定为 `all_required_completed`；每节点一张 required 工单。optional / conditional / 外部事实先到对账留后续刀。
- 不改前端 demo，不铺海关专业模块。

## 验收

- [x] 同 `nodeInstanceId` 重复创建返回已有任务，不复制工单。
- [x] 单张 required 工单完成后 NodeTask 为 `completed`。
- [x] 多张 required 只完成部分时 Domain 聚合为 `in_progress`。
- [x] 非法工单转换（如 `cancelled → completed`）拒绝；已完成重放不重复改写。
- [x] 模块不引用 lifecycle-control 内部路径，不推进货柜 8 态。
- [x] 任务首次完成后写入一条 `resultPolicy=none` 的结果快照；部分完成或重放不重复写。
- [x] `pnpm --filter @logix/api test` 与 `pnpm repo:check` 通过。

## 方案（design 阶段填写）

- 表 `node_task` / `work_order` 只存逻辑 ID，不建跨模块外键。`node_instance_id` 唯一，落实「一个节点实例最多一个当前任务」。
- Domain 持有工单转换与任务聚合；Application 编排事务与幂等；Repository 只持久化。
- HTTP：`POST /node-tasks`、`GET /node-tasks/:id`、`POST /work-orders/:id/complete`。
- 任务首次 `completed` 时同事务写入 `node_task_outcome`（`resultPolicy=none`）。这是本模块结果端口，不是规范事件，lifecycle-control 不会被调用。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先，每条对应文件/行号或 commit）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明                                         |
| ---------- | ------ | ---- | ------ | -------------------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：补 work-execution 第一刀               |
| 2026-09-12 | coding | —    | —      | 补任务结果快照端口，仍不写主流程             |
| 2026-09-12 | done   | —    | —      | 20 项单测 + HTTP 冒烟通过；未跑完整 validate |
