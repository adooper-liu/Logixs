---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/inland-plan-first-slice
verification:
---

# 任务：内陆四节点计划第一刀（起草）

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

在 `inland-fulfillment` 公开计划端口上，按租户配置起草一柜的提/送/卸/还计划（含可选倒推清关必完日）。限额、缓冲、策略码全部从表读；缺配置或未注册策略码显式失败，不准套源码默认。

## 权威入口

- [INLAND_FOUR_NODE_PLANNING_ENGINE.md](../INLAND_FOUR_NODE_PLANNING_ENGINE.md)（候选规划，本刀实现其第一刀范围）
- [RESOURCE_CONSTRAINT_DECOMPOSITION.md](../RESOURCE_CONSTRAINT_DECOMPOSITION.md)
- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)
- 样板：`work-execution` 的 Controller → Use Case → Domain ← Adapter

## 边界 / 不做

- 不写 lifecycle-control / work-execution 状态；计划不能完成节点。
- 不直连飞驼；不把请求时刻写成飞驼实际。时刻由调用方作为时间线已读结果传入。
- 不算合同费率；最晚提柜/还箱日经 `charges-settlement` 公开端口只读，计划域不算钱。费用分项仍标 `review_required`。
- 不做前端、不自动改期/改目的地、不自动选最便宜的路。
- 不新建微服务。能力表本刀由 inland-fulfillment 读写，不复制到流程模块。
- 占用仅当占用时机策略登记为会在草稿扣名额的码；本刀实现 `confirm_before_occupy`（不扣）以及注册表拒绝未登记码。

## 验收

- [ ] 缺参数或策略、策略码未注册 → `BUSINESS_PRECONDITION_FAILED`，不静默默认。
- [ ] 参考日、清关与排程、内陆顺序、拖车时间、清关缓冲均来自配置；`warehouse_unload_first` 下仓有位且车队有趟则直送仓。
- [ ] 仓满且车队有余力且声明缓冲 → 方案为比价建议，不自动选路。
- [ ] 车队无余力 → 不算路 B。
- [ ] 草稿不推进货柜节点；`pnpm --filter @logix/api test -- src/modules/inland-fulfillment` 与 typecheck 通过。

## 方案

`POST /api/inland-plans/draft`。Domain 查注册表求值。配置与能力、占用、计划版本落表。取消与确认占名额留后续刀。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段    | 负责 | commit | 说明                                       |
| ---------- | ------- | ---- | ------ | ------------------------------------------ |
| 2026-09-14 | coding  | —    | —      | 开工起草第一刀                             |
| 2026-09-15 | blocked | —    | —      | 占用核 occupancy-slot 已拆；计划核只吃余量 |
