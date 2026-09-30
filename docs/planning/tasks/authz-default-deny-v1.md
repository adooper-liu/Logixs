---
status: fix
branch: feat/authz-default-deny-v1-c2b2
verification: |
  已核对全局 AuthenticationGuard / AuthorizationGuard、路由访问元数据、身份能力模型、
  GC-008/GC-011 与现有授权测试。全路由静态审计已清零并接入 repo:check 硬门禁。本任务尚未完成，
  不得宣称操作级授权闭环完成。
  切片 A 已由 Codex 审查通过：AST 审计器与回归测试已接入 pnpm test；当前可复现统计为
  total=134、public=1、service=5、capability=89、missing=39、conflict=0。切片 B1 已完成 39 条定权：
  35 条映射现有能力，4 条按 AUTH-D02～D04 移出生产 HTTP 面。切片 C1 已为费用、证据与导入的
  13 条路由补齐方法级 capability，并经 Codex 与独立安全上下文复审；当前审计为 total=134、
  public=1、service=5、capability=102、missing=26、conflict=0。非零退出码仍是剩余缺口的预期结果，
  不代表默认拒绝已完成。切片 C2A 已为 lifecycle-control 的 ClientOperation、Inbox/Outbox 死信与
  人工恢复 13 条路由补齐方法级 capability，并通过 Codex、独立安全上下文和完整 pnpm validate；
  切片 C2B1 已为生命周期读取/适用性、货柜读取与任务读取 9 条路由补齐方法级 capability，并通过
  Codex、独立安全上下文和完整 pnpm validate；当前审计为 total=134、public=1、service=5、
  capability=124、missing=4、conflict=0。切片 C2B2 已由 Codex 审核通过：4 条无业务消费者的生产 HTTP
  入口已移除，内部 Port、service-only 系统 Schedule 与迁移期 Worker 兼容路径仍保留；当前审计为
  total=130、public=1、service=5、capability=124、missing=0、conflict=0。阶段 D 已由 Codex 审查通过：普通用户路由缺访问元数据或
  缺 capability 时失败关闭，专用异常过滤器返回 GC-011 AUTHORIZATION_FORBIDDEN 信封且不接管其他
  ForbiddenException；public、service-only 和合法 capability 路径保持可用。Codex 复跑身份模块单元测试
  37 项、认证集成测试 8 项、API lint/typecheck、authz:routes、repo:check、format:check 和 diff check 均通过。
  E1 已由 Codex 审查通过：静态审计接入 repo:check，4 条旧入口运行时返回 404/405，保留入口仍可命中，
  且未发现旧入口调用方。Codex 已从 tsc 编译产物读取 `/api/docs-json`，确认三个 workflow 旧路径不存在且
  `/api/node-tasks` 只有 GET；最终候选的完整 `pnpm validate` 亦通过。B2 审查表已完成，并确认任务详情与节点
  适用性幂等重放存在两个可直接修复的范围缺口。B2F1R 已把任务详情、领取、完成和幂等重放改为从 Repository
  起按租户读取，定向单元测试 153 项、真实 PostgreSQL 集成测试 11 项及相关门禁通过；`AUTH-B2-01/02/11`
  的窄修复成立。独立复审另确认完成工单缺少并发版本守卫，且领取/完成的事务写谓词未携带租户范围；已采纳为
  `AUTH-B2-13/14` 并进入 B2F1C，不把它们扩大为角色或通用权限平台。组织/地点范围、ActionDefinition、
  职责分离、完整幂等范围和统一错误面仍须分片治理。最终安全收口复审和生产 Temporal Schedule 迁移仍未完成。
---

# 任务：API 操作级授权默认拒绝 V1

> 这是当前唯一活动任务。Cursor 只执行本文明确开放的当前切片；寻源、NPI、共享控制面和单台 UI
> 继续暂停。原 `p5-02-oidc-authentication-baseline` 的 `done` 只证明后端认证基线，不证明每条路由
> 已完成操作级授权。
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
- 任务启动时 `AuthorizationGuard` 对缺访问元数据路由默认放行；阶段 D 已改为失败关闭，并以专用异常返回
  `GC-011` 的 `AUTHORIZATION_FORBIDDEN` 信封。
- 任务启动时没有枚举全部 Nest HTTP 路由访问元数据的静态门禁；阶段 A/E1 已建立 AST 审计并接入
  `repo:check`，当前 130 条路由审计无缺失或冲突。
