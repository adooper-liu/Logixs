---
status: coding
branch: docs/transparent-development-calibration-v1
owner: main
writer: main
risk: high
dependsOn:
  - universal-workbench-layout-standard-v1
writeScopes:
  - docs/planning/tasks/transparent-development-calibration-v1.md
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
  - docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md
  - docs/superpowers/plans/2026-10-11-transparent-development-calibration.md
  - scripts/task-brief-state.mjs
  - scripts/task-brief-state.test.mjs
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
  - scripts/check-ui-structure-gate.mjs
  - scripts/check-ui-structure-gate.test.mjs
  - scripts/build-progress-board.mjs
  - scripts/build-progress-board.test.mjs
  - scripts/progress-board.template.html
  - docs/planning/progress-board.html
  - package.json
  - .github/workflows/ci.yml
exclusiveLocks:
  - repository-governance
  - root-tooling
  - task-brief-contract
  - progress-board
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/_template.md
  - docs/planning/RAID.md
  - docs/planning/PROJECT_BOOTSTRAP_CHECKLIST.md
  - docs/planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md
---

# 任务：透明开发校准 V1

> 本 brief 是当前单元唯一的实施载体。设计权威为
> `docs/superpowers/specs/2026-10-11-transparent-development-calibration-design.md`。
> progress board、校准投影和 CI 输出均为派生事实，不建立第二套需求、状态或任务数据库。

## 路线图位置与目标结果

- **位置**：仓库治理基础设施；承接 UI 单元合并后的“透明校准 → 可视化纵向薄片 → brief 全链对账 → 自动门禁”主线。
- **目标用户**：维护唯一 task brief、控制范围、组织复审和完成 Git/CI/PR 集成的主代理，以及核对当前交付现场的评审者。
- **核心结果**：同一个只读投影同时回答“brief 声明了什么、当前 checkout 实际发生了什么、两者哪里冲突、下一道门禁是什么”，并驱动 progress board 与 CI static gate。
- **优先减少的损失**：减少错误分支写入、diff 越过 `writeScopes`、缺失权威引用、未完成依赖、重复 parser 漂移、看板与门禁口径不一致，以及视觉完成感掩盖真实缺口。
- **主线关系**：本片只校准当前 checkout；跨 worktree、远端 PR/CI 对账和自动调度留待后续独立切片。

## 已证实事实

1. `AGENTS.md` 已定义唯一需求事实链、task brief 调度字段、WIP/锁/依赖规则、UI 强制结构和交付集成顺序。
2. `scripts/check-repository.mjs` 能校验当前 checkout 可见 brief 的状态、写域、锁、依赖与 UI 元数据，但不对账实际 Git diff 或其他 worktree。
3. `scripts/check-ui-structure-gate.mjs` 与 `scripts/build-progress-board.mjs` 各自维护能力不同的 frontmatter parser，已经形成同一 brief 的三种解释。
4. `scripts/build-progress-board.mjs` 生成并提交 `docs/planning/progress-board.html`，但没有稳定 `--check`，只读取 `status / branch / verification`，且混有手工维护判断。
5. 当前无 task brief JSON Schema、无归一化 task-state 模型、无当前分支/merge-base/changed-path 对账、无 progress board 校准投影。
6. 仓库已有成熟的 deterministic manifest/check/receipt 先例，但它们服务业务样本与 Demo 数据，不是开发任务状态权威。
7. 本分支在建立本 brief 前已完成 UI brief 合并事实收口；`docs/planning/tasks/universal-workbench-layout-standard-v1.md` 因而显式列入本任务写域和 branch diff 解释范围。

## 已批准设计

负责人于 2026-10-11 选择方案 A：

