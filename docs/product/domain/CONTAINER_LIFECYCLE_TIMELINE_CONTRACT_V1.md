# 货柜生命周期时间线契约 V1

> 状态：公共契约设计 V1（已定，待负责人评审与实例化）  
> 日期：2026-09-09  
> 所有者：`lifecycle-control`；公共类型目标位置：`packages/contracts`  
> 适用消费者：`shipment-registry`、`lifecycle-control`、`work-execution`、各专业业务模块、Integration Adapter、Web、审计与分析投影  
> 状态转换权威：[货柜生命周期状态机契约 V1](./CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)

## 1. 定位与边界

时间线是一柜全生命周期中“发生过什么、何时发生、依据什么”的追加式事实链；当前节点、当前状态和关键日期是从有效事实计算出的投影，不是事实源。

```text
外部观察/人工动作/系统结果
  -> 专业模块核验并形成规范业务事实
  -> CanonicalLifecycleEventV1
  -> lifecycle-control 校验、排序和状态机转换
  -> 当前节点/关键日期/风险/时间线投影
```

- `lifecycle-control` 拥有 14 节点主链、事件接受策略、历史密封和投影规则。
- 专业模块拥有本领域事实与证据，只发布公共事件，不直接写生命周期表。
- `work-execution` 拥有 NodeTask、WorkOrder 及完成聚合，不以工单状态冒充货柜事实。
- Integration Adapter 只保存和翻译供应商观察，不能让供应商模型侵入公共契约。
- 海关是节点 #7 的专业切片；本契约不复制海关案卷、Hold 或回执结构。

本轮只定稿设计，不创建 JSON Schema、TypeScript、OpenAPI、数据库迁移或运行时代码。

## 2. 单一权威与兼容性

| 内容 | 唯一来源 | 本文职责 |
| --- | --- | --- |
| 14 节点及顺序 | [生命周期一致性](./LIFECYCLE_CONSISTENCY.md)、[节点对照](./CONTAINER_LIFECYCLE.md) | 引用并规定接受/推进方式 |
| 规范事件码 | [事件码目录](./EVENT_CODES.md) | 引用，不复制供应商码 |
| 外部码映射 | [外部事件映射](./EXTERNAL_EVENT_MAPPING.md)及供应商 Adapter | 要求版本化映射与未知值隔离 |
| 海关事件载荷 | [海关公共契约 V1](./CUSTOMS_PUBLIC_CONTRACT_DESIGN_V1.md) | 通过专业事实引用挂接 |
| 数据库存储 | 后续时间线数据库设计/迁移 | 本文定义公共线语义，不把实体当 DTO |

这是新增公共契约。V1 实例化后，字段含义、枚举线值和事件版本不得静默改变；新增必填字段、收紧可空性、修改类型或重释既有事件必须发布 V2 并提供兼容期。当前节点及事件目录仍含候选来源，负责人批准前不得据本文启动运行时实现。

## 3. 核心类型

### 3.1 `LifecycleTimeKind`

```text
planned | estimated | actual
```

- `planned`：基准计划，如 STA/STD；计划重排必须保留版本。
- `estimated`：滚动预计，如 ETA/ETD；允许更新，但不推进或密封实际主链。
- `actual`：已发生事实，如 ATA/ATD；只有通过来源、对象和状态机校验后才能推进主链。

### 3.2 `LifecycleEventRole`

```text
milestone | state_evidence | prerequisite | exception
```

事件角色只描述事实用途，不授予转换权限。只有 `actual + effective` 且被状态机节点策略登记为 `completionEligible` 的事件具备申请推进资格；是否推进仍由来源、证据、节点状态机及联合守卫决定。

### 3.3 来源、权威与确认状态

```text
CaptureSource = external_evidence | manual_backfill | internal_operation | system_derived
AuthorityLevel = authoritative | corroborating | operational | contextual
VerificationState = pending | verified | rejected | revoked
ConfidenceState = confirmed | provisional | disputed | unknown
EventValidity = effective | corrected | revoked
```

