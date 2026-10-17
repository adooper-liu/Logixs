# 跨对话只读续线门 V1 · 设计

> 状态：负责人已批准方向；批判求真后采用最小无状态方案 · 2026-10-16
>
> 一句话：复用唯一 task brief 与本地 Git/worktree 事实，在 SessionStart 时注入目标相关的紧凑续线快照；普通会话静默，冲突只保护受影响范围。

## 1. 问题

仓库已分别具备当前 checkout 校准、跨 worktree 校准、续线提示词和当前会话续做能力，但新会话仍需模型自行想起并拼接它们，容易漏检工作区、误用全局 blocking、把 no-task 当错误或在压缩后继续使用旧上下文。

成功问题：

> 新 Claude 对话或 compact 后，能否在不依赖旧聊天、不创建第二状态、不触网、不写仓库的前提下，自动获得当前工作区、唯一任务候选、相关保护边界和下一门禁；普通无续线场景不被打扰？

## 2. 已有事实源

- task brief：持久任务状态、范围、锁、依赖、权威和证据。
- Git checkout：branch、HEAD、committed/staged/unstaged/untracked。
- Git worktree registry：已注册 checkout 与路径级 dirty 事实。
- TASK/HANDOFF：跨 Claude/Codex 的单次消息指针，不是长期状态。
- PR/CI：只在显式续线或集成阶段按需查询；自动 Hook 不触网。
- progress board：派生人类视图，不作为续线权威。

## 3. 关键否决

### 3.1 不增加动态断点字段

不增加 `currentSlice`、`nextActor`、`nextAction`、`lastVerifiedHead`：

- slice 已由 `brief#slice` 的 TASK/HANDOFF 表达；
- actor 由当前协议阶段决定；
- next action 依赖最新证据，不能持久化为另一个状态；
- 把 verified HEAD 写回 brief 会生成新 HEAD，天然自失效。

### 3.2 不复用全局 CLI 退出码作为 Hook verdict

- no active brief 在显式校准中可 fail-closed，但在普通 clean main 新会话中是合法 idle；
- unowned dirty worktree 在仓库级校准中 blocking，但对不重叠的目标任务只应保护和提示；
- blocked brief 不计 active write task，却可能是明确的续线重评目标。

### 3.3 不使用不受支持的 Hook 注入路径

- 使用 `SessionStart` matcher `startup|resume|clear|compact`；
- 不用 `PostCompact` 或 `CwdChanged` 注入 continuation context；
- Hook 不能阻止 session 生命周期，失败必须开放并提醒模型做常规核对。

## 4. 两轴模型

### Action

- `idle`：无续线意图，且无唯一分支匹配任务；静默。
- `resume`：当前 branch/worktree 唯一匹配活动 brief。
- `review-handoff`：当前 prompt/transcript 保留合法 HANDOFF header。
- `select`：明确续线意图但目标缺失、多候选或不匹配。

### Safety

- `clear`：选中动作无目标相关冲突。
- `protect-read-only`：其他 dirty worktree 或当前 checkout 的 unowned untracked 路径与目标 writeScopes 重叠；可只读核对，不得写重叠路径。
- `block-target`：目标不可复现，HANDOFF 协议非法，writeScopes 非法，当前 checkout 有 out-of-scope tracked，或存在 branch/workspace/依赖矛盾。

其他 dormant-ahead、behind、detached、非重叠 untracked/dirty worktree进入 advisories，不改变目标 safety。

## 5. 目标解析

1. 当前消息显式 `docs/planning/tasks/<brief>.md#<slice>`；
2. 当前消息或恢复 transcript 中字段完整的 HANDOFF header；
3. 当前 branch/worktree 唯一匹配 `design|coding|fix|review` brief；
4. 明确续线意图下，加入 `blocked` brief 作为只读重评候选，输出 `select/protect-read-only`，不输出可写 `resume/clear`；
5. 零或多候选时 `select`，不猜测。

