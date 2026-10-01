---
status: review
branch: feat/web-oidc-session-v1
verification: |
  A/A-R1/B/C/C3-FIX 已完成并通过增量复审；C3-FIX fresh 只读 Claude 复审为 no-findings。
  当前工作树 Web 单元测试 143 文件、616 项通过，focused OIDC Playwright 5/5 通过，Web lint、typecheck、
  OIDC build、format:check、repo:check 与 git diff --check 通过。原 C3-SEC-001 组合在生成资产前返回
  BUILD_DEVELOPMENT_AUTH_REJECTED，未创建输出目录且未回显 tenant/operator/role；development serve 与正常
  OIDC build 保持可用。生产源码固定开发身份残留为 0；身份头和直接 fetch 仅存在于测试或权威 httpClient。
  等待 Claude 最终集成最新 main、重跑 security:audit 和 pnpm validate；真实 IdP 冒烟仍是 deployment/done gate。
owner: claude
writer: cursor
risk: high
dependsOn: []
writeScopes:
  - .env.example
  - apps/web/package.json
  - pnpm-lock.yaml
  - apps/web/src/auth/**
  - apps/web/src/api/**
  - apps/web/src/test/setup.ts
  - apps/web/src/composables/useProductNpiWorkbench.ts
  - apps/web/src/composables/useStuffingWorkbench.ts
  - apps/web/src/composables/useLiveWorkspace.test.ts
  - apps/web/src/components/product-npi/ProductNpiClaimAction.vue
  - apps/web/src/data/stuffingWorkbench.ts
  - apps/web/src/data/stuffingWorkbench.test.ts
  - apps/web/src/views/ProductNpiWorkbench.vue
  - apps/web/src/views/ProductNpiWorkbench.test.ts
  - apps/web/src/views/RealTaskWorkbench.vue
  - apps/web/src/views/RealTaskWorkbench.test.ts
  - apps/web/src/views/StuffingWorkbench.test.ts
  - apps/web/src/views/CargoReadyWorkbench.test.ts
  - apps/web/src/router/index.ts
  - apps/web/src/main.ts
  - apps/web/src/env.d.ts
  - apps/web/src/components/shell/AppTopbar.vue
  - apps/web/src/components/shell/AppTopbar.test.ts
  - apps/web/src/components/shell/AppShell.test.ts
  - apps/web/src/composables/useAppShell.ts
  - apps/web/src/themes/logix/LogixAppShell.vue
  - apps/web/src/themes/logix/LogixAppShell.test.ts
  - apps/web/src/e2eDevServer.ts
  - apps/web/src/e2eDevServerContract.test.ts
  - apps/web/playwright.config.ts
  - apps/web/vite.config.ts
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
| 状态     | `accepted`；A-R1 于 `878191425c6c4c2cfa752af46d186d3bba9ce9c6` 工作树完成增量复审                                                                                     |
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

A-R1 已接受以下安全收口，不在 B 重复设计或重审：共享 Client 在读取身份前限制到同源 `/api/`，拒绝重定向；
Vite 在构建/启动前拒绝名称含 `SECRET` 的 `VITE_` 配置；浏览器只逐项读取白名单环境变量；会话初始化失败可重试；
开发身份不再有仓库内置默认值。93 项定向测试、Web lint/typecheck/build、假 secret 失败构建、仓库/格式/差异门禁
已由 Codex 复核通过。现有 E2E 启动器尚未注入显式测试身份，由 C 负责，不回退固定生产身份。

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

| 项目     | 内容                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 执行基线 | `878191425c6c4c2cfa752af46d186d3bba9ce9c6` + 同工作树内已接受但未提交的 A/A-R1 差异                                                         |
| 执行角色 | Cursor；B1/B2 连续实现后只交审一次，不拆 PR、不在中途重复全量门禁                                                                           |
| 状态     | `accepted`；Codex 已复核共享 Client、代表调用语义、actor 投影、全量 Web 601 项测试及构建/静态门禁                                           |
| 当前清单 | 生产源码 26 个文件直接引用 `developmentIdentity`；24 个 API 文件直接 `fetch` 且手写身份头；17 个文件仍出现固定 `DEV_OPERATOR_ID`            |
| 写入范围 | `src/api/**`、`src/auth/**`、`src/test/setup.ts`，以及 frontmatter 已列出的 NPI/装箱/任务当前操作者消费者与紧邻测试                         |
| 禁止范围 | 页面布局与文案、业务 DTO/状态规则、后端、公共契约、数据库、角色/能力政策、AppShell 用户出口与 E2E 启动器                                    |
| 验证     | 全量 Web 单元测试一次；Web lint/typecheck/build；身份/`fetch` 零残留扫描；`repo:check`、`format:check`、`git diff --check`                  |
| 停止条件 | 完成后返回一次 `ready-for-review`；若某调用依赖流式响应、跨源 API、服务端重定向或无法保持既有错误/返回语义则 `blocked`，不得临场绕过 Client |

#### B1. 请求迁移

1. 在 `httpClient.ts` 内增加一个共享的底层请求入口（可命名为 `requestApi`）：复用 A 已接受的 URL/header
   失败关闭、会话取证、OIDC/development 身份注入、`redirect: "error"`、网络错误和 401 单次恢复；对非 401 响应返回
   原始 `Response`，让调用方保留既有 404/null、blob、FormData、自定义错误与响应解析语义。
2. `requestJson` 必须建立在该底层入口上，不能保留第二套身份注入或 fetch；普通 JSON 调用优先使用 `requestJson`，上传、
   下载或需要自定义状态处理的调用使用底层入口。共享入口是控制面，不把各领域错误合并成巨型通用 DTO。
3. 迁移 24 个 API 文件的直接 `fetch`。逐函数保持 URL、method、query、body、Content-Type、幂等头、返回类型、404/null
   分支、下载行为和面向用户的既有错误文案；除统一 401 会话恢复外，不借迁移改变业务行为。
4. 生产调用点不得再声明 `X-Tenant-Id`、`X-Operator-Id`、`X-Roles`、固定 operator 或固定 role。development 身份只来自
   `VITE_DEV_*` 会话配置；OIDC 身份只来自 Token。不同角色由配置切换，测试角色由测试会话替身承载，禁止生产代码按端点
   冒充 `dev-reviewer`、`import_operator` 等另一身份。
5. `DevConsole.vue` 对 `/ai`、`/temporal` 的非认证健康探测不属于 `/api` Client，保持不动；除此之外，生产 `src/api/**`
   只允许 `httpClient.ts` 直接调用 `fetch`。

#### B2. 当前操作者投影与旧开发身份删除

1. 依据 `IDENTITY_ACCESS_MODEL_V1`，UI 当前 actor 统一取会话 profile 的稳定 subject：development 为显式
   `VITE_DEV_OPERATOR_ID`，OIDC 为已验证 Token 的 `sub`。可在 `useAuthSession` 增加只读 `actorId` 派生值；不得把 Token、
   角色或 SDK 对象放入 Vue 响应式状态。
2. NPI 的“我负责的”、装箱队列 `isMine`、任务工单受让人判断改用该 actor。actor 缺失时必须失败关闭：不把任何记录判为
   “我的”，不开放本人专属动作，也不以空串、固定 ID 或演示角色代替。
3. 删除 `api/developmentIdentity.ts` 及 `nodeTasks.ts` 导出的固定 `DEV_OPERATOR_ID`；更新紧邻测试和 test-only fixture。
   测试 fixture 必须明确只在 Vitest 生效，不得成为生产默认身份。
4. 交审前提供以下扫描的实际输出，计数均须为 0；测试文件中的断言/fixture 与 `httpClient.ts` 的权威身份头实现除外：

   ```text
   rg -n '\b(DEV_OPERATOR_ID|DEV_TENANT_ID)\b|developmentIdentity' apps/web/src -g '*.ts' -g '*.vue' -g '!*.test.ts'
   rg -n 'X-Tenant-Id|X-Operator-Id|X-Roles' apps/web/src -g '*.ts' -g '*.vue' -g '!*.test.ts' -g '!httpClient.ts'
   rg -n 'fetch\(' apps/web/src/api -g '*.ts' -g '!*.test.ts' -g '!httpClient.ts'
   ```

本切片不触发独立安全复审：它沿用 A 已定安全政策做机械推广。若实现需要改变允许的 API origin、身份来源、Token
存储、角色语义或公开路由，立即停止并由 Codex 重切；最终独立安全复审只在 C 集成候选进行一次。

B 复审接受两项受控偏差：无请求体 GET 不再发送无意义的 `Content-Type`；NPI claim 展示和装箱队列纯函数为移除固定
actor 做了最小范围扩展，相关文件已补入 frontmatter。两项均未改变服务端权限、业务 DTO 或状态规则。

### C. 用户出口、关键 E2E 与收口

| 项目     | 内容                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 执行基线 | `878191425c6c4c2cfa752af46d186d3bba9ce9c6` + 同工作树内已接受的 A/A-R1/B 未提交差异                                                                           |
| 执行角色 | Cursor；实现和定向验证完成后只交审一次                                                                                                                        |
| 状态     | `accepted`；C 实现通过增量复审，`C3-SEC-001` 修复经 fresh 只读 Claude 复审为 `no-findings`，转入 Claude 最终集成；真实 IdP 仍是 deployment/done gate          |
| 写入范围 | `src/auth/**`、`components/shell/AppTopbar.vue` 及直接测试、`themes/logix/LogixAppShell.vue` 及直接测试、`e2e/**`、必要的 Playwright/Vite 测试配置与本 brief  |
| 禁止范围 | API/数据库/公共契约、角色与 capability 政策、演示导航规则、业务工作台逻辑、真实 IdP 或其他外部系统配置、生产内置测试身份                                      |
| 定向验证 | auth/AppShell 单元测试；新增认证 E2E；Web lint、typecheck、build；`repo:check`、`format:check`、`git diff --check`                                            |
| 最终门禁 | Cursor 不跑 `validate` 或全仓安全审计；Codex 收到 C 交审后统一运行一次 `pnpm validate`、`pnpm security:audit` 并发起一次 Claude 独立安全复审                  |
| 停止条件 | 测试替身需要进入生产 bundle、需要真实 IdP 凭据、需要改变 Token 存储/API origin/角色语义，或现有会话端口无法证明关键路径时返回 `blocked`，不得临场扩大安全边界 |

#### C1. AppShell 身份出口

组件边界保持现有单向数据流：`LogixAppShell` 读取 `useAuthSession` 的只读 `mode/status/profile` 并调用 `signOut`；
`AppTopbar` 只接收脱敏身份 props、发出 `signOut` 事件，不导入 session、SDK 或 Token。

1. 在现有用户区同时区分“登录身份”和“当前演示角色”。身份优先显示 `displayName`，否则显示稳定 subject；不得把演示角色
   文案伪装成 IdP 角色、能力或权限结论。
2. OIDC 已认证时提供带 `LogOut` 图标和可访问名称的注销按钮；点击只调用会话 `signOut()`，禁用重复提交并呈现失败状态。
   development 模式明确标示“本机开发身份”，不伪造 IdP 注销；可不显示注销按钮。
3. 不把 Token、roles、OIDC SDK 对象或完整 profile 放进 AppShell 自有状态；只使用 `useAuthSession` 已有的脱敏只读投影。
4. 单元测试按用户可见行为断言身份摘要、development 标识、注销调用和失败反馈，不访问组件私有状态。

#### C2. 可控认证 E2E

1. `global-setup.ts` 启动 development Web 时必须显式注入 `VITE_AUTH_MODE=development` 及测试 tenant/operator/roles；值只存在
   于 Playwright 启动配置，不进入生产源码默认值。保留“已存在非本测试配置的开发服务器则不得静默复用”的失败关闭检查。
2. 增加 OIDC 浏览器替身，仅在 Playwright 测试启动时启用，通过真实浏览器导航和现有 auth/session 边界模拟 IdP 协议结果；
   不改生产协议实现，不提交 secret，不把 access token 输出到日志、URL、截图或断言文本。
3. 关键路径至少覆盖：未登录访问受保护页会启动登录；callback 恢复原站内路径且拒绝外部 returnUrl；已登录调用市场信号
   参考 GET 与一个写动作时只带 Bearer；401 只恢复一次且无重定向环；403 不重新登录；注销清除会话并进入已注销状态。
4. E2E 优先按角色、可见文本和稳定 `data-testid` 定位；等待导航/请求/可见状态，不使用任意 sleep。现有业务 E2E 继续以
   显式 development 身份运行，不因认证测试替身改变其角色或业务数据。

#### C3. 最终收口

Cursor 只返回 C 的定向检查。Codex 接受 C 后直接形成集成候选，运行一次完整门禁与依赖审计，再请求 Claude 对会话、
API 身份材料、重定向、注销、测试替身隔离和构建产物做一次最终只读安全复审；没有新增风险面时不再重复上述门禁。

#### C3-FIX. 独立安全复审阻断收口

`logix-disposition/v1`：

| Finding         | 处置       | 理由与权威写回                                                                                                                                                                                    |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C3-SEC-001`    | `accepted` | `vite build` 的安全边界不能依赖 `NODE_ENV` 或 `import.meta.env.DEV`；本节将 Vite `command === "build"` 时拒绝 development auth 定为必须修复的生产构建不变量。                                     |
| `C3-VERIFY-001` | `accepted` | 旧基线的依赖审计为红，不能宣称 C3 通过；但告警不来自 OIDC 依赖，且 PR #115 已在 `main` 合入精确 overrides。本切片不重复发明依赖政策，待安全修复验收后同步最新 `main` 并以新鲜审计结果关闭或重切。 |

| 项目     | 内容                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 执行基线 | `878191425c6c4c2cfa752af46d186d3bba9ce9c6` + 同工作树内已接受的 A/A-R1/B/C 未提交差异                                                                                                               |
| 执行角色 | Cursor；只实现 `C3-SEC-001` 并先把本节 disposition 保留在 brief，完成后交回 Codex 一次                                                                                                              |
| 写入范围 | `apps/web/vite.config.ts`、证明构建边界的最小测试文件、`docs/planning/tasks/web-oidc-session-v1.md`                                                                                                 |
| 禁止范围 | 会话/Client/业务消费者、API、数据库、公共契约、OIDC 协议政策、依赖升级或 overrides、真实 IdP 配置                                                                                                   |
| 定向验证 | 构建边界回归测试；带显式 development 身份且 `NODE_ENV=development` 的标准 Web build 必须在产物生成前预期失败；正常 OIDC build、Web lint/typecheck、`repo:check`、`format:check`、`git diff --check` |
| 后续集成 | Codex 接受修复后形成任务提交，同步最新 `origin/main`，保留 PR #115 的 overrides，再运行一次 `pnpm security:audit`；结果为绿即关闭 `C3-VERIFY-001`，仍为红才按剩余 advisory 重切                     |
| 停止条件 | 修复需要改变 Token 存储、API origin、角色语义、development serve 行为或引入新依赖时返回 `blocked`                                                                                                   |

实现要求：

1. Vite 配置必须直接使用配置钩子的 `command` 判断构建边界；只要 `command === "build"` 且显式选择
   `VITE_AUTH_MODE=development`，就在生成任何资产前失败。该判断不得依赖 `NODE_ENV`、mode 名称或浏览器运行时分支。
2. 本机 `vite serve` 的显式 development 身份继续可用；OIDC build 行为、secret 拒绝和显式环境白名单保持不变。
3. 回归证据必须覆盖独立评审的原失败组合：`NODE_ENV=development`、`VITE_AUTH_MODE=development` 及完整测试
   tenant/operator/roles。失败信息不得输出身份值。
4. Cursor 不同步 `main`、不改根依赖、不运行全仓 `validate` 或安全审计；这些只在 Codex 接受修复并形成集成候选后执行一次。

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

| 日期       | 阶段   | 负责   | commit | 说明                                                                                                          |
| ---------- | ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | coding | Codex  | —      | PR #112 合并后建立 Web OIDC/PKCE 任务；冻结首切片为会话边界、共享 API Client 和市场信号真实读写参考路径。     |
| 2026-10-01 | review | Codex  | —      | A/A-R1 通过增量复审；接受同源 API 边界、构建前 secret 门禁、初始化恢复和显式开发配置，转入 B 全量消费者迁移。 |
| 2026-10-01 | review | Codex  | —      | B 通过一次性复审：601 项 Web 测试及构建/静态门禁通过，固定身份和直接 fetch 残留为零；自动转入 C 最终收口。    |
| 2026-10-02 | review | Claude | —      | `C3-SEC-001` 构建边界修复经 fresh 只读 Claude 复审为 no-findings；接管最终 main 集成、审计、完整门禁和 PR。   |
