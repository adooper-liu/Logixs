# 动作与权限契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-008` · 版本：`1.0.0` · 定稿日期：2026-09-10  
> 所有者：`work-execution` 与 `identity` 的公开边界

## 1. 权威边界

本文件定义动作、命令信封、服务端授权、复核、撤销和补录边界。`ACTION_CATALOG` 只登记具体动作码；任务、状态机和专业模块定义业务前置条件；本契约定义所有动作共同遵守的授权协议。

前端允许动作投影不是安全边界。每次写入必须在服务端重新执行认证、租户、对象范围、能力、业务前置、风险和并发校验。

## 2. 动作定义

`ActionDefinitionV1`：

```text
actionCode: stable snake_case string
actionVersion: integer >= 1
ownerModule: bounded-context code
targetEntityTypes[]
requiredCapabilities[]
riskLevel: low | medium | high | critical
confirmationPolicy: none | explicit | reason_required
reviewPolicy: none | four_eyes | designated_reviewer
evidencePolicyRef?
allowedStatePredicates[]
businessPreconditionCodes[]
idempotencyScope
resultPolicy
```

动作码描述命令意图，不是按钮文案、状态码或事件码。改变结果语义、风险、复核或权限要求必须增加版本。

## 3. Actor 与授权上下文

```text
ActorType = user | service | integration | scheduled_job

AuthorizationContextV1:
  tenantId, actorType, actorId
  authenticatedAt, authenticationMethod
  roles[], capabilities[]
  organizationScope[], locationScope[]
  delegatedBy?, delegationExpiresAt?
  traceId
```

- 角色用于分组授权，能力是执行动作的稳定许可；禁止只比较前端角色名称。
- service/integration 使用最小权限身份，不模拟人工用户。
- 委托必须有授权人、范围和期限，不允许无限期代理。
- 对象级范围、字段级权限和租户边界必须服务端执行。

## 4. 公共命令信封

`ActionCommandV1<TPayload>`：

```text
clientOperationId: UUID
tenantId: UUID
actionCode, actionVersion
target: EntityRefV1
containerId, flowInstanceId?
nodeInstanceId?, nodeTaskId?, workOrderId?
occurredAt: date-time
submittedAt: date-time
idempotencyKey: string(1..200)
expectedVersion: integer >= 0
correlationId: UUID
causationId?: UUID
traceId: string(1..128)
reasonCode?, reason?
evidenceRefs[]
confirmationToken?
payload: schema-bound object
```

所有时间 ISO 8601 带时区，持久化为 UTC。payload 必须按动作版本 Schema 校验，禁止任意字段穿透领域对象。

## 5. 固定授权顺序

1. 边界 Schema、认证、会话/服务身份和租户校验。
2. 解析 target，并按跨模块引用契约验证对象和父链。
3. 校验 actionCode/version 已登记且目标类型匹配。
4. 校验 actor capabilities、组织/地点/对象/字段范围。
5. 校验委托、职责分离、二次确认和复核政策。
6. 校验业务状态、前置条件、证据资格、人工锁和历史密封。
7. 校验幂等键和 expectedVersion。
8. 在 Application 事务中调用领域命令，写操作记录、审计和 Outbox。

任一步失败均不得产生业务状态变化；稳定错误码由 `GC-011` 公共错误契约提供。

## 6. 风险、确认与四眼复核

| 风险     | 最低控制                                            |
| -------- | --------------------------------------------------- |
| low      | 正常授权与审计                                      |
| medium   | 明确对象和影响；按定义要求显式确认                  |
| high     | 必填原因和证据；必要时 designated reviewer          |
| critical | four-eyes、不可由发起人自批、短时有效批准、完整审计 |

撤销实际事实、解封历史、越过人工锁、取消已开始流程、费用核销和高风险人工纠偏默认不得低于 high。批准记录绑定命令哈希、对象、动作版本和有效期；payload 改变后原批准失效。

## 7. 人工补录与纠偏

- 人工补录调用与外部事实相同的 Application 用例和领域规则，不提供“管理员直接改状态”。
- 必须记录 actor、原因、发生时间、录入时间、证据和 expectedVersion。
- 人工补录不能自行提升来源权威；证据资格服从 `GC-006`。
- 更正、撤销和解封使用专用动作，引用原事实并追加记录，不覆盖历史。
- break-glass 只用于已批准紧急流程，要求临时能力、理由、告警、事后复核和自动失效。

## 8. 允许动作投影

查询可返回 `allowedActions[]`，包含 actionCode/version、当前是否可执行、不可执行原因类别、确认/复核要求和 expectedVersion。该投影用于体验优化，命令到达时必须重新授权；客户端不得缓存为永久许可。

## 9. 审计与隐私

每次尝试记录 clientOperationId、actor、动作、目标、授权策略版本、能力、范围、前置判定、批准人、结果、traceId 和时间。日志不得保存密码、Token、Cookie、完整敏感 payload 或证据原文。

## 10. 验收

覆盖合法动作、未认证、缺能力、跨租户、对象越权、字段越权、过期委托、错状态、缺证据、密封冲突、四眼同人拒绝、批准后 payload 改变、幂等重放、并发冲突、人工补录同规则、break-glass 到期和前端伪造 allowedAction。

G6 已补齐公共命令、动作定义、授权上下文、授权决定和复核记录 Schema，并通过覆盖索引及正负向 fixture 自校验，门禁为 `D4`；具体动作目录、生成类型和服务端策略实现仍待 G7。
