# P6 导入第一刀实施规格

> 用途：把「智能 Excel 导入」第一条可写库闭环拆成可排期、编码、测试和验收的规格。
> 本文件不创建新的公共契约正文；状态、枚举、事件、DTO、错误码必须引用仓库内权威定义。
> 候选项保持候选，实现时显式失败或进复核，不得升格为已定规则。

## 1. 文档控制

| 项目       | 内容                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| 切片       | P6 导入第一刀                                                                           |
| 主导模块   | `integration-import`                                                                    |
| 协作模块   | `shipment-registry`（写端口）、`workflow`（Temporal 代理）、`ai-governance`（治理转发） |
| 状态       | `design`                                                                                |
| 负责人     | 刘志高                                                                                  |
| 关联 ADR   | ADR-001、ADR-003、ADR-004、ADR-005、ADR-006、ADR-010                                    |
| 任务 brief | [p6-import-first-slice.md](../tasks/p6-import-first-slice.md)                           |
| 版本与日期 | 0.2 / 2026-09-12                                                                        |

权威输入：

- [IMPORT_WORKFLOW](../../product/workflows/IMPORT_WORKFLOW.md)（已确认基线）
- [IMPORT_DOMAIN_MODEL](../../product/domain/IMPORT_DOMAIN_MODEL.md)（P2 评审通过；五处候选见 §2.3）
- [TARGET_FIELD_CATALOG](../../product/domain/TARGET_FIELD_CATALOG.md)
- [PRECHECK_RULES](../../product/domain/PRECHECK_RULES.md)
- [PUBLIC_ERROR_CONTRACT_V1](../../product/domain/PUBLIC_ERROR_CONTRACT_V1.md)（GC-011）
- [SYNC_RELIABILITY_CONTRACT_V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)
- [P2_REVIEW_CHECKLIST](../../product/domain/P2_REVIEW_CHECKLIST.md) §4

## 2. 目标与边界

### 2.1 业务目标

- 用户与业务结果：运营人员上传一份已出运货柜表，经映射确认和预检后，事务写入 `container_record`，得到可追溯的成功/跳过/失败对账。错误写入率目标 0。
- 本期范围：
  1. 认证后的文件上传与 `ImportBatch` 创建（幂等）。
  2. 确定性解析（格式/大小/行列上限）。
  3. `suggest_import_mapping` 建议（L1；模型不可用则人工映射，不写库）。
  4. 全部映射建议人工确认。
  5. 预检硬闸；blocker 禁止写业务表。
  6. 经 `shipment-registry` 公开写端口按 `orderNumber` 命中更新 / 未命中新建。
  7. 逐行结果与对账展示。
- 非目标：完整 OIDC、海关/工单/费用、状态机全量推进、飞驼直连、LiteLLM 真实计费、自动执行映射（P7-09）、demo 工作台改权威写入口。

### 2.2 所有权

| 本切片拥有                         | 本切片不拥有                     | 只读投影                           |
| ---------------------------------- | -------------------------------- | ---------------------------------- |
| ImportBatch / ImportRow / 审核记录 | ContainerRecord 身份与货柜状态机 | 货柜列表当前状态、备货单号是否存在 |
| 预检报告、对账报告、映射建议留痕   | 14 节点完成、工单、费用账单      | TARGET_FIELD_CATALOG 字段模板      |
| 原始文件对象键（MinIO）            | 模型供应商会话                   | AI 能力目录                        |

依赖方向：`UI / Transport -> Application -> Domain <- Infrastructure`。`integration-import` 不得直写 `container_record`；只调用 `shipment-registry` 公开写端口。写端口候选名 `applyContainerRecordPlan`（D-portname，候选，实现前在契约中定一个名字并登记，不得同时保留两个）。

### 2.3 评审留下的候选（实现纪律）

| 项           | 实现时做法                                      |
| ------------ | ----------------------------------------------- |
| 批次状态次序 | 按 IMPORT_WORKFLOW §4 状态机落库；未知状态拒绝  |
| 审核升级路径 | 第一刀不设自动升级；全部人工确认                |
| 写端口命名   | 契约只公布一个名字，文档其余处只引用            |
| 准入证据集   | 说不清是否已出运 → blocker 或复核，不静默已出运 |
| 必填硬闸     | 采用 PRECHECK 已有 O 级 blocker；其余保持候选   |

## 3. 领域模型

### 3.1 聚合与不变量

| 聚合根      | 实体/值对象                                        | 标识            | 核心不变量                                                      | 并发版本     |
| ----------- | -------------------------------------------------- | --------------- | --------------------------------------------------------------- | ------------ |
| ImportBatch | rows、mappingSuggestions、precheck、reconciliation | batchId         | 同 idempotencyKey 不创建第二批次；blocker 存在则不得调用写端口  | batchVersion |
| ImportRow   | rawSnapshot、review、executionResult               | (batchId,rowNo) | 一行至多对应一条 ContainerRecord；文件内同 orderNumber 只写一条 | rowVersion   |

