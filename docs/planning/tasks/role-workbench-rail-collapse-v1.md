---
status: review
branch: fix/role-workbench-rail-collapse-v1
verification: "PR candidate local evidence (2026-10-18): focused Vitest 4 files / 37 tests, full Web unit 168 files / 825 tests, Customs/CargoReady/Stuffing three-project Playwright 30/30, desktop rail-fold stress 3/3, Web lint/typecheck/build, scoped Prettier, repo/diff checks, and fresh overall review passed with no remaining findings. Existing customs archive viewport PNG hashes remained unchanged. Final deterministic progress board, PR CI, merge, and post-merge closeout are pending."
owner: main
writer: codex
risk: medium
dependsOn:
  - universal-workbench-layout-standard-v1
writeScopes:
  - docs/planning/tasks/role-workbench-rail-collapse-v1.md
  - apps/web/src/components/workbench/RoleWorkbenchFrame.vue
  - apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts
  - apps/web/src/components/workbench/WorkbenchLayout.vue
  - apps/web/src/components/workbench/WorkbenchLayout.test.ts
  - apps/web/src/components/workbench/WorkbenchPane.vue
  - apps/web/src/components/workbench/WorkbenchPane.test.ts
  - apps/web/src/components/workbench/OperationalWorkQueues.test.ts
  - apps/web/src/components/cargo-ready/CargoReadyWorkQueue.vue
  - apps/web/src/components/stuffing/StuffingWorkQueue.vue
  - apps/web/e2e/customs-task-archive.spec.ts
  - apps/web/e2e/cargo-ready-workbench.spec.ts
  - apps/web/e2e/stuffing-workbench.spec.ts
  - docs/planning/progress-board.html
exclusiveLocks:
  - ui-pattern:workbench-layout-v1
  - ui-pattern:role-workbench-frame-v1
sharedIntegrationScopes:
  - docs/planning/progress-board.html
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/product/UI_SYSTEM.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
uiStructure:
  - RoleWorkbenchFrame 继续保持 PageHeader、责任上下文、决策条、左任务池、中岗位事实、右操作上下文的固定顺序；折叠只改变左右栏呈现，不删除栏位语义或中栏
  - 左右折叠属于共享兼容壳内部个人 UI 状态，由 RoleWorkbenchFrame 统一持有；七个业务消费者不各自复制状态或业务判断
  - 桌面左、中、右栏统一由 WorkbenchPane 正文作为唯一纵向滚动容器，栏头、折叠按钮和摘要固定；业务 slot 只提供自然流式内容
  - 1440 桌面允许左右栏独立或同时收为满高窄轨；1024/390 继续保留当前 stacked 兼容拓扑并由页面主滚动承接，但栏内不得再建立嵌套纵向滚动区
uiMustStayVisible:
  - 折叠后左轨保留任务池摘要与展开入口，右轨保留操作上下文摘要与展开入口
  - 中间岗位事实、PageHeader、责任上下文和决策条在任何折叠组合下保持可见且顺序不变
  - 展开后恢复原 pane 内容、可访问名称、折叠前焦点和该栏原 scrollTop；另一栏与页面滚动位置不得被改动
  - 桌面每个 pane 恰有一个共享纵向滚动 owner；1024/390 的页面主滚动下，业务 slot 内不得再出现纵向 auto/scroll 容器
uiProgressiveDisclosure:
  - 折叠态只显示消费者既有 leftRailSummary/rightRailSummary，不增加业务字段、状态推断或新设置面板
  - 折叠选择只在当前组件实例内保留；跨刷新、跨设备或工作会话持久化不属于本修复
uiForbidden:
  - 修改七个 RoleWorkbenchFrame 业务页面、复制折叠或 scrollTop 状态到各页面、改变业务事实或动作
  - 在业务 queue/action/fact 组件内设置纵向 max-height + overflow-y auto/scroll，或创建第二个主要纵向滚动容器
  - 把 1024/390 的当前 stacked 兼容拓扑包装成最终标准实现，或在本修复中改造为 standard 三栏/显式分屏；该历史兼容债不属于本片
  - 修改 CollapsibleRail 公共事件契约、主题、API、Schema、契约或工作会话持久化
  - 用 CSS 强制隐藏代替状态接线、用等待/sleep掩盖过期 Vite module graph，或仅修改测试挂载器制造通过
uiViewportEvidence:
  - 1440x900：清关真实消费者左右栏可独立及同时折叠；窄轨宽度与摘要/展开入口可见，中栏扩展且无横向溢出；左右栏可分别滚动，折叠/展开恢复各自 scrollTop 和焦点，另一栏不移动
  - 1024x768：当前 stacked 兼容拓扑保持；页面主滚动是唯一纵向 owner，左右栏业务内容无嵌套纵向滚动，折叠内容/摘要可切换和恢复且无横向溢出
  - 390x844：当前纵向 stacked 顺序不变，桌面折叠控制保持隐藏；页面主滚动唯一，业务 slot 无嵌套纵向滚动且无页面横向溢出
