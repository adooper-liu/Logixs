# 公共错误契约 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-011` · 版本：`1.0.0` · 定稿日期：2026-09-10  
> 所有者：平台契约负责人；领域错误由对应业务模块负责

## 1. 目的与权威边界

本文件是公共 API、动作、事件消费和异步操作错误信封、稳定错误码、HTTP 映射、冲突分类、可重试性及兼容规则的唯一业务权威。供应商错误只保存在 Adapter 诊断中，必须映射为本契约代码后才能越过公共边界。

HTTP 表示协议结果，`error.code` 表示稳定机器语义。错误消息不能作为程序分支条件。

## 2. 统一错误信封

`ErrorResponseV1`：

```text
success: false
error:
  code: PublicErrorCodeV1
  message: string
  category: ErrorCategoryV1
  retryable: boolean
  details: ErrorDetailV1[]
  conflict?: ConflictDescriptorV1
traceId: string
clientOperationId?: UUID
timestamp: date-time
```

`details` 无内容时返回 `[]`。message 面向人类并可本地化；code、category、retryable 和 details 字段码不可本地化。响应不得包含栈、SQL、内部路径、凭据、Token、Cookie、完整外部载荷或证据原文。

`ErrorDetailV1`：

```text
field?: JSON Pointer
reasonCode: stable detail code
message: string
rejectedValueSummary?: redacted string
```

## 3. 分类、HTTP 与重试

| category         |   默认 HTTP | retryable   | 语义                                 |
| ---------------- | ----------: | ----------- | ------------------------------------ |
| `validation`     |         400 | false       | 结构、格式、范围或字段组合非法       |
| `authentication` |         401 | false       | 未认证或凭据失效                     |
| `authorization`  |         403 | false       | 能力、对象、字段、租户或职责分离拒绝 |
| `not_found`      |         404 | false       | 在授权范围内目标不存在               |
| `conflict`       |         409 | false       | 幂等、版本、密封、锁或并发冲突       |
| `precondition`   |         422 | false       | 结构有效但业务守卫或证据条件不满足   |
| `rate_limit`     |         429 | true        | 可在明确窗口后重试                   |
| `dependency`     | 502/503/504 | conditional | 外部依赖、映射或超时                 |
| `internal`       |     500/503 | conditional | 未预期故障或服务暂不可用             |

`retryable=true` 只是技术重试资格，不代表客户端应立即重试。必须同时服从 `retryAfter`、幂等键和操作查询规则；业务拒绝、未知映射、权限、状态和同键异载荷不得自动重试。

## 4. V1 公共错误码

### 4.1 平台与边界

| code                         | HTTP | category       | retryable | 判定                                |
| ---------------------------- | ---: | -------------- | --------- | ----------------------------------- |
| `VALIDATION_REQUIRED`        |  400 | validation     | false     | 必填字段缺失                        |
| `VALIDATION_FORMAT`          |  400 | validation     | false     | 类型或格式错误                      |
| `VALIDATION_RANGE`           |  400 | validation     | false     | 长度、数量、精度或页大小越界        |
| `VALIDATION_FIELD_CONFLICT`  |  400 | validation     | false     | 字段组合自相矛盾                    |
| `AUTHENTICATION_REQUIRED`    |  401 | authentication | false     | 未认证                              |
| `AUTHENTICATION_EXPIRED`     |  401 | authentication | false     | 凭据或会话过期                      |
| `AUTHORIZATION_FORBIDDEN`    |  403 | authorization  | false     | 缺少动作能力                        |
| `AUTHORIZATION_SCOPE_DENIED` |  403 | authorization  | false     | 租户、组织、地点、对象或字段越权    |
| `RESOURCE_NOT_FOUND`         |  404 | not_found      | false     | 授权范围内资源不存在                |
| `RATE_LIMIT_EXCEEDED`        |  429 | rate_limit     | true      | 超过适用限流策略                    |
| `SERVICE_UNAVAILABLE`        |  503 | internal       | true      | 服务暂不可用                        |
| `INTERNAL_ERROR`             |  500 | internal       | false     | 未预期内部错误；仅通过 traceId 排查 |

### 4.2 幂等、并发与历史

| code                          | HTTP | category   | retryable | conflictType           |
| ----------------------------- | ---: | ---------- | --------- | ---------------------- |
| `IDEMPOTENCY_KEY_CONFLICT`    |  409 | conflict   | false     | idempotency            |
| `VERSION_CONFLICT`            |  409 | conflict   | false     | optimistic_concurrency |
| `HISTORY_SEALED`              |  409 | conflict   | false     | sealed_history         |
| `MANUAL_LOCK_CONFLICT`        |  409 | conflict   | false     | manual_lock            |
| `REVIEW_REQUIRED`             |  409 | conflict   | false     | manual_review          |
| `CURSOR_INVALID`              |  400 | validation | false     | —                      |
| `CURSOR_EXPIRED`              |  409 | conflict   | false     | snapshot_expired       |
| `PROJECTION_VERSION_CONFLICT` |  409 | conflict   | false     | projection_version     |
| `PROJECTION_UNAVAILABLE`      |  503 | internal   | true      | —                      |

