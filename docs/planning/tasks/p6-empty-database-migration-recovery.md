---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: main
verification: 2026-09-16 本地当前库恢复并应用 34 条迁移；专用临时空库从零升级成功（34 applied、0 unresolved，关键列无默认值）后已删除；`prisma migrate diff` 无差异；`pnpm validate` 通过（仓库测试 16 项、API 84 文件/384 项、Web 50 文件/167 项、Worker 5 项、E2E 50 通过/7 跳过，生产构建通过）。
---

# 任务：空库历史迁移恢复

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

让 `pnpm db:migrate` 在空库遇到已知的 `20260913011044_inbox` 历史顺序错误时受控恢复，并继续应用后续迁移；其他失败不得被吞掉。

## 边界 / 不做

- 不修改已进入共享环境的历史迁移 SQL。
- 不执行 `migrate reset`、`db push` 或数据删除。
- 只识别迁移名、数据库错误码和缺失表名完全匹配的已知错误。

## 验收

- [x] 当前失败库经状态核验后恢复，34 条迁移全部应用。
- [x] 包装脚本只恢复已知 `42P01`，普通 P3009 和其他迁移错误仍失败。
- [x] `pnpm db:migrate` 在已齐库上可重复成功。
- [x] 仓库测试、格式、Lint 与完整质量门禁通过。

## 方案

保留不可变迁移历史。首次 `migrate deploy` 精确命中已知空库故障时，用 Prisma 官方 `migrate resolve --applied` 登记该迁移，再重试 deploy；恢复条件由单测锁定。追加迁移移除后建 `request_hash` 列的临时默认值，修正历史执行顺序留下的 schema 漂移。

## Review notes

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                      |
| ---------- | ------ | ---- | ------ | ----------------------------------------- |
| 2026-09-16 | coding | —    | —      | 核验 P3009 根因并恢复本地库；补自动恢复。 |
| 2026-09-16 | done   | —    | —      | 空库升级、schema diff 与完整门禁通过。    |
