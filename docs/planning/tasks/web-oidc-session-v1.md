---
status: coding
branch: feat/web-oidc-session-v1
verification: not-run
owner: codex
writer: cursor
risk: high
dependsOn: []
writeScopes:
  - .env.example
  - apps/web/package.json
  - pnpm-lock.yaml
  - apps/web/src/auth/**
  - apps/web/src/api/**
  - apps/web/src/router/index.ts
  - apps/web/src/main.ts
  - apps/web/src/env.d.ts
  - apps/web/src/components/shell/AppTopbar.vue
  - apps/web/src/composables/useAppShell.ts
  - apps/web/src/themes/logix/LogixAppShell.vue
  - apps/web/e2e/**
  - docs/planning/tasks/web-oidc-session-v1.md
exclusiveLocks:
  - web-auth-session
  - web-api-client
sharedIntegrationScopes:
  - package.json
  - pnpm-lock.yaml
  - docs/INDEX.md
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/architecture/decisions/ADR-008-oidc-oauth.md
  - docs/architecture/SECURITY_THREAT_MODEL_V1.md
  - docs/product/domain/IDENTITY_ACCESS_MODEL_V1.md
  - docs/product/domain/ACTION_PERMISSION_CONTRACT_V1.md
  - docs/planning/tasks/p5-02-oidc-authentication-baseline.md
  - docs/planning/tasks/authz-default-deny-v1.md
---

# 任务：Web OIDC/PKCE 会话与统一 API Client V1

## 目标

让 Web 在正式环境通过 OIDC Authorization Code + PKCE 建立用户会话，并由一个共享 API Client 为请求注入
Bearer Token。开发身份头只允许在显式本机 development 模式出现，不能继续成为生产路径的隐式依赖。

本任务先用市场经营信号的真实读写链证明会话、路由和 API Client 边界，再机械迁移其余消费者；参考路径通过不等于
全部 Web 已进入生产认证链。

## 当前事实

- API 已按 `p5-02-oidc-authentication-baseline` 验证 issuer、audience、JWKS、`sub` 和租户声明；PR #112
  已把路由授权改为默认拒绝并接入静态门禁。
- Web 当前没有 OIDC/PKCE 客户端、登录回调或认证路由边界。`apps/web/src/api/developmentIdentity.ts` 保存固定身份，
  当前有 27 个 Web 源文件直接或间接依赖它。
- `marketSignals.ts` 同时覆盖 GET、POST、PATCH、证据登记和多个产品链动作，适合作为共享 Client 的首个真实读写消费者。
- 路由 `meta.roles` 与 `useDemoRole` 是演示导航投影，不是 IdP 角色、能力或服务端授权事实；本任务不得把两者静默等同。
- authz brief 仍因生产 Temporal 迁移证据和后续授权治理保持 `blocked`，但其默认拒绝代码与 CI 已合入 main；本任务
  不依赖那些延期政策，也不宣称完整授权闭环完成。

## 安全与兼容边界

### 不可关闭的安全不变量

1. 浏览器使用公共客户端 Authorization Code + PKCE；不得配置或提交 client secret，不使用 implicit flow。
2. 生产构建只允许 `oidc` 模式；缺少 authority、clientId、redirect URI 或包含 `openid` 的 scope 时启动失败，
   不回退 development。
3. OIDC 模式只发送 `Authorization: Bearer <access_token>`；无论调用方传什么选项，都不得发送
   `X-Tenant-Id`、`X-Operator-Id` 或 `X-Roles`。
4. development 模式只在 Vite `DEV` 环境允许，身份值来自类型化配置；不得在 API 文件中硬编码租户、人员或角色。
5. Token 不进入 Vue 响应式状态、日志、错误正文、URL、localStorage 或业务 Store。OIDC 协议状态和用户会话仅使用
   当前标签页 `sessionStorage`；对 UI 只暴露必要的脱敏 profile 和会话状态。
6. Router Guard 只保证已认证，不承担 capability、对象范围或业务状态判断；API 每次请求仍由服务端重新授权。
7. 401 只触发一次会话失效/重新登录流程，避免重定向环；403 是服务端授权拒绝，不得用重新登录掩盖。

### 可演进配置

首版使用 `oidc-client-ts`（或在实现前证明同等成熟且更适合现有 Vue/Vite 的库），配置全部经单一解析器读取：

| 配置                                                             | 规则                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| `VITE_AUTH_MODE`                                                 | `development \| oidc`；生产只接受 `oidc`              |
| `VITE_OIDC_AUTHORITY`                                            | 与已接受 IdP realm/issuer 对齐的 HTTPS authority      |
| `VITE_OIDC_CLIENT_ID`                                            | 浏览器公共 client ID，不是秘密                        |
| `VITE_OIDC_SCOPE`                                                | 空格分隔，必须包含 `openid`；API scope 由部署配置提供 |
| `VITE_OIDC_REDIRECT_URI`                                         | 登录回调绝对 URI，须在 IdP allowlist                  |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`                             | 注销回调绝对 URI，须在 IdP allowlist                  |
| `VITE_OIDC_SILENT_REDIRECT_URI`                                  | 可选；仅配置后启用 silent renew，不制造隐藏默认 URI   |
| `VITE_DEV_TENANT_ID` / `VITE_DEV_OPERATOR_ID` / `VITE_DEV_ROLES` | 只供显式本机 development 模式                         |

部署可更换等价 OIDC IdP；切换协议、采用 BFF Cookie 会话或把 Token 持久化到更宽存储必须新增 ADR，不在本任务临场改变。

## 边界 / 不做

- 不改 API Guard、能力目录、角色映射、对象范围、数据库或迁移。
- 不建设角色/权限管理 UI、账号密码登录、用户注册、账套主体切换或万能权限模块。
- 不把 IdP 角色直接当 `capabilityCode`，不根据前端路由角色决定服务端允许动作。
- 首切片不迁移其余 26 个消费者，也不删除 `developmentIdentity.ts`；只有全量调用方迁移并有扫描证据后才能删除。
- 不在 CI 连接真实企业 IdP；自动化使用可控测试替身，真实 Keycloak/等价 IdP 冒烟作为 deployment/done gate。
- 不因 OIDC 未部署而继续扩大单台工作台业务实现；本任务只建立 Web 生产认证链。

## 执行切片与代理交接

同一 brief 使用一个任务分支和最终 PR。Cursor 只跑每个切片的定向检查；Codex 在风险面集成完成后统一运行一次完整
门禁并安排一次最终独立安全复审，不对每个 API 文件重复审查。

### A. 会话边界、共享 Client 与市场信号参考路径

| 项目     | 内容                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | `2f5a45fe3d4644db8a804d615d2e36f6c702137e`                                                                                                                            |
| 执行角色 | Cursor                                                                                                                                                                |
| 写入范围 | `.env.example`、Web package/lock、`src/auth/**`、`src/api/httpClient.ts`、`src/api/marketSignals.ts` 及直接测试、`src/router/index.ts`、`src/main.ts`、`src/env.d.ts` |
| 禁止范围 | 其余 API 消费者、后端、数据库、公共契约、演示角色导航、AppShell 视觉、权限/账套配置                                                                                   |
| 验证命令 | auth/config/client/router/marketSignals 定向 Vitest；Web lint、typecheck、build；`pnpm security:audit`；`pnpm repo:check`、`pnpm format:check`、`git diff --check`    |
| 停止条件 | 完成后返回 `ready-for-review` 并保留未提交差异；若 IdP 要求 client secret、现有路由无法无环恢复 returnUrl，或成熟库与构建链冲突则返回 `blocked`                       |

实现要求：

1. 增加 `oidc-client-ts`，用独立配置解析器失败关闭；不在组件或 API 文件散读 `import.meta.env`。
2. 以小而明确的 auth service/composable 管理初始化、登录重定向、回调、登出和失效；外部 SDK 实例使用非深度响应式
   持有方式，对消费者只暴露 readonly 状态与显式动作。
3. Router 增加明确的 callback/logout callback 公开路径和全局认证边界；保存并校验站内 returnUrl，禁止开放重定向。
4. `httpClient` 统一构造身份头、JSON 请求和错误读取。OIDC 模式等待有效 Token；development 模式只注入配置身份；
   调用方不能覆盖 `Authorization` 或开发身份头。
5. `marketSignals.ts` 的全部请求改用共享 Client，不保留本地 `HEADERS` 或私有 fetch 包装；业务 DTO、URL、错误文案和
   成功语义保持不变。
6. 测试至少反证：生产 development 失败；OIDC 缺配置失败；PKCE 配置正确；回调路径不递归；returnUrl 只接受站内；
   OIDC 只发 Bearer；development 只发开发头；401 单次恢复、403 不重登；市场信号 GET/POST/PATCH 仍按原契约工作。

#### Vue / Client 责任图

| 边界                        | 单一职责                                                     | 对外契约                                                                             |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `auth/config.ts`            | 一次性解析并校验 Vite 认证配置                               | 只读判别联合 `development \| oidc`，非法配置抛稳定启动错误                           |
| `auth/session.ts`           | 持有 `oidc-client-ts` 实例并执行登录、回调、登出、Token 取得 | 不导出 SDK 实例或原始 Token 响应；测试可注入窄 Adapter                               |
| `auth/useAuthSession.ts`    | 把必要会话状态投影给 Vue                                     | readonly 状态 + 显式 `signIn/signOut`，派生值用 `computed`，副作用不放在 computed 中 |
| `auth/OidcCallbackView.vue` | 呈现回调处理中/失败状态并调用一次回调动作                    | 薄路由组件，无 API 业务逻辑、无 Token 展示                                           |
| `api/httpClient.ts`         | 为每个请求取得当前模式身份并统一错误读取                     | typed request options；调用方不能覆盖受保护身份头                                    |
| `router/index.ts`           | 标记协议公开路由并执行全局认证导航                           | 只校验会话与站内 returnUrl，不判断角色、能力或业务动作                               |
| `main.ts`                   | 组合 auth、router 与 Vue app 启动顺序                        | 只做 provider/初始化接线，不承载 SDK 或页面逻辑                                      |

首切片不需要新增全局 Store。SDK 实例是外部不透明对象，不进入深度响应式；页面通过 composable 读取最小状态，
子组件继续使用显式 props/events。若实现需要超过一个回调展示区，按 feature 目录拆分，不在路由入口形成大型组件。

### B. API 消费者机械迁移

- 在 A 的 Client 契约不变后，把剩余 API/业务 composable 对开发身份的直接依赖迁入共享 Client。
- 允许每个调用点提供仅 development 使用的测试角色/操作者覆盖，但 OIDC 模式必须忽略且绝不发送这些头。
- 更新紧邻测试，保持 URL、方法、body、错误文案和返回类型；禁止在迁移中改业务规则或页面布局。
- 以 `rg` 清单证明生产源码不再直接导入 `developmentIdentity.ts` 或手写身份头，再删除旧文件。

### C. 用户出口、关键 E2E 与收口

- 在现有 AppShell 用户区提供明确的登录身份摘要和注销动作；开发角色切换继续明确标为演示能力，不能伪装 IdP 权限。
- 使用可控 OIDC 测试替身覆盖：未登录进入受保护页、回调恢复原站内页、已登录读写参考 API、Token 失效、注销。
- 形成最终 PR 候选后，由 Codex 运行一次 `pnpm validate`、依赖审计和最终安全复审；风险面未再变化则不重复全量门禁。

## 直接消费者与技术承接

本任务是安全底层，不新增岗位业务规则或数据字段；它服务所有工作台的浏览器入口。

| 使用步骤   | 消费者需要看到什么                    | 系统允许动作                               | 可靠反馈                                   |
| ---------- | ------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| 进入工作台 | 登录中、已登录或登录失败的明确状态    | 未登录只可进入协议回调，不能看到受保护页面 | 成功恢复原站内路径；失败可重试且无重定向环 |
| 调用 API   | 页面只关心业务数据/错误，不接触 Token | Client 注入当前模式唯一允许的身份材料      | 401 失效会话；403 保留服务端拒绝和 traceId |
| Token 更新 | 页面不复制或缓存 Token                | SDK 按配置续期或重新登录                   | 续期失败回到可恢复登录，不静默降为开发身份 |
| 注销       | 当前身份和注销结果                    | 清理本标签页会话并走 IdP logout            | 回到批准的站内地址，旧 Token 不再使用      |

后续直接承接者是 `workbench-shared-control-plane-v1` 的 Web 消费端及 20 台工作台；在本任务完成前，它们可继续做
规格、样本和只读 Adapter 对拍，但不得宣称 Web 已进入生产认证链。

## 验收

- [ ] 生产 Web 只能以 OIDC Authorization Code + PKCE 启动，配置缺失失败关闭，无 client secret
- [ ] callback、logout callback、站内 returnUrl、过期和失败恢复无重定向环或开放重定向
- [ ] OIDC Token 仅存 sessionStorage/SDK 内部，不进入日志、URL、localStorage、Vue Store 或错误正文
- [ ] OIDC 请求只带 Bearer；development 请求只带显式开发身份；两种模式不可混用
- [ ] 市场信号真实读写参考路径先通过，随后所有生产 API 调用统一经过共享 Client
- [ ] 生产源码不再直接导入 `developmentIdentity.ts` 或手写开发身份头；测试 fixture 不冒充生产实现
- [ ] 401、403、网络失败和业务错误保持可区分，服务端 traceId 不被吞掉
- [ ] 路由守卫只负责认证，未把演示角色或前端按钮提升为服务端授权事实
- [ ] Web 单元、关键 E2E、lint、typecheck、build、依赖审计、`repo:check` 与最终 `pnpm validate` 通过
- [ ] 真实 Keycloak/等价 IdP 的 redirect URI、logout URI、scope/audience 和租户声明完成部署冒烟后才标 `done`

## 回滚

- 功能分支未完成前不合入半迁移状态；回滚以整个任务 PR 为单位。
- 正式环境不得回退 development 身份头。OIDC 故障时回滚到上一已验证版本或修复 IdP/配置，不得临时打开固定身份。
- development 模式只保留本机开发价值；它不是生产容灾方案。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                      |
| ---------- | ------ | ----- | ------ | --------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | coding | Codex | —      | PR #112 合并后建立 Web OIDC/PKCE 任务；冻结首切片为会话边界、共享 API Client 和市场信号真实读写参考路径。 |
