# 海关数据库结构与迁移设计 V1

> 状态：数据库设计 V1（已定，待迁移实现）  
> 日期：2026-09-09  
> 技术基线：PostgreSQL + Prisma；唯一迁移入口 `database/migrations/`  
> 上游：[公共契约 V1](./CUSTOMS_PUBLIC_CONTRACT_DESIGN_V1.md)

## 1. 范围与所有权

本设计覆盖案卷、Hold、证据、外部观察、操作、回执、规范事实、工单事实应用、幂等、Inbox/Outbox 和审计。本轮不创建 SQL 或 Prisma Schema。

按限界上下文使用 PostgreSQL schema：

| schema | 所有者 | 表 |
| --- | --- | --- |
| `customs_compliance` | 海关模块 | case、hold、evidence、observation、operation、receipt、fact、idempotency、outbox/inbox |
| `work_execution` | 作业模块 | node_task、work_order、fact_application、idempotency、outbox/inbox |
| `audit` | 审计模块 | audit_entry、audit_inbox |

模块只能写自己 schema。跨模块 ID 是稳定逻辑引用，不建跨 schema 外键；一致性由 Application、Inbox 幂等、对账任务和监控保证。模块内关系必须使用外键。

## 2. 物理约定

- 表、列、约束、索引使用 `snake_case`。
- 主键 `uuid`，由应用生成；不依赖数据库隐式默认。
- 时间使用 `timestamptz`；金额不在本切片内。
- 状态使用 `varchar + CHECK`，不使用 PostgreSQL enum，便于兼容扩展。
- 所有租户业务表含 `tenant_id uuid not null`；每个唯一约束和主要索引先包含租户。
- 聚合根含 `version bigint not null default 0`、`created_at`、`updated_at`。
- 原始载荷只存受控对象存储引用与 SHA-256，不存正文。
- JSONB 仅用于受控 qualifier、响应摘要和审计差异；不得保存可稳定建模的核心状态。
- 删除采用业务取消/撤销或保留策略，不对证据、事实、回执、审计执行硬删除。

## 3. 海关核心表

### 3.1 `customs_compliance.customs_case`

```text
customs_case_id uuid PK
tenant_id uuid not null
container_id uuid not null              -- shipment-registry 逻辑引用
node_task_id uuid not null              -- work-execution 逻辑引用
case_key varchar(200) not null
jurisdiction varchar(16) not null
direction varchar(16) not null
declaration_reference varchar(200) null
is_required boolean not null default true
state varchar(32) not null
released_at timestamptz null
version bigint not null default 0
created_at / updated_at timestamptz not null
```

约束：

- `direction in ('import','export')`；`state` 取公共契约值。
- `released_at` 仅在 `state='released'` 时可有值。
- 唯一 `(tenant_id, case_key)`。
- declaration 非空时唯一 `(tenant_id,jurisdiction,direction,declaration_reference)`。
- 索引 `(tenant_id,container_id)`、`(tenant_id,node_task_id)`、`(tenant_id,state,updated_at desc)`。

### 3.2 `customs_compliance.customs_hold`

```text
customs_hold_id uuid PK
tenant_id uuid not null
customs_case_id uuid not null FK customs_case
hold_key varchar(200) not null
subject varchar(32) not null
hold_type varchar(100) not null
state varchar(16) not null              -- active | released
placed_fact_id uuid not null
released_fact_id uuid null
placed_at timestamptz not null
released_at timestamptz null
version bigint not null default 0
created_at / updated_at timestamptz not null
```

唯一 `(tenant_id,customs_case_id,hold_key)`。released 状态必须同时有 `released_fact_id/released_at`；active 状态两者必须为空。一个解除事实只解除匹配的 hold。`placed_fact_id/released_fact_id` 在事实表创建后追加模块内复合外键，迁移时设为可延迟检查以解决建表依赖，不得降级为无约束逻辑引用。

### 3.3 `customs_compliance.customs_evidence`