- `provider` 是传输方，例如飞驼；`authoritySystem` 是事实来源，例如港区、码头、船公司、海关或 WMS，两者必须分列。
- `system_derived` 只能形成预计、预警或解释，不能形成实际到达、放行、提柜、卸柜或还箱事实。
- `confirmed` 必须来自已验证且满足该事件来源政策的证据；`provisional` 不推进节点；来源冲突标记 `disputed` 并进入对账。
- `unknown` 表示没有足够信息，不得等价为“未发生”。

### 3.4 事件关系

```text
EventRelationType = corrects | revokes | supersedes_estimate
```

- 实际事实更正使用 `corrects`，保留原事件并重新校验受影响区间。
- 撤销误报使用 `revokes`，不得物理删除原事件。
- 新 ETA/ETD 使用 `supersedes_estimate`；只替换当前预计投影，不改变旧记录。

## 4. 统一事件信封

`CanonicalLifecycleEventV1<TData>`：

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `eventId` | UUID | 是 | 全局唯一；同时作为 Outbox 事件 ID |
| `eventType` | registered event code | 是 | 必须来自事件码目录 |
| `eventVersion` | integer | 是 | V1 固定 `1` |
| `role` | `LifecycleEventRole` | 是 | 与事件目录登记一致 |
| `timeKind` | `LifecycleTimeKind` | 是 | 计划、预计、实际不可混用 |
| `occurredAt` | date-time | 是 | 该计划/预计/实际时间，ISO 8601 且带时区 |
| `recordedAt` | date-time | 是 | Logix 首次持久化时间 |
| `receivedAt` | date-time | 否 | 外部数据到达 Logix 的时间；外部采集必填 |
| `providerUpdatedAt` | date-time | 否 | 供应商声明的更新时间 |
| `eventSequence` | integer >= 1 | 是 | 同一货柜生命周期内的持久化顺序，不代表业务顺序 |
| `containerId` | UUID | 是 | `shipment-registry` 稳定货柜 ID |
| `flowInstanceId` | UUID | 是 | 生命周期实例 ID |
| `nodeCode` | registered node code | 是 | 归属节点；子里程碑仍归属一个节点 |
| `nodeInstanceId` | UUID | 是 | 节点实例；重入时不得复用旧实例 |
| `nodeTaskId` | UUID | 否 | 引发或对账到的节点任务 |
| `workOrderId` | UUID | 否 | 引发或被事实完成的工单 |
| `domain` | string 1..64 | 是 | 事实所有者模块 |
| `domainFactId` | UUID | 是 | 专业模块不可变规范事实 ID |
| `domainFactType` | string 1..64 | 是 | 专业事实类型 |
| `correlationId` | UUID | 是 | 一次业务链路关联 ID |
| `causationId` | UUID | 否 | 直接原因事件/命令 ID |
| `idempotencyKey` | string 1..200 | 是 | 规范事实业务幂等键 |
| `source` | `LifecycleEventSourceV1` | 是 | 来源、映射和验证信息 |
| `location` | `LifecycleLocationV1` | 否 | 港口/场站/仓库及航段语义 |
| `evidenceRefs` | unique UUID[] | 是 | `actual` 至少一条；预计可为空 |
| `relation` | `LifecycleEventRelationV1` | 否 | 更正、撤销或预计替换关系 |
| `data` | discriminated object | 是 | 按事件码注册的载荷 Schema |

`eventSequence` 只提供稳定游标和审计顺序。时间线业务排序必须使用 `occurredAt,eventSequence,eventId`，不能按接收先后推断发生先后。

### 4.1 `LifecycleEventSourceV1`

```text
sourceSystem: string(1..64)
authoritySystem: string(1..64)
provider?: string(1..64)
providerVersion?: string(1..64)
interfaceCode?: string(1..100)
sourceEventId?: string(1..200)
mappingVersion?: string(1..100)
captureSource: CaptureSource
authorityLevel: AuthorityLevel
verificationState: VerificationState
confidenceState: ConfidenceState
actorId?: UUID
```

人工补录必须有 `actorId`；外部码必须有 `provider/interfaceCode/mappingVersion`。未知外部值进入映射复核队列，不得使用默认事件码。

### 4.2 `LifecycleLocationV1`

```text
locationType: port | terminal | rail_yard | warehouse | depot | in_transit
unlocode?: uppercase string(5)
locationId?: UUID
segmentId?: UUID
portCallId?: string(1..200)
timezone: IANA timezone
```