- Guard 缺能力错误面已经统一；Application 层历史 `AUTHORIZATION_SCOPE_DENIED`、跨租户不存在性保护和
  其它业务错误仍使用多种 Nest 默认形状，不能据此宣称全 API 错误面已经统一。
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
- [x] B2：形成最小审查表：路由、数据/业务影响、所需能力、对象范围、现有 Application 二次校验和缺口；
      `container.operate` 的 5 条现有命令链已逐条核对组织/地点范围和 `ActionDefinitionV1` 校验。
- [ ] B2 的审查完成不等于缺口修复完成；`AUTH-B2-01`～`AUTH-B2-14` 按下文分片治理。

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
均已由负责人选择 A；切片 B1 至此完成。B2 已按下表完成审查，但审查结论和已修复实现必须分开记录，
不能把定权或审查完成说成对象级授权已经完成。

#### B2. Application 对象范围与二次守卫审查

本表初审覆盖 B1 保留的 35 条路由，并额外覆盖 `AUTH-D01` 要求复核的 5 条 `container.operate` 命令链。
独立复审发现该范围遗漏两条既有 `task.execute` 写路由；因此下表不是全部 124 条 capability 路由的对象范围
完成证明。B2F1R 先补齐全部现有 `task.execute` 读写链，其他历史路由仍须保留为验证缺口，不得由路由元数据
清零推导为 Application 对象授权完成。
“已有”只表示代码中可证明的现状，不表示满足完整 `GC-008`。组织/地点、owned、assigned、designated 等范围
尚未进入 `AuthenticatedUserIdentity`，不得把租户过滤写成完整对象授权。

| 路由组                              | 数据/业务影响                             | 能力                       | 已有 Application / Repository 二次守卫                                                         | 可证缺口                                                                                                               |
| ----------------------------------- | ----------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 超期费用计算与标准替换（3）         | 读取/整体替换租户费用标准，计算期限与应计 | `charges.manage`           | 标准与费率按租户查询；替换校验操作者、费用码、日历基准和阶梯                                   | `AUTH-B2-08`：无组织/地点范围；未拒绝标准生效区间倒置或同一适用键区间重叠                                              |
| 证据登记（1）                       | 新增证据及来源快照                        | `evidence.submit`          | 校验租户、受控枚举、哈希和租户级幂等                                                           | `AUTH-B2-05`：不验证 subject 存在且属于该租户；未记录提交人，无法执行提交人与复核人分离                                |
| 证据 verify/reject/revoke（3）      | 追加核验决定并改变当前核验投影            | `evidence.review`          | 读取证据后比对租户，执行合法状态转换并追加决定                                                 | `AUTH-B2-05/09`：没有提交人可供职责分离；跨租户与不存在返回可区分的 403/404 且未使用统一信封                           |
| 导入批次读取与对账（2）             | 读取租户批次、样本行与逐行结果            | `import.read`              | `findById(id, tenantId)`；响应显式排除对象存储内部键                                           | `AUTH-B2-10`：只有 tenant 范围，没有正式 `owned/import scope`                                                          |
| 上传、映射确认、预检（3）           | 保存来源文件、确认映射并计算 blocker      | `import.operate`           | replacement/批次按租户读取；映射状态机与预检 blocker 在 Application 执行                       | `AUTH-B2-10`：没有 owned/转交范围；上传者与映射确认者的责任边界未建模                                                  |
| 执行导入（1）                       | 仅把 approved 批次落入业务表并生成对账    | `import.execute`           | 按租户加载批次，只允许 `approved`；按行记录成功/失败                                           | `AUTH-B2-10`：命令未携带执行人，无法形成执行授权审计或执行人与确认人策略                                               |
| ClientOperation 与补偿读取（4）     | 读取操作、补偿和三阶段状态                | `reliability.read`         | 列表/游标绑定租户；单项读取对跨租户统一返回不存在                                              | 暂未发现租户越界；designated/组织范围仍未建模                                                                          |
| 申请/推进补偿（2）                  | 新建补偿、推进 pending 到终态             | `reliability.recover`      | 原操作/补偿租户与父 ID 校验；申请含操作者、原因、状态与幂等守卫                                | `AUTH-B2-06/09`：resolve 不携带操作者、原因或复核；跨租户错误与不存在可区分且响应形状未统一                            |
| 提交 ClientOperation（1）           | 记录用户生命周期命令的三阶段拒绝回执      | `lifecycle.operate`        | action/payload/hash/幂等校验；当前禁止客户端直接推进生命周期                                   | `AUTH-B2-07`：落拒绝记录前不验证目标货柜属于该租户；未接 `ActionDefinitionV1`                                          |
| Inbox 死信读取/重放（2）            | 查看并以新消息重放死信                    | `reliability.read/recover` | 列表按租户；重放校验原消息租户、状态、原因、消费者版本、载荷引用和幂等                         | `AUTH-B2-09`：跨租户与不存在仍可区分，Application 403 未映射统一信封                                                   |
| 生命周期节点批量/单柜读取（3）      | 读取当前节点、全部节点和日期事实投影      | `lifecycle.read`           | 批量查询从 Repository 带租户；单柜先核对货柜租户并以不存在隐藏跨租户                           | 只有 tenant 范围，尚无组织/地点范围                                                                                    |
| 设置节点适用性（1）                 | 改可选节点适用性并重放 pending 事实       | `lifecycle.operate`        | 先核对货柜租户；校验证据、状态、原因、版本和幂等                                               | `AUTH-B2-02`：全局幂等键命中未核对所属 flow；另缺组织/地点范围和 `ActionDefinitionV1`                                  |
| Outbox 死信读取/重放（2）           | 查看并以新事件重放死信                    | `reliability.read/recover` | 列表按租户；重放校验原事件租户、状态、原因、消费者版本和幂等                                   | `AUTH-B2-09`：跨租户与不存在可区分，Application 403 未映射统一信封                                                     |
| 人工 publish-batch/publish-due（2） | 批量领取并投递租户待发事件                | `reliability.recover`      | claim 从 Repository 带租户与 owner 租约；机器链已分离为 service-only                           | `AUTH-B2-06`：人工排空没有原因、操作回执审计或风险复核；能力覆盖租户整队列                                             |
| 货柜列表/详情/货物（3）             | 读取货柜及其货物合规范围                  | `container.read`           | 列表、详情和货物查询均带租户；子资源先确认父货柜                                               | `AUTH-B2-03`：只有 tenant 范围，没有组织/地点范围                                                                      |
| 节点任务列表/详情（2）              | 读取任务、工单、结果和下一动作            | `task.read`                | 列表按租户；B2F1R 已将详情改为 Repository 租户限定读取并保留带柜父链断言                       | assigned/组织范围仍未建模                                                                                              |
| 领取/完成工单（2）                  | 领取或完成工单并更新任务、结果与操作回执  | `task.execute`             | B2F1R 已覆盖无柜任务、首次执行和幂等重放的租户限定读取；带柜任务仍校验父货柜                   | `AUTH-B2-13/14`：完成并发缺版本守卫；事务写谓词未原子携带租户和工单-任务关系                                           |
| 装箱、出运、清关、送仓、卸柜（5）   | 写入版本化岗位事实并触发 pending 重放     | `container.operate`        | 五链均校验租户对象、证据引用、领域状态、`expectedVersion`、幂等和操作者/原因；跨租户对象不落账 | `AUTH-B2-03/04`：身份无 organization/location scope；五链均未加载对应 `ActionDefinitionV1`，仓库地点也未与授权地点比较 |

