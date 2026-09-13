---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 文档登记。对照当前路由与作业壳页面写入快照，并在 docs/INDEX.md 登记。无代码行为变更。
---

# 任务：登记作业壳页面定位与可补回清单

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

把当前前端各页的定位、点击边界，以及为避免空模块/黑话而从产品路径拿掉的内容写成快照，供后续按查询投影补回。不把快照写成业务权威。

## 权威入口

- [WORKSPACE_UI_INVENTORY](../../product/WORKSPACE_UI_INVENTORY.md)（本任务产出，快照）
- [UX_CONTAINER_WORKBENCH](../../product/UX_CONTAINER_WORKBENCH.md)（目标 UX，候选）
- [UI_SYSTEM.md](../../product/UI_SYSTEM.md)
- [QUERY_PROJECTION_CONTRACT_V1](../../product/domain/QUERY_PROJECTION_CONTRACT_V1.md)

## 边界 / 不做

- 不改页面行为、不补查询 API、不恢复空模块。
- 不把快照晋升为状态机或统计口径。

## 验收

- [x] 新增快照文档并在 INDEX 登记一句话+状态。
- [x] 文档区分「当前壳」与「目标 UX / GC-010」，并列可补回项与补回条件。

## 方案（design 阶段填写）

快照放 `docs/product/WORKSPACE_UI_INVENTORY.md`。目标交互仍以 UX 工作台和 UI 体系为准；缺投影时不编造。

## 进度 log

| 日期       | 阶段 | 负责 | commit | 说明         |
| ---------- | ---- | ---- | ------ | ------------ |
| 2026-09-13 | done | —    | —      | 登记页面快照 |
