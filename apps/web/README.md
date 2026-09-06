# @logix/web — 货柜运营 Web（Vue）

> 状态：pnpm Workspace 中的最小可运行原型（演示数据）· 2026-09-06。
> 🗣️ 白话：这是给"运营人员看货柜"的前端。先能跑、能看三观(全局/中观/微观)和一个货柜工作台；数据先演示，后接后端。

## 技术栈

Vue 3 + TypeScript + Vite · Element Plus · vue-router（视觉规范见 [docs/product/UI_SYSTEM.md](../../docs/product/UI_SYSTEM.md)）

## 启动与验证

```bash
cd ../..
corepack enable
pnpm install --frozen-lockfile # 根锁文件确定性安装
pnpm dev                    # 开发 http://localhost:5173/
pnpm test                   # 仓库工具测试 + Vitest 单元/组件测试
pnpm test:e2e               # Playwright 桌面与移动端流程/视觉测试
pnpm validate               # 根级完整质量门禁
```

首次运行 E2E 前需执行 `npx playwright install chromium`。单元/组件测试位于 `src/**/*.test.ts`，端到端与视觉回归位于 `e2e/`；视觉快照按 Playwright 项目分别保存桌面和移动基线。

## 目录结构（壳与视图分离）

```
src/
├─ main.ts            # 挂 Element + router
├─ App.vue            # 只渲染 <AppShell/>
├─ style.css          # UI 令牌（CSS 变量，明/暗/跟随系统）+ Element Plus 对齐
├─ components/
│  ├─ AppShell.vue    # 壳：角色导航 + 顶栏(页名) + <router-view>
│  ├─ task/           # 动态任务上下文、前置、资料资源、证据、结果与同步回执
│  ├─ container/      # 生命周期轨道与三状态
│  └─ management/     # 计划/执行/分析闭环投影
├─ composables/
│  ├─ useDemoOperationsStore.ts # 跨路由共享的演示状态、操作与异常记录
│  └─ useTaskWorkflow.ts # 动态任务编排与三段提交确认
├─ router/index.ts    # /tasks · /containers · /dashboard · /meso · /container/:containerRecordId
├─ views/             # 纯内容视图（不含壳）
│  ├─ TaskWorkbench.vue     # 员工作业入口（动态任务定义投影）
│  ├─ ContainerList.vue     # 已出运货柜列表
│  ├─ DashboardGlobal.vue   # 全局态势
│  ├─ MesoPaper.vue         # First Mile PDCA 运营
│  └─ MicroWorkbench.vue    # 一柜一档
└─ data/sample.ts     # 演示数据（标记"演示"，非真实业务）
```

## 说明与约定

- **视图不画壳、壳不含业务**：换主题/布局只改 `AppShell.vue` 与 `style.css` 令牌，视图零改动。
- 视觉一律用令牌，禁止裸色/临时十六进制（见 UI_SYSTEM）。
- 演示数据源在 `src/data/sample.ts`，`useDemoOperationsStore.ts` 只是在当前浏览器页面内模拟服务端操作日志、业务结果、异常和货柜投影；刷新页面会重置，不能作为持久化、并发、权限或真实幂等实现。后续接后端：工作台读 `GET /containers/:id/workbench`、动作 `POST /actions/:code/confirm`（契约见 [docs/product/domain/CONTRACTS_DRAFT.md](../../docs/product/domain/CONTRACTS_DRAFT.md)）。
- UI/交互依据：[UX_CONTAINER_WORKBENCH](../../docs/product/UX_CONTAINER_WORKBENCH.md)、[NODE_PDCA](../../docs/product/domain/NODE_PDCA.md)。
- 任务台按任务定义决定是否出现领取、资料/资源交接、扫描、附件/照片和结果提交；系统监控正常时不进入员工队列。
- 当前测试覆盖动态待办排序、错柜业务拒绝、每任务独立操作回执、完成后异常独立记录、卸柜事实推进及跨柜任务链接防护；这些是演示适配器验证，不替代未来服务端的事务、授权、幂等和真实数据库集成测试。
- Element Plus 仅注册当前使用的 `ElIcon` 与 `ElDialog`，新增组件时必须显式注册并验证构建体积。
- 待办：接后端真数据与正式共享契约。
