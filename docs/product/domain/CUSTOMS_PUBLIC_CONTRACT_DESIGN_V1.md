# 海关公共契约实例化设计 V1

> 状态：公共契约设计 V1（已定，待实现）  
> 定稿日期：2026-09-09  
> 兼容性：新增、行为约束；当前无运行时公共包或已发布消费者  
> 上游：[海关业务契约定稿包 V1](./CUSTOMS_BUSINESS_CONTRACT_V1.md)  
> 供应商映射：[飞驼海关证据映射 V1](../../integrations/freightower/CUSTOMS_EVIDENCE_MAPPING_V1.md)

## 1. 单一权威与线协议

本文定稿海关 V1 的枚举、事件信封、DTO、错误码和 JSON Schema 对照。本轮不创建运行时代码、迁移或 API。

```text
packages/contracts/schemas/customs/v1/*.schema.json
-> TypeScript / Python / OpenAPI / fixtures
```

正式实现只能保留一个可编辑权威源。`EVENT_CODES.md` 继续拥有事件语义码全集，本文只引用海关子集。

| 项目 | V1 规则 |
| --- | --- |
| Schema | JSON Schema Draft 2020-12 |
| JSON 字段/枚举 | `camelCase` / lowercase `snake_case` |
| 标识符 | 内部 ID 使用 UUID string |
| 时间 | UTC RFC 3339 `date-time`，输出含 `Z` |
| 可选字段 | 缺失时省略；命令不以 `null` 代替缺失 |
| 查询投影 | 稳定列可显式 `null`，须在 Schema 声明 |
| 集合 | 无值为 `[]`，不返回 `null` |
| 未知值/字段 | 未知枚举失败；写 DTO `additionalProperties:false` |
| 并发/幂等 | `expectedVersion`；`idempotencyKey` 或 HTTP Header |

原始供应商载荷不得进入公共 DTO，只暴露受控引用和 SHA-256。

## 2. 枚举定稿

### 2.1 `CustomsCaseState`

| 线值 | 含义 | 可进入 |
| --- | --- | --- |
| `not_filed` | 未申报 | `filed,cancelled` |
| `filed` | 已申报 | `under_review,inspection,held,rejected,released,cancelled` |
| `under_review` | 处理中 | `inspection,held,rejected,released` |
| `inspection` | 查验中 | `under_review,held,rejected,released` |
| `held` | 有效扣留 | `under_review,inspection,rejected,released` |
| `rejected` | 退单/拒绝/需重报 | `filed,cancelled` |
| `released` | 有效案卷放行 | 更正走复核，不原地回退 |
| `cancelled` | 取消/作废 | 终态 |

`hold_released` 是解除特定 Hold 的事件，不是案卷状态。

### 2.2 作业状态

正式状态线值、合法转换、聚合和事实应用唯一引用[任务与工单契约 V1](./TASK_WORK_ORDER_CONTRACT_V1.md)。海关 Schema 后续直接引用该公共源，不在本设计中保存第二份枚举或转换表。

### 2.3 操作、同步与分类

```text
CustomsOperationState = requested | submitted | accepted | rejected | completed | failed | cancelled
CustomsReceiptStage = server_received | business_accepted | final_result
SyncState = pending | processing | retrying | succeeded | failed | dead_letter | compensated
CustomsDirection = import | export
AuthoritySubject = customs | carrier | terminal | maritime | freight | inspection_agency | other
MappingDecision = approved | manual_review | rejected
```

`submitted` 仅表示已发送，`accepted` 仅表示业务受理，操作 `completed` 不自动等于放行，`SyncState.succeeded` 仅表示数据传输成功。

证据来源、权威等级、验证、置信、有效性和采集方式统一引用[证据与来源权威契约 V1](./EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md)。海关不得继续发布 `a/b/c/d` 平行等级。

海关允许事件码引用 `EVENT_CODES`：

```text
customs_filed | inspection | hold | hold_released | release | container_customs_completed
```

## 3. 事件信封

