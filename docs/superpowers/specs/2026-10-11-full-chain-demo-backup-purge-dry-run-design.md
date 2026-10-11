# 全链路样本 Brief 2：备份、归属清单与清理 Dry-Run 设计

> 状态：负责人已批准设计方向 · 2026-10-11
>
> 父设计：[`2026-10-06-full-chain-sample-rebuild-design.md`](./2026-10-06-full-chain-sample-rebuild-design.md)
>
> 本设计只承接父设计 Brief 2。它不授权真实备份、Temporal 暂停、MinIO 复制、数据库恢复、demo 数据删除、样本包写库或页面切换。

## 1. 目的

Brief 1 已把受控 v0.5 工作簿稳定编译为可审计诊断包，并准确保留真实 HBL 范围冲突与重复装载业务键。Brief 2 的目标是在不删除、不写入演示业务数据的前提下，建立后续重建所需的安全准备能力：

1. 将参考数据 Seed 与旧 demo Seed 分离；
2. 为全部 Prisma model 建立唯一、可机检的归属规则；
3. 只读生成 PostgreSQL、MinIO、Temporal 三域精确 manifest；
4. 生成可验证备份制品的工具，但只在隔离目标演练恢复；
5. 提供默认零删除 purge dry-run；
6. 明确未来真实执行必须携带精确 manifest hash，并取得当次负责人授权。

Brief 2 完成只证明“能够准确说明哪些数据属于 demo、哪些必须保留、如何备份和恢复、为什么当前不能删除”。它不证明 demo 已重建，也不允许进入父设计第 2～5 步的真实变更。

## 2. 已批准边界

### 2.1 固定顺序

负责人确认总顺序为：

```text
只读编译 package
→ 写入/清理前备份
→ 仅清 demo 租户旧业务数据
→ 领域 adapter 写入演示库
→ 页面核对新单据并确认旧演示单消失
```

Brief 2 只建设“备份准备 + 精确清单 + 零删除 dry-run”。真实备份执行、清理和写入仍须后续 brief 与当次授权。

### 2.2 必须完整保留

以下对象不得进入 purge candidate：

- `reference_data_release`；
- `currency_code_reference`；
- `country_code_reference`；
- `cargo_owner_reference`；
- `unlocode_area_reference`；
- `port_code_reference`；
- `port_code_entry`；
- `port_name_alias`；
- `source_authority_policy`；
- `_prisma_migrations`；
- Schema、迁移历史、数据库对象与约束；
- 非目标租户的任何记录；
- Temporal 自身数据库；
- 无法唯一证明归属于目标 demo 租户的对象、工作流或逻辑引用。

### 2.3 当前目标

- 目标租户稳定值：`demo-real-sample-20260921`；
- 该值只能作为显式 CLI 参数或受控 manifest 内容，不得成为“删除所有 demo-like 租户”的模式；
- 输入若不是这个精确值，Brief 2 CLI 必须拒绝；
- 日志只输出计数、稳定结果码、trace ID 和 manifest hash，不输出行 ID、对象 key、workflow input、业务值或文件路径。

## 3. 架构选择

### 3.1 采用：仓库根运维脚本

Brief 2 使用仓库根脚本和 script-local contracts，不新增生产 Controller、API route、Vue 页面或运行时 capability。理由：

- 当前操作只服务受控本地 demo 重建，不是普通岗位动作；
- 生产入口会扩大攻击面并制造尚无消费者的权限平台；
- 运维脚本可在默认拒绝、显式参数、隔离目标和外部制品目录下运行；
- 未来若形成真实运行时消费者，再单独评审是否需要 API。

### 3.2 禁止：万能清库器

不建立按表名通配、按租户字符串猜测或“数据库全表遍历后 delete”的通用工具。每个 Prisma model 必须在静态 ownership catalog 中恰好出现一次：

```text
preserve_global
| direct_tenant
| via_parent
| via_logical_ref
```

新增模型未分类、重复分类、间接规则断链或逻辑引用无法解析时，manifest 生成失败关闭。

## 4. Seed 分轨

### 4.1 标准 Seed

`pnpm db:seed` 只执行：

- 权威国家/港口/UNLOCODE 参考数据；
- 货主参考映射；
- 已批准的参考数据候选别名子步骤。

它不得创建 demo 租户业务记录。

### 4.2 旧 Demo Seed

新增 `pnpm db:seed:legacy-demo`，只调用现有 `seedRealReplenishmentSample()`。它用于开发环境兼容和重建前对照，不是父设计 v0.5 adapter。

### 4.3 验收

- 标准 Seed 重放后参考表 hash/count 不变，所有 tenant-owned 表不变；
- legacy demo Seed 重放幂等，只改变精确目标租户；
- `pnpm db:setup` 继续调用标准 Seed，因此新建数据库默认不再自动灌旧 demo；
- 依赖旧 demo 的开发者必须显式运行 `pnpm db:seed:legacy-demo`。