事件必须足以区分起运港、中转港、目的港和多段运输。无法确认位置或时区的外部观察可以保存，但不得直接形成规范实际事件。

### 4.3 `LifecycleEventRelationV1`

```text
relationType: EventRelationType
relatedEventId: UUID
reasonCode: string(1..64)
reason: string(1..500)
authorizedBy?: UUID
```

更正或撤销实际事件必须经过服务端授权，并保存原因、操作者和审计事件。

## 5. 时间语义与记录规则

| 代码 | 含义 | `timeKind` | 典型节点 | 推进资格 |
| --- | --- | --- | --- | --- |
| `STA` | 计划抵达 | planned | 中转/到港 | 无 |
| `ETA` | 预计抵达 | estimated | 海运/中转/到港 | 无 |
| `ATA` | 实际抵达 | actual | 中转/到港 | 核验后有 |
| `STD` | 计划离开 | planned | 离港/中转 | 无 |
| `ETD` | 预计离开 | estimated | 离港/中转 | 无 |
| `ATD` | 实际离开 | actual | 离港/中转 | 核验后有 |
| `ETB/ATB` | 预计/实际靠泊 | estimated/actual | 到港子里程碑 | 默认不直接推进 |

记录必须同时保留：原始时间文本、原始时区、解析后的带时区时间、UTC 持久化值、业务发生时间、供应商更新时间、接收时间和系统记录时间。无法确认时区时不得假定 UTC。

ETA/ETD 的每次变化均追加事件；当前预计取同一货柜、节点实例、事件类型和航段下最新有效版本，而不是覆盖历史。ATA/ATD 到达后，预计仍保留用于准点率和预测偏差分析，但 UI 当前实际优先。

## 6. 幂等、重复、乱序与冲突

### 6.1 业务幂等键

优先使用供应商稳定事件 ID：

```text
tenant + provider + interfaceCode + sourceEventId
```

没有稳定事件 ID 时使用版本化确定性指纹：

```text
tenant + containerId + nodeInstanceId + eventType + timeKind
+ occurredAt + location/segment + authoritySystem + normalized business reference
```

指纹算法版本必须保存。相同键、相同规范载荷哈希返回既有事件；相同键、不同哈希为冲突，不得覆盖。

### 6.2 处理规则

| 场景 | 处理 |
| --- | --- |
| 完全重复 | 幂等返回既有事件和投影版本 |
| 乱序/迟到 | 追加保存，按业务时间重放受影响节点区间 |
| 新预计 | 以 `supersedes_estimate` 关联旧预计，重算当前 ETA/ETD |
| 实际事实更正 | 新事件 `corrects` 旧事件，经授权后重放 |
| 撤销误报 | 新事件 `revokes` 旧事件；已密封区间进入人工纠偏 |
| 来源冲突 | 两条事实均保留，标记 disputed，不自动选择更方便的值 |
| 暂无数据 | 保存同步结果，不生成“未发生”事实，不清空现有投影 |

Outbox 发布至少一次，消费者 Inbox 幂等；消费者业务更新和 Inbox 完成必须在同一本地事务中。

## 7. 历史密封与人工纠偏

- 预计事件不密封历史。
- 实际状态证据经状态机接受后，密封该节点的有效事实版本；后续节点推进后，已越过区间默认不可原地修改。
- 外部更正可以随时被接收和留存，但修改已密封投影必须进入对账，展示“待纠偏”，不得静默倒退主链。
- 人工纠偏必须具有对象级权限、原因、至少一条证据、预期投影版本和完整审计；结果仍通过规范事件与同一状态机生效。
- 人工补录与外部事实具有相同业务语义，但保留不同 `captureSource`；同一 `domainFactId/idempotencyKey` 只能产生一次有效推进。

## 8. 当前投影算法

投影按货柜和 `flowInstanceId` 重建：

