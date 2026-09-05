# 错误码清单 v0.1（ERROR_CODES_CATALOG · 候选）

> 状态：候选 · 2026-09-05 · 可落：契约/字典 Seed。HTTP 表传输层，业务成败看 `code`（成功 `0`）。
> 规则：码稳定、新增走评审；错误响应带 `traceId`，不泄露栈/SQL（AGENTS §5）。

| 族 | code | HTTP | 触发场景 | 说明 |
| --- | --- | --- | --- | --- |
| 成功 | `0` | 200 | 正常 | 业务成功 |
| 校验 | `VAL_REQUIRED` | 400 | 必填缺失 | 预检/入参 |
| 校验 | `VAL_FORMAT` | 400 | 格式错误 | 箱号/日期/编码等 |
| 校验 | `VAL_RANGE` | 400 | 超限/越界 | 行数/列数/大小/值域 |
| 校验 | `VAL_CURRENCY` | 400 | 金额缺币种/精度 | 定点+币种 |
| 校验 | `VAL_UNKNOWN_DICT` | 422 | 字典未命中 | 进待处理，不静默 |
| 校验 | `VAL_CONFLICT_FIELDS` | 422 | 字段冲突 | 如状态文本 vs 时间证据 |
| 认证 | `AUTH_UNAUTH` | 401 | 未认证 | — |
| 认证 | `AUTH_FORBIDDEN` | 403 | 无权限 | RBAC/对象级 |
| 认证 | `AUTH_SCOPE` | 403 | 越租户/数据范围 | 服务端授权 |
| 业务 | `BIZ_STATE_VIOLATION` | 422 | 非法状态转换 | 状态机拒绝 |
| 业务 | `BIZ_SEALED` | 409 | 改已密封历史 | R3 密封 |
| 业务 | `BIZ_SOURCE_LOCKED` | 409 | 手工锁被外部改写 | D7 来源权威 |
| 业务 | `BIZ_NOT_ALLOWED_AI` | 403 | AI 越权执行 | L3/L4 禁止 |
| 业务 | `BIZ_PRECHECK_BLOCKER` | 422 | 预检硬闸 | blocker 禁止写库 |
| 幂等 | `IDEM_DUPLICATE` | 409 | 批次/行重复命中 | 幂等键命中 |
| 幂等 | `IDEM_CONFLICT` | 409 | 并发写冲突 | 乐观锁 |
| 幂等 | `IDEM_STALE_VERSION` | 409 | 版本过期 | version |
| 未找到 | `NF_RECORD` | 404 | 对象不存在 | 记录/资源 |
| 限流 | `RATE_LIMIT` | 429 | 超限流 | 分级限流 |
| 外部 | `EXT_DOWN` | 502 | 外部源不可用 | 集成降级 |
| 外部 | `EXT_TIMEOUT` | 504 | 外部超时 | 超时策略 |
| 外部 | `EXT_MAPPING_MISS` | 502 | 三方码未映射 | 进待处理/告警 |

## 关联
- [CONTRACTS_DRAFT](./CONTRACTS_DRAFT.md)、[EXTERNAL_EVENT_MAPPING](./EXTERNAL_EVENT_MAPPING.md)。
