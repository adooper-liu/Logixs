# 货柜生命周期状态机契约 V1

> 状态：公共领域契约 V1（已定，待负责人评审与实例化）  
> 日期：2026-09-09  
> 所有者：`lifecycle-control`；公共类型目标位置：`packages/contracts`  
> 消费者：`shipment-registry`、`work-execution`、专业业务模块、Integration Adapter、Web、审计和生命周期投影

## 1. 目的与权威边界

本契约是货柜主流程状态转换的唯一设计权威，回答四个问题：当前流程是否运行、当前节点是哪一个、某条事实能否完成节点、完成后是否可以进入下一节点。

```text
证据 -> 专业模块规范事实 -> 生命周期时间线事件
    -> 状态机验证 -> NodeInstance 转换
    -> FlowInstance/current node 转换 -> ContainerLifecycleState 投影
```

- `lifecycle-control` 是唯一可以写 `FlowInstance` 和 `LifecycleNodeInstance` 的模块。
- 时间线保存事实；状态机决定事实是否造成转换；状态投影不得反向制造事实。
- WorkOrder、NodeTask、海关案卷、同步状态和异常状态各自独立，不进入本状态枚举。
- 专业模块只能发布规范事实；Adapter、UI、工作流引擎和数据库触发器不得绕过本状态机。
- 本轮不创建运行时代码、JSON Schema、数据库迁移或 API。

## 2. 单一权威关系与兼容性

| 内容 | 权威来源 | 本文处理 |
| --- | --- | --- |
| 主流程、节点和转换 | 本文 | 唯一转换规则 |
| 规范事件信封与时间 | [时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) | 作为状态机输入 |
| 事件码及角色 | [事件码目录](./EVENT_CODES.md) | 只引用批准线值 |
| 专业事实及证据 | 各专业模块契约 | 通过 `domainFactId` 引用 |
| 海关案卷放行 | [海关业务契约 V1](./CUSTOMS_BUSINESS_CONTRACT_V1.md) | 作为清关节点完成事实 |
| 工单与子任务 | `work-execution` 公共契约 | 只作作业上下文，不直接转换主流程 |

这是行为变更型设计：它把现有候选文档中的转换说明收敛为一个版本化契约。实施不得直接重释已有数据；必须保存原流程定义版本，采用新建 V1 流程或经审计迁移后切换。负责人批准前，本文仍不授权代码或数据变更。

## 3. 三层状态模型

### 3.1 `FlowInstanceState`

```text
draft | active | completed | cancelled
```

| 状态 | 含义 | 可进入 |
| --- | --- | --- |
| `draft` | 已创建但尚未启动 | `active,cancelled` |
| `active` | 主流程运行中且恰有一个当前节点 | `completed,cancelled` |
| `completed` | 必需节点完成且终点成立 | 终态；纠偏走受控重算，不原地回退 |
| `cancelled` | 在允许阶段经授权取消 | 终态 |

### 3.2 `LifecycleNodeState`

```text
pending | active | blocked | completed | skipped | cancelled
```

| 当前状态 | 命令/事实 | 下一状态 | 核心条件 |
| --- | --- | --- | --- |
| `pending` | activate | `active` | 前置节点完成或合法跳过 |
| `pending` | skip | `skipped` | 节点定义为可选、适用性为 false、证据与原因齐全 |
| `active` | block | `blocked` | 存在有效阻断事实 |
| `blocked` | unblock | `active` | 指定阻断已解除；不得清空全部未知阻断 |
| `active` | accept completion fact | `completed` | 事件、时间、来源、证据与节点守卫全部通过 |
| `active/blocked` | cancel flow | `cancelled` | 整个流程被合法取消 |

`completed/skipped/cancelled` 不接受普通回退。更正或撤销事实通过纠偏流程重建投影；是否生成新的节点实例由批准的重入规则决定。

### 3.3 `ContainerLifecycleState`

沿用现有稳定业务线值：

```text
not_shipped | shipped | in_transit | at_port |
picked_up | unloaded | returned_empty | cancelled
```

这是面向货柜当前位置的粗粒度投影，不等于 14 节点状态。一个值可覆盖多个节点，例如清关与到港阶段都可能投影为 `at_port`；节点转换不一定改变该值。

