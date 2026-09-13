---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：GET /api/containers 对 dev-tenant 返回 5 柜；pnpm --filter @logix/web test 42 文件 / 108 项通过。未执行完整 pnpm validate。
---

# 任务：已出运货柜空表是筛选回归

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`/containers` 继续消费 `GET /containers`。没有「全部」快筛时，默认不得把已有货柜滤成空表。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)
- [UI_SYSTEM.md](../../product/UI_SYSTEM.md) UI-D02

## 边界 / 不做

- 不改 API、种子、迁移。
- 不恢复空的任务/同步/费用列。

## 验收

- [x] 无快筛 schema 下默认展示全部行。
- [x] 空库与「筛没了」文案分开。
- [x] `pnpm --filter @logix/web test` 通过。

## 方案（design 阶段填写）

`ContainerList` 把默认 `filter` 从写死的 `all` 改为 schema 的 matchAll 码，没有快筛则为空串。`queryDataTableRows` 在 `filterCode=all` 且没有 matchAll 时会丢掉 `filterKeys` 为空的行。

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明           |
| ---------- | ------ | ---- | ------ | -------------- |
| 2026-09-13 | coding | —    | —      | 修空表筛选回归 |
| 2026-09-13 | done   | —    | —      | 默认不再用失效的 all 筛选 |
