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

| Odoo                          | Logix                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `odoo` 内核                   | Nest 应用壳 + Prisma + `packages/contracts` + `repo:check`                                         |
| `base` addon                  | 支撑模块 + 主链核（见 §3）                                                                         |
| `__manifest__.py` / `depends` | `module.manifest.ts` 的 `id` / `depends` / `kind`                                                  |
| `models/`                     | `domain/`（纯规则）+ `application/`（用例）+ Prisma 映射                                           |
| `controllers/`                | `presentation/*.controller.ts`                                                                     |
| `views/`                      | `apps/web/src/modules/<id>/` 路由与导航贡献（代码化 UI）                                           |
| `security/` + access CSV      | `@RequireCapabilities` + `identity` 角色能力表。`security/permissions.ts` 只说明能力码，守卫不读取 |
| Registry / 安装图             | 静态依赖图 + `scripts/check-module-manifests.mjs`                                                  |

## 3. 基础模块与增量模块

现行分类以各模块 `module.manifest.ts` 的 `kind` 为准。下面名单是 2026-09-17 的快照，不是完整现状。后来增加的模块以清单为准，并应回写本段。

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
  security/               # 按需：能力码说明，守卫不读取
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
- 写接口默认需认证。敏感读/写在处理器上挂 `@RequireCapabilities(...)`。`AuthenticationGuard` 与 `AuthorizationGuard` 已全局注册；没写能力、也没标 `@PublicEndpoint()` 或 `@ServiceEndpoint()` 的路由会被拒绝。
- 角色是否拥有能力码，看 `apps/api/src/modules/identity/domain/role-capabilities.ts`。守卫不读取 `security/permissions.ts`。该文件只在需要向人说明能力码时照 `inland-fulfillment` 或 `notification` 保留，不要求每个模块补一份空文件。
- 清单里的 `permissions` 登记本模块使用的能力码。
- 前端 `meta.roles` / `meta.requiredCapabilities` 不是安全边界。`createAuthGuard` 只判断是否已登录。

## 7. 校验与验收

- `pnpm repo:check` 调用模块清单检查：每个含 `*.module.ts` 的业务目录必须有 `module.manifest.ts`，且 `depends` 指向已存在模块、不得自依赖。Nest `imports` 里的兄弟模块必须写入 `depends`（约定 §5 第 3 条）。
- 样板：API 看 `inland-fulfillment`（清单、用例、控制器、`security/permissions.ts`）。页面看 `notification`（自有视图）。`inland-fulfillment` 的 Web 路由目前指向 `MesoPaper.vue`，不是内陆计划页面。
- 第一次改代码先读 [INCREMENTAL_MODULE_PLAYBOOK](./INCREMENTAL_MODULE_PLAYBOOK.md) §0.1。
- 变更本约定或模块分类须更新本文与 MODULE_DEPENDENCIES；触及部署边界时另立 ADR。
- **怎么切下一刀、Odoo 业务能力采纳优先序**：见 [INCREMENTAL_MODULE_PLAYBOOK](./INCREMENTAL_MODULE_PLAYBOOK.md)。