`CanonicalEventEnvelopeV1<TData>` 是[货柜生命周期统一事件信封](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md#4-统一事件信封)的海关 profile。实例化时必须通过 `$ref`/组合派生，不得维护第二份公共信封；下表仅列海关约束和海关上下文。

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `eventId` | UUID | 是 | 全局唯一 |
| `eventType` | allowed event code | 是 | §2.3 子集 |
| `eventVersion` | integer | 是 | V1 固定 `1` |
| `aggregateType` | enum | 是 | `customs_case,container,node_task,work_order` |
| `aggregateId` | UUID | 是 | 归属聚合 |
| `occurredAt` | date-time | 是 | 业务实际发生时间 |
| `recordedAt` | date-time | 是 | 系统持久化时间 |
| `correlationId` | UUID | 是 | 跨链路关联 |
| `causationId` | UUID | 否 | 无上游时省略 |
| `idempotencyKey` | string 1..200 | 是 | 业务幂等键 |
| `source` | `EventSourceV1` | 是 | 来源和采集方式 |
| `context` | `CustomsEventContextV1` | 是 | 海关范围 |
| `evidenceRefs` | unique UUID[1..] | 是 | 至少一条 |
| `data` | discriminated object | 是 | 按事件码判别 |

```text
EventSourceV1:
  sourceSystem: string
  provider?: string
  providerVersion?: string
  interfaceCode?: string
  mappingVersion?: string
  captureSource: CaptureSource
  actorId?: UUID

CustomsEventContextV1:
  containerId: UUID
  flowInstanceId: UUID
  nodeCode: customs_clearance
  nodeInstanceId: UUID
  customsCaseId?: UUID
  domainFactId: UUID
  jurisdiction: uppercase string(2..16)
  direction: CustomsDirection
  subject: AuthoritySubject
  workOrderId?: UUID
  operationId?: UUID
```

| 事件码 | `data` 必填字段 |
| --- | --- |
| `customs_filed` | `filingType,externalReference` |
| `inspection` | `inspectionType,status=started|completed` |
| `hold` | `holdKey,holdType` |
| `hold_released` | `holdKey,releasedHoldEventId` |
| `release` | `releaseScope=customs_case,externalReference` |
| `container_customs_completed` | `caseSetVersion,requiredCaseIds,releasedFactIds,status=completed` |

除 `container_customs_completed` 外，海关事件必须有 `customsCaseId`；货柜级聚合事件不得伪造单一案卷 ID，并要求 `requiredCaseIds` 非空且与已验证 `releasedFactIds` 完整对应。该事件的 `completionEligibleNodeCodes=[customs_clearance]`；单案卷 `release` 保持空数组。

`hold_released` 必须指向被解除的 Hold；不能关联时进入人工复核，不得清空全部 Hold。

## 4. DTO 定稿

### 4.1 `ExternalCustomsObservationV1`

```text
observationId: UUID
provider: string(1..64)
providerVersion?: string(1..64)
documentId: string(1..64)
interfaceCode: string(1..200)
jurisdiction: string(2..16)
direction: CustomsDirection
subject: AuthoritySubject
rawCode: string(1..64)
rawText?: string(max 1000)
qualifier: registered-key object
businessReference: string(1..200)
sourceEventId?: string(1..200)
occurredAt?: date-time
providerUpdatedAt?: date-time
receivedAt: date-time
payloadHash: lowercase SHA-256
rawPayloadRef: string(1..500)
mappingVersion: string(1..100)
mappingDecision: MappingDecision
```

`qualifier` 只允许映射注册表声明的键，禁止任意 JSON 穿透 Domain。

### 4.2 `RegisterCustomsEvidenceRequestV1`

```text
customsCaseId: UUID
evidenceType: string
authorityLevel: AuthorityLevel
sourceSystem: string
jurisdiction: string
direction: CustomsDirection
subject: AuthoritySubject
externalReference?: string
issuedAt?: date-time
occurredAt?: date-time
contentHash: lowercase SHA-256
storageRef: string
idempotencyKey: string
expectedVersion: integer >= 0
```

不得接收文件正文、Token、Cookie 或供应商原始 JSON。

### 4.3 `ApplyCustomsFactToWorkOrderCommandV1`

```text
workOrderId: UUID
customsCaseId: UUID
factType: customs_filed | inspection | hold | hold_released | release
factStatus: started | completed | blocked | released
businessOccurredAt: date-time
evidenceRefs: unique UUID[1..]
externalReference?: string
captureSource: CaptureSource
actorId?: UUID
reason?: string
idempotencyKey: string
expectedVersion: integer >= 0
```

`external_evidence` 必须关联已验证证据；`manual_backfill` 必须有 `actorId` 和 `reason`。两种来源使用同一校验、状态机和聚合；同一事实得到相同业务状态和日期，并幂等合并。

### 4.4 查询投影

```text
CustomsCaseViewV1:
  customsCaseId: UUID
  containerId: UUID
  jurisdiction: string
  direction: CustomsDirection
  declarationReference: string | null
  required: boolean
  state: CustomsCaseState
  activeHoldKeys: string[]
  evidenceRefs: UUID[]
  releasedAt: date-time | null
  version: integer
  updatedAt: date-time

CustomsTaskStatusViewV1:
  nodeTaskId: UUID
  containerId: UUID
  nodeInstanceId: UUID
  taskState: NodeTaskState
  requiredCaseCount: integer >= 0
  releasedRequiredCaseCount: integer >= 0
  activeBlocks: BlockReasonV1[]
  customsReleaseSatisfied: boolean
  pickupEntryEligible: boolean
  operationState: CustomsOperationState | null
  syncState: SyncState | null
  version: integer
  updatedAt: date-time
```

`pickupEntryEligible` 必须来自后端联合守卫，前端不得重算。

## 5. ErrorResponseV1

海关 API 使用[公共错误契约 V1](./PUBLIC_ERROR_CONTRACT_V1.md)的 `ErrorResponseV1`、公共码及海关命名空间码。本文件只负责海关错误的领域触发条件，不再维护平行的错误信封、线值或 HTTP 映射。

## 6. JSON Schema 对照

```text
packages/contracts/schemas/customs/v1/
  common.schema.json
  canonical-event-envelope.schema.json
  external-customs-observation.schema.json
  register-customs-evidence-request.schema.json
  apply-customs-fact-to-work-order-command.schema.json
  customs-case-view.schema.json
  customs-task-status-view.schema.json
  error-response.schema.json
```

| Schema | 根类型 |
| --- | --- |
| `common` | 枚举、UUID、UTC 时间、SHA-256、小对象 |
| `canonical-event-envelope` | 事件信封和事件数据判别联合 |
| `external-customs-observation` | Adapter 写入边界 |
| `register-customs-evidence-request` | 证据登记命令 |
| `apply-customs-fact-to-work-order-command` | 外部/人工统一命令 |
| `customs-case-view` | 案卷查询投影 |
| `customs-task-status-view` | 海关操作台投影 |
| `error-response` | 失败响应 |

每个 `$id` 使用 `https://logixs.local/schemas/customs/v1/{name}`。正式 Schema 必须声明 Draft 2020-12，以 `$defs/$ref` 引用唯一枚举，并为字符串、数组和数值设置边界。

Schema 强制规则：

- 根对象 `additionalProperties:false`。
- 证据数组 `minItems:1` 且 `uniqueItems:true`。
- `manual_backfill` 以 `if/then` 要求 `actorId/reason`。
- 事件 `data` 以 `eventType` 判别，禁止任意对象。
- 日期时间必须有时区；SHA-256 使用小写十六进制 pattern。
- 命令可选字段省略；只有查询投影声明 nullable。

## 7. 跨语言与 OpenAPI 对照

| JSON Schema | TypeScript | Python | OpenAPI |
| --- | --- | --- | --- |
| string enum | 字符串联合/生成枚举 | `StrEnum` | string enum |
| uuid | branded string | `UUID` | string/uuid |
| date-time | ISO string | aware `datetime` | string/date-time |
| required | 必填属性 | 必填字段 | required |
| 非 required | `?:` | optional | 非 required |
| string/null | `string/null` | `str/None` | nullable 投影 |

生成后必须用同一 fixture 在 JSON Schema、TypeScript、Python 和 OpenAPI 契约测试中对拍。

## 8. 消费者、版本和验收

计划消费者：

- `customs-compliance`：案卷、证据、观察、裁决和事件。
- `work-execution`：统一工单命令与状态枚举。
- `lifecycle-control`：事件信封和海关完成事实。
- Integration Adapter：外部观察与错误码。
- Web：案卷/任务投影、允许动作和错误响应。

本设计是新增契约。V1 实例化后，枚举线值、字段含义和错误码不得静默改变；新增必填字段、收紧可空性或更改类型使用 V2 和兼容期。映射变更保存 `mappingVersion` 并回放 fixture。

实现必须交付：

1. 八个 Schema 及唯一生成配置。
2. 实际语言类型和 OpenAPI 派生产物。
3. 成功、拒绝、边界、重复、乱序、回放和并发 fixture。
4. 外部自动回填与人工后补录等价性测试。
5. Schema 与所有消费者的 parity 检查。
6. API 认证、授权、幂等、错误码和版本冲突测试。
7. 不含真实业务标识或凭据的脱敏样例。

当前唯一活动任务槽位释放后，才能派生 Schema/代码实施任务。

对应的表、字段、约束、索引、事务边界和迁移顺序见[海关数据库结构与迁移设计 V1](./CUSTOMS_DATABASE_MIGRATION_DESIGN_V1.md)。数据库实体必须显式映射本公共契约，不得反向成为线值或 DTO 的权威来源。
