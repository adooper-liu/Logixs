# 任务与工单契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-005`  
> 版本：`1.0.0`  
> 定稿日期：2026-09-10  
> 所有者：`work-execution`

## 1. 目的与权威边界

本文件是货柜生命周期中 `NodeTask`、`WorkOrder`、状态枚举、合法转换、工单聚合、事实应用和结果事件的唯一业务权威。专业模块拥有专业事实与工单定义，`work-execution` 拥有任务、工单及其状态机，`lifecycle-control` 独占主流程转换。

“货柜是主任务”采用以下业务层级表达，不新增与 `FlowInstance` 重叠的 `ContainerTask` 聚合：

```text
ContainerRecord
  -> FlowInstance（货柜主任务的业务视图）
    -> LifecycleNodeInstance
      -> NodeTask（当前节点的一道工序子任务）
        -> WorkOrder[1..n]（可分派作业单元）
          -> ClientOperation[0..n]（命令及三阶段回执）
          -> WorkOrderFactApplication[0..n]（不可变事实应用）
```

V1 不发布独立 `containerTaskId`。历史草案或演示字段必须显式映射到 `flowInstanceId`，不得建立第二套主任务状态或数据库实体。

## 2. 模块责任

| 模块 | 拥有 | 不得负责 |
| --- | --- | --- |
| `shipment-registry` | `ContainerRecord` 与货柜业务关联 | 任务、工单或流程转换 |
| `lifecycle-control` | `FlowInstance`、节点实例和流程状态机 | 工单执行和专业事实判断 |
| `work-execution` | `NodeTask`、`WorkOrder`、状态机、分派、聚合和事实应用 | 解释供应商裸码、直接写流程状态 |
| 专业业务模块 | 版本化任务/工单定义、专业事实及完成政策输入 | 直接更新任务、工单或流程表 |
| Integration Adapter | 原始载荷保存与外部值规范化候选 | 直接完成工单、任务或节点 |
| Application | 权限、幂等、事务、命令编排和跨模块公开端口 | 绕过领域状态机 UPDATE 终态 |

依赖方向固定为 `UI / Transport -> Application -> Domain <- Infrastructure`。模块之间只交换稳定逻辑 ID、公共命令、查询和事件，不跨模块写表。

## 3. 核心对象与基数

| 对象 | 标识 | 基数与不变量 |
| --- | --- | --- |
| 货柜流转主任务视图 | `containerId + flowInstanceId` | 一个货柜同一时刻最多一个 active FlowInstance |
| 节点实例 | `nodeInstanceId` | 属于一个 FlowInstance；以 `nodeCode + activationNo` 区分重入 |
| 工序子任务 | `nodeTaskId` | 一个 nodeInstance 最多一个当前有效 NodeTask |
| 作业工单 | `workOrderId` | 一个 NodeTask 至少一张 required 或 conditional-required 工单；纯外部监控任务也必须有监控工单 |
| 客户操作 | `clientOperationId` | 一张 WorkOrder 可有多次命令操作；同步状态独立 |
| 工单事实应用 | `factApplicationId` | 同一 `workOrderId + businessFactKey` 最多一条有效应用记录 |

NodeTask 与 WorkOrder 均保存创建时采用的定义键、定义版本和完成政策快照哈希。定义后续升级不得静默改变在途实例；迁移必须使用显式命令、原因和审计。

## 4. 定义契约

### 4.1 `NodeTaskDefinitionV1`

```text
taskDefinitionKey: string(1..100)
taskDefinitionVersion: integer >= 1
nodeCode: LifecycleNodeCode
ownerDomain: bounded-context code
workOrderDefinitions: unique WorkOrderDefinitionRef[1..]
completionPolicy: NodeTaskCompletionPolicyV1
resultPolicy: NodeTaskResultPolicyV1
```

### 4.2 `WorkOrderDefinitionV1`

```text
workOrderDefinitionKey: string(1..100)
workOrderDefinitionVersion: integer >= 1
ownerDomain: bounded-context code
requirement: required | optional | conditional
conditionCode?: stable rule code
executionMode: human | system | external | hybrid
assignmentPolicy: named | team | pool | automatic
completionPredicates: unique stable rule code[1..]
acceptedFactTypes: unique string[1..]
allowedActionCodes: unique string[1..]
duePolicyRef?: string
```

条件工单必须保存条件判定结果、规则版本和输入事实引用。条件为 false 时状态保持 `cancelled` 不准确，因此使用独立适用性 `not_applicable`，不创建虚假取消历史。

## 5. 状态模型

