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
  - apps/web/e2e/customs-task-archive.spec.ts
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
  - 1440 桌面允许左右栏独立或同时收为满高窄轨；1024 stacked 保持队列与事实在上、右栏跨整行的兼容几何，只保证内容与摘要切换可用；390 保持纵向 stacked 且隐藏桌面折叠控制
uiMustStayVisible:
  - 折叠后左轨保留任务池摘要与展开入口，右轨保留操作上下文摘要与展开入口
  - 中间岗位事实、PageHeader、责任上下文和决策条在任何折叠组合下保持可见且顺序不变
  - 展开后恢复原 pane 内容、可访问名称和先前焦点；折叠内容留在 DOM 但必须 hidden/inert，不能参与交互
uiProgressiveDisclosure:
  - 折叠态只显示消费者既有 leftRailSummary/rightRailSummary，不增加业务字段、状态推断或新设置面板
  - 折叠选择只在当前组件实例内保留；跨刷新、跨设备或工作会话持久化不属于本修复
uiForbidden:
  - 修改七个 RoleWorkbenchFrame 业务消费者、复制 leftCollapsed/rightCollapsed 到各页面、改变业务事实或动作
  - 把 1024 stacked 兼容布局改成 standard 三栏，或在 390 显示桌面折叠按钮
  - 修改 WorkbenchLayout/CollapsibleRail 公共事件契约、主题、API、Schema、契约或工作会话持久化
  - 用 CSS 强制隐藏代替状态接线，或仅修改测试挂载器制造通过
uiViewportEvidence:
  - 1440x900：清关真实消费者左右栏可独立及同时折叠；窄轨宽度与摘要/展开入口可见，中栏扩展且无横向溢出，展开恢复内容
  - 1024x768：stacked 兼容几何不变；左右控制实际切换 body hidden/inert 与摘要/展开入口，不产生空白不可恢复区或横向溢出
  - 390x844：现有纵向 stacked 顺序不变，桌面折叠控制保持隐藏，页面无横向溢出
---

# 任务：RoleWorkbenchFrame 左右栏折叠修复 V1

## 目标与根因

- **用户结果**：使用备货、装箱、出运调度、进口清关、提柜、送仓或卸柜工作台时，桌面上的左右折叠按钮能真实收拢对应栏位，再次展开恢复内容与焦点。
- **根因**：`CollapsibleRail` 只发 `update:collapsed`；`WorkbenchLayout` 继续上抛 `update:leftCollapsed/rightCollapsed`；`RoleWorkbenchFrame` 没有保存或回传这两个受控状态，所以七个兼容壳消费者每次仍收到默认 `false`。
- **正面样例**：`TaskWorkbench`、`ProductSelectionWorkbench`、`MarketSignalsWorkbench` 与参考页都用 `v-model:left-collapsed/right-collapsed` 接住事件，折叠正常。
- **测试缺口**：`WorkbenchLayout.test.ts` 的 mount helper 手工 `setProps` 模拟父级回写，只证明公共布局在消费者正确接线时有效；`RoleWorkbenchFrame.test.ts` 未实际点击折叠/展开。

## 影响范围

经 `RoleWorkbenchFrame` 的七个生产消费者统一受影响：CargoReady、Stuffing、PreDepartureDispatch、Customs、Pickup、WarehouseDelivery、ContainerUnloading。直接消费 `WorkbenchLayout` 且已有 v-model 的页面不受影响。

## 固定方案

1. `RoleWorkbenchFrame` 内部使用两个 `ref(false)` 持有 `leftCollapsed` / `rightCollapsed`。
2. 给内部 `WorkbenchLayout` 使用 `v-model:left-collapsed` 与 `v-model:right-collapsed`。
3. 不向七个业务页面增加 props/events，不修改业务消费者。
4. 不持久化折叠状态；它仍是当前组件实例的个人 UI 状态。
5. 不修改 `WorkbenchLayout` 或 `CollapsibleRail` 契约与 CSS。

