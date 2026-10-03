---
status: coding
branch: feat/gc012-g0-catalog-v1
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/gc012-g0-catalog-v1.md
  - AGENTS.md
  - apps/web/e2e/customs-workbench.spec.ts
  - apps/web/e2e/workbench-network.spec.ts
  - apps/web/src/components/shell/navigation.test.ts
  - apps/web/src/components/workbench/WorkbenchFlowContext.vue
  - apps/web/src/data/workbenchNetwork.test.ts
  - apps/web/src/data/workbenchNetwork.ts
  - apps/web/src/modules/workbench-network/routes.ts
  - apps/web/src/router/index.ts
  - apps/web/src/views/CustomsWorkbench.vue
  - apps/web/src/views/DispatchWorkbench.test.ts
  - apps/web/src/views/DispatchWorkbench.vue
  - apps/web/src/views/PlannedWorkbenchView.test.ts
  - apps/web/src/views/PlannedWorkbenchView.vue
  - apps/web/src/views/WorkbenchNetworkView.test.ts
  - apps/web/src/views/WorkbenchNetworkView.vue
  - doc/cross-border-supply-chain/05-shipment-lifecycle-blueprint.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/09-customs-compliance-ai.md
  - doc/cross-border-supply-chain/13-dcsa-business-map.md
  - docs/INDEX.md
  - docs/README.md
  - docs/planning/tasks/_template.md
  - docs/planning/tasks/workbench-shared-control-plane-v1.md
  - docs/product/POST_DEPARTURE_WORKBENCH_DELIVERY_BASELINE.md
  - docs/product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md
  - docs/product/WORKSPACE_UI_INVENTORY.md
  - docs/product/domain/SHIPMENT_FLOW_OVERVIEW.md
  - docs/superpowers/plans/2026-10-03-gc012-g0-catalog.md
  - docs/superpowers/plans/2026-10-03-gc012-g1-contract.md
  - docs/superpowers/plans/2026-10-03-gc012-g2-market-selection.md
  - docs/superpowers/plans/2026-10-03-gc012-g3-selection-npi.md
  - docs/superpowers/plans/2026-10-03-gc012-rollout.md
  - docs/superpowers/specs/2026-10-03-gc12.md
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
exclusiveLocks:
  - business-policy:gc012-workbench-catalog
  - repository-governance
  - root-tooling
sharedIntegrationScopes:
  - AGENTS.md
  - docs/INDEX.md
  - docs/planning/tasks/_template.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
authorityRefs:
  - AGENTS.md
  - docs/superpowers/specs/2026-10-03-gc12.md
  - docs/superpowers/plans/2026-10-03-gc012-g0-catalog.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
---

# 任务：GC-012 G0 23 台工作台目录（接手）

## 目标

按已批准的 `docs/superpowers/specs/2026-10-03-gc12.md` 与 G0 计划，把现行 20 台线性目录替换为 23 台权威目录（20 台主链 + 3 台支撑/横切）
和带扇入/扇出的类型化关系图，并加目录漂移防护；不新增 GC-012 契约、Schema、API 或生产交接动作。完成条件以计划“G0 Completion Contract”为准。

## 边界 / 不做

- G0 不建 GC-012 Schema、数据库表、API、回执、责任转移或生产交接动作；新增 3 台只做无业务动作的 `planned` 占位页。
- 成熟度不由路由、页面、API 或 `live` 推断；历史 brief、归档和历史样本计数不改写。
- 本 brief 只接管 G0；G1～G3 计划文件随分支保留，执行时另建 brief。
- 五面映射：岗位任务与界面承接只涉及目录导航和占位页；数据事实、技术保障（除仓库检查器）与权限边界本阶段无新增，由 G1 起逐台承接。

## 接手说明