审查处置：

| finding                                                               | 级别   | 处置                         | 后续                                                                                    |
| --------------------------------------------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------- |
| `AUTH-B2-01` 任务详情查询未从 Repository 起带租户范围                 | high   | `closed`，B2F1R 已验证       | tenant-scoped Repository 查询及真实 PostgreSQL 正反测试通过                             |
| `AUTH-B2-02` 节点适用性幂等重放未绑定 flow                            | high   | `closed`，窄修复已验证       | 返回重放结果前核对当前 flow；完整幂等范围仍见 `AUTH-B2-12`                              |
| `AUTH-B2-03` 组织/地点/assigned/owned/designated 范围未进入身份上下文 | high   | `pending-owner`              | 与 Web OIDC/身份映射一起设计范围来源、空集合语义和迁移；禁止 tenant 兜底冒充完整范围    |
| `AUTH-B2-04` 五条 `container.operate` 未接 `ActionDefinitionV1`       | high   | `accepted`，但需独立实现切片 | 先选一条真实命令作参考接入，再复用到其余四条；不得在 B2F1 临时复制动作表                |
| `AUTH-B2-05` 证据 subject 归属与职责分离缺口                          | high   | `pending-owner`              | 先定 subject 解析责任和提交人审计事实，再决定是否需要迁移                               |
| `AUTH-B2-06` 补偿推进/人工排空缺操作者、原因或复核                    | medium | `pending-owner`              | 负责人按风险决定哪些恢复动作要求 four-eyes；未定前不伪造默认原因                        |
| `AUTH-B2-07` ClientOperation 拒绝回执未核对目标货柜                   | medium | `accepted`                   | 后续小切片在写拒绝事实前执行租户对象断言                                                |
| `AUTH-B2-08` 费用范围与生效区间缺口                                   | high   | `pending-owner`              | 与费用台规格一起定适用键、区间重叠和组织/地点范围，不由 API 猜测                        |
| `AUTH-B2-09` Application 授权/不存在错误面不一致                      | medium | `accepted`，独立横向切片     | 设计统一异常映射和存在性保护；阶段 D 的专用 Guard filter 不扩大捕获范围                 |
| `AUTH-B2-10` 导入 owned/转交范围与执行审计缺口                        | medium | `pending-owner`              | 与导入岗位责任/转交规则一起定案，不把上传者永久等同所有者                               |
| `AUTH-B2-11` 领取/完成无柜工单可跳过租户校验                          | high   | `closed`，B2F1R 已验证       | claim/complete 首次执行和重放均按租户读取；跨租户与不存在同形且零写入                   |
| `AUTH-B2-12` 节点适用性幂等键范围与完整请求哈希未定                   | medium | `pending-owner`              | 在 ActionDefinition 登记 idempotencyScope 后再定 tenant/flow 键空间及证据、原因冲突语义 |
| `AUTH-B2-13` 完成工单缺少并发版本守卫                                 | high   | `accepted`，B2F1C 修复       | 事务以已读版本条件更新；冲突后重读重算，保证任务聚合与 outcome 唯一正确                 |
| `AUTH-B2-14` 领取/完成事务写谓词未携带租户和父链                      | medium | `accepted`，B2F1C 修复       | 写端口携带 tenant；事务内重验工单所属任务、任务租户和 ID 关系，失败时整笔回滚           |