### 5.1 `NodeTaskState`

```text
pending | in_progress | blocked | completed | reopened | cancelled
```

| 状态 | 含义 |
| --- | --- |
| `pending` | 已创建，必需工单集合已确定，尚无工单开始或被事实满足 |
| `in_progress` | 至少一张适用工单已开始、完成或正在等待非阻断结果，整体尚未完成 |
| `blocked` | 存在阻断任务完成的有效 Block、失败的必需工单或缺失强制输入 |
| `completed` | 所有必需完成条件已由有效事实满足，完成快照已密封 |
| `reopened` | 原完成后因新必需事实、撤销、更正、补录或返工要求重新打开 |
| `cancelled` | 因流程取消、节点不适用或授权业务终止而关闭；不表示工序完成 |

合法转换：

| 起点 | 允许终点 |
| --- | --- |
| `pending` | `in_progress,blocked,completed,cancelled` |
| `in_progress` | `blocked,completed,cancelled` |
| `blocked` | `pending,in_progress,completed,cancelled` |
| `completed` | `reopened` |
| `reopened` | `in_progress,blocked,completed,cancelled` |
| `cancelled` | 无；需要恢复时创建新的节点激活或经后续版本批准专用恢复规则 |

`pending/blocked/reopened -> completed` 只允许聚合器证明全部完成条件已被权威事实满足时发生，不允许普通“完成任务”按钮直接指定。

### 5.2 `WorkOrderState`

```text
draft | ready | in_progress | blocked | completed | failed | reopened | cancelled
```

| 状态 | 含义 |
| --- | --- |
| `draft` | 工单已创建，定义、条件或必需输入尚未完成校验 |
| `ready` | 校验通过，可领取、自动执行或接受匹配事实 |
| `in_progress` | 已开始执行或正在采集必需结果 |
| `blocked` | 存在可解除的外部等待、资料缺失、退单或业务阻断 |
| `completed` | 全部完成谓词已由有效事实满足，结果快照已密封 |
| `failed` | 本次执行尝试失败且需要明确重试、替换或终止决策 |
| `reopened` | 原完成/失败后因撤销、更正、返工或补录要求重新打开 |
| `cancelled` | 经授权终止或判定不再适用；不等于完成 |

合法转换：

| 起点 | 允许终点 |
| --- | --- |
| `draft` | `ready,cancelled` |
| `ready` | `in_progress,blocked,completed,cancelled` |
| `in_progress` | `blocked,completed,failed,cancelled` |
| `blocked` | `ready,in_progress,completed,failed,cancelled` |
| `completed` | `reopened` |
| `failed` | `reopened,cancelled` |
| `reopened` | `ready,in_progress,blocked,completed,failed,cancelled` |
| `cancelled` | 无 |

`ready/blocked/reopened -> completed` 允许权威事实直接满足全部完成谓词，但仍必须经过 `ApplyFactToWorkOrder`、状态机、版本检查和审计。

### 5.3 正交状态

- 分派状态不是工单状态；单独记录 `unassigned | assigned | pool | automatic`。
- 同步状态不是工单状态；`received/accepted/committed/rejected/retrying/dead_letter` 只描述 ClientOperation 或消息处理。
- 数据有效性、证据验证、专业案卷状态、异常状态和生命周期状态均保持独立。
- 等待外部结果通常是 `in_progress` 加等待原因；只有该等待阻止完成且需要处置时才进入 `blocked`。

## 6. 工单适用性与聚合

`WorkOrderApplicability = required | optional | conditional_required | not_applicable`。适用性与状态分开保存，`not_applicable` 必须有规则版本、判定事实和时间。

NodeTask 每次相关事实或工单状态改变后确定性重算：

1. 读取任务定义版本、完成政策快照及全部适用工单。
2. 验证动态 required 工单集合是否完整；缺失定义或未知条件明确失败并进入复核。
3. 若 NodeTask 已授权取消，保持 `cancelled`，但迟到事实仍保存并触发对账。
4. 若存在有效 Task Block、失败的 required 工单或缺失强制输入，结果为 `blocked`。
5. 若所有 required/conditional-required 工单均为 `completed`，所有任务级完成谓词为 true，且不存在禁止完成的 Block，则结果为 `completed`。
6. optional 工单未完成不阻止任务完成；但其结果继续独立保存，除非完成政策明确将其升级为 required。
7. 其余情况下，任何适用工单已离开 `draft/ready` 或已有完成事实时为 `in_progress`，否则为 `pending`。

聚合结果必须保存：

