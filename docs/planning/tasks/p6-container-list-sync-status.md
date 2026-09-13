---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：web 相关 16 项通过；complete-work-order 11 项通过；web typecheck 通过；变更文件 eslint/prettier 通过。Playwright desktop-chromium「container-list remains readable」「container table supports data operations」通过。未执行：完整 pnpm validate、像素基线。
---

# 任务：干活表展示最近提交落账

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

干活表增加「同步」列：来自本租户最近一页 `GET /client-operations` 里指向该柜的最新操作，只回答「最近一次记没记下」。没有命中写「最近没有提交」；接口失败不假装查过。不恢复 ETA/风险。

## 权威入口

- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md) §3
- [p6-list-client-operations](./p6-list-client-operations.md)
- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md) §4.3

## 边界 / 不做

- 不按柜新开查询 API，不翻完所有操作页。
- 不把三阶段合成「同步成功」；列名用「同步」不是「同步状态」。
- 不做补偿执行。不改旧迁移，不更新像素基线，不 commit。

## 验收

- [x] 有指向该柜的操作则显示落账口径人话；没有则「最近没有提交」。
- [x] 不出现「无投影」和「同步状态」列表头。
- [x] 操作接口失败时写「同步没能加载」。
- [x] 相关 web 测试通过。

## 方案

列表已按 `createdAt desc`。`targetType=container` 或 `resultRefs` 命中货柜时取第一条。工单完成补写 `container` 引用；旧记录若任务页能对上工单/节点任务也挂回去。文案复用看提交页的落账/接收标签。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                |
| ---------- | ------ | ---- | ------ | ----------------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：列表同步                      |
| 2026-09-13 | done   | —    | —      | 干活表同步列 + 工单 resultRefs 补柜 |
