---
status: coding
branch: feat/task-archive-ui-consumer-v1
verification: not-run
owner: main
writer: codex
risk: medium
dependsOn:
  - universal-workbench-layout-standard-v1
writeScopes:
  - docs/planning/tasks/task-archive-ui-consumer-v1.md
  - apps/web/src/components/workbench/WorkbenchLayout.vue
  - apps/web/src/components/workbench/WorkbenchLayout.test.ts
  - apps/web/src/views/TaskWorkbench.vue
  - apps/web/src/views/TaskWorkbench.test.ts
  - apps/web/src/components/task/TaskQueue.vue
  - apps/web/src/components/task/TaskQueue.test.ts
  - apps/web/src/components/task/TaskFrozenResultPanel.vue
  - apps/web/src/components/task/TaskFrozenResultPanel.test.ts
  - apps/web/src/components/task/TaskContextHeader.vue
  - apps/web/src/components/task/TaskContextHeader.test.ts
  - apps/web/src/components/task/TaskArchivePanel.vue
  - apps/web/src/components/task/TaskArchivePanel.test.ts
  - apps/web/src/composables/useTaskArchive.ts
  - apps/web/src/composables/useTaskArchive.test.ts
  - apps/web/src/composables/useTaskWorkspace.ts
  - apps/web/src/composables/useLiveWorkspace.ts
  - apps/web/src/composables/useLiveWorkspace.test.ts
  - apps/web/e2e/task-archive.spec.ts
  - apps/web/e2e/task-archive.spec.ts-snapshots/**
exclusiveLocks:
  - ui-pattern:task-archive-v1
  - ui-pattern:workbench-layout-v1
  - visual-baseline:task-archive-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/业务工作台持续打磨受阻原因.md
  - docs/product/UI_SYSTEM.md
  - docs/product/WORKSPACE_UI_INVENTORY.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
  - docs/planning/tasks/recoverable-work-sessions-v1.md
uiStructure:
  - 我的任务沿用唯一 PageHeader；其下固定为责任上下文、决策条、左任务队列、中当前任务或冻结结果、右当前可见来源档案
  - 左栏保留待处理、等待、自动监控和已完成分组；已完成任务仍可选择，但不计入待处理数，也不产生重开或执行动作
  - 中栏办理中任务继续使用现有真实任务事实和动作；已完成任务切换为冻结结果，显示正式 outcome 或明确“尚无正式结果”，不得继续渲染提交/同步步骤
  - 右栏以现有 WorkbenchPane 承接加载、空态、失败、重试、分页和来源说明；只读组合既有对象活动与任务 outcome，不保存第二份历史
  - 1440x900 三栏并列，1024x768 左窄轨或抽屉且中右并列，390x844 按队列 → 详情 → 档案显式分屏
uiMustStayVisible:
  - 我的任务身份、当前对象、当前任务、当前责任或领取状态、期限或等待原因，以及办理中或已完成文字状态
  - 已完成任务的冻结结果、结果形成时间、当前可见后续办理、档案 asOf、是否仍有更早记录和恢复读取入口
  - 档案覆盖边界：当前身份可见来源、未接通的正式责任交接快照、来源版本、协作和 AI 轨道；不得用“完整”暗示未被证明的总历史
  - 加载失败、撤权、对象切换、分页快照变化和重试结果；旧对象内容不得残留在新对象下
uiProgressiveDisclosure:
  - 每条档案记录的来源类型、来源 ID、发生时间、记录时间、操作人和技术引用按需展开
  - 已完成任务进入独立分组；分组可收拢，但任务仍可键盘选择并恢复原队列焦点
  - 来源覆盖说明与 200 条任务来源上限按需展开；关键的“当前仅为可见来源”结论在档案首屏直接显示
  - 左右栏显式折叠及移动返回恢复滚动和焦点，属于个人界面状态，不成为业务事实
uiForbidden:
  - 新建档案表、迁移、公共契约或后端读取接口；复制业务事实、从当前状态反推历史交接，或把对象活动投影冒充全局审计
  - 复制旧 ui-unification worktree 的混合 WIP、治理文件、聊天或 AI 实现；旧内容只作只读候选输入并在当前 main 重新 RED→GREEN
  - 把 projectionVersion 当成单条来源版本，把 taskId 为空或不同的记录统称为“下游后续”，或把内部 source code、状态码和 actor ID 常驻给操作人员
  - 已完成任务显示领取、完成、补证、异常上报、提交或同步中的假动作；按钮可见性不得代替服务端授权
  - 建设协作对话、AI、万能右栏 ActionPanel、全仓页面迁移或无真实消费者的通用组件
uiViewportEvidence:
  - 1440x900：PageHeader、责任上下文、决策条和三栏共同满高；完成任务可选，冻结结果与来源档案同屏；办理中与完成态往返不改变栏位顺序或宽度；页面及三个 pane 无横向溢出
  - 1024x768：左队列为窄轨或可访问抽屉，中任务结果与右档案并列；Escape、遮罩和选择关闭后焦点回到触发器；档案错误与刷新入口可达且无横向溢出
  - 390x844：队列、详情、档案显式分屏，移动第三屏文字为“档案”；面包屑保留货柜与任务，详情与档案往返恢复滚动和焦点；加载更多、错误和重试不被底部或系统键盘遮挡
---

# 任务：任务全程档案首个真实消费者 V1

## 路线图位置与目标

- **位置**：当前 UI 统一主线的第一个真实能力切片。共享层只做被 `/tasks` 真实消费者需要的窄扩展；任务档案通过后再由第二个差异化消费者验真接口，之后才进入协作、AI 和逐台扩散。
- **首个真实消费者**：生产 `/tasks` 路由的“我的任务”，不是开发控制台或旧 worktree 演示页。
- **目标岗位结果**：操作人员在原任务队列选中已完成任务即可查看冻结结果、原任务记录、当前身份可见的相关对象事实与后续办理，不必进入下游工作台反复查找；读取失败或权限变化时能清除陈旧内容并重试。
- **优先减少的损失**：任务完成后从原岗位消失导致跟进失联；把同柜后续事实误当成原任务完成证据；对象切换后残留旧档案；用不完整投影制造“全程完整”的错误判断。
- **完成声明边界**：本任务只交付“当前可见来源的任务档案”与共享右栏最小承接，不宣称六轨齐全、全局审计、正式责任交接、任一角色工作台闭环或 `WB-B01`～`WB-B10` 全部通过。

## 当前事实

1. `TaskWorkbench.vue` 目前是手写两栏，移动端只有队列/详情；未消费 `WorkbenchLayout`，也没有责任上下文、决策条和右档案栏。
2. `TaskQueue.vue` 明确过滤 `completed`，现有单测也断言已完成任务不显示。
3. `listNodeTasks` 已返回 `NodeTaskOutcome | null`，但 `useLiveWorkspace` 只投影 `TaskItem`，未向页面暴露当前原始 outcome。
4. `GET /api/containers/:containerId/activities` 已按租户、对象和 capability 合并生命周期事实、任务记录、操作回执与可见通知，并返回 `asOf`、分页和投影版本；V1 不需要后端、Schema、迁移或公共契约变化。
5. 该组合读取只代表当前身份可见的有界投影：任务来源最多读取 200 个任务；部分来源没有单条版本；当前没有正式责任交接快照、协作或 AI 轨道。界面必须直接说明这些缺口。
6. `WorkbenchLayout` 已拥有三栏稳定性、1024 抽屉、390 分屏、焦点和滚动恢复；当前移动第三屏文字固定为“编辑”，本消费者需要一个中性的消费者传入标签，默认行为必须保持不变。
7. 旧 `D:/Logixs/.worktrees/ui-unification` 基于旧 main、旧代理映射且混有档案/协作/治理 WIP；只允许只读吸收测试场景与边界，不得复制整树、提交、清理或覆盖。
8. 可恢复工作会话代码已由 PR #179 合入，但原 brief 因部分验收证据不足保持 `review`；本任务不修改会话风险面，也不把它列为未完成硬依赖。

## 边界 / 不做

- 不修改 `apps/api/**`、`database/**`、`packages/contracts/**`、权限角色包、状态机、业务动作或对象活动来源语义。
- 不新建第二套任务历史、审计、责任或交接事实；档案只保存 UI 临时状态，不持久化业务记录。
- 不把不同 `taskId` 或空 `taskId` 的对象事实断言为“下游”“后来”或“原任务结果”；采用中性的“相关对象事实”。
- 不把 `projectionVersion` 显示为来源记录版本；单条版本缺失时明确“当前来源未提供版本”。
- 不把已完成任务重新变成待处理，不调用 claim/complete，不显示提交、同步、补证或异常上报控件。
- 不接通任务内协作、AI、更多功能、导出、偏好、全仓换皮或第二消费者。
- 不触碰旧 `ui-unification` worktree 的任何文件或状态。

## 架构与接口

### 文件职责

| 文件                        | 职责                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `WorkbenchLayout.vue`       | 只新增消费者可传入的移动第三屏标签，默认仍为“编辑”；不得含档案语义或改变其他消费者几何                      |
| `useLiveWorkspace.ts`       | 从现有 `NodeTaskDetail[]` 暴露 `activeTaskOutcome: ComputedRef<NodeTaskOutcome                              | null>`，不复制 outcome 模型 |
| `TaskQueue.vue`             | 保留既有待处理、等待与自动监控排序；新增已完成分组，完成项可选择但不计入待处理数                            |
| `TaskFrozenResultPanel.vue` | 只读显示完成任务上下文与正式 outcome；outcome 缺失时明确未知，不渲染任何写控件                              |
| `useTaskArchive.ts`         | 编排现有 `listObjectActivities`，负责对象切换竞态、快照一致、分页去重、撤权/失败清空与重试                  |
| `TaskArchivePanel.vue`      | 显示正式结果引用、当前可见后续办理、原任务记录、相关对象事实、来源详情与覆盖边界                            |
| `TaskWorkbench.vue`         | 使用现有 PageHeader、ResponsibilityBand、DecisionStrip、WorkbenchLayout 和 WorkbenchPane 组合唯一真实消费者 |
| `task-archive.spec.ts`      | 用受控真实契约形状验证三视口、状态往返、键盘/焦点、无溢出和版本化截图                                       |

### 固定接口

```ts
// WorkbenchLayout.vue：默认值保持“编辑”
mobileContextLabel?: string;

// useLiveWorkspace.ts / useTaskWorkspace.ts
activeTaskOutcome: ComputedRef<NodeTaskOutcome | null>;

// useTaskArchive.ts
interface TaskArchiveState {
  items: ShallowRef<ObjectActivityItem[]>;
  nextActions: ShallowRef<ObjectNextAction[]>;
  asOf: ShallowRef<string | null>;
  projectionVersion: ShallowRef<number | null>;
  loading: ShallowRef<boolean>;
  error: ShallowRef<string>;
  hasMore: ShallowRef<boolean>;
  load(containerId: string): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
}

// TaskFrozenResultPanel.vue / TaskArchivePanel.vue
TaskFrozenResultPanelProps = {
  task: TaskItem;
  container: ContainerProjection;
  outcome: NodeTaskOutcome | null;
};
TaskArchivePanelProps = {
  containerId: string;
  taskId: string;
  outcome: NodeTaskOutcome | null;
};
```

`refresh()` 必须重读当前 container；没有当前 container 时清空。首次加载、对象切换、撤权、404、分页快照变化或任意失败都不能继续展示上一对象记录。

## 实施计划与人工转发信封

### 切片 `TA1-real-consumer`

**目标**：测试先行地把共享窄扩展、档案读取和生产 `/tasks` 消费者同片交付；切片结束时功能可由组件测试验证，但尚不以截图或完整门禁宣称完成。

| 项目        | 内容                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 基线        | `b8e401e6822434bafb0f2023d901218bf5dd8051`                                                                                   |
| 执行角色    | Codex Code 实现执行器；`HANDOFF.model` 如实登记实际模型                                                                      |
| 主代理审查  | Claude Code 检查真实 diff、写范围、RED/GREEN 证据、业务语言、完成态无写控件和其他消费者兼容性；不直接修改实现文件            |
| 独立复审    | 本片不单独触发；TA2 完成并形成 PR 候选后由 fresh Claude Code 对整体中风险 UI 切片只读复审                                    |
| 写入范围    | frontmatter `writeScopes` 中除 E2E spec/snapshots 外的全部 Web 与测试文件；本 brief 仅由主代理维护                           |
| 禁止范围    | API、Schema、迁移、契约、授权政策、旧 worktree、协作、AI、其他工作台、进度板                                                 |
| UI 强制结构 | 完整遵守 frontmatter 五项；不得把它改写成组件清单、字段卡墙或两栏长页面                                                      |
| 停止条件    | 现有 API 无法提供至少两个真实来源；实现需要公共契约/权限/Schema 变化；完成态仍出现写动作；对象切换残留旧档案；出现范围外改动 |

- [x] **TA1.1 RED：共享布局保持兼容。** 在 `WorkbenchLayout.test.ts` 先断言消费者可传入第三屏“档案”，未传时仍显示“编辑”，三 pane DOM 顺序和 stacked/standard 既有行为不变；运行定向测试，预期新增断言失败。
- [x] **TA1.2 GREEN：最小共享扩展。** 仅在 `WorkbenchLayout.vue` 增加 `mobileContextLabel?: string`，默认“编辑”，移动 context 按该值显示；重跑布局测试通过。
- [x] **TA1.3 RED：已完成队列与正式结果。** 修改 `TaskQueue.test.ts`，断言待处理排序/计数不变、已完成独立分组、完成项可选择且不显示执行动作；新增 `TaskFrozenResultPanel.test.ts`，断言有 outcome 时显示冻结状态和形成时间，无 outcome 时显示未知，DOM 中不存在领取/完成/提交/同步/补证/上报控件；运行测试，预期失败。
- [x] **TA1.4 GREEN：完成态只读承接。** 修改 `TaskQueue.vue`，新增按结果形成时间不可得时保持现有返回顺序的已完成分组；创建 `TaskFrozenResultPanel.vue`，复用 `TaskContextHeader` 的岗位语言，只读显示 `NodeTaskOutcome`，不得复用会生成 submit/sync 流的 `TaskExecutionPanel`。
- [x] **TA1.5 RED：原始 outcome 与档案状态。** 在 `useLiveWorkspace.test.ts` 断言选择完成任务后 `activeTaskOutcome` 精确引用该 `NodeTaskDetail.outcome`，切到无 outcome 任务后为 null；新增 `useTaskArchive.test.ts` 覆盖晚到旧响应丢弃、分页边界去重、`asOf/projectionVersion` 漂移、分页撤权/404/失败清空、refresh 重读当前对象；运行测试，预期失败。
- [x] **TA1.6 GREEN：组合现有读取。** 修改 `useLiveWorkspace.ts`、`useTaskWorkspace.ts` 暴露原始 outcome；创建 `useTaskArchive.ts`，仅调用现有 `listObjectActivities`，实现固定接口和失败清空，不新增缓存或业务推断。
- [x] **TA1.7 RED：档案语义与真实消费者结构。** 新增 `TaskArchivePanel.test.ts`，断言原任务记录与中性“相关对象事实”分组、正式 outcome、有界覆盖说明、来源版本缺失、部分来源不可见不报错、加载/失败/重试/加载更多；新增 `TaskWorkbench.test.ts`，断言固定六区顺序、责任/期限或未知、办理中与完成态往返不改变三 pane、完成态中栏无写控件、移动标签为档案；运行测试，预期失败。
- [x] **TA1.8 GREEN：生产 `/tasks` 成为首个消费者。** 创建 `TaskArchivePanel.vue`；重构 `TaskWorkbench.vue` 使用既有共享原语和 `WorkbenchPane`，办理中继续复用 `TaskExecutionPanel`，完成态改用 `TaskFrozenResultPanel`，右栏始终保留。只显示人能理解的来源标签；内部 source code/ID 放入 details。
- [x] **TA1.9 最近验证。** 运行 `pnpm --filter @logix/web exec vitest run`，只指定本切片相关测试文件；再运行 `pnpm --filter @logix/web lint`、`pnpm --filter @logix/web typecheck`、`pnpm --filter @logix/web build`。任何失败如实列入 HANDOFF，不扩大范围修复无关失败。
- [x] **TA1.10 范围核对与交回。** 运行 `pnpm repo:check`、`git diff --check`、精确文件 Prettier check；核对实际 diff 全在 writeScopes，返回 `logix-handoff/v1`，默认不提交，`nextSuggested: TA2-viewport-evidence`。

实现任务：

```text
TASK docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-real-consumer base=b8e401e6822434bafb0f2023d901218bf5dd8051 role=implementer workspace=D:/Logixs
```

### 切片 `TA2-viewport-evidence`

**目标**：在 TA1 主代理验收后补齐生产消费者的三视口结构、状态往返、键盘与视觉证据，完成任务级门禁与整体独立复审。

| 项目     | 内容                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 基线     | TA1 主代理验收后给出的当前 SHA 或可复现未提交差异的真实 base                                                                                     |
| 写入范围 | `apps/web/e2e/task-archive.spec.ts`、其版本化 snapshots、必要的本 brief 验收记录；发现产品 finding 时只在既有 TA1 writeScopes 内由修复 TASK 处理 |
| 禁止范围 | 不以更新截图掩盖结构错误；不修改 API fixture 形状绕过真实契约；不运行旧 worktree 测试或复制其图片                                                |
| 视觉证据 | frontmatter `uiViewportEvidence` 三项全部覆盖，且至少验证一次办理中 ↔ 已完成往返；截图只使用明确标记的受控 fixture，不冒充真实业务数据           |
| 停止条件 | 任一视口横向溢出、内容首屏不可达、队列抽屉不可键盘退出、完成态出现写动作、状态往返改变结构、像素变化未人工解释                                   |

- [ ] **TA2.1 RED：三项目 E2E 契约。** 创建 `task-archive.spec.ts`，使用当前 API DTO 形状拦截 `/api/containers`、`/api/node-tasks` 和 `/activities`；先断言 1440 三栏、1024 抽屉 + 中右并列、390 队列/详情/档案分屏、完成态无写控件、状态往返结构稳定、页面和 pane 无横向溢出；运行三 Playwright 项目，预期在当前实现或缺少基线时失败。
- [ ] **TA2.2 GREEN：只修真实 finding。** 根据 E2E 失败在 TA1 已授权文件内做最小修复；不改变接口、业务语义或视口合同。
- [ ] **TA2.3 版本化截图。** 在三项目分别生成并提交完成态真实消费者基线；至少另用结构断言覆盖办理中往返。逐张人工核对身份、责任、结果、档案边界、主线、恢复入口、重复文案和内容克制，记录截图路径与结论。
- [ ] **TA2.4 任务级门禁。** 运行相关 Web 单测、三项目 E2E、Web lint/format:check/typecheck/build、`pnpm repo:check`、`git diff --check`；完整 `pnpm validate` 只在最终 PR 候选运行一次，环境或无关既有失败分轨记录，不伪造通过。
- [ ] **TA2.5 整体独立复审。** fresh Claude Code 只读检查 `base...HEAD` 或工作树差异，重点复审数据真实性、权限来源裁剪、完成态无动作、异步竞态、三视口与旧消费者兼容；主代理对 findings 逐项形成 `logix-disposition/v1`。
- [ ] **TA2.6 集成。** findings 全部处置、门禁达到 medium 风险要求后，精确暂存、形成单一任务 PR、等待必需 CI，通过后合并；不把协作、AI 或第二消费者夹带进本 PR。

## 智慧开启基线继承

本任务不是 23 台中的某一岗位工作台业务复审，而是跨工作台“我的任务”共享能力切片；因此不重开任何单台业务目的，只继承跨台基线。

| 基线原结论                                                          | 处置 | 依据                                         | 本任务落点                                                         |
| ------------------------------------------------------------------- | ---- | -------------------------------------------- | ------------------------------------------------------------------ |
| `全局.md`：交出去不等于下游接收，当前缺正式接收与唯一责任事实       | 沿用 | 当前对象活动没有正式不可变交接快照           | 档案明确“交接快照未接通”，不从 assignee、状态或后续任务推断        |
| `全局.md`：状态、责任、时限与权限不能由各页自行发明                 | 沿用 | 服务端 capability 与来源投影已存在           | 前端只显示 API 返回的任务、nextAction 与可见来源；未知直接显示未知 |
| `业务工作台持续打磨受阻原因.md`：横向治理不能继续压过真实可见消费者 | 补强 | 现行路线已定“共享组件与首个真实消费者同片”   | 不先造平台；共享扩展只随生产 `/tasks` 需要产生                     |
| 同文件：不能宣布 validated 不等于不能推进边界清楚薄片               | 沿用 | 当前缺真实岗位六路径，但读取边界已定且可回滚 | 允许完成 UI/API 复用和自动化，真实岗位验证只阻止整台闭环声明       |

## 负责人决策记录

| 决策 ID | 已知事实与选项                                                                                                                  | 推荐与理由                                                 | 负责人结论                                           | 权威落点 / 状态                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| TA-D01  | A：沿现行任务档案优先；B：Stuffing 首样板优先。A 无需改路线且直接接首个真实能力；B 更快产生单台响应式样板但改变 2026-10-16 顺序 | 推荐 A，先让共享右栏由真实档案数据验真，避免再次改线       | 2026-10-17 选择 A，继续现行“任务档案优先”            | `doc/cross-border-supply-chain/14-roadmap-decisions.md` 已是现行权威；confirmed |
| TA-D02  | “全程”可以指绝对完整审计，也可以指任务页上的当前可见来源组合投影。现有读取有 200 任务上限、缺部分来源版本与交接快照             | 采用“任务全程档案（当前可见来源）”，直接披露边界，不扩后端 | 沿用 2026-10-16 已定路线与本次“继续”授权；无新增政策 | 已批准 UI 标准 §12/§18.3；confirmed                                             |

## 同一业务步骤五面映射

| 业务步骤与岗位结果 | 岗位任务                                       | 数据事实                                                       | 技术保障                                          | 权限边界                                                                        | 界面承接                                        | 验收状态                           |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| 选择已完成原任务   | 在原队列找到并选中完成项，不误计为待处理       | `NodeTask.state`、原任务 ID、container ref、`NodeTaskOutcome   | null`                                             | 现有稳定分页；选择状态单一；无写动作                                            | 仍由 `task.read` 与租户/对象范围控制；UI 不提权 | 左已完成分组；中冻结结果；三栏保持 | 待 TA1/TA2 |
| 查看原任务正式结果 | 分清正式 outcome 与普通当前状态，缺失时不猜    | `NodeTaskOutcome` 的状态迁移、事件码、工单引用和 evaluatedAt   | 直接引用原 DTO；不复制模型或持久化                | 只消费已授权 task detail                                                        | 中栏只读，禁止 claim/complete/submit/sync       | 待 TA1                             |
| 查看当前可见档案   | 分清原任务记录与相关对象事实，检查当前后续办理 | ObjectActivity、nextActions、asOf、projectionVersion、来源引用 | 对象切换 generation、分页去重、快照一致、失败清空 | `container.read + lifecycle.read`；task/notification 来源按各自 capability 裁剪 | 右栏来源时间线、覆盖说明、刷新/重试/加载更多    | 待 TA1/TA2                         |
| 跨视口往返         | 不丢当前对象、任务、滚动和焦点                 | UI 锚点，不是业务事实                                          | 复用 WorkbenchLayout 的抽屉、分屏和记忆           | 不改变服务端权限                                                                | 1440/1024/390 固定因果顺序                      | 待 TA2                             |

## 相关数据事实子集（三轨）

| 轨道                 | 事实                                         | 当前来源                            | 本任务处置                                        | 状态                |
| -------------------- | -------------------------------------------- | ----------------------------------- | ------------------------------------------------- | ------------------- |
| `current_physical`   | NodeTask 及可选 outcome                      | `listNodeTasks`                     | 暴露 active raw outcome，完成态只读               | structure-confirmed |
| `current_physical`   | 生命周期、任务、操作回执和可见通知的对象活动 | `listObjectActivities`              | 只读组合，保留 sourceType/sourceId/时间/asOf/分页 | structure-confirmed |
| `approved_gap`       | 已完成任务须留在原岗位并可查看引用式档案     | UI 标准 §12、§18.3；路线图顺序 3～4 | `/tasks` 成为首个真实消费者                       | approved            |
| `approved_gap`       | 来源版本、正式责任交接、协作和 AI 轨道未齐   | UI 标准 §12 的目标与当前 API 反证   | 就地披露，延期到各自权威生产者，不伪造            | approved-boundary   |
| `industry_candidate` | 无                                           | none                                | 不引入行业候选                                    | not-applicable      |

## Review Focus

1. **晚到旧请求**：从任务 A 快速切到 B 时，A 的活动响应不得覆盖 B；`useTaskArchive.test.ts` 固定反证。
2. **权限在分页中撤销**：第一页可见、下一页 403/404 时必须清空全部旧档案，而不是保留敏感记录；`useTaskArchive.test.ts` 固定反证。
3. **完成任务没有 outcome**：必须显示未知与覆盖缺口，不能从 `state=completed` 伪造交接/事件；`TaskFrozenResultPanel.test.ts` 固定反证。
4. **同柜但非原任务事实**：不同或空 `taskId` 只称相关对象事实，不称下游、后续完成证据；`TaskArchivePanel.test.ts` 固定反证。
5. **活动/完成往返与视口变化**：栏位、顺序、宽度、焦点、滚动和动作真值保持；`TaskWorkbench.test.ts` 与 `task-archive.spec.ts` 固定反证。

## TA1 主代理评审与 finding 裁决

2026-10-17 主代理以 `ac4ccdc2...` 为审核基线核对实际未提交 diff；15 个实现文件全部在 TA1 授权范围内，未触及 API、Schema、契约、权限或旧 worktree。主代理复现定向 Vitest `7 files / 33 tests passed`、Web lint、typecheck、build、`pnpm repo:check` 和 `git diff --check` 均通过；TA2 三视口与截图按计划未运行。现有绿色测试仍遗漏以下当前切片失败场景，因此 TA1 保持 `fix`，不得进入 TA2。

```yaml
protocol: logix-disposition/v1
slice: TA1-real-consumer
decisions:
  - finding: TA1-REV-001
    status: accepted
    reason: containerId 路由切换开始后，detail/archive state 未跟随 workspace loading/error 清空，旧对象结果与档案可在新 URL 下继续显示
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-1-truth-and-races
  - finding: TA1-REV-002
    status: accepted
    reason: useLiveWorkspace.reload 无 generation/快照过滤，A→B 并发读取可由迟到 A 覆盖当前 B 范围
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-1-truth-and-races
  - finding: TA1-REV-003
    status: accepted
    reason: completed task 的 nextAction 为 null 时投影 fallback “已分配”不是当前责任或正式交接事实
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-1-truth-and-races
  - finding: TA1-REV-004
    status: accepted
    reason: real API 的 eventCode/definition key 与 assigneeId 被提升为常驻操作语言，违反内部 code/actor ID 渐进披露边界
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-1-truth-and-races
  - finding: TA1-REV-005
    status: accepted
    reason: loadMore 用较晚响应覆盖首屏 nextActions，却继续显示原 asOf，形成混合快照
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-1-truth-and-races
next: fix
```

### 切片 `TA1-fix-1-truth-and-races`

- [x] 在 `useLiveWorkspace.test.ts` 先用 A/B deferred reload 证明 B 先完成、A 后完成时最终 tasks、active task/container、outcome、loading、error、分页均保持 B；再为 `reload()` 增加 generation，并在请求开始时捕获该次 `containerIdFilter`，迟到请求不得 rebuild、rememberPage 或结束当前 loading。
- [x] 在 `TaskWorkbench.test.ts` 先证明已有 A 后切换 B 且 B pending/rejected 时 A 的中栏与档案立即消失；再让 detail/archive state 同步 workspace loading/error，路由范围变化时先隐藏旧对象内容，失败后不恢复 A。
- [x] 在 `TaskWorkbench.test.ts` 增加 completed + `nextAction: null` 的真实投影场景，断言“当前责任”为未知或“正式交接未提供”，且不出现“已分配”或上一责任人；开放任务仍显示合法任务池/assignee。实现不得从 `TaskItem.assignment` 为完成态推断当前责任。
- [x] 在 `TaskArchivePanel.test.ts` 使用真实 API 形状：`title: customs_cleared`、`title: wo-customs`、`assigneeId: user-uuid`。常驻标题必须通过既有事件/节点/动作语言映射或中性中文表达；原始 title、assigneeId、source code 只允许进入折叠的“来源详情/技术引用”，不得作为常驻标题或责任。
- [x] 在 `useTaskArchive.test.ts` 让第一页 nextAction A、第二页同 asOf/version 但 nextAction B；加载更早记录后活动条目追加但 nextActions 保持第一页快照。只有显式 refresh/load 才更新 nextActions。
- [x] 重跑 TA1 七个定向 suite、Web lint/typecheck/build、精确 Prettier check、`pnpm repo:check`、`git diff --check`；返回新的 HANDOFF，未通过前不开始 TA2。

主代理复核：上述 5 项原 finding 均有对应 GREEN 反证；定向 suite `7 files / 39 tests passed`，Web lint/typecheck/build、精确 Prettier、repo/diff 检查通过。增量审查继续发现 3 项同类当前切片缺口，转入下一修复片：

```yaml
protocol: logix-disposition/v1
slice: TA1-fix-1-truth-and-races
decisions:
  - finding: TA1-REV-006
    status: accepted
    reason: reload 有 generation，但旧范围 loadMore 没有捕获 generation/scope；迟到分页仍可把 A 追加到已经完成的 B 并覆盖 B 的分页
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-2-pagination-and-result-truth
  - finding: TA1-REV-007
    status: accepted
    reason: 开放任务常驻责任仍直接显示 nextAction.assigneeId；该值是 opaque actor ID，不是人类可读责任名称
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-2-pagination-and-result-truth
  - finding: TA1-REV-008
    status: accepted
    reason: completed + outcome null 时 TaskContextHeader 仍用 liveDone 显示“完成结果/已入账”，与冻结结果“尚无正式结果”直接矛盾
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-2-pagination-and-result-truth
next: fix
```

### 切片 `TA1-fix-2-pagination-and-result-truth`

- [x] 在 `useLiveWorkspace.test.ts` 先让 A 首屏产生 cursor、A `loadMore()` pending，然后切 B 并完成 B reload，最后返回 A 分页；断言 B 的 tasks/details/containers/outcome/cursor/hasMore 不变，A 行、A 缺柜补读和 A 错误均不得落入 B。实现让 `loadMore()` 捕获发起时的 reload generation、container scope 与 cursor，任何变化后只丢弃旧响应，不 rebuild、不 rememberPage、不写 error、不结束新请求状态。
- [x] 在 `TaskWorkbench.test.ts` 使用开放、已分配且 `assigneeId=user-uuid` 的真实投影，断言责任带不显示 opaque ID，只显示“进行中”“已分配人员”等既有语义标签；pool/unassigned 仍显示“待领取”。不得修改后端或伪造人员姓名。
- [x] 在 `TaskFrozenResultPanel.test.ts` 增加 completed + outcome null 的完整可见文案断言：页面任何位置都不得出现“已入账”或其他泛化完成结果，只显示“尚无正式结果 / 结果形成时间未知”。最小实现可以给 `TaskContextHeader` 增加不推断 completed result 的中性显示契约，但必须保持其余现有消费者和 outcome-present 行为；若触及 `TaskContextHeader.vue/.test.ts`，先将两个文件加入本 brief 精确 writeScopes，再由 Codex 测试先行修改。
- [x] 重跑 TA1 全部相关测试以及 `TaskContextHeader.test.ts`（如触及）、Web lint/typecheck/build、精确 Prettier、repo/diff；未通过前不进入 TA2。

主代理最终 TA1 验收：REV-006～008 反证通过；定向 suite `8 files / 44 tests passed`，Web 全量单测 `168 files / 800 tests passed`，Web lint/typecheck/build、精确 Prettier、repo/diff 检查均通过。fresh 增量只读复审结论为 `no findings`；TA1 当前范围完成，进入 TA2，但不宣称三视口或任务级完成。

修复任务：

```text
TASK docs/planning/tasks/task-archive-ui-consumer-v1.md#TA1-fix-2-pagination-and-result-truth base=ac4ccdc23a9aa340f8569b5128b266db97f1da80 role=implementer workspace=D:/Logixs
```

### TA2 主代理视觉复核与整体复审裁决

主代理核对 TA2 只新增 E2E spec 和三张版本化截图；在不停止既有 5173 服务的前提下，以一次性隔离 5175 配置复现三项目 `3 passed / 6 viewport skips`，随后删除临时配置并停止隔离服务。三张截图尺寸为 1440×900、1024×768、390×844，逐张确认正式身份、责任未知、只读冻结结果、当前可见来源边界、主动作与恢复入口；没有页面横向溢出或状态造假。Web format/lint/typecheck/build、repo/diff 均复现通过。

整体 fresh 复审提出 4 项意见，主代理裁决如下：

```yaml
protocol: logix-disposition/v1
slice: TA2-viewport-evidence
decisions:
  - finding: TA2-REV-001
    status: rejected
    reason: 超过首 200 条任务需继续使用既有稳定分页“再看后面”；V1 已由 TA-D02 定为有界当前可见来源，不批准 task-id/completed 专用后端查询或无界加载
    writeback: none
  - finding: TA2-REV-002
    status: rejected
    reason: TA1.4 明确规定结果形成时间不可得时保持现有返回顺序；当前 TaskItem 不拥有 evaluatedAt，本片不扩公共投影契约
    writeback: none
  - finding: TA2-REV-003
    status: rejected
    reason: 活动首页与 cursor 页的 asOf 均为 2026-10-17T09:00:00.000Z、projectionVersion 均为 23；17 属于 node-task page；隔离三项目已实际通过
    writeback: none
  - finding: TA2-REV-004
    status: accepted
    reason: 1024 已验证 Escape 与选择关闭，但漏掉 brief 明文要求的遮罩关闭及焦点返回反证；产品行为已有参考页覆盖，本任务仍须在真实消费者 E2E 证明
    writeback: docs/planning/tasks/task-archive-ui-consumer-v1.md#TA2-fix-1-backdrop-evidence
next: fix
```

### 切片 `TA2-fix-1-backdrop-evidence`

- [x] 只修改 `apps/web/e2e/task-archive.spec.ts`：在 1024 用例中重新打开 drawer，点击 `关闭任务队列抽屉` 遮罩，断言 dialog 隐藏且 `打开任务队列` 触发器重新聚焦；随后继续现有选择关闭、错误恢复和截图流程。
- [x] 使用隔离端口运行三 Playwright 项目；截图内容若不变不得更新 PNG。再运行 E2E spec Prettier、Web format/lint/typecheck/build、repo/diff；返回 HANDOFF 后主代理继续最终门禁。

主代理复核：修复只修改 E2E spec，三张 PNG 保持原哈希；隔离 5175 三项目 `3 passed / 6 viewport skips`，遮罩关闭后 dialog 隐藏且触发器恢复焦点。临时配置和服务已清理。TA2 当前验收与整体复审 finding 裁决完成，进入最终 PR 候选门禁。

修复任务：

```text
TASK docs/planning/tasks/task-archive-ui-consumer-v1.md#TA2-fix-1-backdrop-evidence base=73cb7beaf3b6aa10fa25c4764ea7693837980e5a role=implementer workspace=D:/Logixs
```

## 验收

- [x] `/tasks` 是首个真实消费者，完成任务可选择但不计入待处理；办理中任务行为未回退。
- [x] 完成态中栏只显示冻结结果或明确未知，不出现任何写动作、提交或同步假步骤。
- [x] 右档案至少组合两个现有真实领域来源，原任务记录与相关对象事实分开；没有新表、后端接口或复制事实。
- [x] 来源裁剪沿用服务端 capability；部分来源不可见是正常有界视图，403/404/快照漂移会清除陈旧数据。
- [x] `asOf`、分页状态、来源与记录时间、缺失来源版本、200 任务上限及未接通轨道表达真实。
- [x] 三标准视口截图、结构、键盘、焦点、滚动与无横向溢出证据由主代理逐张核对通过。
- [ ] 相关单测、E2E、Web lint/format/typecheck/build、repo/diff 检查通过；最终 PR 候选只运行一次适用完整门禁。
- [x] fresh 独立复审 findings 全部完成裁决；PR CI 通过后才能合并并把 brief 标 `done`。
- [x] 本切片只完成任务档案与首个共享右栏消费者，不宣称协作、AI、六轨总历史或任何岗位工作台闭环。

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                                                                                                          |
| ---------- | ------ | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-17 | design | main | —      | 负责人选择继续现行“任务档案优先”；核对当前 main、共享 UI、现有对象活动读取和旧 worktree 候选，建立当前 main 唯一活动 brief    |
| 2026-10-17 | coding | main | —      | 锁定 TA1/TA2、精确写范围、三视口与当前可见来源边界；等待 Codex Code 按 TA1 测试先行实现                                       |
| 2026-10-17 | review | main | —      | 核对 TA1 实际 diff 并复现 33 项测试、lint/typecheck/build/repo/diff；接受 5 项真值与竞态 finding，状态转 fix                  |
| 2026-10-17 | fix    | main | —      | 复核首轮 5 项修复与 39 项测试；原 finding 关闭，增量接受分页跨范围、opaque 责任 ID、缺 outcome 假“已入账”3 项 finding         |
| 2026-10-17 | coding | main | —      | 第二轮 3 项修复通过 44 项定向、800 项 Web 全量、lint/typecheck/build/repo/format/diff；增量复审无 finding，TA1 验收，进入 TA2 |
| 2026-10-17 | review | main | —      | TA2 三视口与截图人工复核通过；整体复审 3 项越界/事实错误意见驳回，接受 1 项 1024 遮罩关闭证据缺口，状态转 fix                 |
| 2026-10-17 | review | main | —      | 遮罩关闭与焦点恢复反证通过，三 PNG 未变；安全审查无 High/Medium finding，全部实现片完成，进入最终 PR 候选门禁                 |
