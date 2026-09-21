# 货柜生命周期时间线契约 V1

> 状态：**正式 V1（负责人批准）** · 契约 ID：`GC-004` · 版本：`1.0.0` · 定稿日期：2026-09-10 · 所有者：生命周期域负责人（刘志高） · 实现所有者：`lifecycle-control` · 公共类型目标位置：`packages/contracts`
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

G6 已补齐事件信封条件、时间投影、节点应用和重放 Schema；当前运行时实施进度与尚未开放的时间种类由项目 P6 的统一日期事实 task brief 跟踪，不从本契约的目标语义反推已上线范围。

## 2. 单一权威与兼容性

| 内容          | 唯一来源                                                    | 本文职责                                              |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| 14 节点及顺序 | [生命周期节点目录 V1](./LIFECYCLE_NODE_CATALOG_V1.md)       | 引用并规定接受/推进方式；候选对照文档不再作为枚举来源 |
| 规范事件码    | [事件码目录](./EVENT_CODES.md)                              | 引用，不复制供应商码                                  |
| 日期投影别名  | [节点日期投影别名目录 V1](./NODE_TIME_FIELDS.md)            | 规定统一事实语义，不复制字段映射                      |
| 外部码映射    | [外部事件映射](./EXTERNAL_EVENT_MAPPING.md)及供应商 Adapter | 要求版本化映射与未知值隔离                            |
| 海关事件载荷  | [海关公共契约 V1](./CUSTOMS_PUBLIC_CONTRACT_DESIGN_V1.md)   | 通过专业事实引用挂接                                  |
| 数据库存储    | `database/schema.prisma` 与追加迁移                         | 本文定义公共语义，不把数据库实体当 DTO                |