本工作原由 Claude Code 会话在 `.claude/worktrees/market-signals-slice-a`（分支 `docs/global-cross-workbench-interface-v1`）
按 superpowers 子代理流程推进，未建 task brief，进度记在未纳入版本控制的 `.superpowers/sdd/2026-10-03-gc012-g0-catalog/progress.md`。
该会话实际运行 GPT-5.6；PR #128 生效后，Claude Code 不在角色映射内，不得继续写入。

- 已接收提交：`origin/main...4a0c9370` 共 13 个，另加定案后提交的 `50d6a6bb`（不采信，见 S1），按 `AGENTS.md` §1.2 第 11 条保留原署名，登记为“Claude Code（实际 GPT-5.6），规则生效前写入”。
- 接手基线：新分支 `feat/gc012-g0-catalog-v1` 自 `4a0c9370` 建立，并合并 `origin/main`（`9ede156b`）；原分支与原 worktree 不再写入，由负责人决定清理。
- 进度账本只作参考，其中裁定已转入下方决策记录；账本本身不是权威。
- 原会话在定案后提交了 Task 4 第 3 轮改写 `50d6a6bb`（`scripts/check-repository*`），已合入作为 S1 起点，不直接采信。

## 负责人决策记录

| 日期       | 决定                    | 选项与结论                                                                                                                     | 写回                                                              |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 2026-10-03 | GC-012 设计与 23 台目录 | 负责人已批准设计与实施计划（spec 状态行）                                                                                      | `docs/superpowers/specs/2026-10-03-gc12.md`                       |
| 2026-10-03 | Claude Code 停止时点    | A 现在停止，第 3 轮修复交 Codex 核实收尾（采纳）/ B 做完本轮再停并登记例外                                                     | 本 brief                                                          |
| 2026-10-03 | 既有 20 台成熟度语义    | A 确认：既有 20 台 `pending_assessment` 且成熟度为空，新增 3 台 `assessed` + `planned`；不构成第五种成熟度（采纳）/ B 暂列待定 | `doc/cross-border-supply-chain/08-role-workbenches.md` 与本 brief |

主代理技术裁定（来自原账本，经接手复核后保留）：

- Task 3 写入范围扩至 `apps/web/src/views/DispatchWorkbench.vue` 与其测试：计划要求真实 `/workspaces/dispatch` 路由体现扇入，但遗漏了该组件。
- 样本证据：外部 v0.5 全链路样本只可作 G0/G1 测试夹具与 G2/G3 演练输入，不得提升成熟度或 GC-012 稳定性结论。
- 延后的次要项：Task 2 两项断言加强、Task 3 关系遍历集中化，留待 S3 复审决定是否纳入。

## 执行切片

### 切片 `S0-takeover`

| 项目     | 内容                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------- |
| 基线     | `4a0c9370` 合并 `origin/main`（`9ede156b`）                                                          |
| 执行角色 | 主代理：工具 `Cursor`，实际模型 `Claude Opus`                                                        |
| 复审     | 不适用：仅合并冲突解决与 brief，S3 统一复审                                                          |
| 写入范围 | `AGENTS.md` 冲突解决；本 brief                                                                       |
| 验证命令 | `pnpm repo:check`；`pnpm exec prettier --check AGENTS.md docs/planning/tasks/gc012-g0-catalog-v1.md` |
| 停止条件 | 合并提交完成后停手；Claude Code 确认停止前不进入 S1                                                  |

### 切片 `S1-task4-round3`

