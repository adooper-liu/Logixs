---
status: coding # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/inland-plan-first-slice
verification: 2026-09-15 本地 `pnpm --filter @logix/web test` → 50 files / 166 tests passed。整分支另含未收口的内陆/超期/人话代码，本刀文档验收已满足，不能单独当作可合并发布。
---

# 任务：14流程节点填空表权威入口

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

给 14 流程节点各立一张作业填空表：出站记下什么、时间/地点/单证/动作收什么。已批准的写成定论；行业最佳实践只作完整性规划并标 `C`，不升格 NODE_PDCA、动作目录或时间字段候选。

## 权威入口

- [LIFECYCLE_NODE_IO_CATALOG](../../product/domain/LIFECYCLE_NODE_IO_CATALOG.md)（本任务产物，查阅入口）
- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)（节点枚举）
- [EVENT_CODES](../../product/domain/EVENT_CODES.md)
- [CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1](../../product/domain/CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md) §8
- [CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1](../../product/domain/CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) §4
- [TASK_WORK_ORDER_CONTRACT_V1](../../product/domain/TASK_WORK_ORDER_CONTRACT_V1.md) §4/§10
- 行业对标（`C`）：[INDUSTRY_STANDARDS_ALIGN](../../product/domain/INDUSTRY_STANDARDS_ALIGN.md)、[NODE_PDCA](../../product/domain/NODE_PDCA.md) §④、[NODE_TIME_FIELDS](../../product/domain/NODE_TIME_FIELDS.md)、[ACTION_CATALOG](../../product/domain/ACTION_CATALOG.md)、[OPERATIONS_ALIGNMENT](../../product/domain/OPERATIONS_ALIGNMENT.md)

## 边界 / 不做

- 不新增第 15 个流程节点；进场/靠泊/卸船/可提/提空箱仍是子里程碑。
- 不把装箱拆成三件正式子任务；拆分只留在候选栏。
- 不改 API、数据库、作业壳表单实现。
- 不把 `C` 行写成 Seed/API 必填。

## 验收

- [x] 14 张填空表齐，每格有成熟度（正式 V1 / 行业 C / 现网缺口）。
- [x] INDEX 与术语表指向本目录。
- [x] §2.1 锁定到港/提柜/送仓/卸柜/还箱的计划与实际、最晚提柜日/还箱日、ETA（文档槽位，未改运行时）。
- [x] `pnpm --filter @logix/web test` 不受影响（本文档任务，不改运行时；2026-09-15 本地 166 passed）。

## 方案

先立空白表模板，再按 GC-001 顺序填 14 站；行业子里程碑与字段进「完整性规划」列。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明 |
| ---------- | ------ | ---- | ------ | ---- |
| 2026-09-15 | coding | —    | —      | 开工：14 站填空表汇编 |
| 2026-09-15 | coding | —    | —      | 锁定五站计划/实际、最晚提柜日/还箱日、ETA |
| 2026-09-15 | coding | —    | —      | §1.1 过站释义备注；术语表 v0.1.10 |
| 2026-09-15 | coding | —    | —      | 验证：web test 166 passed；整分支未收口，不推不合并 |
