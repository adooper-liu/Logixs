---
status: coding
branch: feat/authz-default-deny-v1
verification: |
  已核对全局 AuthenticationGuard / AuthorizationGuard、路由访问元数据、身份能力模型、
  GC-008/GC-011 与现有授权测试。当前仅后端认证默认拒绝已经实现；未声明 capability 的普通用户路由
  仍由 AuthorizationGuard 放行，且尚无全路由静态门禁。本任务尚未完成，不得宣称授权已默认拒绝。
---

# 任务：API 操作级授权默认拒绝 V1

> 这是当前唯一活动任务。Cursor 只执行本文明确开放的当前切片；寻源、NPI、共享控制面和单台 UI
> 继续暂停。原 `p5-02-oidc-authentication-baseline` 的 `done` 只证明后端认证基线，不证明每条路由
> 已完成操作级授权。

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

| 决策 ID    | 已知事实与未知                                                                                                                                | 选项、成本/收益/风险/可逆性                                                                                                                                                                                                                                                                                                                 | 推荐与理由                                                                                                                                                               | 负责人结论                                                                                                            | 权威落点 / 状态                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `AUTH-D01` | `container.operate` 已被角色矩阵、多个模块 manifest 和装箱/出运/清关/内陆控制器使用，但业务能力目录漏记；尚无证据证明现有粒度满足长期最小权限 | **A. V1 正式登记现有码**：改动小、快速消除漂移；代价是能力较宽，须继续依赖 action/object guard，可版本化再拆。**B. 立即按限界上下文拆分**：最小权限更强；需新增能力、角色/IdP 映射和全部消费者迁移，成本高且延迟默认拒绝。**C. 并入 `lifecycle.operate`**：代码改动较小；会把装箱、清关、内陆操作错误等同生命周期推进，语义失真且后续更难拆 | 推荐 A。它承认代码已有稳定意图并最快关闭默认放行；以对象范围和动作前置继续收紧，同时登记后续按审计证据拆分的退出条件。A 可通过新版本撤销或拆分，B/C 的大规模替换更难回退 | **选择 A**（2026-09-29）。正式登记现有码；当前不拆分、不并入 `lifecycle.operate`；不豁免现有 action/object guard 缺口 | `IDENTITY_ACCESS_MODEL_V1` §4～5 / `decided` |

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

## 当前执行切片 A：路由访问审计器

这是现在交给 Cursor 的唯一切片。**不得同时修改 Guard、Controller、能力目录或业务代码。**

### 产物

1. 新增 `scripts/check-route-access-metadata.mjs`，使用 TypeScript Compiler API 解析
   `apps/api/src/**/*.controller.ts`，不得使用正则猜测装饰器归属。
2. 新增 `scripts/check-route-access-metadata.test.mjs`，用内存或临时 fixture 覆盖：
   - 方法级 capability；
   - 类级 capability 继承；
   - 方法级元数据覆盖类级元数据，与 Nest `getAllAndOverride` 语义一致；
   - public、service、capability 三类合法路由；
   - 缺失分类、空 capability、冲突分类和动态不可解析参数；
   - 多个 HTTP 方法装饰器、路径数组和无关装饰器。
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
- `@RequireCapabilities()` 零参数、非字符串字面量或重复空白值均为违规。
- 本切片只验证 capability 形状和访问分类，不判断某能力是否适合某业务路由；业务映射由 Codex 完成。
- 测试不得靠扫描当前仓库“恰好有多少缺口”通过；分析器逻辑测试与当前仓库审计结果分开。

### 切片 A 验收

- [ ] AST 审计器可重复枚举全部 Nest HTTP 路由，不漏类级元数据
- [ ] 合法、缺失、冲突、空声明和动态声明均有正反向测试
- [ ] `pnpm authz:routes` 对当前仓库给出稳定统计和非零退出码
- [ ] 未修改 Guard、Controller、业务服务、能力目录、数据库或 Web
- [ ] `node --test scripts/check-route-access-metadata.test.mjs`、`pnpm repo:check`、
      `pnpm format:check` 通过

## 后续切片（未获 Codex 指令前不得开始）

### B. Codex 定权与能力目录纠偏

- Codex 根据 AST 清单逐路由映射现有批准 capability，区分 read/write、用户/service/public。
- `container.operate` 按 `AUTH-D01` 和正式能力目录映射；其他漂移仍须逐项裁决，不得由路由现状反向升格为权威能力。
- 形成最小审查表：路由、数据/业务影响、所需能力、对象范围、现有 Application 二次校验和缺口；
  `container.operate` 的 5 条现有命令链必须逐条标出尚缺的组织/地点范围和 `ActionDefinitionV1` 校验。

### C. 路由显式分类

- Cursor 只按 Codex 已批准映射给 Controller 增加元数据和针对性测试，不更改业务行为。
- 高敏写路由优先：证据、导入、费用标准、任务/节点、适用性、补偿与重放。
- 每批修改后运行路由审计；不得用 class-level 宽能力掩盖同一控制器内读写差异。

### D. Guard 默认拒绝和错误契约

- 缺失访问元数据时失败关闭并记录内部配置错误；对外返回 `AUTHORIZATION_FORBIDDEN`，不泄露内部类名。
- 缺能力同样返回 GC-011 稳定错误结构；保留 traceId，由统一异常面承接。
- 补全 Guard、认证集成和代表性 Controller 的正反向测试。

### E. CI 硬门禁与调用方验证

- 路由违规清零后把 `authz:routes` 接入 `repo:check` 或稳定 `validate` 链路，禁止基线豁免表长期存在。
- 运行 API 单元、真实 PostgreSQL 集成、E2E 和完整 `pnpm validate`；检查开发身份、OIDC 用户、
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

| 日期       | 阶段   | 负责   | commit | 说明                                                                       |
| ---------- | ------ | ------ | ------ | -------------------------------------------------------------------------- |
| 2026-09-29 | design | 负责人 | —      | `AUTH-D01` 选择 A：正式登记 `container.operate`，保留守卫并按审计证据再拆  |
| 2026-09-29 | coding | Codex  | —      | 核清认证与授权差异、默认允许根因、错误码和能力目录漂移；开放 Cursor 切片 A |
