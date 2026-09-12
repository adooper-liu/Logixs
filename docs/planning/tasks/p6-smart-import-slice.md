---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: # 已并入 feat 待开的 p6-import-first-slice，本文件不再开独立分支
verification: # 仅 status: done 时必填
---

# 任务：P6 首个纵向切片——智能 Excel 导入与审核闭环

> 已并入 [p6-import-first-slice.md](./p6-import-first-slice.md)。同一时刻只允许一个进行中任务，本文件不再处于 `design`。

## 阻塞原因

与 [p6-import-first-slice.md](./p6-import-first-slice.md) 目标重叠。四阶段 MVP（A 读链路 → B AI 建议 → C 审核落账 → D 可靠性）已写入 [实施规格 §12](../specs/p6-import-first-slice.md)。权威交接以导入第一刀 brief + 规格为准。

## 目标

端到端打通「上传已出运货柜 Excel → 解析 → AI 字段映射建议 → 人工审核 → 预检 → 事务落账 → 对账」，用首个真实业务验证前端/API/Temporal/AI/数据库全栈，并沉淀可复用的导入能力（当前文件导入，后续替换为直连）。

## 边界 / 不做

- 权威依据：[IMPORT_DOMAIN_MODEL](../../product/domain/IMPORT_DOMAIN_MODEL.md)（批次/行/审核/执行）、[TARGET_FIELD_CATALOG](../../product/domain/TARGET_FIELD_CATALOG.md)（字段/必填口径）、[CONTEXT_MAP](../../product/domain/CONTEXT_MAP.md)（导入只经 Shipment 写端口，不直写业务表）。
- 首批不做：出运前记录导入、ShipmentPlan/Booking 上游、直连接入（当前仅文件导入）。
- AI 建议默认「建议模式」，不自动执行（P2-11 风险等级定稿前）。
- 五方/费用/单证等非本切片对象不纳入。

## 验收

已转移到导入第一刀 brief 与规格 §11。

## 方案（已并入规格 §12）

- **阶段 A（MVP 读链路）**：上传→幂等→安全解析→展示样本（P6-01/02/04/07）。先证明「文件能上传、能解析、能展示」，不落账。
- **阶段 B（AI 建议）**：AI 映射建议 Activity + 置信度/证据（P6-05/07）。
- **阶段 C（审核+落账）**：审核 Signal → 预检 → 事务落账 → 对账（P6-06/08/09/10/11）。
- **阶段 D（可靠性+测试）**：取消/超时/重试/恢复 + Trace + 完整测试（P6-12/13/14）。

数据：新增 `import_batch` / `import_row` / `ai_artifact` / 审核与行结果（迁移进 `database/migrations/`）；落账仍经 Shipment 的 `applyContainerRecord`（冻结首选，D-portname 仍为候选）。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先，每条对应文件/行号或 commit）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段    | 负责 | commit | 说明                                               |
| ---------- | ------- | ---- | ------ | -------------------------------------------------- |
| 2026-09-12 | design  | —    | —      | 初稿；P2 已终勾、全栈基座就绪，按 MVP 分四阶段推进 |
| 2026-09-12 | blocked | —    | —      | 并入 p6-import-first-slice，避免双进行中任务       |
