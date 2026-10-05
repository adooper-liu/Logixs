# 增量模块开发手册

> 状态：**已接受工作纸** · 2026-09-17 · 锚定 [MODULE_PLUGIN_CONVENTION](./MODULE_PLUGIN_CONVENTION.md)、[MODULE_DEPENDENCIES](./MODULE_DEPENDENCIES.md)、[ADR-010](./decisions/ADR-010-bounded-context-modules.md)、[AGENTS](../../AGENTS.md)、[IDENTITY_ACCESS_MODEL_V1](../product/domain/IDENTITY_ACCESS_MODEL_V1.md)、[GC-008](../product/domain/ACTION_PERMISSION_CONTRACT_V1.md)。
> 白话：下一刀怎么切、先交什么、借 Odoo 哪些业务能力——按优先序照表做；不搬 ORM/XML/`_inherit`/热改 schema。

## 0. 怎么用本文

已有模块骨架之后，加字段、加用例或加模块，读本文。仓库从零按 P0→P9 搭建，读 [代码怎么往前推](../planning/PROJECT_BOOTSTRAP_PLAIN_LANGUAGE.md)，那不是二次开发步骤。

| 场景                   | 读哪一节                                                  |
| ---------------------- | --------------------------------------------------------- |
| 第一次改，想先跑通一条 | §0.1 新手三条路径                                         |
| 开刀前对齐边界         | §1 提纲                                                   |
| 写码/开 PR 自检        | §2 切片清单                                               |
| 排期下一刀能力         | §3 采纳优先序                                             |
| 明确永不照搬           | §4 不采纳清单                                             |
| 目录、`kind`、清单字段 | [MODULE_PLUGIN_CONVENTION](./MODULE_PLUGIN_CONVENTION.md) |
| 谁可以引用谁           | [MODULE_DEPENDENCIES](./MODULE_DEPENDENCIES.md)           |

**硬约束（每刀都成立）**

- 依赖方向：`UI/Transport → Application → Domain ← Infrastructure`。
- Schema 只追加 `database/migrations/`；禁止运行时改模型。
- 跨模块只从对方 `index.ts` 已导出的公开 Port 引用，或走 `packages/contracts`、领域事件。不进入对方的 `domain/`、`application/`、`infrastructure/`、`presentation/`、`security/`、`engines/`。
- 写接口由服务端 `@RequireCapabilities` 授权。前端 `meta.requiredCapabilities` 只用于菜单投影。`createAuthGuard` 只判断当前标签页是否已登录。
- 并行上限以 `AGENTS.md` §1.2 第 17 条为准。本文不另定同时能开几个写任务。

## 0.1 新手三条路径

三条路径都复用已经挂好的平台函数，不新造框架：

| 要做的事                           | 调用已有的                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 声明模块                           | `defineModuleManifest`（`apps/api/src/module-plugin/module-manifest.ts`）                                                                                       |
| 落库                               | 全局 `PrismaService`（`apps/api/src/prisma/prisma.service.ts`）                                                                                                 |
| 保护写接口和敏感读接口             | `@RequireCapabilities`（`apps/api/src/security/require-capabilities.decorator.ts`）。`AuthenticationGuard` 与 `AuthorizationGuard` 已在 `identity` 模块全局注册 |
| 角色是否拥有这个能力码             | `apps/api/src/modules/identity/domain/role-capabilities.ts` 的角色能力表。守卫调用 `hasAllCapabilities`，业务控制器不要再判一次角色                             |
| 浏览器调 API                       | `apps/web/src/api/httpClient.ts` 的 `requestJson`，地址以 `/api/` 开头                                                                                          |
| 共享枚举、错误信封、租户和时间形状 | `packages/contracts`。当前 `packages/` 下只有这一个包                                                                                                           |

没有通用增删改查生成器，也没有运行时热插拔。新模块要在 `apps/api/src/app.module.ts` 的 `imports` 里亲手挂上。

### 路径 A — 在已有模块加一条读用例

