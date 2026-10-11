# 透明开发校准 V1 · 设计

> 状态：**负责人已批准方案 A，待书面复核** · 2026-10-11
>
> 一句话：**从唯一 task brief 生成一份只读、确定性的当前 checkout 校准投影，让门禁和看板使用同一事实。**
>
> 治理权威：[AGENTS](../../../AGENTS.md)
>
> 工程规则：[ENGINEERING_RULES](../../../ENGINEERING_RULES.md)
>
> 实施载体：[transparent-development-calibration-v1](../../planning/tasks/transparent-development-calibration-v1.md)

## 1. 目的与成功判据

仓库已经定义完整的业务权威、task brief、代码、测试、复审、PR/CI 与完成证据链，但执行事实分散在三套 parser、Git 现场、brief 正文和手工看板中。当前系统能校验部分声明，不能回答声明与现场是否一致。

本设计的成功问题是：

> 对当前 checkout，主代理和 CI 是否能从同一个 task brief 投影中，稳定判断“我在做哪一片、允许改哪里、实际改了哪里、依赖与权威是否成立、还有哪一道门禁”，并让人看到与机器阻断使用同一份事实？

成功必须同时满足：

1. task brief 仍是唯一可写实施载体；
2. parser、repository gate、UI hook、progress board 不再分别解释同一 brief；
3. 当前分支、base、实际 diff、untracked 现场与 `writeScopes` 分轨对账；
4. 同一个 calibration projection 同时供 CLI gate 和 progress board 使用；
5. CI static job 在干净 checkout 中运行只读检查；
6. 不把绿色投影冒充业务闭环、部署或负责人验收。

## 2. 设计边界

### 2.1 唯一事实链

本片沿用 `AGENTS.md` 的唯一链：

```text
正式权威
→ task brief 当前实现映射
→ 当前 checkout 的 contract / code / test 改动
→ 本地验证 / 独立复审 / PR / CI / 完成证据
```

新增的 parser、projection、finding、HTML 和命令输出全部是**派生事实**。它们不得被人工编辑后反向改变 task 状态，不得保存另一份 mutable truth。

### 2.2 当前 checkout，不是全仓编排器

本片只观察当前 Git checkout：

- 当前分支；
- 显式或验证后的 merge-base；
- base 到 HEAD 的 committed diff；
- staged / unstaged tracked diff；
- untracked paths；
- 当前 checkout 可见 task briefs 和 authority paths。

本片不扫描其他 worktree，不解析云端 session，不读 GitHub PR/CI API，也不执行 Git 写操作。

### 2.3 不建立生产应用

可视化继续进入现有静态 `docs/planning/progress-board.html`。不建立 `apps/web` 页面，不把开发治理变成业务工作台，不新增 API、数据库、迁移、认证或运行时状态。

## 3. 固定词汇与状态分轨

### 3.1 声明、观察、结论

投影中的所有字段分三类：

| 类别       | 含义                     | 例子                                                                        |
| ---------- | ------------------------ | --------------------------------------------------------------------------- |
| `declared` | task brief 明确声明      | branch、risk、dependsOn、writeScopes、locks、authorityRefs、status          |
| `observed` | 当前 checkout 可重建事实 | actualBranch、baseSha、headSha、committed/staged/unstaged/untracked paths   |
| `derived`  | 由声明和观察确定性计算   | ownedPaths、outOfScopePaths、missingAuthorities、blockingFindings、nextGate |

无法观察的事实使用 `unknown` 或 `not-observed`，不得补静默默认值。

### 3.2 路径归属

实际路径固定分四轨：

1. `ownedChangedPaths`：tracked 改动且命中 `writeScopes`；
2. `blockingOutOfScopePaths`：tracked 改动但未命中 `writeScopes`；
3. `ownedUntrackedPaths`：untracked 且命中 `writeScopes`；
4. `unownedUntrackedPaths`：untracked 且未命中 `writeScopes`。

第 2 轨阻断；第 4 轨只报告，不自动归责、暂存、格式化、删除或阻断。这样保留多人/多任务现场，不用“工作树不干净”掩盖真正越界。

### 3.3 活动与历史兼容

严格 checkout 校准只约束：

- 显式传入的 brief；或
- 当前分支唯一匹配的 `design / coding / fix / review` brief。

历史 `done / blocked` brief 继续接受已有格式，只保留现行 repository policy 已有的规则；本片不追溯要求历史 checkbox、slice 状态或新字段。

