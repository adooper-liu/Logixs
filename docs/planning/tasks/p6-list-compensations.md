---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/api test -- src/modules/lifecycle-control 36 文件 / 194 项通过；typecheck / lint / repo:check 通过。HTTP：缺身份 401；原操作不存在/跨租户/补偿不存在 404；已有工单完成操作下列表空页 200（pageSize=50）；pageSize=201 与损坏 cursor 400。未执行：完整 pnpm validate、真实 pending 补偿行的非空列表与翻页。
---

# 任务：按原操作列/读补偿

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

按 `ClientOperation` 游标分页列出补偿，并可按 id 读取一条。只读本租户；不展示密钥。不执行反向事件。

## 权威入口

- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)（GC-010）
- [p6-compensation-resolve](./p6-compensation-resolve.md)

## 边界 / 不做

- 不做前端、反向事件、OIDC、补偿执行器。
- 不改已入共享环境的旧迁移。

## 验收

- [x] `GET /api/client-operations/:id/compensations`：原操作存在且同租户；默认 50，最大 200；`createdAt asc, id asc`。
- [x] cursor 绑定租户与原操作；损坏或不匹配直接失败。
- [x] `GET .../compensations/:compensationId`：跨租户或不属于该操作 → 404。
- [x] `pnpm --filter @logix/api test -- src/modules/lifecycle-control` 与 `pnpm repo:check` 通过。

## 方案

复用已有 `compensation_original_idx`。列表先断言原操作租户，再读补偿表。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                 |
| ---------- | ------ | ---- | ------ | -------------------- |
| 2026-09-13 | coding | —    | —      | 开工：列/读补偿记录  |
| 2026-09-13 | done   | —    | —      | 列/读补偿已落地并验证 |