成功：

- 幂等键命中且请求哈希相同 → 返回原批次，不重跑。
- 映射全部确认、预检无 blocker、写端口成功 → 行结果 `success`，回写 `orderNumber`。
- 模型不可用 → 批次可转人工映射；不得用空建议写库。

拒绝：

- 未认证写 → `AUTHENTICATION_REQUIRED`。
- 文件类型/大小/行数/列数越界 → `VALIDATION_FORMAT` / `VALIDATION_RANGE`。
- 缺 `orderNumber` → PRECHECK `REQ_ORDER` blocker。
- 未知字典值 → 进待处理，不生成含糊主数据。
- 同幂等键不同文件哈希 → `IDEMPOTENCY_KEY_CONFLICT`。

边界：

- 箱号、实际出运日期可空（迟绑定）；双方已有但不一致 → 复核，不静默。
- 主备货单号不作匹配键。
- AI 建议不可变留痕；审核结果指向建议；执行结果指向审核；业务事实只在 ContainerRecord。

### 3.2 状态机

批次状态引用 IMPORT_WORKFLOW §4，不在此复制枚举。第一刀合法主路径：

| 当前状态            | 命令/权威事件     | 前置条件       | 下一状态            | 副作用                  | 拒绝码                     |
| ------------------- | ----------------- | -------------- | ------------------- | ----------------------- | -------------------------- |
| （无）              | CreateImportBatch | 认证、文件验收 | `pending`/`running` | 存原文件、启动 Workflow | `VALIDATION_*` / `AUTH*`   |
| `running`           | MappingSuggested  | 解析完成       | `awaiting_review`   | 写入建议                | 模型失败可 `failed` 或人工 |
| `awaiting_review`   | ConfirmMappings   | 每列有确认     | `awaiting_precheck` | 审核留痕                | `VALIDATION_REQUIRED`      |
| `awaiting_precheck` | RunPrecheck       | 已确认映射     | `approved` 或停     | 预检报告                | blocker 时不得 `approved`  |
| `approved`          | ExecuteImport     | 无 blocker     | `executing`         | 调写端口                | 有 blocker 则拒绝          |
| `executing`         | RowsReconciled    | 逐行结果齐全   | `completed`         | 对账报告                | 部分行 `failed` 仍可完成   |

任意阶段可因取消/超时进入 `cancelled` / `expired`；解析或安全拦截进入 `failed`。工单完成不在本切片。未知业务值明确失败。

## 4. 数据设计

### 4.1 逻辑结构

| 表/集合             | 用途             | 主键 | 外键/引用                            | 唯一约束                | 审计/时间字段                 |
| ------------------- | ---------------- | ---- | ------------------------------------ | ----------------------- | ----------------------------- |
| `import_batch`      | 一次上传生命周期 | `id` | `tenant_id`                          | `idempotency_key`       | `created_at`/`updated_at` UTC |
| `import_row`        | 一行一柜候选     | `id` | `batch_id` → import_batch            | `(batch_id, row_no)`    | 同上                          |
| `import_review`     | 列/行审核        | `id` | `batch_id` / `row_id`                |                         | operator、reason、UTC         |
| `import_row_result` | 执行结局         | `id` | `row_id`；`container_record_id` 引用 | `(row_id)` 当前结果一条 | 指向审核                      |

- 原始文件进 MinIO（本切片产生消费者，启用 P4-01 中延后的 MinIO）；业务表只存 bucket/key/checksum。
- `container_record` 仍由 `shipment-registry` 拥有；导入表不得复制状态机。
- 金额若出现必须定点十进制 + 币种；缺币种走 `CUR_AMOUNT` blocker。
- 迁移只追加 `database/migrations/`。

### 4.2 数据生命周期

- 创建：上传事务内写 batch + 对象存储；失败则对象与批次不对账的孤立文件记清理任务。
- 修订：映射确认与预检追加记录，不覆盖建议原文。
- 保留：原文件 ≥ 90 天，批次与逐行结果 ≥ 2 年（NFR §5）。
- 更正：新版本引用旧行结果，禁止静默覆盖 ContainerRecord 密封字段。
- 第一刀不做生产数据修复脚本。

## 5. 应用用例

