# 全链样本隔离租户领域 Adapter 设计

> 状态：对话设计已批准，待书面规格审核 · 2026-10-13
>
> 父设计：[`2026-10-06-full-chain-sample-rebuild-design.md`](./2026-10-06-full-chain-sample-rebuild-design.md)
>
> 直接消费者：Brief 3 实施计划、隔离 rehearsal 执行、Brief 4 demo 切换前置验收。
>
> 不构成：业务数据真实性再认证、生产写入授权、旧 demo 删除授权、Brief 4 启动、工作台闭环或生命周期完成结论。

## 1. 目的与路线图位置

路线图位置固定为：

```text
全链样本重建
→ Brief 1 canonical package 编译门禁（done）
→ Brief 2 备份 / 恢复 / purge dry-run 准备（done）
→ Brief 3 隔离租户领域 Adapter（本设计）
→ Brief 4 demo 切换（不在本设计）
```

Brief 3 要把负责人已确认、关系已纠正且 `publishable=true` 的六类 canonical records，在独立 rehearsal tenant 和独立 MinIO prefix 中落成一条可查询、可重放、可对账且不制造生命周期结论的全链事实。

本片只证明 adapter 行为安全、关系完整和落账可重复。它不重新证明 workbook 是否真实，不删除旧 demo，不切换生产页面，也不宣称任一工作台完成业务闭环。

## 2. 已定边界与事实

### 2.1 真实性与运行完整性分轨

负责人已经确认 workbook 及其关系是项目真实业务数据。该结论按 [`AGENTS.md`](../../../AGENTS.md) §1 第 12 条执行，不再要求外部来源、第三方材料、重复编译、仓外路径可读或三域零变化重新证明真实性。

实际 adapter 执行仍必须验证：

- package 格式、版本兼容矩阵和 `publishable=true`；
- component hash 与 package hash；
- 六类业务主键、typed reference、外键和 orphan；
- FC-D07 聚合身份与 package 提供的 lineage；
- rehearsal tenant/prefix 隔离；
- PostgreSQL、MinIO、Outbox 前后对账；
- 其他租户、旧 demo 和全局参考数据零变化。

这些运行证据只证明本次 adapter 行为和版本绑定，不反向重审业务真实性。

### 2.2 六类业务身份

| Record type              | 业务主键                       | Adapter 后业务身份                         |
| ------------------------ | ------------------------------ | ------------------------------------------ |
| `shipment_plan`          | 出运计划编号                   | tenant + plan number                       |
| `booking_commitment`     | 订舱编号                       | tenant + booking number                    |
| `cargo_ready_release`    | 备货单号                       | tenant + cargo-ready number                |
| `stuffing_snapshot_line` | 柜号 + 备货单号 + SKU + 分提单 | tenant + 四段精确键                        |
| `export_customs_case`    | 报关发票号                     | tenant + export invoice number             |
| `dispatch_fact`          | 柜号                           | tenant + container number（当前 contract） |

数据库 UUID 只作内部引用，不替代上述业务身份。没有已定版本/更正语义时，同租户同业务键不同 payload 必须冲突，不能静默覆盖。

### 2.3 精确关系

- booking、stuffing、customs 使用同一个精确 typed HBL；禁止包含、后缀字母、相似字符串或 Excel 行号匹配。
- dispatch 的 MBL 必须精确指向 booking 的 typed MBL。
- dispatch 的每个 HBL 必须精确指向 booking 的 typed HBL。
- stuffing 必须精确指向 cargo-ready 和 typed HBL。
- shipment plan 中由“合并备货单”编译出的引用解析为 cargo-ready 关系。
- booking / cargo-ready payload 中由“主备货单号”产生的值只保存为展示分组，不建立 FK。
- 合同号、合同行号、序号、source row 只属于 lineage，不进入 stuffing identity。
- FC-D07 已在 package producer 侧按 stuffing 业务键聚合数量、箱数、毛重和体积；adapter 不拆回来源行，也不扩张业务键。

### 2.4 不得推断的状态

canonical records 是来源事实，不自动等于：

