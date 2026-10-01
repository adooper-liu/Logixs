---
status: blocked
branch: feat/thin-agent-orchestrator-v1
verification: not-run（仅完成方向定案与实施切片；有界并行治理尚未合并，外部代理入口尚未完成能力探测）
owner: claude
---

# 任务：多代理薄编排器 V1

## 目标

在不新增业务权威、不复制 task brief、不自动合并代码的前提下，为 Codex、Cursor 和 Claude 提供本地薄编排能力：
核验准确基线、创建隔离 worktree、生成统一 `TASK` 指令、校验文件范围、执行定向门禁并验证既有交接信封。

编排器只减少机械操作，不替代 Codex 定案、Claude 独立评审、Cursor 实现边界、CI 或负责人验收。

## 当前状态与解阻条件

本任务与当前治理检查器、根工具入口存在冲突，且外部代理可编程入口尚未证实，因此保持 `blocked`。
同时满足以下条件后才可转为 `coding`：

1. 有界并行治理合入主线，且本任务与在途任务的 writer、写入范围、独占锁和依赖无冲突。
2. Codex 以准确 base SHA 补齐切片 A 的 `TASK` 指令。
3. Cursor 与 Claude 的可编程入口分别完成本机能力探测；未证实的命令参数不得进入实现。
4. 首版仍以 `manual` 适配器为默认，任何外部进程适配器必须独立启用并失败关闭。

## 权威与既有能力

- 角色、单写入者、复审触发点和一次最终门禁以 `AGENTS.md` §1.2 为准。
- 输入与输出只使用 `AGENTS.md` §1.3 和 `_template.md` 已定义的 `TASK`、`logix-handoff/v1`、
  `logix-review/v1`、`logix-disposition/v1`。
- task brief frontmatter、Git commit/PR 和 CI 是长期状态来源；编排器运行态不是任务进度。
- 当前仓库使用 Windows、PowerShell、Node.js 与 pnpm；worktree 固定落在已忽略的 `.worktrees/`。
- 当前本机 Cursor 桌面 CLI 未证实支持 `--headless`、`--prompt`、`--allowed-files` 或 `--denied-files`；
  Claude 可编程入口也未在仓库中配置。V1 不得假装这些接口存在。

## 已定方向

采用“薄编排器”，拒绝把附件中的示例 Bash 直接入库：

1. 调度状态、WIP 上限和冲突判定只引用 `AGENTS.md` §1.2 第 17～23 条，不在编排器内另立政策。
2. V1 补足 `repo:check` 尚不具备的跨 worktree 盘点和实际 Git diff 范围校验；`repo:check` 继续只检查当前 checkout 的 brief 声明。
3. 公共契约、Schema、迁移、安全政策、对象范围、状态机和共享文件按权威规则占锁，串行冻结后再供下游消费。
4. 同一切片只有一个写入者；Claude 默认只读，Cursor 不接收 Claude 指令。
5. 同一 task 的切片默认进入一个任务集成分支和一个最终 PR，不为每片创建 PR。
6. 不使用 `.done` 文件代表完成；完成必须由进程结果、合法信封、范围检查和指定门禁共同证明。
7. 不建立 `.agent/signals`、`.agent/reviews` 或长期运行报告目录。

## V1 运行模型

```text
task brief + slice anchor + exact base SHA
  -> Codex 生成临时 run spec
  -> runner 校验 brief/base/workspace/scope
  -> manual adapter 输出单行 TASK
  -> Cursor 或 Claude 在指定 worktree 执行
  -> runner 接收并校验既有 handoff/review 信封
  -> git diff 范围检查 + brief 指定定向门禁
  -> Codex disposition / 集成 / 最终门禁 / 单一 PR
```

临时运行态放在 `tmp/agent-runs/<run-id>/`，至少记录：

- `runId`、brief 路径与内容摘要、slice ID、role、base SHA、workspace；
- 允许和禁止的精确路径、只读/写入模式、依赖切片；
- 子进程 PID、开始/结束时间、退出码、超时和取消原因；
- 信封校验结果、实际差异文件、检查命令及结果。

该目录已被 Git 忽略，可以删除和重建。任何内容都不得反向改变 brief 状态，也不得作为 `done` 的唯一证据。

## 安全与正确性约束

- runner 使用 Node.js 脚本和参数数组启动进程，不拼接未经校验的 shell 命令。
- base 必须是完整 commit SHA；SHA 不存在、不是预期集成基线或 worktree 不可读时立即 `blocked`。
- 写入范围同时检查已跟踪差异和未跟踪文件；越界后停止，不自动回退或删除代理改动。
- 同一路径不能分配给两个并行写切片；父目录和子目录重叠也视为冲突。
- 有 `consumes/provides` 依赖的切片按有向无环图串行解锁；不能用“先从 main 开分支”绕过依赖。
- 定向命令来自 brief 的当前切片，不使用 `--passWithNoTests`，不以全量 typecheck 替代真正的范围检查。
- 超时、进程崩溃、非法信封、基线漂移、范围越界和检查失败均产生明确失败结果；不得无限轮询。
- 编排器不提交、不推送、不创建或合并 PR；这些仍由 Codex 按仓库持续 Git 授权统一执行。
- Claude finding 必须先经过 `logix-disposition/v1`；不存在按 severity 自动修改代码的通道。