照 `inland-fulfillment` 的「读取当前送仓指令」。这条已经接通，新读法按同样四层加文件，不要改生命周期或权限平台。

| 层     | 现成文件                                                                                          | 这一层只做什么                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 领域   | `domain/warehouse-delivery-instruction.ts`、`domain/warehouse-delivery-instruction.repository.ts` | 类型和仓库接口。不引用 Nest、Prisma、Vue                                                        |
| 用例   | `application/get-warehouse-delivery-instruction.service.ts`                                       | `execute({ tenantId, containerRecordId })`，转给仓库                                            |
| 持久化 | `infrastructure/prisma-warehouse-delivery-instruction.repository.ts`                              | 实现仓库接口。在 `inland-fulfillment.module.ts` 的 `providers` 里把接口 Token 绑到这个类        |
| 控制器 | `presentation/warehouse-delivery-instruction.controller.ts`                                       | `@RequireCapabilities("container.read")`，从 `request.identity.tenantId` 取租户，调用 `execute` |

控制器路径挂在全局前缀 `api` 下，浏览器看到的是 `/api/containers/:containerId/delivery-instruction`。

这条送仓读取目前只由本模块控制器使用。`index.ts` 已经导出的是送仓就绪、替换指令和卸柜报告等 Port。你新加的能力若要给别的模块用，再从 `index.ts` 导出；调用方只 import 该模块目录，并在自己的 `depends` 里写上这个模块 id。

### 路径 B — 在已有模块加一个字段

不新建模块，不改 `app.module.ts`。

1. 在 `database/schema.prisma` 加列，并新增一份 `database/migrations/<时间戳>_.../migration.sql`。已进入共享环境的迁移不改旧文件。
2. 领域类型加上这个字段。未知值让用例失败，不用静默默认值填上。
3. `infrastructure/` 里显式映射数据库列和代码属性，不靠同名碰巧对上。
4. 控制器的请求/响应 DTO 带上该字段。若这个形状要给别的模块或前端契约共用，再改 `packages/contracts`，并走契约生成。只在本模块用的 DTO 留在 `presentation/`。

### 路径 C — 新增加一个增量模块

API 骨架照 `apps/api/src/modules/inland-fulfillment/`。页面骨架照 `apps/web/src/modules/notification/`：它的路由指向自己的 `NotificationCenter.vue`。`inland-fulfillment` 的 `routes.ts` 目前把页面指到 `MesoPaper.vue`（看档页），只学它的登记方式，不要把那个组件当成内陆计划页面。

做完后确认这几处都登记了，漏一处就会出现「文件写了，运行时进不去」：

| 登记     | 文件                                                                                                                            | 什么时候要                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 清单     | `apps/api/src/modules/<id>/module.manifest.ts`                                                                                  | 总是。`id` 等于目录名；`kind` 用 `incremental`；`depends` 包含本模块 Nest `imports` 里的每一个兄弟模块 |
| 公开入口 | 同目录 `index.ts`                                                                                                               | 总是。只导出模块、清单和给别人用的 Port                                                                |
| 组合根   | `apps/api/src/app.module.ts` 的 `imports`                                                                                       | 总是。这里是唯一把模块装进进程的地方                                                                   |
| 能力     | 控制器 `@RequireCapabilities`；需要赋给现有岗位时改 `role-capabilities.ts`；清单 `permissions` 写上用到的能力码                 | 有读/写接口时                                                                                          |
| 能力说明 | `security/permissions.ts`                                                                                                       | 照 `inland-fulfillment` 或 `notification` 写清能力码含义。守卫不读这个文件                             |
| 路由     | `apps/web/src/modules/<id>/navigation.ts`、`routes.ts`，并加入 `apps/web/src/modules/registry.ts` 的 `moduleRouteContributions` | 有页面时。壳层用 `navLabel`、`navOrder` 生成菜单                                                       |

