---
status: review
branch: fix/product-selection-business-case-spacing
owner: main
writer: main
risk: low
dependsOn:
  - product-selection-five-dimension-business-case-v1
writeScopes:
  - docs/planning/tasks/product-selection-business-case-spacing-fix.md
  - apps/web/src/components/product-selection/ProductInitiativeReviewPanel.vue
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks: []
sharedIntegrationScopes:
  - apps/web/e2e/workbench-network.spec.ts
authorityRefs:
  - AGENTS.md
  - docs/planning/tasks/product-selection-five-dimension-business-case-v1.md
  - docs/product/UI_SYSTEM.md
uiStructure:
  - 保持选品三栏办理壳与中栏“机会事实 → 五面摘要 → 当前维度编辑 → 专业要求”的既定顺序
uiMustStayVisible:
  - 五面摘要、当前编辑区和固定主动作在约定视口继续可见且不互相遮挡
uiProgressiveDisclosure:
  - 证据明细、专业要求与旧四项审计继续按原有折叠规则展示
uiForbidden:
  - 不改变业务顺序、三栏壳、卡片列数逻辑或业务状态；不以缩小字号掩盖边距问题
uiViewportEvidence:
  - 1440x900 与 1024x768：五面摘要和编辑区相对中栏左右至少内缩 16px，无横向溢出
  - 390x844：五面摘要和编辑区相对中栏左右至少内缩 12px，固定主动作不遮挡内容
---

# 任务：选品五面商业论证边距修复

## 目标

修复负责人在 PR #146 合并后真实页面中发现的视觉问题：五面商业论证摘要卡和当前编辑区几乎贴住中栏边界，视觉上接近溢出。只增加稳定响应式内边距，不改变业务语义、信息顺序或工作台壳。

## 边界 / 不做

- 只修改五面容器样式与专项 E2E 几何反证。
- 不改 API、契约、Schema、状态、权限、单位经济、队列或 NPI 行为。
- 原 S1 brief 已完成并由 PR #146 合并，本修复独立成分支和 PR，不追溯改写已完成 brief。

## 执行切片 `F1-responsive-inset`

| 项目        | 内容                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| 基线        | `3b763ddbe18cfb04b2c2d4522ce7da37e3480212`                                                     |
| 执行角色    | 主代理：Claude Code / Claude Opus 4.8                                                          |
| 复审        | 低风险纯视觉边距修复；主代理真实截图核对即可，按 `AGENTS.md` §1.2 第 8 条跳过独立复审          |
| 写入范围    | brief、`ProductInitiativeReviewPanel.vue`、`workbench-network.spec.ts`                         |
| 禁止范围    | 业务结构、数据契约、服务端、状态与权限                                                         |
| UI 强制结构 | 逐项遵守 frontmatter 五项；只改变内容 inset                                                    |
| 验证命令    | Web 全量单测、lint/typecheck/build、三视口专项 E2E、Prettier、`repo:check`、`git diff --check` |
| 停止条件    | 三视口几何断言与真实截图均通过后进入 PR/CI；若 padding 导致首屏顺序或主动作回归则保持 `fix`    |

## 验收

- [x] RED：三视口五面摘要/编辑内容距中栏边界仅 1px，新增几何断言稳定失败
- [x] GREEN：桌面/窄屏至少 16px、移动至少 12px
- [x] 三视口专项 E2E 3/3 通过，页面与内容无横向溢出
- [x] Web 全量单测 693/693、lint、typecheck、build 通过
- [x] 三张 working 截图人工核对通过，固定主动作未遮挡
- [ ] PR 必需 CI 通过

## 进度 log

| 日期       | 阶段   | 负责        | commit | 说明                                                                                                  |
| ---------- | ------ | ----------- | ------ | ----------------------------------------------------------------------------------------------------- |
| 2026-10-07 | review | Claude Code | —      | 负责人截图反馈后测试先行修复；三视口从 1px 增加到桌面/窄屏 16px、移动 12px，定向与 Web 全量验证通过。 |
