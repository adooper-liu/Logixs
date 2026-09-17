# 模块插件约定（Odoo 思想 → Logix 落地）

> 状态：**已接受约定** · 2026-09-17 · 锚定 [ADR-010](./decisions/ADR-010-bounded-context-modules.md)、[MODULE_DEPENDENCIES](./MODULE_DEPENDENCIES.md)、[GC-008](../product/domain/ACTION_PERMISSION_CONTRACT_V1.md)、[IDENTITY_ACCESS_MODEL_V1](../product/domain/IDENTITY_ACCESS_MODEL_V1.md)。
> 🗣️ 白话：学 Odoo 的「基础核 + 可增量业务插件」，但用 Logix 自己的分层与契约，不搬 ORM/XML 视图。

## 1. 目标与非目标

**目标**

- 固定基础模块，业务能力按限界上下文增量交付。
- 每个模块用 `module.manifest.ts` 声明身份、依赖与权限清单。
- 业务增量沿 **model / view / control / 权限** 分目录交付（语义对齐 Odoo addon）。
- 服务端按稳定 `capabilityCode` 授权；Web 导航只做体验投影。

**非目标（明确不做）**

- 不移植 Odoo ORM、`_inherit` 运行时改模型、XML View 存库。
- 不做模块热安装/卸载改 schema；表结构只走 `database/migrations/`。
- 不引入通用 `ir.rule` 行级引擎；对象范围用 Application 显式断言（如租户断言）。

## 2. Odoo → Logix 映射

| Odoo                          | Logix                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| `odoo` 内核                   | Nest 应用壳 + Prisma + `packages/contracts` + `repo:check` |
| `base` addon                  | 支撑模块 + 主链核（见 §3）                                 |
| `__manifest__.py` / `depends` | `module.manifest.ts` 的 `id` / `depends` / `kind`          |
| `models/`                     | `domain/`（纯规则）+ `application/`（用例）+ Prisma 映射   |
| `controllers/`                | `presentation/*.controller.ts`                             |
| `views/`                      | `apps/web/src/modules/<id>/` 路由与导航贡献（代码化 UI）   |
| `security/` + access CSV      | `security/permissions.ts` + `identity` 授权守卫            |
| Registry / 安装图             | 静态依赖图 + `scripts/check-module-manifests.mjs`          |

## 3. 基础模块与增量模块

**基础（始终启用，`kind: "base"`）**

- 平台：`identity`、`audit`、`master-data`、`notification`、`workflow`、`exception-management`
- 主链核：`shipment-registry`、`lifecycle-control`、`work-execution`

**增量（可按产品阶段启用，`kind: "incremental"`）**

- `booking-origin`、`ocean-port-visibility`、`customs-compliance`、`inland-fulfillment`
- `charges-settlement`、`document-records`、`performance-improvement`
- `integration-import`、`ai-governance`

跨模块只经公开 Port / 共享契约 / 领域事件；禁止引用他模块内部路径（见 MODULE_DEPENDENCIES）。

## 4. 目录约定

```text
apps/api/src/modules/<feature>/
  module.manifest.ts      # 插件清单
  index.ts                # 唯一公共入口
  domain/                 # ≈ model
  application/            # 用例编排
  presentation/           # ≈ control
  infrastructure/         # 持久化适配
  security/               # 权限声明（能力码清单）
  engines/                # 可选纯求值引擎

apps/web/src/modules/<feature>/
  routes.ts               # ≈ view：路由贡献
  navigation.ts           # 菜单/导航元数据（可与 routes meta 同源）
```

`apps/api/src/module-plugin/` 存放清单类型与 `defineModuleManifest` 辅助函数，不属于业务限界上下文。

## 5. `module.manifest.ts` 形状

```ts
defineModuleManifest({
  id: "inland-fulfillment",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity", "shipment-registry", "charges-settlement"],
  publicPorts: ["/* re-exported tokens documented in index */"],
  permissions: [/* capability codes owned or required */],
  webNavContribution: true,
});
```

规则：

1. `id` 必须等于目录名。
2. `depends` 必须是已存在的模块 `id`，不得自依赖。
3. Nest `@Module({ imports })` 引入的兄弟业务模块必须出现在 `depends` 中（`identity` 同理）。
4. `permissions` 中的能力码须与 [IDENTITY_ACCESS_MODEL_V1](../product/domain/IDENTITY_ACCESS_MODEL_V1.md) 对齐；动作级绑定仍以 GC-008 为准。

## 6. 权限约定

- 能力码是稳定授权键（如 `planning.draft`），不是按钮文案或 `actionCode`。
- 写接口默认需认证；带 `@RequireCapabilities(...)` 的处理器还需能力校验。
- 模块在 `security/permissions.ts` 声明本模块相关能力；运行时由 `identity` 强制。
- 前端 `meta.roles` / 允许动作投影不是安全边界。

## 7. 校验与验收

- `pnpm repo:check` 调用模块清单检查：每个含 `*.module.ts` 的业务目录必须有 `module.manifest.ts`，且 `depends` 合法。
- 样板：`inland-fulfillment` 具备 `security/`、Web `modules/inland-fulfillment` 导航贡献，写接口挂能力守卫。
- 变更本约定或模块分类须更新本文与 MODULE_DEPENDENCIES；触及部署边界时另立 ADR。