1. 读取事件流，以 `eventSequence` 作稳定游标。
2. 应用撤销和更正关系，得到有效事件集合；关系循环或目标不存在时失败并告警。
3. 按 `occurredAt,eventSequence,eventId` 排序；相同业务时间不得依赖数据库自然顺序。
4. 将 planned、estimated、actual 分槽聚合，不能跨槽覆盖。
5. 每个节点选择当前计划、当前预计和当前已确认实际；保留首见预计、最新预计及全部版本用于偏差分析。
6. 仅把核验通过且节点策略登记为 `completionEligible` 的实际有效事实交给生命周期状态机；按节点前置、时间单调、可选节点和联合守卫判断推进。
7. 输出当前节点、货柜状态、节点时间、异常/冲突、证据摘要和 `projectionVersion`。

任何投影都必须可从事件日志确定性重建。修复投影不得修改事实日志；算法升级保存 `projectionName/projectionVersion` 并通过同一 fixture 对拍。

## 9. 14 节点接受与推进矩阵

节点代码引用[生命周期节点目录 V1](./LIFECYCLE_NODE_CATALOG_V1.md)，事件码引用正式 V1 `EVENT_CODES`。本表只规定时间种类、事实接受和投影口径；实际转换唯一服从[生命周期状态机 V1](./CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)。

| # | 节点 | 接受的主要事件/时间 | 推进依据 | 不得误用 |
| --- | --- | --- | --- | --- |
| 1 | 备货 | `cargo_ready` actual | 一备货单一次有效完成确认，建柜后挂接 | 无箱号时不进入货柜时间线 |
| 2 | 装箱 | stuffed actual；gate_in 子里程碑 | 装箱定稿事实 | 预计进港不等于装箱 |
| 3 | 出运 | loaded actual | 已装载发运事实 | 订舱/船期不等于出运 |
| 4 | 离港 | departed/ATD actual | 实际离开起运港 | ETD 不推进 |
| 5 | 海运 | sailing actual；ETA estimated；transit_arrived/arrived actual | `sailing` 只表示进行中；实际抵达匹配的下一港完成海运阶段 | ETA 漂移不推进 |
| 6 | 中转港，可选 | transit_arrived/ATA、transit_departed/ATD | 匹配航段的实际离开事实；需要时先有同港到达事实 | 不得与目的港 ATA 合并 |
| 7 | 清关 | customs_filed、inspection、hold、hold_released、release | 全部必需案卷放行及无活动阻断 | 单证、同步成功不等于放行 |
| 8 | 到港 | arrived/ATA；berthed/ATB、discharged 子里程碑 | 目的港实际到达 | ETA/AIS 推算不推进 |
| 9 | 海铁，可选 | `rail_handover` actual | 铁路主体或铁路场站实际接收匹配货柜 | 订单受理、预约、计划或公路位置不等于铁路接收 |
| 10 | 拖卡提柜 | gate_out actual；available 前置 | 重柜实际出场且联合守卫通过 | 海关放行或可提不等于提柜 |
| 11 | 送仓 | delivered/warehouse_arrival actual | 有效 POD/签收的 delivered，或仓库/WMS/门岗权威到场事实 | 司机点击、GPS 围栏不等于交付完成 |
| 12 | 卸柜 | unloaded actual | 仓库卸货事实 | 到仓不等于卸柜 |
| 13 | 卸空 | unstuffed actual | 箱内卸净事实 | 部分卸货不等于卸空 |
| 14 | 还箱 | returned_empty actual | 空箱被指定场站接受 | 预约还箱不等于完成 |

异常事件 `hold/dumped/rolled/delay/overdue/cancelled` 与主链节点正交，由异常或专业状态机处理；只有批准的转换规则才能阻断、重入或终止流程。

节点 #1 已确认使用 `cargo_ready`，但只在真实箱号建柜后由备货事实挂接进入时间线；备货确认原始事实仍归 `booking-origin`。节点 #9 已确认使用 `rail_handover`，实际发生时间取铁路接收货柜时间，不取订单受理或预约时间。

## 10. 海关事实挂接

海关模块先形成不可变 `customs_fact`，再发布本信封：

```text
domain = customs-compliance
domainFactId = customsFactId
domainFactType = customs_filed | inspection | hold | hold_released | release
nodeCode = customs (#7)
nodeTaskId/workOrderId = 对应作业逻辑引用
evidenceRefs = 已验证海关证据
occurredAt = 海关业务发生时间
recordedAt = Logix 事实记录时间
```

