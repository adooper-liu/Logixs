---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/inland-plan-first-slice
verification:
---

# 任务：超期费用预计 / 应计金额第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

在 `charges-settlement` 用**同一台金额核**按阶梯逐日求和，输出预计或应计分项金额（定点十进制 + 币种）。免费期末日仍由截止日核给出；本核只吃「免费期末日 + asOf + 阶梯」。不算进账单，不推进主流程。

## 权威入口

- [FEE_DEMURRAGE](../../product/domain/FEE_DEMURRAGE.md)（候选；本刀只落预计/应计求值，不升格为正式契约）
- [PRINCIPLES](../../product/PRINCIPLES.md) P4 / P8
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- 样板：同模块 `overdue-deadlines` 的 Controller → Use Case → Engine ← Adapter

## 边界 / 不做

- 不和 LFD 合并；金额核不得 import 截止日核，截止日核输出仍不得带金额。
- 不写账单、审核、支付，不覆盖应计。
- 不准套系统默认日费率或免费天数；缺标准、缺阶梯、计费日无命中阶梯显式失败。
- 不接 inland 比价；计划域费用分项仍标 `review_required`。
- 暂停/豁免、工作日日历、跨币种汇率、税费留后续；本刀只注册自然日 + 两位小数金额。

## 验收

- [ ] 同一套阶梯、两套钟：`purpose=estimate` 与 `purpose=accrual` 公式相同，只标签不同。
- [ ] 按每个计费日命中的阶梯求和，分项列出，不合成一个「滞港费」。
- [ ] 免费期内 asOf → 金额 `0.00`；计费日无阶梯 → `BUSINESS_PRECONDITION_FAILED`。
- [ ] 截止日核与金额核互不 import；`inland-fulfillment` 不调用本端口。
- [ ] `pnpm --filter @logix/api test -- src/modules/charges-settlement src/modules/inland-fulfillment` 与 typecheck 通过。

## 方案

阶梯子表挂在现有超期标准上。`POST /api/overdue-accrual/compute`。用例先匹配标准、向截止日核取免费期末日，再把窗口和阶梯交给金额核。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明     |
| ---------- | ------ | ---- | ------ | -------- |
| 2026-09-15 | coding | —    | —      | 开工金额核第一刀 |
| 2026-09-15 | blocked | —    | —      | 作业壳人话先落；金额核代码留在同分支 |