## 边界 / 不做

- 不建设通用工作流平台、消息队列、Web 控制台或长期任务数据库。
- 不复制业务规则、brief 正文、Git diff 或评审正文到新的 YAML 清单。
- 不创建按执行切片命名的 `contracts/slice-*.api.ts`；公共契约继续进入既有正式包或模块公开 Port。
- 不自动操纵 Cursor/Claude GUI，不抓取其窗口内容，不保存登录凭据。
- 不自动 rebase、cherry-pick、提交、强推、删除 worktree 或合并 PR。
- 不改变 `authz-default-deny-v1` 的代码、状态、切片或验证安排。

## 执行切片与代理交接

### A：核心 runner 与失败关闭测试

| 项目     | 内容                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 执行角色 | Cursor                                                                                   |
| 写入范围 | `scripts/agent-orchestrator.mjs`、对应 Node 测试、必要的 `package.json` 脚本             |
| 禁止范围 | 业务代码、数据库、公共契约、AGENTS 规则、外部代理自动调用                                |
| 验证命令 | Node 定向测试、脚本 lint、`pnpm repo:check`、`pnpm format:check`、`git diff --check`     |
| 停止条件 | 准确基线、临时 run spec、路径冲突、超时、非法信封和失败结果测试通过后 `ready-for-review` |

### B：manual adapter 与两个只读试点

| 项目     | 内容                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| 执行角色 | Codex 编排；Cursor/Claude 只读参与                                                   |
| 写入范围 | 仅 runner 测试/修复；试点代理不得写仓库文件                                          |
| 禁止范围 | 不启用外部进程适配器，不修改业务实现，不生成长期 signals/reviews 文件                |
| 试点 1   | Cursor 只读核对冻结 worktree 的实际差异文件是否落在指定范围，返回 `logix-handoff/v1` |
| 试点 2   | Claude 只读核对同一冻结候选的风险与验证缺口，返回 `logix-review/v1`                  |
| 停止条件 | 两个任务并行运行、互不写入；runId 隔离、超时、信封和结果汇总均有证据                 |

### C：可选外部进程适配器

只有某一工具的正式 CLI/API、非交互认证、退出码、超时、中断和结构化输出在本机逐项验真后，才为该工具新增
独立适配器。一个适配器可上线不代表另一个适配器已经可用；GUI 启动命令不视为 Agent API。

## 验收

- [ ] 不存在第二套任务状态、handoff 目录或长期 review 文件。
- [ ] wrong base、缺失 brief/slice、不可读 workspace 和 brief 摘要漂移全部失败关闭。
- [ ] 已跟踪、已暂存和未跟踪文件均进入范围检查；目录重叠并发被拒绝。
- [ ] stale run、进程失败、超时、取消和非法信封不会产生“已完成”。
- [ ] `logix-handoff/v1`、`logix-review/v1` 和 `logix-disposition/v1` 沿用现有字段，无第四种协议。
- [ ] 写任务 WIP 上限为 2；两个只读试点可并行，写切片并发必须有不同 writer、不相交范围/锁和已完成依赖证据。
- [ ] 每片只运行 brief 指定的最近门禁；最终完整门禁仍由 Codex 在任务 PR 候选统一运行一次。
- [ ] runner 不执行提交、推送、rebase、合并或 worktree 删除。
- [ ] Windows 路径、空格、中文路径和中断恢复测试通过。
- [ ] 外部工具未验证时仍可通过 manual adapter 完成交接，不阻断当前项目推进。

## 决策记录

| 决策 ID    | 已知事实与选项                                              | 推荐与理由                                                       | 负责人结论 | 状态     |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ---------- | -------- |
| `ORCH-D01` | A 直接采用附件 Bash；B 保留思想并重写薄编排器；C 维持全人工 | B；复用现有 brief/信封，避免未验证 CLI、第三套状态和自动合并风险 | 采用 B     | approved |

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                |
| ---------- | ------ | ----- | ------ | ----------------------------------------------------------------------------------- |
| 2026-10-01 | design | Codex | —      | 负责人确认薄编排器方向；当前保持 blocked，等待治理合入与代理入口能力探测            |
| 2026-10-01 | design | Codex | —      | 调整为有界并行：最多两个 `coding/fix`、写入型 design 同样参与冲突检查、最终集成串行 |
