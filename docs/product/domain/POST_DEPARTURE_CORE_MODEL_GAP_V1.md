---
status: accepted-implementation-baseline
version: 1.6
review_date: 2026-09-24
technical_review: complete
source_field_review: registered
owners: product + shipment-registry + lifecycle-control + integration-import + customs-compliance + inland-fulfillment + document-records + charges-settlement
---

# 出运后核心边界与现状/目标模型差异 V1

> 消费者：产品负责人、数据库评审人、迁移作者、Shipment/Lifecycle/Import 模块负责人。
> 使用时机：决定下一批数据库迁移、导入改造和工作台优先级之前。
> 权威边界：本文固定业务范围和目标模型决策；当前物理事实仍以
> [`DATABASE_SCHEMA_CONTRACT_V1`](../../architecture/DATABASE_SCHEMA_CONTRACT_V1.md)、
> [`database/schema.prisma`](../../../database/schema.prisma) 与迁移历史为准。

## 1. 评审结论

当前产品核心确定为“已实际出运后的在途与到港生命周期”。计划、采购、分仓、供应商组合、备货单生成/下发、提空箱和现场装箱属于上游履约准备；当前系统只保存其稳定引用和来源血缘，不实现上游状态机或虚构规则。

现有数据库尚未实现该边界：它没有独立 `shipment` 聚合，导入按备货单号分组并创建 `not_shipped` 货柜，随后立即初始化一柜一流程。这个实现不能可靠表达“一次已出运事实包含多柜、多货物行、多上游单据和多份运输单证”。

以下决定已经负责人批准。本文保留评审时的现状判断；当前实施进展以任务 brief、数据库统一契约和可执行契约目录为准：

| 决策码 | 决定                                                                 | 理由                                                                                          |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PD-01  | 新增独立 `shipment` 聚合                                             | 出运、货柜和 SKU 是不同粒度；当前没有出运级身份、来源、路线和并发版本                         |
| PD-02  | 新增版本化 `shipment_container_link`                                 | 一票可多柜；一个柜次同一时刻最多属于一个活动 Shipment；关系需保存版本、来源与纠偏历史         |
| PD-03  | 新增 `shipment_cargo_line`                                           | 已出运货物必须能脱离备货单存在；备货单行只作为可选上游血缘                                    |
| PD-04  | 复用并扩展 `container_cargo_allocation_set/allocation`               | 现有版本链、幂等和一柜多行基础有效；目标引用改为出运货物行并补数量、件数、重量、体积          |
| PD-05  | 新增 `shipment_transport_document`                                   | 真实样本一张总提单对应多个分提单，主/分提单不能堆成 `shipment` 单值列或文本列表               |
| PD-06  | 新增 `shipment_upstream_reference`                                   | 一个出运可引用多个计划、备货、装箱和采购对象；引用上游身份，不复制上游规则                    |
| PD-07  | `shipment.current_lifecycle_status + lifecycle_version` 只作事件投影 | 当前状态用于查询；不可变事实、应用结果和纠偏历史仍由生命周期事件拥有                          |
| PD-08  | 保留现有一柜一 `FlowInstance`                                        | 提柜、卸柜、还箱等事实按柜发生；Shipment 投影不得替代柜级流程                                 |
| PD-09  | 规范事件需支持 shipment/container 两种主体                           | 离港、航次抵港可属出运；提柜、卸空、还箱属货柜。具体公共契约变更须单独评审                    |
| PD-10  | 现有备货工作台降为上游辅助面                                         | 不再作为当前核心入口，不继续扩建上游业务闭环；已有未提交实现先保留供处置评审                  |
| PD-11  | 新 Shipment 使用版本化 `post_departure` 流程配置                     | 当前 Flow 固定从 `cargo_ready` 开始；目标不得为上游备货、装箱和派运创建空壳节点或伪造完成事实 |
| PD-12  | 四张维护表的全部业务字段组成 Shipment V1 字段覆盖下限                | 字段必须进入受控词汇和明确所有者；不等于复制四张物理表，也不等于首日全部必填                  |
| PD-13  | “货柜清关物流状态详情”只作只读 `container_operational_view`          | 十张详情表是四域事实的拼接快照；不得成为第五个写模型或反向回写来源域                          |
| PD-14  | 新字段必须经字段注册和版本升级进入，禁止无约束 JSONB                 | 稳定事实使用强类型列/关系；重复事实使用版本化行；稀疏扩展也必须有定义、类型、所有者和校验     |
| PD-15  | 当前文件导入与未来平台接入共用 `ShipmentHandoffCommandV1`            | Adapter 只负责来源解析和显式映射；所有来源进入同一个预检、接收、幂等和对账用例                |
| PD-16  | 交接记录版本化、不可变并带接收方确认                                 | 每次提交保存来源身份、版本、规范载荷哈希、证据和逐对象结果；更正通过 superseding 版本完成     |
| PD-17  | Shipment 核心落账与生命周期/专业域吸收采用本地事务 + Outbox/Inbox    | 不建立跨模块巨型事务；`accepted` 只表示核心事实提交，不冒充生命周期、清关或仓库投影已就绪     |
| PD-18  | 备货完成、装箱完成快照只作为未来上游交接契约                         | 当前不实施采购、备货或装箱平台；已有柜级装箱快照仅作模式复用，不反向扩大当前产品边界          |
| PD-19  | Shipment 业务身份由起运地、目的地、运输责任和货物范围共同界定        | MBL、Booking、货柜或 SKU 均只是身份依据或子对象，不能单独替代 Shipment                        |
| PD-20  | 缺失业务字段默认建档并形成待补事项                                   | 现实业务先运行；仅内部主键、必需外键/租户引用或对象冲突导致对应对象失败，缺口不冻结整票       |
| PD-21  | 无 SKU 明细允许进入 `departed` 流程                                  | SKU 完整度与运输生命周期正交；后补明细不得改写已发生的出运事实                                |
| PD-22  | 四类来源可独立上传，单文件原子、跨文件独立、冲突逐柜处理             | 文件接收完整性、跨源归组和业务接管是三层边界，不能用一个全局事务混为一谈                      |
| PD-23  | 只有日期的出运事实按来源当地 `00:00` 补时并保留精度                  | 保存原始日期、来源时区、`date_only` 和规则版本；不得把系统补时展示成来源提供的精确时刻        |
| PD-24  | 清关资料要求和接收方路由由可维护主数据驱动                           | 各国要求、清关公司和 To/CC/Contact 不堆入 Shipment；传送、回执和放行保持不同事实              |

### 1.1 Shipment 粒度评审

**已批准：Shipment 表示一个租户内、已经实际离港，并由起运地、目的地、运输责任和货物范围共同界定的运输组织单元。** 它覆盖从起运港离港到最终交付/关闭的同一执行，是计划引用、订舱、单证、货柜和到港执行的核心串联对象，不是计划、Booking、MBL/HBL、货柜或 SKU 的别名。主要承运单证仍是优先匹配依据，但不是业务定义本身。

| 候选粒度          | 结论               | 原因                                                                                                                |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 出运计划          | 否决               | 属于出运前履约，会因分仓、拼柜和延期持续变化；不能证明实际运输已发生                                                |
| 单个 HBL/商业分票 | 否决为 Shipment 根 | 真实样本一个 MBL 下有 4 个 HBL；以 HBL 为根会复制航次和柜级生命周期。未来需要独立 SLA 时可增加 `consignment` 子对象 |
| 物理箱号          | 否决               | 箱号会跨运输重复使用；箱号不是出运身份                                                                              |
| MBL/主运输执行    | **采用**           | 能稳定聚合主路线、多个柜、多个 HBL 和货物；与实际离港准入一致                                                       |

身份规则：

- `shipment.id` 使用不可解释 UUID；更正业务号、单证或来源版本不改变 ID。
- 第一优先幂等键是 `tenant_id + source_system + source_record_id`。
- 没有稳定外部 Shipment ID 时，系统仍可生成内部 UUID 并以导入来源血缘建立待补档案；`tenant_id + carrier_code + normalized_master_bill_number` 只作候选匹配和冲突检索键，不能冒充来源身份。多匹配、跨租户引用或活动对象冲突只阻断受影响对象；缺承运人、MBL 或其他业务维度进入身份完整度待补。
- `shipment_number` 是租户内稳定的内部业务号，唯一但不是主键；不得直接复用上游计划号。
- 多 HBL、多个上游备货单和多个柜是 Shipment 的子关系；它们的更正使用追加版本，不复制 Shipment。

因此真实样本可先建立内部 Shipment 档案；`NBOZ9FF56400`、承运人和路线在资料补齐后共同增强业务身份确定性。`SP20260830` 仍是上游计划引用，`A/B/C/D` 是其运输单证，不得把任一单值直接当成 Shipment 本身。

### 1.2 柜侧活动基数评审