```text
aggregationVersion
policySnapshotHash
requiredWorkOrderIds
completedWorkOrderIds
blockingRefs
evaluatedFactRefs
previousState
nextState
evaluatedAt
```

同一输入集合和政策版本必须得到相同结果。不得按 UI 顺序、消息到达顺序或数据库更新时间聚合。

## 7. 作业事实与同语义应用

工单完成依据是不可变业务事实，不是按钮、同步成功或字段被填写。事实可以来自：

```text
external_evidence | manual_backfill | controlled_import | internal_system
```

外部权威证据与授权人工后补录表达同一业务事实时，使用相同：

- `businessFactType`、`businessFactKey` 和业务对象；
- 实际 `occurredAt` 语义；
- 完成谓词和工单状态机；
- `ApplyFactToWorkOrderCommandV1`；
- 幂等、并发、聚合和结果事件路径。

二者只在 `captureSource`、来源主体、操作者、补录原因、证据引用、验证记录和审计轨迹上不同。人工录入不得降低完成条件，外部 Adapter 也不得直接 UPDATE 工单。

`WorkOrderFactApplicationV1` 至少记录：

```text
factApplicationId, tenantId, workOrderId
businessFactType, businessFactKey, domainFactId
captureSource, evidenceRefs[]
occurredAt, receivedAt, recordedAt
requestHash, decision: applied | rejected | no_op
decisionReason?, previousState, resultingState
appliedAt, actorOrServiceId, traceId
```

同一 `workOrderId + businessFactKey` 重放返回原结果；同键异 `requestHash` 明确冲突。一个事实可匹配多张工单时，每张工单分别留下应用记录；不得共享一条可变应用状态。

## 8. 外部事实先到与迟到

1. 外部事实先于工单到达时，专业模块先保存规范事实，`work-execution` 在节点任务/工单创建后按业务键对账并应用。
2. 外部事实已经合法推进生命周期时，匹配工单仍可由同一事实完成；这是内部作业对账，不得再次推进节点。
3. 工单先完成、权威事实后到时，事实按相同业务键合并并提升来源证据，不重复完成、聚合或发布结果。
4. 无法唯一关联的事实进入复核队列，不猜测工单、不按箱号裸匹配。
5. 迟到的撤销或更正不得覆盖历史；必须追加事实，必要时将 completed 工单和 NodeTask 置为 `reopened`。

## 9. 命令

所有写命令必须包含 `tenantId`、`idempotencyKey`、`expectedVersion`、操作者/服务身份和 `traceId`；对象引用必须属于同一租户和同一关联链。

| 命令 | 作用 | 关键约束 |
| --- | --- | --- |
| `CreateNodeTaskCommandV1` | 为已激活节点创建任务与工单集合 | `nodeInstanceId + taskDefinitionVersion` 幂等 |
| `AssignWorkOrderCommandV1` | 分派个人、团队或池 | 不改变业务完成状态 |
| `StartWorkOrderCommandV1` | `ready/reopened -> in_progress` | 校验分派、权限和前置条件 |
| `ApplyFactToWorkOrderCommandV1` | 应用外部/人工/导入/系统事实 | 统一事实语义、来源验证和业务键 |
| `BlockWorkOrderCommandV1` | 添加指定 Block | 必须有原因、来源、时间和恢复责任 |
| `ResolveWorkOrderBlockCommandV1` | 解除指定 Block | 不允许“全部解除” |
| `FailWorkOrderAttemptCommandV1` | 记录执行失败 | 失败原因和 attempt 必填 |
| `CancelWorkOrderCommandV1` | 授权取消 | required 工单取消后任务不得自动完成，除非适用性另行批准 |
| `ReopenWorkOrderCommandV1` | 更正、撤销或返工 | 引用原完成/失败事实及原因 |
| `CancelNodeTaskCommandV1` | 流程取消或节点不适用 | 不发布完成结果 |
| `ReopenNodeTaskCommandV1` | 完成后重新聚合 | 引用触发事实并保留原完成快照 |

NodeTask 状态不提供任意 `SetStatus` 命令；它只能由创建、取消、重开和聚合器改变。WorkOrder 同样禁止通用状态写入接口。

## 10. 任务结果与生命周期推进

固定链路为：

```text
业务事实
  -> WorkOrderFactApplication
  -> WorkOrder 状态机
  -> NodeTask 确定性聚合
  -> 任务结果/专业事实引用
  -> 规范事件（若完成政策允许且尚未存在）
  -> lifecycle-control 校验 completionEligibleNodeCodes 与全部守卫
  -> 完成节点并激活下一节点
```