#### Cursor 切片 B2F1：两个确定性范围漏洞

准确基线以 Codex 下发的 `TASK` SHA 为准。本切片只允许修改：

- `apps/api/src/modules/work-execution/application/get-node-task.service.ts` 及其新增/对应单元测试；
- `apps/api/src/modules/lifecycle-control/application/set-node-applicability.service.ts` 及其对应单元测试。

要求：

1. `GetNodeTaskService` 必须先要求非空租户，再把 `bundle.task.tenantId` 与当前租户比较；不匹配时与不存在一样
   返回 `null`，无论 `containerId` 是否为空。带柜任务仍保留现有父货柜租户断言。
2. `SetNodeApplicabilityService` 在处理幂等重放前必须取得当前货柜 flow；已存在决定只有在
   `existing.flowInstanceId === current.flow.id`，且现有 `nodeCode/applicability` 比较通过时，才可作为合法重放
   返回。异 flow 同键返回稳定 `IDEMPOTENCY_CONFLICT`，不得返回原 flow ID、版本或继续 pending 重放。本切片
   不把现有字段比较冒充完整请求哈希幂等；证据、原因等全载荷冲突检测另行设计。
3. 不改 Schema/迁移、Controller、能力码、Guard、公共错误 Schema、组织/地点范围或 ActionDefinition；不顺带
   处理 `AUTH-B2-03`～`AUTH-B2-10`。
4. 新测试至少覆盖：同租户无柜任务可读、跨租户无柜任务表现为不存在、空租户拒绝；同 flow 同键合法重放、
   异 flow 同键冲突且不调用 apply/replay。
5. Cursor 只运行两个 Application 测试、API lint/typecheck、`pnpm repo:check`、`pnpm format:check` 和
   `git diff --check`，以 `ready-for-review` 交回未提交差异；不重复完整 `validate`。

#### Cursor 修正切片 B2F1R：Repository 租户范围与 task.execute 漏审路径

基线使用 Codex 下发 `TASK` 中的 SHA。本切片接续并保留 B2F1 的节点适用性窄修复，只允许修改：

- `apps/api/src/modules/work-execution/domain/work-execution.repository.ts`；
- `apps/api/src/modules/work-execution/infrastructure/prisma-work-execution.repository.ts` 及其对应单元/集成测试；
- `apps/api/src/modules/work-execution/application/get-node-task.service.ts` 及其测试；
- `apps/api/src/modules/work-execution/application/claim-work-order.service.ts` 及其测试；
- `apps/api/src/modules/work-execution/application/complete-work-order.service.ts` 及其测试。

要求：

1. 面向用户的任务详情查询必须从 Repository 起以 `taskId + tenantId` 限定；不得先加载其他租户的任务、工单和
   outcome 后再在 Application 丢弃。跨租户与不存在继续同形返回。
2. `claim`、`complete` 的首次执行和幂等重放读取必须从 Repository 起限定租户；无论 NodeTask 是否有关联
   container，都不得仅因 `containerId=null` 跳过租户验证。跨租户请求不得调用
   `applyWorkOrderClaim`/`applyWorkOrderCompletion`，不得插入 committed/rejected ClientOperation，也不得回显对象事实。