**推荐批准：一个 Shipment 可关联多个 ContainerRecord；一个 ContainerRecord 在同一时刻最多关联一个活动 Shipment。** `ContainerRecord` 的粒度是一次柜次，不是永久集装箱主档。同一物理箱号下一次运输必须创建新的 ContainerRecord，而不是复用已关闭柜次。

采用关系表而不是 `container_record.shipment_id`，原因是关系需要来源、证据、幂等、更正和历史版本。目标约束：

| 约束                              | PostgreSQL 目标                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| 同一关系只有一个当前版本          | partial unique `(tenant_id, shipment_id, container_record_id) WHERE superseded_at IS NULL`         |
| 一个柜次最多属于一个活动 Shipment | partial unique `(tenant_id, container_record_id) WHERE superseded_at IS NULL AND state = 'active'` |
| 同箱号不得有两个未关闭柜次        | canonical 箱号 + partial unique `(tenant_id, container_number) WHERE closed_at IS NULL`            |
| 跨租户关系禁止                    | Shipment、Container 和 Link 使用 `(id, tenant_id)` 复合 FK                                         |
| 更正不可覆盖                      | 锁定柜次和当前 link，新增 superseding link；原 link 写 `superseded_at`                             |
| 并发不得后写覆盖                  | Shipment `relationship_version` + `expectedVersion`；唯一冲突转换为稳定业务冲突码                  |

这些 partial unique 必须写在追加迁移 SQL 中；Prisma schema 只保留可表达部分，并由迁移验证器防止漂移。未来若要独立管理同柜拼装的多个商业委托，应新增 `consignment`，不能放宽柜次同时归属多个 Shipment，否则柜级事件、责任和关闭口径会歧义。

### 1.3 事件主体评审

**推荐批准：发布新的 `CanonicalEventEnvelopeV2`，以 `subject: EntityRef` 取代 V1 强制 `containerId` 的主体语义；V1 不改义并在兼容期继续接收。** 这是行为变更，不能直接把 V1 的可选字段改成 Shipment。

V2 最小公共形态：

```text
envelopeVersion = 2
eventId, eventCode, eventVersion, tenantId
subject: EntityRefV1                 # shipment 或 container
occurredAt, recordedAt, timeKind
domainFactId, authorityPolicyRef, evidenceRefs
source, location, correlationId, causationId?, traceId
subjectVersion, scopeVersion?
```

主体规则：

| 事实类型                                                     | 主体                               | 应用方式                                                         |
| ------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------- |
| 主航次离港、航行、中转到离港、主航次抵港、航次变更/延误      | Shipment                           | 更新 Shipment 投影；按事件接受时冻结的柜关系范围申请柜级节点应用 |
| 进港、卸船、可提、柜级清关完成、提柜、送仓、卸柜、卸空、还箱 | Container                          | 只推进目标柜 Flow；Shipment 按版本化聚合规则投影                 |
| 扣留、查验、甩柜、改配等异常                                 | 实际受影响的 Shipment 或 Container | 与主状态正交；需跟进工作的异常另建 Case，不扩展主状态枚举        |

为保证重放确定性，Shipment 事件接受时保存 `scopeVersion`，并追加 `canonical_event_scope_member(event_id, container_record_id, shipment_container_link_id)` 快照。一个 Shipment 事件只保存一次；现有 `node_event_application` 可让同一事件分别应用到多个柜节点，不复制虚假来源事件。Shipment 自身的投影结果追加到 `shipment_event_application`，保存前后状态、规则版本、守卫结果和投影版本。

兼容策略：

1. V1 事件映射为 V2 `subject.entityType=container`，作用域只有该柜；V1 线值、`eventVersion=1` 和已存事件保持不变。只有主体语义改变的目录项才新增事件版本，不能把 envelope 版本冒充业务事件版本。
2. `common.EntityType` 加法新增 `shipment`、`shipment_cargo_line`、`shipment_transport_document`；`cross-module-reference` 登记所有者和新主链。
3. 事件目录新增版本化 `allowedSubjectTypes`，不得由消费者各自维护事件主体矩阵。
4. 数据库先增加 `tenant_id/subject_type/subject_id/event_version/scope_version`，回填 V1 后再允许 Shipment 事件；旧 `container_id` 在兼容期保留。
5. 受影响消费者包括 Lifecycle、Ocean Adapter、Work Execution、查询投影、Web 时间线、生成类型和 fixtures，必须同批完成 parity，不允许只改 JSON Schema。

### 1.4 `post_departure` 流程原子性评审

**推荐批准：采用“正式导入本地原子事务 + Outbox/Inbox 可恢复生命周期事务”，不建立跨模块巨型事务，也不在生命周期失败时删除真实 Shipment。**

```text
F0 integration-import（每个来源文件独立事务）
  保存完整原文件、解析结果、来源行和文件级错误
  COMMIT / ROLLBACK（单文件同成同败；其他文件不回滚）

T1 integration-import + shipment-registry（同库、每个确认接管单元一次事务）
  锁定已到来源快照/来源身份/本次选中的无冲突柜次
  -> 写 Shipment、Cargo、Document、UpstreamRef、ContainerLink、Allocation
  -> 写逐对象结果与接管记录 committed
  -> 写 shipment.lifecycle_initialization_requested Outbox
  COMMIT（本次 Shipment 及明确接管的柜关系同成同败）

T2 lifecycle-control（每 Shipment 一次 Inbox 本地事务）
  校验 Shipment/关系版本和 departed 事实
  -> 创建 post_departure_ocean V1 柜级 Flow
  -> 只实例化 origin_departure 至 empty_return
  -> 保存一次 Shipment departed V2 事件及柜范围快照
  -> 对每柜完成 origin_departure，当前节点进入 ocean_transit
  -> 写 NodeEventApplication、ShipmentEventApplication、Outbox、Inbox processed
  COMMIT（该 Shipment 所有柜同成同败）
```

原子边界与反馈规则：

- F0 保证同一文件不出现部分上传或部分解析结果；多个文件分别反馈，可随后参与联合预检。
- 预检按柜返回冲突。冲突柜留在待处理队列，无冲突柜可以进入接管选择；这不改变 F0 已保存的完整文件证据。
- T1 失败回滚本次确认接管的 Shipment 核心事实；不能保留未声明的半票关系。接管选择必须冻结所含柜和关系版本，后续补柜走追加更正。
- T1 由 Application 层 Unit of Work 编排，各模块仍经自己的公开写 Port 落账；不得让 Import Repository 直接写 Shipment 表，事务对象也不得泄漏到 Domain。
- T1 成功表示 Shipment 事实已提交，不表示生命周期投影已就绪。界面单独显示 `lifecycleInitializationState=pending|ready|manual_review`。
- T2 暂时失败按 GC-009 复用同一 messageId 重试；同 ID 异 payloadHash 冲突并告警。永久失败进入 dead letter 和人工对账。
- T2 不创建 `cargo_ready/container_stuffing/shipment_dispatch` 节点，也不把它们伪造为 completed/skipped。
- `StartLifecycleCommandV1` 保持原义；新增 `StartPostDepartureLifecycleCommandV2`，至少携带 `shipmentId/containerIds/flowDefinitionCode/definitionVersion/departureEventId/relationshipVersion/idempotencyKey/traceId`。
- Shipment 已实际离港是不可逆事实。生命周期初始化失败只能重试、纠偏或人工处理，不能补偿为删除 Shipment。
- 用户操作使用 GC-009 三阶段回执；`commitState=committed` 只代表 T1 已落账，下游就绪状态由结果引用或查询投影明确返回。

### 1.5 技术评审结论与批准门

核心方案在领域粒度、PostgreSQL 约束、V1 兼容和故障恢复上可实施，技术评审结论为 **建议批准**。进入公共契约和迁移设计前，负责人需确认以下业务取舍：

1. Shipment 采用 MBL/主运输执行粒度，HBL 作为子单证；未来独立委托通过 `consignment` 扩展。
2. 一个柜次同一时刻只属于一个活动 Shipment。
3. Shipment 级航次事件保存一次并投影到冻结的柜关系范围。
4. 正式导入提交与生命周期初始化允许可靠最终一致；页面明确区分“已落账”和“生命周期已就绪”。
5. 当前 Excel 与未来平台只通过同一个 `ShipmentHandoffCommandV1` 接收边界进入，不保留第二条直写路径。
6. 无稳定外部 Shipment ID 时生成内部 UUID 和来源血缘档案；承运人+MBL 只作候选检索，不自动冒充来源身份；多匹配只隔离冲突对象。
7. `accepted` 仅表示 Shipment 核心事务提交；生命周期、清关、内陆和仓库分别返回可观察的吸收状态。

### 1.6 与既有架构和在途任务的冲突检查

