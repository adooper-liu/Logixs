---
status: coding # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/resource-constraint-worksheet
verification:
---

# 任务：收资源约束拆解工作纸

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

把 14 节点共用的资源/门槛/约满比价空白表，以及送仓+卸柜样例，收进规划目录并在 INDEX 登记。明确这是候选工作纸，不是契约、Seed 或费率公式。

## 权威入口

- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)
- [NODE_PDCA](../../product/domain/NODE_PDCA.md)
- [FEE_DEMURRAGE](../../product/domain/FEE_DEMURRAGE.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)

## 边界 / 不做

- 不建产能/预约模块，不写迁移、API、页面。
- 不把工作纸晋升为业务规则；不改 lifecycle-control / work-execution。
- 不拍板备选堆场是「一仓对一个」还是「一组里人当时选」。
- 不把演示页产能数字或默认免费天数写进表。

## 验收

- [ ] `docs/planning/RESOURCE_CONSTRAINT_DECOMPOSITION.md` 含空白表、送仓+卸柜样例、14 节点一览。
- [ ] INDEX 登记一句话 +「候选工作纸」。
- [ ] 正文写明预约不能完成节点；Demurrage / Detention / Storage 分项。
- [ ] 变更文件 `prettier --check` 通过。

## 方案

工作纸放 `docs/planning/`。对象边界写清：产能配置/预约占用尚未建模块；工单仍归 work-execution；节点完成仍归 lifecycle 事件；费用三类分项归结算。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明         |
| ---------- | ------ | ---- | ------ | ------------ |
| 2026-09-14 | coding | —    | —      | 开工收工作纸 |
