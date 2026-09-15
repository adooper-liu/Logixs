---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/inland-plan-first-slice
verification:
---

# 任务：超期费用最晚提柜日 / 最晚还箱日

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

在 `charges-settlement` 按滞港费标准计算一柜的**最晚提柜日**和**最晚还箱日**。匹配键为港口 + 船司 + 货代；四种费用类型（滞港、存储、滞箱、D&D）分别算 LFD 后取最小。不算金额。`inland-fulfillment` 只经公开端口读取这两个日期。

## 权威入口

- [FEE_DEMURRAGE](../../product/domain/FEE_DEMURRAGE.md)（候选；本刀只落截止日，不落费率公式）
- [PRINCIPLES](../../product/PRINCIPLES.md) P4 / P8
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- 样板：`inland-fulfillment` 的 Controller → Use Case → Domain ← Adapter

## 边界 / 不做

- 不算阶梯费率、应计、账单；输出不得带金额。
- 不套系统默认免费天数；缺标准或未注册基准显式失败。
- 不写 lifecycle / 工单；计划引擎不得在本模块内复制计费公式。
- 工作日日历、暂停/豁免、按还箱约束的场外存储留后续；本刀 `business_days` 未注册。

## 验收

- [x] 港口+船司+货代命中多条费用时，最晚提柜日 / 最晚还箱日取各类型 LFD 的最小值。
- [x] 无命中标准 → `BUSINESS_PRECONDITION_FAILED`，不准默认 7 天。
- [x] D&D 同时约束提柜与还箱；滞箱用实际/计划提柜，否则用已算出的最晚提柜日。
- [x] `inland-fulfillment` 经公开端口只读两个日期，不在计划域算费。
- [x] `pnpm --filter @logix/api test -- src/modules/charges-settlement src/modules/inland-fulfillment` 与 typecheck 通过。

## 方案

标准表存免费天数、日历基准、起算、是否含首日、生效期。`POST /api/overdue-deadlines/compute` 计算。计划草稿调用 `COMPUTE_OVERDUE_DEADLINES` 后写入 `latestPickupAt` / `latestReturnAt`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段    | 负责 | commit | 说明                                              |
| ---------- | ------- | ---- | ------ | ------------------------------------------------- |
| 2026-09-14 | coding  | —    | —      | 开工超期截止日                                    |
| 2026-09-14 | coding  | —    | —      | 端口已接计划草稿只读两日期；测试与 typecheck 已过 |
| 2026-09-14 | coding  | —    | —      | 截止日核与计划核迁入 engines/；引擎互调门禁       |
| 2026-09-15 | blocked | —    | —      | 验收已勾；金额核另开 brief，本刀不算钱            |