- 备货已由内部岗位采信或整单最终确认；
- 装箱现场流程完成、VGM 已接受或下游已接收；
- 出口海关已放行；
- `loaded`、实际离港或海运运营已开始；
- 任何岗位任务、责任交接或工作台闭环完成。

Brief 3 的 Outbox 只表达 canonical business fact 已可靠落账，不发布上述生命周期事件，也不创建业务任务。

## 3. 当前物理承载与缺口

| 类型                | 当前物理承载                                                          | 结论                                              |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| shipment plan       | 无 runtime aggregate；现有 `Shipment` 明确表示已实际出运              | 需要新增 typed fact，不能冒充 Shipment            |
| booking commitment  | `booking-origin` 为空模块                                             | 需要新增 typed fact 与 transport-document 关系    |
| cargo-ready release | `ReplenishmentOrder` 只部分相似；既有导入要求 SKU/unit/container      | package 不足以调用既有导入；需要独立 release fact |
| stuffing line       | 现有 stuffing 是柜级快照；allocation uniqueness 不含 HBL              | 需要保留四段业务身份的 line fact                  |
| export customs case | 现有 customs 是目的国/进口清关                                        | 需要出口专属 fact，禁止复用进口清关案件           |
| dispatch fact       | 现有 dispatch snapshot 要求 stuffing/VGM/evidence，且只有单一文本 HBL | 只复用校验/幂等模式，不强塞现有 snapshot          |

因此本任务是新的 Application 级 package landing 子系统，而不是 DTO 到既有表的机械映射。

## 4. 方案选择

### 4.1 采用：领域原生 typed facts + 集中 Application 编排

为六类事实建立明确命名、非通用 JSON ledger 的领域承载；由一个 Application orchestrator 完成 package 校验、依赖排序、事务、幂等、对象回执、发布和对账。每类 adapter 只解释一种 record，跨类型关系由 orchestrator 在写入前构图验证。

采用理由：

- 业务身份和 typed reference 可以由 Domain 校验与数据库约束共同证明；
- 不需要伪造现有状态机要求的 VGM、证据 UUID、carrier、broker 或放行状态；
- 不会把出口报关写入进口清关；
- 后续 Brief 4 有明确的 read API、run receipt 和可复用 landing 边界；
- 所有新增表都有当前消费者，不是临时表或万能导入平台。

### 4.2 拒绝：强行映射现有 aggregate

拒绝把六类 records 强塞进现有 Replenishment / Stuffing / Customs / Dispatch：

- 会把出口报关与进口清关混为一谈；
- 会把 stuffing line 压成柜级快照；
- 会丢失多 HBL；
- 会要求虚构 VGM、seal、carrier、broker、evidence 或 lifecycle state；
- 会把 source label 晋升为状态机结论。

### 4.3 拒绝：通用 canonical JSON ledger

拒绝只保存 `recordType + businessKey + payloadJson` 的万能表。该方案无法用 typed FK 证明跨记录关系，也会形成无消费者的通用 adapter 平台。JSON 只允许用于受控审计摘要、gap details 或 canonical payload hash，不作为业务事实唯一承载。

## 5. 模块与依赖方向

```text
CLI / HTTP Transport
        ↓
FullChainSampleLanding Application
        ↓
PackageContract + GraphPreflight + 6 typed adapters
        ↓
Domain fact repositories / Receipt object port / Reconciliation ports
        ↓
PostgreSQL + MinIO + Outbox infrastructure
```

依赖方向保持：

```text
Transport → Application → Domain ← Infrastructure
```

建议模块：

- `packages/full-chain-sample-contracts/`：canonical package 的正式公共读取、严格校验、规范 JSON/hash 和兼容矩阵；提供 ESM/CJS 双入口供 Node compiler 与 CommonJS API 共用。
- `apps/api/src/modules/full-chain-sample-landing/`：Brief 3 Application、六类 typed adapters、Domain contracts、repository/object/inventory ports、HTTP transport 和 infrastructure adapters。
- `database/`：有当前消费者的 typed facts、landing run、lineage/gap 与 outbox；追加迁移和派生数据字典。

