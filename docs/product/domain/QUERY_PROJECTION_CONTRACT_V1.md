# 查询投影契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-010` · 版本：`1.0.0` · 定稿日期：2026-09-10  
> 所有者：查询体验负责人；字段事实由各源模块负责

## 1. 目的与权威边界

本文件是货柜全生命周期公共读模型、分页、排序、权限裁剪、时间展示和新鲜度语义的唯一业务权威。它供 API、Web 操作台、移动端和报表消费，不拥有生命周期、任务工单、专业事实、证据、权限或同步状态机。

投影只能组合源模块已经裁决的事实。不得根据文案、颜色、日期是否非空、HTTP 成功或同步状态重新推导业务状态；投影延迟也不得反向修改源事实。

## 2. 顶层读模型

`ContainerOperationalViewV1`：

```text
tenantId: UUID
containerId: UUID
containerNumber: string
flow: FlowSummaryV1 | null
currentNode: NodeSummaryV1 | null
nodes: NodeSummaryV1[]
currentTimes: CurrentTimeSummaryV1
tasks: TaskSummaryV1[]
workOrders: WorkOrderSummaryV1[]
professionalFacts: ProfessionalFactSummaryV1[]
evidenceSummary: EvidenceSummaryV1
syncSummary: SyncSummaryV1
activeBlocks: BlockSummaryV1[]
activeExceptions: ExceptionSummaryV1[]
allowedActions: AllowedActionViewV1[]
projectionVersion: integer >= 0
sourceVersions: SourceProjectionVersionV1[]
asOf: date-time
freshness: ProjectionFreshnessV1
```

- 箱号尚未产生、仍处备货阶段的对象不返回本模型，使用备货模块自己的查询模型。
- `flow = null` 只允许用于已登记箱号但生命周期尚未启动的明确场景；不得用空对象代替。
- `currentNode`、节点顺序和状态直接来自 `lifecycle-control` 投影。
- 列表摘要不得成为写命令载荷；写入只提交动作契约定义的 ID、版本和 payload。

## 3. 状态分轨

四类状态必须分字段返回，禁止合并为单一 `status`：

| 轨道     | 字段                                                                        | 权威来源            | 回答的问题               |
| -------- | --------------------------------------------------------------------------- | ------------------- | ------------------------ |
| 主流程   | `flow.state`、`currentNode.state`                                           | `lifecycle-control` | 货柜走到哪一步           |
| 节点任务 | `tasks[].state`                                                             | `work-execution`    | 当前工序子任务做到哪     |
| 作业工单 | `workOrders[].state`                                                        | `work-execution`    | 具体作业是否完成         |
| 数据同步 | `syncSummary.operations[].receptionState/businessDecisionState/commitState` | 操作所有者/集成平台 | 请求是否接收、接受、落账 |

同步完成不代表工单、任务或流程完成。异常与 Block 是正交事实，分别通过 `activeExceptions` 和 `activeBlocks` 展示，不得伪装成主状态。

## 4. 节点、任务与工单摘要

`NodeSummaryV1`：

```text
nodeInstanceId: UUID
nodeCode: registered node code
sequence: integer
activationNo: integer >= 1
applicability: required | optional_applicable | optional_not_applicable
state: registered node state
plannedAt?: date-time
estimatedAt?: date-time
actualAt?: date-time
activeBlockCount: integer >= 0
taskProgress: {required, completed, blocked}
version: integer >= 0
```

`TaskSummaryV1` 和 `WorkOrderSummaryV1` 必须使用 `GC-005` 的正式状态值，并至少保留 `nodeTaskId/workOrderId`、父链 ID、定义版本、适用性、状态、负责人、截止时间、完成进度、活动 Block、事实应用摘要和版本。optional/conditional/required 不得仅靠排序或文案表达。

## 5. 时间与时间线

`CurrentTimeSummaryV1` 按节点和航段分别返回 `plannedAt`、`estimatedAt`、`actualAt`，不得合并为“最新时间”。所有交换值使用带时区 ISO 8601；服务端存储 UTC。

`TimelineItemViewV1` 至少包含：

```text
eventId, eventCode, eventVersion
containerId, flowInstanceId, nodeCode, nodeInstanceId?
role, timeKind, occurredAt, recordedAt, receivedAt?
validity, confidenceState, domain, domainFactId?
sourceSummary, evidenceRefs[], relation?
eventSequence, projectionVersion
```

- 时间线默认排序：`occurredAt desc, eventSequence desc, eventId desc`。
- ETA/ETD 的更新追加历史；ATA/ATD 等实际时间独立展示。
- 乱序、迟到、更正和撤销按 `GC-004` 处理，UI 不使用接收时间覆盖业务发生时间。
- 预计、实际、争议和撤销必须有文字或图标区分，不能只使用颜色。

## 6. 证据与专业事实

`ProfessionalFactSummaryV1` 仅展示专业模块裁决结果、`domainFactId`、事实类型、发生时间、有效性、置信状态及证据引用。查询层不得验证证据或选择权威来源。

