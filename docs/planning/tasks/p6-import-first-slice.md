---
status: design # design | coding | review | fix | blocked | done（机器可校验）
branch: # 实现开始后填 feat/p6-import-first-slice
verification: # 仅 status: done 时必填
---

# 任务：P6 导入第一刀

> 唯一交接载体。状态以顶部 frontmatter 为准。实施规格是设计正文，不另开并行任务。

## 目标

按规格打通「上传已出运货柜表 → 映射确认 → 预检硬闸 → 经 shipment-registry 写端口落库 → 对账」，且 AI 不能直接写业务表。

## 权威入口

- 实施规格：[p6-import-first-slice.md](../specs/p6-import-first-slice.md)
- [IMPORT_WORKFLOW](../../product/workflows/IMPORT_WORKFLOW.md)
- [IMPORT_DOMAIN_MODEL](../../product/domain/IMPORT_DOMAIN_MODEL.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)

## 边界 / 不做

见规格 §2.1 非目标。不铺 18 个模块，不把 demo 工作台当写入口，五个 P2 候选项不升格为 Decision。

## 验收

- [ ] 规格 §11 样本 S1–S8 有自动化或可重复手工证据
- [ ] 预检 blocker 时业务表无新行
- [ ] 未认证不能上传
- [ ] `pnpm repo:check` / 受影响模块测试通过（实现阶段列出实际命令）

## 方案（design 阶段填写）

规格已按模块实施规格模板写完。交付按规格 §12 四阶段推进（A 读链路 → B AI 建议 → C 审核落账 → D 可靠性），不另开并行 brief。`p6-smart-import-slice` 已并入并标 `blocked`。本阶段只评审规格，不写业务代码。

## Review notes（review 阶段填写，只读不改代码）

2026-09-12 规格评审（已回写文档，本阶段仍为 design）：

1. 硬伤：§3.2 曾自写 `awaiting_precheck` 且与 IMPORT_WORKFLOW §4 的 `awaiting_validation` 顺序相反。已拍板「审核 → 预检」，权威与规格、架构 §11 同步。
2. 开发期身份未落地机制：已定为 header `X-Tenant-Id` + `X-Operator-Id`。
3. MinIO 为阶段 A 前置（compose + P4-06 最小集），已写入规格 §12。
4. 写端口冻结首选 `applyContainerRecord`，废弃带 Plan 的旧候选。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明                                                  |
| ---------- | ------ | ---- | ------ | ----------------------------------------------------- |
| 2026-09-12 | design | —    | —      | 初稿：P6 导入第一刀实施规格                           |
| 2026-09-12 | design | —    | —      | 吸收四阶段 MVP；并行 brief 标 blocked                 |
| 2026-09-12 | design | —    | —      | 评审回写：状态机审核→预检；开发期身份；MinIO 进阶段 A |