- `release` 是清关节点的专业事实，不自动等于货柜已到港、可提或已提柜。
- 海关工单完成后，NodeTask 聚合发布规范结果；`lifecycle-control` 再检查全部必需案卷及活动阻断。
- 外部权威放行先到时可以先形成时间线事实，工单随后幂等补账；不得因为任务尚未创建而丢弃事实。
- 人工后补录同一海关事实使用相同业务键，只产生一次有效推进。

## 11. 查询投影与前端约束

### 11.1 `ContainerTimelineItemV1`

```text
eventId, eventType, eventVersion
containerId, flowInstanceId, nodeCode, nodeInstanceId
role, timeKind, occurredAt, recordedAt, receivedAt?
validity, confidenceState
sourceSummary, location?, evidenceRefs
relation?, domain, domainFactId
```

### 11.2 `ContainerTimeProjectionV1`

```text
containerId: UUID
flowInstanceId: UUID
currentNodeCode: registered node code
currentContainerState: registered lifecycle state
nodeTimes: [{nodeCode, plannedAt?, estimatedAt?, actualAt?, confidenceState}]
activeExceptions: [{eventId,eventType,nodeCode,severity}]
disputes: [{eventIds,reasonCode}]
projectionVersion: integer >= 0
asOf: date-time
```

列表必须分页，默认稳定排序 `occurredAt desc,eventSequence desc,eventId desc`，并提供不可超过平台上限的 `pageSize`。Web 只展示服务端返回的状态、证据和允许动作，不在前端重算状态机。预计与实际必须使用文字、图标或列名区分，不能只依赖颜色。

## 12. 错误码

时间线自身只定义采集、关系和投影错误；状态转换错误统一引用[生命周期状态机 V1 §14](./CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md#14-错误码)。

```text
TIMELINE_EVENT_INVALID
TIMELINE_TIMEZONE_UNKNOWN
TIMELINE_EVENT_DUPLICATE_CONFLICT
TIMELINE_EVENT_RELATION_INVALID
TIMELINE_PROJECTION_VERSION_CONFLICT
TIMELINE_MANUAL_REVIEW_REQUIRED
```

结构错误返回 400，对象不存在返回 404，状态/幂等/版本冲突返回 409，结构有效但业务前置不满足返回 422。错误响应必须包含稳定错误码和追踪 ID，不泄露载荷、SQL 或内部结构。

## 13. Schema、Fixture 与验收

实例化时由单一 JSON Schema 权威源生成或派生 TypeScript、OpenAPI 和需要的 Python 类型，禁止手工复制枚举。至少提供：

1. ETA 多次调整后 ATA 到达；预计历史保留且实际推进。
2. ATA 先于 ETA/申报结果到达；按业务时间正确重放。
3. 同一外部事件重复推送；只产生一次事实和推进。
4. 同一幂等键不同载荷；明确冲突。
5. 起运港、中转港、目的港同类事件；按航段准确归属。
6. AIS 推算到港；只形成 provisional 预计，不形成 ATA。
7. 实际事件更正、撤销及已密封历史的人工纠偏。
8. 外部事实先到、工单后建；工单幂等补账且主链不重复推进。
9. 海关放行但码头不可提；不得推进到已提柜。
10. 暂无数据、同步失败、重试、dead letter 和重放；不得清空既有事实。
11. 14 节点正常链、两个可选节点跳过、异常阻断和合法重入。
12. 从同一事件日志重复构建投影，结果和版本确定一致。

实现门禁包括 Contract Parity、状态机领域测试、真实 PostgreSQL 事务/约束测试、Adapter fixture、API 认证授权/幂等测试，以及货柜工作台桌面和移动端 E2E。

## 14. 后续实施顺序

```text
负责人批准节点/事件目录及本文
-> JSON Schema 单一权威源
-> TS/OpenAPI/Python 派生与 parity fixture
-> 时间线数据库结构与迁移设计
-> lifecycle-control Domain/Application
-> 各专业模块 Outbox 与 Adapter
-> 查询投影/API
-> 货柜工作台时间线
-> 全链路 E2E 与历史回放
```

实施仍须遵守唯一活动任务门禁；本文不修改当前任务状态，也不授权数据库或外部系统变更。
