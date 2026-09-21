---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/customs-clearance-operational-flow
verification: 2026-09-21：pnpm validate 通过（API 813、Web 233、Worker 5；E2E 65 通过/7 条按视口跳过；repo/contract/db generate/lint/format/typecheck/build 全绿）；pnpm db:migrate、pnpm db:verify:customs-clearance 与 pnpm db:verify:container-stuffing 通过（含旧库升级、空库完整迁移、版本/幂等/唯一当前案件约束）。
---

# P6 清关案件、放行门禁与岗位工作台

> 状态：**已完成**
> 路线图条目：`3.1 清关到提柜` 的首个最小纵向切片
> 分支：`feat/customs-clearance-operational-flow`
> 基线：`main@29b0d60`

## 1. 业务结果

清关岗位可以从全局任务池进入某柜，看到到港、清关任务和日期事实，登记一份可追溯的清关案件；只有海关申报已受理、海关已放行、没有未解除扣留且证据有效时，实际清关日期事实才可完成 `customs_clearance` 节点。

本刀同时回答四件事：

1. 岗位要完成什么：核对申报编号、进口司法辖区、清关行引用、海关决定和扣留情况。
2. 操作时要看到什么：货柜身份、到港事实、清关节点、当前案件版本、证据、阻塞原因和允许动作。
3. 系统允许做什么：保存新案件版本、录入实际清关日期、完成已有清关工单；任务完成不代替过站。
4. 数据如何可靠保存：租户隔离、幂等、乐观并发、追加版本、证据校验、来源权威裁决和 pending 自动重放。

## 2. 权威与边界

- 14 节点与完成事件：`LIFECYCLE_NODE_CATALOG_V1.md`、`EVENT_CODES.md`。
- 日期事实与来源权威：`NODE_TIME_FIELDS.md`、`EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md`。
- 清关运营关系：`CUSTOMS_OPERATION_CHAINS.md`，其中系统映射仍为候选，只取负责人已确认的业务方向。
- 工作台纪律：`DOMAIN_VERTICAL_DELIVERY_PLAN.md`、`UI_SYSTEM.md`。
- 本刀只实现海关主体的申报/扣留/放行。码头、船司、单证等多主体放行仍待真实样本和负责人确认，不采用候选 `FIVE_PARTY_CODES` 作为运行时权威。
- 不新增第 15 个生命周期节点，不由清关案件或工单直接推进状态，不让供应商状态直接遥控流程。

## 3. 实施范围

- `customs-compliance`：版本化 `CustomsClearanceCase`、读取/替换 Port、海关放行 readiness。
- 数据库：新增清关案件快照表及约束；只追加迁移。
- `lifecycle-control`：`container_customs_completed` 的专项守卫读取清关 readiness。
- 编排：案件新版本落账后自动重放本柜 `pending_application` 日期事实。
- 公共契约：以 JSON Schema 为权威新增清关案件请求/响应，生成 TypeScript 类型。
- Web：清关任务池、事实面板、案件表单、实际清关日期入口与结果反馈。
- 文档：路线图、INDEX 与 UI 清单登记实际交付。

## 4. 明确不做

- 不做完整报关系统、关税计税、商品归类或通用审批引擎。
- 不做全部主体放行矩阵、批量清关、清关行主数据后台或供应商 API Adapter。
- 不把 `available`、`gate_out`、拖车排程或提柜工作台塞入本刀。
- 不用自由 JSON 代替申报状态、海关决定、扣留和证据等关键事实。

## 5. 验收标准

- 同租户同柜只有一个当前案件版本；更正产生新版本并保留旧版本。
- 同幂等键同载荷返回原结果；异载荷冲突；错误版本冲突。
- 申报已受理必须有申报编号；放行时不得存在活动扣留，且必须有关联证据。
- 生命周期守卫在案件未就绪时返回稳定 pending 原因；案件就绪后重放可完成清关节点。
- API 在边界校验输入并执行租户、权限与证据检查。
- 清关工作台可完成选择任务、查看上下文、保存案件和登记实际清关日期的主流程，并适配桌面/窄屏/移动端。
- 相关领域、应用、控制器、Vue 组件与 E2E 覆盖成功、失败、幂等、并发和门禁路径。

## 6. 验证

先运行受影响 API、Web 和契约测试；再运行 Prisma 校验/迁移专项检查、类型检查与构建。由于涉及数据库、公共契约和核心工作流，完成前运行 `pnpm validate`。