| 项目     | 内容                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | 合并 `50d6a6bb` 后的提交（见进度）                                                                                                                                           |
| 执行角色 | 实现执行器：工具 `Codex`，实际模型 `GPT-5.6`                                                                                                                                 |
| 复审     | S3 统一复审（Claude Opus）                                                                                                                                                   |
| 写入范围 | `scripts/check-repository.mjs`、`scripts/check-repository.test.mjs`                                                                                                          |
| 禁止范围 | 其他所有文件；不得改变目录口径、成熟度语义或历史文档排除规则                                                                                                                 |
| 待修问题 | I-01 箭头函数 helper 的返回 kind 回退为 helper 名；I-02 嵌套的无效 `const router` 可遮蔽顶层 router；缺少引号/模板字符串诱饵用例                                             |
| 方案     | 改用现有 TypeScript 依赖的编译器 AST 检查顶层声明与实际导出初始化表达式，替代自写正则解析；先补能复现 I-01、I-02 与诱饵的失败测试                                            |
| 起点     | 原会话 17:39 提交的 `50d6a6bb`（AST 改写）已合入本分支，未经验证、不得直接采信                                                                                               |
| 已知缺陷 | `pnpm repo:check` 抛出 `ReferenceError: execFileSync is not defined`（改写时删掉了导入）；测试文件仅改 8 行，I-01、I-02 与诱饵覆盖不足                                       |
| 验收要求 | 每个问题都要有在 `4a0c9370` 版本上失败、在修复后通过的测试；补一条覆盖 `runRepositoryChecks` 入口的测试，防止同类导入缺失                                                    |
| 验证命令 | `node --test scripts/check-repository.test.mjs`；`pnpm repo:check`；`pnpm exec prettier --check scripts/check-repository.mjs scripts/check-repository.test.mjs`；`pnpm lint` |
| 停止条件 | 测试全绿后 `ready-for-review` 停手，按 `AGENTS.md` §1.3 回交 `HANDOFF`；允许在本分支本地提交，不推送                                                                         |

### 切片 `S2-g0-gates`

| 项目     | 内容                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 执行角色 | 主代理：工具 `Cursor`，实际模型 `Claude Opus`                           |
| 验证命令 | G0 计划 Task 4 Step 4 的全部命令；`pnpm validate`（需 `pnpm infra:up`） |
| 停止条件 | 全部通过后进入 S3；失败则按根因新增修复切片，不放宽门禁                 |

### 切片 `S3-branch-review`

| 项目     | 内容                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| 执行角色 | 独立复审：Cursor fresh 只读会话，实际模型 `Claude Opus`（全部写入者为 GPT 系）        |
| 范围     | `origin/main...HEAD` 全量；重点为 G0 计划 Review Focus 1～5 与 G0 Completion Contract |
| 产出     | `logix-review/v1`，主代理形成 `logix-disposition/v1` 写回本 brief                     |

#### S3 复审处置（`logix-disposition/v1`）

复审基线 `9ede156b`，复审对象 `4bebc6bf`，结论 `approve-with-findings`。

| finding      | 严重度 | 处置       | 理由与写回                                                                                                                                                                                                                              |
| ------------ | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GC012-S3-F01 | major  | `accepted` | 主代理核实 `workbenchRelations` 无 `from: "dispatch"`，`DispatchWorkbench.vue` 不回退旧交接，真实出运页出向显示为“主链责任收口”，与 spec §3.1/§3.2“交海运运营”冲突；由 S5 修复                                                          |
| GC012-S3-F02 | minor  | `accepted` | spec §3.1 只列“至少包括”的新关系，未声明取代旧交接；按 `from`/`to` 合并新关系与旧交接、保留 `supply_readiness → shipment_planning`，不改业务口径；目录卡片显示全部出向或条数；由 S5 修复，同时落实延后的“Task 3 关系遍历集中化”         |
| GC012-S3-F03 | minor  | `accepted` | 08 原文“不新增 route、页面”与 G0 计划及实现的 `planned` 目录占位页矛盾；主代理已在 `doc/cross-border-supply-chain/08-role-workbenches.md` 改为“只新增无业务动作的 `planned` 目录占位 route 与页面，不新增 API 或生产写动作”，属措辞校正 |
| GC012-S3-F04 | minor  | `accepted` | 采用选项 (1) 默认失败：`workbenchStages` 未识别的元素形态、override 对象中的展开或非字面量属性、路由初始化表达式中除 `map` 外的数组变换均须报错；先补能复现 B、C、E、F 四种绕过的失败测试；由 S5 修复                                   |
| GC012-S3-F05 | minor  | `accepted` | 在目录源诱饵用例中恢复字符串与模板字符串诱饵断言，不改检查器；由 S5 修复                                                                                                                                                                |
| GC012-S3-F06 | minor  | `accepted` | 320/375 视口循环扩展到三台目录占位页，并断言 `button`/`form`/`input`/`textarea`/`select` 数量为 0；由 S5 修复                                                                                                                           |
| GC012-S3-F07 | nit    | `accepted` | `DispatchWorkbench.vue` 外层 `<main>` 改为非地标容器；目录缺失 `dispatch` 时不得隐藏真实业务组件；由 S5 与 F01 一并修复                                                                                                                 |
| GC012-S3-F08 | minor  | `accepted` | 本地 E2E 替代运行只作参考；E2E 门禁以 S4 PR CI 的 `test:e2e` 对最终提交通过为权威证据，未通过不合并；不重跑本地 `validate`                                                                                                              |