---

# 任务：RoleWorkbenchFrame 左右栏折叠修复 V1

## 目标与根因

- **用户结果**：使用备货、装箱、出运调度、进口清关、提柜、送仓或卸柜工作台时，桌面左右栏能真实折叠/展开，并由共享壳统一承担栏内纵向滚动与折叠后的滚动恢复；业务页面只提供内容。
- **折叠根因**：`CollapsibleRail` 只发 `update:collapsed`；`WorkbenchLayout` 继续上抛 `update:leftCollapsed/rightCollapsed`；`RoleWorkbenchFrame` 没有保存或回传这两个受控状态，所以七个兼容壳消费者每次仍收到默认 `false`。
- **滚动根因**：`WorkbenchPane` 已有唯一 `.workbench-pane__scroll--independent`，但 `CargoReadyWorkQueue` 与 `StuffingWorkQueue` 又各自建立 `max-height: 680px + overflow-y:auto`，形成嵌套纵向滚动；`WorkbenchLayout` 只在移动屏切换时记忆 scrollTop，尚未在左右栏折叠/展开时统一恢复。
- **测试环境事实**：fresh 当前源码已证明双折叠稳定为 `48px / 中栏 / 48px`；曾出现的真实 E2E 几何重置来自复用源码版本过期的 Vite module graph，不是 v-model 或 CSS 根因。测试必须使用 fresh server，不得加 sleep 或产品 workaround。
- **正面样例**：`TaskWorkbench`、`ProductSelectionWorkbench`、`MarketSignalsWorkbench` 与参考页都用 `v-model:left-collapsed/right-collapsed` 接住事件，折叠正常。
- **测试缺口**：`WorkbenchLayout.test.ts` 的 mount helper 手工 `setProps` 模拟父级回写，只证明公共布局在消费者正确接线时有效；`RoleWorkbenchFrame.test.ts` 未实际点击折叠/展开。

## 影响范围

经 `RoleWorkbenchFrame` 的七个生产消费者统一受影响：CargoReady、Stuffing、PreDepartureDispatch、Customs、Pickup、WarehouseDelivery、ContainerUnloading。直接消费 `WorkbenchLayout` 且已有 v-model 的页面不受影响。

## 固定方案

1. `RoleWorkbenchFrame` 内部使用两个 `ref(false)` 持有 `leftCollapsed` / `rightCollapsed`，并以 v-model 接到 `WorkbenchLayout`；七个业务页面不复制状态。
2. `WorkbenchPane` 保持每栏唯一主要纵向 scroll owner；不增加第二个容器。
3. `WorkbenchLayout` 在左右栏折叠前分别记录共享 scroll owner 的 scrollTop，展开后的 nextTick 恢复该栏 scrollTop；不改变另一栏或页面滚动。
4. `CargoReadyWorkQueue` 与 `StuffingWorkQueue` 删除 `.queue-list` 的纵向 `max-height/overflow-y`，内容自然流入共享 pane owner；横向筛选 overflow 保留。
5. 1024/390 保留当前 stacked 兼容拓扑，由页面主滚动承接；本片只保证业务 slot 不再嵌套纵向滚动，不把历史兼容拓扑宣称为最终 UI 标准。
6. `WorkbenchLayout` 的滚动状态机以父级实际接受后的 `leftCollapsed/rightCollapsed` props transition 为唯一权威；按钮只 emit。每栏使用独立 generation 与 mounted guard，陈旧异步恢复不得覆盖最新状态、另一栏或用户新滚动。
7. 折叠 toggle 不覆盖最近业务焦点记忆；真实鼠标/键盘折叠后焦点转到可见展开入口，展开后由共享壳恢复到折叠前业务控件。
8. 不持久化折叠或 scrollTop 到 localStorage、URL 或 WorkSession。

## 执行切片 `RWC1-state-connection`

| 项目     | 内容                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 基线     | brief 提交后的准确 SHA                                                                                                                                                         |
| 实现     | Codex Code 测试先行；主代理审查真实 diff 与证据                                                                                                                                |
| 写入范围 | `RoleWorkbenchFrame.vue/.test.ts`、`WorkbenchLayout.vue/.test.ts`、`WorkbenchPane.vue/.test.ts`、`OperationalWorkQueues.test.ts`、CargoReady/Stuffing 两个 queue、三条真实 E2E |
| 禁止范围 | 七个业务页面、CollapsibleRail、截图、API/契约/Schema、工作会话持久化                                                                                                           |
| 停止条件 | 必须改变折叠事件契约；需要重做 1024/390 拓扑；除 CargoReady/Stuffing 外发现更多业务纵向 owner；范围外 diff                                                                     |