现有 `scripts/full-chain-sample/` 保留 producer/CLI 角色。其 `contracts.mjs` 与 `canonical-json.mjs` 收敛为公共 package 的兼容 facade，现有 compiler 行为和 package bytes/hash 必须由 golden/parity tests 证明不变。

Brief 2 的 `apps/api/src/tools/full-chain-demo/**` 仍是独立维护工具边界。Brief 3 不扩大其 Prisma/Temporal 架构例外。

## 6. 公共 package contract

### 6.1 兼容矩阵

Brief 3 首版只接受：

| 层               | 允许值                          |
| ---------------- | ------------------------------- |
| package manifest | `full-chain-package.v1`         |
| source manifest  | `full-chain-source-manifest.v1` |
| workbook version | `v0.5.1`                        |
| compiler         | `full-chain-compiler.v1`        |
| mapping          | `full-chain-mapping.v0.5`       |
| policy           | `full-chain-policy.v0.5`        |
| record version   | `v1`                            |

`gitCommit` 必须是格式合法、非空的 provenance，并进入 package hash 校验。首版不擅自硬编码单一允许 SHA；若未来要限制 producer build，必须通过版本化兼容政策单独评审。

### 6.2 文件边界

Reader 只接受父目录和 Brief 1 实现一致的文件集：

```text
manifest.json
records/shipment_plan.json
records/booking_commitment.json
records/cargo_ready_release.json
records/stuffing_snapshot_line.json
records/export_customs_case.json
records/dispatch_fact.json
lineage.jsonl
gaps.json
checks.json
report.html          # 不参与业务写入
receipt.json         # compile receipt，不参与业务写入
```

对于 landing input：

- 六类 record 文件必须恰好各一份；缺失、额外或重复 type 失败；
- 每个 record envelope 与 record-specific payload 都严格校验；
- 完整重建 counts/component hashes/package hash；
- `publishable` 必须从 blocking gaps 和 failed checks 重算并等于 manifest；
- `publishable=false` 一律拒绝；
- 不读取 Excel，不调用 scanner/classification/compiler/correction writer；
- 不允许绝对路径、symlink/junction escape 或仓库内 artifact 路径。

### 6.3 Record-specific typed payload

公共 contract 将当前 JS allowlist 提升为六个严格 discriminated schemas/types。字段缺失时：

- 若该字段是业务身份或本次已定关系所必需，package 拒绝；
- 若字段不是当前 landing 所需且已作为 gap 显式存在，保留 gap；
- 禁止以空字符串、`0`、当前时间、默认币种、默认时区或生成 ID 补空。

裸字符串引用在 adapter preflight 中转换为 typed reference，例如：

```text
{ type: cargo_ready_release, number: ... }
{ type: booking_commitment, number: ... }
{ type: mbl, number: ... }
{ type: hbl, number: ... }
```

转换基于 record 字段语义和精确目标集合，不基于字符串猜测。

## 7. 数据模型

### 7.1 Landing run 与发布门

`FullChainLandingRun` 至少保存：

- tenant、package hash、版本元组、source alias/fingerprint 的脱敏绑定；
- status：`applying | staged | receipt_pending | reconciling | published | failed`；
- actor、trace、created/updated/published time；
- 六类 input/applied/replayed/failed counts；
- gap/check counts；
- receipt object key 的不可逆摘要与 digest；
- reconciliation summary；
- payload hash 与 stable idempotency key。

约束：

- tenant + packageHash 唯一；
- tenant + idempotencyKey 唯一；
- `published` 前不进入 read model，也不发布 landing Outbox；
- 同 package replay 返回同一 run；同 key 不同 package payload 明确冲突。

### 7.2 六类 typed facts

新增明确模型：

1. `ShipmentPlan`
   - plan number；
   - package/source/lineage binding；
   - 关联 booking commitment；
   - 与 cargo-ready release 的显式 join。

2. `BookingCommitment`
   - booking number；
   - typed MBL/HBL documents；
   - HBL parent 精确指向本 booking 的 MBL；
   - “主备货单号”只保存为 display grouping，不建立 cargo-ready FK。