HANDOFF 必须包含 `task/slice/base/role/workspace/commit` 且 `role=main`。字段存在后仍须消费只读 Git adapter 提供的 identity observation：base 与 commit（若非 `none`）可解析、base 是观察 HEAD 的祖先、差异可由 base 与当前 committed/staged/unstaged 现场复现；commit 为 SHA 时必须等于观察 HEAD，`commit=none` 表示未提交差异。`base` 可早于当前 HEAD，不能简单要求 `base === HEAD`；任一观察未知或矛盾都 `block-target`。

普通 startup 无续线意图且零候选时 `idle/clear`。

## 6. 自动注入

`SessionStart` command hook：

- matcher：`startup|resume|clear|compact`
- exec：`node <project>/.claude/hooks/continuation-gateway.mjs`
- stdin：使用事件 `cwd` 识别实际 checkout
- timeout：5 秒
- 网络：禁止
- stdout：唯一 JSON object

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<2–4KB local derived snapshot>"
  }
}
```

`idle/clear` 时不输出 additionalContext。读取失败时 exit 0，并注入简短 fallback：续线快照不可用，写入前执行常规仓库核对。

## 7. 与现有 Skills 的关系

- `/continue-work`：显式续做，消费投影并输出完整接管回执后实施。
- `/continuation`：只生成新会话提示词，消费投影但不实施。
- `/drift-check`：只读展开业务主线和完整 advisory。
- Hook：只提供紧凑本地事实提醒，不自动调用上述 Skill。

## 8. 安全与隐私

- 只读取 tracked brief、Git 元数据和 untracked 路径名；不读 untracked 内容。
- 不输出环境变量、凭据、文件正文或完整 diff。
- 不 fetch、不调用 gh/HTTP/MCP/模型。
- 不写文件、staging、refs、worktree 或日志。
- stdout 不得混入 banner/debug；诊断只进 stderr。

## 10. 任务查询入口

保持 `docs/planning/tasks/*.md` 文件名稳定，不在路径或文件名复制 `done/review/coding/blocked` 状态。CG3 提供只读 `pnpm tasks:list`：默认显示当前任务和状态摘要，`--current` 显示当前 branch 唯一活动任务，`--status <status>` 过滤 tracked brief。查询必须复用 `loadTrackedTaskRecords` / `normalizeTaskRecords` / `resolveCurrentTask`，不读取 untracked brief、不修改文件或 Git；无 current 时输出 `none` 并成功，非法参数稳定失败。

该命令是人工和续线 Skills 的统一浏览入口，不是新的任务状态源。frontmatter `status` 仍是权威，`calibration:check` 仍是当前 checkout 的范围门禁，progress board 仍是生成快照。

## 11. 验收

### 自动化

- 纯 fixture 除两轴矩阵外，必须直接使用既有 `buildCalibrationProjection` / worktree observation 的真实 `derived` 与 `registration` 结构，防止自造 adapter 形状通过而真实接线失败。
- malformed writeScopes、完整 HANDOFF 字段、祖先 review base、blocked 只读重评、target-relative checkout dirt、existing nextGate 复用和 UTF-8 4096 字节上限均须独立反证。
- Hook 覆盖 startup/resume/clear/compact、idle silence、合法 JSON、fallback、5 秒超时配置。
- Windows、中文、空格路径。
- no-write before/after。

### 真实演练

1. clean main/no task：静默；
2. feature branch/唯一活动 brief：自动注入 resume 快照；
3. `/continue-work`：输出接管回执并进入正确 next gate；
4. `/continuation`：生成可复制提示词但不实施；
5. compact：重算同一快照；
6. dirty overlapping worktree：protect-read-only，不清理；
7. HANDOFF：识别 review-handoff，Claude读取真实 diff。

完成不以脚本存在为准，而以全新 Claude 对话在没有旧聊天时正确识别目标、保护现场和下一门禁为准。