```text
customs_evidence_id uuid PK
tenant_id uuid not null
evidence_type varchar(64) not null
source_system varchar(64) not null
source_reference varchar(200) null
storage_object_key varchar(500) not null
content_sha256 char(64) not null
mime_type varchar(100) not null
captured_at timestamptz not null
business_occurred_at timestamptz null
source_authority varchar(32) not null
mapping_version varchar(64) null
created_at timestamptz not null
```

证据内容及来源元数据不可变，案卷归属只通过 `customs_case_evidence` 表达，避免同一权威文件被复制。`source_authority` 取 `authoritative | corroborating | operational | contextual`；权威等级只描述来源资格，不直接表示放行。唯一 `(tenant_id,source_system,content_sha256)`；索引 `(tenant_id,source_reference)`、`(tenant_id,captured_at desc)`。

### 3.4 `customs_compliance.customs_evidence_verification`

```text
customs_evidence_verification_id uuid PK
tenant_id uuid not null
customs_evidence_id uuid not null FK customs_evidence
verification_seq integer not null
decision varchar(16) not null          -- verified | rejected | revoked
reason_code varchar(64) not null
reason_text varchar(500) null
actor_type varchar(16) not null        -- system | user
actor_id uuid null
decided_at timestamptz not null
created_at timestamptz not null
```

该表 append-only，以最大 `verification_seq` 决定当前验证结果。唯一 `(tenant_id,customs_evidence_id,verification_seq)` 且序号大于零；人工决定必须有 `actor_id`；`revoked` 只能跟在 `verified` 后。索引 `(tenant_id,customs_evidence_id,verification_seq desc)`。

### 3.5 `customs_compliance.customs_case_evidence`

```text
customs_case_evidence_id uuid PK
tenant_id uuid not null
customs_case_id uuid not null FK customs_case
customs_evidence_id uuid not null FK customs_evidence
applicability varchar(16) not null     -- applicable | excluded
reason_code varchar(64) null
linked_at timestamptz not null
```

唯一 `(tenant_id,customs_case_id,customs_evidence_id)`；`excluded` 必须填写原因。证据可关联多个案卷，但每次适用性判断独立保留。

### 3.6 `customs_compliance.external_observation`

```text
external_observation_id uuid PK
tenant_id uuid not null
customs_case_id uuid null FK customs_case
provider varchar(64) not null
interface_code varchar(100) not null
provider_event_code varchar(100) null
provider_subject varchar(64) null
provider_reference varchar(200) null
observed_at timestamptz null
received_at timestamptz not null
payload_object_key varchar(500) not null
payload_sha256 char(64) not null
mapping_version varchar(64) not null
mapping_result varchar(24) not null    -- mapped | unmapped | ambiguous | invalid
qualifiers jsonb not null default '{}'
created_at timestamptz not null
```

Observation 完全不可变，未知值不得静默映射。唯一 `(tenant_id,provider,interface_code,payload_sha256)`；索引 `(tenant_id,provider,provider_reference,received_at desc)`、`(tenant_id,mapping_result,received_at)`、`(tenant_id,customs_case_id,observed_at)`。`qualifiers` 必须为 JSON object，并由入口 schema 限制键集合。

### 3.7 `customs_compliance.client_operation`

```text
client_operation_id uuid PK
tenant_id uuid not null
customs_case_id uuid not null FK customs_case
operation_type varchar(64) not null
state varchar(24) not null
sync_state varchar(16) not null
provider varchar(64) not null
external_operation_reference varchar(200) null
request_object_key varchar(500) not null
request_sha256 char(64) not null
requested_at / submitted_at / completed_at timestamptz null
failure_code varchar(100) null
version bigint not null default 0
created_at / updated_at timestamptz not null
```

`state` 取 `CustomsOperationState`，`sync_state` 取 `SyncState`，两者不得互相推导。时间列必须与操作状态演进相容；失败态必须有 `failure_code`。外部引用存在时唯一 `(tenant_id,provider,external_operation_reference)`；索引 `(tenant_id,customs_case_id,created_at desc)`、`(tenant_id,state,updated_at)`、`(tenant_id,sync_state,updated_at)`。

### 3.8 `customs_compliance.customs_receipt`