## 4. 共享 task brief parser

### 4.1 文件与职责

新增 `scripts/task-brief-state.mjs`，统一承担：

- frontmatter block 提取；
- 当前受支持 YAML-like 子集解析；
- scalar / inline list / block list 清洗；
- 路径标准化；
- task record 归一化；
- scope containment；
- brief 集合索引；
- checkout calibration projection；
- CLI 只读输出。

`check-repository.mjs`、`check-ui-structure-gate.mjs` 和 `build-progress-board.mjs` 必须导入此模块，不再各自保留 frontmatter parser。

### 4.2 归一化接口

```js
export function parseTaskFrontmatter(source, { path }): ParsedFrontmatter;
export function normalizeTaskRecord({ path, source }): TaskRecord;
export function normalizeTaskRecords(records): TaskRecord[];
export function scopeOwnsPath(scope, filePath): boolean;
export function resolveCurrentTask({ records, branch, explicitBrief }): TaskResolution;
export function buildCalibrationProjection(input): CalibrationProjection;
export function calibrationFindings(projection): CalibrationFinding[];
```

核心结构：

```ts
interface TaskRecord {
  id: string;
  path: string;
  title: string;
  status: string;
  branch: string;
  verification: string;
  owner: string;
  writer: string;
  risk: string;
  dependsOn: string[];
  writeScopes: string[];
  exclusiveLocks: string[];
  sharedIntegrationScopes: string[];
  authorityRefs: string[];
  uiStructure: string[];
  uiMustStayVisible: string[];
  uiProgressiveDisclosure: string[];
  uiForbidden: string[];
  uiViewportEvidence: string[];
  parseErrors: SourceFinding[];
}
```

parser 不实现完整 YAML；它只支持模板与现有 brief 已使用的子集。遇到缩进 map、multiline scalar、重复 key、畸形 list、无 frontmatter 或不受支持结构时返回带路径和行号的 parse finding，不静默降级。

### 4.3 路径规则

- 仓库路径统一 `/`；
- 比较大小写不敏感，输出保持仓库原 spelling；
- 绝对路径、`..`、重复 separator、无法可靠求交的 glob 继续拒绝；
- 只允许精确路径或 `/**` 目录；
- `scopeOwnsPath` 是 UI hook、task conflict 和 actual diff reconciliation 的唯一实现。

## 5. Git 观察边界

### 5.1 注入式观察

核心 projection 不直接 shell out。它接收：

```ts
interface CheckoutObservation {
  actualBranch: string;
  baseSha: string | null;
  baseSource: "explicit" | "merge-base" | "unknown";
  headSha: string;
  committedPaths: string[];
  stagedPaths: string[];
  unstagedPaths: string[];
  untrackedPaths: string[];
}
```

CLI adapter 才使用 `execFileSync("git", args)`，并将结果传入纯函数。测试因此不依赖真实仓库和平台 shell。

### 5.2 base 选择

优先级固定：

1. CLI `--base <sha>`；
2. CI 环境显式 `BASE_SHA`；
3. `git merge-base <base-ref> HEAD`，base-ref 默认 `origin/main`，必须存在；
4. 无法验证时 `baseSource=unknown` 并产生阻断 finding。

不允许静默用 `HEAD~1`，不允许在 stacked branch 上把 `origin/main` 差异冒充当前 slice；投影必须展示 base 与来源。后续若需 stacked branch 支持，调用者显式传 `--base`。

### 5.3 Git 命令

只读 adapter 仅调用：

```text
git branch --show-current
git rev-parse HEAD
git rev-parse --verify <base-ref>
git merge-base <base-ref> HEAD
git diff --name-only --diff-filter=ACMRD <base>...HEAD
git diff --name-only --cached --diff-filter=ACMRD
git diff --name-only --diff-filter=ACMRD
git ls-files --others --exclude-standard
```

不调用 checkout、reset、clean、stash、add、commit、push 或 merge。

## 6. 当前任务解析

### 6.1 显式优先

本地推荐：

```text
pnpm calibration:check -- --brief docs/planning/tasks/<task>.md --base <sha>
```

显式 brief 必须存在且能解析；其 declared branch 与 actual branch 不同则阻断。

### 6.2 自动解析

无 `--brief` 时：

- 在 `design / coding / fix / review` 中查 `branch === actualBranch`；
- 只有一个匹配时使用；
- 0 个产生 `TASK_CURRENT_NOT_FOUND`；
- 多个产生 `TASK_CURRENT_AMBIGUOUS`。

