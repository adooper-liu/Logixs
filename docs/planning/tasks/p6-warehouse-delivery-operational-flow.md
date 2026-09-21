---
status: done
branch: feat/warehouse-delivery-operational-flow
verification:
  - API 专项测试 65 项通过
  - Web 专项测试 6 项通过
  - contract:check 与 contract:drift 通过
  - API/Web typecheck 通过
  - db:migrate 与 db:verify:warehouse-delivery 通过
  - db:verify:lifecycle-date-facts 旧库升级回滚与空库完整迁移链通过
  - pnpm validate 通过（API 836、Web 250、E2E 68 通过/7 条按既有视口条件跳过，构建通过）
  - 送仓主路径 E2E 在 desktop/narrow/mobile 3 个项目通过
---

# 任务：实际送仓/POD 门禁与送仓岗位工作台

## 目标

交付路线图 3.2 的第一条可演示纵向切片：内陆运输岗位锁定本柜本次目的仓与预约要求，登记并复核实际送仓/POD 日期事实；只有目的仓、事实地点和合格证据一致时，才完成 `warehouse_delivery` 节点。送仓工单完成继续与货柜过站分离。

## 边界 / 不做

- 权威规则来自 `EVENT_CODES.md`、`NODE_TIME_FIELDS.md`、`LIFECYCLE_NODE_IO_CATALOG.md` §5.11、`CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md` 和 `DOMAIN_VERTICAL_DELIVERY_PLAN.md` 3.2。
- `delivered` 只接受 POD、门岗或仓库签收证据；`warehouse_arrival` 只接受仓库、WMS 或门岗权威来源。GPS/司机单方点击可留存，但不能过站。
- 目的仓采用 `inland-fulfillment` 拥有的版本化送仓指令；不把始终为 `draft` 的 `InlandPlan` 升格为权威事实。
- 本刀不建设完整 Facility 主数据后台、仓内 WMS 库存、卸柜、卸空或还箱闭环，不新增第 15 个生命周期节点。
- 兼容性分类为增量兼容：新增数据库表、公共 DTO/API、模块 Port 和 `/workspaces/delivery`；现有事件码、日期事实与生命周期状态不改写。

## 验收

- [x] 送仓岗位可从全局任务池选择第 11 节点任务，查看目的仓指令、Gate Out、计划/预计/实际送仓及门禁缺口。
- [x] 岗位可新增或更正版本化目的仓指令；同键同载荷幂等，同键异载荷和版本冲突明确失败。
- [x] 可登记 `delivered` 或 `warehouse_arrival` 实际日期，人工实际事实进入既有四眼复核链；采信后自动重放。
- [x] 缺目的仓、非仓库地点、地点不一致、POD 语义不合格、仓库/WMS/门岗来源不合格时保持 `pending_application`。
- [x] 合格事实完成 `warehouse_delivery`，货柜八态保持 `picked_up`；工单完成不等于过站。
- [x] 数据库迁移覆盖空库、旧版本升级、唯一性、版本链和约束验证。
- [x] 运行专项测试、契约漂移检查和 `pnpm validate`，实际结果记录在本 brief。

## 业务与数据协同设计（业务功能或 UI 必填）

| 业务岗位要完成什么     | 操作时需要看到什么                                                         | 系统允许做什么                                       | 数据如何可靠保存与反馈                                                 |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| 判断送仓任务是否可执行 | 货柜/备货单、Gate Out、目的仓、预约窗、计划/预计送仓、当前节点、证据与缺口 | 领取任务；查看等待、阻塞及原因                       | 任务池、日期事实和当前送仓指令由服务端投影，UI 不推断过站资格          |
| 锁定或更正本次目的仓   | 当前版本、仓库 UUID、名称/代码、UN/LOCODE、IANA 时区、预约参考和窗口       | 保存首版或追加更正版本                               | 乐观版本、幂等键、载荷哈希、前版引用和审计字段；禁止覆盖历史           |
| 登记实际送仓/POD       | 可选完成路径、当地时间与时区、目的仓地点、证据要求                         | 提交 `delivered` 或 `warehouse_arrival` 实际日期事实 | 统一日期事实用例保存 UTC、原值、地点、来源和证据；人工 actual 进入复核 |
| 确认业务结果或处理缺口 | 复核状态、采信状态、门禁原因、完成时间、下一节点                           | 仅执行服务端允许动作；补指令/证据后自动重放          | 生命周期逐目标节点守卫、来源权威、证据核验和 pending 重放共同决定结果  |
| 完成岗位工单           | 工单状态、领取人、下一动作                                                 | 领取或完成工单                                       | 既有 work-execution 保存工单结果，并明确不替代送仓事实和过站           |

## 方案（design 阶段填写）

1. 在公共契约中增加 `WarehouseDeliveryInstruction` 与替换命令，服务端 DTO 从该单一权威派生；字段为目的仓身份、显示快照、时区、可选预约窗/参考、证据和并发参数。
2. 在 `inland-fulfillment` 增加领域规范化、版本化仓储、读取/替换/就绪 Port，并追加 `warehouse_delivery_instruction` 迁移；仓库地点 ID 强制 UUID，时区强制 IANA，窗口按 UTC 保存。
3. 新增窄的 `inland-lifecycle-orchestration`，在写指令前核验证据，写入后重放本柜 pending 日期事实；读接口留在 `inland-fulfillment`，写接口默认要求 `container.operate`。
4. `ApplyLifecycleEventService` 读取当前送仓指令与证据权威上下文，领域专项守卫分别验证目的仓地点和两条完成路径的证据资格，不绕过统一 actual/verified/confirmed 契约。
5. 前端组件图：`WarehouseDeliveryWorkbench.vue` 只负责编排；`DeliveryWorkQueue` 负责全局队列；`DeliveryFactsPanel` 负责事实与门禁状态；`DeliveryInstructionPanel` 负责版本化目的仓；`DeliveryActionPanel` 负责日期事实和工单动作；`useWarehouseDeliveryWorkbench` 加载投影；`useWarehouseDeliveryCommands` 封装写命令。
6. 更新导航、路由、路线图状态和文档索引；按真实岗位主路径、阻塞/恢复、窄屏场景验收。

## Review notes（review 阶段填写，只读不改代码）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责  | commit | 说明                                        |
| ---------- | ------ | ----- | ------ | ------------------------------------------- |
| 2026-09-21 | coding | Codex | —      | 冻结 3.2 第一刀范围、契约影响和四者协同验收 |
| 2026-09-21 | review | Codex | —      | 生产实现、专项测试与数据库双路径验证已完成  |
| 2026-09-21 | done   | Codex | —      | 完整质量门禁通过，准备提交并发起 PR         |