- 建立一个共享、只读、确定性的 task brief parser 与 calibration projection；
- task brief 继续是唯一实施载体，不新增可编辑 JSON/YAML、数据库或运行状态目录；
- 当前 checkout 的分支、base、committed/staged/unstaged/untracked 路径与 brief 声明分轨对账；
- progress board 新增“当前交付薄片”派生视图，并与自动门禁消费同一投影；
- CI static job 运行非写入校准检查；
- 第一片明确延期跨 worktree、GitHub PR/CI API、RAID 迁移、自动代理调度和生产 Web dashboard。

## 本片不做

- 不扫描或修改其他注册 worktree；
- 不调用 GitHub API 证明 PR/CI/merge 状态；
- 不把 RAID 或 bootstrap checklist 迁移成新 schema；
- 不新增每个 slice 的可写状态文件；
- 不自动创建分支/worktree、派发代理、提交、推送或合并；
- 不追溯修复所有历史 brief 的 checkbox、旧模型名或旧字段；
- 不建立 `apps/web` 生产页面；
- 不把绿色看板解释为业务闭环、部署完成或负责人验收。

## 直接消费者与使用场景

本任务不是业务/UI 功能，不适用工作台五面和 WB-B01～WB-B10。直接消费者如下：

| 消费者                             | 使用场景                           | 本片结果                                            |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------- |
| 主代理                             | 开始、复审、集成前核对当前任务现场 | 一份声明/观察/冲突/下一门禁投影                     |
| `repo:check` / `calibration:check` | 本地和 CI fail-closed 门禁         | 稳定 finding ID、退出码和证据路径                   |
| UI 写入 hook                       | Vue 写入前识别唯一活动 owner       | 与 repository gate 共用同一 parser                  |
| progress board                     | 人工查看当前纵向薄片               | 明确标记为派生视图，不可编辑                        |
| 独立复审者                         | 核对范围、证据与未知项             | 可追溯 base/head、scope、authority、dependency 事实 |

## 执行切片

### 切片 `TDC1-shared-parser-and-projection`

| 项目     | 内容                                                                        |
| -------- | --------------------------------------------------------------------------- |
| 基线     | `9811780c`                                                                  |
| 执行角色 | 当前 Claude Code 主代理直接实现；实际模型按 `AGENTS.md` §1.2 第 4 条登记    |
| 复审     | 共享解析契约、Git 差异归属和 fail-closed 行为进入最终 fresh Claude 整体复审 |
| 写入范围 | 本 brief/spec；`task-brief-state`；repository/UI gate parser 迁移；对应测试 |
| 禁止范围 | progress board 视觉实现、CI、跨 worktree、远端 API、历史 brief 批改         |
| 验证命令 | parser/reconciler RED→GREEN；repository/UI gate 回归；lint/format           |
| 停止条件 | 三个消费者共用一个 parser；现有校验语义不回退；投影可注入 Git 观察 fixture  |

### 切片 `TDC2-current-checkout-gate`

| 项目     | 内容                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| 基线     | `TDC1` 验收后的当前 SHA                                                                                     |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                                             |
| 复审     | 主代理验收；最终整体复审覆盖 fail-closed 和用户工作保护                                                     |
| 写入范围 | `task-brief-state`、CLI/tests、`check-repository`、`package.json`                                           |
| 禁止范围 | board、CI workflow、其他 worktree、GitHub API                                                               |
| 验证命令 | branch/base/diff/scope/authority/dependency/unknown-path fixtures；真实本分支 dry-run                       |
| 停止条件 | `calibration:check` 不写文件；稳定区分 task-owned、blocking foreign tracked、non-blocking unowned untracked |

### 切片 `TDC3-visual-vertical-slice`

| 项目     | 内容                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 基线     | `TDC2` 验收后的当前 SHA                                                             |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                     |
| 复审     | 主代理检查桌面/手机、亮/暗主题和信息真实性；最终整体复审核对派生边界                |
| 写入范围 | progress board builder/template/test/generated HTML                                 |
| 禁止范围 | `apps/web`、第二套状态、手工复制 finding、修改业务工作台                            |
| 验证命令 | deterministic projection/render tests；`board:build`；`board:check`；浏览器人工核对 |
| 停止条件 | 看板显示声明→现场→门禁链；computed/editorial/unknown 三类信息分轨；无横向溢出       |