同幂等键同请求哈希返回原操作结果，不是错误；同键异哈希才返回 `IDEMPOTENCY_KEY_CONFLICT`。

### 4.3 动作与业务守卫

| code                           | HTTP | category     | retryable | 判定                   |
| ------------------------------ | ---: | ------------ | --------- | ---------------------- |
| `ACTION_UNKNOWN`               |  400 | validation   | false     | 动作码或版本未登记     |
| `ACTION_TARGET_MISMATCH`       |  422 | precondition | false     | 动作不适用于目标类型   |
| `ACTION_CONFIRMATION_REQUIRED` |  422 | precondition | false     | 缺少有效显式确认       |
| `ACTION_REVIEW_REQUIRED`       |  422 | precondition | false     | 缺少有效复核批准       |
| `BUSINESS_STATE_VIOLATION`     |  422 | precondition | false     | 当前业务状态不允许动作 |
| `BUSINESS_PRECONDITION_FAILED` |  422 | precondition | false     | 业务守卫未满足         |
| `EVIDENCE_REQUIRED`            |  422 | precondition | false     | 缺少合格证据           |
| `SOURCE_NOT_AUTHORIZED`        |  422 | precondition | false     | 来源无资格支持该事实   |
| `UNKNOWN_EXTERNAL_MAPPING`     |  422 | precondition | false     | 外部值未映射并进入复核 |

### 4.4 生命周期与时间线

以下代码保留既有 V1 线值，具体触发条件仍由对应领域契约负责：

| code                                       | HTTP | category     |
| ------------------------------------------ | ---: | ------------ |
| `LIFECYCLE_FLOW_NOT_FOUND`                 |  404 | not_found    |
| `LIFECYCLE_FLOW_ALREADY_ACTIVE`            |  409 | conflict     |
| `LIFECYCLE_DEFINITION_VERSION_UNSUPPORTED` |  422 | precondition |
| `LIFECYCLE_NODE_NOT_CURRENT`               |  422 | precondition |
| `LIFECYCLE_NODE_NOT_OPTIONAL`              |  422 | precondition |
| `LIFECYCLE_NODE_APPLICABILITY_CONFLICT`    |  409 | conflict     |
| `LIFECYCLE_EVENT_TYPE_UNKNOWN`             |  400 | validation   |
| `LIFECYCLE_EVENT_NOT_STATE_EVIDENCE`       |  422 | precondition |
| `LIFECYCLE_EVENT_PENDING_PREDECESSOR`      |  422 | precondition |
| `LIFECYCLE_SOURCE_NOT_AUTHORIZED`          |  422 | precondition |
| `LIFECYCLE_EVIDENCE_REQUIRED`              |  422 | precondition |
| `LIFECYCLE_GUARD_NOT_SATISFIED`            |  422 | precondition |
| `LIFECYCLE_ACTIVE_BLOCK_EXISTS`            |  422 | precondition |
| `LIFECYCLE_TIME_ORDER_CONFLICT`            |  409 | conflict     |
| `LIFECYCLE_HISTORY_SEALED`                 |  409 | conflict     |
| `LIFECYCLE_IDEMPOTENCY_CONFLICT`           |  409 | conflict     |
| `LIFECYCLE_VERSION_CONFLICT`               |  409 | conflict     |
| `LIFECYCLE_REENTRY_NOT_ALLOWED`            |  422 | precondition |
| `LIFECYCLE_MANUAL_REVIEW_REQUIRED`         |  409 | conflict     |
| `TIMELINE_EVENT_INVALID`                   |  400 | validation   |
| `TIMELINE_TIMEZONE_UNKNOWN`                |  422 | precondition |
| `TIMELINE_EVENT_DUPLICATE_CONFLICT`        |  409 | conflict     |
| `TIMELINE_EVENT_RELATION_INVALID`          |  422 | precondition |
| `TIMELINE_PROJECTION_VERSION_CONFLICT`     |  409 | conflict     |
| `TIMELINE_MANUAL_REVIEW_REQUIRED`          |  409 | conflict     |

以上错误均为 `retryable=false`；发生并发或投影版本冲突时，调用方应先刷新再发起新的、重新校验过的命令，而不是自动重试原请求。

### 4.5 海关专业模块

| code                                   | HTTP | category     |
| -------------------------------------- | ---: | ------------ |
| `CUSTOMS_CASE_NOT_FOUND`               |  404 | not_found    |
| `CUSTOMS_WORK_ORDER_NOT_FOUND`         |  404 | not_found    |
| `CUSTOMS_EXTERNAL_PAYLOAD_INVALID`     |  400 | validation   |
| `CUSTOMS_REQUIRED_CASE_MISSING`        |  422 | precondition |
| `CUSTOMS_RELEASE_EVIDENCE_MISSING`     |  422 | precondition |
| `CUSTOMS_EVIDENCE_SCOPE_MISMATCH`      |  422 | precondition |
| `CUSTOMS_WORK_ORDER_EVIDENCE_MISMATCH` |  422 | precondition |
| `CUSTOMS_EXTERNAL_MAPPING_UNKNOWN`     |  422 | precondition |
| `CUSTOMS_INVALID_TRANSITION`           |  422 | precondition |
| `CUSTOMS_ACTIVE_BLOCK_EXISTS`          |  422 | precondition |
| `CUSTOMS_IDEMPOTENCY_CONFLICT`         |  409 | conflict     |
| `CUSTOMS_VERSION_CONFLICT`             |  409 | conflict     |
| `CUSTOMS_MANUAL_REVIEW_REQUIRED`       |  409 | conflict     |