## 4. V1 节点定义

节点代码、顺序、可选性、所有者和主要完成事实唯一引用[货柜生命周期节点目录 V1](./LIFECYCLE_NODE_CATALOG_V1.md)。状态机负责节点实例、转换和守卫；下表是 V1 目录的评审快照，不得作为第二份枚举源。流程实例保存 `definitionVersion=1`。

| sequence | `nodeCode` | 名称 | 可选 | 所有者/事实模块 | 主要完成事实 | 完成后的货柜状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `cargo_ready` | 备货 | 否 | booking-origin | `cargo_ready`（由备货单完成事实挂接） | `not_shipped` |
| 2 | `container_stuffing` | 装箱 | 否 | booking-origin | `stuffed` | `not_shipped` |
| 3 | `shipment_dispatch` | 出运 | 否 | booking-origin | `loaded` | `shipped` |
| 4 | `origin_departure` | 离港 | 否 | ocean-port-visibility | `departed` | `shipped` |
| 5 | `ocean_transit` | 海运 | 否 | ocean-port-visibility | 直达为 `arrived`；中转为匹配航段的 `transit_arrived`；`sailing` 只表示进行中 | `in_transit` |
| 6 | `transshipment` | 中转港 | 是 | ocean-port-visibility | `transit_departed`，且适用时已有匹配 `transit_arrived` | `in_transit` |
| 7 | `customs_clearance` | 清关 | 否 | customs-compliance | 货柜级海关完成事实 | 不单独推导提柜状态 |
| 8 | `destination_arrival` | 到港 | 否 | ocean-port-visibility | `arrived`/ATA | `at_port` |
| 9 | `rail_transfer` | 海铁 | 是 | ocean-port-visibility/inland-fulfillment 公开端口 | `rail_handover` | 保持 `at_port` |
| 10 | `container_pickup` | 拖卡提柜 | 否 | inland-fulfillment | `gate_out` 且联合守卫通过 | `picked_up` |
| 11 | `warehouse_delivery` | 送仓 | 否 | inland-fulfillment | 有签收证据的 `delivered`，或仓库/WMS/门岗权威 `warehouse_arrival` | `picked_up` |
| 12 | `container_unloading` | 卸柜 | 否 | inland-fulfillment | `unloaded` | `unloaded` |
| 13 | `container_unstuffing` | 卸空 | 否 | inland-fulfillment | `unstuffed` | `unloaded` |
| 14 | `empty_return` | 还箱 | 否 | inland-fulfillment | `returned_empty` | `returned_empty` |

节点 #1 的 `cargo_ready` 已由负责人确认：一张备货单形成一次有效完成确认，来源可为授权人工、ERP、供应链系统或受控导入。箱号未产生时它只属于备货域，不创建货柜、FlowInstance 或货柜时间线；箱号产生并建档后才挂接为生命周期事件。节点 #9 已确认使用 `rail_handover`，以铁路实际接收指定货柜为完成点。负责人已批准事件目录使用版本化的 `completionEligibleNodeCodes`：事件 `role` 只描述语义角色，不能单独授予状态转换权限。

### 4.1 生命周期准入与备货事实挂接

```text
PreparationOrder（无箱号）
  -> CargoReadinessFact（每备货单一次有效确认）
  -> 箱号产生并创建 ContainerRecord
  -> StartLifecycle 引用 CargoReadinessFact
  -> 生成 cargo_ready 生命周期事件
  -> 完成节点 #1，激活节点 #2
```

- 生命周期准入必须有稳定 `containerId` 和已校验 `containerNumber`；备货单、订单或虚拟箱号不能替代货柜身份。
- `CargoReadinessFact` 保存 `preparationOrderId`、确认时间、来源类型、来源引用、操作者（人工时必填）、证据、幂等键和版本。
- 一备货单只允许一个当前有效的完成确认；完全重复幂等返回。纠错必须追加更正/撤销事实并审计，不能覆盖原确认。
- ERP、供应链系统和导入必须先映射为相同内部事实并通过来源授权、Schema、幂等和冲突校验，不能直接写节点状态。
- 一个备货事实只能按明确的备货分配关系挂接货柜；同一备货单可在业务分配允许时关联一个或多个后续货柜，但仍只有一次有效备货完成确认。每个货柜的挂接独立幂等，超出分配范围明确拒绝。

