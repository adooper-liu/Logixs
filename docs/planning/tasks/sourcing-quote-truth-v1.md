---
status: coding
branch: feat/sourcing-quote-truth-v1
owner: cursor
writer: cursor
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/sourcing-quote-truth-v1.md
  - docs/planning/tasks/sourcing-workbench-operational-spec-v1.md
  - doc/cross-border-supply-chain/03-sourcing-and-replenishment-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/寻源与供应商工作台.md
  - doc/cross-border-supply-chain/wisdom-baseline/需求与补货.md
  - apps/web/src/views/SourcingWorkbench.vue
  - apps/web/src/composables/useSourcingWorkbench.ts
  - apps/web/src/composables/useSourcingWorkbench.test.ts
  - apps/web/src/data/sourcingQuotationCompare.ts
  - apps/web/src/data/sourcingQuotationCompare.test.ts
  - apps/web/e2e/sourcing-workbench.spec.ts
exclusiveLocks:
  - business-policy:sourcing-quote-truth-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/03-sourcing-and-replenishment-workbenches.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/寻源与供应商工作台.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
---

# 任务：寻源报价事实真实性 V1

## 目标

减少“错选供应商或实际工厂”这一寻源优先损失中，由报价事实失真引起的部分：页面不再把不可比报价排成“最低价”、不再把最便宜的供应商冒充当前责任人；报价修订不再覆盖历史；可比性由服务端判断并说明原因。权威依据：`doc/03` 寻源“业务目的、优先损失与完成点”，以及同节“失败及异常处理”（报价不可比须说明阻断原因）、“权威落库事实”（原始报价）、“选择合适的询价方式”（口径不同先提示不可直接比较）。

## 边界 / 不做

- 不建寻源项目、范围行、事项责任、份额分配或报价到期等结构；这些是 Annotation 1 降级的历史候选，需要时逐项重新定案。
- 不改定点快照、准入和定点规则；不新增角色，沿用 `planning.read` / `planning.draft`。
- 不做总落地成本归一和 AI 推荐。

## 调度

- S1 只改 Web，不持有数据库或契约锁，与 `market-selection-handoff-v1` 并行。
- S2、S3 需要 `database-schema`、`database-migrations`、`database-dictionary`、`generated:database-catalog`、`public-contract:supplier-nomination-v1`、`generated:contracts`。负责人 2026-10-04 定：数据库/契约通道在交接任务之后先给选品（`product-selection-resource-commitment-v1`），寻源 S2、S3 排在其后；届时主代理补写入范围与锁再开工。
- 写入者为主代理，按 `AGENTS.md` §1.2 第 4 条由 GPT-5.6 fresh 只读复审。

## 执行切片

### 切片 `S1-remove-false-ranking`（现在开工）

1. 删除前端用 `Number()` 比较金额的“最低价”排序与“（同口径价低）”标注；“当前责任人”只显示真实责任信息（当前无持久责任人时如实写“寻源负责人”），不得用供应商名代替。
2. 每家报价照常完整展示各价格档、币种和贸易术语；比较区如实显示“报价可比性待服务端判定，暂不排名”，不显示任何排名或推荐。
3. 删除只在前端判断可比性的 `sourcingQuotationCompare.ts` 及其测试；前端不保留第二份可比性规则。
4. 验证：受影响 Web 单测、`sourcing-workbench.spec.ts` E2E、Web lint/typecheck。

### 切片 `S2-quote-revision-history`（选品通道之后）

报价每次记录追加不可变修订（版本、全部条件、记录人、时间），当前行保持为最新投影；定点快照继续引用被选中的版本；界面可查看某家报价的修订历史。迁移空库与旧版本升级测试，存量当前行作为第 1 条修订回填（属事实搬运，不伪造）。

### 切片 `S3-server-comparability`（S2 通过即预授权）

服务端按同一可售 SKU 发布的报价判定可比性：币种、贸易术语、首档起订量一致才可比；不可比时返回具体原因码与涉及报价。可比时按首档单价用定点十进制比较给出“同口径单价最低”，只作提示，不代替定点评审。界面展示服务端结论与原因。

## 智慧开启基线