`EvidenceSummaryV1` 至少提供总数、有效/待验证/争议数量和按权限过滤后的引用。证据原文、敏感字段和下载地址默认不内嵌；需要时通过受控详情端点和短期引用获取。

无证据访问权的用户可以看到“存在受限证据”及汇总，不得通过数量、文件名、错误详情或排序侧信道泄露敏感内容。

## 7. 允许动作

`AllowedActionViewV1`：

```text
actionCode, actionVersion
executable: boolean
denialCategory?: authentication | scope | capability | state
  | precondition | evidence | lock | review | concurrency
confirmationPolicy, reviewPolicy
requiredEvidenceTypes[]
expectedVersion
expiresAt?
```

允许动作由服务端按 `GC-008` 计算。权限裁剪可完全移除用户不应知晓的动作；对可见但当前不可执行的动作返回稳定拒绝类别。客户端不得把该数组当作永久授权，命令到达服务端时必须重新校验。

## 8. 同步摘要与新鲜度

`SyncOperationSummaryV1` 分别返回 `receptionState`、`businessDecisionState`、`commitState`、最近尝试时间、下次重试时间、稳定失败码、`clientOperationId` 和 `traceId`。不得用单一 success/failed 覆盖三阶段。

`ProjectionFreshnessV1`：

```text
state: current | catching_up | stale | rebuilding | unavailable
projectedAt: date-time
sourceHighWatermark?: string
lagSeconds?: integer >= 0
reasonCode?: stable code
```

`asOf` 表示该响应的投影截止时间，不是业务发生时间。投影落后时返回最后一致快照和新鲜度；不得以空值清除有效事实。无法保证一致快照时明确失败，不拼接不同租户或不兼容版本的数据。

## 9. 分页、过滤与排序

所有集合端点使用游标分页：

```text
items: T[]
pageInfo:
  nextCursor: string | null
  hasNextPage: boolean
  pageSize: integer
asOf: date-time
projectionVersion?: integer
```

- 默认 `pageSize=50`，最小 1，最大 200；超过上限返回公共校验错误。
- cursor 是不透明、短期有效并绑定租户、过滤器、排序和权限上下文的值。
- 必须声明唯一稳定尾键；货柜列表默认 `updatedAt desc, containerId desc`。
- 相同 cursor 重放在快照有效期内返回一致页；过期或参数不匹配明确失败，不退回第一页。
- 过滤字段采用登记代码，不接受数据库列名或任意表达式。
- 导出不是无限 pageSize；使用独立受审计异步动作。

## 10. 字段授权与隐私

服务端按租户、对象、字段、用途和敏感等级裁剪。裁剪发生在序列化之前，数据库实体不得直接返回。对于固定公共字段，`null` 只表示契约允许且事实未知/不适用；因权限隐藏的字段必须省略或放入明确的 redaction 元数据，不得混用。

搜索、排序、聚合和总数必须服从同一权限范围。日志只记录查询类型、租户、主体、过滤摘要、数量、延迟和 traceId，不记录 Token、Cookie、证据原文或不必要个人数据。

## 11. 一致性与刷新

- 单个详情响应必须基于一致的投影版本或可解释的 `sourceVersions`。
- 命令成功响应返回 `resultRefs` 和提交版本；查询可最终一致，客户端按版本或 ETag 刷新。
- 支持条件请求时 ETag 必须绑定租户、权限裁剪结果和投影版本。
- 重建投影必须从不可变事实确定性重放；同一事实集和定义版本产生相同结果。
- 查询层不得写回源模块、触发状态推进或自动补录。

## 12. 验收矩阵

至少覆盖：

1. 四类状态分轨，任一同步成功不改变业务状态。
2. 当前节点和节点时间与生命周期权威投影一致。
3. ETA 多次更新、ATA 迟到及撤销历史正确展示。
4. required/optional/conditional 工单及聚合进度准确。
5. 外部事实先到、工单后建时不重复展示业务事件。
6. 证据权限裁剪不泄露文件名、内容或总数侧信道。
7. allowedActions 伪造、缓存过期和命令时重验。
8. cursor 正常翻页、并发插入、过期、参数变更及跨租户拒绝。
9. 默认/最大 pageSize 和稳定尾键。
10. 投影 catching_up/stale/unavailable 不清空最后有效事实。
11. 字段 `null`、省略和 redaction 的区别。
12. 相同事实日志重复重建得到相同投影和版本。
13. 时间按用户时区展示但 API 原值保持 ISO 8601。
14. 错误均符合 `GC-011`，包含 traceId 且不暴露内部结构。

## 13. 版本与实例化

- 新增可选字段通常是加法兼容；新增必填字段、改变可空性、状态含义、默认排序、权限可见性或 cursor 语义是行为变更或破坏性变更。
- V1 不承诺数据库结构；实体、DTO 和 API 必须显式映射。
- 当前主视图已有局部 Schema，但仍缺 `currentTimes`、完整任务/工单摘要、时间线和分页模型，门禁保持 `D3`；尚无 OpenAPI、生成类型、数据库投影或运行时实现。
- 任务阶段 G7 将实现投影器、API、前端消费者及契约/E2E 测试。
