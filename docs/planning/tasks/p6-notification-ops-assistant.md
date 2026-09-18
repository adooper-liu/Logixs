---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/notification-ops-assistant
verification: PR #11 已合入 main（merge commit 98f0b62）；实现阶段已通过 repo:check、API/Web typecheck 与相关单测，CI 修正提交 ff6db88 随 PR 合入。
---

# 任务：通知总线 + 只读运营助手（第一刀）

## 目标

有问题（样板：Outbox 进入死信）时经 `notification` 公共 Port 通知人；用户可从通知打开只读运营助手会话，询问问题上下文。不做完整 IM，助手本刀不写业务状态。

## 边界 / 不做

- 遵守 `AGENTS.md`、`MODULE_DEPENDENCIES.md`、`MODULE_PLUGIN_CONVENTION.md`、ADR-006/010、GC-008。
- 不做 Discuss 频道/私聊；不做助手 claim/complete/replay；不做邮件/短信通道。
- 串行说明：`p6-pipeline-task-pool` 仍为 `review`；模块插件/Identity Phase A 门禁已收口。本任务按产品方向接续实现；pipeline 所有者在本刀不挡路径后自行重跑 validate。

## 验收

- [x] `notification` 提供 `POST_NOTIFICATION` / 列表查询；死信进入时样板投递。
- [x] 用户可从通知创建只读助手会话并收发消息（AI Gateway 可 mock）。
- [x] Web 有通知入口与简易会话。
- [x] 相关 lint / typecheck / 单测通过；`repo:check` 通过。

## 方案

1. Prisma：`ops_notification`、`ops_assistant_session`、`ops_assistant_message` + migration。
2. `notification` 模块：domain + application ports + prisma repo + HTTP list/session APIs。
3. `lifecycle-control` 在 outbox 标死信后调用 `POST_NOTIFICATION`。
4. `ai-governance` Gateway 增加只读 `answerOpsQuestion`（失败时确定性回退摘要）。
5. Web：`modules/notification` 路由/导航 + 列表页与会话面板。

## 进度 log

| 日期       | 阶段   | 负责  | commit  | 说明                                                                                                   |
| ---------- | ------ | ----- | ------- | ------------------------------------------------------------------------------------------------------ |
| 2026-09-17 | coding | agent | —       | Phase A 收口后开工                                                                                     |
| 2026-09-17 | coding | agent | —       | notification Port/表/死信投递 + 只读助手 + Web 入口已落地；repo:check、api/web typecheck、相关单测通过 |
| 2026-09-18 | done   | Codex | 98f0b62 | PR #11 已合入 `main`，按合入记录与既有验证证据收口串行任务槽位。                                       |