- [x] **RED 1：共享 wrapper 真实交互。** 保留当前 `RoleWorkbenchFrame.test.ts` 的实际点击失败反证；补充在 `setProps` 模拟 selection/loading/contextLabel 异步 rerender 后左右仍保持折叠，证明状态不因业务重读重置。
- [x] **GREEN 1：最小折叠状态接线。** 保留 `RoleWorkbenchFrame.vue` 两个内部 ref 与 v-model；不增加业务 props、样式或持久化。
- [x] **RED 2：共享滚动契约。** 在 `WorkbenchLayout.test.ts` 用左右两个长内容 pane：分别设置不同 scrollTop，折叠/展开一栏后只恢复该栏值，另一栏不变；焦点继续由 CollapsibleRail 恢复。`WorkbenchPane.test.ts` 固定每栏只有一个 `.workbench-pane__scroll--independent`。
- [x] **GREEN 2：受控折叠滚动状态机。** `WorkbenchLayout` 的按钮 handler 只 emit；watch 实际 `leftCollapsed/rightCollapsed` transition 负责折叠前记忆、展开后恢复。每栏独立 generation + mounted guard，settle 前核对当前 prop 与 generation；陈旧任务不得写入该栏或另一栏，也不得覆盖用户展开后新滚动。外部程序化、延迟与拒绝回写均有反证。
- [x] **RED/GREEN 3：真实焦点恢复。** `WorkbenchLayout` 的 focus memory 忽略 `.collapsible-rail__toggle`；折叠后把焦点落到该栏可见展开入口，展开后恢复最近业务控件。单测与 Playwright 使用真实 click/keyboard。
- [x] **RED/GREEN 4：移除业务嵌套纵向滚动。** CargoReady 与 Stuffing queue 不再是纵向 owner，Stuffing 横向筛选保留；桌面由 WorkbenchPane owner 滚动，stacked 由页面主滚动承接。
- [x] **真实消费者 E2E。** Fresh Vite 下 Customs 1440 折叠/滚动/焦点与 1024/390 owner 规则成立；CargoReady/Stuffing 三视口无业务嵌套纵向 owner，现有 PNG 未更新。
- [x] **验证与复审。** 定向 37、Web 全量 825、三项目 E2E 30、desktop repeat 3、质量门禁通过；fresh findings 全部关闭，最终 no-findings。

实现任务：

```text
TASK docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-state-connection base=<brief-commit-sha> role=implementer workspace=D:/Logixs
```

## RWC1 fresh 复审裁决

主代理复现当前实现的 Vitest `4 files / 29 tests`、fresh 标准 Playwright `3 specs / 30 tests`、Web lint/typecheck/build、Prettier、repo/diff 全部通过，PNG 哈希不变。fresh 整体复审仍发现以下当前切片竞态与可访问性缺口：

```yaml
protocol: logix-disposition/v1
slice: RWC1-state-connection
decisions:
  - finding: RWC1-F01
    status: accepted
    reason: 无 generation/mounted guard 的双 requestAnimationFrame 恢复任务可能覆盖最新折叠状态、用户新滚动或卸载后的实例
    writeback: docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-fix-1-controlled-scroll-focus
  - finding: RWC1-F02
    status: accepted
    reason: 滚动记忆只绑定 CollapsibleRail 点击事件，未以实际受控 props transition 为权威；外部程序化、父级拒绝或延迟回写路径错误
    writeback: docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-fix-1-controlled-scroll-focus
  - finding: RWC1-F03
    status: accepted
    reason: E2E 用 element.click 绕过真实指针焦点转移，现有“展开恢复业务控件”证据无法代表用户操作
    writeback: docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-fix-1-controlled-scroll-focus
  - finding: RWC1-F01A
    status: accepted
    reason: generation 只能淘汰后续折叠 transition；若展开双 rAF 期间用户滚动但 collapsed prop 未再变化，旧 memory 仍会覆盖用户新 scrollTop
    writeback: docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-fix-2-preserve-user-scroll
next: fix
```

### 切片 `RWC1-fix-1-controlled-scroll-focus`

- [x] 用 props watch 重写折叠 scroll transition；按钮只 emit，actual prop transition 才记忆/恢复。
- [x] 每栏独立 generation，组件 mounted guard；快速 collapse→expand→collapse、展开后用户新滚动、左右交错、pending 后 unmount 均有失败反证。
- [x] 父级拒绝/延迟 v-model 回写时不得提前恢复；外部 `setProps` collapse/expand 与按钮路径等价。
- [x] focus memory 忽略 toggle；真实点击折叠后焦点进入对应展开入口，真实点击/键盘展开后恢复业务控件。
- [x] E2E 移除所有为折叠保焦点使用的 `evaluate(element.click())`，改用真实 Playwright click/keyboard；30 项与全套门禁通过。