`main`、detached HEAD 或无任务 checkout 默认不自动报错；只有显式运行 task calibration 或 CI 为 task branch 时才要求唯一活动 task。`repo:check` 保持全仓政策检查，不因 main 上没有活动任务失败。

## 7. 校准 finding 契约

finding 结构固定：

```ts
interface CalibrationFinding {
  code: string;
  severity: "blocking" | "warning";
  subject: string;
  declared?: unknown;
  observed?: unknown;
  evidence: string[];
  remedy: string;
}
```

第一片稳定 code：

| Code                              | 级别     | 条件                                       |
| --------------------------------- | -------- | ------------------------------------------ |
| `TASK_PARSE_INVALID`              | blocking | 当前 task frontmatter 不可可靠解析         |
| `TASK_CURRENT_NOT_FOUND`          | blocking | task branch 无唯一活动 brief               |
| `TASK_CURRENT_AMBIGUOUS`          | blocking | 多个活动 brief 声明同一 branch             |
| `TASK_BRANCH_MISMATCH`            | blocking | declared branch != actual branch           |
| `TASK_BASE_UNKNOWN`               | blocking | 无法验证 base                              |
| `TASK_CHANGED_PATH_OUT_OF_SCOPE`  | blocking | committed/staged/unstaged tracked 路径越界 |
| `TASK_AUTHORITY_MISSING`          | blocking | authorityRefs 指向不存在路径               |
| `TASK_AUTHORITY_WRITE_UNDECLARED` | blocking | 实际修改 authorityRef 但未进入 writeScopes |
| `TASK_DEPENDENCY_MISSING`         | blocking | dependsOn 找不到                           |
| `TASK_DEPENDENCY_NOT_DONE`        | blocking | dependsOn 非 done                          |
| `TASK_DONE_VERIFICATION_MISSING`  | blocking | done 无 verification（沿用既有规则）       |
| `TASK_UNOWNED_UNTRACKED_PRESENT`  | warning  | 范围外 untracked 现场，仅报告              |

输出按 code、subject、path 稳定排序。CLI 文本和 board 使用同一 code 与证据，不各写一份文案规则。

## 8. 与现有 gate 的集成

### 8.1 Repository gate

`check-repository.mjs`：

- 改用共享 parser/normalizer；
- 继续执行所有现有 WIP、依赖、scope overlap、lock、UI metadata 规则；
- 新增可注入的 current-checkout calibration 调用；
- `docsOnly` 不执行 Git checkout calibration，只检查文档/brief 声明；
- main checkout 不因没有活动 task 失败。

### 8.2 UI hook

`check-ui-structure-gate.mjs`：

- 删除私有 parser 与 scopeOwnsPath；
- 导入共享 `normalizeTaskRecord` / `scopeOwnsPath`；
- 保持原有行为和错误文案兼容：非 Vue 放行、无 owner 阻断、多 owner 阻断、UI 五数组缺失阻断。

hook 仍不是完整边界；shell 写入和其他工具最终由 repository/CI gate 检查。

## 9. Progress board 纵向薄片

### 9.1 投影内容

在现有 board 增加一个“当前交付薄片”区域，顺序固定：

```text
任务身份与目标
→ 正式权威与依赖
→ 声明写域
→ 当前 checkout 观察
→ 对账 finding
→ 已知验证 / 未观察证据
→ 下一道门禁
```

必须显示：

- brief 路径、title、status、risk、declared/actual branch；
- base/head SHA 与 base source；
- authorityRefs 与依赖状态；
- writeScopes；
- 四轨 changed paths；
- blocking/warning findings；
- verification 原文（标记为 declared，不冒充已在线核验）；
- remote review/PR/CI 为 `not-observed`；
- `nextGate`。

### 9.2 视觉语义

沿用现有 progress board 的工业控制板风格和主题 token，不引入另一套品牌。新增区域使用三种可区分形式：

- **计算事实**：实线、mono 值、`computed` 标签；
- **声明事实**：细线、`declared` 标签；
- **未知/人工判断**：虚线、`unknown` / `editorial` 标签。

状态不只靠颜色。宽屏使用“声明 / 现场 / 门禁”三列；手机按同一因果顺序单列。长路径在自身容器换行或横向滚动，页面不横向溢出。

### 9.3 生成与 check