## 5. Ownership Catalog

### 5.1 Catalog 格式

仓库提交 `scripts/full-chain-demo/ownership-catalog.json`：

```json
{
  "catalogVersion": "full-chain-demo-ownership.v1",
  "targetTenant": "demo-real-sample-20260921",
  "models": {
    "Product": {
      "table": "product",
      "rule": "direct_tenant",
      "tenantField": "tenantId",
      "deleteRank": 500
    },
    "OceanRoutePlan": {
      "table": "ocean_route_plan",
      "rule": "via_parent",
      "parentModel": "ContainerRecord",
      "foreignKey": "containerId",
      "parentKey": "id",
      "deleteRank": 200
    },
    "ReferenceDataRelease": {
      "table": "reference_data_release",
      "rule": "preserve_global"
    }
  }
}
```

### 5.2 直接归属

所有带 `tenantId` 的 model 必须显式列为 `direct_tenant`。`CanonicalEvent.tenantId` 可空：空值不得归入目标租户，非空精确相等时才进入 candidate。

### 5.3 间接归属

以下 model 必须经父链或逻辑 resolver 证明：

| Model                          | 归属链                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `OceanRoutePlan`               | `containerId → ContainerRecord.id → tenantId`                                              |
| `OceanRouteSegment`            | `routePlanId → OceanRoutePlan.id → ContainerRecord.tenantId`                               |
| `EvidenceVerificationDecision` | `evidenceId → EvidenceRecord.id → tenantId`                                                |
| `ImportRow`                    | `batchId → ImportBatch.id → tenantId`                                                      |
| `ImportReview`                 | `batchId → ImportBatch.id → tenantId`                                                      |
| `ImportRowResult`              | `batchId → ImportBatch.id → tenantId`                                                      |
| `FlowInstance`                 | `shipmentId → Shipment.id → tenantId`                                                      |
| `NodeInstance`                 | `flowInstanceId → FlowInstance.id → Shipment.tenantId`                                     |
| `NodeApplicabilityDecision`    | `flowInstanceId → FlowInstance.id → Shipment.tenantId`，无 FK 仍须验证                     |
| `NodeEventApplication`         | `targetNodeInstanceId → NodeInstance → FlowInstance → Shipment.tenantId`；event 侧也须一致 |
| `WorkOrder`                    | `nodeTaskId → NodeTask.id → tenantId`                                                      |
| `NodeTaskOutcome`              | `nodeTaskId → NodeTask.id → tenantId`                                                      |
| `OpsAssistantMessage`          | `sessionId → OpsAssistantSession.id → tenantId`                                            |

未出现在 catalog 或解析出 0/多归属的行进入 blocker，不能进入 candidate。

### 5.4 Catalog 漂移门禁

测试读取 `Prisma.dmmf.datamodel.models`，验证：

- 每个 model 恰好一个规则；
- catalog table 与 `model.dbName` 一致；
- `direct_tenant` model 确有 `tenantId`；
- `preserve_global` 只包含批准表；
- `via_parent` 的字段、父 model 和 parent key 存在；
- 任何 catalog 外 model 使测试失败。

## 6. 三域 Manifest

### 6.1 Manifest 总体

输出位于仓外受控目录，不提交 Git：

```text
full-chain-demo-manifest/
├─ manifest.json
├─ postgres.json
├─ minio.json
├─ temporal.json
├─ blockers.json
└─ receipt.json
```

`manifest.json` 包含：

- `manifestVersion`；
- 精确 target tenant；
- catalog version/hash；
- Schema、最新 migration 与 ownership fingerprint；
- 三域 count/hash；
- blocker count/hash；
- `deletable=false`；
- `manifestHash`；
- 明确允许证明与禁止证明。

时间、操作人、输出路径和 receipt 不进入 hash projection。

### 6.2 PostgreSQL

每个 catalog model 生成一个 entry：

- model/table；
- ownership rule code；
- delete rank；
- candidate row count；
- sorted primary-key projection hash；
- unresolved count；
- blocker code；
- reference preservation状态。

外部 manifest 可以保存受控 primary-key 清单；普通 stdout、Git fixture 和测试快照只保存虚构 ID 或计数/hash。

### 6.3 MinIO

唯一可直接证明的对象归属路径是：

```text
ImportBatch.sourceObjectKey
→ ImportBatch.tenantId
```

manifest 对每个目标租户 batch 的非空 key 执行 `HeadObject`，记录仓外 key、size、checksum metadata 和归属证明。以下情况阻断：

- DB 有 key，MinIO 对象不存在；
- 同 key 被多个 batch 或租户引用；
- checksum metadata 与 DB file hash 不一致；
- bucket 中无法归属的对象不能自动成为 demo candidate；
- `EvidenceRecord.contentRef` 不能因为像对象 key 就猜测归属。