这是新增公共契约。V1 实例化后，字段含义、枚举线值和事件版本不得静默改变；新增必填字段、收紧可空性、修改类型或重释既有事件必须发布 V2 并提供兼容期。进入 `D3` 只授权后续 Schema 实例化，不代表运行时、数据库或历史数据已经迁移。

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
milestone | evidence | prerequisite | exception
```

事件角色只描述事实用途，不授予转换权限。只有 `actual + effective` 且被状态机节点策略登记为 `completionEligible` 的事件具备申请推进资格；是否推进仍由来源、证据、节点状态机及联合守卫决定。

### 3.3 来源、权威与确认状态

来源、权威、验证、置信、有效性和采集方式的线值唯一引用[证据与来源权威契约 V1](./EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md)。时间线只消费这些裁决结果，不维护第二份枚举。

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

| 字段                 | 类型                       | 必填 | 规则                                            |
| -------------------- | -------------------------- | ---- | ----------------------------------------------- |
| `eventId`            | UUID                       | 是   | 全局唯一；同时作为 Outbox 事件 ID               |
| `eventCode`          | registered event code      | 是   | 必须来自事件码目录                              |
| `eventVersion`       | integer                    | 是   | V1 固定 `1`                                     |
| `role`               | `LifecycleEventRole`       | 是   | 与事件目录登记一致                              |
| `timeKind`           | `LifecycleTimeKind`        | 是   | 计划、预计、实际不可混用                        |
| `occurredAt`         | date-time                  | 是   | 该计划/预计/实际时间，ISO 8601 且带时区         |
| `recordedAt`         | date-time                  | 是   | Logix 首次持久化时间                            |
| `receivedAt`         | date-time                  | 否   | 外部数据到达 Logix 的时间；外部采集必填         |
| `providerUpdatedAt`  | date-time                  | 否   | 供应商声明的更新时间                            |
| `eventSequence`      | integer >= 1               | 是   | 同一货柜生命周期内的持久化顺序，不代表业务顺序  |
| `tenantId`           | UUID                       | 是   | 租户边界；所有引用对象必须属于同一租户          |
| `containerId`        | UUID                       | 是   | `shipment-registry` 稳定货柜 ID                 |
| `flowInstanceId`     | UUID                       | 是   | 生命周期实例 ID                                 |
| `nodeCode`           | registered node code       | 是   | 归属节点；子里程碑仍归属一个节点                |
| `nodeInstanceId`     | UUID                       | 是   | 节点实例；重入时不得复用旧实例                  |
| `nodeTaskId`         | UUID                       | 否   | 引发或对账到的节点任务                          |
| `workOrderId`        | UUID                       | 否   | 引发或被事实完成的工单                          |
| `domain`             | string 1..64               | 是   | 事实所有者模块                                  |
| `domainFactId`       | UUID                       | 是   | 专业模块不可变规范事实 ID                       |
| `domainFactType`     | string 1..64               | 是   | 专业事实类型                                    |
| `authorityPolicyRef` | string 1..200              | 是   | 服务端实际采用的来源权威策略及版本引用          |
| `correlationId`      | UUID                       | 是   | 一次业务链路关联 ID                             |
| `causationId`        | UUID                       | 否   | 直接原因事件/命令 ID                            |
| `idempotencyKey`     | string 1..200              | 是   | 规范事实业务幂等键                              |
| `source`             | `LifecycleEventSourceV1`   | 是   | 来源、映射和验证信息                            |
| `location`           | `LifecycleLocationV1`      | 否   | 港口/场站/仓库及航段语义                        |
| `evidenceRefs`       | unique UUID[]              | 是   | `actual` 至少一条；预计可为空                   |
| `confidenceState`    | registered confidence code | 是   | 规范事实采用结论；`provisional/disputed` 不推进 |
| `validity`           | registered validity code   | 是   | 当前事件版本的有效性；更正和撤销保留原事件      |
| `relation`           | `LifecycleEventRelationV1` | 否   | 更正、撤销或预计替换关系                        |
| `data`               | discriminated object       | 是   | 按事件码注册的载荷 Schema                       |
| `traceId`            | string 1..128              | 是   | 贯穿接收、裁决、应用和投影的追踪 ID             |

`eventSequence` 只提供稳定游标和审计顺序。时间线业务排序必须使用 `occurredAt,eventSequence,eventId`，不能按接收先后推断发生先后。

`nodeCode/nodeInstanceId` 表示事件事实的默认归属，不等于状态机的节点应用目标。对 `arrived`、`transit_arrived` 等可跨节点申请完成的事件，状态机必须另存目标 `targetNodeInstanceId`，并按 `(eventId,targetNodeInstanceId)` 幂等应用；目标仍须通过完成资格、当前节点、航段、地点和时间守卫。

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

| 代码      | 含义          | `timeKind`       | 典型节点       | 推进资格       |
| --------- | ------------- | ---------------- | -------------- | -------------- |
| `STA`     | 计划抵达      | planned          | 中转/到港      | 无             |
| `ETA`     | 预计抵达      | estimated        | 海运/中转/到港 | 无             |
| `ATA`     | 实际抵达      | actual           | 中转/到港      | 核验后有       |
| `STD`     | 计划离开      | planned          | 离港/中转      | 无             |
| `ETD`     | 预计离开      | estimated        | 离港/中转      | 无             |
| `ATD`     | 实际离开      | actual           | 离港/中转      | 核验后有       |
| `ETB/ATB` | 预计/实际靠泊 | estimated/actual | 到港子里程碑   | 默认不直接推进 |

记录必须同时保留：原始时间文本、原始时区、解析后的带时区时间、UTC 持久化值、业务发生时间、供应商更新时间、接收时间和系统记录时间。无法确认时区时不得假定 UTC。

ETA/ETD 的每次变化均追加事件；当前预计取同一货柜、节点实例、事件类型和航段下最新有效版本，而不是覆盖历史。ATA/ATD 到达后，预计仍保留用于准点率和预测偏差分析，但 UI 当前实际优先。

### 5.1 API、导入与人工录入统一日期事实链

> 负责人确认（2026-09-18）：货柜全生命周期日期可以从 API/Webhook、受控文件导入或人工界面进入；三种渠道必须复用同一日期事实命令、来源权威裁决、幂等与状态机守卫，渠道本身不授予事实权威。

```text
API / Webhook        受控文件导入        人工界面
      \                   |                 /
       -> 原始输入与渠道审计 -> 统一日期事实命令
       -> 对象/时区/事件/来源/证据/版本校验
       -> 追加保存日期事实并更新当前时间投影
       -> confirmed actual 才生成或引用规范事件
       -> lifecycle-control 按前序、适用性与状态机推进