3. `CargoReadyRelease`
   - cargo-ready number；
   - package/source/lineage binding；
   - quantity 若存在则按定点字符串落账；
   - `planNo` 来源若实际为主备货单号，则命名为 display grouping，不关联 shipment plan；
   - 不生成“已采信/已完成”状态。

4. `StuffingSnapshotLine`
   - container number、cargo-ready FK、SKU、typed HBL FK；
   - quantity、package count、gross weight、volume 及明确单位；
   - 唯一键保持 `container + cargo-ready + SKU + HBL`；
   - 不新增 contract/source-row identity；
   - 不生成 container-level stuffing completion、seal 或 VGM。

5. `ExportCustomsCase`
   - export invoice number；
   - typed HBL FK；
   - declaration number、amount、currency；
   - 不复用目的国进口 `CustomsClearanceCase`；
   - 不生成“海关已放行”。

6. `DispatchFact`
   - container number；
   - typed MBL FK；
   - 与全部 typed HBL 的 join；
   - vessel/voyage 与 package 提供的日期/精度字段；
   - date-only 保留 precision，不虚构时间或 UTC offset；
   - 不生成 `loaded` / `departed` lifecycle event。

所有模型均：

- 带 `tenantId` 和 tenant-scoped composite FK；
- 保存 landing run / canonical record identity / payload hash；
- 只引用同 tenant、同 landing chain 的对象；
- 使用定点 decimal，不经过 JavaScript `Number`；
- 以 package source/lineage 为审计来源，不保存不必要的商业原值。

### 7.3 Lineage 与 visible gaps

`FullChainLandingRecordReceipt` 保存每条 canonical record 的：

- record type、business key 的不可逆摘要；
- canonical record hash；
- target typed fact ID；
- state：applied / replayed / rejected；
- stable issue codes；
- sourceRef 与 lineage references 的受控摘要。

`FullChainLandingGap` 保存 package 中的 unsupported/open/informational gap code、record reference 摘要和状态，不复制商业原文。

FC-D07 的多来源基础必须按 package 实际提供的 source/lineage 逐项校验。若 package 无法证明 brief 要求的全部 aggregate contributor，actual rehearsal run 失败关闭；adapter 不回读 Excel，也不自行制造 contributor。该运行门禁不阻塞代码设计、实现、评审或合并。

## 8. Application 编排与事务

### 8.1 Preflight：零写入

1. 读取并重建 package artifacts。
2. 严格验证 schema、兼容矩阵、hash 和 publishability。
3. 验证六类业务键非空且唯一。
4. 构建 typed graph，验证全部精确引用、无 orphan、无 ambiguous target。
5. 验证 display-only 字段没有进入 relation graph。
6. 验证 rehearsal tenant/prefix 与旧 demo/其他 tenant 不同。
7. 采集 target tenant、old demo、other tenant、global reference 的 before inventory。

任一步失败时零数据库/对象/outbox 写入。

### 8.2 Apply：单个 Serializable 事务

对 `tenantId + packageHash` 取得 advisory lock，在同一个真实 PostgreSQL `SERIALIZABLE` transaction 中：

1. 创建或读取 landing run；
2. 按依赖顺序调用六类 adapter：

```text
shipment plan
→ booking commitment + typed documents
→ cargo-ready release
→ stuffing snapshot lines
→ export customs cases
→ dispatch facts
```

3. 写 typed joins、record receipts、lineage bindings 和 visible gaps；
4. 对每条 record 使用由 `packageHash + recordType + businessKey` 派生的 stable idempotency key；
5. 运行 DB 内关系/count/hash 对账；
6. 将 run 置为 `staged`。

任何 record 或关系失败，整个事务回滚，不产生半成品。

### 8.3 Receipt object：事务外可恢复

数据库与对象存储不能共享事务。`staged` 后：