### 切片 `TDC4-static-ci-gate`

| 项目     | 内容                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 基线     | `TDC3` 验收后的当前 SHA                                                             |
| 执行角色 | 当前 Claude Code 主代理直接实现                                                     |
| 复审     | 高风险任务完成后由 fresh Claude Code 只读会话做一次整体复审                         |
| 写入范围 | `package.json`、`.github/workflows/ci.yml`、brief 验证证据                          |
| 禁止范围 | 新 CI service、integration/security job 扩建、部署或 GitHub 设置                    |
| 验证命令 | YAML/脚本测试；本地 static 等价命令；最终 PR CI                                     |
| 停止条件 | CI static 始终执行 read-only calibration/board checks；finding 已裁决；完整门禁通过 |

## 负责人决策记录

| 决策 ID | 已知事实与未知                                                                   | 选项、成本/收益/风险/可逆性                                                                                              | 推荐与理由                                      | 负责人结论 | 权威落点 / 状态                    |
| ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------- | ---------------------------------- |
| TDC-D01 | 现有治理完整但 parser、diff 对账、board 与 gate 分裂；跨 worktree/远端状态未接通 | A 共享只读投影；B 只做 board；C 直接跨 worktree 编排。A 中等改动、立即贯通四项能力；B 无阻断；C 范围过厚且旧角色模型冲突 | A：保留唯一 brief，同时形成第一条可回滚纵向薄片 | 批准方案 A | 本 brief 与 design spec / approved |

## 验收

- [ ] `task-brief-state` 是 repository gate、UI hook、progress board 唯一 parser/normalizer
- [ ] parser 对当前受支持 frontmatter 子集给出稳定值和带路径/行号的错误，不静默吞掉畸形字段
- [ ] 显式 `--brief` 可校准指定任务；无显式参数时按实际 branch 唯一匹配活动 brief
- [ ] 本地使用 merge-base，CI 使用传入 base SHA；投影显示 base 来源且不静默猜 stacked branch
- [ ] committed/staged/unstaged tracked 越出 `writeScopes` 会阻断
- [ ] `writeScopes` 内 untracked 计入 task-owned；范围外 untracked 只列为 unowned，不归责、不删除
- [ ] `authorityRefs` 缺失、未完成依赖、branch mismatch、done 无 verification 保持 fail-closed
- [ ] 修改的 authority ref 若不在 `writeScopes`，形成稳定阻断 finding
- [ ] 历史 `done/blocked` brief 不因新 parser 被无差别追溯失败
- [ ] progress board 以同一投影显示当前 task、authority、diff、dependency、checks、review/integration unknown 和下一 gate
- [ ] board 明确区分 computed fact、editorial judgment、unknown/not-observed
- [ ] `calibration:check` / `board:check` 都是只读命令，生成命令才允许写 HTML
- [ ] CI static job 运行只读 checks，失败输出稳定 finding 与修复入口
- [ ] 当前分支的既有 `.claude/worktrees/`、`.tmp/`、`apps/api/.tmp/` 只作为 unowned/untracked 现场报告，不进入当前任务提交
- [ ] 定向测试、repository tests、格式、lint、typecheck、board 视觉核对和最终 CI 通过
- [ ] fresh Claude 整体复审 finding 全部裁决

## 进度 log

| 日期       | 阶段   | 负责        | commit   | 说明                                                                                         |
| ---------- | ------ | ----------- | -------- | -------------------------------------------------------------------------------------------- |
| 2026-10-11 | design | Claude Code | —        | 负责人批准方案 A；建立唯一 brief，第一片限定当前 checkout 的共享只读校准投影                 |
| 2026-10-11 | coding | Claude Code | 5deb703b | 负责人批准 Native 执行；第一薄片从共享 parser 与 scope authority 开始，board/CI 留待后续计划 |