3. Repository API 使用显式结构化输入表达租户范围并复用现有映射；不得新增按调用方分支的硬编码租户、角色或
   动作表。默认拒绝、租户隔离和跨租户不枚举是固定安全不变量，不做成可关闭参数。
4. 至少新增 Repository 真实 PostgreSQL 集成测试，证明相同 ID 在错误租户下不返回聚合；Application 正反测试
   覆盖同租户无柜可读/可执行、跨租户无柜表现为不存在、零业务写入，以及带柜路径保持现有父链断言。
5. 不处理 organization/location/assigned、ActionDefinition、角色能力参数化或 `AUTH-B2-03`～`AUTH-B2-10/12`；
   这些必须另立受控策略切片，不在本修复中散写条件分支。
6. Cursor 运行相关 Application/Repository 单元测试、目标 PostgreSQL 集成测试、API lint/typecheck、
   `pnpm repo:check`、`pnpm format:check` 和 `git diff --check`；不重复完整 `validate`。完成后按 AGENTS.md 返回
   `REVIEW` 首行和 `logix-handoff/v1`，保留未提交差异。

#### B2F1R 审查结果与独立 finding 处置

- [x] 任务详情、领取、完成及其幂等重放均从 Repository 起按 `tenantId` 限定；跨租户与不存在同形，且不进入业务写入或操作回执写入。
- [x] 同租户无柜路径、跨租户无柜路径、带柜父链和 Repository 真实 PostgreSQL 正反测试通过。
- [x] Codex 复跑 work-execution/lifecycle-control 定向单元测试 153 项、目标集成测试 11 项、API lint/typecheck、`repo:check`、`format:check` 和 `git diff --check`，均通过。

| 独立 finding           | 处置       | 理由与权威写回                                                                                                       |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `B2F1R-CONCURRENCY-01` | `accepted` | 不同幂等键并发完成可能基于同一旧快照重复更新或漏掉任务最终聚合；登记为 `AUTH-B2-13`，由 B2F1C 修复并补真实并发测试。 |
| `B2F1R-WRITE-SCOPE-02` | `accepted` | 当前未发现租户重归属入口，但租户边界不应只停在事务外预读；登记为 `AUTH-B2-14`，与同一写事务一并收口。                |

上述 finding 都是既有 task.execute 写链的确定性安全/一致性缺口，不要求枚举未来角色，也不引入运行时权限配置平台。

#### Cursor 修正切片 B2F1C：事务内租户限定与并发完成收口

基线使用 Codex 下发 `TASK` 中的 SHA。本切片接续 B2F1R，只允许修改：

- `apps/api/src/modules/work-execution/domain/work-execution.repository.ts`；
- `apps/api/src/modules/work-execution/infrastructure/prisma-work-execution.repository.ts` 及其对应单元/集成测试；
- `apps/api/src/modules/work-execution/application/claim-work-order.service.ts` 及其测试；
- `apps/api/src/modules/work-execution/application/complete-work-order.service.ts` 及其测试。

要求：

1. `applyWorkOrderClaim` 与 `applyWorkOrderCompletion` 的写入契约必须携带 `tenantId`。事务内更新工单时同时限定
   工单 ID、所属任务 ID 和任务租户；更新任务时同时限定任务 ID 与租户。任一关联或租户条件不命中，整笔事务
   回滚，不得写工单、任务、outcome 或 ClientOperation。
2. 完成工单必须以已读取的工单/任务版本或等价原子条件防止旧快照覆盖。发生并发冲突后，Application 必须有界
   重读并重新计算任务聚合；若仍冲突，返回稳定并发错误，不得无限重试或以最后写入覆盖。
3. 同一工单以不同幂等键并发完成时，只允许一次状态版本转换；另一请求可在重读后按既有 `already_done` 语义形成
   `applied=false` 回执。并发完成同一任务最后两张不同工单时，最终两工单均完成、任务为 completed，且 outcome
   只有一份，不得停留在旧聚合状态。
4. claim 已有状态条件更新保留；本切片只补事务内租户/父链限定与必要的冲突回滚，不改领取资格、分派政策或角色。
5. 增加 Repository 单元测试与真实 PostgreSQL 集成测试，至少反证错租户、错配 taskId、同工单并发完成和同任务
   最后两工单并发完成；测试必须验证业务事实与 ClientOperation 的最终数量/状态，不能只断言 HTTP 或异常文本。
6. 不改 Schema/迁移、Controller、能力码、Guard、公共错误 Schema、组织/地点/assigned 范围、ActionDefinition，
   也不处理 `AUTH-B2-03`～`AUTH-B2-10/12`。若现有结构无法满足原子写与并发反证，返回 `blocked` 由 Codex 重切。