```

| 入口          | 必须额外保留                                                                 | 禁止行为                                               |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| API / Webhook | 原始载荷、provider、interface、来源事件 ID、映射版本、Inbox messageId 和哈希 | 供应商字段直接覆盖当前日期或货柜状态                   |
| 受控文件导入  | 文件/批次/原始行、有效映射、预检、操作者、逐行结果和对账                     | 未预检落账、按最后一行覆盖、导入状态直接推进生命周期   |
| 人工界面      | actorId、原因、对象级权限、证据、expectedVersion 和幂等键                    | 直接改库、无证据补实际、用页面成功或服务器时间冒充发生 |

受控导入落备货单、产品明细和原始时间事实时，必须在同一本地事务写入日期事实 Inbox 命令；任一写入失败则整体回滚。Inbox 消费者只调用统一日期事实用例，并把日期事实落账与 Inbox `processed` 在同一事务确认。导入审核只证明文件通过预检，不等于来源权威核验；导入的实际日期先以 `pending/unknown` 留账并进入复核，不直接推进生命周期。

三种入口统一输出日期事实，而不是直接输出货柜状态：

- `planned`：追加计划版本并更新当前计划投影，不完成节点。
- `estimated`：追加预计版本并通过 `supersedes_estimate` 取代当前预计投影，不完成节点。
- `actual`：先保存实际声明；只有 `verified + confirmed + effective`、命中唯一来源策略且业务守卫通过时，才有资格形成规范事件并申请完成节点。
- 前序尚未满足的合格实际事实保存为 `pending_application`；前序或适用性变化后按原业务幂等键重放，不丢弃、不跨站硬跳。
- 待应用事实以 `occurredAt,projectionVersion,id` 稳定排序并通过短租约领取；生命周期事件成功或节点适用性变化后触发同柜重放。409/412 与暂时性依赖错误释放租约后保留 pending，永久业务拒绝转 rejected；每次仍使用原事实的稳定幂等键。
- 人工录入的 `actual` 初始保存为 `pending + unknown + review_required`。复核队列只暴露租户内当前人工实际声明，并实时展示证据资格；批准要求 `evidence.review`、原录入人与复核人分离、全部证据 `verified + effective` 以及当前货柜投影版本。批准不得原地修改旧事实，而是通过 `supersedesFactId` 追加 `verified + confirmed + effective` 版本，再调用同一来源权威裁决、生命周期应用和 pending 重放链；审批页面或“证据已核验”本身均不等于过站。
- 更正和撤销追加关系记录；不得原地覆盖事实、证据或已密封历史。

对外写入口不得直接调用生命周期事件应用能力。`ApplyLifecycleEvent` 是统一日期事实和专业事实核验后的内部能力；开发或运维接口也必须执行相同的时间种类、来源权威、证据和授权守卫。

### 5.2 14 节点日期投影目录 V1

> 负责人确认（2026-09-18）：14 个管道节点至少保留计划和实际两个日期槽；只有存在可靠业务来源时才提供滚动预计。这里的字段名是查询/API/UI 投影别名，不是物理列，也不是新的事件码。

统一持久化键为：

```text
containerId + nodeCode + eventCode + timeKind + occurredAtUtc
```

完整的 14 节点别名与正式事件码映射唯一登记在 [节点日期投影别名目录 V1](./NODE_TIME_FIELDS.md)；本契约不复制第二份映射。投影别名只能由 `nodeCode + eventCode + timeKind` 显式得到，禁止依赖偶然同名。一个节点存在多个到/离事件或航段时，还必须用 `eventCode + segmentId/location` 消歧；不得把多个事实压成一个可覆盖日期。

### 5.3 子里程碑日期

下列时间不是第 15 个节点，继续使用正式 `eventCode` 挂在所属节点和航段；未登记事件码的业务语义必须先经事件目录评审，不能由界面或供应商字段临时造码：

- 提空箱 `empty_picked_up`，重柜进港/进场 `gate_in`，装船 `loaded`，开航 `sailing`；
- 中转到港、卸船、装船、离港；
- 靠泊 `berthed`，卸船 `discharged`，可提 `available`；
- 海关申报、查验、扣留、解除及各主体放行；
- 铁路场站接收、发出，码头重柜出场 `gate_out`；
- 仓库门岗到达、POD 签收、WMS 接收；
- 卸柜开始、卸柜完成、卸空确认；
- 空箱场站接收。

同一业务动作既是节点完成事件又是运营子里程碑时只保存一条规范事实，由不同投影消费，禁止重复造事实。

### 5.4 截止日期与免费期

截止日期和计算结果不属于 `LifecycleDateFact` 的发生事实，不得生成节点完成事件：

- 开港、截港、截单、截关；
- 最晚提柜日 `latestPickupAt`、最晚送仓日、最晚卸柜日、最晚还箱日 `latestReturnAt`；
- 免费期起止时间。

这些值由对应计划、港口或费用专业模块按自己的版本和依据管理，时间线只读投影。尤其禁止把最晚提柜日当计划提柜日、把 ETA 当 ATA，或用默认免费天数编造截止日。

### 5.5 日期事实最小证据字段

统一日期事实至少保存下列业务键、来源和审计信息；公共 Schema 可以按对象分组，但不得丢失其语义：

```text
containerId
nodeCode
eventCode
timeKind
occurredAtUtc
rawValue
sourceUtcOffset
sourceSystem
authoritySystem
provider
ingestionChannel
captureSource
evidenceRefs
verificationState
confidenceState
validity
authorityPolicyRef
idempotencyKey
mappingVersion
sourceEventId
interfaceCode
recordedAt
receivedAt
supersedesFactId
traceId
```

`occurredAtUtc` 是领域语义名；V1 公共命令字段仍为带偏移的 ISO 8601 `occurredAt`，入库时规范化到 UTC 的 `occurred_at`，不得另造同义公共字段。外部值还应在可获得时保存原始时区名称、原始载荷引用、供应商更新时间和地点/航段。`ingestionChannel` 使用公共线值：API 为 `api`，Webhook 为 `webhook`，文件导入为 `file_import`，人工界面为 `manual_ui`；渠道只说明怎么进入系统，不决定谁更可信。

### 5.6 当前运行时实施边界

规范事件目录已为所有节点完成资格事件开放 `planned | estimated | actual`，统一日期事实用例按目录拒绝未知组合，并保证 planned/estimated 不申请过站。只有服务端回读到 `actual + verified + confirmed + effective`、命中已采用来源策略且对象、事件、时间和证据完全一致的日期事实，内部生命周期入口才接受过站申请；规范事件和 Outbox 完整性哈希必须保留 `domainFactId/nodeCode/timeKind/authorityPolicyRef/location`。日期事实与规范事件分列保存 `locationType/unlocode/locationId/segmentId/portCallId/timezone`；`arrived/transit_arrived` 缺少可识别港口或航段时只保留 `pending_application`，不得过站。运行时按货柜当前有效 `OceanRoutePlan` 读取指定 `OceanRouteSegment`：`arrived` 必须命中最终航段目的港，`transit_arrived` 必须命中非最终航段目的港；路线缺失或不匹配时保留事实并等待路线补录或纠正，禁止把“字段存在”冒充“路线匹配”。工单完成和旧客户端/Inbox 直推事件均不得替代该事实链。开放时间种类不表示各入口、查询投影和界面已经采集全部日期；具体接入进度仍由 task brief 跟踪，禁止绕过统一用例直接写事实表。

权威海运路线通过同一个 `REPLACE_OCEAN_ROUTE` 写端口接收供应商 API 适配、受控文件导入和人工界面输入。写端口要求明确 UN/LOCODE、IANA 时区、连续航段、来源系统、证据、幂等键和预期路线版本；人工入口的租户、操作者、渠道和来源系统由服务端注入。每次更正追加新版本并在单事务内失效旧 active 版本，禁止覆盖历史。事务提交后自动重放本柜 `pending_application` 日期事实，但重放仍须重新通过来源权威、节点前序、阻断和当前路线匹配守卫。只有港口名称或旧 `routeCode`、缺少代码/时区/航段身份的导入数据不得自动提升为权威路线，应留在预检或人工映射环节。

## 6. 幂等、重复、乱序与冲突

### 6.1 业务幂等键

优先使用供应商稳定事件 ID：

```text
tenant + provider + interfaceCode + sourceEventId
```

没有稳定事件 ID 时使用版本化确定性指纹：

```text
tenant + containerId + nodeInstanceId + eventCode + timeKind
+ occurredAt + location/segment + authoritySystem + normalized business reference
```

指纹算法版本必须保存。相同键、相同规范载荷哈希返回既有事件；相同键、不同哈希为冲突，不得覆盖。

### 6.2 处理规则

| 场景         | 处理                                                  |
| ------------ | ----------------------------------------------------- |
| 完全重复     | 幂等返回既有事件和投影版本                            |
| 乱序/迟到    | 追加保存，按业务时间重放受影响节点区间                |
| 新预计       | 以 `supersedes_estimate` 关联旧预计，重算当前 ETA/ETD |
| 实际事实更正 | 新事件 `corrects` 旧事件，经授权后重放                |
| 撤销误报     | 新事件 `revokes` 旧事件；已密封区间进入人工纠偏       |
| 来源冲突     | 两条事实均保留，标记 disputed，不自动选择更方便的值   |
| 暂无数据     | 保存同步结果，不生成“未发生”事实，不清空现有投影      |

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

| #   | 节点         | 接受的主要事件/时间                                           | 推进依据                                                 | 不得误用                                     |
| --- | ------------ | ------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| 1   | 备货         | `cargo_ready` actual                                          | 一备货单一次有效完成确认，建柜后挂接                     | 无箱号时不进入货柜时间线                     |
| 2   | 装箱         | stuffed actual；gate_in 子里程碑                              | 装箱定稿事实                                             | 预计进港不等于装箱                           |
| 3   | 出运         | loaded actual                                                 | 已装载发运事实                                           | 订舱/船期不等于出运                          |
| 4   | 离港         | departed/ATD actual                                           | 实际离开起运港                                           | ETD 不推进                                   |
| 5   | 海运         | sailing actual；ETA estimated；transit_arrived/arrived actual | `sailing` 只表示进行中；实际抵达匹配的下一港完成海运阶段 | ETA 漂移不推进                               |
| 6   | 中转港，可选 | transit_arrived/ATA、transit_departed/ATD                     | 匹配航段的实际离开事实；需要时先有同港到达事实           | 不得与目的港 ATA 合并                        |
| 7   | 清关         | customs_filed、inspection、hold、hold_released、release       | 全部必需案卷放行及无活动阻断                             | 单证、同步成功不等于放行                     |
| 8   | 到港         | arrived/ATA；berthed/ATB、discharged 子里程碑                 | 目的港实际到达                                           | ETA/AIS 推算不推进                           |
| 9   | 海铁，可选   | `rail_handover` actual                                        | 铁路主体或铁路场站实际接收匹配货柜                       | 订单受理、预约、计划或公路位置不等于铁路接收 |
| 10  | 拖卡提柜     | gate_out actual；available 前置                               | 重柜实际出场且联合守卫通过                               | 海关放行或可提不等于提柜                     |
| 11  | 送仓         | delivered/warehouse_arrival actual                            | 有效 POD/签收的 delivered，或仓库/WMS/门岗权威到场事实   | 司机点击、GPS 围栏不等于交付完成             |
| 12  | 卸柜         | unloaded actual                                               | 仓库卸货事实                                             | 到仓不等于卸柜                               |
| 13  | 卸空         | unstuffed actual                                              | 箱内卸净事实                                             | 部分卸货不等于卸空                           |
| 14  | 还箱         | returned_empty actual                                         | 空箱被指定场站接受                                       | 预约还箱不等于完成                           |

异常事件 `hold/dumped/rolled/delay/overdue/cancelled` 与主链节点正交，由异常或专业状态机处理；只有批准的转换规则才能阻断、重入或终止流程。

节点 #1 已确认使用 `cargo_ready`，但只在真实箱号建柜后由备货事实挂接进入时间线；备货确认原始事实仍归 `booking-origin`。节点 #9 已确认使用 `rail_handover`，实际发生时间取铁路接收货柜时间，不取订单受理或预约时间。

## 10. 海关事实挂接

海关模块先形成不可变 `customs_fact`，再发布本信封：

```text
domain = customs-compliance
domainFactId = customsFactId
domainFactType = customs_filed | inspection | hold | hold_released | release
nodeCode = customs_clearance (#7)
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
eventId, eventCode, eventVersion
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
activeExceptions: [{eventId,eventCode,nodeCode,severity}]
disputes: [{eventIds,reasonCode}]
projectionVersion: integer >= 0
asOf: date-time
```

列表必须分页，默认稳定排序 `occurredAt desc,eventSequence desc,eventId desc`，并提供不可超过平台上限的 `pageSize`。Web 只展示服务端返回的状态、证据和允许动作，不在前端重算状态机。预计与实际必须使用文字、图标或列名区分，不能只依赖颜色。

## 12. 错误码

时间线及状态转换错误统一引用[公共错误契约 V1](./PUBLIC_ERROR_CONTRACT_V1.md)。本文件只负责采集、关系、投影和时间语义的领域触发条件。

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
GC-001 / GC-003 / GC-002 / GC-004 业务语义已批准
-> 补齐 JSON Schema 单一权威源
-> TS/OpenAPI/Python 派生与 parity fixture
-> 时间线数据库结构与迁移设计
-> lifecycle-control Domain/Application
-> 各专业模块 Outbox 与 Adapter
-> 查询投影/API
-> 货柜工作台时间线
-> 全链路 E2E 与历史回放
```

P6.1 已由生命周期域负责人刘志高签署，Codex 完成技术边界复核；G6 随后完成 JSON Schema、覆盖索引及正负向 fixture 自校验，`GC-004` 已进入 `D4`。生成类型、实现、迁移和运行验证仍待 G7；本文不授权数据库或外部系统变更。
