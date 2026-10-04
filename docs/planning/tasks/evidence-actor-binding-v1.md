---
status: blocked
branch: feat/evidence-actor-binding-v1
owner: cursor
writer: cursor
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/evidence-actor-binding-v1.md
exclusiveLocks:
  - business-policy:evidence-actor-binding-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/planning/tasks/market-selection-handoff-v1.md
  - packages/contracts/schemas/v1/evidence-record.schema.json
---

# 任务：证据登记人绑定与登记对象校验 V1

## 来源与目标

`market-selection-handoff-v1` S3 执行时被实现执行器以 `blocked` 返回，主代理核实属实（该 brief HO-D05）。负责人定案“C（推荐）先合并已完成的部分”：交接分支先以 S1～S2b 收口，本任务修复证据底层后，再承接交接 S3“接受后市场追加新证据”。

岗位结果：任何岗位手工登记的证据都能说清“谁在何时登记”，且只能挂到本租户真实存在的业务对象上；下游（选品看市场新增证据、各执行台看补录证据）据此判断可信度，不再看到无主证据。

## 当前物理事实（2026-10-04 核实）

| 事实                                                                                  | 证据                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `POST /api/evidence` 只从认证身份取 `tenantId`，不传 actor                            | `apps/api/src/modules/document-records/presentation/evidence.controller.ts` 25～34      |
| `RegisterEvidenceInput` 无登记人字段；`idempotencyKey` 可选                           | `apps/api/src/modules/document-records/application/register-evidence.service.ts` 19～40 |
| 契约要求 `captureSource = manual_backfill` 时 `source.actorId` 必填，现有写入从未满足 | `packages/contracts/schemas/v1/evidence-record.schema.json` 305～315                    |
| `evidence_record.source` 为 Json 列；核验裁决表已有 `actor_or_service_id`             | `database/schema.prisma` `EvidenceRecord`、`EvidenceVerificationDecision`               |
| 登记不校验 `subjectType/subjectId` 对象是否存在、属于本租户或版本一致                 | 同上 controller / service                                                               |
| `manual_backfill` 写入方：市场信号、提货、拆箱、仓配、离港后交接、日期事实复核等      | `apps/web/src/api/marketSignals.ts`、`apps/web/src/composables/use*Commands.ts` 等      |

## 待负责人定案（设计阶段，每轮 1～3 项）

| 决策 ID | 问题                           | 候选                                                                                                | 状态    |
| ------- | ------------------------------ | --------------------------------------------------------------------------------------------------- | ------- |
| EV-D01  | 存量无登记人的手工证据如何呈现 | 标“登记人未记录（历史）”只读保留；或按审计日志回填（须先证实审计日志可对应）                        | pending |
| EV-D02  | 登记对象校验放在哪里           | 各业务模块提供“对象存在且属本租户”Port 由证据模块调用；或各业务模块自建专属登记端点再经 Port 写证据 | pending |

## 五面草案（设计阶段，未进入实现）

| 业务步骤     | 岗位任务                   | 数据事实                                        | 技术保障                                     | 权限边界                                       | 界面承接                                                   |
| ------------ | -------------------------- | ----------------------------------------------- | -------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| 手工登记证据 | 登记人对所登记内容负责     | `source.actorId` 来自认证身份，不接受客户端传入 | 幂等键必填或服务端派生；重复提交不产生第二条 | 沿用各台现有写能力；跨租户与未知对象拒绝并审计 | 各台证据回执与详情显示登记人与时间                         |
| 下游读取证据 | 判断证据是否可信、是否新增 | 登记人、登记时间、对象引用                      | 读取经现有 Port；分页与租户隔离沿用          | 沿用读能力                                     | 交接 S3：选品详情“交接后市场新增（N）”逐条显示时间与登记人 |

## 进度 log

| 日期       | 状态    | 执行者 | 基线       | 说明                                                                                   |
| ---------- | ------- | ------ | ---------- | -------------------------------------------------------------------------------------- |
| 2026-10-04 | blocked | Cursor | `b022eb00` | 由交接 S3 阻塞派生建立（HO-D05）；事实已核实，EV-D01/EV-D02 待负责人定案后再定切片与锁 |