7. Cursor 只运行相关 Application/Repository 单元测试、目标 PostgreSQL 集成测试、API lint/typecheck、
   `pnpm repo:check`、`pnpm format:check` 和 `git diff --check`；不重复完整 `validate`。完成后按 AGENTS.md 返回
   `REVIEW` 首行和 `logix-handoff/v1`，保留未提交差异。

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
- [x] C2B2 已审核通过并使路由访问分类审计清零
- [ ] Application 对象范围/二次守卫、GC-011 错误面和 Guard 默认拒绝仍未完成

### 已审核 C2B2. 4 条生产 HTTP 入口移除

- `POST /node-tasks` 按 `AUTH-D03` 移除，任务继续只能由生命周期模块经内部 Port 创建；
- `POST /workflows/outbox-publish-due/schedule` 按 `AUTH-D04` 移除，机器统一走现有 service-only 系统链；
- `POST /workflows/echo`、`GET /workflows/:id` 按 `AUTH-D02` 移除，保留 Worker 与自动化验通；
- 入口删除是行为变化，必须逐项核对模块绑定、调用方、测试和 OpenAPI，不得在 C2B1 顺带实施。
- 路由违规清零前不得切换 Guard 默认拒绝，也不得把审计脚本接入硬门禁。

Cursor 初始实现基线为 `cdd4df4`；工作树随后由 Codex 快进，最终审核基线为
`04332afecf4efbfc90a8785c9ad4500994e4e7db`。本切片只处理以下 4 条已批准入口及直接失去消费者的
transport DTO：

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

#### C2B2 Codex 审核结论

- [x] 删除 4 条目标 HTTP 入口；保留 `CREATE_NODE_TASK` Port/provider、service-only 系统 Schedule 和迁移期
      Worker 兼容实现，未发现超出 `AUTH-D02`～`AUTH-D04` 的生产行为改动
- [x] 5 个定向测试文件共 11 项通过；API lint、typecheck、`pnpm authz:routes`、`pnpm repo:check`、
      `pnpm format:check` 和 `git diff --check` 通过
- [x] `pnpm authz:routes` 退出 0，精确得到
      `total=130 public=1 service=5 capability=124 missing=0 conflict=0`
- [ ] 当前新增测试只证明 Nest Controller/Module 元数据与内部 Port 边界；尚未直接启动应用验证 4 条入口返回
      404/405，也未生成 Swagger 反证路径消失。该证据缺口不阻止 C2B2 提交或继续 D，但必须由阶段 E 在最终
      PR 候选上补齐
- [ ] API 全量 test/build、集成测试、E2E 和 `pnpm validate` 按执行节奏未在 C2B2 重复运行，由 D、E 集成后
      的最终 PR 候选统一承接

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

阶段 D 在 C2B2 提交后由 Cursor 执行；准确基线以 Codex 下发的 `TASK` SHA 为准。写入范围仅限
`AuthorizationGuard`、其单元/认证集成测试，以及实现 GC-011 所必需的 Guard 专用异常、HTTP 异常过滤器、
`IdentityModule` 注册点和对应测试。

- 普通用户端点没有任何访问元数据时，Guard 必须失败关闭；`@PublicEndpoint()` 与 `@ServiceEndpoint()`
  继续跳过用户 capability 校验，不改变 AuthenticationGuard 的身份边界。
- 缺访问元数据和缺 capability 对外都返回 `AUTHORIZATION_FORBIDDEN`，HTTP 403、category=`authorization`、
  retryable=`false`、details=`[]`，并包含非空 `traceId` 与 ISO 8601 `timestamp`；响应不得泄露 Controller、
  方法名、必需 capability、角色或内部异常栈。
- `traceId` 由服务端生成或从受信请求上下文透传；阶段 D 不接受客户端任意头作为可信 traceId，不建设分布式
  追踪平台。配置缺失可在受控服务端日志中记录，但日志不得改变对外信封。
- Guard 必须抛出可被精确识别的专用异常；GC-011 过滤器只捕获该异常并稳定映射
  `AUTHORIZATION_FORBIDDEN`。不得用捕获所有 `ForbiddenException` 或 `HttpException` 的方式误改现有
  `AUTHORIZATION_SCOPE_DENIED` 等语义，也不得借本切片猜测或批量重写全仓历史错误。其他错误继续按现状，
  完整公共错误码运行时治理另立任务。
- 补全 Guard 正反测试及认证集成测试：无元数据拒绝、缺能力拒绝、合法 capability 放行、public 放行、
  service-only 身份放行，并用 JSON Schema 或等价严格断言验证 403 信封。