```text
customs_receipt_id uuid PK
tenant_id uuid not null
client_operation_id uuid not null FK client_operation
external_observation_id uuid null FK external_observation
provider varchar(64) not null
external_operation_reference varchar(200) not null
stage varchar(32) not null
provider_receipt_reference varchar(200) null
result_code varchar(100) null
received_at timestamptz not null
payload_object_key varchar(500) not null
payload_sha256 char(64) not null
response_summary jsonb not null default '{}'
created_at timestamptz not null
```

`stage` 取 `CustomsReceiptStage`。唯一 `(tenant_id,provider,external_operation_reference,stage,payload_sha256)`，允许同阶段收到内容不同的更正回执，但不得覆盖历史。索引 `(tenant_id,client_operation_id,received_at)`、`(tenant_id,provider,provider_receipt_reference)`。

### 3.9 `customs_compliance.customs_fact`

```text
customs_fact_id uuid PK
tenant_id uuid not null
customs_case_id uuid not null FK customs_case
business_fact_key varchar(200) not null
fact_type varchar(64) not null
canonical_event_type varchar(100) not null
capture_source varchar(24) not null     -- external_evidence | manual_backfill
business_occurred_at timestamptz not null
recorded_at timestamptz not null
source_system varchar(64) not null
source_reference varchar(200) null
mapping_version varchar(64) null
actor_id uuid null
reason varchar(500) null
supersedes_fact_id uuid null FK customs_fact
status varchar(16) not null default 'active' -- active | superseded | revoked
fact_payload_hash char(64) not null
version bigint not null default 0
created_at / updated_at timestamptz not null
```

`business_fact_key` 由规范事实类型、案卷适用范围、业务发生时间和权威业务引用按公共契约规则生成，不包含采集来源。唯一 `(tenant_id,business_fact_key)`，确保外部证据和人工后补录同一事实只形成一个业务结果。相同键且哈希相同返回既有事实；相同键但哈希不同返回 `CUSTOMS_IDEMPOTENCY_CONFLICT`，不得覆盖。`manual_backfill` 必须有 `actor_id/reason`；`external_evidence` 必须至少关联一条当前为 verified 的证据。索引 `(tenant_id,customs_case_id,business_occurred_at desc)`、`(tenant_id,canonical_event_type,recorded_at)`。

### 3.10 `customs_compliance.customs_fact_evidence`

```text
customs_fact_evidence_id uuid PK
tenant_id uuid not null
customs_fact_id uuid not null FK customs_fact
customs_evidence_id uuid not null FK customs_evidence
evidence_role varchar(16) not null      -- primary | supporting
linked_at timestamptz not null
```

唯一 `(tenant_id,customs_fact_id,customs_evidence_id)`；每个 `external_evidence` 事实至少一条 `primary` 证据。该跨行规则由同一事务内的延迟约束触发器或受测 Application 不变量实现，迁移实施时必须二选一并记录。

## 4. 作业执行表

### 4.1 `work_execution.node_task`

```text
node_task_id uuid PK
tenant_id uuid not null
container_id uuid not null             -- shipment-registry 逻辑引用
flow_instance_id uuid not null         -- lifecycle-control 逻辑引用
node_code varchar(64) not null
state varchar(24) not null
started_at / completed_at timestamptz null
version bigint not null default 0
created_at / updated_at timestamptz not null
```

`state` 取 `NodeTaskState`。唯一 `(tenant_id,flow_instance_id,node_code)`；索引 `(tenant_id,container_id,updated_at desc)`、`(tenant_id,state,updated_at)`。

### 4.2 `work_execution.work_order`

```text
work_order_id uuid PK
tenant_id uuid not null
node_task_id uuid not null FK node_task
work_order_type varchar(64) not null
state varchar(24) not null
business_date timestamptz null
blocked_reason_code varchar(64) null
version bigint not null default 0
created_at / updated_at timestamptz not null
```

`state` 取 `WorkOrderState`。`blocked` 必须有原因，其他状态不得遗留阻断原因；`completed` 必须有 `business_date`。唯一 `(tenant_id,node_task_id,work_order_type)`；索引 `(tenant_id,node_task_id,state)`、`(tenant_id,state,updated_at)`。

