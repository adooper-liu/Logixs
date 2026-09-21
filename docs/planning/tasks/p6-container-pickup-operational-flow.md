---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/container-pickup-operational-flow
verification: 2026-09-21：pnpm validate 通过（API 818、Web 243、Worker 5；E2E 68 通过/7 条按视口跳过；repo/contract/db generate/lint/format/typecheck/build 全绿）；提柜 E2E 在桌面、窄屏和移动端通过。
---

# P6 码头可提、实际提柜门禁与岗位工作台

## 目标

内陆运输岗位可以从全局任务池进入某柜，核对到港、清关和码头可提事实，登记可提与重柜出场实际日期；只有同一目的码头的 `available actual` 已被采信，且实际 `gate_out` 不早于可提时间、前序完成并无有效阻断时，才完成 `container_pickup` 节点。

## 边界 / 不做

- 权威来源：`EVENT_CODES.md`、`NODE_TIME_FIELDS.md`、`LIFECYCLE_NODE_CATALOG_V1.md`、`CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md`、`CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md`。
- `available` 只是提柜前置子里程碑，`gate_out actual` 才是提柜完成事实；岗位工单完成不替代过站。
- 本刀复用统一日期事实、来源权威、复核、pending 重放、NodeTask 与 NodeBlock，不新增提柜快照表。
- 不把候选 `FIVE_PARTY_CODES.md` 固化为运行时枚举，不宣称船司、海事、运费等尚未建模的放行已完整覆盖。
- 不做拖车车队、司机、车牌、预约、EIR 结构化执行模型；EIR 先作为 `gate_out` 证据引用。

## 验收

- [x] 缺少已采信的同码头 `available actual` 时，`gate_out` 保留为 `pending_application`。
- [x] `available` 与 `gate_out` 地点不一致或出场早于可提时间时，不推进提柜节点并返回稳定原因码。
- [x] 合格 `available` 到达或复核通过后，自动重放同柜待应用 `gate_out`；合格 `gate_out` 完成提柜节点并投影 `picked_up`。
- [x] 前序、NodeBlock、来源权威和证据守卫继续生效。
- [x] 内陆运输岗位可按“选任务 → 看前置事实 → 登记可提/出场 → 看复核或过站结果”的顺序完成操作。
- [x] 桌面、窄屏和移动端不存在关键内容遮挡，相关 API、Vue 与 E2E 覆盖成功、阻塞和恢复路径。
- [x] 高风险质量门禁 `pnpm validate` 与相关数据库专项检查通过。

## 业务与数据协同设计（业务功能或 UI 必填）

| 业务岗位要完成什么                         | 操作时需要看到什么                                             | 系统允许做什么                                                                   | 数据如何可靠保存与反馈                                                                 |
| ------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 核对货柜已到目的港、已清关且码头已通知可提 | 货柜身份、到港/清关/可提当前事实、来源与核验状态、有效阻断     | 从全局 `container_pickup` 任务池领取任务；登记 `available actual` 并查看复核结果 | 统一日期事实追加保存，人工实际日期先进入复核；证据、地点、时区、来源和幂等键必填       |
| 执行实际提柜并登记重柜出场                 | 计划/预计/实际提柜时间、码头地点、可提时间、节点状态和阻塞原因 | 登记 `gate_out actual`；完成岗位工单但不直接过站                                 | `gate_out` 经复核、来源权威与专项门禁后才申请过站；不合格事实保留为 pending 并显示原因 |
| 补齐迟到的可提或解除阻断事实               | 当前待应用事实及具体缺口                                       | 补录/复核合格事实后触发自动重放                                                  | 重放沿用原事实与幂等键，重新经过所有守卫；更正追加版本，不覆盖历史                     |

## 方案（design 阶段填写）

1. 在 lifecycle-control 增加纯领域提柜专项守卫：校验当前有效、已核验确认并已应用的 `available actual`，比较目的码头身份与时间先后。
2. Application 通过 `LifecycleDateFactRepository.listCurrent` 读取同柜日期事实，并将提柜 readiness 输入领域守卫；缺条件返回可重放的 `pending_application`。
3. 保持现有统一日期事实写入与复核链；`available` 成为 applied 后触发同柜 pending 重放，使先到的 `gate_out` 自动恢复。
4. Web 新增内陆提柜岗位工作台，使用 `RoleWorkbenchFrame`、全局 NodeTask、生命周期节点和日期事实 API；视图只组合，加载与命令副作用放 composable，组件 props down / emits up。
5. 更新路线图、UI 清单和领域交付状态，只登记实际完成能力。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责  | commit | 说明                                                    |
| ---------- | ------ | ----- | ------ | ------------------------------------------------------- |
| 2026-09-21 | coding | Codex | —      | 冻结“可提事实 → Gate Out 门禁 → 提柜工作台”最小纵向切片 |
| 2026-09-21 | review | Codex | —      | 完成门禁、来源上下文、时区歧义与三端工作台审查          |
| 2026-09-21 | done   | Codex | —      | 完整质量门禁通过，验收项全部关闭                        |