Brief 2 不删除对象，也不扫描后把 orphan 自动归到 demo。

### 6.4 Temporal

记录：

- namespace；
- schedule ID、workflow ID/run ID、type、status、paused state；
- redacted input fingerprint；
- tenant attribution：`target`、`other`、`global`、`ambiguous`；
- freeze requirement 与 blocker。

当前 `outbox-publish-due-system` 是全局 schedule，运行时从 Outbox 发现多个租户。它必须标为 `global` blocker，并要求后续 maintenance/freeze 策略；不得标成 demo-only，也不得在 Brief 2 暂停。

## 7. Purge Dry-Run

CLI：

```text
pnpm demo:purge:dry-run -- \
  --tenant demo-real-sample-20260921 \
  --manifest <external manifest path> \
  --expected-manifest-hash <hash>
```

行为：

1. 验证 target tenant、manifest schema、hash 和 catalog version；
2. 重新采集三域 fingerprint；
3. 任一 count/hash/state 漂移则 `MANIFEST_STALE`；
4. 在 PostgreSQL rollback-only transaction 中按 child-first 顺序执行 count-only delete plan，比较 planned/actual count 后回滚；
5. MinIO 与 Temporal 只验证 inventory，不修改；
6. 输出脱敏 receipt；
7. 返回 0 表示 dry-run 完成，不表示允许删除。

任何 `--execute` 参数都返回：

```text
DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2
```

仓库中不出现真实 execute route、函数或删除命令。

## 8. 备份与隔离恢复演练

### 8.1 备份制品

工具可以创建：

- PostgreSQL logical dump；
- manifest 所列 MinIO 对象的 checksum-verified copy；
- Temporal schedule/workflow inventory，而不是 Temporal DB dump；
- backup manifest 与 receipt。

真实 demo 备份只有在后续明确运行授权下执行。Brief 2 自动化测试使用临时数据库、隔离 bucket/prefix 和虚构 Temporal inventory。

### 8.2 隔离恢复

恢复目标必须同时满足：

- 新建数据库名符合 `logix_rehearsal_<pid>_<random>`；
- 不等于源数据库；
- 新 bucket 或明确 rehearsal prefix；
- 新 Temporal namespace 或离线 inventory 验证目标；
- 工具启动前证明目标为空且由本次运行创建。

恢复后验证：

- migration 状态；
- manifest row counts/hashes；
- 全局参考表 counts/hashes；
- 目标租户与其他租户隔离；
- MinIO bytes/checksums；
- Temporal inventory/freeze 假设；
- 源环境前后 count/hash 不变。

失败时只清理由本次 rehearsal 创建的目标，不触碰源环境。

## 9. Error Codes

稳定错误码：

```text
DEMO_MAINTENANCE_ARGUMENTS_INVALID
DEMO_MAINTENANCE_TENANT_DENIED
OWNERSHIP_CATALOG_INVALID
OWNERSHIP_CATALOG_DRIFT
OWNERSHIP_UNRESOLVED
OWNERSHIP_AMBIGUOUS
GLOBAL_REFERENCE_CANDIDATE_FORBIDDEN
MINIO_OBJECT_MISSING
MINIO_OWNERSHIP_AMBIGUOUS
MINIO_CHECKSUM_MISMATCH
TEMPORAL_GLOBAL_SCHEDULE_BLOCKER
TEMPORAL_OWNERSHIP_AMBIGUOUS
MANIFEST_INVALID
MANIFEST_HASH_MISMATCH
MANIFEST_STALE
BACKUP_TARGET_NOT_ISOLATED
BACKUP_VERIFICATION_FAILED
RESTORE_TARGET_NOT_ISOLATED
RESTORE_VERIFICATION_FAILED
DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2
```

错误和 receipt 不泄露 ID、key、输入、业务值、凭据或路径。

## 10. 安全与完成定义

Brief 2 完成要求：

- Seed 已分轨且各自幂等；
- ownership catalog 覆盖当前全部 Prisma model；
- PostgreSQL/MinIO/Temporal manifest 可重复生成；
- 同一状态 manifest hash 一致；
- global references 与其他租户不进入 candidate；
- 无法归属对象和全局 schedule 形成 blocker；
- dry-run 无任何持久变化；
- `--execute` 稳定拒绝；
- 备份工具和隔离恢复演练通过合成/临时环境测试；
- 真实 demo 备份、删除、写库和 UI 切换仍为未运行；
- fresh Codex 安全与数据完整性复审通过。

Brief 2 `done` 不授权 Brief 3/4 自动执行。真实删除仍须精确 manifest、已验证真实备份和恢复点、维护冻结证据，以及负责人当次明确授权。