### 4.3 `work_execution.work_order_evidence_ref`

```text
work_order_evidence_ref_id uuid PK
tenant_id uuid not null
work_order_id uuid not null FK work_order
external_evidence_id uuid not null      -- customs-compliance 逻辑引用
evidence_role varchar(16) not null
linked_at timestamptz not null
```

唯一 `(tenant_id,work_order_id,external_evidence_id)`。逻辑引用失效由定期对账发现，不允许通过跨 schema FK 耦合所有权。

### 4.4 `work_execution.work_order_fact_application`

```text
work_order_fact_application_id uuid PK
tenant_id uuid not null
work_order_id uuid not null FK work_order
external_fact_id uuid not null          -- customs-compliance 逻辑引用
business_fact_key varchar(200) not null
capture_source varchar(24) not null
previous_state varchar(24) not null
resulting_state varchar(24) not null
business_occurred_at timestamptz not null
application_result varchar(24) not null -- applied | rejected
request_hash char(64) not null
reason_code varchar(64) null
actor_id uuid null
applied_at timestamptz not null
created_at timestamptz not null
```

唯一 `(tenant_id,work_order_id,business_fact_key)`。首次合法应用记录 `applied` 并由工单状态机更新工单；同一事实再次到达直接返回既有应用记录，语义为幂等 no-op，不能插入第二行或再次推进状态。相同键但 `request_hash` 不同为幂等冲突。`rejected` 必须有原因且不得改变工单。该表不替代状态机，也不直接修改 `NodeTask` 或 `FlowInstance`。

## 5. 幂等、Inbox 与 Outbox

以下三类表分别存在于 `customs_compliance` 和 `work_execution` schema，结构相同但所有权、事务和消费者独立。

### 5.1 `<module>.idempotency_record`

```text
idempotency_record_id uuid PK
tenant_id uuid not null
scope varchar(100) not null
idempotency_key varchar(200) not null
request_hash char(64) not null
state varchar(16) not null              -- processing | completed | failed
resource_type varchar(64) null
resource_id uuid null
response_code integer null
response_object_key varchar(500) null
error_code varchar(100) null
locked_until timestamptz null
expires_at timestamptz not null
created_at / updated_at timestamptz not null
```

唯一 `(tenant_id,scope,idempotency_key)`。同键同哈希：`completed` 返回原结果，`processing` 返回可重试冲突，过期锁可被原子接管；同键异哈希永久返回 `CUSTOMS_IDEMPOTENCY_CONFLICT`。失败是否可复用由稳定错误分类决定，不能通过删除记录重试。索引 `(tenant_id,state,locked_until)`、`(expires_at)`；清理只能在业务保留期与审计策略允许后执行。

### 5.2 `<module>.outbox_message`

```text
outbox_message_id uuid PK             -- 等于公共事件 eventId
tenant_id uuid not null
aggregate_type varchar(64) not null
aggregate_id uuid not null
aggregate_version bigint not null
event_type varchar(100) not null
event_version integer not null
occurred_at timestamptz not null
correlation_id uuid not null
causation_id uuid null
idempotency_key varchar(200) not null
payload_object_key varchar(500) not null
payload_sha256 char(64) not null
status varchar(16) not null             -- pending | publishing | published | failed | dead_letter
attempt_count integer not null default 0
next_attempt_at timestamptz null
locked_at timestamptz null
locked_by varchar(100) null
published_at timestamptz null
last_error_code varchar(100) null
created_at timestamptz not null
```

唯一 `(tenant_id,event_type,idempotency_key)` 与 `(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type)`。`attempt_count >= 0`；`published` 必须有 `published_at`；`dead_letter` 必须有错误码。轮询索引 `(status,next_attempt_at,created_at)` where status in pending/failed，领取使用 `FOR UPDATE SKIP LOCKED`。

### 5.3 `<module>.inbox_message`

