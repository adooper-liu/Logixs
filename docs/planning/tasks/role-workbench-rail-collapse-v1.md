---
status: fix
branch: fix/role-workbench-rail-collapse-v1
verification: ""
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
6. 不持久化折叠或 scrollTop 到 localStorage、URL 或 WorkSession。

## 执行切片 `RWC1-state-connection`

| 项目     | 内容                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 基线     | brief 提交后的准确 SHA                                                                                                                                                         |
| 实现     | Codex Code 测试先行；主代理审查真实 diff 与证据                                                                                                                                |
| 写入范围 | `RoleWorkbenchFrame.vue/.test.ts`、`WorkbenchLayout.vue/.test.ts`、`WorkbenchPane.vue/.test.ts`、`OperationalWorkQueues.test.ts`、CargoReady/Stuffing 两个 queue、三条真实 E2E |
| 禁止范围 | 七个业务页面、CollapsibleRail、截图、API/契约/Schema、工作会话持久化                                                                                                           |
| 停止条件 | 必须改变折叠事件契约；需要重做 1024/390 拓扑；除 CargoReady/Stuffing 外发现更多业务纵向 owner；范围外 diff                                                                     |

- [ ] **RED 1：共享 wrapper 真实交互。** 保留当前 `RoleWorkbenchFrame.test.ts` 的实际点击失败反证；补充在 `setProps` 模拟 selection/loading/contextLabel 异步 rerender 后左右仍保持折叠，证明状态不因业务重读重置。
- [ ] **GREEN 1：最小折叠状态接线。** 保留 `RoleWorkbenchFrame.vue` 两个内部 ref 与 v-model；不增加业务 props、样式或持久化。
- [ ] **RED 2：共享滚动契约。** 在 `WorkbenchLayout.test.ts` 用左右两个长内容 pane：分别设置不同 scrollTop，折叠/展开一栏后只恢复该栏值，另一栏不变；焦点继续由 CollapsibleRail 恢复。`WorkbenchPane.test.ts` 固定每栏只有一个 `.workbench-pane__scroll--independent`。
- [ ] **GREEN 2：折叠滚动记忆。** `WorkbenchLayout` 在接收左右 collapse=true 前记忆对应 pane owner 的 scrollTop，在 collapse=false 后 nextTick 恢复；不改变 mobile screen 既有 memory，不新增公开事件。
- [ ] **RED/GREEN 3：移除业务嵌套纵向滚动。** 扩展 `OperationalWorkQueues.test.ts` 挂载 CargoReady 与 Stuffing queue，并在真实 DOM/computed style 中证明 `.queue-list` 不再是纵向 auto/scroll owner；删除两个组件的 `max-height:680px` 与 `overflow-y:auto`，保留 Stuffing filters 的 `overflow-x:auto`。
- [ ] **真实消费者 E2E。** 使用 fresh Vite。Customs 在 1440 验证左右独立/同时折叠、root collapsed classes、`48px / 中栏 / 48px`、各自 scrollTop/焦点恢复与另一栏不动；1024/390 只验兼容拓扑、页面主滚动和无嵌套纵向 owner。CargoReady/Stuffing 各验证 `.queue-list` 非纵向 owner、共享 pane/页面 owner 可滚且无横向溢出。现有 PNG 不更新。
- [ ] **验证与交回。** 运行相关 Vitest、三条 E2E 的三项目组合、Web lint/typecheck/build、精确 Prettier、repo/board/diff；返回 HANDOFF，默认不提交。

实现任务：

```text
TASK docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-state-connection base=<brief-commit-sha> role=implementer workspace=D:/Logixs
```

## 验收

- [ ] RoleWorkbenchFrame 左右栏可独立及同时折叠和展开，异步 props rerender 后状态不重置。
- [ ] 折叠后正文 hidden/inert、摘要和展开入口可见，slot 内容未卸载；展开恢复内容、焦点和该栏 scrollTop。
- [ ] 桌面左右/中栏各只有一个 WorkbenchPane 纵向 owner，滚动一栏不改变另一栏或页面位置。
- [ ] CargoReady 与 Stuffing 不再自建 `.queue-list` 纵向滚动；其他五个消费者无需修改。
- [ ] 1024/390 保持当前兼容拓扑，页面主滚动唯一且 slot 内无嵌套纵向 auto/scroll。
- [ ] Fresh server 下 1440/1024/390 行为和几何通过，现有截图不变化。
- [ ] 相关单测、E2E、lint/typecheck/build、repo/board/diff 通过，PR CI 合并后才标 done。

## 调度与边界说明

- `recoverable-work-sessions-v1` 仍为 review，历史 writeScopes 包含 `RoleWorkbenchFrame` / `WorkbenchLayout`，但其代码已由 PR #179 合入且当前无 writer 活动；本修复不改工作会话 props、slot、业务恢复协议或持久化，只接通共享 UI 折叠与当前实例滚动恢复。
- 正式 UI 标准要求 1024 使用左窄轨/抽屉且中右并列、390 使用显式分屏；`RoleWorkbenchFrame` 当前 stacked 兼容拓扑是历史债。本修复不扩大为响应式迁移，也不把当前拓扑宣称达到最终标准，只统一其中的滚动 owner 并防止业务嵌套滚动。
- 尚未建立 `task-collaboration-v1` brief；协作调查保持只读，等待本共享 UI 正确性修复收口后再继续。
- 未归属 `.tmp/` 与旧 `ui-unification` worktree 保持不读、不改、不暂存。

## 进度 log

| 日期       | 阶段 | 负责 | commit | 说明                                                                                                                                      |
| ---------- | ---- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-17 | fix  | main | —      | 复现并定位 RoleWorkbenchFrame 丢失左右折叠受控状态；锁定 wrapper 内部状态接线与真实消费者 TDD/E2E 边界                                    |
| 2026-10-17 | fix  | main | —      | 负责人要求左右栏纵向滚动也由共享壳统一；核对 WorkbenchPane 唯一 owner、CargoReady/Stuffing 嵌套 overflow 与折叠 scroll 恢复，扩写当前薄片 |