### 4.2 `RailHandoverDataV1`

```text
railSegmentId: UUID
receivingRailPartyId: UUID
receivingRailYardId?: UUID
handoverReference: string(1..200)
receiptType: physical_container_acceptance
```

事件时间 `occurredAt` 必须是铁路主体或场站实际接收货柜的时间。`evidenceRefs` 至少包含铁路/场站接收回执或经授权人工核验的等价证据；铁路订单、订舱、预约、排班、计划进场和仅有位置轨迹不得作为该事件。第三方平台可以是 `provider`，但 `authoritySystem` 必须记录实际接收的铁路主体或场站。人工后补录必须保存操作者、原因和原始证据，并与后到外部事实按同一业务键幂等合并。

## 5. 聚合与不变量

`FlowInstanceV1`：

```text
flowInstanceId: UUID
tenantId: UUID
containerId: UUID
definitionVersion: integer = 1
state: FlowInstanceState
currentNodeCode?: LifecycleNodeCode
currentNodeInstanceId?: UUID
version: integer >= 0
startedAt?: date-time
completedAt?: date-time
cancelledAt?: date-time
```

`LifecycleNodeInstanceV1`：

```text
nodeInstanceId: UUID
flowInstanceId: UUID
nodeCode: LifecycleNodeCode
activationNo: integer >= 1
state: LifecycleNodeState
applicability: required | optional_applicable | optional_not_applicable
activatedAt?: date-time
completedAt?: date-time
completionEventId?: UUID
blockedReasonRefs: UUID[]
version: integer >= 0
```

必须满足：

1. 一个货柜同一时刻最多一个 `active` FlowInstance。
2. `active` FlowInstance 恰有一个 `active` 或 `blocked` 当前节点实例。
3. 同一流程的 `(nodeCode,activationNo)` 唯一；重入必须增加 `activationNo`。
4. 只有 `actual + effective + verified/confirmed` 且在节点策略中登记为 `completionEligible` 的事件可申请完成节点；`role` 不是转换权限。
5. `estimated/planned`、同步成功、工单完成或 UI 操作成功都不能直接完成节点。
6. 事件必须匹配 tenant、container、flow、nodeInstance 和流程定义版本。
7. 事件接收在流程内按 `eventId` 唯一；节点应用按 `(eventId,nodeInstanceId)` 唯一。同一事件可按 `completionEligibleNodeCodes` 依次应用到不同节点，但每个节点最多产生一次转换。
8. 前序实际时间不得晚于后序实际时间；无法确认时进入复核，不使用接收时间替代。
9. 异常和阻断正交保存，不把 Hold、查验、延误或甩柜加入主链状态枚举。
10. 每次聚合更新使用 `expectedVersion` 乐观并发并在同一事务写 Outbox。

## 6. 状态机命令

### 6.1 `StartLifecycleCommandV1`

```text
containerId: UUID
definitionVersion: 1
initialFacts: UUID[]
cargoReadinessFactId?: UUID
preparationOrderId: UUID
idempotencyKey: string(1..200)
expectedContainerVersion: integer >= 0
```

命令前置条件是货柜已以真实箱号建档，且备货单与货柜关联一致。若已存在 `cargoReadinessFactId`，状态机挂接事实并生成 `cargo_ready` 生命周期事件，完成节点 #1、激活节点 #2；若尚未确认，则启动后停留节点 #1，等待该备货单唯一有效确认。不得为无箱号备货单创建 FlowInstance。导入快照可携带其他已验证实际事实并按本状态机顺序重放，不允许客户端直接指定最终状态。

### 6.2 `ApplyLifecycleEventCommandV1`

```text
flowInstanceId: UUID
eventId: UUID
expectedVersion: integer >= 0
idempotencyKey: string(1..200)
```

事件正文从时间线权威存储读取，命令不得重复携带可漂移的事件副本。

### 6.3 `SetNodeApplicabilityCommandV1`

