---
status: review
branch: docs/agent-role-mapping-v1
owner: main
writer: cursor
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/agent-role-mapping-v1.md
  - AGENTS.md
  - ENGINEERING_RULES.md
  - CLAUDE.md
  - docs/planning/tasks/_template.md
exclusiveLocks:
  - repository-governance
sharedIntegrationScopes:
  - AGENTS.md
  - docs/planning/tasks/_template.md
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - scripts/check-repository.mjs
---

# 任务：代理角色映射改为按角色约束

## 目标

把 `AGENTS.md` 的代理分工从“按工具名约束”改为“按角色约束”，用一张角色映射表登记每个角色的工具与实际运行模型，
并按负责人 2026-10-03 定案的映射生效。消除“规则写 Claude、实际经转发运行 GPT-5.6”造成的复审独立性与留痕失真。

## 边界 / 不做

- 不改变任何角色的职责、写入边界、指令链、单写入者、WIP 上限、锁与复审触发条件；只替换承担者名称并新增映射表。
- 不修改 `scripts/check-repository.mjs`：`owner` / `writer` 已是自由的小写稳定编码，同一 `writer` 互斥的现有校验继续有效。
- 不追溯改写历史 brief、进度日志和提交中的 `claude` / `cursor` / `codex` 署名与 frontmatter（`AGENTS.md` §1.2 第 11 条）。
- 不改业务权威、工作台定义或“20/23 台”口径。

## 负责人决策记录

| 日期       | 决定                       | 选项与结论                                                                                          | 写回                     |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| 2026-10-03 | 事实：Claude Code 实际模型 | 负责人确认 Claude Code 经映射转发，实际挂载 GPT-5.6                                                 | `AGENTS.md` §1.2 第 4 条 |
| 2026-10-03 | 规则约束方式               | A 按角色约束并登记实际模型（采纳）/ B 直接互换工具名 / C 维持现状仅改模型配置                       | `AGENTS.md` §1.2 第 4 条 |
| 2026-10-03 | 角色映射                   | 主代理 Cursor + Claude Opus；实现执行器 Codex + GPT-5.6；独立复审 Cursor 独立只读会话 + Claude Opus | `AGENTS.md` §1.2 第 4 条 |
| 2026-10-03 | 智慧开启决策顾问           | 候选：Codex 独立只读会话 / 主代理兼任 / 第三方模型；负责人改定为 Cursor 独立只读会话 + GPT-5.6      | `AGENTS.md` §1.2 第 4 条 |
| 2026-10-03 | 写入授权                   | 授权在独立 worktree 与分支修改并本地提交；不推送、不建 PR，交负责人审阅                             | 本 brief                 |

## 执行切片

### 切片 `S1-role-mapping`

| 项目     | 内容                                                                |
| -------- | ------------------------------------------------------------------- |
| 基线     | `d7046ab6`（`origin/main`）                                         |
| 执行角色 | 主代理直接写入治理权威：工具 `Cursor`，实际模型 `Claude Opus`       |
| 复审     | 待定：独立复审（Cursor 独立只读会话 + Claude Opus）或负责人直接审阅 |
| 写入范围 | 见 frontmatter `writeScopes`                                        |
| 禁止范围 | 角色职责、指令链、锁与 WIP 规则的语义；`scripts/**`；历史 brief     |
| 验证命令 | `pnpm repo:check`；`pnpm exec prettier --check` 本切片触及文件      |
| 停止条件 | 本地提交后停手，等待负责人审阅；不推送、不建 PR                     |

改动要点：

1. `AGENTS.md` §1.2 第 4 条改为角色映射表（主代理、实现执行器、独立复审、决策顾问），并规定：独立复审与实现执行器不同模型家族；独立复审和决策顾问不得与主代理或实现执行器共用会话；经转发挂载的工具按实际模型登记。
2. `AGENTS.md` 第 1～2 节中作为角色出现的 Claude / Cursor / Codex / fresh 只读 Claude reviewer 依次改为主代理 / 实现执行器 / 决策顾问 / 独立复审；`TASK` 的 `role` 取值改为 `implementer|reviewer`，`HANDOFF` 的 `role` 改为 `main`。
3. `ENGINEERING_RULES.md` 中“最终 PR 集成与合并仍由 Codex 排队执行”与现行规则早已不符，改为由主代理执行。
4. `_template.md` 同步角色称呼与指令取值，默认 `owner: main`、`writer: codex`，切片表登记执行角色与复审的工具和实际模型。
5. `CLAUDE.md` 改为指向角色映射，不再暗示 Claude Code 承担特定角色。

## 集成注意

- 未合并分支 `docs/global-cross-workbench-interface-v1`（`bc95f0bb`）把 `AGENTS.md` 第 1 节第 9 条、§1.2.1 第 2 项和 `_template.md`
  “20 台”标题改为“23 台”，与本切片改动的第 10 条、§1.2.1 第 1 项相邻。后合并者同步最新 `main` 后人工合并文本，两处语义互不冲突。
- 已在途但 `blocked` 的 brief 仍写 `owner: claude` / `writer: cursor`，按历史署名保留；恢复为 `coding` 时再按新映射更新。

## 未知项

- Codex 是否原生读取 `.agents/skills/` 与 `.claude/skills/` 下的仓库技能未核实，首个 Codex 实现切片须作为试点确认。
- Claude Code 的转发配置由负责人陈述，本仓库无法核验；若其映射变化，只改 §1.2 第 4 条。

## 进度

- 2026-10-03：S1 完成修改与本地验证，见本切片提交；状态 `review`，等待负责人审阅。