| 既有基线/任务                        | 结论                         | 冲突或承接方式                                                                                        |
| ------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ADR-010` 模块所有权、事件/Port 协作 | 一致                         | 四个来源域各写自己的权威事实；查询投影只能读，不跨域回写                                              |
| 生命周期时间线、Inbox/Outbox         | 一致                         | 时间与状态保留追加事实和可重放投影；Shipment 主体通过 V2 契约加法接入                                 |
| `QUERY_PROJECTION_CONTRACT_V1`       | 一致但需扩展                 | 新增 `container_operational_view` 查询投影，不改变命令端所有权                                        |
| 归档 P2 brief 的“一备货单一柜”       | **冲突，废止该基数**         | 以 `ReplenishmentOrder N:M Container` 和行级装载分配为准；历史文字只作决策轨迹                        |
| 当前 `TARGET_FIELD_CATALOG V1.2`     | **冲突，降为兼容入口**       | 它只描述当前按备货单导入的已实现字段；目标字段覆盖下限改由本文 §5.3–§5.9 约束，后续公共目录另发新版本 |
| 当前 Import/Flow 实现                | **冲突，待迁移**             | 当前按备货单分组、取首柜并从 `cargo_ready` 初始化；不得继续扩为目标实现                               |
| 备货工作台在途实现                   | 无数据破坏，但产品优先级改变 | 保留现有未提交改动；停止扩建上游闭环，后续单独决定收窄或延期                                          |

因此，本要求不推翻已接受的模块所有权、事件和可靠性架构；它修正的是旧业务基数、导入聚合根和字段覆盖范围。迁移与公共契约仍受 §9.3 批准门约束。

### 1.7 统一交接方案评审修正

“稳定业务身份 + 版本化交接快照 + 明确交接事件 + 接收方对账确认”与当前目标一致，但以下内容必须按现有权威架构修正后批准：

| 提案                                                | 评审结论       | 修正后的规则                                                                                        |
| --------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| Excel 与未来平台共用接收入口                        | 采用           | 两类 Adapter 只产生同一 `ShipmentHandoffCommandV1`，不得各自写业务表或复制规则                      |
| 接收服务一次写 Shipment、生命周期、清关、物流、仓库 | 修正           | T1 只原子提交交接记录和 Shipment 核心事实，并写 Outbox；生命周期及专业域在各自 Inbox 本地事务中吸收 |
| `actualDepartedAt` 固定必填                         | 修正           | 必须满足 §2.3 任一离港准入证据；`actualLoadedAt` 只证明已装船，不足以进入已出运                     |
| 无外部 Shipment ID 时按组合字段建档                 | 否决           | 组合字段只用于候选匹配；必须人工确认既有 Shipment 或授权创建                                        |
| 每柜携带清关/内陆/仓库对象                          | 采用为来源切片 | 命令可携带来源观察，但由相应所有者校验并落账；Shipment 模块不能成为这些事实的第二写所有者           |
| 一份提单数组足以表达关系                            | 不足           | 必须同时表达 `Shipment 1:N BillOfLading` 和 `Container N:M BillOfLading` 的显式关系                 |
| `draft` 是交接状态                                  | 修正           | 草稿属于 Adapter/ImportBatch；正式交接从 `received/submitted` 开始，避免把未提交草稿混成跨系统事实  |

兼容性分类是 **新增但行为关键的 V1 公共契约**：不修改现有 `container-stuffing-snapshot-v1`、`container-dispatch-snapshot-v1`、`CanonicalEventEnvelopeV1` 或 `StartLifecycleCommandV1` 的语义。新契约批准后必须新增 Schema、生成类型、OpenAPI/客户端、fixtures 和 parity 注册；旧入口在迁移期继续存在但停止扩展。

## 2. 范围与准入

### 2.1 当前系统负责

1. 导入、预检并确认已出运数据。
2. 建立出运、货柜、货物、运输单证和上游引用之间的权威关系。
3. 跟踪船期、节点、异常、证据和资料缺口。
4. 管理到港、清关、提柜、送仓、卸柜、卸空、还箱和关闭。
5. 保留来源原文、版本、操作者、变更、冲突和审计记录。

### 2.2 当前不负责

- 国别需求计算、采购、出运计划优化和分仓优化。
- 供应商组合、整柜/拼柜优化、备货单生成或下发。
- 提空箱和现场装箱作业执行。
- 为上述上游环节提前建立空壳状态机、任务或默认业务规则。

### 2.3 正式落账准入

每个正式 `shipment` 的运输生命周期从 `departed` 开始。以下任一事实可确认“已出运”；字段不完整时保留对应待补事项，不回退到 `loaded` 或出运前流程：

| 入口         | 必需事实                                        | 处理规则                                     |
| ------------ | ----------------------------------------------- | -------------------------------------------- |
| 实际离港     | 有 ATD、来源偏移、来源系统和可追溯证据          | 通过来源权威、时间和路线一致性校验后可落账   |
| 稳定外部状态 | 权威来源明确给出 `DEPARTED`，且来源记录身份稳定 | 映射必须版本化；未知或冲突状态进入人工处理   |
| 人工确认     | 有权限人员确认已出运                            | 必须保存操作者、原因、依据、确认时间和幂等键 |

“已订舱”“预计开船”“已装箱”均不等于已出运。来源明确声明已出运但日期、时区、港口、单证或 SKU 不完整时，可建立 `departed` Shipment 和缺口投影；只在来源仍处于出运前、对象无法建立内部身份、必需引用不成立或存在身份冲突时拒绝对应对象。当前导入创建 `not_shipped` 记录的行为不得延续为目标入口。

## 3. 业务粒度与关系

| 对象                     | 一行/一个实例代表什么                        | 目标关系                                                           |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| Shipment                 | 一次可被稳定识别并已实际出运的商业运输事实   | 关联 N 个柜、N 条货物、N 份运输单证和 N 个上游引用                 |
| ContainerRecord          | 某租户下一次货柜运输实例，不是永久物理箱主档 | 经关系表关联 Shipment；最多一个活动 Shipment；拥有独立柜级生命周期 |
| ShipmentCargoLine        | 本次 Shipment 中一个可对账货物行             | 可分配到多个柜；可选引用 Product/SKU 和上游备货行                  |
| ContainerCargoAllocation | 某个装载版本中，某货物行在某柜内的实际份额   | 保存数量、件数、重量和体积，不从整柜汇总反推                       |
| TransportDocument        | Booking、MBL、HBL 等运输单证身份             | Shipment 1:N；分提单可通过父引用挂到总提单                         |
| UpstreamReference        | 上游计划、备货、装箱、采购对象的外部身份     | 只存引用与来源版本，不复制其流程规则                               |
| CanonicalEvent           | 经来源权威校验的不可变事件事实               | 主体必须明确是 Shipment 或 Container                               |

真实样本 `NBOZ9FF56400` 下存在 `A/B/C/D` 四个分提单，证明单个 `house_bill_number` 列不成立。样本中的一单一柜也只是观察结果，不能推导正式基数。

## 4. 当前实现差异

| 当前表/实现                           | 当前粒度与约束                                                        | 与目标的差异                                             | 处置                                                           |
| ------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `container_record`                    | 一柜一档；含单值兼容 `order_number/replenishment_order_id`；无出运 FK | 被迫同时承担出运入口、货柜身份和备货锚                   | 保留柜级身份；兼容列冻结写入，完成回填后再讨论收缩             |
| `replenishment_order`                 | 租户内备货单号唯一                                                    | 上游对象被当作核心导入聚合                               | 保留为兼容/引用对象，不扩展上游流程                            |
| `replenishment_order_line`            | 备货单产品行，按批次版本化                                            | 不是独立的已出运货物行；没有 shipment 归属               | 保留上游快照；目标 ShipmentCargoLine 可选引用它                |
| `container_cargo_allocation_set`      | 每柜版本化装载集合                                                    | 版本模型可复用，但没有 Shipment 范围                     | 保留并增加出运范围校验                                         |
| `container_cargo_allocation`          | 强制引用备货单行，只保存数量+单位                                     | 缺独立出运行引用、件数、重量、体积                       | 加法扩展后回填，最终以 ShipmentCargoLine 为权威                |
| `container_import_binding`            | 批次内箱号到柜记录的绑定                                              | 只能防批次内歧义，不能判断不兼容活动出运                 | 保留导入技术绑定；新增 Shipment 冲突校验                       |
| `shipment_time_fact`                  | 名称是 shipment，实际强制指向 container                               | 粒度名实不符，不能保存出运级 ETD/ATD/ETA/ATA             | 先冻结语义；事件主体方案确认后再扩展或替换                     |
| `ocean_route_plan/segment`            | 路线计划只挂柜                                                        | 同一出运多柜会重复路线，无法表达出运级航次               | 目标支持 Shipment 主路线和必要的柜级偏离                       |
| `flow_instance/node_instance`         | `container_id @unique`；初始化固定从 `cargo_ready` 开始并创建 14 节点 | 同时缺 Shipment 投影，且把出运前三个上游节点带入当前核心 | 保留柜级流程；增加版本化流程配置，新记录只实例化出运后适用节点 |
| `lifecycle_date_fact/canonical_event` | 强制以 container 为主体                                               | 无法自然记录出运级离港/抵港事实                          | 公共契约评审后加法支持两种主体                                 |
| `import_batch/row/review/result`      | 有文件、批次、审核和逐行结果基础                                      | 字段目录和执行聚合仍以备货单为中心                       | 复用基础设施，替换目标字段、分组和正式写端口                   |
| `ExecuteImportService`                | 按 `orderNumber` 分组，取第一个箱号，逐单事务后初始化柜流程           | 不能归组 Shipment+多柜+多 SKU；整批可部分成功            | 目标改为 Shipment 草稿预检和显式提交策略                       |

## 5. 候选物理模型

以下是下一次数据库评审的候选结构，不代表表已存在。

### 5.1 `shipment`

| 字段族       | 候选字段                                                                                                                                       | 约束/索引                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 身份         | `id UUID`, `tenant_id`, `shipment_number`                                                                                                      | PK；`UNIQUE(tenant_id, shipment_number)`；业务号不可作 PK                                  |
| 来源         | `source_system`, `source_record_id`, `source_version`, `import_batch_id`                                                                       | `UNIQUE(tenant_id, source_system, source_record_id)`；无来源 ID 时由受控组合键产生幂等身份 |
| 运输         | `transport_mode`, `carrier_code`, `vessel_name`, `voyage_number`                                                                               | 稳定枚举/字典；不把供应商原始值直接升格                                                    |
| 路线         | `origin_country_code`, `origin_unlocode`, `destination_country_code`, `destination_unlocode`, `final_destination_type`, `final_destination_id` | 国家 ISO 3166-1 alpha-2；港口 UN/LOCODE；稳定查询列建索引                                  |
| 时间投影     | `etd_at`, `atd_at`, `eta_at`, `ata_at`                                                                                                         | 均为 `TIMESTAMPTZ`；来源原值、偏移、证据和历史保留在事实层                                 |
| 生命周期投影 | `current_lifecycle_status`, `lifecycle_version`, `relationship_version`                                                                        | 生命周期状态只由投影器更新；关系变更独立乐观并发；二者均可由历史重建                       |
| 审计         | `created_by`, `updated_by`, `created_at`, `updated_at`                                                                                         | 不允许匿名人工确认；更新时间索引用于稳定分页                                               |

`house_bill_number` 不进入本表；MBL 虽可作为常用查询投影，正式身份仍进入运输单证表，避免未来一票多 MBL 或改单时覆盖历史。

### 5.2 关系与明细表

| 表                                | 关键字段                                                                                                                                                                                                                                                                                   | 关键约束和索引                                                                                                                       | 所有者            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| `shipment_container_link`         | `id`, `tenant_id`, `shipment_id`, `container_record_id`, `version`, `state`, `supersedes_link_id`, 来源/证据/幂等/时间                                                                                                                                                                     | 同租户复合 FK；租户+幂等唯一；当前关系和一个柜次唯一活动 Shipment 使用 partial unique；Shipment 和 Container 两侧查询索引            | shipment-registry |
| `shipment_cargo_line`             | `id`, `tenant_id`, `shipment_id`, `line_no`, `product_sku_id?`, `product_number_snapshot`, `quantity`, `quantity_unit`, `package_count?`, `package_unit?`, `gross_weight?`, `weight_unit?`, `volume?`, `volume_unit?`, `destination_id?`, `replenishment_order_line_id?`, 来源行/版本/审计 | Shipment+line_no 唯一；来源身份唯一；数量为正；成对值/单位 CHECK；同租户 FK；SKU 跨模块由 Port 校验                                  | shipment-registry |
| `shipment_transport_document`     | `id`, `tenant_id`, `shipment_id`, `document_type`, `document_number`, `parent_document_id?`, 来源/版本/有效期                                                                                                                                                                              | Shipment+类型+号码+当前版本唯一；父文档同 Shipment/租户；按号码检索索引                                                              | shipment-registry |
| `shipment_upstream_reference`     | `id`, `tenant_id`, `shipment_id`, `shipment_cargo_line_id?`, `reference_type`, `source_system`, `source_record_id`, `source_version?`, `metadata?`                                                                                                                                         | `reference_type` 由受控目录治理，首批为 shipping_plan/stocking_order/packing_order/purchase_order；同 Shipment 复合 FK；来源身份去重 | shipment-registry |
| `container_cargo_allocation` 扩展 | `shipment_cargo_line_id?`, `package_count?`, `package_unit?`, `gross_weight?`, `weight_unit?`, `volume?`, `volume_unit?`                                                                                                                                                                   | 扩展阶段允许旧备货行或新出运行；目标阶段必须引用出运行；数量/单位和非负汇总 CHECK                                                    | shipment-registry |
| `container_record` 扩展           | `container_number_canonical?`, `closed_at?`, `version`                                                                                                                                                                                                                                     | canonical 箱号格式 CHECK；未关闭柜次 partial unique；`version` 用于关系命令乐观并发                                                  | shipment-registry |
| `canonical_event` 扩展            | `tenant_id`, `envelope_version`, `subject_type`, `subject_id`, `subject_version`, `scope_version?`                                                                                                                                                                                         | V1 柜事件回填 subject；主体时间线索引；旧 `container_id` 兼容期保留                                                                  | lifecycle-control |
| `canonical_event_scope_member`    | `event_id`, `tenant_id`, `container_record_id`, `shipment_container_link_id`                                                                                                                                                                                                               | event+container 唯一；event 使用模块内 FK，柜和 link 为跨模块逻辑引用并建立查询索引；冻结事件接受时的柜范围                          | lifecycle-control |
| `shipment_event_application`      | `event_id`, `tenant_id`, `shipment_id`, `state`, `previous_status`, `resulting_status`, `rule_version`, `guard_results`, `projection_version`, 时间字段                                                                                                                                    | event+shipment 唯一；Shipment+projection_version 唯一；待应用、拒绝和成功均留痕                                                      | lifecycle-control |
| `flow_instance` 扩展              | `flow_profile_code`, `flow_profile_version`                                                                                                                                                                                                                                                | 新 Shipment 只允许 `post_departure` 配置；配置版本不可随运行中流程静默改变                                                           | lifecycle-control |

稳定、需查询和需约束的字段使用正式列；`metadata/evidence_refs` 只承载低频扩展与证据引用，不能存容器号、SKU 列表或状态历史。

### 5.3 四张维护表字段覆盖基线

四张维护表是 **V1 业务词汇覆盖下限**，不是四张数据库表的设计模板。一个来源列进入系统时必须同时回答：规范语义是什么、谁拥有、保存在哪种粒度、是否允许空、在什么阶段/导入配置下必填、怎样校验以及如何追溯来源。

已对 `D:\Filez\刘志高\已出运货柜` 中 4 张维护表和 10 张详情表完成只读 OpenXML 核验。四张维护表共有 176 个字段出现位、146 个不同原始表头；十张详情表均为相同的 97 列投影。完整文件哈希、实际范围、逐列表头和非空统计见
[`POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923`](./evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json)。下表把全部原始列归入目标字段族；规范 `fieldCode` 和公共 DTO 仍须在负责人批准后通过新契约版本实例化。

字段有三个彼此独立的维度：

1. `vocabularyRequired`：四表出现的业务字段必须在 V1 词汇表中有位置，不能因当前为空而删除。
2. `storageNullable`：尚未发生、未知或不适用的事实可以为空；空值不能被默认值伪造。
3. `profileRequired`：只有特定导入配置或生命周期阶段要求该字段时才阻断提交。

| 字段族                  | 已确认来源字段/语义                                                                             | 权威对象与所有者                                                                       | 当前实现覆盖                      | V1 目标处置                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Shipment 身份与贸易     | 出运号、来源记录、目的国家、贸易模式、价格条款、币种、最终仓库组                                | `shipment` / shipment-registry                                                         | 缺失                              | 强类型列和受控字典；来源身份、版本、批次及行号必须可追溯                      |
| 航次与主路线            | 船公司、船名、航次、母船船名航次、起运港、途经港、目的港、码头                                  | `shipment` + route/segment / shipment-registry + lifecycle-control                     | 柜级路线部分覆盖                  | 主路线归 Shipment；多航段使用有序子表；柜级只保存实际偏离                     |
| 货柜身份与汇总          | 柜号、箱型、封号、装配件标记、特殊货物体积、件数、体积、毛重、VGM、箱级状态                     | `container_record` + 装载投影 / shipment-registry                                      | 仅柜号、状态及部分装载事实        | 身份和箱型强类型；件重体是经分配对账的汇总，不反推 SKU                        |
| Shipment-Container 关系 | 出运、柜、加入/移出、版本、来源证据                                                             | `shipment_container_link` / shipment-registry                                          | 缺失                              | 版本化关系；同一柜次最多一个活动 Shipment；同租户复合约束                     |
| 备货与上游引用          | 备货单号、主备货单号、供应商、采购单、合同号                                                    | `shipment_upstream_reference` + 现有备货对象 / shipment-registry                       | 基础备货单部分覆盖                | 保留稳定引用和来源版本，不把样本一单一柜固化成约束                            |
| SKU 与装载              | SKU、数量、单位、箱数、体积、毛重、金额、币种、合规属性                                         | `shipment_cargo_line` + allocation / shipment-registry；SKU 主档归 master-data         | 备货行和数量分配部分覆盖          | Shipment 货物独立存在；N:M 分配到柜；数量、件重体和金额带单位/币种            |
| 提单与运输单证          | Booking、MBL、HBL、AMS、SCAC、号码、发货人、收货人、换单接收人、放单日期                        | `shipment_transport_document` + document record / shipment-registry + document-records | 缺失                              | 单证身份、父子和柜关联独立建模；文件版本不放宽表附件列                        |
| 清关案件                | 清关公司、贸易模式、ISF 状态/申报时间、换单、查验、开箱、申报单号、清关状态、放行时间、异常原因 | `customs_clearance_case` + lifecycle facts / customs-compliance                        | 案卷、申报号、状态、Hold 部分覆盖 | 增补 ISF/换单/查验等强类型事实；时间进入统一事实层；异常不塞入主状态          |
| 内陆运输                | 运输方式、卡车/铁路承运商、预提、计划/实际提柜、送仓、堆场进入时间                              | inland move/plan + lifecycle facts / inland-fulfillment                                | 计划时间部分覆盖                  | 计划与执行分开；承运、预约和实际事件不可互相替代                              |
| 仓库交付                | 计划仓、实际仓、仓库组、卸柜方式、卸柜门、卸柜公司、WMS/EBS 状态、实际入仓                      | delivery instruction/receipt/unloading / inland-fulfillment                            | 指令与卸货报告部分覆盖            | 计划仓和实际仓分离；外部系统状态保留来源值，经映射后投影内部状态              |
| 卸柜与还空箱            | 实际卸空、通知取空、实际取空、计划/实际还箱、还箱地点                                           | lifecycle facts + inland execution / lifecycle-control + inland-fulfillment            | 时间事实部分覆盖                  | 每个时间按 `nodeCode + timeKind` 追加；通知、计划和实际不得混用               |
| 免费期与费用            | 免堆、场内/场外免箱、最后免费日、计费规则、金额、币种                                           | charge rule/application / charges-settlement                                           | 规则与阶梯部分覆盖                | 免费期和费用分轨；金额定点并带币种；规则版本可追溯                            |
| 文件证据                | 文件类型、对象、版本、哈希、生成/发送/接收/核验状态                                             | document/evidence / document-records                                                   | 通用证据和核验决定部分覆盖        | 采用行模型和版本链；文档类型受控，不再按附件类型增加列                        |
| 生命周期时间与事件      | 节点、planned/estimated/actual/deadline、UTC、来源时区、来源系统、证据、核验状态                | lifecycle facts/events / lifecycle-control                                             | 柜级事实较完整                    | 支持 Shipment/Container 主体；原始 ETA 和修正 ETA 是两个版本化 estimated 事实 |
| 异常案件                | 异常类型、影响节点、原因、责任方、发现时间、处理状态、结果                                      | exception case / 对应专业域                                                            | NodeBlock/通知零散覆盖            | 新增独立案件边界；异常与互斥主状态正交，关闭结果可审计                        |
| 审计与幂等              | 创建/修改/确认人和时间、来源批次/行、幂等键、载荷哈希                                           | 各写所有者 + integration-import                                                        | 各表不一致                        | 新增写模型统一携带租户、来源、幂等、版本和操作者；不得匿名确认                |

### 5.4 V1 必填不是“所有列非空”

四表业务字段全部进入词汇表，但正式导入已出运数据只以以下集合为基础硬闸：

- 来源系统、来源记录 ID、文件批次和来源行；
- 可核验的备货单引用、柜号、箱型和提单身份；
- 船公司、船名、航次、起运港、目的港、目的国家；
- 实际出运时间及来源时区，或另一个符合 §2.3 的已出运准入证据；
- ETA、最终仓库组、件数、体积和毛重；
- 至少一条带数量和单位的 SKU 装载明细。

某些历史数据缺 SKU 明细时，只能按明确的兼容导入配置建立“货物明细待补”的已出运柜次，并产生可见缺口；件数、重量、体积或金额不得反推 SKU 数量。到港后字段在刚出运阶段允许为空；进入对应作业阶段时，再由命令端按 `profileRequired` 和状态守卫要求。

### 5.5 `container_operational_view` 只读投影

“货柜清关物流状态详情”定义为查询契约名 `container_operational_view`，不是第五张业务表。它按一个 `container_record_id` 聚合 Shipment、主路线、提单、清关、内陆、仓库、文件、费用、异常和生命周期事实。

| 规则       | 约束                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 写入       | 不提供 create/update/delete 命令，不接受详情页整对象回写；操作必须调用所属业务域的公开用例                                |
| 数据来源   | 每个字段标明 `ownerDomain`、`sourceObjectId`、`factVersion`、`asOf` 和适用的 `verificationState`                          |
| 状态       | 展示 Shipment、Container、CustomsCase、DocumentPackage、InlandMove、WarehouseReceipt 的组合，不生成一个人工维护的综合状态 |
| 时间       | planned/estimated/actual/deadline 分槽；当前值附版本，历史可追溯；修正 ETA 不覆盖原 ETA                                   |
| 一致性     | 查询端不修复、不默认、不反写来源事实；冲突和缺失以显式 `dataGaps/disputes` 返回                                           |
| 实现       | 首选实时查询投影或可重建 read model；若以后因规模采用物化投影，必须有游标、延迟指标、重建和对账机制                       |
| 十张详情表 | 只用作投影字段覆盖和结果对拍 fixture；不得直接导入成权威事实或成为新的所有者                                              |

### 5.6 受控字段扩展机制

新增字段只能走以下路径：

1. 在版本化字段注册表登记 `fieldCode`、规范语义、所有者、主体、数据类型、单位/字典、可空性、阶段必填规则、敏感级别和弃用策略。
2. 在来源映射注册表登记 `sourceSystem + sourceSchemaVersion + rawHeader -> fieldCode`，保留转换规则版本；来源列名不能直接成为领域字段名。
3. 稳定、需查询/约束/关联的事实进入强类型列或正式关系表；可重复的时间、单证、文件、事件和异常进入版本化行模型。
4. 仅租户特有、低频且不参与核心状态/金额/关系的稀疏属性可进入受治理扩展值；扩展值仍引用字段定义并按类型校验，不能保存任意 JSON 对象。
5. 任一扩展进入公共 DTO 或导入模板都必须升级 Schema 版本、补兼容说明、正反 fixture 和 contract parity；未知字段默认留在原始证据并报告，不静默丢弃或升格。

`JSONB` 只允许保存不可变来源快照、证据/规则快照或已有 Schema 约束的低频结构。柜号、提单号、SKU、状态、时间、金额、关系、当前投影和需要索引的字段禁止藏入 JSONB。

### 5.7 货主与销售国家映射

`销往国家` 和来源字段 `国别` 在本批业务数据中都不是国家字段，而是内部货主/分公司名称。目标模型必须同时保留并严格区分以下三种事实：

| 字段                     | 定义                                     | 权威与落库                                                              |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------- |
| `destinationCountryCode` | 航线目的国家                             | 由目的港/航线权威事实提供，不从公司名推断                               |
| `salesCountryCode`       | 该票货物所属销售国家，ISO 3166-1 alpha-2 | 由已确认的货主主数据关系解析；查询时从不可变货主版本投影                |
| `cargoOwnerName`         | 内部货主/分公司名称                      | Shipment 保存 `cargo_owner_id` 稳定引用，公共投影返回对应版本的法定名称 |

货主目录 V1 的负责人确认映射如下；源内多空格只参与规范匹配，原始值仍保留在来源证据中：

| 货主名称              | 内部简称 | ISO 销售国家码 |
| --------------------- | -------- | -------------- |
| AOSOM LLC             | `US`     | `US`           |
| AOSOM CANADA INC.     | `CA`     | `CA`           |
| MH STAR UK LTD        | `UK`     | `GB`           |
| MH HANDEL GMBH        | `DE`     | `DE`           |
| MH FRANCE             | `FR`     | `FR`           |
| AOSOM ITALY SRL       | `IT`     | `IT`           |
| SPANISH AOSOM, S.L.   | `ES`     | `ES`           |
| AOSOM IRELAND LIMITED | `IE`     | `IE`           |
| AOSOM ROMANIA S.R.L.  | `RO`     | `RO`           |

`UK` 是内部简称，不是本项目的 ISO alpha-2 国家码；正式销售国家必须保存为 `GB`。只有 active 且负责人确认的 `cargo_owner_reference` 可自动映射，未知公司进入 `UNKNOWN_REFERENCE_CODE` 待复核，不得按名称、简称或目的港猜测。单一权威目录为 [`cargo-owners.json`](../../../packages/contracts/catalogs/v1/cargo-owners.json)，标准 Seed 将同一目录版本化写入数据库。

### 5.7.1 已知数据质量处置

| 缺陷                                | 预检结果                                                   | 允许的修复路径                                                                          |
| ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 工作簿有效范围声明为 `A1`           | `SOURCE_RANGE_METADATA_INVALID`；不得只读取首格后声称成功  | 导入器按实际 worksheet XML 单元格范围解析并记录检测方式，或要求来源重新规范导出         |
| `销往国家 = AOSOM LLC`              | 解析为货主名称，不得写入航线目的国家                       | 绑定已确认 `cargo_owner_reference` 并独立投影 `salesCountryCode=US`；未知货主进入待复核 |
| `ETA修正 = [Ljava.lang.Object;@...` | `INVALID_SOURCE_VALUE`；隔离该值，不得解析或回退到默认 ETA | 来源重导或有证据的人工更正；原始坏值保留在行结果和证据中                                |
| 原始 ETA 与修正 ETA                 | 不得覆盖                                                   | 保存为两个有来源和版本关系的 `estimated` 事实，当前投影按权威规则选择                   |
| 样本一备货单一柜                    | 仅样本观察                                                 | 不生成唯一约束；关系按 N:M 装载分配建模                                                 |
| 后段字段大面积为空                  | 合法阶段性空值                                             | 保持 `NULL/not_applicable/unknown` 语义区别，不创建未发生事件                           |

### 5.8 原始工作簿证据门禁

14 个文件的 SHA-256、声明范围、按 XML 单元格解析的实际范围、表头顺序、数据行数和解析方式已进入受控[来源字段清单](./evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json)。核验结果为：

- 14 个文件均错误声明 `dimension=A1`；四张维护表实际范围为 `AO21/BK21/AT21/Z21`，十张详情表均为 `CS2`。
- 四张维护表各 20 行；备货单、柜号、提单集合完全相同且各 20 个。本批观察为一一对应，不升级为领域约束。
- 十张详情各 1 行、97 列、表头签名相同，其 10 个柜号和备货单号均属于四张维护表的 20 个对象。
- `销往国家` 在四表共 80 行全部为 `AOSOM LLC`；物流表 `ETA修正` 20 行全部为 Java 对象字符串。

进入字段公共契约前，还必须把原始列实例化为逐字段规范矩阵：

```text
sourceWorkbook / sourceSheet / rawHeader
-> canonicalFieldCode / correctedMeaning / ownerDomain / targetObject
-> currentPhysicalSupport / currentContractSupport / targetDisposition
-> storageNullable / profileRequired / validationRule / dataQualityRule
```

来源清单已经重现“四张主表各 20 柜、十张详情表各 1 行”。146 个原始表头及 176 个出现位置现已由公共[出运后字段注册表](../../../packages/contracts/catalogs/v1/post-departure-fields.json)逐项登记 `canonicalFieldCode`、纠正语义、所有者、主体、类型、可空性、阶段必填、校验、数据质量规则和目标处置；生成漂移及证据覆盖由 `contract:check` / `contract:drift` 阻断。十张详情投影对拍仍是独立门禁，字段登记完成不等于详情闭环完成。

### 5.9 当前覆盖判断

§5.3 的 `0/13/3` 是迁移设计前的评审快照，不再代表当前目标 schema。Shipment 身份、Shipment-柜关系和运输单证已进入未发布加法迁移与公共契约，逐字段当前物理/契约支持状态以公共字段注册表为准；已部署物理事实仍以数据库统一契约和迁移状态为准。独立异常案件与十张详情投影对拍仍未完成，因此不发布“全字段闭环”或虚假的物理覆盖百分比。

### 5.10 统一 Shipment 交接与接收边界

#### 5.10.1 单一应用入口

`shipment-lifecycle-orchestration` 是统一接收用例的候选编排所有者；`integration-import`、未来 packing API/Webhook 和人工应急入口都只能调用它的公共端口。最终模块名和 Port 导出随公共契约评审确认，不允许 Adapter 直接依赖 Prisma 或其他模块内部 Repository。

```text
当前四表 -> FileImportAdapter ----\
                                  -> preflight/accept ShipmentHandoffCommandV1
未来装箱平台 -> PackingAdapter ---/        |
                                           +-> shipment-registry 本地核心事务
                                           +-> Outbox -> lifecycle/customs/inland/warehouse Inbox
```

公共能力分为两个独立用例：

```text
PreflightShipmentHandoffPort.preflight(command) -> PreflightResult
AcceptShipmentHandoffPort.accept(command)       -> ShipmentHandoffResult
```

`preflight` 不创建业务身份、不预留版本、不写正式事实；`accept` 必须在锁内重新执行全部业务校验，不能信任过期的预检结果。

#### 5.10.2 `ShipmentHandoffCommandV1` 候选结构

```text
contractVersion = shipment-handoff.v1
tenantId
sourceProfile = legacy_departed_file_v1 | packing_platform_v1 | api_v1
source {
  channel, system, externalHandoffId, handoffVersion
  supersedesExternalHandoffId?, occurredAt, idempotencyKey
  sourceBatchId?, mappingVersion?, correlationId, traceId
}
shipment {
  externalShipmentId?, shipmentNumber?
  transportMode, carrierCode, vesselName, voyageNumber, bookingNumber?
  originPortCode, destinationPortCode, destinationCountryCode
  destinationWarehouseId?, tradeTerm?, estimatedArrivalAt?
  actualLoadedAt?
  departureProof                         # §2.3 的 one-of 证据，不以 loaded 代替 departed
}
billsOfLading[]                          # MBL/HBL/AMS 身份、父子和版本
containers[] {
  externalContainerId?, containerNumber, containerTypeCode, sealNumber?
  stuffingSnapshotRef?                  # 未来 packing profile 必填
  packageCount?, grossWeight?, netWeight?, volume?, vgmWeight?
  billReferences[]                      # 显式 Container N:M BillOfLading
  upstreamReferences[]                  # 备货/备货行/采购/装箱引用
  cargoAllocations[]?                   # 按 profile 决定必填；不从整柜汇总反推
  controlledAttributes[]?
  lifecycleFacts[]
  customsObservations[]?
  inlandObservations[]?
  warehouseObservations[]?
}
documentReferences[]
evidenceReferences[]
```

规范载荷哈希由接收端在标准化后计算并保存，不能信任调用方传入的 `payloadHash`。时间必须为带偏移 ISO 8601；金额/数量使用十进制定点字符串并携带币种/单位；港口、国家、承运人和箱型使用受控代码。未知来源值进入预检/人工复核，不能塞进自由 `attributes` 或 JSONB。

#### 5.10.3 来源配置与条件必填

| 字段/证据              | `legacy_departed_file_v1`                   | `packing_platform_v1` | 规则                                                    |
| ---------------------- | ------------------------------------------- | --------------------- | ------------------------------------------------------- |
| 稳定外部交接 ID + 版本 | 必填                                        | 必填                  | 同来源交接身份；服务端生成规范 payload hash             |
| 稳定外部 Shipment ID   | 缺失则建立内部档案并标记身份待补            | 必填                  | 不能用拼接字段冒充来源身份                              |
| `stuffingSnapshotRef`  | 可空                                        | 必填                  | 当前四表没有正式装箱快照；未来平台必须引用已接受版本    |
| SKU 装载分配           | 缺失时建立 `cargo_detail_incomplete` 待补项 | 必填                  | 不阻断 Shipment；整柜件重体不得反推 SKU 数量            |
| departure proof        | 缺失时建立出运证据待补项                    | 缺失时建立待补项      | 明确仍为 loaded/出运前则拒绝；不得把 loaded 当 departed |
| 清关/内陆/仓库切片     | 有值才提交                                  | 可选/迟绑定           | 空值表示尚未发生，不能生成未发生事件                    |
| 原始文件/来源行        | 必填                                        | 不适用                | 文件 profile 必须保留批次、行、映射版本和哈希           |

四表样本目前只有“出运日期”日期值、中文港口/船司值及 `已出运` 来源状态。系统可先以来源声明建立 `departed` Shipment，并把未知港口、船司和时区列为待补。出运日期在来源时区可解析时按当地 `00:00` 规范化，同时保存原值、`timePrecision=date_only` 和 `completionRule=start_of_day_v1`；时区仍未知时只保留日期事实和缺口，不伪造 UTC 偏移。

#### 5.10.4 交接记录状态与版本

```text
received -> validating -> accepted
                      \-> review_required
                      \-> rejected
accepted -> superseded        # 仅由已接受的新版本引用后发生
```

- `draft` 属于 ImportBatch 或上游平台，不是正式跨系统交接状态。
- 同一 `tenant + source.system + externalHandoffId + handoffVersion` 唯一；同键同规范哈希返回既有结果，同键异哈希返回 `IDEMPOTENCY_PAYLOAD_CONFLICT`。
- 更正必须提升 `handoffVersion` 并引用被替代版本。已实际离港后的柜号、货物、提单更正进入受审计纠偏；到港/清关后不得静默重写历史。
- `superseded` 不删除旧 Shipment、装箱快照、事件或应用结果；只改变当前有效版本投影。

#### 5.10.5 接收事务与跨域吸收

每个来源文件的接收原子范围是原文件、解析结果、全部来源行和文件级结果；任一步失败时该文件不产生部分 staging 内容，其他文件不回滚。

每次正式接管的 T1 原子范围是：交接记录、Shipment、本次已确认货物、运输单证、无冲突柜次及关系、已知装载分配、上游引用、逐对象结果、待补事项和待发布 Outbox。任何一步失败时，这组核心事实同成同败。冲突按柜在预检阶段隔离，不进入本次 T1；后续解除冲突或补充来源时通过新版本追加关系，不静默改写既有 Shipment。

清关、内陆、仓库和生命周期事实仍由各自模块拥有。T1 对相应来源切片完成结构/引用预检并把不可变切片写入交接证据与 Outbox；各所有者在 Inbox 本地事务中校验来源权威、写自己的事实和确认结果。永久拒绝进入人工对账，不回滚或删除已经证明成立的 Shipment。

接收结果必须同时返回：

```text
GC-009 receptionState / businessDecisionState / commitState
handoffId, handoffVersion, duplicate
shipmentId?, containerResults[], cargoResults[], documentResults[]
lifecycleInitializationState
customsAssimilationState, inlandAssimilationState, warehouseAssimilationState
issues[] {code, subjectRef?, sourceRows?, fieldCodes?, messageKey}
traceId
```

`accepted + committed` 只说明 T1 核心事实已落账；各 `*State=ready` 才表示相应投影可供业务使用。

#### 5.10.6 最小拒绝与复核代码

| 稳定码                               | 结果                          | 含义                                       |
| ------------------------------------ | ----------------------------- | ------------------------------------------ |
| `HANDOFF_VERSION_UNSUPPORTED`        | rejected                      | 契约或来源配置版本不支持                   |
| `HANDOFF_REQUIRED_FIELD_MISSING`     | rejected/review               | 按来源配置缺少条件必填字段                 |
| `SHIPMENT_IDENTITY_REVIEW_REQUIRED`  | accepted + pending            | 业务身份维度不完整；多匹配时仅冲突对象阻断 |
| `DEPARTURE_EVIDENCE_INSUFFICIENT`    | accepted + pending / rejected | 已声明出运但证据待补；明确仍未出运时拒绝   |
| `CONTAINER_ACTIVE_SHIPMENT_CONFLICT` | rejected                      | 柜次已属于不兼容活动 Shipment              |
| `STUFFING_SNAPSHOT_VERSION_STALE`    | rejected                      | 引用的装箱版本已被替代或内容不一致         |
| `CARGO_ALLOCATION_EXCEEDS_READY`     | rejected                      | 装载数量超过可交接备货数量                 |
| `CARGO_DETAIL_INCOMPLETE`            | accepted + pending            | 无 SKU 装载明细；可建档并继续在途流程      |
| `BILL_CONTAINER_LINK_INVALID`        | rejected                      | 提单身份或柜-提单关系无效                  |
| `IDEMPOTENCY_PAYLOAD_CONFLICT`       | rejected                      | 同幂等身份出现不同规范载荷                 |
| `SOURCE_VALUE_UNMAPPED`              | review_required               | 港口、船司、状态或其他外部值无法显式映射   |

#### 5.10.7 现有快照的复用边界

工作台不是数据所有者；所有权按业务事实划分：

| 岗位界面/来源       | 只拥有或提交什么                                               | 不得做什么                                     | 当前实施                                                              |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 备货工作台/上游平台 | 备货单、备货行、计划量、已齐备量、供应商和完成证据的版本化快照 | 修改实际装载、Shipment 或后段事实              | 仅保留引用；`ReplenishmentReadySnapshot` 未来评审                     |
| 装箱工作台/平台     | 柜次、封号、件重体/VGM、实际装载分配和装箱完成证据             | 改写备货原始数量或宣称已离港                   | 当前有柜级 `ContainerStuffingSnapshot`，未来 Adapter 引用其已接受版本 |
| 出运接收/工作台     | Shipment、柜关系、出运货物、运输单证、上游引用和接收对账       | 反向修改备货/装箱快照，或直接拥有清关/仓库事实 | 当前优先实施的核心边界                                                |
| 清关/内陆/仓库岗位  | 各自案件、计划、实际作业、证据和事件                           | 回写 Shipment Handoff 或综合详情宽表           | 通过 Inbox/公开命令吸收来源切片                                       |

当前 `ContainerStuffingSnapshot` 已具备版本、装载集合引用、件重体/VGM、证据、幂等和 payload hash，可复用其不可变版本模式；但它要求既有 `containerRecordId`，不是未来“备货工作台到装箱平台”的完整公共契约。

当前 `ContainerDispatchSnapshot` 是单柜快照，且只有单值 MBL/HBL，不支持 Shipment、多柜、多提单关系、来源交接版本或离港准入，因此只能作为迁移输入，不能重命名后直接充当 `ShipmentHandoffCommandV1`。`ReplenishmentReadySnapshot` 和未来 packing handoff 待出运后核心完成后另行评审，本阶段只预留引用类型和适配入口。

## 6. 状态、事件和异常的边界

| 概念             | 权威事实                                                         | 目标投影/规则                                                                                                  |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Shipment 状态    | Shipment/共享运输事件 + 关联柜聚合结果                           | `DEPARTED → IN_TRANSIT → ARRIVED → CUSTOMS_CLEARANCE → RELEASED → PICKED_UP → DELIVERED_TO_WAREHOUSE → CLOSED` |
| Container 状态   | 现有柜级事件、节点应用和 `FlowInstance`                          | 继续按柜推进；不同柜可处于不同阶段                                                                             |
| `EMPTY_RETURNED` | 每个货柜的 `returned_empty` 事件                                 | 不作为单票单值事实；全部适用柜已还箱可成为 Shipment `CLOSED` 的守卫和展示摘要                                  |
| 异常             | `dumped/rolled/delay/inspection/hold/overdue/changed` 事件或案件 | 与主状态正交，可同时存在，不新增互斥主状态                                                                     |
| 当前状态         | 事件应用后的可重建投影                                           | 不能覆盖、删除或替代事件历史                                                                                   |

Shipment 聚合规则必须版本化。例如 `PICKED_UP` 是“全部适用柜已提”还是“首柜已提”必须由正式规则明确，不能由 UI 猜测。评审前默认采用保守的“全部适用柜完成”口径；部分完成通过 `completed/total` 展示，不提前推进整票状态。

`post_departure` 配置从 `origin_departure` 接入，不创建 `cargo_ready/container_stuffing/shipment_dispatch` 的待办或节点实例。Shipment、货柜关系、准入证据、离港事件和柜级 Flow 初始化必须在一个可恢复的受控提交中完成；离港事件应用后，柜级当前节点进入 `ocean_transit`。历史 14 节点流程继续按原配置解释，不能就地改写。

## 7. 真实样本在目标模型中的投影

以下示例只使用已核验事实，不把候选身份或缺失时间补成真值：

| 目标对象            | 真实样本值                                                       | 当前可否正式落账                          | 原因                                                                        |
| ------------------- | ---------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Shipment 候选归组   | 出运计划引用 `SP20260830`；MBL `NBOZ9FF56400`                    | 只能形成待确认草稿                        | 计划号是上游引用，MBL 是运输单证；正式 Shipment 业务号/来源身份规则尚未批准 |
| Shipment-Container  | `HMMU4207629`、`HMMU4956442`                                     | 可作为草稿关系                            | 一票两柜由多份文件交叉证明                                                  |
| 运输单证            | MBL `NBOZ9FF56400`；HBL `...A/B/C/D`                             | 可写候选单证关系                          | 真实样本证明 1 个 MBL 对 4 个 HBL                                           |
| 上游引用            | 备货单 `26DSC01811/01812`；计划 `SP20260830`                     | 可写候选上游引用                          | 只能表达来源关系，不代表上游流程由本系统拥有                                |
| 出运货物            | `26DSC01812` 的 15 个 SKU，共 504；柜 2 为 7723.00 kg / 67.25 m³ | 15 行可形成候选 cargo lines 和分配        | 行级 BOM、报关和舱单可对账；早期冲突值必须保留为旧版本证据                  |
| `26DSC01811` 货物行 | 949 件 / 9630.90 kg / 65.79 m³ 汇总                              | 不生成虚构 SKU 行                         | 来源缺稳定产品货号，只能保存经证明的对应粒度汇总或待补项                    |
| ATD                 | `2026-09-18` 日期                                                | 按来源当地 `00:00` 补时并标记 `date_only` | 保存原值、来源时区和规则版本；时区未知时保留待补，不伪造 UTC 偏移           |
| 外部 `DEPARTED`     | 备货平台“已出运”                                                 | 可建立 `departed` Shipment 并保留证据待补 | 来源声明与补充证据分开；后续补证不改写已出运业务起点                        |
| 到港及后段事件      | 无                                                               | 不可生成                                  | ETA 不是 ATA；样本无实际到港、提柜、送仓、卸空或还箱事实                    |

这组样本可用于预检、正式建档、单证关系、货物完整度缺口和后补测试。成功 fixture 必须明确显示 `date_only`、来源时区缺口和无 SKU 待补，不能把系统补时冒充来源精确时间。

## 8. 导入十项能力差异

| #   | 要求                                 | 当前状态 | 差异/目标                                                                     |
| --- | ------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| 1   | 上传后预检，不立即写业务表           | 已有     | 保留；预检对象改为 Shipment 草稿                                              |
| 2   | 列级、行级错误明确                   | 部分     | 已有基础 blocker；缺港口、箱号校验、出运准入和跨行关系错误                    |
| 3   | 来源身份幂等，无 ID 时定义组合键     | 部分     | 批次幂等已有；缺 Shipment 业务幂等和来源版本冲突策略                          |
| 4   | 多行 SKU、多柜正确归组               | 不满足   | 当前按备货单分组且只取第一个箱号；必须按稳定 Shipment 身份归组                |
| 5   | 文件与正式接管事务                   | 不满足   | 单文件 staging 原子；多文件独立；正式接管按冻结的 Shipment/柜关系集合原子提交 |
| 6   | 区分重复、更新和业务冲突             | 部分     | 有重复行和重放检查；缺 Shipment 版本更新、关系变更和冲突分类                  |
| 7   | 原文件、批次摘要、逐行结果、操作人   | 基础已有 | 补明确统计、人工处理项和目标实体引用；保留替代批次血缘                        |
| 8   | 关键事实变更保留历史                 | 部分     | 时间/装载已有版本基础；Shipment、路线、单证和关系尚无版本历史                 |
| 9   | 同箱号出现在不兼容活动出运时报错     | 不满足   | 当前只能发现部分箱号歧义，没有活动 Shipment 语义和时间窗                      |
| 10  | 返回新增、更新、重复、失败、人工处理 | 部分     | 当前结果主要是 success/failed；需增加稳定 outcome/reason/entity IDs 和汇总    |

另有一个前置 blocker：整批数据若不能证明至少一个出运准入条件，禁止写入正式 `shipment`。

## 9. 兼容与迁移门禁

### 9.1 评审时决定（历史门禁）

- 评审轮只更新设计与评审依据；批准后的实现已追加 `20260923120000_add_post_departure_shipment_core`，但未在本任务中应用到本地持久数据库。
- 现有真实样本、备货单、产品行、货柜和装载分配继续保留；不得为迎合新模型伪造 ATD、事件或时间偏移。
- 新导入功能在目标契约批准前不得继续扩大 `ApplyReplenishmentOrderImportService` 的职责。

### 9.2 后续只允许加法式迁移

1. **Expand**：新增 Shipment、出运货物、运输单证、上游引用和 Shipment-Container 关系；给装载分配增加可空新引用。
2. **Migrate**：按证据回填。真实样本可建立内部 Shipment；`2026-09-18` 按来源当地 `00:00` 补时并保留 `date_only`、来源时区和规则版本，时区未知时保持待补而不伪造 UTC 偏移。
3. **Dual-read/verify**：对账出运数、柜数、SKU 数量、件重体、单证基数、事件投影和租户隔离。
4. **Contract**：消费者全部切换且验证通过后，才停止写兼容 `container_record.order_number/replenishment_order_id` 和旧 allocation 引用；删除列另行审批。

### 9.3 迁移批准前必须关闭

- 负责人批准 §1.5 的七项业务取舍；技术评审结论不得代替业务签署。
- 负责人批准 §5.3–§5.7 的四表字段覆盖、分阶段必填、只读详情投影和受控扩展规则。
- 基于 §5.8 已核验来源清单，为 146 个原始表头完成规范字段码、校验/字典和公共契约状态映射。
- 将 Shipment 身份、柜侧活动唯一性、`ShipmentHandoffCommandV1`、V2 事件主体和两阶段提交实例化为唯一公共契约。
- 定稿 handoff 来源配置、状态/版本、逐对象结果、稳定错误码及专业域 Outbox 切片契约。
- 定稿 Shipment 聚合状态规则、异常 Case 边界及 `post_departure_ocean` 流程定义目录。
- 多 MBL、HBL 父子关系和改单版本规则。
- 同箱号“不兼容活动出运”的时间窗与人工解除流程。
- 批次事务策略、失败恢复、回滚 SQL 和空库/旧库升级测试。
- 真实样本回填预期值与不应回填字段清单。

## 10. 对当前备货工作台的影响

当前分支的备货工作台实现不是本轮核心流程。它最多作为上游备货单、SKU 档案和来源缺口的辅助查询/维护面，不再承担系统首页、Shipment 导入入口或出运后任务队列。现有未提交改动先保留；在目标 Shipment 导入和生命周期工作台切片启动前，必须单独决定保留、收窄或延期，不能无审查删除。

## 11. 下一步决策顺序

1. 负责人批准或修正 §1.5 的七项业务取舍、§5.3–§5.7 的字段/查询基线和 §5.10 的统一交接边界。
2. 基于已核验的 §5.8 来源清单完成 146 个原始表头到 `ShipmentHandoffCommandV1` 的规范字段码映射；范围缺陷和数据质量处置进入 fixture。
3. 新增 Shipment/Handoff 公共 Schema、`CanonicalEventEnvelopeV2`、跨模块引用、流程定义和字段注册表，并生成 TS/OpenAPI/客户端及完成 parity 评审。
4. 形成加法迁移设计、真实样本回填表、验证查询和恢复方案。
5. 迁移评审通过后再修改 Prisma、追加迁移和实现新的 Shipment 导入写端口。
6. 以真实样本完成“预检 → 正式导入 → 一票查看 → 事件推进 → 关闭”的端到端验收，并用十张详情 fixture 对拍只读投影。

## 12. 分层权威链接

- 当前数据库全库契约：[`DATABASE_SCHEMA_CONTRACT_V1`](../../architecture/DATABASE_SCHEMA_CONTRACT_V1.md)
- 当前物理目标：[`database/schema.prisma`](../../../database/schema.prisma)
- 当前迁移历史：[`database/migrations/`](../../../database/migrations/)
- 领域边界：[`CONTEXT_MAP`](./CONTEXT_MAP.md)
- 全链路与真实样本边界：[`SHIPMENT_FLOW_OVERVIEW`](./SHIPMENT_FLOW_OVERVIEW.md)、[`REAL_REPLENISHMENT_SAMPLE_RELATIONSHIPS_20260921`](./REAL_REPLENISHMENT_SAMPLE_RELATIONSHIPS_20260921.md)
- 当前导入实现契约：[`IMPORT_DOMAIN_MODEL`](./IMPORT_DOMAIN_MODEL.md)
- 当前兼容字段目录：[`TARGET_FIELD_CATALOG`](./TARGET_FIELD_CATALOG.md)
- 查询投影边界：[`QUERY_PROJECTION_CONTRACT_V1`](./QUERY_PROJECTION_CONTRACT_V1.md)
- 四表与十张详情的受控证据：[`POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923`](./evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json)
- 状态、事件和时间权威：[`CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1`](./CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md)、[`EVENT_CODES`](./EVENT_CODES.md)、[`CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1`](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)
- 公共引用与可靠性：[`CROSS_MODULE_REFERENCE_CONTRACT_V1`](./CROSS_MODULE_REFERENCE_CONTRACT_V1.md)、[`SYNC_RELIABILITY_CONTRACT_V1`](./SYNC_RELIABILITY_CONTRACT_V1.md)
