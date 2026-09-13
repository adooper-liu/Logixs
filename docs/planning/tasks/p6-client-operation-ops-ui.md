---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification:
---

# 任务：同步操作薄页

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

计划/管理角色在 `/real-operations` 按本租户列出 ClientOperation，并可展开该操作的补偿。只读。三阶段分列，不合并成单一状态。不展示 requestHash 或密钥。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)（GC-010）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)
- [UI_SYSTEM.md](../../product/UI_SYSTEM.md)
- [p6-list-client-operations](./p6-list-client-operations.md)
- [p6-list-compensations](./p6-list-compensations.md)

## 边界 / 不做

- 不登记、不推进、不执行补偿；不改演示 `/tasks`。
- 不做 OIDC、按货柜过滤、视觉像素基线更新。
- 不改已入共享环境的旧迁移。

## 验收

- [ ] 导航「同步操作」仅 planner/manager；operator 侧栏不出现。
- [ ] 列表显示接收/裁决/落账三列；映射层丢掉 requestHash。
- [ ] 展开一行加载该操作补偿；空补偿明确说明。
- [ ] `pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

复用死信页的 PageHeader + 表格密度。补偿按需 GET，不预取全表。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段    | 负责 | commit | 说明                                  |
| ---------- | ------- | ---- | ------ | ------------------------------------- |
| 2026-09-13 | coding  | —    | —      | 开工：同步操作薄页                    |
| 2026-09-13 | blocked | —    | —      | 作业 UI 与真实 API 合并优先；本页暂停 |