```text
flowInstanceId: UUID
nodeCode: LifecycleNodeCode
applicability: optional_applicable | optional_not_applicable
evidenceRefs: unique UUID[1..]
reasonCode: string(1..64)
actorId: UUID
expectedVersion: integer >= 0
idempotencyKey: string(1..200)
```

只允许修改定义为可选的节点；若节点已激活或之后节点已推进，必须走人工纠偏。

### 6.4 `BlockNodeCommandV1` / `ResolveNodeBlockCommandV1`

阻断必须有稳定 `blockId`、类型、来源事实、发生时间和适用节点。解除只能指定 `blockId`，不能使用“全部清除”。重复阻断/解除幂等；解除不存在或已解除的阻断返回原结果或明确冲突。

### 6.5 `CancelLifecycleCommandV1`

只允许在运输实际发生前执行，并要求权限、原因、证据及预期版本。已存在 `loaded/departed` 等运输实际事实时拒绝取消，后续业务终止必须使用专业异常流程，不能伪造成从未运输。

## 7. 事件接受与转换算法

每次 `ApplyLifecycleEvent` 固定执行：

1. 校验 Schema、租户、对象级权限和流程版本。
2. Inbox/消费记录按 `eventId + payloadHash` 去重；同 ID 异载荷拒绝。
3. 校验事件码已登记，且角色、timeKind、nodeCode 与目录一致；需要完成节点时还必须校验该事件对目标节点的 `completionEligible` 注册。
4. 校验 `domainFactId`、来源权威、验证状态、置信状态和证据适用性。
5. 保存事件已接收事实；预计、里程碑或异常进入时间线/投影，但不自动完成节点。
6. 若事件属于未来节点，保存为 `pending_application`；不得跳过中间必需节点。
7. 若事件属于已越过节点，按迟到/更正规则重放；不得静默回退。
8. 若事件属于当前节点，执行节点专属守卫；失败保存拒绝原因，流程不变。
9. 成功时原子完成当前节点、更新粗粒度货柜状态、跳过已证明不适用的可选节点并激活下一节点。
10. 到达节点 #14 并完成后，将 FlowInstance 置为 `completed`；同一事务写转换记录和 Outbox。

未来节点事实先到后，当前节点一旦完成，状态机必须依次重放已经保存的待应用事实。每一步仍独立执行守卫；不能一次 SQL 跳到最远状态。

## 8. 节点守卫

### 8.1 通用守卫

```text
eventIsRegisteredAndCompletionEligibleForNode
AND eventMatchesCurrentNodeInstance
AND eventIsActualEffectiveFact
AND sourcePolicySatisfied
AND evidenceApplicableAndEffective
AND noUnresolvedNodeBlock
AND actualTimeMonotonic
AND expectedVersionMatches
```

### 8.2 专项守卫

| 节点 | 附加守卫 |
| --- | --- |
| 装箱 | 货柜身份已迟绑定且装箱定稿事实适用于该柜 |
| 备货 | `cargo_ready` 引用一备货单唯一有效确认，且备货单与当前货柜关联一致 |
| 出运/离港 | 实际装载/离港对象、航段和起运港匹配 |
| 海运 | `sailing` 只更新进行中投影；直达 `arrived` 必须匹配目的港航段，中转 `transit_arrived` 必须匹配中转港航段 |
| 中转 | 节点适用，`transit_departed` 的航段与中转港匹配；要求到达事实时必须指向同一港口调用 |
| 清关 | 全部必需案卷已有效放行，案卷集合版本一致，无有效海关阻断 |
| 到港 | ATA 属于目的港及当前航段；AIS 推算、ETA、ATB 不替代 ATA |
| 海铁 | 节点适用；`rail_handover` 必须证明铁路主体或铁路场站实际接收指定货柜，且货柜、铁路运输段、接收主体/场站和实际时间匹配 |
| 提柜 | 海关、船司、码头、海事、运费等适用主体守卫均通过，并有重柜 `gate_out` |
| 送仓 | 货柜与目的仓匹配；`delivered` 必须带 POD、门岗或仓库签收，`warehouse_arrival` 必须来自仓库、WMS 或门岗权威来源；GPS 围栏或司机单方点击只能 provisional |
| 卸柜/卸空 | 仓库与货柜匹配；部分卸货不等于卸空 |
| 还箱 | 指定空箱场站接受事实，且箱号/设备身份匹配 |

