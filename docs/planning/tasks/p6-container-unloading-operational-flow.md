---
status: review
branch: feat/container-unloading-operational-flow
verification:
  - API 专项 6 文件 78 tests passed
  - Web 专项通过；含日期事实失败重试幂等回归测试
  - contract:check / contract:drift passed
  - db:migrate / db:verify:container-unloading passed
  - 空库全迁移链与既有数据升级验证 passed
  - lint / typecheck / unit tests / build passed
  - E2E 74 passed / 7 skipped；卸柜专项三视口 passed
  - 本任务文件 scoped format check passed
  - pnpm validate 在 repo:check 被并发 docs/superpowers 文档的 5 个断链阻断
---

# 任务：实际卸柜、部分卸货与卸柜完成边界及岗位工作台

## 目标

交付路线图 3.2 第二片：仓库收货岗位可按真实作业顺序登记卸货开始、部分卸货和卸柜完成进度，核对实收与异常，并提交实际卸柜完成日期事实。只有本柜、本目的仓的卸货作业已完整完成且证据合格时，才允许 `unloaded` 完成第 12 节点。

## 边界 / 不做

- 权威规则来自 `EVENT_CODES.md`、`NODE_TIME_FIELDS.md`、`LIFECYCLE_NODE_IO_CATALOG.md` §5.12/§5.13、`CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md` 和 `DOMAIN_VERTICAL_DELIVERY_PLAN.md` 3.2。
- `started` 与 `partial` 是卸柜专业作业状态，不新增规范生命周期事件，不完成节点；岗位工单完成也不替代事实和过站。
- `completed` 只表示本次卸柜作业完成；第 13 节点 `container_unstuffing` 的卸空确认、空箱箱况和 `unstuffed` 不在本片实现。
- 沿用当前版本化目的仓指令作为仓库匹配依据，不建设 Facility 主数据后台、WMS 库存/上架、月台资源日历和还箱闭环。
- 兼容性分类为增量兼容：新增数据库表、公共 DTO/API、模块 Port、专项守卫和 `/workspaces/unloading`；不改写既有事件码、日期事实或生命周期状态。

## 验收

- [x] 仓库收货岗位可从全局任务池选择第 12 节点任务，看到目的仓、到仓事实、计划/预计/实际卸柜、作业进度、实收差异、异常和门禁缺口。
- [x] 岗位可追加版本化卸柜作业记录；同键同载荷幂等，同键异载荷、版本冲突和非法状态/数量明确失败。
- [x] `started`、`partial`、未卸完或有未解决差异的作业均不能使 `unloaded` 过站；已保存事实保持 `pending_application` 并可在条件补齐后自动重放。
- [x] `completed` 必须匹配当前目的仓、存在合格仓方证据、实收数量完整且无未解决差异，才能让经复核的 `unloaded actual` 完成 `container_unloading`。
- [x] 卸柜完成后货柜八态变为 `unloaded`，但第 13 节点仍未完成；界面明确区分卸柜完成、卸空确认和岗位工单完成。
- [x] 数据库迁移覆盖空库、旧版本升级、唯一性、版本链和约束验证。
- [ ] 运行 API/Web 专项测试、公共契约漂移检查、迁移专项门禁和 `pnpm validate`，实际结果记录在本 brief。

## 业务与数据协同设计（业务功能或 UI 必填）

| 业务岗位要完成什么     | 操作时需要看到什么                                                      | 系统允许做什么                                                | 数据如何可靠保存与反馈                                                 |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 判断卸柜任务是否可执行 | 货柜/备货单、当前目的仓、实际到仓、卸货窗、当前节点、证据与缺口         | 领取任务；查看等待、阻塞和不可执行原因                        | 任务池、送仓指令、日期事实和卸柜作业由服务端投影，UI 不推断过站资格    |
| 持续报送卸货进度       | 当前版本、开始时间、计划数量、已卸数量、剩余数量、单位、破损/短少及说明 | 首次登记开始、追加部分卸货或更正当前作业                      | 版本、状态转换、数量约束、幂等键、载荷哈希、前版引用和审计字段保留历史 |
| 确认本柜卸柜完成       | 目的仓、完成时间、最终实收、差异处理、仓方确认与照片/清单               | 仅在作业完整时追加 `completed`；再提交 `unloaded actual` 复核 | 作业完成守卫、统一日期事实、四眼复核、来源权威和证据核验共同决定结果   |
| 处理待复核或待应用     | 复核状态、采信状态、门禁原因、缺失条件、下一责任方                      | 补作业记录/证据；条件满足后自动重放                           | `pending_application` 不丢弃，作业更新后按柜重放并返回明确结果         |
| 完成岗位工单           | 工单状态、领取人、下一动作                                              | 领取或完成工单                                                | 既有 work-execution 保存工单结果，并明确不替代卸柜事实、卸空确认或过站 |

## 方案（design 阶段填写）

1. 在公共 Schema 中新增 `ContainerUnloadingReport` 与追加命令；作业状态固定为 `started | partial | completed`，记录目的仓、开始/完成时间、计划/已卸数量与单位、破损/短少、异常是否解决、证据和并发参数。
2. `inland-fulfillment` 新增纯领域规范化、版本化 Repository、读取/追加/就绪 Port，并追加 `container_unloading_report` 迁移；状态只允许单向推进，修正通过新版本表达。
3. `inland-lifecycle-orchestration` 写用例先核验证据，追加作业记录后自动重放本柜 pending 日期事实；读接口留在 `inland-fulfillment`，写接口要求 `container.operate`。
4. `ApplyLifecycleEventService` 为 `container_unloading + unloaded` 读取当前卸柜就绪度；专项守卫同时核对当前目的仓、日期事实地点、完成状态、数量/差异和仓方证据，不绕过 actual/verified/confirmed 通用链。
5. 前端组件图：`ContainerUnloadingWorkbench.vue` 只负责编排；`UnloadingWorkQueue` 展示全局任务；`UnloadingProgressPanel` 展示作业版本、数量与差异；`UnloadingFactsPanel` 展示送仓前提和日期门禁；`UnloadingActionPanel` 追加进度并提交完成事实；两个 composable 分别负责加载和命令副作用。
6. 更新路由、导航、UI 文案、路线图状态和文档索引；按岗位主路径、部分卸货阻断、完成恢复、工单分离与窄屏场景验收。

## Review notes（review 阶段填写，只读不改代码）

- 2026-09-21：领域、契约、数据库、API、工作台与三视口 E2E 均通过对应检查。
- `pnpm validate` 已执行但在第一步被本任务不拥有的 `docs/superpowers/specs/2026-09-21-container-workbench-task-driving-design.md` 断链阻断；同一文件及 `docs/superpowers/plans/2026-09-21-container-workbench-phase1.md` 还导致全库格式检查失败。本任务自有文件的 scoped format check 已通过。
- 复核时发现并修复“完成报告成功、日期事实失败后重试会换幂等键”的恢复缺陷；现保留报告键、日期事实键及解析后的证据引用，直至整条命令成功。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责  | commit | 说明                                                         |
| ---------- | ------ | ----- | ------ | ------------------------------------------------------------ |
| 2026-09-21 | design | Codex | —      | 冻结路线图 3.2 第二片边界、四者协同验收与兼容策略            |
| 2026-09-21 | review | Codex | —      | 完成纵向实现与首轮专项测试，进入迁移、E2E 和全门禁复核       |
| 2026-09-21 | review | Codex | —      | 迁移、全量测试、E2E 和构建通过；记录并发文档导致的全门禁阻断 |