| 基线文件与原结论（语义原文 + 位置）                                            | 处置               | 依据                                                    | 落点            |
| ------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------- | --------------- |
| 目标岗位：稳定供给方案负责人（`寻源与供应商工作台.md` 848、884 起“已定事项”）  | `沿用`             | 已写回 `doc/03`                                         | doc/03          |
| 核心结果：最晚决策时点前形成并批准可执行稳定供给方案（856 起“核心业务目的”）   | `沿用`             | 已写回 `doc/03`                                         | doc/03          |
| 三类优先损失：方案未按时就绪、错选供应商或工厂、缺替代供给（860 起“优先损失”） | `沿用`             | 已写回；本任务针对“错选供应商或工厂”中报价失真部分      | 本任务目标      |
| 完成点：下游明确接受可执行方案（849）                                          | `补强`             | 负责人 2026-10-04：完成点=接受，“实际采用”只作结果指标  | doc/03          |
| 结果指标五项与最低保障不替代经营指标（874 起“结果指标”）                       | `沿用`             | 已写回 `doc/03`                                         | doc/03          |
| 样本门槛：进入技术设计前必须取得真实样本（850、934）                           | `修正`             | `doc/08` §3.1“真实样本门禁范围”，负责人 2026-10-04 原话 | 基线修订记录    |
| 第一轮 1A～18A 及 12A～14A 细化选择（942～944）                                | `沿用`（历史候选） | 原文已降级，不作设计依据                                | 本任务“不做”    |
| Annotation 1 适用范围（966）                                                   | `补强`             | 负责人 2026-10-04：只适用寻源                           | 基线修订记录    |
| 下游须具备接受/拒绝动作（973）                                                 | `存疑`             | 补货/采购工作台尚无该动作；不在本任务范围               | 补货/采购开启时 |

## 业务步骤五面映射

| 业务步骤与岗位结果     | 岗位任务来源/状态         | 相关数据事实子集             | 技术保障                       | 权限边界                  | 界面承接                               | 验收证据/状态 |
| ---------------------- | ------------------------- | ---------------------------- | ------------------------------ | ------------------------- | -------------------------------------- | ------------- |
| 看清各家报价而不被误导 | `doc/03` 失败及异常处理   | 报价各档单价、币种、贸易术语 | 前端不做金额计算与可比性判断   | `planning.read`           | 完整报价、无排名、如实提示待服务端判定 | S1 待验       |
| 修订报价不丢历史       | `doc/03` 权威落库事实     | 报价修订版本、记录人、时间   | 同事务追加；幂等与版本冲突沿用 | `planning.draft`          | 修订历史可查                           | S2 待验       |
| 知道哪里不可比         | `doc/03` 询价方式第 74 行 | 可比性结论与原因码           | 服务端单一规则；定点十进制比较 | `planning.read`；租户隔离 | 原因逐项显示，可比时才提示最低         | S3 待验       |

### 相关数据事实子集（三轨）

| 轨道                 | 字段/事实                                                  | 当前证据/来源                                                                                                            | 建议承载方式           | 决策 ID | 状态                 |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------- | -------------------- |
| `current_physical`   | 同一供应商对同一发布只留一条当前报价，修订直接更新         | `database/schema.prisma` `supplier_quotation_current_key`；`prisma-supplier-nomination.repository.ts` `persistQuotation` | 已有                   | —       | gap-confirmed        |
| `current_physical`   | 前端浮点比价并以供应商名充当当前责任人；可比性只在前端判断 | `SourcingWorkbench.vue` 94～110；`useSourcingWorkbench.ts` 79～84；`sourcingQuotationCompare.ts`                         | 已有                   | —       | gap-confirmed        |
| `approved_gap`       | 原始报价可追溯；不可比须说明原因                           | `doc/03` 寻源 40、48、74 行                                                                                              | 不可变修订、服务端投影 | —       | approved / S1 coding |
| `industry_candidate` | 总落地成本归一                                             | `doc/03` 第 74 行“再展示归一后的总落地成本”                                                                              | `undecided`            | —       | 不进入本任务         |

## 23 台共同最低可用线（本任务承接）

`WB-B05` 事实与观测分轨（报价事实不被伪结论污染）、`WB-B07` 报价版本可追溯；其余不在本任务范围。

## 验收

- [ ] 页面不再出现任何报价排名、“同口径价低”或以供应商名充当的责任人
- [ ] 前端不再保留可比性规则或金额浮点比较
- [ ] 报价修订追加历史，旧版本可还原，定点快照引用不变（S2）
- [ ] 服务端返回可比性结论与原因码，界面如实呈现（S3）
- [ ] 最终候选完整 `pnpm validate` 通过，并经 fresh GPT-5.6 复审裁决

## 进度 log

| 日期       | 阶段   | 负责   | commit     | 说明                                                                                                                                                                                                                                                             |
| ---------- | ------ | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-04 | coding | Cursor | `d6f5af85` | 寻源六项有效决定与“接受”口径写回 `doc/03`；基线追加修订；S1 只改 Web 并行开工，S2/S3 排在选品数据库通道之后                                                                                                                                                      |
| 2026-10-04 | coding | Cursor | S1 提交    | S1 完成：删除前端 Number() 最低价排序、同口径价低标注和前端可比性规则文件；当前责任只写岗位；价格档原样列出；两家以上报价显示“报价可比性待服务端判定，暂不排名”。Web 单测 142 文件 638 条、typecheck、lint、sourcing E2E 6 条（三视口）通过；待 GPT-5.6 独立复审 |
