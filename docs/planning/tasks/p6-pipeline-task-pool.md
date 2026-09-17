---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/pipeline-task-pool
verification: 2026-09-17 本地数据库迁移及管道不变量验证通过（2 个流程均为 14 节点 / 14 任务，无箱号记录未初始化）；Prisma schema、契约校验与漂移检查、API/Web lint、Web/全库 typecheck、全库 build、相关 API/Web 测试通过。适用性回归补测后，相关 API 5 文件 / 22 项、API lint、格式及 build 通过。模块插件/Identity Phase A 门禁已收口（repo:check、api/web typecheck、identity 33 测、navigation）。串行槽位按产品方向让给 p6-notification-ops-assistant；本任务重回 review/done 前须重跑 validate。
---

# 任务：建柜即展开管道任务池

## 目标

有真实箱号的货柜建档后，幂等创建生命周期流程、全量节点任务和工单，使其立即进入全局任务池。人工或外部先行事实参与计算任务适用性、就绪度和完成资格；只有核验后的实际规范事件推进生命周期。

## 边界 / 不做

- 遵守 `AGENTS.md`、`ENGINEERING_RULES.md`、`MODULE_DEPENDENCIES.md`。
- 无真实箱号的备货单不创建 `FlowInstance`，继续等待箱号迟绑定。
- 不允许任务或工单直接更新 `FlowInstance`，不把预计时间、同步成功或页面操作当作过站事实。
- 本刀不补齐全部专业模块的事实匹配规则；先覆盖已确认的导入时间事实，并提供可扩展的任务条件投影。

## 验收

- [x] 新建或迟绑定真实箱号后，14 个节点、任务和工单可幂等展开并进入租户全局任务查询。
- [x] 当前可开工任务与未来等待条件任务可区分，等待条件任务不能领取或人工完成。
- [x] 已核验的人工/外部/导入实际事实可使对应任务具备完成资格，但不直接伪造生命周期过站。
- [x] 无箱号记录不创建货柜流程。
- [x] 既有有箱号货柜通过追加迁移完成回填，迁移含验证与恢复说明。
- [x] 公共契约、API、前端投影与数据库字段一致。
- [ ] 高风险质量门禁通过：`pnpm validate`。

## 方案

1. 将正式原则从“进入节点才派活”修订为“建柜展任务、事实算条件、规范事件推进状态”。
2. 为 `NodeTask` 增加独立的适用性、就绪度、完成资格及条件事实引用；保留既有 `NodeTaskState` 语义。
3. 新增幂等 `InitializeContainerFlow` 用例：创建完整节点管道，再经 `work-execution` 公共端口创建任务和工单。
4. 导入落账后调用初始化用例；读取当前有效时间事实，映射为任务条件，不跨模块解释供应商裸值。
5. 追加迁移回填既有有箱号货柜，并让查询/UI 只把 `ready` 任务当作可操作任务。

## Review notes

- 事件推进后激活既有节点任务时，沿用流程节点的 `applicability`；不得让任务 upsert 的默认值把 `optional_applicable` 改成 `required`。
- 任务条件 upsert 保持单向提升：先行事实已赋予的 `ready` / `eligible` 不会因节点激活重算而降级。
- 待并行 Identity/module-plugin 改动稳定后，由最终 PR CI 或一次完整 `pnpm validate` 补齐最后门禁。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                           |
| ---------- | ------ | ----- | ------ | ---------------------------------------------- |
| 2026-09-17 | coding | Codex | —      | 最新目标驱动规则确认，开始契约与实现。         |
| 2026-09-17 | review | Codex | —      | 完成管道任务池与适用性回归，等待最终全库门禁。 |
