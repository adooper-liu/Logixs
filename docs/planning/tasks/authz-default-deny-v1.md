---
status: coding
branch: feat/authz-default-deny-v1-c2b2
owner: codex
writer: cursor
risk: high
dependsOn: []
writeScopes:
  - apps/api/src/modules/work-execution/**
  - docs/planning/tasks/authz-default-deny-v1.md
exclusiveLocks:
  - authz-control-plane
  - module:work-execution
sharedIntegrationScopes:
  - package.json
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
authorityRefs:
  - docs/product/domain/IDENTITY_ACCESS_MODEL_V1.md
  - docs/product/domain/ACTION_PERMISSION_CONTRACT_V1.md
verification: |
  已核对全局 AuthenticationGuard / AuthorizationGuard、路由访问元数据、身份能力模型、
  GC-008/GC-011 与现有授权测试。当前仅后端认证默认拒绝已经实现；未声明 capability 的普通用户路由
  仍由 AuthorizationGuard 放行，且尚无全路由静态门禁。本任务尚未完成，不得宣称授权已默认拒绝。
  切片 A 已由 Codex 审查通过：AST 审计器与回归测试已接入 pnpm test；当前可复现统计为
  total=134、public=1、service=5、capability=89、missing=39、conflict=0。切片 B1 已完成 39 条定权：
  35 条映射现有能力，4 条按 AUTH-D02～D04 移出生产 HTTP 面。切片 C1 已为费用、证据与导入的
  13 条路由补齐方法级 capability，并经 Codex 与独立安全上下文复审；当前审计为 total=134、
  public=1、service=5、capability=102、missing=26、conflict=0。非零退出码仍是剩余缺口的预期结果，
  不代表默认拒绝已完成。切片 C2A 已为 lifecycle-control 的 ClientOperation、Inbox/Outbox 死信与
  人工恢复 13 条路由补齐方法级 capability，并通过 Codex、独立安全上下文和完整 pnpm validate；
  切片 C2B1 已为生命周期读取/适用性、货柜读取与任务读取 9 条路由补齐方法级 capability，并通过
  Codex、独立安全上下文和完整 pnpm validate；当前审计为 total=134、public=1、service=5、
  capability=124、missing=4、conflict=0。B2 的 Application 对象范围/二次守卫审查、C2B2 的
  4 条生产入口移除、Guard、错误契约和最终清零门禁均未完成。
---

# 任务：API 操作级授权默认拒绝 V1

> 这是当前两个写任务之一。Cursor 只执行本文明确开放的当前切片；寻源、NPI、共享控制面和单台 UI
> 因写入范围、前置契约或优先级继续暂停，不再以“全仓只能一个活动 brief”为理由暂停。原
> `p5-02-oidc-authentication-baseline` 的 `done` 只证明后端认证基线，不证明每条路由已完成操作级授权。
> `feat/authz-default-deny-v1-c2b2` 是 C2B2、D、E 的任务集成分支：各切片可形成可回滚提交，但不各自
> 建 PR 或重复等待 CI；C2B2、Guard 默认拒绝、GC-011 错误面和最终门禁完成后，由 Codex 建立一个安全收口 PR。

## 目标

让所有 API 路由在以下三种访问分类中恰好选择一种，并由自动门禁持续保证：

1. `@PublicEndpoint()`：仅明确批准的匿名端点。
2. `@ServiceEndpoint()`：仅工作负载身份调用的端点。
3. `@RequireCapabilities(...)`：普通用户端点，至少声明一个已批准 capability。

任何 HTTP 路由缺少分类、分类冲突、capability 为空或使用未批准能力码时失败关闭。前端、角色名称、
菜单可见性和“已认证”均不能代替服务端 capability、对象范围和业务前置校验。

## 当前事实

- `IdentityModule` 已把 `AuthenticationGuard` 和 `AuthorizationGuard` 注册为全局 Guard。
- OIDC 模式、开发身份隔离、唯一公开健康检查和现有三类服务端点已有历史实现与测试。
- `AuthorizationGuard` 当前在 `required.length === 0` 时 `return true`，所以已认证用户路由若未声明
  capability 会被默认放行。
- 当前仓库没有枚举所有 Nest HTTP 路由访问元数据的静态门禁；现有控制器测试只覆盖部分端点。
- `GC-011` 的稳定缺能力错误码是 `AUTHORIZATION_FORBIDDEN`，Guard 当前抛出
  `CAPABILITY_DENIED`；错误面尚未统一。
- 代码、角色矩阵和模块 manifest 使用 `container.operate`；负责人已在 `AUTH-D01` 选择将其正式登记为
  V1 货柜级受控作业能力；对象范围、动作定义和业务守卫必须继续执行并补齐。后续是否拆分须由授权审计证据触发。
- 已抽查装箱、出运、清关、卸柜和送仓 5 条现有命令链：具备租户、`expectedVersion` 和领域校验，但
  Controller 传入 Application 的授权上下文只有 `tenantId/actorId`，未见组织/地点范围或完整
  `ActionDefinitionV1` 校验。因此登记能力码不等于这些链路已经满足 `GC-008`。
- 先前“约 39 条未声明 capability 路由”是静态粗枚举，不是最终清单；本任务第一刀必须产出可复现
  的 AST 枚举结果，后续只引用该产物。

## 负责人决策记录

| 决策 ID    | 已知事实与未知                                                                                                                                                             | 选项、成本/收益/风险/可逆性                                                                                                                                                                                                                                                                                                                 | 推荐与理由                                                                                                                                                               | 负责人结论                                                                                                                           | 权威落点 / 状态                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `AUTH-D01` | `container.operate` 已被角色矩阵、多个模块 manifest 和装箱/出运/清关/内陆控制器使用，但业务能力目录漏记；尚无证据证明现有粒度满足长期最小权限                              | **A. V1 正式登记现有码**：改动小、快速消除漂移；代价是能力较宽，须继续依赖 action/object guard，可版本化再拆。**B. 立即按限界上下文拆分**：最小权限更强；需新增能力、角色/IdP 映射和全部消费者迁移，成本高且延迟默认拒绝。**C. 并入 `lifecycle.operate`**：代码改动较小；会把装箱、清关、内陆操作错误等同生命周期推进，语义失真且后续更难拆 | 推荐 A。它承认代码已有稳定意图并最快关闭默认放行；以对象范围和动作前置继续收紧，同时登记后续按审计证据拆分的退出条件。A 可通过新版本撤销或拆分，B/C 的大规模替换更难回退 | **选择 A**（2026-09-29）。正式登记现有码；当前不拆分、不并入 `lifecycle.operate`；不豁免现有 action/object guard 缺口                | `IDENTITY_ACCESS_MODEL_V1` §4～5 / `decided`            |
| `AUTH-D02` | `/workflows/echo` 与 `GET /workflows/:id` 来自 Temporal echo 基础设施验通切片；未找到当前业务岗位或生产 UI 消费者，且任意消息触发工作流不属于现有业务能力目录              | **A. 移出生产 HTTP 面**：保留模块/Worker 自动化测试；减少无业务结果的攻击面，代价是旧手工 HTTP 冒烟需改写。**B. 标为 `ServiceEndpoint`**：保留内部诊断；需正式工作负载身份、audience 和调用审计。**C. 赋予 `reliability.*`**：改动最小；会把测试工具错误包装成业务恢复能力                                                                  | 推荐 A。测试链应由自动化验证，不应为了历史冒烟长期保留生产命令入口；删除可通过后续有真实消费者时重新设计而恢复                                                           | **选择 A**（2026-09-30）。移除两个生产 HTTP 路由；保留 Worker 与自动化验通，不保留人工或 service 逃生入口                            | workflow transport surface + tests / `decided`          |
| `AUTH-D03` | `POST /node-tasks` 直接创建节点任务，但生命周期模块已经通过进程内 `CreateNodeTaskPort` 创建/调和任务；岗位 UI 只读取任务并领取/完成工单，没有人工造任务的已定业务结果      | **A. 移除外部 HTTP 入口**：保留内部 Port；阻止伪造流程任务，代价是旧 HTTP 冒烟和可能的未登记外部调用需迁移。**B. 标为 `ServiceEndpoint`**：允许未来外部编排器；需要工作负载身份和对象范围。**C. 赋 `task.execute` 或 `lifecycle.operate`**：上线最快；会让岗位能力越界为“创建系统任务”                                                      | 推荐 A。任务由生命周期事实派生最符合现有权威；若后续出现独立编排器，再以 B 的正式消费者证据开放                                                                          | **选择 A**（2026-09-30）。移除外部创建路由；任务继续只能由生命周期模块经内部 `CreateNodeTaskPort` 创建                               | `TASK_WORK_ORDER_CONTRACT_V1` + code/tests / `decided`  |
| `AUTH-D04` | 租户级 `publish-batch`、`publish-due` 和 per-tenant Schedule 既有人工恢复语义，也被历史 Worker 用开发身份头调用；仓库同时已有 service-only 的全租户系统排空与系统 Schedule | **A. 人机分离**：人工重试/排空使用 `reliability.recover`，定时机器链统一迁到现有 service-only 系统链；需迁移旧 per-tenant Schedule，但身份、审计和职责清楚。**B. 全部按 `reliability.recover`**：改动小；机器继续模拟业务人员，审计失真。**C. 全部 service-only**：机器边界最窄；会取消真实运营人员的受控恢复入口                           | 推荐 A。它保留人工恢复能力，同时停止机器冒充用户；迁移可按租户分批回退，B 会固化身份债，C 会损失业务恢复能力                                                             | **选择 A**（2026-09-30）。人工排空使用 `reliability.recover`；删除 per-tenant Schedule HTTP 入口，机器统一走现有 service-only 系统链 | `IDENTITY_ACCESS_MODEL_V1` + service routes / `decided` |

`AUTH-D01` 已解除切片 B 的能力目录阻塞，但没有解除对象范围和动作守卫的实施阻塞。后续映射仍须逐路由核对动作、范围和 Application 二次校验，不能因能力码已登记就批量视为适用或安全。

## 权威来源

| 事项           | 权威来源                                          | 本任务约束                                                    |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| 身份与能力语义 | `docs/product/domain/IDENTITY_ACCESS_MODEL_V1.md` | 角色只是能力包；未知能力不授权                                |
| 动作授权顺序   | `GC-008 ACTION_PERMISSION_CONTRACT_V1`            | 路由 capability 只是其中一层，不能替代对象/业务校验           |
| 稳定错误       | `GC-011 PUBLIC_ERROR_CONTRACT_V1`                 | 使用 `AUTHORIZATION_FORBIDDEN` / `AUTHORIZATION_SCOPE_DENIED` |
| OIDC 决策      | `ADR-008`、已完成 P5-02 brief                     | 不重做后端认证，不把 Web 登录混入本任务                       |
| 工程门禁       | `AGENTS.md`、`ENGINEERING_RULES.md`               | 公共安全边界、测试与 CI 不得降级                              |

## 影响范围与兼容性

- 影响 `apps/api/src/modules/identity/presentation/authorization.guard.ts`、所有 Nest Controller、路由访问
  装饰器、授权测试以及仓库静态检查脚本。
- 不改数据库、迁移、领域状态机、前端登录或 Web API Client。
- 这是安全收紧和行为变化：过去只认证即可访问的路由，在能力不足时会返回 403。必须先完成路由清单、
  能力映射和调用方影响审查，再切换 Guard；不得以兼容旧客户端为由保留隐式放行。
- `@PublicEndpoint` 和 `@ServiceEndpoint` 是显式例外，不允许新增“仅认证即可”的第四类逃生装饰器。

## 已完成切片 A：路由访问审计器

本切片已合入 `main`。产物只枚举并校验路由访问元数据，未修改 Guard、Controller、能力目录或业务代码。

### 产物

1. 新增 `scripts/check-route-access-metadata.mjs`，使用 TypeScript Compiler API 解析
   `apps/api/src/**/*.controller.ts`，不得使用正则猜测装饰器归属。
2. 新增 `scripts/check-route-access-metadata.test.mjs`，用内存或临时 fixture 覆盖：
   - 方法级 capability；
   - 类级 capability 继承；
   - 方法级元数据覆盖类级元数据，与 Nest `getAllAndOverride` 语义一致；
   - public、service、capability 三类合法路由；
   - 缺失分类、空 capability、冲突分类和动态不可解析参数；
   - 路径数组和无关装饰器；
   - 同名但不是两个正式 security 文件的伪装饰器；
   - 同一作用域重复访问装饰器，以及同一方法重复 HTTP 装饰器。
3. 新增只读脚本入口 `pnpm authz:routes`。当前切片运行时输出确定性清单并以非零状态报告违规，
   但暂不接入 `repo:check`，避免在 Codex 完成逐路由定权前把主质量门禁永久打红。
4. 输出格式每行至少包含：HTTP method、控制器路径、`Class.method`、访问分类、capability 列表和
   违规码；排序稳定为 `file -> class -> method -> HTTP method`。
5. 不提交生成的清单文件；命令输出即为可复现证据。brief 的下一条进度记录只写总数和分类统计，
   不复制整份路由目录。

### 审计规则

- 只枚举含 Nest `@Controller()` 的类及含 `@Get/@Post/@Put/@Patch/@Delete/@Options/@Head/@All`
  的方法。
- 访问分类按运行时有效元数据判断；类级与方法级声明冲突必须报告，不能因覆盖顺序静默放行。
- `PublicEndpoint`、`ServiceEndpoint` 只认指向 `apps/api/src/security/route-access.decorator.ts` 的具名相对导入；`RequireCapabilities` 只认指向 `apps/api/src/security/require-capabilities.decorator.ts` 的具名相对导入。别名、barrel、跨包重导出和其它来源一律不认。
- 同一作用域出现多个访问装饰器时报告 `ACCESS_METADATA_DUPLICATE`，不选择其中一个。
- 同一方法出现多个 HTTP 装饰器时报告 `HTTP_DECORATOR_DUPLICATE`，只记录源码中最上方、运行时最后写入的那一条，不展开成多条。
- `@RequireCapabilities()` 零参数、非字符串字面量或重复空白值均为违规。
- 本切片只验证 capability 形状和访问分类，不判断某能力是否适合某业务路由；业务映射由 Codex 完成。
- 测试不得靠扫描当前仓库“恰好有多少缺口”通过；分析器逻辑测试与当前仓库审计结果分开。

### 切片 A 验收

- [x] AST 审计器可重复枚举全部 Nest HTTP 路由，不漏类级元数据
- [x] 合法、缺失、冲突、空声明和动态声明均有正反向测试
- [x] `pnpm authz:routes` 对当前仓库给出稳定统计和非零退出码
- [x] 未修改 Guard、Controller、业务服务、能力目录、数据库或 Web
- [x] `node --test scripts/check-route-access-metadata.test.mjs` 已接入 `pnpm test`；`pnpm repo:check`、
      `pnpm format:check` 通过

## 当前与后续切片

### 部分完成 B. Codex 定权与能力目录纠偏

- [x] B1：Codex 根据 AST 清单逐路由映射现有批准 capability，区分 read/write、用户/service/public。
- [x] B1：`container.operate` 按 `AUTH-D01` 和正式能力目录映射；其他漂移仍须逐项裁决，不得由路由现状反向升格为权威能力。
- [ ] B2：形成最小审查表：路由、数据/业务影响、所需能力、对象范围、现有 Application 二次校验和缺口；
      `container.operate` 的 5 条现有命令链必须逐条标出尚缺的组织/地点范围和 `ActionDefinitionV1` 校验。

#### 切片 B 路由定权清单

以下按共同业务影响合并展示，但实现和测试必须逐路由落元数据。`approved` 只表示能力码已有权威依据，
不表示对象范围、ActionDefinition 或 Application 二次校验已经完成。

| 路由组                                                                                                  | 数量 | 建议分类 / capability                      | 依据与仍需核对                                                                     | 状态       |
| ------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------ | ---------------------------------------------------------------------------------- | ---------- |
| `POST /overdue-accrual/compute`、`POST /overdue-deadlines/compute`、`PUT /overdue-charge-standards`     |    3 | `charges.manage`                           | 能力目录明确包含维护标准与触发确定性重算；仍需核对费用范围和生效期                 | `approved` |
| `POST /evidence`                                                                                        |    1 | `evidence.submit`                          | 登记证据，不自动核验；仍需对象引用和上传范围                                       | `approved` |
| `POST /evidence/:id/{verify,reject,revoke}`                                                             |    3 | `evidence.review`                          | 能力目录逐项列明；仍需职责分离和对象范围                                           | `approved` |
| `GET /import-batches/:id`、`GET /import-batches/:id/reconciliation`                                     |    2 | `import.read`                              | 只读批次与对账；不得返回对象存储内部键                                             | `approved` |
| `POST /import-batches`、`POST /import-batches/:id/mapping-reviews`、`POST /import-batches/:id/precheck` |    3 | `import.operate`                           | 上传、映射确认和预检；不得绕过 blocker                                             | `approved` |
| `POST /import-batches/:id/execute`                                                                      |    1 | `import.execute`                           | 只执行已确认且预检通过批次                                                         | `approved` |
| `GET /client-operations*` 及补偿查询                                                                    |    4 | `reliability.read`                         | 读取操作、补偿和同步状态；租户范围已存在，仍需稳定错误面                           | `approved` |
| `POST /client-operations/:id/compensations`、`POST .../resolve`                                         |    2 | `reliability.recover`                      | 申请/推进补偿；仍需原因、复核和对象范围                                            | `approved` |
| `POST /client-operations`                                                                               |    1 | `lifecycle.operate`                        | 当前载荷是货柜 lifecycle action/event；装饰器不替代 actionCode、对象范围和状态守卫 | `approved` |
| `GET /inbox/dead-letters`、`POST /inbox/dead-letters/:id/replay`                                        |    2 | `reliability.read` / `reliability.recover` | 读与重放分权；重放仍需原因、目标消费者版本和幂等                                   | `approved` |
| `GET /lifecycle-current-nodes`、`GET /lifecycle-nodes`、`GET /containers/:id/lifecycle-nodes`           |    3 | `lifecycle.read`                           | 读取当前节点和投影                                                                 | `approved` |
| `POST /containers/:id/node-applicability`                                                               |    1 | `lifecycle.operate`                        | 设置适用性是目录明确的受控生命周期动作                                             | `approved` |
| `GET /outbox/dead-letters`、`POST /outbox/dead-letters/:id/replay`                                      |    2 | `reliability.read` / `reliability.recover` | 读与人工重放分权                                                                   | `approved` |
| `POST /outbox/{publish-batch,publish-due}`                                                              |    2 | `reliability.recover`                      | 仅保留人工受控恢复；机器不得模拟用户                                               | `approved` |
| `POST /workflows/outbox-publish-due/schedule`                                                           |    1 | 移除生产 HTTP 路由                         | 定时机器链统一使用现有 service-only 系统 Schedule                                  | `approved` |
| `GET /containers`、`GET /containers/:id`、`GET /containers/:id/cargo`                                   |    3 | `container.read`                           | 货柜及其业务投影读取；敏感证据另行裁剪                                             | `approved` |
| `GET /node-tasks`、`GET /node-tasks/:id`                                                                |    2 | `task.read`                                | 读取节点任务与工单                                                                 | `approved` |
| `POST /node-tasks`                                                                                      |    1 | 移除生产 HTTP 路由                         | 任务只由生命周期模块通过内部 Port 创建                                             | `approved` |
| `POST /workflows/echo`、`GET /workflows/:id`                                                            |    2 | 移除生产 HTTP 路由                         | 保留 Worker/自动化测试，不保留无业务结果的生产入口                                 | `approved` |

合计 39 条：35 条使用现有正式 capability，4 条移出生产 HTTP 面。`AUTH-D02`～`AUTH-D04`
均已由负责人选择 A；切片 B1 至此完成。B2 仍由 Codex 并行审查，尚未修改任何 Controller，
不能把定权完成说成默认拒绝或对象级授权已经完成。

### 已完成 C1. 费用、证据与导入路由显式分类

Cursor 只可修改以下 4 个现有 Controller 及同目录对应的元数据测试，共处理 13 条路由：

- `overdue-accrual.controller.ts`、`overdue-deadlines.controller.ts`：3 条 `charges.manage`；
- `evidence.controller.ts`：1 条 `evidence.submit`、3 条 `evidence.review`；
- `import-batches.controller.ts`：2 条 `import.read`、3 条 `import.operate`、1 条 `import.execute`。

本切片只增加方法级 `@RequireCapabilities(...)` 和验证反射元数据的测试，不改 DTO、Application、Domain、
数据库、Web、Guard 或错误契约。不得使用 class-level 宽能力掩盖同一 Controller 内的读写差异。完成后运行
相关 Controller 测试、API lint/typecheck/test、`pnpm authz:routes`、`pnpm repo:check` 和格式检查；审计预期
只证明 `missing` 从 39 降到 26，不得据此宣称授权任务完成。

#### C1 验收

- [x] 13 条路由逐方法映射已批准 capability，没有使用类级能力抹平读写差异
- [x] 13 个方法均有反射元数据断言，AST 审计提供第二条验证路径
- [x] Codex 与独立安全上下文均未发现 finding
- [x] 定向测试 4 文件 8/8、API 单元测试 262 文件 1340/1340、API lint/typecheck、`repo:check`、
      `format:check` 和 `git diff --check` 通过
- [x] `pnpm authz:routes` 复现 `total=134 public=1 service=5 capability=102 missing=26 conflict=0`；退出码 1
      来自剩余缺口，不作为成功门禁
- [ ] 集成测试、E2E、build 和完整 `validate` 未在 C1 执行，由切片 E 与合并前必需 CI 承接

### 已完成 C2A. 生命周期控制可靠性路由显式分类

Cursor 只可修改以下 3 个现有 Controller 及同目录对应的元数据测试，共处理 13 条路由：

- `client-operation.controller.ts`：
  - `getById`、`getCompensationById`、`list`、`listCompensationsPage` 使用 `reliability.read`；
  - `compensate`、`resolve` 使用 `reliability.recover`；
  - `submit` 使用 `lifecycle.operate`，不得把生命周期命令并入可靠性恢复能力。
- `inbox-dead-letter.controller.ts`：`listDeadLettersPage` 使用 `reliability.read`，`replay` 使用
  `reliability.recover`。
- `outbox.controller.ts`：`listDeadLettersPage` 使用 `reliability.read`；`replay`、`publishBatch`、
  `publishDue` 使用 `reliability.recover`。

本切片只增加方法级 `@RequireCapabilities(...)` 和验证全部 13 个方法反射元数据的测试，不改 DTO、
Application、Domain、数据库、Web、Guard、错误契约、补偿/重放前置条件或对象范围实现。不得使用类级
能力抹平同一 Controller 内的读写差异，不得顺带处理剩余 13 条路由或删除 HTTP 入口。完成后运行相关
Controller 测试、API lint/typecheck/test、`pnpm authz:routes`、`pnpm repo:check` 和格式检查；审计预期为
`total=134 public=1 service=5 capability=115 missing=13 conflict=0`，退出码仍为 1。Cursor 完成后停止，
保留未提交差异交由 Codex 和独立安全上下文审查。

#### C2A 验收

- [x] 13 条路由逐方法映射已批准 capability；读、人工恢复和生命周期提交保持分权
- [x] 13 个方法均有反射元数据断言，AST 审计提供第二条验证路径
- [x] Codex 与独立安全上下文均未发现 finding
- [x] 定向测试 3 文件 3/3、API 单元测试 265 文件 1343/1343、API lint/typecheck、`repo:check`、
      `format:check` 和 `git diff --check` 通过
- [x] 完整 `pnpm validate` 通过，覆盖契约、全仓 lint/typecheck/test、真实 PostgreSQL 集成、E2E 和构建
- [x] `pnpm authz:routes` 复现 `total=134 public=1 service=5 capability=115 missing=13 conflict=0`；退出码 1
      来自剩余缺口，不作为成功门禁
- [ ] 对象范围、补偿/重放前置条件、职责分离、GC-011 错误面和 Guard 默认拒绝不属于 C2A，仍未完成

### C2B1. 生命周期、货柜与任务读取路由显式分类（已完成）

Cursor 只可修改以下 6 个现有 Controller 及同目录对应的元数据测试，共处理 9 条路由：

- `lifecycle-current-nodes.controller.ts` 的 `list`、`lifecycle-nodes-batch.controller.ts` 的 `list`、
  `lifecycle-nodes.controller.ts` 的 `list` 均使用 `lifecycle.read`；
- `node-applicability.controller.ts` 的 `apply` 使用 `lifecycle.operate`；
- `containers.controller.ts` 的 `list`、`get`、`getCargo` 均使用 `container.read`；
- `work-execution.controller.ts` 的 `list`、`get` 使用 `task.read`。

本切片只增加方法级 `@RequireCapabilities(...)` 和验证上述 9 个方法反射元数据的测试，不改 DTO、
Application、Domain、数据库、Web、Guard、错误契约、对象范围或 HTTP 入口。特别禁止修改或授权
`WorkExecutionController.create`；该生产入口已按 `AUTH-D03` 决定移除，留给 C2B2。不得用类级能力覆盖同一
Controller 的不同风险方法。完成后运行相关 Controller 测试、API lint/typecheck/test、`pnpm authz:routes`、
`pnpm repo:check` 和格式检查；审计预期为
`total=134 public=1 service=5 capability=124 missing=4 conflict=0`，退出码仍为 1。Cursor 完成后停止，
保留未提交差异交由 Codex 和独立安全上下文审查。

#### C2B1 验收

- [x] 9 条目标路由均使用已批准的方法级 capability；未用类级声明抹平读写差异
- [x] 9 个目标方法均有反射元数据断言，AST 审计提供第二条验证路径
- [x] Codex 与独立安全上下文均未发现 finding；对象范围、业务守卫和 GC-011 未被误报为已完成
- [x] 定向测试 6 文件 12/12、API 单元测试 268 文件 1349/1349、`repo:check`、`format:check` 和
      `git diff --check` 通过
- [x] 完整 `pnpm validate` 通过，覆盖契约、全仓 lint/typecheck/test、真实 PostgreSQL 集成、E2E 和构建
- [x] `pnpm authz:routes` 复现 `total=134 public=1 service=5 capability=124 missing=4 conflict=0`；退出码 1
      只来自 C2B2 已批准移除的 4 条入口，不作为成功门禁
- [ ] C2B2、Application 对象范围/二次守卫、GC-011 错误面和 Guard 默认拒绝仍未完成

### 当前开放 C2B2. 4 条生产 HTTP 入口移除

- `POST /node-tasks` 按 `AUTH-D03` 移除，任务继续只能由生命周期模块经内部 Port 创建；
- `POST /workflows/outbox-publish-due/schedule` 按 `AUTH-D04` 移除，机器统一走现有 service-only 系统链；
- `POST /workflows/echo`、`GET /workflows/:id` 按 `AUTH-D02` 移除，保留 Worker 与自动化验通；
- 入口删除是行为变化，必须逐项核对模块绑定、调用方、测试和 OpenAPI，不得在 C2B1 顺带实施。
- 路由违规清零前不得切换 Guard 默认拒绝，也不得把审计脚本接入硬门禁。

实现基线为 `cdd4df4`。Cursor 只可处理本节 4 条已批准入口及直接失去消费者的 transport DTO：

- `work-execution.controller.ts` 删除 `create` 路由、构造器依赖和对应 import；
  `work-execution.dto.ts` 删除只服务该入口的 `CreateNodeTaskRequestDto`；测试必须证明外部创建入口消失，
  同时保留 `CreateNodeTaskService` 内部 provider 与 `CREATE_NODE_TASK` provider/export，移除具体 Service 的
  Nest export 和 `index.ts` 公共导出；跨模块调用只允许依赖 Port；
- `workflow.module.ts` 取消 `WorkflowController`、`OutboxPublishScheduleController` 的注册和开发身份中间件绑定，
  删除这两个 Controller 及只由它们消费的 `echo-request.dto.ts`、`outbox-publish-schedule.dto.ts`；
- 删除已无 API 或模块消费者的 `WorkflowService`、`EnsureOutboxPublishScheduleService`、对应测试、provider/export
  及 API 侧仅服务租户 Schedule 的常量/类型；保留 Echo Worker 自动化测试、Temporal Schedule adapter、
  `OutboxPublishSystemScheduleController`、系统 Schedule 服务和 service-only 身份边界；
- business-worker 的旧 `outboxPublishDueWorkflow` 暂作为外部 Schedule 迁移期兼容代码保留，不得据此宣称
  机器身份已统一；所有环境完成下述迁移门禁后，必须在同一任务后续切片移除旧 Workflow、Activity 和用户身份请求构造；
- 增补模块/Controller 元数据测试，反证 4 条路由不能再由生产模块注册，并证明内部 Port 与 service-only
  系统 Schedule 仍在。仓库当前未发现 Web、Worker、package 或 script 对这 4 条 HTTP 路由的生产调用；
  历史 task 文档保留原验收记录，不追溯改写。

这是负责人已批准的破坏性 transport 收缩，不引入替代 URL 或兼容期。OpenAPI 由已注册 Nest Controller
动态生成，无受版本控制的生成客户端需要同步；删除后须以模块元数据测试、运行时 404/405、Swagger path
缺失、全仓搜索和路由 AST 审计共同验证。
完成后 `pnpm authz:routes` 必须退出 0，并精确得到
`total=130 public=1 service=5 capability=124 missing=0 conflict=0`。同时运行相关 Controller/模块测试、API
lint/typecheck、`pnpm authz:routes`、`pnpm repo:check`、`pnpm format:check` 和 `git diff --check`。完整 API
test/build、集成测试、E2E 和 `pnpm validate` 不在 C2B2 机械切片重复运行，由 D、E 集成后的最终 PR 候选统一承接。
不得在本切片切换 Guard、实现 GC-011、接入 CI 硬门禁或处理对象范围。Cursor 以 `ready-for-review` 交回
未提交差异，由 Codex 审查后在同一任务集成分支继续 D、E。C2B2 的入口政策与迁移边界已经独立复审；只有
实现偏离已定政策、出现新的权限政策/公开入口/对象范围/状态语义，或最终集成产生新风险时才再次触发独立复审。

#### C2B2 独立复审处置与部署门禁

| finding              | 处置       | 理由与写回                                                                                                                           |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `C2B2-AUTOMATION-01` | `accepted` | 删除创建入口不会停止 Temporal 已持久化 Schedule；本节增加逐环境迁移、验证和回滚门禁，未取得外部证据前不宣称 D04 完成                 |
| `C2B2-BOUNDARY-02`   | `accepted` | 具体 `CreateNodeTaskService` 不应成为跨模块入口；改为只公开 `CREATE_NODE_TASK` token/type，模块内部实现继续为 Port 提供服务          |
| `C2B2-LEGACY-03`     | `accepted` | 删除失去消费者的 API Echo/租户 Schedule 服务；旧 Worker 只因外部 Schedule 状态未知而临时保留，待全部环境迁移完成后按明确退出条件删除 |

仓库无法证明各部署环境是否存在 `outbox-publish-due:<tenantId>`。因此 C2B2 代码合并不等于 D04
生产迁移完成；该外部状态不阻止代码实现、提交、PR 审查或合并，但阻止受影响环境生产部署和本任务标记
`done`。部署 C2B2 或启用 Guard 默认拒绝前，每个环境必须由授权运维人员执行并留存变更单证据：

1. 盘点全部 Temporal Schedule，记录匹配 `outbox-publish-due:` 前缀的精确 ID、状态、最近/下次运行时间；不得假定为零。
2. 确认唯一 `outbox-publish-due-system` 已启用，并完成一次 service-only 调用，验证只携带服务身份且成功命中
   `/api/outbox/system/publish-due`。
3. 先暂停而非删除全部旧租户 Schedule；复查活动 Schedule 中该前缀计数为 0，再部署入口删除。
4. 失败回滚时先暂停系统 Schedule、回滚 API/Worker 到上一版本，再只恢复盘点快照中的旧 Schedule；不得凭前缀
   批量创建或恢复未知项。

上述外部证据由部署变更单或正式运维记录承载，不伪造进 Git。所有目标环境均完成第 1～3 步并由负责人确认
回滚窗口关闭后，才可删除旧 Worker Workflow/Activity/用户身份请求构造并把 `AUTH-D04` 标为生产完成。

### D. Guard 默认拒绝和错误契约

- 缺失访问元数据时失败关闭并记录内部配置错误；对外返回 `AUTHORIZATION_FORBIDDEN`，不泄露内部类名。
- 缺能力同样返回 GC-011 稳定错误结构；保留 traceId，由统一异常面承接。
- 补全 Guard、认证集成和代表性 Controller 的正反向测试。

### E. CI 硬门禁与调用方验证

- 路由违规清零后把 `authz:routes` 接入 `repo:check` 或稳定 `validate` 链路，禁止基线豁免表长期存在。
- C2B2、D、E 在同一任务集成分支串行完成；中间切片只运行定向检查，不单独建 PR。形成最终 PR 候选后，
  由 Codex 统一运行一次 API 单元、真实 PostgreSQL 集成、E2E 和完整 `pnpm validate`；检查开发身份、OIDC 用户、
  service-only、跨租户、缺能力和合法能力路径。
- 合并前复查 OpenAPI/错误响应、客户端受影响路径和回退方案；不得降低断言换取通过。

## 业务与数据协同映射

这是安全底层任务，不交付新岗位页面；直接消费者是所有 API、工作台控制面和 Web API Client。

| 使用场景          | 消费者需要看到什么            | 系统允许做什么                                        | 可靠保存与反馈                                 |
| ----------------- | ----------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| 用户读取队列/详情 | 稳定 403 或经裁剪数据         | 只有具备 read capability 且对象范围命中才返回         | 不存在/越权避免侧漏，错误带 traceId            |
| 用户执行业务动作  | 服务端投影动作及不可执行原因  | 路由 capability、对象范围和业务前置全部通过才调用用例 | 操作审计记录授权结果，业务写入仍由领域事务负责 |
| 服务调用内部端点  | 明确 service-only 分类        | 仅工作负载身份和既定 audience                         | 不模拟用户，不接受普通 Bearer 冒充             |
| 工作台呈现按钮    | `allowedActions` 只作体验投影 | 命令到达时重新执行完整授权                            | 前端伪造按钮不改变服务端决策                   |

## 总体验收

- [ ] 所有 HTTP 路由恰有一种显式访问分类，静态门禁无豁免基线
- [ ] 非 public/service 路由缺 capability 时默认拒绝
- [ ] 所有 capability 均来自批准后的单一目录，不存在代码/文档漂移
- [ ] 读写能力最小化；同控制器不同风险方法没有被宽泛 class-level 声明覆盖
- [ ] 缺能力、越范围、跨租户和对象不存在的错误符合 GC-011 且不泄露资源存在性
- [ ] Application 层对象范围和业务守卫未被 Controller 装饰器替代
- [ ] 前端伪造身份、能力或 allowedAction 不能改变服务端结果
- [ ] API 单元、集成、E2E、安全专项和完整 `pnpm validate` 通过

## 回滚

代码回滚可以恢复上一版本，但不得把 AuthorizationGuard 改回隐式允许作为生产回退方案。若错误映射
导致合法业务受阻，应修正路由 capability 或角色映射并重新验证；紧急访问只能走已批准 break-glass，
不能临时关闭全局 Guard。

## 进度 log

| 日期       | 阶段   | 负责                          | commit | 说明                                                                                                                                                                                   |
| ---------- | ------ | ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-29 | design | 负责人                        | —      | `AUTH-D01` 选择 A：正式登记 `container.operate`，保留守卫并按审计证据再拆                                                                                                              |
| 2026-09-29 | coding | Codex                         | —      | 核清认证与授权差异、默认允许根因、错误码和能力目录漂移；开放 Cursor 切片 A                                                                                                             |
| 2026-09-30 | coding | Cursor                        | —      | 切片 A 收缩：只认两个 security 文件的具名导入；重复装饰器失败关闭。`pnpm authz:routes` total=134 public=1 service=5 capability=89 missing=39 conflict=0。未接入 repo:check，未改 Guard |
| 2026-09-30 | coding | Codex                         | —      | 审查并验收切片 A；脚本测试 46/46、`pnpm lint`、`pnpm repo:check`、`pnpm format:check`、`pnpm test` 通过。保留 39 个缺口供后续定权，未进入切片 B                                        |
| 2026-09-30 | design | 负责人                        | —      | `AUTH-D02`～`AUTH-D04` 均选择 A：移除 Echo 与人工创建任务 HTTP 入口；人工可靠性恢复与 service-only 机器链分离                                                                          |
| 2026-09-30 | coding | Codex                         | —      | 完成 B1 的 39 条路由定权：35 条映射现有能力，4 条决定移除；B2 二次守卫审查未完成。只开放 Cursor C1 的费用、证据和导入 13 条路由，尚未修改运行时代码                                    |
| 2026-09-30 | coding | Cursor / Codex / 独立安全复审 | —      | C1 为费用、证据与导入 13 条路由补齐方法级能力并通过双重审查；审计降至 `missing=26`。总任务仍未完成，未开放 Guard 默认拒绝或对象级授权结论                                              |
| 2026-09-30 | coding | Codex                         | —      | 开放 C2A：仅处理 lifecycle-control 的 client-operation、inbox dead-letter、outbox 共 13 条路由元数据；其余 13 条及 4 条入口删除保持封闭                                                |
| 2026-09-30 | coding | Cursor / Codex / 独立安全复审 | —      | C2A 为生命周期控制可靠性 13 条路由补齐方法级能力；双重审查无 finding，完整 `pnpm validate` 通过，审计降至 `missing=13`。总任务仍未完成                                                 |
| 2026-09-30 | coding | Codex                         | —      | 开放 C2B1：仅为生命周期读取/适用性、货柜读取和任务读取 9 条路由补齐方法级能力；4 条已决定移除的入口保持封闭并留给 C2B2                                                                 |
| 2026-09-30 | coding | Cursor / Codex / 独立安全复审 | —      | C2B1 为生命周期读取/适用性、货柜读取和任务读取 9 条路由补齐方法级能力；双重审查无 finding，完整 `pnpm validate` 通过，审计降至 `missing=4`。总任务仍未完成                             |
| 2026-09-30 | coding | Codex                         | —      | 开放 C2B2：只移除 4 条已批准的生产 HTTP 入口及专属 transport DTO；保留任务内部 Port、Workflow/Worker 自动化能力与 service-only 系统 Schedule，预期路由审计清零                         |
| 2026-09-30 | coding | 负责人 / Codex                | —      | 调整执行节奏：C2B2、D、E 共用任务集成分支和最终安全 PR；Cursor 只跑切片定向检查，Codex 在最终候选统一跑完整门禁；独立复审按新决策/风险触发，Temporal 外部迁移只阻止部署与 `done`       |