- 禁止修改 Controller capability 分类、对象范围、Application/Domain、数据库、Web、GC-011 Schema、
  AuthenticationGuard 或 C2B2 删除范围；若必须越界，返回 `blocked` 由 Codex 重切。
- Cursor 只运行身份模块定向测试、API lint/typecheck、`pnpm authz:routes`、`pnpm repo:check`、
  `pnpm format:check` 和 `git diff --check`，以 `ready-for-review` 交回未提交差异；不重复完整 `validate`。

#### 阶段 D 审查结果

- [x] 无访问元数据和空 capability 声明均失败关闭；缺 capability 使用同一专用异常
- [x] GC-011 403 信封通过运行时集成测试和 `error-response.schema.json` 严格校验
- [x] public、service-only、合法 capability 和类级 capability 路径均有正向测试
- [x] 专用过滤器未捕获普通 `ForbiddenException`，未改写现有对象范围错误
- [x] 客户端提供的 `x-trace-id` 与 `traceparent` 不会成为响应中的可信 `traceId`
- [x] Codex 复跑阶段 D 定向门禁通过；完整 `validate` 按约定留到阶段 E 最终候选

### E. CI 硬门禁与调用方验证

- 路由违规清零后把 `authz:routes` 接入 `repo:check` 或稳定 `validate` 链路，禁止基线豁免表长期存在。
- C2B2、D、E 在同一任务集成分支串行完成；中间切片只运行定向检查，不单独建 PR。形成最终 PR 候选后，
  由 Codex 统一运行一次 API 单元、真实 PostgreSQL 集成、E2E 和完整 `pnpm validate`；检查开发身份、OIDC 用户、
  service-only、跨租户、缺能力和合法能力路径。
- 合并前复查 OpenAPI/错误响应、客户端受影响路径和回退方案；不得降低断言换取通过。

#### Cursor 切片 E1：静态硬门禁与已删除入口反证

准确基线以 Codex 下发的 `TASK` SHA 为准。本切片只允许修改：

- `scripts/check-repository.mjs` 及其测试；
- 为 4 条已删除入口补运行时与 Swagger 反证所必需的 API 测试文件；
- 若测试需要，可最小调整测试专用 fixture，不得修改生产 Controller、Guard、Application、Domain、数据库、
  Web 或公共契约。

实现与验收要求：

1. `pnpm repo:check` 必须直接执行现有 AST 路由访问审计；任一路由出现 missing、conflict、空/动态 capability、
   重复访问装饰器或其它既有 violation 时以非零状态失败。复用 `check-route-access-metadata.mjs` 的解析结果，
   不复制第二套扫描规则，不增加数量基线或豁免清单；`pnpm docs:check` 不运行该代码门禁。
2. 增加正反测试证明 `repo:check` 能接收零违规结果并拒绝至少一条审计 violation；测试不得依赖当前仓库
   “恰好 130 条路由”才能通过。
3. 使用真实 Nest HTTP 路由注册验证以下旧入口不可达，返回 404 或框架等价的 405，且不会命中保留入口：
   `POST /api/node-tasks`、`POST /api/workflows/outbox-publish-due/schedule`、`POST /api/workflows/echo`、
   `GET /api/workflows/:id`。
4. Swagger 反证不放进 Vitest：当前 esbuild 测试编译不生成 Nest Swagger 依赖的 `design:type` 元数据，强行
   自动化需要新增 SWC 依赖/测试配置或另一条构建门禁，而真实 HTTP 路由、生产模块注册元数据和 AST 门禁已覆盖
   入口是否存在这一安全事实。Codex 在最终候选完成 `tsc` build 后启动编译产物并读取 `/api/docs-json`，断言三个
   workflow 旧路径不存在，且 `/api/node-tasks` 只有 GET、没有 POST；该检查未通过前不得建立最终 PR。
5. 扫描 `apps/web/src`、worker、脚本和生产配置中的调用方。当前已知 Web 只调用保留的
   `GET /api/node-tasks`；若发现 4 条旧入口的真实消费者，不得静默删除或改写，返回 `blocked` 交 Codex 裁决。
6. 不修改阶段 D 的错误信封，不处理 B2 对象范围，不运行完整 `validate`。Cursor 只运行脚本单测、E1 API
   定向测试、受影响 lint/typecheck、`pnpm authz:routes`、`pnpm repo:check`、`pnpm docs:check`、
   `pnpm format:check` 和 `git diff --check`，以 `ready-for-review` 交回未提交差异。

E1 通过只证明静态门禁和已删除入口反证成立。Codex 已在最终候选统一执行 API 全量单元、真实 PostgreSQL
集成、Web E2E、build、完整 `pnpm validate`、编译产物 Swagger 与最终调用方兼容复核；独立安全复审仍须在
建立最终 PR 前完成。