| 用例                    | Actor/权限          | 输入                       | 事务边界       | 幂等/并发         | 输出                  | 失败码                                                           |
| ----------------------- | ------------------- | -------------------------- | -------------- | ----------------- | --------------------- | ---------------------------------------------------------------- |
| CreateImportBatch       | 导入操作员          | 文件、来源、idempotencyKey | batch + 对象键 | 来源+文件指纹     | batchId、sync 回执    | `AUTHENTICATION_*` / `VALIDATION_*` / `IDEMPOTENCY_KEY_CONFLICT` |
| SuggestImportMapping    | 系统（经治理端口）  | 列结构、模板版本           | 建议行         | 同 batch 一次     | 建议列表              | 模型失败降级，不写业务表                                         |
| ConfirmMappings         | 导入操作员/审核主管 | 列确认/修正                | review         | clientOperationId | 三段确认              | `VALIDATION_REQUIRED`                                            |
| RunPrecheck             | 系统                | 已确认映射+行值            | 预检报告       | 同版本可重跑      | blocker/conflict/warn | 有 blocker 不得执行                                              |
| ExecuteImport           | 系统（人触发）      | 无 blocker 的批次          | 逐行调写端口   | 行级幂等          | 对账                  | 写端口冲突码原样映射                                             |
| GetBatch / GetReconcile | 导入操作员          | batchId                    | 只读           |                   | 投影                  | `RESOURCE_NOT_FOUND` / `AUTHORIZATION_*`                         |

Application 编排权限、事务和 Port。Controller 只解析、调用例、转 GC-011 信封。

写端口（shipment-registry）最小命令：按 `orderNumber` 匹配；hit 更新允许字段；miss 新建；违反密封/合法转换则拒绝。导入模块不得绕过。

## 6. 公共契约与集成

| 类型    | 名称                       | 生产者     | 消费者            | Schema 权威位置                                 | 兼容策略         |
| ------- | -------------------------- | ---------- | ----------------- | ----------------------------------------------- | ---------------- |
| command | CreateImportBatch          | web / api  | import            | 本切片新增 JSON Schema，列入 contracts 后再实现 | 加法兼容         |
| command | SuggestImportMapping       | ai-service | import            | P2-10，单一权威源                               | 未建则本切片补   |
| event   | ImportBatchCompleted       | import     | 查询/审计         | 名称/版本/ID/occurredAt/关联 ID                 | ADR-009          |
| DTO     | ContainerRecord write plan | import     | shipment-registry | 显式映射，禁止 Prisma 实体出站                  | 候选端口名一次定 |

- Temporal：`ImportWorkflow` 由 `workflow` 模块启动；解析、预检、写端口在 Activity；Workflow 不直接 IO。
- AI：只经 `ai-governance` → AI Service；禁止业务模块 import 供应商 SDK。
- 第一刀模型默认 Mock（P4-09）；真实 LiteLLM 不在本切片启用条件内。
- 外部 Excel 值经映射字典进入内部码；未知值进队列。

## 7. API 规格

| Method/Path                                    | 用例              | 权限      | 幂等键            | 并发 | 错误码       |
| ---------------------------------------------- | ----------------- | --------- | ----------------- | ---- | ------------ |
| `POST /api/import-batches`                     | CreateImportBatch | 认证+导入 | Idempotency-Key   | 单键 | 见 §5        |
| `GET /api/import-batches/:id`                  | 查询              | 认证      |                   |      | 404/403      |
| `POST /api/import-batches/:id/mapping-reviews` | ConfirmMappings   | 认证      | clientOperationId | 版本 | 400          |
| `POST /api/import-batches/:id/precheck`        | RunPrecheck       | 认证      |                   | 版本 | 409 若已执行 |
| `POST /api/import-batches/:id/execute`         | ExecuteImport     | 认证+审核 | clientOperationId | 版本 | blocker 拒绝 |
| `GET /api/import-batches/:id/reconciliation`   | 对账              | 认证      |                   |      | 404          |

列表类查询分页、最大页大小、稳定排序。错误用 GC-011 信封 + `traceId`。响应不得返回 Prisma 实体或证据原文。

第一刀认证：禁止匿名写。正式 OIDC 属 P5-02；本切片必须有服务端可验证的开发期身份（谁操作、属于哪个 tenant），并写入审计。不得把前端路由守卫当安全边界。

文件：只接受 `.xlsx` / `.xls` / `.csv`；≤10MB、≤5000 行、≤50 列（NFR §3）。隔离解析，禁止执行宏。病毒扫描接口留 Port，第一刀可返回“未配置扫描”的明确策略，但类型/大小检查不可缺。

## 8. 前端实施规格

| 路由/视图                         | 用户目标         | 数据查询  | 可用动作             | 权限 | 加载/空/错/冲突 |
| --------------------------------- | ---------------- | --------- | -------------------- | ---- | --------------- |
| `/import`                         | 上传并看批次状态 | 批次列表  | 上传、打开批次       | 导入 | 四态            |
| `/import/:batchId`                | 确认映射、看预检 | 建议+预检 | 确认/修正/拒绝列     | 导入 | 四态+冲突       |
| `/import/:batchId/reconciliation` | 看写入结果       | 对账      | 重试失败行（若允许） | 导入 | 成功/跳过/失败  |