“海关放行”和“可提柜”分离：清关完成只允许进入后续到港阶段；提柜节点仍必须等待实际到港、可提及全部适用主体守卫。

## 9. 状态转换输出

`LifecycleTransitionedV1` 使用时间线统一信封并携带：

```text
flowInstanceId, containerId, definitionVersion
fromNodeCode, fromNodeInstanceId, fromNodeState
toNodeCode?, toNodeInstanceId?, toNodeState?
previousContainerState, resultingContainerState
triggerEventId, triggerDomainFactId
transitionedAt, projectionVersion
```

`transitionedAt` 是系统完成转换的记录时间，不得替代触发事实的 `occurredAt`。节点完成和下一节点激活在同一领域事务内；跨模块通知经 Transactional Outbox。

## 10. 阻断、异常、重入与纠偏

- 阻断影响节点能否完成，但不覆盖货柜物理状态。
- Hold/查验解除只解除匹配阻断；解除不自动产生放行或节点完成。
- 甩柜、改船和返工可重开专业任务并调整计划；已发生物理事实不倒退。
- 只有批准的重入规则可以创建相同 `nodeCode` 的新 `activationNo`；V1 默认不允许主链节点重入。
- 实际事件被更正或撤销时，状态机建立 `LifecycleReconciliationCase`，计算受影响节点范围、建议投影和下游影响；经授权后以新纠偏事件重算，不更新或删除旧转换。
- 已完成流程发生迟到冲突时保持历史可见并标记 disputed；不得静默把 FlowInstance 改回 active。

## 11. 海关切片反向校验结论

海关切片必须遵守：

1. `customs-compliance` 发布案卷级事实，并在全部必需案卷满足后发布货柜级海关完成事实。
2. 海关 WorkOrder/NodeTask 完成只表示内部作业闭环，不直接完成 `customs_clearance`。
3. 外部权威放行先到，仅当流程已到清关节点时可立即完成该节点；若流程仍在更早节点，事实先保存为 `pending_application`，不能越过缺失实际事实。
4. 清关完成不会直接进入 `picked_up`；它最多激活 `destination_arrival`，之后仍需 ATA 和提柜联合守卫。
5. 外部证据自动回填与人工后补录使用同一 `domainFactId/businessFactKey`，主链只消费一次。

这修正了旧切片中“权威事实先到时生命周期先推进”的歧义：允许先于工单推进，不等于允许越过主链前序节点。

## 12. 时间线与14节点矩阵反向校验结论

- 时间线中的实际有效事实只有在节点策略登记 `completionEligible` 后才是推进候选，并且仍须通过本状态机守卫；事件 `role` 不授予转换权限。
- `eventSequence` 是持久化游标，不能决定节点先后；未来节点事实进入待应用队列。
- ETA/ETD、预计变更、同步结果和 AI 推断不完成节点。
- 14 节点矩阵只描述事件归属和候选完成事实；本文是唯一转换权威。
- 节点 #1 使用 `cargo_ready`，节点 #9 使用 `rail_handover`；`completionEligibleNodeCodes` 及全部 V1 映射均已由负责人确认。
- `ContainerLifecycleState` 不与每个节点一一对应；不得为了 UI 轨道新增平行状态。

## 13. 查询投影与允许动作

`LifecycleStateViewV1`：

```text
flowInstanceId, containerId, definitionVersion
flowState, currentNodeCode, currentNodeInstanceId
containerState, projectionVersion, asOf
nodes: [{nodeCode,activationNo,state,applicability,plannedAt?,estimatedAt?,actualAt?,blocks}]
pendingEventCount, disputedEventCount
allowedActions: LifecycleActionCapabilityV1[]
```

允许动作由服务端按状态、权限、证据和版本计算。Web 只能提交命令和 `expectedVersion`，不得复制转换表。查询列表分页并使用稳定排序；错误和冲突返回 `traceId`。

## 14. 错误码