- 在 `rehearsal/<tenant>/<run>/receipt.json` 写唯一脱敏 receipt；
- prefix 必须由安全 builder 生成并在 Application policy 再校验；
- put-if-absent：同 key 同 digest 视为 replay，不同 digest 冲突；
- receipt 不包含业务原值、完整 hash、绝对路径、凭据、数据库 ID 或对象 key 清单；
- 写失败时 run 保持不可发布，可由同 package 重试；不发布 Outbox。

不提供 broad `deletePrefix`。清理只使用 run 记录的精确 key，并且只允许本 run 确认创建的对象。

### 8.4 Reconcile 与 publish

receipt 成功后重新对账：

- 六类记录与 typed joins count/hash；
- record receipts、lineage、visible gaps；
- receipt object digest；
- landing Outbox 数量；
- business task 数量必须为 0；
- old demo、other tenant、global reference before/after fingerprints 不变；
- MinIO 只有目标 prefix 的精确 receipt 变化；
- Temporal 保持只读 inventory，不 pause/reset/terminate。

全部成立后，在第二个短事务中：

- 插入一个 landing published Outbox event（tenant + run + event type + idempotency 唯一）；
- 将 run 标记为 `published`。

对外 read API 只读取 `published` run。由此保证 DB staged 但对象或对账失败时不会向消费者发布半成品。

## 9. 幂等、并发与恢复

- 同 package、同 tenant、同 idempotency key：返回原 run 与同一结果，不新增 fact、join、receipt、event、task 或 object。
- 同 package 并发：advisory lock + unique constraints 保证一个 apply，其他请求得到 replay。
- 同业务键、同 canonical payload：复用既有 fact，不新增 revision。
- 同业务键、不同 payload：在未定义正式更正/版本语义前返回稳定 conflict code。
- apply 中途失败：完整 transaction rollback。
- receipt/object 失败：保留 staged run，重放只补对象和 publish，不重复 DB facts。
- publish transaction 失败：重放重做 reconciliation 后幂等发布。
- cleanup：只在独立 rehearsal tenant/prefix、基于 run ownership 清单精确执行；旧 demo 不参与 Brief 3 cleanup。

## 10. 权限与隔离

### 10.1 当前动作能力

首版写入口复用现有 `import.execute` capability；这是受控 package import，不新增无消费者 capability。复用不等于只依赖 Controller guard，Application use case 必须接收 authenticated identity 并重新校验：

- identity tenant 等于明确配置的 rehearsal tenant；
- target tenant 不是 `demo-real-sample-20260921`；
- target tenant 不等于任一 other/control tenant；
- object prefix 属于本 tenant/run；
- 所有 lookup 和 FK 携带 tenant；
- 未知 capability、tenant 或 prefix 默认拒绝。

未来若 `import.execute` 会授予无关动作，或 Brief 4 需要更窄生产能力，再独立评审新增 capability；本片不穷举未来角色。

### 10.2 不可关闭安全不变量

- 默认拒绝与认证身份绑定；
- tenant、对象和 relation scope 服务端复核；
- rehearsal-only allowlist；
- old demo 与其他 tenant 不可写；
- global reference 不可写；
- package 路径、receipt 和日志脱敏；
- 不通过 CLI 直接调用 repository 绕过 Application policy。

### 10.3 CLI 边界

CLI 只负责：

- 在批准仓外根下读取 package；
- 通过受保护 HTTP API 或同一 Application composition root 执行；
- 提供 authenticated operator/service identity；
- 输出 stable code、trace ID、run ID 和脱敏计数。

CLI 不接受 Excel，不接受 Prisma URL 直写，不打印完整 hash/路径，不拥有 purge 权限。

## 11. API 与下游消费者

### 11.1 写接口

受保护的 apply endpoint：

- capability：`import.execute`；
- tenant 来自 authenticated identity，不接受 body 覆盖；
- body 接受已解析 package bundle 或受控 multipart artifact，不接受服务器绝对路径；
- 支持 Idempotency-Key；
- 返回 `applied | replayed | staged | published | rejected` 与 stable error code/trace ID。

### 11.2 状态接口

按 run ID 返回：