## 执行切片 `RWC1-state-connection`

| 项目     | 内容                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| 基线     | brief 提交后的准确 SHA                                                                     |
| 实现     | Codex Code 测试先行；主代理审查真实 diff 与证据                                            |
| 写入范围 | `RoleWorkbenchFrame.vue/.test.ts`、现有 `customs-task-archive.spec.ts`                     |
| 禁止范围 | 七个业务消费者、WorkbenchLayout、CollapsibleRail、截图、API/契约/Schema、工作会话          |
| 停止条件 | 必须改变公共事件契约；折叠导致 pane 内容卸载或草稿丢失；1024/390 需要重做布局；范围外 diff |

- [ ] **RED：共享 wrapper 真实交互。** 在 `RoleWorkbenchFrame.test.ts` 实际点击“折叠岗位任务池”和“折叠岗位待办”，断言当前实现下找不到对应“展开”按钮而失败；分别覆盖左、右和同时折叠。另断言 pane 顺序与 slot 内容仍存在。
- [ ] **GREEN：最小状态接线。** 仅在 `RoleWorkbenchFrame.vue` 增加两个内部 ref，并以 v-model 接到 `WorkbenchLayout`；不增加新 props、业务判断或样式。
- [ ] **回归：展开与焦点。** 点击“展开”后恢复原折叠按钮与内容；若折叠前焦点在栏内，展开后由既有 `CollapsibleRail` 恢复焦点。
- [ ] **真实消费者 E2E。** 在现有 `customs-task-archive.spec.ts` 增加不截图的折叠行为测试：1440 验证左右独立/同时折叠、窄轨和中栏扩展；1024 验证 stacked 内容/摘要切换与可恢复；390 断言折叠控制隐藏。三视口均无横向溢出，现有 PNG 不更新。
- [ ] **验证与交回。** 运行定向 Vitest、清关三项目 E2E、Web lint/typecheck/build、精确 Prettier、repo/board/diff；范围仅三文件，返回 HANDOFF，默认不提交。

实现任务：

```text
TASK docs/planning/tasks/role-workbench-rail-collapse-v1.md#RWC1-state-connection base=<brief-commit-sha> role=implementer workspace=D:/Logixs
```

## 验收

- [ ] RoleWorkbenchFrame 左右栏可独立及同时折叠和展开。
- [ ] 折叠后正文 hidden/inert、摘要和展开入口可见，slot 内容未卸载。
- [ ] 展开恢复内容与折叠前焦点。
- [ ] 七个消费者无需分别修改；直接 WorkbenchLayout 消费者无回退。
- [ ] 1440/1024/390 行为符合 frontmatter 证据且无横向溢出，现有截图不变化。
- [ ] 相关单测、E2E、lint/typecheck/build、repo/board/diff 通过，PR CI 合并后才标 done。

## 调度与边界说明

- `recoverable-work-sessions-v1` 仍为 review，历史 writeScopes 包含 `RoleWorkbenchFrame`，但其代码已由 PR #179 合入且当前无 writer 活动；本修复不改工作会话 props、slot、行为或持久化，仅接通已存在的折叠 UI 事件。
- 尚未建立 `task-collaboration-v1` brief；协作调查保持只读，等待本共享 UI 正确性修复收口后再继续。
- 未归属 `.tmp/` 与旧 `ui-unification` worktree 保持不读、不改、不暂存。

## 进度 log

| 日期       | 阶段 | 负责 | commit | 说明                                                                                                   |
| ---------- | ---- | ---- | ------ | ------------------------------------------------------------------------------------------------------ |
| 2026-10-17 | fix  | main | —      | 复现并定位 RoleWorkbenchFrame 丢失左右折叠受控状态；锁定 wrapper 内部状态接线与真实消费者 TDD/E2E 边界 |