```text
LIFECYCLE_FLOW_NOT_FOUND
LIFECYCLE_FLOW_ALREADY_ACTIVE
LIFECYCLE_DEFINITION_VERSION_UNSUPPORTED
LIFECYCLE_NODE_NOT_CURRENT
LIFECYCLE_NODE_NOT_OPTIONAL
LIFECYCLE_NODE_APPLICABILITY_CONFLICT
LIFECYCLE_EVENT_TYPE_UNKNOWN
LIFECYCLE_EVENT_NOT_STATE_EVIDENCE
LIFECYCLE_EVENT_PENDING_PREDECESSOR
LIFECYCLE_SOURCE_NOT_AUTHORIZED
LIFECYCLE_EVIDENCE_REQUIRED
LIFECYCLE_GUARD_NOT_SATISFIED
LIFECYCLE_ACTIVE_BLOCK_EXISTS
LIFECYCLE_TIME_ORDER_CONFLICT
LIFECYCLE_HISTORY_SEALED
LIFECYCLE_IDEMPOTENCY_CONFLICT
LIFECYCLE_VERSION_CONFLICT
LIFECYCLE_REENTRY_NOT_ALLOWED
LIFECYCLE_MANUAL_REVIEW_REQUIRED
```

结构错误 400，不存在 404，幂等/版本/状态冲突 409，结构有效但业务守卫不满足 422。重复同内容返回原结果，不作为错误。

## 15. 事务、幂等与审计

状态机本地事务必须原子完成：Inbox/消费登记、事件应用结果、节点转换、FlowInstance 版本、货柜状态投影、转换历史和 Outbox。跨模块只保存稳定逻辑 ID，不建立跨 schema 外键。

事件接收幂等范围为 `tenantId + flowInstanceId + eventId`；节点应用幂等范围为 `tenantId + flowInstanceId + eventId + nodeInstanceId`。同事件 ID 同哈希返回已有接收结果，并继续检查是否存在尚未应用的合格目标节点；同 ID 异哈希拒绝并告警。并发更新以 `expectedVersion` 控制，失败方重读后重新判断，不自动覆盖。

审计至少保存命令、操作者/服务身份、原因、触发事实、前后状态摘要、守卫判定、证据引用、关联 ID 和时间。敏感原文只保存受控引用及哈希。

## 16. 验收矩阵

至少覆盖：

1. 14 节点正常顺序完成，终点只完成一次。
2. 无中转/无海铁时，凭适用性证据合法跳过可选节点。
3. ETA 更新不推进；ATA 核验后推进到港。
4. 未来节点事实先到，先保存，前序完成后按序重放。
5. 外部海关放行先于内部工单，清关节点只推进一次。
6. 海关放行先于前序主链事实，不允许越级。
7. 清关完成但未到港、码头不可提或费用阻断，不能完成提柜。
8. 重复事件、同键异载荷和两个并发转换。
9. Hold 解除不等于放行，旧回执迟到不回退。
10. ATA 更正、实际事实撤销、密封历史和人工纠偏。
11. 导入快照按事实重放，未知状态/事件明确失败。
12. 同一事件日志多次重建得到相同状态和投影版本。
13. UI 只显示服务端允许动作，越权命令由服务端拒绝。
14. 状态转换、Outbox 和 Inbox 在故障下注入后保持原子。
15. 铁路只接受订单、预约成功或生成计划时不完成海铁节点；铁路实际接收匹配货柜后才接受 `rail_handover`。
16. `sailing` 不完成海运；直达 `arrived` 或匹配中转港的 `transit_arrived` 才完成当前海运阶段。
17. 带有效交付证据的 `delivered` 与仓库权威 `warehouse_arrival` 均可完成送仓；司机点击或 GPS 围栏不可完成。

## 17. 实例化与实施顺序

```text
负责人批准本文及四个目录缺口
-> JSON Schema 单一权威源
-> TS/OpenAPI/Python 派生和 Contract Parity
-> lifecycle-control 数据库结构与迁移设计
-> Domain 状态机及 fixture
-> Application/Inbox/Outbox
-> 专业模块 Adapter
-> 查询投影与 Web
-> 全链路 E2E、历史回放和恢复演练
```

`completionEligibleNodeCodes` 的 V1 属性及节点映射已经完成负责人确认。当前唯一活动任务释放前，不派生代码实施任务；本文不修改活动任务状态。