`next: S5-review-fixes`；S5 改变出运页交接语义与检查器失败策略，回交后由新的 fresh 只读 Claude Opus 复审只针对 S5 增量。

### 切片 `S5-review-fixes`

| 项目     | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 执行角色 | 实现执行器：工具 `Codex`，实际模型 `GPT-5.6`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 复审     | S5 增量复审：Cursor fresh 只读会话，实际模型 `Claude Opus`                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 写入范围 | `apps/web/src/data/workbenchNetwork.ts`、`apps/web/src/data/workbenchNetwork.test.ts`、`apps/web/src/views/DispatchWorkbench.vue`、`apps/web/src/views/DispatchWorkbench.test.ts`、`apps/web/src/views/PlannedWorkbenchView.vue`、`apps/web/src/views/PlannedWorkbenchView.test.ts`、`apps/web/src/views/WorkbenchNetworkView.vue`、`apps/web/src/views/WorkbenchNetworkView.test.ts`、`apps/web/e2e/workbench-network.spec.ts`、`scripts/check-repository.mjs`、`scripts/check-repository.test.mjs` |
| 禁止范围 | 其他所有文件，包括本 brief 与 `doc/`；不得新增或删除 `workbenchRelations` 中的业务关系，不得改变 23 台目录、名称、成熟度或评估状态                                                                                                                                                                                                                                                                                                                                                                   |
| 待修问题 | 见上表 F01、F02、F04、F05、F06、F07 的处置                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 方案     | 在 `workbenchNetwork.ts` 提供唯一的入向/出向交接查询 helper（新关系与旧交接按 `from`/`to` 去重合并），`DispatchWorkbench.vue`、`PlannedWorkbenchView.vue`、`WorkbenchNetworkView.vue` 共用；检查器按 F04 选项 (1) 默认失败                                                                                                                                                                                                                                                                           |
| 验收要求 | 先写失败测试：出运出向包含交给 `ocean_operations` 的 `shipment_handoff`；`supply_readiness` 出向包含 `shipment_planning`；多出向卡片显示全部或条数；B、C、E、F 四种绕过各自报错；目录源字符串/模板诱饵仍报缺失；三台占位页 320/375 无控件；渲染后 DOM 只有一个 `main`                                                                                                                                                                                                                                |
| 验证命令 | `node --test scripts/check-repository.test.mjs`；`pnpm repo:check`；`pnpm --filter @logix/web test`；`pnpm --filter @logix/web lint`；`pnpm --filter @logix/web typecheck`；`pnpm --filter @logix/web exec playwright test e2e/workbench-network.spec.ts`（5173/5174 被占用时报告 `blocked`，不得终止他人进程）；`pnpm exec prettier --check` 本切片文件；`git diff --check`                                                                                                                         |
| 停止条件 | 全部通过后 `ready-for-review` 停手，按 `AGENTS.md` §1.3 回交 `HANDOFF`；允许在本分支本地提交，不推送                                                                                                                                                                                                                                                                                                                                                                                                 |
| 返工 R2  | 第 1 次回交未通过：`inspectWorkbenchRouteSource` 只拦截作用于 `catalogStubWorkbenchStages` 的变换，主代理实测 `...frameworkWorkbenchStages.filter((s) => s.code !== "booking")` 仍返回 `[]`。须使路由初始化表达式中作用于 `frameworkWorkbenchStages` 或 `catalogStubWorkbenchStages` 的任何非 `map` 数组变换都报错，并补该用例与 `catalogStubWorkbenchStages.slice(0, 1)` 用例；仅改 `scripts/check-repository.mjs`、`scripts/check-repository.test.mjs`，保留第 1 次回交的其余未提交差异            |