```text
inbox_message_id uuid PK
tenant_id uuid not null
consumer_name varchar(100) not null
source_event_id uuid not null
source_event_type varchar(100) not null
payload_sha256 char(64) not null
status varchar(16) not null             -- processing | processed | failed | dead_letter
attempt_count integer not null default 0
next_attempt_at timestamptz null
locked_at timestamptz null
locked_by varchar(100) null
processed_at timestamptz null
last_error_code varchar(100) null
created_at / updated_at timestamptz not null
```

唯一 `(tenant_id,consumer_name,source_event_id)`。相同事件 ID 但哈希不同必须告警并进入 dead letter；`processed` 必须有 `processed_at`。轮询索引与 Outbox 同类，消费者业务写入和 `processed` 更新必须在一个本地事务中。

## 6. 审计表

### 6.1 `audit.audit_inbox`

字段与模块 Inbox 一致，`consumer_name` 固定为审计投影版本，例如 `audit_projection_v1`。审计模块通过 Outbox 事件消费，不允许业务模块跨 schema 同步写审计表。

### 6.2 `audit.audit_entry`

```text
audit_entry_id uuid PK
tenant_id uuid not null
source_event_id uuid not null
source_module varchar(64) not null
event_type varchar(100) not null
event_version integer not null
aggregate_type varchar(64) not null
aggregate_id uuid not null
operation varchar(64) not null
actor_type varchar(16) not null         -- system | user | integration
actor_id uuid null
occurred_at timestamptz not null
recorded_at timestamptz not null
correlation_id uuid not null
causation_id uuid null
reason_code varchar(64) null
before_summary jsonb null
after_summary jsonb null
payload_sha256 char(64) not null
```

唯一 `(tenant_id,source_event_id)`；索引 `(tenant_id,aggregate_type,aggregate_id,occurred_at desc)`、`(tenant_id,actor_id,occurred_at desc)`、`(tenant_id,correlation_id)`。审计记录 append-only；数据库角色撤销业务账号的 UPDATE/DELETE 权限。摘要必须字段白名单化和脱敏，不能存 Token、Cookie、凭据、完整外部载荷或不必要个人数据。

## 7. 事务与并发边界

1. 接收外部数据：写 Observation、受控载荷引用、映射结果和海关 Outbox 属于一个事务；无法映射时保存 Observation 并发出待复核事件，不创建规范事实。
2. 形成规范事实：锁定案卷版本，验证证据适用性，插入 `customs_fact` 与关联证据，更新案卷/Hold，并写 Outbox，全部原子提交。
3. 人工后补录：执行相同的事实键生成、证据/权限校验和事实应用路径，只额外要求操作者与原因；不得直接 UPDATE 工单终态。
4. 应用工单事实：Inbox 去重、锁定工单版本、写 `work_order_fact_application`、状态机更新 WorkOrder、聚合 NodeTask、写 Outbox，并将 Inbox 标为 processed，全部在 `work_execution` 本地事务中。
5. 流程推进：`lifecycle-control` 消费规范结果事件并执行自己的转移守卫；本设计不允许 `work_execution` 或 `customs_compliance` 直接写 FlowInstance。
6. 乐观并发使用 `version`：更新条件必须包含旧版本并原子 `version=version+1`；影响行数为零返回稳定版本冲突错误。

数据库隔离级别默认 `READ COMMITTED`，依靠唯一约束、行锁和乐观版本阻止重复推进；涉及同案卷多票聚合时，在固定锁顺序下锁定案卷及适用事实。不得用提高全局隔离级别掩盖缺失约束。

## 8. 索引与约束实施规则

- 所有外键列建立以 `tenant_id` 开头的索引；模块内父子关系优先使用复合外键 `(tenant_id,parent_id)`，同时要求父表唯一 `(tenant_id,id)`，从数据库层阻止跨租户关联。
- 所有哈希使用小写 64 位十六进制并加 CHECK；所有 JSONB 加 `jsonb_typeof(...)='object'` CHECK。
- 字符串长度、状态值、非负重试次数、时间先后关系和条件必填均进入 CHECK，不只依赖 Prisma。
- 外部可空引用的唯一性使用 partial unique index `where ... is not null`。
- 热路径索引不得无条件包含大 JSONB、对象键或错误文本；上线前用真实查询计划确认复合索引列序。
- Outbox/Inbox 的失败与死信索引服务运维队列；另建 `(tenant_id,created_at)` 支持保留期清理和分区评估。

