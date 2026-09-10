# 同步可靠性契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-009` · 版本：`1.0.0` · 定稿日期：2026-09-10  
> 所有者：集成平台负责人

## 1. 权威边界

本文件定义 ClientOperation 三阶段确认、幂等、Inbox/Outbox、重试、超时、死信和补偿。它不定义任务、工单、专业事实或生命周期状态；传输成功不代表业务完成，永远不能替代专业事实和状态机裁决。

## 2. 三阶段确认

```text
ReceptionState = pending | received | duplicate | boundary_rejected
BusinessDecisionState = pending | accepted | rejected
CommitState = pending | committed | commit_failed
```

| 阶段              | 必须提供                                            | 不代表           |
| ----------------- | --------------------------------------------------- | ---------------- |
| Reception         | clientOperationId、receivedAt、幂等结果、traceId    | 业务接受         |
| Business Decision | accepted/rejected、decidedAt、稳定原因              | 事实已落账       |
| Commit            | committed/commit_failed、committedAt?、resultRefs[] | 下游投影全部刷新 |

同步事务可以一次返回三阶段；异步处理必须允许按 clientOperationId 查询。网络超时表示结果未知，客户端使用同一 clientOperationId/idempotencyKey 查询或重试，不创建新操作。

## 3. 操作记录

`ClientOperationV1` 至少包含：

```text
clientOperationId, tenantId
actionCode, actionVersion
target EntityRefV1
correlationId, causationId?, traceId
idempotencyKey, requestHash
receptionState, businessDecisionState, commitState
receivedAt?, decidedAt?, committedAt?
resultRefs[], rejectionReasonCode?
attemptCount, lastAttemptAt?, nextAttemptAt?
createdAt, updatedAt
```

同一幂等范围内同 key 同 requestHash 返回原操作达到的最高阶段及相同结果引用；同 key 异 hash 明确冲突。

## 4. 幂等范围

- API 动作：`tenantId + actor/service + actionCode + idempotencyKey`。
- 外部事件：优先 `tenantId + provider + interfaceCode + sourceEventId`，否则使用版本化业务指纹。
- Inbox：`consumerName + messageId`，并保存 payloadHash。
- Outbox：eventId 全局唯一；一次本地事务只产生一个同义业务事件。
- 工单事实应用：`tenantId + workOrderId + businessFactKey`。
- 生命周期节点应用：`tenantId + flowInstanceId + eventId + targetNodeInstanceId`。

## 5. Inbox

```text
InboxState = received | processing | processed | retry_wait | dead_letter
```

消费者业务更新、Inbox processed 和本地 Outbox 必须在同一本地事务中提交。processing 租约必须有 owner、lockedAt 和 expiresAt；进程崩溃后可安全接管。相同 messageId 异 payloadHash 进入冲突告警。

## 6. Outbox

```text
OutboxState = pending | publishing | published | retry_wait | dead_letter
```

领域状态变化与 Outbox 插入同事务。发布器至少一次投递，消费者必须幂等；不得先发消息再提交业务事务。publishing 使用可过期租约，published 保存 broker reference 和时间。

## 7. 重试与超时

- 只重试暂时性技术失败，如网络中断、超时、限流和可恢复依赖故障。
- Schema、权限、业务拒绝、未知码、幂等冲突和非法状态不可自动重试。
- 退避、抖动、最大次数、总时限和供应商限流按版本化策略配置，不硬编码进业务状态。
- 每次重试复用相同业务操作/消息 ID；attemptId 可变化。
- 超时后先查询既有结果；无法确认时保持 unknown/pending，不宣称失败或完成。
- 熔断和降级不得清空最后有效业务事实。

## 8. 死信与人工重放

进入 dead_letter 必须保存原消息受控引用、哈希、失败分类、最后错误、尝试摘要、租户、对象和 traceId，并告警到明确责任队列。人工重放需要权限、原因、目标消费者版本和幂等检查；不得修改原消息后以同 messageId 重放。

修正载荷必须生成新消息 ID，并通过 causationId 关联原死信。敏感数据按引用访问，死信界面不得展示凭据或不必要个人信息。

## 9. 补偿

```text
CompensationState = not_required | pending | in_progress
  | compensated | failed | manual_review
```

补偿是新的业务命令和事实，不是数据库回滚或删除历史。只有动作定义明确提供补偿语义时才能执行；已发生物理事实通常只能更正、撤销投影或创建反向业务动作。补偿失败进入人工复核，不能把原操作改写成从未发生。

## 10. 顺序、重复与投影

- 消息传输顺序不等于业务发生顺序；消费者使用 occurredAt、版本和领域规则处理乱序。
- 重复消息是正常情况，必须幂等。
- 未来节点事实先保存，前序满足后逐节点重放。
- 投影可最终一致；响应应返回事实版本或 resultRef，前端不能用 toast 或 HTTP 200 推断业务完成。
- NODATA、空响应和同步失败只更新同步记录，不生成“未发生”事实。

## 11. 可观测性与安全

指标至少覆盖接收量、处理延迟、重试率、死信量、最老积压、租约接管、幂等冲突和补偿失败。日志使用 traceId/correlationId/clientOperationId，不记录密钥、Token、Cookie 或完整原始载荷。

## 12. 验收

覆盖同步三阶段、异步查询、响应丢失后同 ID 重试、同键异载荷、并发重复、业务拒绝不重试、暂时错误退避、限流、Inbox 崩溃接管、Outbox 发布后确认丢失、死信授权重放、修正消息新 ID、补偿成功/失败、乱序、NODATA、不清空有效事实以及业务提交与 Outbox 原子性。

当前三阶段操作记录已有局部 Schema，但 Inbox、Outbox、重试、死信和补偿模型尚未完整实例化，门禁保持 `D3`；数据库表和运行时发布器仍待后续阶段。