### 切片 `S4-pr`

S5 及其增量复审通过后执行：推送 `feat/gc012-g0-catalog-v1`、建 PR、跑 CI；合并须负责人授权。

## 进度

- 2026-10-03：负责人定案 1A、2A；主代理建立接手分支与 worktree，合并 `origin/main` 并解决 `AGENTS.md` 冲突（保留 23 台与新角色名）。
- 2026-10-03：原 Claude Code 会话在定案后于 17:39 提交 `50d6a6bb`（Task 4 第 3 轮 AST 改写），晚于新规则生效；为保留历史，已合入本分支作为 S1 起点，不采信。
- 2026-10-03：合入后检查器测试 53/53 通过，但 `pnpm repo:check` 因缺少 `execFileSync` 导入失败；分支当前为红，由 S1 修复。S1 须在负责人确认原会话已停止后下发。
- 2026-10-03 17:48：负责人确认 Claude Code 会话已停止；主代理核对原 worktree 自 17:39:59 起无新提交与文件写入，原分支止于 `50d6a6bb`。S1 下发给 Codex。
- 2026-10-03：S1 `ready-for-review` 回交；主代理复现 RED（`4a0c9370` 失败 3 项、`50d6a6bb` 失败 2 项）与 GREEN（56/56），验收并提交 `7f69174d`。`50d6a6bb` 新增的目录源文件字符串/模板诱饵用例在 S1 中被移除，列入 S3 复审重点。
- 2026-10-03 19:40～19:48：S2 于 `7f69174d` 完成。G0 计划 Task 4 Step 4：检查器测试 56/56、`docs:check`、`repo:check`、web 单测 636/636、web lint、web typecheck、web E2E 157 通过/7 按视口条件跳过、web build、`format:check`、`git diff --check` 全部通过。`pnpm validate`（`DATABASE_URL` 指向 `.env.example` 的本地 5433 库，`AUTH_MODE=development`）中 `repo:check`、`contract:check`、`contract:drift`、`data-dictionary:check`、`db:generate`、lint、`format:check`、typecheck、test（api 1425/1425、web 636/636）、`test:integration`（153/153）通过；其 E2E 阶段因负责人 19:42 启动的 `dev:all` 占用 5173 触发 `E2E_DEV_SERVER_CONFLICT`，未终止该进程，E2E 采用同一提交上 19:42 独立运行的同一套件结果；根 `pnpm build` 补跑通过。S2 通过，进入 S3。
- 2026-10-03 20:12：S3 由 fresh 只读 Claude Opus 子代理复审 `4bebc6bf`，结论 `approve-with-findings`（1 major、6 minor、1 nit，`writes: none`，复审后工作树无已跟踪变化）；writeScopes 与 37 个差异文件双向一致，无生成物或密钥。主代理核实 F01、F02 后全部 `accepted`，F03 已写回 08，其余进入 S5；E2E 门禁以 S4 PR CI 为准（F08）。
- 2026-10-03 20:48：S5 第 1 次回交（未提交差异，11 个文件均在写入范围内）。主代理复跑检查器测试 61/61、`repo:check`、web 单测 639/639、web typecheck 均通过；F01、F02、F03、F05、F06、F07 落实，F04 对正式工作台路由数组的 `.filter` 仍静默通过，退回 S5 返工 R2。
