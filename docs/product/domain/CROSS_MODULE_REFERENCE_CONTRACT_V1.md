# 跨模块引用契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-007` · 版本：`1.0.0` · 定稿日期：2026-09-10  
> 所有者：架构负责人

## 1. 权威边界

本文件是跨限界上下文对象标识、所有权、引用方向和关联链的唯一业务权威。它不定义对象内部字段，不允许通过公共 ID 绕过模块公开端口。

## 2. 标识原则

- 所有公共实体 ID 使用不可解释、不可复用的 UUID；业务编号、箱号、提单号和供应商 ID 只能作为受版本约束的业务键。
- 所有引用必须携带或能从认证上下文确定 `tenantId`；服务端必须校验引用对象同租户。
- ID 一经发布不得因业务编号更正、来源切换、归档或重放而改变。
- API/事件使用 `camelCase`，数据库使用 `snake_case`，通过显式映射转换。

`EntityRefV1`：

```text
tenantId: UUID
entityType: registered entity type
entityId: UUID
ownerModule: registered bounded-context code
```

## 3. 所有权目录

| entityType | ID | 所有者 |
| --- | --- | --- |
| `container` | `containerId` | `shipment-registry` |
| `flow_instance` | `flowInstanceId` | `lifecycle-control` |
| `node_instance` | `nodeInstanceId` | `lifecycle-control` |
| `node_task` | `nodeTaskId` | `work-execution` |
| `work_order` | `workOrderId` | `work-execution` |
| `domain_fact` | `domainFactId` | 对应专业业务模块 |
| `evidence` | `evidenceId` | `document-records` 或经 ADR 批准的专业证据所有者 |
| `canonical_event` | `eventId` | 事件事实所有者；生命周期接收后保持原 ID |
| `client_operation` | `clientOperationId` | 接收命令的 Application 模块 |
| `receipt` | `receiptId` | 产生回执的集成/专业模块 |
| `exception` | `exceptionId` | `exception-management` |
| `audit_entry` | `auditEntryId` | `audit` |

## 4. 必须可追溯的主链

```text
tenantId
-> containerId
-> flowInstanceId
-> nodeInstanceId
-> nodeTaskId
-> workOrderId
-> clientOperationId

domainFactId -> evidenceId[]
domainFactId -> eventId
clientOperationId -> receiptId[]
eventId -> nodeInstanceId application
```

每个下游对象保存其直接父级逻辑 ID；查询投影可以展开整条链，但不得把展开 DTO 作为跨模块写模型。V1 不发布独立 `containerTaskId`，货柜主任务视图使用 `containerId + flowInstanceId`。

## 5. 引用完整性

1. 模块内父子关系使用数据库外键和租户复合约束。
2. 跨模块只保存逻辑 ID，不建立跨 schema 外键、不直接 JOIN 作为业务写入前提。
3. 写命令由 Application 通过公开查询/端口验证目标存在、租户一致、版本有效和业务关系合法。
4. 跨模块事件携带必要 ID 快照；消费者 Inbox 校验后建立本地引用投影。
5. 删除或归档所有者对象前发布生命周期事件并完成引用对账；审计、事实和法务保留引用不得级联删除。
6. 孤儿引用由定期对账发现并告警，不以静默置空修复。

## 6. 事件与操作关联

公共命令和事件必须提供：

```text
correlationId: UUID
causationId?: UUID
traceId: string
```

`correlationId` 关联一次业务链，`causationId` 指向直接触发命令/事件，`traceId` 仅用于技术追踪。三者不得互相替代，也不得用箱号作为 correlationId。

## 7. 幂等与版本

- 各聚合使用自己的 `expectedVersion`，不得用另一模块版本代替。
- 同一 ID 对应的 entityType 和 ownerModule 不可改变；同 ID 异类型明确拒绝。
- 业务键到 UUID 的解析必须按租户、类型和有效期唯一；多匹配进入复核。
- 新增实体类型为加法兼容；改变所有者、父链或 ID 语义属于破坏性变更。

## 8. 验收

覆盖同租户合法链、跨租户拒绝、错父级拒绝、业务编号更正 ID 不变、跨模块无外键、孤儿对账、归档保留、同 ID 异类型、事件因果链和重放 ID 稳定。

当前为 `D3`，P6/P7 才建立 Schema、数据库映射和运行时对账。

