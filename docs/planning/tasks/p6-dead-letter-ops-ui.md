---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 62 项通过；typecheck / lint / format:check / repo:check 通过。未执行：完整 pnpm validate、Playwright（本机缺 Chromium）、对照真实 API 的浏览器冒烟、OIDC。
---

# 任务：死信操作台第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

计划/管理角色进入死信队列页：按当前开发期租户列出 `dead_letter`，可人工重放。只展示受控引用与失败摘要，不展示载荷正文或凭据。前端不是安全边界。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) §8（GC-009）
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §9（GC-010）
- [UI_SYSTEM](../../product/UI_SYSTEM.md)（壳层、作业优先、状态可解释）
- [p6-list-dead-letters](./p6-list-dead-letters.md)
- [p6-outbox-dead-letter-replay](./p6-outbox-dead-letter-replay.md)

## 边界 / 不做

- 不做正式 OIDC、修正载荷、告警、自动发布、cursor 过期。
- 不把死信放进现场员工默认导航。
- 不复制主题内部实现；业务页只走 UI 门面。

## 验收

- [x] `GET /api/outbox/dead-letters` 列表；默认页大小 50；可翻下一页。
- [x] `POST /api/outbox/dead-letters/:id/replay` 需要原因码、目标消费者版本和幂等键。
- [x] 页面不渲染载荷正文、Token 或服务密钥。
- [x] 计划/管理导航可见，现场员工导航不可见。
- [x] `pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

API 客户端复用开发期 `X-Tenant-Id` / `X-Operator-Id`。展示列由契约函数白名单。页面走 `PageHeader` 与现有 `page-frame` 密度。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                          |
| ---------- | ------ | ---- | ------ | ----------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：死信操作台              |
| 2026-09-13 | done   | —    | —      | Web 62 项单测通过；死信队列页 |