`pnpm repo:check` 会检查：有 `*.module.ts` 的目录必须有合法 `module.manifest.ts`。改完先跑它，再跑这条用例自己的测试。

三条路径都不做：运行时改表、在前端判断权限或业务结论、把分页函数再抽成一个全库框架（现有 `parsePageSize` 在各模块各写一份，新列表照相邻模块），以及为了将来的角色先建一套权限平台。

---

## 1. 提纲：一刀怎么切

```text
选上下文 → 写 brief → model → 权限 → control → view → 校验 → PR/合并 → 标 done
```

| 步  | 做什么                                                                              | 权威/样板                                  |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | 选定限界上下文（§3 挂靠模块）；写清目标 / 不做 / 验收                               | ADR-010、既有 task brief                   |
| 2   | `module.manifest.ts`：`id`/`kind`/`depends`/`permissions`                           | MODULE_PLUGIN_CONVENTION §5                |
| 3   | **model**：`domain/` 规则 + `application/` 用例 + Prisma 映射 + 迁移                | 本模块 `domain/`、`database/schema.prisma` |
| 4   | **权限**：控制器 `@RequireCapabilities`；角色能力表按需补码；`permissions` 写入清单 | IDENTITY_ACCESS_MODEL_V1、GC-008、§0.1     |
| 5   | **control**：`presentation/*.controller.ts`；输入 schema、分页、幂等                | §0.1 路径 A 的送仓指令控制器               |
| 6   | **view**：有页面才加 `apps/web/src/modules/<id>/`；页面样板用 notification          | §0.1 路径 C                                |
| 7   | 契约：共享 DTO/事件只进 `packages/contracts`                                        | logix-contract-parity                      |
| 8   | 门禁：按风险跑最近检查；涉及 Prisma 的 CI 须 `db:generate`                          | AGENTS §8、`.github/workflows/ci.yml`      |

**切片厚度建议**：一刀只交付一条可演示闭环（一例写路径 + 一例读路径 + 最少 UI）。「下一刀」写进 brief 的不做项，禁止同 PR 夹带。

---

## 2. 切片清单（开 PR 前勾完）

### 2.1 范围与 brief

- [ ] 本刀有 task brief；目标 / 边界 / 验收可勾选。并行上限见 `AGENTS.md` §1.2 第 17 条。
- [ ] 已声明挂靠模块与 `kind`（`base` | `incremental`）。
- [ ] 「不做」写清（通道、写状态、跨模块捷径、审批引擎等）。

### 2.2 模块与依赖

- [ ] 目录包含 `domain/`、`application/`、`presentation/`、`infrastructure/`。`security/permissions.ts` 只在需要说明能力码时添加。
- [ ] `module.manifest.ts` 存在；`depends` 都是已有模块；Nest `imports` 里的兄弟模块都写进 `depends`。
- [ ] 给其他模块用的符号从 `index.ts` 导出；调用方不引用 `domain/`、`application/`、`infrastructure/`、`presentation/`、`security/`、`engines/`。
- [ ] `pnpm repo:check` 通过（含 `check-module-manifests`）。

### 2.3 数据与契约

- [ ] 新表/列有迁移；命名 `snake_case`；代码 `camelCase`；显式映射。
- [ ] 非法输入失败，不用静默默认值。
- [ ] 写操作有事务 / 幂等 / 冲突策略（若适用）。
- [ ] 共享类型变更已走 contracts，无复制权威枚举。

### 2.4 权限与安全

- [ ] 能力码已写入 `@RequireCapabilities`，并列入 `module.manifest.ts` 的 `permissions`，与 IDENTITY / GC-008 对齐。
- [ ] 若现有岗位要拥有该能力码，已改 `identity/domain/role-capabilities.ts`。守卫不读取 `security/permissions.ts`。
- [ ] 写接口有认证；敏感读/写挂 `@RequireCapabilities`。未标注能力、也未标 `@PublicEndpoint()` / `@ServiceEndpoint()` 的路由会被拒绝。
- [ ] 租户/对象范围在 Application 显式断言（无通用行级引擎）。
- [ ] 日志无密钥、Token、多余 PII。