- NodeTask `completed` 只表示内部工序闭环，不天然等于节点完成。
- 每个 `NodeTaskDefinitionV1.resultPolicy` 必须声明：`none | emit_canonical_event | reference_existing_event`、规范 `eventCode@eventVersion`、所需专业事实类型和事件业务键算法。
- `work-execution` 不解释供应商码、不伪造海关/港口/仓库专业事实。需要专业裁决时，只发布任务结果并由所有者模块形成规范事件。
- 外部规范事件已存在时使用 `reference_existing_event`；不得因工单随后完成而发布第二个同义事件。
- 事件接收按 `eventId` 幂等，节点应用按 `eventId + nodeInstanceId` 幂等；工单聚合不能绕过生命周期顺序、来源、证据或 Block 守卫。

## 11. 事务、并发和 Outbox

一次事实应用在 `work-execution` 本地事务中完成：

```text
Inbox/幂等判定
-> 锁定 WorkOrder expectedVersion
-> 写不可变 FactApplication
-> 转换 WorkOrder
-> 重算并转换 NodeTask
-> 写状态历史、审计和 Outbox
-> 提交
```

乐观并发冲突必须重读后重新评估，不自动覆盖。Outbox 发布失败不回滚已提交业务事实，由发布器重试；消费者幂等。跨模块不得使用分布式事务或直接共享 Repository。

## 12. 阻断、失败、取消和重开

- Block 是带 `blockId` 的独立事实，可并存；解除一个 Block 不影响其他 Block。
- `failed` 表示一次执行尝试失败，不能自动改回 ready；必须明确重开、替换或取消。
- required 工单取消不会被当作已完成；必须先通过适用性命令变成 `not_applicable` 或创建替代工单。
- NodeTask 完成快照和 WorkOrder 完成事实密封；纠错使用更正、撤销和 `reopened`，不得原地修改实际时间或结果。
- 已完成的生命周期物理事实不会因内部任务重开而自动倒退；产生冲突时进入人工纠偏。

## 13. 查询投影最低要求

P5 将定稿统一查询 Schema；P2 先锁定必须可见的业务语义：

- 货柜与流程、当前节点、`nodeTaskId`、任务状态和定义版本；
- 工单列表、适用性、状态、分派、截止时间、完成条件和完成进度；
- required/optional/conditional 标识及当前聚合阻断；
- 业务发生时间、系统记录时间、来源、证据和事实应用结果；
- 外部自动回填或人工后补录的来源差异；
- ClientOperation 三阶段回执，不与工单状态合并；
- 服务端计算的允许动作、拒绝原因和 traceId；
- 完成后形成或引用的规范事件及节点应用结果。

列表必须分页、限制最大页大小并稳定排序。前端不得从文案、颜色或同步成功推导任务、工单或流程状态。

## 14. 验收矩阵

至少覆盖：

1. 单 required 工单完成后 NodeTask 完成。
2. 多 required 工单只完成部分时 NodeTask 保持 in_progress。
3. optional 工单未完成不阻止聚合。
4. conditional 工单按版本化规则变为 required 或 not_applicable。
5. 外部事实先到，建单后自动对账并直接完成。
6. 人工后补录与外部事实产生相同业务结果但保留不同审计。
7. 同一事实重复、同业务键异载荷及并发应用。
8. required 工单 blocked/failed/cancelled 时任务不得误完成。
9. 多 Block 只解除指定项。
10. completed 工单收到撤销/更正后重开并重新聚合。
11. NodeTask 完成但规范事件守卫失败时节点不推进。
12. 外部事件已先推进节点，工单后补闭环不重复发布或推进。
13. 未来节点事实先到时保存并在节点激活后对账。
14. 越权、跨租户、错货柜、错节点和过期版本明确拒绝。
15. 事务故障时事实应用、状态、聚合与 Outbox 全部提交或全部回滚。
16. 重放相同事实与任务定义得到相同聚合结果。

## 15. 版本与后续实例化

- V1 状态线值不得原地改义。新增状态或转换是行为变更；删除、改名或改变终态语义是破坏性变更。
- 当前为业务契约 `D3`，尚无 JSON Schema、生成类型、OpenAPI、数据库迁移或运行时实现。
- P3 的证据与来源权威契约将补齐 `verifiedFactRef` 的来源资格和冲突裁决，不改变本文件的状态机所有权。
- P4 将定稿跨模块 ID、动作权限和同步可靠性；P5 将定稿查询与错误；P6/P7 才实例化并生成技术载体。

