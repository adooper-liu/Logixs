---
status: fix
branch: feat/task-archive-second-consumer-v1
verification: "PR 候选本地证据（2026-10-17）：定向 Vitest 4 files / 32 tests、清关档案三项目 E2E 9/9、既有清关流程三项目 E2E 3/3、Web 与全仓 lint/typecheck/unit/build、Prettier、repo/workbench-purpose/contract/dictionary/Prisma/diff 检查通过；三张 1440/1024/390 截图由主代理逐张复核，fresh 整体独立复审 no-findings。pnpm validate 已运行一次并在已知 Windows apps/ai-service/.pytest_cache EPERM 的 format:check 停止；分轨 integration 仅 full-chain-rehearsal-domain-adapter 既有 3 项失败，标准 E2E 仅 recoverable-work-sessions 的既有 Stuffing mobile snapshot 4% 像素漂移失败，本任务 customs archive 9 项在全量调度中通过。最终 PR CI/合并待完成。"
owner: main
writer: codex
risk: medium
dependsOn:
  - task-archive-ui-consumer-v1
writeScopes:
  - docs/planning/tasks/task-archive-second-consumer-customs-v1.md
  - apps/web/src/components/workbench/RoleWorkbenchFrame.vue
  - apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts
  - apps/web/src/views/CustomsWorkbench.vue
  - apps/web/src/views/CustomsWorkbench.test.ts
  - apps/web/e2e/customs-task-archive.spec.ts
  - apps/web/e2e/customs-task-archive.spec.ts-snapshots/**
  - docs/planning/progress-board.html
exclusiveLocks:
  - ui-pattern:task-archive-v1
  - ui-pattern:workbench-layout-v1
  - visual-baseline:task-archive-customs-v1
sharedIntegrationScopes:
  - docs/planning/progress-board.html
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/清关.md
  - docs/product/UI_SYSTEM.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - docs/planning/tasks/task-archive-ui-consumer-v1.md
uiStructure:
  - 进口清关继续使用唯一 PageHeader，其下固定为岗位与货柜范围、生命周期轨道、左清关任务池、中清关事实、右动态上下文；档案模式不得改变区域顺序、栏数或宽度
  - 右栏默认显示清关办理；仅在选中真实清关任务后，右栏顶部提供办理与档案两个真实模式，档案原样承接当前任务的冻结结果、原任务记录和相关对象事实
  - 办理与档案切换只改变右栏局部内容；当前货柜、任务、清关事实、责任上下文和生命周期定位保持不变，返回办理恢复未提交输入、滚动和焦点
  - 沿用 RoleWorkbenchFrame 的 stacked 兼容几何：1440 三栏并列，1024 队列与事实在上且右栏跨整行，390 按任务池、清关事实、右侧上下文的因果顺序纵向承接
uiMustStayVisible:
  - 进口清关正式身份、当前货柜、当前任务、负责节点、生命周期位置，以及当前右栏模式文字
  - 办理模式中的清关案件事实、任务完成不等于海关放行的边界、保存或提交结果、失败与恢复入口
  - 档案模式中的当前身份可见来源、原任务正式结果或明确未知、原任务记录与相关对象事实分轨、asOf、分页状态和刷新重试入口
  - 档案是货柜范围的当前可见任务档案，不是完整清关案件历史、全局审计、正式责任交接或海关放行依据
uiProgressiveDisclosure:
  - 来源类型、来源 ID、任务引用、操作人、记录时间、技术 code 和组合投影版本继续留在档案现有 details 中
  - 档案覆盖限制与 200 条任务来源上限按需展开，但当前有界视图和未接通轨道必须首屏可见
  - 办理与档案是右栏局部模式，不进入 PageHeader 更多功能，也不新增独立路由、聊天、AI 或未来模式占位
uiForbidden:
  - 修改 TaskArchivePanel、useTaskArchive、API、Schema、迁移、公共契约、授权政策、清关策略、案件状态、放行语义、责任或业务动作
  - 把货柜级 activities 称为清关案件全历史，把任务完成称为海关放行，或从任务、案件、Hold、日期事实推断未提供的责任交接
  - 将 taskId 改为可选、支持无任务历史快照、抽象通用 RightPaneStack 或预建协作与 AI 接口
  - 切换模式时销毁清关办理表单并丢失未提交输入、重置当前任务、改变 stacked 几何，或让隐藏办理控件仍可聚焦
  - 读取、复制、清理、暂存或提交 D:/Logixs/.worktrees/ui-unification 的未归属历史 WIP
uiViewportEvidence:
  - 1440x900：任务池、清关事实和右栏同屏；办理与档案往返不改变三栏宽度，返回后未提交输入与焦点仍在，无页面或 pane 横向溢出
  - 1024x768：验证 RoleWorkbenchFrame 的真实 stacked 几何而非复制 tasks 的中右并列；队列与事实保持上方因果顺序，右栏办理或档案跨整行，错误、重试和更早记录可达且无横向溢出
  - 390x844：按任务池、清关事实、办理或档案纵向阅读；模式切换可键盘和触控操作，档案来源边界、刷新与恢复入口不被底部或系统键盘遮挡，无页面级横向溢出
---

# 任务：任务档案第二个差异化消费者——进口清关 V1

## 路线图位置与目标

- **位置**：任务档案首个 `/tasks` 消费者已由 PR #185/#186 合入后的固定下一门；本任务完成第二个差异化真实消费者验真，之后才可进入任务内协作对话。
- **第二消费者**：生产 `/workspaces/customs` 进口清关工作台。它使用 `RoleWorkbenchFrame` 的兼容壳、清关事实中栏、真实写操作右栏与 stacked 响应式，足以反证档案接口是否被 `/tasks` 的永久右栏和 standard 几何污染。
- **目标岗位结果**：清关人员在不离开当前货柜和清关任务、不丢未提交办理输入的前提下，核对当前任务正式结果、原任务记录与当前身份可见的相关对象事实，再返回继续办理。
- **完成边界**：只证明 `TaskArchivePanel` / `useTaskArchive` 与共享右栏标签接口可被第二种生产工作台原样消费；不宣称清关业务闭环、完整案件档案、正式交接、协作或 AI 已完成。

## 当前事实与方案选择

1. `/tasks` 已把 `TaskArchivePanel(containerId, taskId, outcome)` 与 `useTaskArchive` 验证为首个消费者，并已覆盖对象切换竞态、分页快照、撤权清空、来源分轨和三视口。
2. 清关当前已有精确 `selectedContainer`、`selectedTask: NodeTaskDetail | null` 和 `selectedTask.outcome`，并消费同一货柜的生命周期、任务、案件和日期事实；无需新后端或契约。
3. 清关右栏当前是长写表单 `CustomsActionPanel`。它与 `/tasks` 的只读永久档案不同，可验证“办理 ↔ 只读档案”局部模式往返、输入保持和焦点恢复。
4. `RoleWorkbenchFrame` 固定 `responsive-mode="stacked"`，且把右栏标题、region、rail 和移动标签写死为岗位待办/编辑。当前只允许增加消费者传入的中性标签，默认值和其他消费者 DOM/几何必须不变。
5. 装箱虽然也有 task/container，但其差异场景包含无 task 的历史快照和仍在 review 的可恢复工作会话，会迫使档案接口泛化；提柜则仍有较多岗位事实缺口。两者都不是当前最小验真片。

**已定实现选择**：清关默认保持“办理”；选中真实任务后才显示“档案”入口。档案模式原样挂载现有 `TaskArchivePanel`，不修改该组件或 composable。右栏模式只存在于 `CustomsWorkbench`；不抽通用视图栈。

## 边界 / 不做

- 不修改 `apps/api/**`、`database/**`、`packages/contracts/**`、`TaskArchivePanel.vue`、`useTaskArchive.ts` 或清关领域组件。
- 不新增任务消息、回复、Mention、证据关联、协作持久化、AI、助手或“更多功能”入口。
- 不修改清关策略选择、申报、Hold、放行、任务完成、责任、权限或提柜交接语义。
- 不把活动投影称为清关案件档案；当前投影仍是货柜范围、当前身份可见、有界来源。
- 不迁移装箱、提柜、送仓、卸柜或其他工作台，不修复范围外既有清关缺口。
- 不读取或吸收旧 `ui-unification` worktree WIP；当前实现必须在本分支从最新 `main` 测试先行完成。

## 固定接口

`RoleWorkbenchFrame` 只增加以下可选展示 props，默认保持现有消费者完全兼容：

```ts
contextLabel?: string; // default: "岗位待办"；同时驱动 right rail、WorkbenchPane title 与 region label
contextSummary?: string; // default: 有对象时“查看动作”，否则“待选择”
mobileContextLabel?: string; // default: "编辑"；透传 WorkbenchLayout
```

`CustomsWorkbench` 使用本地、非持久业务事实的 UI 模式：

```ts
type CustomsContextMode = "action" | "archive";
```

- 初始值与无选中任务时固定为 `action`。
- `archive` 仅在 `selectedContainer && selectedTask` 时可进入。
- 档案 props 精确为 `selectedContainer.id`、`selectedTask.id`、`selectedTask.outcome`。
- 办理面板保持挂载但隐藏，隐藏后不得参与 tab 顺序；返回时恢复进入档案前的办理控件焦点和右栏滚动位置。
- 货柜或任务变化时不得显示上一对象档案；现有 archive generation/清空规则继续生效。若选择变化后仍处于 archive，只能展示新任务加载态或新档案，不得回显旧内容。

## 执行切片与人工转发信封

同一分支、同一最终 PR；主代理在每次 HANDOFF 后审查真实 diff、测试和截图，不直接修改产品实现。

### 切片 `AC2-component-consumer`

**目标**：测试先行完成最小标签透传和清关右栏办理/档案局部模式；组件测试证明接口原样复用、兼容性、输入与焦点保持，但本片不以截图宣称三视口完成。

| 项目        | 内容                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| 基线        | 本 brief 提交后的准确 SHA                                                                                             |
| 执行角色    | Codex Code 实现执行器；`HANDOFF.model` 如实登记实际模型                                                               |
| 写入范围    | `RoleWorkbenchFrame.vue/.test.ts`、`CustomsWorkbench.vue/.test.ts`                                                    |
| 禁止范围    | TaskArchivePanel/useTaskArchive、API、契约、清关领域组件、E2E、截图、进度板、旧 worktree                              |
| UI 强制结构 | 完整遵守 frontmatter 五项；视觉沿用现有港口青绿、系统字体、紧凑作业密度，不新增 palette/type/theme                    |
| 停止条件    | 需要修改档案接口或清关政策；无法在不销毁表单的情况下切换；需要把 taskId 变可选；其他消费者兼容性回退；出现范围外 diff |

- [x] **AC2.1 RED：标签兼容与精确透传。** 在 `RoleWorkbenchFrame.test.ts` 先断言默认仍为右轨/Pane“岗位待办”、移动“编辑”、`responsiveMode="stacked"`；传入 `contextLabel="当前可见档案"`、`contextSummary="核对记录"`、`mobileContextLabel="档案"` 时，只改变对应标签，不改变三 pane 顺序与 stacked 模式。运行该 suite，新增断言预期失败。
- [x] **AC2.2 GREEN：最小 frame 扩展。** 仅增加固定接口三个可选 props，并统一驱动 `WorkbenchLayout` 与右侧 `WorkbenchPane`；不增加模式状态、业务判断或样式。重跑 suite 通过。
- [x] **AC2.3 RED：清关第二消费者。** 在 `CustomsWorkbench.test.ts` mock `TaskArchivePanel` 并增加反证：默认只显示办理；选中任务后可进入档案且精确传入 container/task/outcome；无任务时不显示空档案入口；办理表单输入、右栏滚动与进入前焦点在档案往返后恢复；档案模式切换任务时旧 task props 立即退出；页面无协作/AI/完整案件历史文案。运行 suite，新增断言预期失败。
- [x] **AC2.4 GREEN：局部受控模式。** 在 `CustomsWorkbench.vue` 增加右栏模式切换与焦点/滚动记忆；办理面板以保持挂载的方式隐藏，档案仅在有效选中时挂载。根据模式传入 frame 的三个标签；不修改 `CustomsActionPanel`、档案组件或 composable。
- [x] **AC2.5 最近验证与交回。** 运行两个定向 suite、相关既有 `TaskArchivePanel`/`useTaskArchive` suite、Web lint/typecheck/build、精确 Prettier check、`pnpm repo:check`、`git diff --check`；核对实际 diff 全在本片范围，返回 `logix-handoff/v1`，默认不提交，`nextSuggested: AC2-viewport-evidence`。

主代理以 `4571b185055967820152ca353754e60c770eb2b1` 为基线核对实际未提交 diff：仅四个授权文件。复现定向 Vitest `4 files / 28 tests passed`、Web lint/typecheck/build、精确 Prettier、repo/diff 检查全部通过；HANDOFF 登记的 RED 分别为 frame `1 failed / 7`、Customs `5 failed / 8`。fresh 只读增量复审结论为 `no-findings`，唯一 verification gap 是本 brief 已预留的真实浏览器三视口证据。AC2 组件片验收完成，进入 `AC2-viewport-evidence`，尚不宣称三视口或任务级完成。

实现任务：

```text
TASK docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-component-consumer base=<brief-commit-sha> role=implementer workspace=D:/Logixs
```

### 切片 `AC2-viewport-evidence`

**目标**：使用生产 DTO 形状和差异化 stacked 布局补齐三视口、真实模式往返、键盘/焦点与版本化截图证据；不借 E2E 修改业务语义。

| 项目     | 内容                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| 基线     | AC2 组件片主代理验收后的当前 SHA 或可复现未提交差异的真实 base                                                       |
| 写入范围 | `apps/web/e2e/customs-task-archive.spec.ts`、其 snapshots；发现产品 finding 时先交回主代理，不直接越过上一片范围修复 |
| 禁止范围 | 不修改既有 `customs-workbench.spec.ts` 以降低原业务验收；不伪造 API DTO；不以更新 PNG 掩盖结构错误                   |
| 视觉证据 | frontmatter 三视口全部覆盖，三张截图逐张人工核对；结构、焦点、输入保持和无溢出必须有行为断言，不能只靠截图           |
| 停止条件 | 任一视口旧内容残留、隐藏控件可聚焦、输入或焦点丢失、stacked 几何被改成 standard、横向溢出、截图与强制结构不符        |

- [x] **AC2.6 RED：真实 E2E 契约。** 新建 spec，拦截现有 containers/node-tasks/lifecycle/case/date-facts/activities API 的真实 DTO；activities 至少含当前 task 的操作回执和另一条生命周期对象事实。先覆盖办理输入 → 档案 → 办理保持、任务/货柜上下文稳定、旧档案清空、错误重试、加载更多、隐藏办理控件不可聚焦和三个视口差异结构；预期在缺少实现或截图时失败。
- [x] **AC2.7 GREEN：只修当前 finding。** 若 E2E 暴露产品缺陷，停止并由主代理先记录 finding、扩写精确 writeScopes 和下发修复 TASK；不得在本证据片直接顺手修改产品文件。
- [x] **AC2.8 版本化截图与人工视觉复核。** 分别生成 1440×900、1024×768、390×844 的档案模式截图；至少用结构断言覆盖一次返回办理。逐张核对清关身份、当前对象/任务、档案有界来源、原任务/相关事实分轨、恢复入口、stacked 差异、重复文案和内容克制。
- [x] **AC2.9 任务级门禁与整体独立复审。** 运行相关 Web 单测、三项目 E2E、Web format/lint/typecheck/build、`pnpm repo:check`、`git diff --check`；最终 PR 候选只运行一次完整 `pnpm validate`。随后由 fresh Claude Code 只读复审第二消费者是否真的固定现有档案接口、是否回退清关办理、是否夹带协作/AI或泛化事实；主代理逐项裁决 finding。
- [ ] **AC2.10 集成。** 产品 findings 与任务级门禁已处置；PR #187 已收口旧治理锁，PR #188 的 changes/static/unit/build 已通过。首轮 E2E 仅 mobile 清关档案截图因跨 Windows 中文字形栅格差异稳定产生 4% 像素差而失败，进入 `AC2-fix-3-portable-mobile-snapshot`；修复后重跑 CI，通过后合并。只有合并后才把本 brief 标 `done` 并进入任务内协作对话。

主代理复现三项目 `6 passed`，并逐张读取版本化截图。1440 与 1024 结构符合预期；390×844 暴露当前用例未覆盖的强制结构缺口：档案右栏顶部只有“进口清关”和档案内容，当前货柜、当前任务与生命周期定位均随上方责任带/节点轨道滚出视口。根因是 `RoleWorkbenchFrame` 的 stacked 模式在 ≤680px 隐藏移动导航和 breadcrumb 并纵向展开三栏，而截图与实际长内容场景会把用户带到右栏顶部。该结果违反 frontmatter `uiMustStayVisible` 与移动视口证据，因此视觉片保持 `fix`。

```yaml
protocol: logix-disposition/v1
slice: AC2-viewport-evidence
decisions:
  - finding: AC2-VIS-001
    status: accepted
    reason: 390x844 档案屏没有当前货柜、当前任务或当前生命周期节点的紧凑锚点；用户无法在长页面右栏确认正在核对哪一票清关任务
    writeback: docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-fix-1-mobile-context-anchor
next: fix
```

### 切片 `AC2-fix-1-mobile-context-anchor`

- [ ] 在 `CustomsWorkbench.test.ts` 先增加失败测试：右栏存在一个中性“当前清关上下文”锚点，精确显示当前货柜号、当前任务的人话标签“清关任务”和当前节点 `07 清关`；任务/货柜切换后立即更新，不显示内部 taskId/nodeCode。该锚点不得替代责任带或改变 RoleWorkbenchFrame 接口。
- [ ] 在 `CustomsWorkbench.vue` 的右栏模式控制与具体内容之间加入紧凑上下文锚点；默认桌面与 1024 隐藏，仅 `max-width: 680px` 显示。事实只来自 `selectedContainer`、`selectedTask` 与 `customsNode`，缺值明确显示“货柜待选择 / 清关任务待选择 / 清关节点待加载”，不得推断责任、状态或放行。
- [ ] 在 `customs-task-archive.spec.ts` 的三项目公共行为测试中断言锚点文本会随第二货柜更新；在 mobile 项目截图前断言锚点可见且位于档案模式按钮下、档案正文上，desktop/narrow 断言隐藏。只更新 390×844 截图；1440/1024 PNG 哈希应保持不变，否则停止解释差异。
- [ ] 重跑定向组件测试、三项目 E2E、Web lint/typecheck/build、精确 Prettier、repo/diff；返回 HANDOFF 后主代理重新逐张核对。

修复任务：

```text
TASK docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-fix-1-mobile-context-anchor base=898154758e6c3cf52c81f13d3f7e240bdf0cb72a role=implementer workspace=D:/Logixs
```

主代理复现修复片的组件测试 `4 files / 32 tests passed`、三项目 E2E `6 passed`、Web lint/typecheck/build、Prettier、repo/diff 全部通过；移动截图已出现当前货柜、清关任务与 `07 清关`，desktop/narrow 哈希保持不变。增量代码审查仍确认一项当前范围兼容性回退：实现用 `:context-ready="true"` 强制右栏进入 ready，而 `CustomsActionPanel` 仅在有 `selectedContainer` 时挂载、移动锚点在桌面与 1024 隐藏；因此直接打开无 `containerId` 的 `/workspaces/customs` 时，原有“选择对象后显示动作。”被空白“清关办理”pane 取代。

```yaml
protocol: logix-disposition/v1
slice: AC2-fix-1-mobile-context-anchor
decisions:
  - finding: AC2-FIX1-001
    status: accepted
    reason: 无 route selection 时 contextReady=true 绕过 RoleWorkbenchFrame 原有 empty state；桌面和 1024 的唯一锚点又被隐藏，形成无可见正文的 ready pane
    writeback: docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-fix-2-preserve-empty-state
next: fix
```

### 切片 `AC2-fix-2-preserve-empty-state`

- [ ] 在 `CustomsWorkbench.test.ts` 先把无对象场景固定为失败反证：直接进入 `/workspaces/customs` 时，右栏必须显示既有“选择对象后显示动作。”，不得显示空白 ready pane；此时“当前清关上下文”不渲染。已有货柜但缺任务或节点的测试继续分别证明“清关任务待选择 / 清关节点待加载”。
- [ ] 在 `CustomsWorkbench.vue` 删除无条件 `:context-ready="true"`，恢复 `RoleWorkbenchFrame` 以 `selectedContainer` 判断 empty/ready；不修改 shared frame，不把移动锚点改成桌面常驻，也不改变 action/archive 模式。
- [ ] 在 `customs-task-archive.spec.ts` 增加跨三项目的直接无选择反证：右栏可见“选择对象后显示动作。”且无档案模式入口；已有货柜后的现有锚点、档案和对象切换用例保持不变。
- [ ] 重跑组件、三项目 E2E 和质量门禁；三张 PNG 均不得变化。若任何截图哈希变化，停止并报告，不更新基线。

修复任务：

```text
TASK docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-fix-2-preserve-empty-state base=<finding-writeback-sha> role=implementer workspace=D:/Logixs
```

### 切片 `AC2-fix-3-portable-mobile-snapshot`

PR #188 首轮 CI run `39039298865` 的 changes/static/unit/build 通过，dictionary/security 按 changed-path 分类跳过；E2E 唯一失败为 mobile `customs-task-archive.png`，三次重试均稳定为 12,336 pixels / ratio 0.04，quality 仅因依赖失败而失败。下载的 CI 制品证明：expected SHA 与仓库 mobile baseline 均为 `E64CAA184712A9E5B4974108CD38D3EEAA17CB5208FA50C8F0810B04C37E7A86`，三次 CI actual SHA 均为 `872F4D7B068F4248C9BC9CE4427F07BB61971A6DEFD5B89C962F0AE51C904459`；expected/actual 的结构、内容、位置一致，diff 只沿中文字形抗锯齿边缘分布。所有行为、几何、对象上下文与无溢出断言在截图前通过，desktop/narrow 截图也通过。

```yaml
protocol: logix-disposition/v1
slice: AC2-ci-1
decisions:
  - finding: AC2-CI-001
    status: accepted
    reason: mobile 中文字形在本机与 GitHub Windows runner 的稳定栅格差异为 4%，超过当前 3% 阈值；这是该截图的跨环境可移植性缺口，不是产品结构漂移
    writeback: docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-fix-3-portable-mobile-snapshot
next: fix
```

- [ ] 只修改 `customs-task-archive.spec.ts`：保留全局 `maxDiffPixelRatio: 0.03`，仅在 `viewport.width === 390` 的 `toHaveScreenshot` 调用中覆盖为 `0.05`；不得改 `threshold`、禁用截图或放宽 desktop/narrow。
- [ ] 不更新任何 PNG；三张截图 SHA 必须保持 `514EEB...` / `EA6D61...` / `E64CAA...`。
- [ ] 重跑三项目专用 E2E、Prettier、Web lint/typecheck/build、repo/board/diff；随后提交、推送并等待 PR #188 新 CI。

修复任务：

```text
TASK docs/planning/tasks/task-archive-second-consumer-customs-v1.md#AC2-fix-3-portable-mobile-snapshot base=<ci-finding-writeback-sha> role=implementer workspace=D:/Logixs
```

## 智慧开启基线继承

| 基线结论                                                         | 处置     | 依据                            | 本任务落点                                             |
| ---------------------------------------------------------------- | -------- | ------------------------------- | ------------------------------------------------------ |
| 清关目标是以资料、申报、查验、缴税和放行形成可采信结果并交给提柜 | 沿用     | `08-role-workbenches.md` 清关节 | 档案只辅助核对已有记录，不替代放行证据或联合可提       |
| 报关行是协作方，海关或认可渠道是结果权威方                       | 沿用     | 清关智慧基线已定摘要            | 任务或工单完成不显示为海关放行                         |
| 三种清关策略、指标与改选历史已有决定，但仍有未实现与未知事项     | 沿用     | 清关智慧基线                    | 本片不显示、选择、默认或修改策略，也不宣称整台验收     |
| 当前活动、任务与通用控制面只是承载能力，不是清关业务结果         | 补强     | 现行路线要求第二真实消费者验真  | 共享档案只随清关真实 task/container 引用接入，不造平台 |
| 完整案件历史、多案卷与最晚安全时点仍有事实缺口                   | 存疑保持 | 当前权威和样本不足              | 页面只称当前可见任务档案；不借本片决定或实现这些事项   |

## 负责人决策记录

本片**无新增负责人待决事项**：它不改变清关岗位结果、策略、状态、责任、交接、权限、放行语义、公共契约或不可逆成本，只验证已批准的当前可见任务档案能否由第二种生产工作台原样消费。

停止并升级负责人决策的条件：

1. 实现必须把货柜级 activity 定义为“清关案件档案”或改变公共契约业务含义；
2. 实现必须决定 completed 任务是否仍可维护案件、改变清关动作/责任/权限或放行完成语义。

## 同一业务步骤五面映射

| 业务步骤与岗位结果                     | 岗位任务                                                                 | 数据事实                                                                                           | 技术保障                                                                | 权限边界                                                                                   | 界面承接                                             | 状态   |
| -------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------ |
| 在当前清关任务中核对已有档案并返回办理 | 清关人员不离开当前货柜与任务即可核对原任务和相关对象事实，再继续当前办理 | selected container/task/outcome；服务端裁剪的 ObjectActivity、nextActions、asOf、projectionVersion | 原样复用 archive generation、快照一致、失败清空；模式切换不销毁办理输入 | 继续由 container.read + lifecycle.read 与来源 task/notification capability 裁剪；UI 不提权 | 右栏默认办理、显式档案次模式、返回恢复输入/滚动/焦点 | 待 AC2 |

## 相关数据事实子集（三轨）

| 轨道                 | 事实                                                 | 当前来源                   | 本任务处置                                     | 状态                |
| -------------------- | ---------------------------------------------------- | -------------------------- | ---------------------------------------------- | ------------------- |
| `current_physical`   | 清关任务、可选 outcome、货柜与生命周期/案件/日期事实 | 现有清关 composable 与 API | 只用精确 task/container 引用接档案，不复制模型 | structure-confirmed |
| `current_physical`   | 生命周期、任务、操作回执与可见通知的有界对象活动     | `listObjectActivities`     | 原样消费并保留来源、asOf、分页和权限边界       | structure-confirmed |
| `approved_gap`       | 首个档案消费者后必须由第二个差异化真实消费者验真接口 | 路线权威与首个消费者 brief | 以清关兼容壳、写右栏和 stacked 三视口反证      | approved            |
| `industry_candidate` | 无                                                   | none                       | 不引入行业候选                                 | not-applicable      |

## 验收

- [x] `/workspaces/customs` 是第二个差异化生产消费者；现有 `/tasks` 接口和其他 RoleWorkbenchFrame 消费者未回退。
- [x] 默认仍是清关办理；无选中任务时不显示空档案入口，不创建聊天或 AI 空入口。
- [x] 档案原样接收精确 containerId/taskId/outcome；TaskArchivePanel/useTaskArchive、API、Schema、契约均未修改。
- [x] 办理 ↔ 档案往返保持当前货柜、任务、清关事实、未提交输入、右栏滚动和焦点；隐藏办理控件不可聚焦。
- [x] 任务或货柜切换、403/404、分页快照变化和任意失败不残留旧档案，并提供可达重试。
- [x] 档案不冒充清关案件历史、海关放行、全局审计或正式责任交接；现有清关完成边界保持可见。
- [x] 1440/1024/390 真实 stacked 差异、键盘/触控、截图与无横向溢出由主代理逐张核对。
- [x] 相关单测、专用 E2E、Web format/lint/typecheck/build、repo/diff 和 fresh 整体独立复审达到 medium 风险要求；最终完整门禁的环境/既有失败已分轨记录，等待 PR CI 作合并权威。
- [ ] PR CI 通过并合并后，本 brief 才标 done；随后进入任务内协作对话，不夹带于本 PR。

## Review Focus

1. 模式切换是否只是视觉隐藏，却让隐藏的清关输入仍进入 tab 顺序。
2. 进入档案后切换任务/货柜时，旧 taskId/outcome 或晚到 activities 是否在新对象下残留。
3. 返回办理是否重建 `CustomsActionPanel`，导致未提交字段、保存反馈、滚动或焦点丢失。
4. 右栏标签是否只改标题而遗漏 rail、region 或移动标签，造成读屏和视觉模式不一致。
5. 档案文案是否把货柜级相关事实误称为清关案件事实、放行依据或责任交接。

## 进度 log

| 日期       | 阶段    | 负责 | commit   | 说明                                                                                                                                              |
| ---------- | ------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-17 | design  | main | —        | 从最新 main 核对路线、首个档案消费者、生产路由和旧 worktree 所有权；选择进口清关作为第二个差异化消费者，锁定原样接口、局部模式与两片 TDD/视口门禁 |
| 2026-10-17 | coding  | main | —        | 建立功能分支与唯一 brief；等待 Codex Code 按 AC2-component-consumer 测试先行实现                                                                  |
| 2026-10-17 | review  | main | —        | AC2 组件片四文件范围正确；复现 28 项测试、lint/typecheck/build/Prettier/repo/diff 全绿，fresh 增量复审无 finding，进入三视口证据片                |
| 2026-10-17 | review  | main | —        | 视口 E2E 6 项全绿，但 390 截图证明档案屏缺当前货柜/任务/节点锚点；接受 AC2-VIS-001，状态转 fix，等待移动上下文最小修复                            |
| 2026-10-17 | review  | main | —        | 移动锚点与截图已修复且门禁通过；增量复审确认 contextReady=true 使无对象桌面/1024 右栏退化为空白，接受 AC2-FIX1-001，继续最小兼容修复              |
| 2026-10-17 | review  | main | —        | 空状态修复后 32 项组件、9 项专用 E2E、三截图哈希与质量门禁通过；fresh 整体复审 no-findings，完整门禁的环境与既有失败已分轨，进入 PR 集成          |
| 2026-10-17 | blocked | main | —        | repo:check 发现 review 上限已满；PR #182 已合并但 UI 主线收口 brief 状态滞后并占 progress-board 锁，先独立收口旧治理任务再恢复本任务集成          |
| 2026-10-17 | review  | main | a021ebaa | PR #187 已合并并释放 review/progress-board 锁；功能分支无冲突同步最新 main，恢复 review，进入最终进度板与 PR 集成                                 |
| 2026-10-17 | fix     | main | —        | PR #188 changes/static/unit/build 通过；E2E 仅 mobile 清关档案中文字形跨 Windows 稳定 4% 像素差失败，接受 AC2-CI-001，收窄修复截图容差            |