- demo `ContainerList` 不作为写入入口；真实列表继续走 `/real-containers` 只读，导入成功后应能读到新行。
- UI 只展示服务端判定的状态与可用动作，不复制批次状态机。
- 同步反馈按三段确认：已接收 / 已接受 / 已落账。
- 不提供“忽略预检强制写入”开关。

## 9. 可观测性与运营

- 日志：batchId、rowNo、actorId、tenantId、traceId、workflowId；禁止文件全文、Token、密码。
- 指标：上传数、预检 blocker 数、行成功/失败、映射人工修改率（为 P7 留字段）。
- 审计：谁确认了哪一列、谁触发执行、写端口前后值摘要。
- 运行手册：模型不可用时改人工映射；重复上传返回原批次；MinIO 不可用则批次 `failed`，不写业务表。

## 10. 测试矩阵

| 层级         | 成功路径               | 拒绝/边界          | 并发/幂等           | 重放/乱序      | 权限/安全      |
| ------------ | ---------------------- | ------------------ | ------------------- | -------------- | -------------- |
| Domain       | hit 更新 / miss 新建   | 缺单号、未知字典   | 文件内重复          | 迟到状态列     | N/A            |
| Application  | 确认→预检→执行         | blocker 禁写       | 同键同哈希 / 异哈希 | 取消后不可执行 | 未认证、跨租户 |
| Database/API | 迁移约束、事务逐行结果 | 实体不出台         | 唯一幂等键          |                | 文件类型/大小  |
| UI/E2E       | 上传到对账可见真实货柜 | 预检红灯无执行按钮 | 重复上传提示原批次  |                | 无凭证不能上传 |

## 11. 验收样本

| 样本        | 输入                         | 期望                                 |
| ----------- | ---------------------------- | ------------------------------------ |
| S1 同义列   | 列头 `ETD` 与 `预计离港时间` | 建议同一标准字段，待人确认后才能预检 |
| S2 字典     | `Yantian` / `盐田`           | 同一港口码或进待处理，不硬猜         |
| S3 重复批次 | 同源+同指纹再传              | 返回原 batchId，不新建               |
| S4 预检     | 缺备货单号                   | blocker，禁止 execute                |
| S5 迟绑定   | 无箱号但有单号且已出运证据足 | 允许建档，`container_number` 空      |
| S6 冲突箱号 | 同单号库内箱号与文件不一致   | 复核，不覆盖                         |
| S7 降级     | AI 超时                      | 人工映射或 `failed`，业务表无脏行    |
| S8 未认证   | 无身份上传                   | `AUTHENTICATION_REQUIRED`            |

每条样本记录：初始数据、Actor、命令、证据、期望批次状态、期望事件、期望投影、错误码/`traceId`。

## 12. 交付拆分与完成定义

四个阶段（同一时刻一个进行中任务，作本 brief 子步骤，不另开并行 brief）。`p6-smart-import-slice` 的四阶段草案已并入此处。

| 阶段          | 目标                                                         | 对应清单            | 完成定义                         |
| ------------- | ------------------------------------------------------------ | ------------------- | -------------------------------- |
| A 读链路      | 上传 → 幂等 → 安全解析 → 展示样本；不落账                    | P6-01/02/04/07 读侧 | 真实文件可上传、可解析、可展示   |
| B AI 建议     | `suggest_import_mapping` + 置信度/证据；模型不可用则人工映射 | P6-05/07            | 建议可展示；不自动执行           |
| C 审核+落账   | 映射确认 → 预检硬闸 → 写端口 → 对账                          | P6-06/08/09/10/11   | blocker 禁写；成功后真实货柜可读 |
| D 可靠性+测试 | 取消/超时/重试/恢复 + Trace + §10 + S1–S8                    | P6-12/13/14         | 门禁与样本证据齐全               |

阶段内编码切片：

1. 契约：ImportBatch DTO + `suggest_import_mapping` Schema + 写端口命令（单一权威源）。
2. 迁移：`import_*` 表 + MinIO compose。
3. Domain：批次不变量、匹配、预检应用。
4. Application / Adapter：上传、Workflow、写端口、Mock 映射。
5. API + 开发期身份。
6. Web：上传 / 审核 / 对账三页。
7. 测试：§10 + S1–S8；E2E 一条主路径。

进入 `ready` 前：本规格评审，五个候选项仍标候选。进入实现 `done` 前：契约无漂移、迁移可空库升级、预检硬闸有回归、写路径有认证、UI 四态可验收、INDEX 已更新。