### 2.5 UI

- [ ] 有页面时已写入 `navigation.ts`、`routes.ts`，并加入 `apps/web/src/modules/registry.ts`。
- [ ] 页面组件是本功能自己的视图。不把 `MesoPaper.vue` 当作新模块页面。
- [ ] Web 只投影菜单和允许动作；不在前端做最终授权。`meta.roles` 与 `meta.requiredCapabilities` 不是安全边界。
- [ ] `webNavContribution` 与 manifest 一致（若有导航）。
- [ ] 浏览器请求走 `requestJson`，不自行设置 `authorization`、`x-tenant-id`、`x-operator-id`、`x-roles`。
- [ ] 不直接依赖 `themes/*`（除主题注册入口/测试）。

### 2.6 验证与合并

- [ ] 最近回归：相关单测；触及 API/UI 关键路径时加 E2E（若风险要求）。
- [ ] 本地至少：`repo:check`、相关 `typecheck`/`test`；改格式则 `format:check`。
- [ ] PR 基于最新 `main`；CI `quality` 绿后合并；brief 改为 `done` 并记 commit。

---

## 3. Odoo 可借鉴能力：全部采纳 · 优先序

原则：**业务语义采纳，实现按 Logix 分层重做**。下列条目均纳入路线图；按 P0→P3 排期，不得跳过「不做」列去扩 scope。

### P0 — 加深已落地（下一刀默认从这里选）

| #   | Odoo 语义                | Logix 采纳内容                                        | 挂靠模块                               | 不做                           | 状态                 |
| --- | ------------------------ | ----------------------------------------------------- | -------------------------------------- | ------------------------------ | -------------------- |
| 0.1 | mail chatter（对象消息） | 货柜/任务/异常上的活动时间线；问题通知挂对象          | `notification` + 主链读模型            | Discuss 频道/私聊              | 第一刀已合；深化待开 |
| 0.2 | Activity / 下次动作      | 「到期做什么、谁负责」投影到工单/任务，不另造待办引擎 | `work-execution` / `lifecycle-control` | 通用个人 TODO 产品             | 第一刀已合           |
| 0.3 | mail_bot 上下文问答      | 从通知/对象打开只读助手；带对象摘要与允许动作说明     | `notification` + `ai-governance`       | 助手写业务状态、claim/complete | 第一刀已合；深化待开 |

### P1 — 高价值运营闭环

| #   | Odoo 语义           | Logix 采纳内容                                                    | 挂靠模块                                     | 不做                |
| --- | ------------------- | ----------------------------------------------------------------- | -------------------------------------------- | ------------------- |
| 1.1 | `base_automation`   | 领域事件 → 确定性动作（死信通知、ETA 漂移跟进、LFD 预警等）可配置 | `workflow` + `exception-management` + Outbox | 脚本引擎改业务结论  |
| 1.2 | `digest`            | 日/周运营摘要（滞留、死信、超期、待复核）推送到通知               | `notification` + `performance-improvement`   | 营销邮件平台        |
| 1.3 | documents/附件      | 附件即证据：版本、来源、绑节点/工单、可追溯                       | `document-records`                           | 企业网盘/知识库产品 |
| 1.4 | `portal`（窄）      | 清关行/车队/仓库：指定任务只读 + 回执写入                         | `identity` + 相关专业模块                    | 客户自助全站门户    |
| 1.5 | `barcodes` / GS1    | 扫描作为工单采集手段，码与证据绑定                                | `work-execution` + `document-records`        | 独立 WMS/库存账     |
| 1.6 | `resource`/calendar | 车队班次、仓库卸柜窗口等能力日历，服务 inland 计划                | `inland-fulfillment` + `master-data`         | 全员 HR 排班        |

### P2 — 借形状（中期，专业链成熟后）