#### E1 工具链裁决与审查结果

- [x] 采用方案 C：不为重复的 Swagger 路径反证新增 SWC 依赖或专用 Vitest 编译链
- [x] `repo:check` 直接复用 AST 审计结果；零违规通过，任一既有 violation 失败
- [x] 4 条旧入口在生产模块 Controller 注册面返回 404/405，且保留的 GET/系统 Schedule 路由仍可命中
- [x] 调用方扫描未发现旧入口消费者；Web 的 `/api/node-tasks` 调用为保留的 GET
- [x] Codex 复跑脚本测试 48 项、删除入口测试 7 项、`repo:check` 与 `docs:check` 均通过
- [x] Codex 启动 tsc 编译产物并读取 `/api/docs-json`：三个 workflow 旧路径缺失，`/api/node-tasks` 只有 GET；
      共读取 119 个 Swagger path，检查后精确关闭本次 API 进程
- [x] 最终候选完整 `pnpm validate` 通过，覆盖全仓 lint/typecheck/unit、真实 PostgreSQL integration、Web E2E
      和 API/Web/worker build；后续仅改 brief，不重复运行无关全量门禁
- [ ] 最终独立安全复审仍未完成

## 业务与数据协同映射

这是安全底层任务，不交付新岗位页面；直接消费者是所有 API、工作台控制面和 Web API Client。

| 使用场景          | 消费者需要看到什么            | 系统允许做什么                                        | 可靠保存与反馈                                 |
| ----------------- | ----------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| 用户读取队列/详情 | 稳定 403 或经裁剪数据         | 只有具备 read capability 且对象范围命中才返回         | 不存在/越权避免侧漏，错误带 traceId            |
| 用户执行业务动作  | 服务端投影动作及不可执行原因  | 路由 capability、对象范围和业务前置全部通过才调用用例 | 操作审计记录授权结果，业务写入仍由领域事务负责 |
| 服务调用内部端点  | 明确 service-only 分类        | 仅工作负载身份和既定 audience                         | 不模拟用户，不接受普通 Bearer 冒充             |
| 工作台呈现按钮    | `allowedActions` 只作体验投影 | 命令到达时重新执行完整授权                            | 前端伪造按钮不改变服务端决策                   |

## 总体验收

- [x] 所有 HTTP 路由恰有一种显式访问分类，静态门禁无豁免基线
- [x] 非 public/service 路由缺 capability 时默认拒绝
- [ ] 所有 capability 均来自批准后的单一目录，不存在代码/文档漂移
- [ ] 读写能力最小化；同控制器不同风险方法没有被宽泛 class-level 声明覆盖
- [ ] 缺能力、越范围、跨租户和对象不存在的错误符合 GC-011 且不泄露资源存在性
- [ ] Application 层对象范围和业务守卫未被 Controller 装饰器替代
- [ ] 前端伪造身份、能力或 allowedAction 不能改变服务端结果
- [x] API 单元、集成、E2E、安全专项和完整 `pnpm validate` 通过

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
| 2026-09-30 | coding | Cursor / Codex                | —      | C2B2 删除 4 条已批准入口并通过 Codex 代码审核与定向门禁；审计清零。运行时 404/405、Swagger 路径缺失和完整门禁转由阶段 E，任务仍为 `coding`                                             |
| 2026-09-30 | coding | Cursor / Codex                | —      | 阶段 D 默认拒绝与专用 GC-011 403 信封通过 Codex 审查及定向门禁；阶段 E、B2 对象范围、完整门禁与生产 Schedule 迁移仍未完成，任务保持 `coding`                                           |
| 2026-09-30 | coding | Cursor / Codex                | —      | E1 静态硬门禁、删除入口运行时反证和调用方扫描通过审查；Swagger 改由 Codex 在 tsc 编译产物上复核，不引入 SWC 测试链。完整门禁、独立复审、B2 与生产迁移仍未完成                          |
| 2026-09-30 | coding | Codex                         | —      | tsc 编译产物 Swagger 反证及最终候选完整 `pnpm validate` 通过；后续仅改 brief，不重跑全量。最终独立安全复审、B2 对象范围与生产 Schedule 迁移仍未完成                                    |
| 2026-10-01 | fix    | Cursor / Codex / 独立安全复审 | —      | B2F1R 关闭任务详情与 task.execute 无柜路径的租户读取漏洞；定向 153 项、真实 PG 11 项及门禁通过。独立复审新增并采纳并发与事务写范围 findings，开放 B2F1C 收口，不扩角色平台。           |