- package/version 的脱敏标识；
- 六类 input/applied/replayed/rejected counts；
- gap/check counts；
- receipt/reconciliation/publish 状态；
- 可行动的失败阶段与可重试性；
- 不返回商业原值、完整 hash、路径或凭据。

### 11.3 链路查询接口

以 shipment plan number 查询同一 published run 下的：

```text
shipment plan
→ booking + typed MBL/HBL
→ cargo-ready releases
→ stuffing lines
→ export customs cases
→ dispatch facts
```

接口显式返回 typed references 与 unsupported gaps，供 Brief 4 / 页面验收消费。它不返回生命周期“完成”结论，也不宣称工作台闭环。

## 12. 五面承接

| 业务步骤与结果                    | 岗位任务                                                    | 数据事实                                                      | 技术保障                                                                                                     | 权限边界                                                                      | UI / 消费者                                 |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------- |
| 将有效 package 变成可验收全链事实 | 后续 demo/工作台验收人员能定位同一链对象；本片不交付岗位 UI | 六类业务键、typed HBL/MBL、FK、FC-D07 identity、lineage、gaps | strict validator、typed graph、Serializable transaction、idempotency、gated publish、receipt、reconciliation | `import.execute` + rehearsal tenant/prefix 硬限制；old demo/other/global 禁写 | Brief 4 使用 status/chain API；本片不切页面 |

当前物理事实、已定缺口和行业候选分轨：

- `current_physical`：compiler/Brief 2 infrastructure 可复用；六类 landing 与三个核心 runtime carriers 缺失。
- `approved_gap`：父设计要求独立 rehearsal adapter、幂等、事务、事件/对象对账和关键 API/E2E。
- `industry_candidate`：无。本设计不引入外部行业规则、阈值或状态。

## 13. 测试策略

所有生产行为先 RED 后 GREEN。

### 13.1 Contract / package tests

- `publishable=false`；
- 未知 package/source/workbook/compiler/mapping/policy/record version；
- component/package hash mismatch；
- 缺失/额外/重复 type 文件；
- record-specific missing/unknown field；
- P record、D derivation、S scenario；
- compiler facade 与公共 package 的 bytes/hash/parity；
- 既有 Brief 1 focused tests 全绿。

### 13.2 Domain/Application tests

- 六类 business key normalization 与稳定 identity；
- typed HBL/MBL exact match；
- orphan、ambiguous、HBL/AMS 错型、substring/suffix mismatch；
- display-only 主备货号不建 relation；
- FC-D07 key 不被 contract/source row 扩张；
- 缺失状态/VGM/evidence/date precision 不默认；
- same package replay / different payload conflict；
- 日志和 receipt 脱敏。

### 13.3 真实 PostgreSQL integration

使用本次测试创建并迁移的唯一 PostgreSQL database：

- 六类成功落账与 typed FK；
- concurrent replay；
- 中途失败整批回滚；
- staged → object failure → replay recovery → published；
- Outbox exactly once、task count zero；
- tenant/object/global before-after invariants；
- cross-tenant lookup/FK rejection；
- transaction backend/session 证据；
- 新旧数据库迁移验证与数据字典 drift。

### 13.4 MinIO / API / E2E

- 唯一 rehearsal prefix、put-if-absent、same digest replay、different digest conflict；
- 非 rehearsal/escape/backslash/absolute path 在 I/O 前拒绝；
- exact-key cleanup；
- protected apply API、status API、chain API；
- 非 mock closeout：API/Application → real PostgreSQL → MinIO receipt → read-back；
- old demo、other tenant 和 global reference 零变化；
- unsupported gaps 在 status/chain response 可见。

浏览器页面不在本片；Web mock E2E 不能作为 Brief 3 backend 完成证据。

### 13.5 门禁

每个切片运行最近测试、API lint/typecheck/build、contract/schema drift、migration/data-dictionary、scoped format、repo/board/diff checks。形成最终 PR 候选后统一运行高风险完整门禁；后续纯文档修正不机械重跑生产风险门禁。

实现完成且主代理验收后，使用 fresh Claude Code 只读会话做一次整体复审。每项 finding 由主代理复现并处置为 accepted / rejected / pending-owner。