| #   | Odoo 语义             | Logix 采纳内容                                    | 挂靠模块                                | 不做                    |
| --- | --------------------- | ------------------------------------------------- | --------------------------------------- | ----------------------- |
| 2.1 | stock/delivery 批次   | 同港同仓合并作业、批量认领                        | `inland-fulfillment` / `work-execution` | 通用库存数量账          |
| 2.2 | `fleet`               | 车队/司机作为执行资源主数据                       | `master-data` + inland                  | 车辆会计全套            |
| 2.3 | `account_followup`    | 费用逾期催办阶梯（提醒节奏，不代替账单真相）      | `charges-settlement` + `notification`   | 总账/税务引擎           |
| 2.4 | `rating` / `survey`   | 节点或供应商服务反馈回流改善                      | `performance-improvement`               | 营销问卷平台            |
| 2.5 | spreadsheet_dashboard | 运营指标板交互隐喻（只读投影）                    | `performance-improvement`               | 表格当业务真相源        |
| 2.6 | `project` 形状        | 异常/改善事项的阶段与负责人（挂异常，不替代主链） | `exception-management`                  | 用 Project 替代货柜主链 |

### P3 — 远期可选加深（仍采纳语义，排在主链之后）

| #   | Odoo 语义      | Logix 采纳内容                          | 挂靠模块                                           | 不做             |
| --- | -------------- | --------------------------------------- | -------------------------------------------------- | ---------------- |
| 3.1 | 伙伴主数据增强 | 外部主体档案与能力标签（支撑门户/分派） | `master-data`                                      | CRM 销售漏斗     |
| 3.2 | SMS/邮件通道   | 通知多通道适配（同一 Port，可插拔通道） | `notification`                                     | 群发营销         |
| 3.3 | 维护/质量隐喻  | 供应商/运力质量事件进异常与绩效         | `exception-management` + `performance-improvement` | MRP 质量模块整迁 |

**排期规则**

1. 同时处于 `coding` / `fix` 的写任务数量以 `AGENTS.md` §1.2 第 17 条为准。P0/P1 仍按本文优先序选择，不另开一套排期。
2. P2 不得插队挡住 P0/P1 的主链可靠性（同步、证据、权限）。
3. P3 仅在对应 Port 已稳定后开刀。
4. 每刀 brief 必须引用本文条目编号（如 `采纳 1.1`）。

---

## 4. 明确不采纳（避免「借鉴」变跑偏）

| Odoo 能力                        | 原因                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Discuss / Livechat               | 产品禁止统一聊天入口；能力须贴业务对象                                                        |
| mass_mailing / 营销自动化        | 非运营主链摩擦；与通知 Port 目标不符                                                          |
| Studio / 运行时改模型视图        | 与迁移唯一入口、代码化 UI 冲突；见 [ADR-011](./decisions/ADR-011-controlled-ui-projection.md) |
| 完整 MRP / Purchase / Sale / POS | 上游采购链属未来阶段；现会稀释货柜主链                                                        |
| Knowledge / Website              | 非当前运营摩擦主因                                                                            |
| 通用多层审批流引擎               | 原则 P9：按风险触发复核，非常规每单签核                                                       |
| `_inherit` / 热安装改 schema     | MODULE_PLUGIN_CONVENTION 非目标                                                               |

---

## 5. 建议的「下一刀」默认选项（降低摩擦）

`0.1+0.2` 已合入。2026-09-20 起，业务主线按[业务纵向交付路线图](../planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md)执行：先完成 SKU/装载事实与合规纵向切片，再继续 `0.3` 助手深化和 `1.1` 通用自动化。两项仍保留在路线图，但不得在领域事实与门禁之前插队。

开刀前复制 §2 清单到 brief 或 PR 描述，勾选后合并。

---

## 6. 变更本手册

- 增删采纳条目或调整优先序：改本节并更新 [INDEX](../INDEX.md) 一句话。
- 触及部署/模块拆分：另立 ADR，不在本手册静默升级架构。