```text
pnpm board:build       # 唯一允许写 progress-board.html
pnpm board:check       # 只生成内存结果并与 committed artifact 比较
pnpm calibration:check # 只读 task projection/finding gate
```

为避免 commit/branch/dirty/timestamp 导致永远漂移：

- committed board 的可校验主体只包含 deterministic repository projection；
- 当前 checkout 的 volatile branch/head/dirty 由本地 build 展示，但 `board:check` 比较时使用固定占位或排除带明确 marker 的 volatile 区块；
- 更简单的实现若不能可靠隔离 volatile metadata，则 board generator 增加 `--deterministic`，CI build/check 均用该模式。

`build-progress-board.test.mjs` 必须验证相同 fixture 字节一致、source change 产生 drift、check mode 不写文件、HTML 转义和移动布局 marker 存在。

## 10. CI static gate

`.github/workflows/ci.yml` 的 `static` job 在 install 后、production validation 前运行：

```text
pnpm repo:check
pnpm calibration:check -- --ci --base "$BASE_SHA"
pnpm board:check
pnpm format:check
```

PR 事件提供 `BASE_SHA` / `HEAD_SHA`。calibration CLI 必须校验 observed HEAD 与环境 HEAD 一致，防止检查错误提交。workflow_dispatch 可使用 merge-base；schedule 不运行 task calibration，只保留已有依赖/字典任务。

本片不新增数据库服务、integration job、secret scanner 或 dependency policy；它们分别建立风险切片。

## 11. 错误处理与用户工作保护

- Git 命令失败产生稳定 finding，不抛出长栈或吞掉错误；
- 解析错误给出 file:line 与受支持格式；
- untracked 不读取内容，只处理路径；
- `.env`、key、token 等路径只显示 repository-relative 路径，不显示内容；
- 不删除、移动、格式化、暂存、还原任何现场文件；
- board render 对所有路径、title、verification 做 HTML escaping；
- 任何未知都显示 unknown，不用空串、0 或 pass 替代。

## 12. 测试策略

### 12.1 Parser contract

覆盖：

- scalar、quoted scalar、inline list、block list、comments；
- CRLF/LF；
- empty list / empty scalar；
- duplicate key、unsupported nested mapping、malformed list；
- Windows separator/case；
- exact scope、directory scope、path traversal rejection。

### 12.2 Calibration behavior

fixture 覆盖：

- explicit brief success；
- auto single / zero / ambiguous；
- branch match/mismatch；
- explicit base / merge-base / unknown；
- committed/staged/unstaged union and dedupe；
- tracked out-of-scope block；
- owned/unowned untracked split；
- missing/unfinished dependency；
- missing authority；
- authority modified without write scope；
- done verification；
- stable sorting and no file writes。

### 12.3 Existing gate regression

原 `check-repository.test.mjs` 与 `check-ui-structure-gate.test.mjs` 全部保留，通过共享 parser 后输出语义不回退。新增 fixture 证明 parser migration 不改变现有 active/WIP/lock/UI ownership 判断。

### 12.4 Board

- deterministic render；
- current slice region exists and ordering fixed；
- computed/declared/unknown visually and textually distinct；
- escaping；
- `--check` drift / no-write；
- phone-width CSS no body overflow（浏览器人工核对，必要时轻量结构测试）。

## 13. 完成门槛

本片完成仅表示：当前 checkout 的 task brief 声明与 Git 现场可以由同一投影对账、显示和自动阻断。

它不表示：

- 其他 worktree 已无冲突；
- GitHub PR/CI 已在线核验；
- RAID 已同步；
- 业务工作台通过 WB-B01～WB-B10；
- 部署或人工业务验收完成。

完成前必须具备：共享 parser 三消费者、current-checkout reconciliation、稳定 findings、board derived view、read-only check modes、CI static 接入、定向与完整门禁、必要的 fresh Claude 独立复审和最终 PR CI。

## 14. 后续切片

1. **跨 worktree 校准**：基于注册 worktree + active brief 状态，区分 active/dormant，核对 writer/scope/lock/dependency；先重写旧 thin orchestrator brief 的角色模型。
2. **远端集成核验**：只读 GitHub PR/CI/merge evidence，写回现有 brief verification，不建云端状态副本。
3. **RAID / checklist 链接门禁**：保留 Markdown 权威，先做 ID/引用/owner/exit-condition 校验，不迁移数据库。
4. **CI 风险补强**：integration/security jobs 作为独立任务，不与本片混合。