以上错误均为 `retryable=false`。海关模块负责触发条件，公共信封、HTTP 与兼容语义由本契约负责。

### 4.6 同步与依赖

| code                          | HTTP | category   | retryable   | 判定                               |
| ----------------------------- | ---: | ---------- | ----------- | ---------------------------------- |
| `DEPENDENCY_UNAVAILABLE`      |  502 | dependency | true        | 外部依赖暂不可用                   |
| `DEPENDENCY_TIMEOUT`          |  504 | dependency | true        | 外部调用超时，业务结果未知         |
| `DEPENDENCY_RESPONSE_INVALID` |  502 | dependency | false       | 响应不符合已知接口契约             |
| `SYNC_MESSAGE_CONFLICT`       |  409 | conflict   | false       | 同消息 ID 异载荷                   |
| `SYNC_DEAD_LETTERED`          |  409 | conflict   | false       | 操作已进入死信并需人工处理         |
| `SYNC_COMMIT_FAILED`          |  503 | internal   | conditional | 业务决定后提交失败；按操作状态处理 |

超时和 5xx 不允许客户端创建新业务操作；按 `clientOperationId` 查询，并使用原 `idempotencyKey` 重试。

## 5. 冲突描述

`ConflictDescriptorV1`：

```text
type: idempotency | optimistic_concurrency | sealed_history
  | manual_lock | manual_review | snapshot_expired
  | projection_version | message_payload
expectedVersion?: integer
actualVersion?: integer
existingResourceRef?: EntityRefV1
resolution: refresh | use_existing | submit_new_key | request_review
  | correct_source | wait_and_retry
```

冲突描述只提供解决所需的最小元数据，不返回未授权资源、原始 payload 或前后敏感值。

## 6. 异步操作错误

三阶段操作中的边界拒绝、业务拒绝和提交失败均使用本契约稳定码：

- `boundary_rejected`：通常为 400/401/403。
- `businessDecisionState=rejected`：保存领域或前置条件错误码，不改写为传输错误。
- `commit_failed`：保存提交失败码和 traceId；不得把已接受伪装成未接收。
- 可重试性由错误码与同步策略共同决定，不能仅看 HTTP。

## 7. 安全与可观测性

- 每次错误响应生成或透传有效 `traceId`，但不得允许调用者指定任意可信追踪身份。
- 认证与授权错误避免泄露目标是否存在；必要时统一返回范围拒绝。
- 结构化日志保存 code、category、HTTP、服务、环境、租户、主体摘要、对象引用、clientOperationId 和 traceId。
- `INTERNAL_ERROR` 不得把异常消息直接返回客户端；详细诊断只进入受控日志。

## 8. 兼容策略

- 已发布 code 不改名、不删除、不改变类别、HTTP 主语义或可重试含义。
- 新增 code 是加法兼容；客户端必须对同一已知 category 下的未知 code 使用安全兜底。
- 改变既有码语义、字段必填性或信封形状必须发布新版本并提供兼容期。
- 供应商码、数据库约束名和异常类名不是公共错误码。
- 旧候选 `VAL_*`、`AUTH_*`、`BIZ_*`、`IDEM_*`、`NF_*`、`EXT_*` 只作为迁移输入，不得在新 V1 API 发布；迁移映射由任务阶段 G6 Schema fixture 固化。

## 9. 验收矩阵

至少覆盖：

1. 400/401/403/404/409/422/429/5xx 映射正确。
2. 每个错误包含稳定 code、category、retryable、details 和 traceId。
3. 同键同载荷返回原结果，同键异载荷返回幂等冲突。
4. 乐观锁冲突给出实际版本但不泄露未授权对象。
5. 业务守卫失败不标记为技术可重试。
6. 超时后复用原操作 ID 查询或重试。
7. 认证、跨租户和对象越权不产生存在性侧信道。
8. 未知供应商码进入复核，不伪装成依赖暂时失败。
9. 内部异常、SQL、栈、凭据和原始载荷不进入响应。
10. 客户端面对同类别新增未知 code 能安全降级。
11. 异步三阶段分别保存边界、业务和提交错误。
12. TypeScript、OpenAPI、Python 和 fixture 从同一 Schema 派生且线值一致。

## 10. 版本与实例化

当前 `PublicErrorCodeV1` 和 `ErrorResponseV1` 已在任务阶段 G6 达到 `D4`；尚无生成类型、OpenAPI、数据库映射或运行时异常映射器。G7 实现各技术载体及 parity 检查。
