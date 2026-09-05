# @logix/web — 货柜运营 Web（Vue）

> 状态：最小可运行原型（演示数据）· 2026-09-05 · 后续收进 pnpm Workspace（P3）。
> 🗣️ 白话：这是给"运营人员看货柜"的前端。先能跑、能看三观(全局/中观/微观)和一个货柜工作台；数据先演示，后接后端。

## 技术栈
Vue 3 + TypeScript + Vite · Element Plus · vue-router（视觉规范见 [docs/product/UI_SYSTEM.md](../../docs/product/UI_SYSTEM.md)）

## 启动与验证
```bash
cd apps/web
npm install                 # 首次；若提示 esbuild 脚本需批准：npm install-scripts approve esbuild
npm run dev                 # 开发 http://localhost:5173/
npm run typecheck           # vue-tsc 严格类型检查
npm run build               # 产物到 dist/
npm run preview             # 预览构建产物
```

## 目录结构（壳与视图分离）
```
src/
├─ main.ts            # 挂 Element + router
├─ App.vue            # 只渲染 <AppShell/>
├─ style.css          # UI 令牌（CSS 变量，明/暗/跟随系统）+ Element Plus 对齐
├─ components/
│  └─ AppShell.vue    # 壳：侧栏分组导航 + 顶栏(页名) + <router-view>
├─ router/index.ts    # 路由：/dashboard · /meso · /container/:orderNumber
├─ views/             # 纯内容视图（不含壳）
│  ├─ DashboardGlobal.vue   # 全局态势（状态分布示意）
│  ├─ MesoPaper.vue         # 中观·本票多柜（可下钻）
│  └─ MicroWorkbench.vue    # 微观·货柜工作台（rail/6问/时间线/动作中心）
└─ data/sample.ts     # 演示数据（标记"演示"，非真实业务）
```

## 说明与约定
- **视图不画壳、壳不含业务**：换主题/布局只改 `AppShell.vue` 与 `style.css` 令牌，视图零改动。
- 视觉一律用令牌，禁止裸色/临时十六进制（见 UI_SYSTEM）。
- 演示数据源在 `src/data/sample.ts`；后续接后端：工作台读 `GET /containers/:orderNumber/workbench`、动作 `POST /actions/:code/confirm`（契约见 [docs/product/domain/CONTRACTS_DRAFT.md](../../docs/product/domain/CONTRACTS_DRAFT.md)）。
- UI/交互依据：[UX_CONTAINER_WORKBENCH](../../docs/product/UX_CONTAINER_WORKBENCH.md)、[NODE_PDCA](../../docs/product/domain/NODE_PDCA.md)。
- 待办：chunk>500k 需 Element 按需/分包；响应式折叠；接后端真数据。