## 14. 实际 rehearsal execution 与代码完成分轨

### 14.1 代码完成

代码设计、实现、测试、独立复审和 PR 不因仓外 package 路径、重复 package hash 或外部环境零变化尚未执行而无故阻塞。

### 14.2 实际 rehearsal execution

真正运行前必须具备：

- `publishable=true` 且兼容矩阵/hash 一致的 package；
- 当次独立 rehearsal tenant；
- 当次独立 MinIO prefix；
- authenticated operator/service identity；
- 可用 PostgreSQL/MinIO；
- before inventory。

实际完成证据：

- 六类写入与 typed relation counts；
- 同 package replay；
- DB/MinIO/Outbox 对账；
- old demo、other tenant、global reference 零变化；
- 失败恢复；
- 非 mock API/closeout。

这些证据只证明本次 adapter 行为，不重新证明负责人已确认的数据真实性。

## 15. 明确不做

- 不重新询问或证明 workbook 是否真实；
- 不修改 FC-D07 / FC-D08；
- 不放宽 compiler fail-closed checks 或改变 stuffing business key；
- 不直接 Excel → database；
- 不建设通用 Excel importer、通用 adapter 平台或通用 JSON ledger；
- 不把 source labels 推断为备货接受、装箱完成、出口放行、loaded 或 departed；
- 不复用进口 customs 冒充出口 customs；
- 不调用 legacy demo seed；
- 不写 `demo-real-sample-20260921`、其他 tenant 或 global reference；
- 不运行 purge、backup、restore、Temporal pause/reset/terminate；
- 不清理旧 demo；
- 不修改 Web 页面或启动 Brief 4；
- 不读取、清理、暂存或提交 `.tmp/` 与 `apps/api/.tmp/`。

## 16. 风险与退出条件

| 风险                                 | 控制                                                       | 停止条件                           |
| ------------------------------------ | ---------------------------------------------------------- | ---------------------------------- |
| package contract 与 compiler 漂移    | 公共 contract + facade parity/golden tests                 | 现有 package bytes/hash 改变       |
| lineage 无法证明 FC-D07 contributors | actual run fail-closed，保留 gap                           | package 提供的 lineage 不足        |
| 新模型冒充生命周期                   | neutral facts + landing-only Outbox                        | 需要默认状态/VGM/evidence 才能写入 |
| 跨租户或旧 demo 写入                 | Application allowlist + tenant FK + before/after inventory | target 不是独立 rehearsal tenant   |
| DB 已写而对象失败                    | staged / gated publish / replay recovery                   | 无法保证未发布数据不可见           |
| 重放产生重复 side effects            | advisory lock + unique idempotency + object digest         | duplicate fact/event/task/object   |
| 出口/进口 customs 混用               | 独立 export customs fact                                   | 只能通过进口模型落账               |
| scope 扩张到 Brief 4                 | 独立 branch/brief/locks；Web/purge 禁止                    | 需要删除或页面切换才能验收         |

## 17. 完成定义

Brief 3 只有在以下条件全部满足后才可标 `done`：

- 唯一 task brief、书面设计和实施计划一致；
- 六类 strict package contract 与 compatibility matrix 生效；
- 六类 typed facts、FK 和 business key 约束落库；
- package preflight、Serializable apply、receipt、reconcile、gated publish 完成；
- replay/concurrency/rollback/receipt recovery/outbox exactly-once 通过；
- other tenant、old demo、global reference 零变化有真实 integration 反证；
- protected API/status/chain closeout 使用真实 PostgreSQL/MinIO；
- unsupported gaps 可见且没有制造生命周期结论；
- 高风险门禁通过；
- fresh Claude 整体只读复审 finding 全部处置；
- 单一主题 PR CI 全绿并合并；
- 若实际 rehearsal 尚未运行，必须在 verification 中明确 `code-complete / execution-not-run`，不得冒充实际演练完成。

Brief 3 合并不自动授权 Brief 4 的旧 demo 删除、切换或生产写入。