修复任务：

```text
TASK docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-fix-1-controlled-scroll-focus base=<finding-writeback-sha> role=implementer workspace=D:/Logixs
```

### 切片 `RWC1-fix-2-preserve-user-scroll`

- [x] 在 `WorkbenchLayout.test.ts` 增加精确失败反证：queue memory=121，controlled collapse 后清零，再 expand；watchers 已调度但不再改变任何 collapsed prop，把 queue scrollTop 改为 77；推进全部 frame 后仍为 77，context/page 不变。另保留“用户未滚动时恢复 121”的正向路径。
- [x] `settleRailTransition(false)` 在双 rAF 前捕获当前 scroll owner 节点与其 post-expand scrollTop；frame 后只有 owner 仍是同一节点、scrollTop 与捕获值一致、generation/prop/mounted 仍有效时才写 rememberedScroll。期间发生滚动则跳过 scroll restore，但仍执行合法的业务焦点恢复。
- [x] 重跑 37 项组件、desktop 折叠 repeat、30 项三视口 E2E 和全套质量门禁；PNG 未更新。

修复任务：

```text
TASK docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-fix-2-preserve-user-scroll base=<finding-writeback-sha> role=implementer workspace=D:/Logixs
```

## 验收

- [x] RoleWorkbenchFrame 左右栏可独立及同时折叠和展开，异步 props rerender 后状态不重置。
- [x] 折叠后正文 hidden/inert、摘要和展开入口可见，slot 内容未卸载；展开恢复内容、焦点和该栏 scrollTop。
- [x] 桌面左右/中栏各只有一个 WorkbenchPane 纵向 owner，滚动一栏不改变另一栏或页面位置。
- [x] CargoReady 与 Stuffing 不再自建 `.queue-list` 纵向滚动；其他五个消费者无需修改。
- [x] 1024/390 保持当前兼容拓扑，页面主滚动唯一且 slot 内无嵌套纵向 auto/scroll。
- [x] Fresh server 下 1440/1024/390 行为和几何通过，现有截图不变化。
- [ ] 相关单测、E2E、lint/typecheck/build、repo/board/diff 与 PR CI 通过后才标 done。

## 调度与边界说明

- `recoverable-work-sessions-v1` 仍为 review，历史 writeScopes 包含 `RoleWorkbenchFrame` / `WorkbenchLayout`，但其代码已由 PR #179 合入且当前无 writer 活动；本修复不改工作会话 props、slot、业务恢复协议或持久化，只接通共享 UI 折叠与当前实例滚动恢复。
- 正式 UI 标准要求 1024 使用左窄轨/抽屉且中右并列、390 使用显式分屏；`RoleWorkbenchFrame` 当前 stacked 兼容拓扑是历史债。本修复不扩大为响应式迁移，也不把当前拓扑宣称达到最终标准，只统一其中的滚动 owner 并防止业务嵌套滚动。
- 尚未建立 `task-collaboration-v1` brief；协作调查保持只读，等待本共享 UI 正确性修复收口后再继续。
- 未归属 `.tmp/` 与旧 `ui-unification` worktree 保持不读、不改、不暂存。

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                                                                                                                                      |
| ---------- | ------ | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-17 | fix    | main | —      | 复现并定位 RoleWorkbenchFrame 丢失左右折叠受控状态；锁定 wrapper 内部状态接线与真实消费者 TDD/E2E 边界                                    |
| 2026-10-17 | fix    | main | —      | 负责人要求左右栏纵向滚动也由共享壳统一；核对 WorkbenchPane 唯一 owner、CargoReady/Stuffing 嵌套 overflow 与折叠 scroll 恢复，扩写当前薄片 |
| 2026-10-18 | review | main | —      | 29 项单测、30 项三视口 E2E 与质量门禁通过；fresh 复审接受受控 props、陈旧 rAF 和真实焦点 3 项 finding，继续精确修复                       |
| 2026-10-18 | fix    | main | —      | 三项修复后 36 项组件与 30 项 E2E 全绿；复核仍确认展开 rAF 期间无新 prop transition 的用户滚动会被旧 memory 覆盖，接受 RWC1-F01A           |
| 2026-10-18 | review | main | —      | F01A 修复后定向 37、Web 全量 825、三 spec 三视口 30、desktop repeat 3 与质量门禁全绿；fresh 最终 no-findings，进入进度板与 PR 集成        |