### 8.1 保留、归档与敏感数据

- 具体保留年限由批准的数据分类和司法辖区策略配置，本设计不硬编码候选期限。
- 案卷关闭不删除 Observation、Evidence、Receipt、Fact、Fact Application 或 Audit；超过在线保留期后只能迁移到受控归档，并保留 ID、哈希、来源、时间和审计链。
- 法务保留中的记录禁止清理；清理任务必须按租户、数据类别和截止时间执行，记录批次 ID、影响行数及失败清单。
- 对象存储生命周期不得早于数据库引用保留期。删除对象前必须证明无活动引用并保存销毁证明；数据库不得遗留指向已删除对象的有效引用。
- 个人数据采用最小化、字段级脱敏或加密；搜索索引、JSONB 摘要、日志和错误文本不得形成未受控副本。

## 9. 迁移顺序

所有脚本进入 `database/migrations/`，采用时间戳或连续编号目录且一经共享不得修改：

```text
001_create_module_schemas
002_create_customs_case_and_hold
003_create_customs_evidence_verification_and_links
004_create_external_observation_operation_and_receipt
005_create_canonical_fact_and_fact_evidence
006_create_work_execution_base_and_fact_application
007_create_module_idempotency_inbox_and_outbox
008_create_audit_inbox_and_entry
009_add_secondary_indexes_permissions_and_immutable_guards
010_add_contract_fixtures_and_verification_queries
```

迁移 `001` 同时建立每个 schema 的 owner/runtime/migrator 权限模型；`009` 撤销跨模块写权限和不可变表的 UPDATE/DELETE 权限。`010` 只包含可重复的基准字典/契约 fixture 与只读验证，不写生产业务数据。

当前仓库尚无 `database/migrations/`，以上是实施顺序，不代表迁移已创建或执行。

## 10. 演进、验证与恢复

破坏性结构调整必须分三阶段：

```text
expand:   新增可空列/新表/双读能力，不改变旧消费者
migrate:  分批回填，保存批次、水位、行数、错误和校验摘要
contract: 消费者切换且对账通过后，另一次迁移收紧约束或移除旧结构
```

每个迁移实现必须提供：

- 空库升级和上一发布版本升级测试；
- 非法状态、跨租户外键、重复事实、重复回执和幂等冲突约束测试；
- 事实、状态更新与 Outbox 原子提交/回滚测试；
- Inbox 重放、乱序、锁超时接管、重试耗尽和 dead letter 重放测试；
- 外部自动回填与人工后补录同一事实的对拍测试；
- 审计不可修改、字段脱敏及数据库角色权限测试；
- 迁移后行数、孤儿逻辑引用、哈希格式、状态分布和 Outbox 积压验证查询。

恢复优先前滚：失败迁移停止发布，以新迁移撤销约束或恢复兼容列。任何数据回填必须保留受审计脚本、批次 ID、反向映射和执行前后校验摘要；不可逆删除只允许在备份恢复演练和保留期批准后执行。

## 11. 实施准入

进入实际迁移前必须完成：

1. 负责人确认本设计与公共契约 V1 的升格范围；
2. 为状态 CHECK、事实键算法、事件类型和错误码建立单一生成来源，禁止从本文复制成第二份权威枚举；
3. 确认对象存储键、加密、病毒扫描、访问授权和保留策略；
4. 明确 Outbox 发布器、重试退避、最大次数、dead letter 告警和人工重放权限；
5. 建立跨模块逻辑引用对账作业及告警阈值；
6. 释放唯一活动任务槽位并派生海关纵向切片实施 brief。

本文是物理持久化设计权威，公共线值与业务含义仍以[公共契约 V1](./CUSTOMS_PUBLIC_CONTRACT_DESIGN_V1.md)和[海关业务契约 V1](./CUSTOMS_BUSINESS_CONTRACT_V1.md)为唯一来源。数据库迁移、Prisma 模型、API DTO 与事件载荷必须由这些权威定义显式映射，不能把数据库实体直接暴露为公共契约。
