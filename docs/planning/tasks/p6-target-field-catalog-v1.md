---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: main
verification: 2026-09-16 `pnpm docs:check`、`pnpm format:check`、`pnpm repo:check`、`git diff --check` 与完整 `pnpm validate` 通过；契约校验及漂移检查、类型检查、单元测试、E2E（50 通过/7 跳过）和生产构建均通过。
---

# 任务：冻结导入目标字段目录 V1

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

把 `TARGET_FIELD_CATALOG` 中已获负责人确认、且具备明确业务语义和当前落点的最小字段冻结为正式 V1；其余字段继续作为扩展候选，不把未决必填、字典、时间和证据规则升格为定论。

## 边界 / 不做

- 本任务只冻结字段目录和版本治理规则，不修改 API、数据库、导入运行行为或公共 JSON Schema。
- 不把 AI 能识别的字段等同于已支持落库字段。
- 不解决租户匹配、箱号冲突、事件推进等已知实现缺口，只把它们登记为 V1 实现门禁。

## 验收

- [x] `orderNumber`、`containerNumber` 的语义、必填性、归属、落点和冲突策略明确。
- [x] `tenantId` 与 `currentStatus` 明确为上下文/派生事实，不作为表格映射字段。
- [x] 扩展候选与正式 V1 清晰隔离，并定义兼容版本规则。
- [x] `pnpm docs:check`、`pnpm format:check`、`pnpm repo:check`、`git diff --check` 通过。

## 方案

在现有单一权威文档中增加 V1 冻结区，不复制出第二份字段目录；更新索引状态。运行时契约和实现对齐另开后续任务。

## Review notes

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                      |
| ---------- | ------ | ---- | ------ | ----------------------------------------- |
| 2026-09-16 | coding | —    | —      | 冻结最小 V1，保留扩展字段候选和兼容规则。 |
| 2026-09-16 | done   | —    | —      | 文档门禁与完整质量门禁通过。              |
