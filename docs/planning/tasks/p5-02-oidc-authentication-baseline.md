---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/p5-02-oidc-authorization
verification: 本地验证（2026-09-17）：身份专项 7 文件 / 35 项通过；API 全量 94 文件 / 451 项通过；pnpm validate 全绿（含 repo/contract/drift/db generate/lint/format/typecheck/test、Web E2E 50 通过 / 7 按既有条件跳过、生产构建）；git diff --check 通过；pnpm security:audit 高危门禁通过（high/critical 0，发现 3 个与 jose 无关的 moderate：Prisma 链路 ajv/mysql2、ExcelJS 链路 uuid）。
---

# 任务：P5-02 OIDC 认证与默认拒绝基线

## 目标

为 API 建立单一、默认拒绝的认证入口。开发模式继续允许显式开发身份头；OIDC 模式只接受经 issuer、audience 和 JWKS 验证的 Bearer Token，并从已验证声明建立用户身份与租户上下文。

## 边界 / 不做

- 权威来源：ADR-008、`IDENTITY_ACCESS_MODEL_V1`、GC-008、AGENTS §5 与 ENGINEERING_RULES §6。
- 本任务不实现角色到能力映射、对象范围谓词、委托、授权审计或前端登录；这些能力不能在只有认证根基时宣称完成。
- 本任务不替换服务身份协议；内部服务端点继续由现有独立服务身份中间件保护，P5-03 再迁移到工作负载 OIDC。
- 健康检查是本任务唯一显式公开路由；其他控制器默认需要用户或声明的服务身份。
- 不新增数据库表或迁移，不修改共享动作/权限契约。

## 验收

- [x] OIDC 模式拒绝缺失、畸形、签名无效、issuer/audience 不匹配或缺少 `sub` / tenant 声明的 Token。
- [x] OIDC 模式忽略可伪造的开发身份头；开发模式仍可运行现有本地与测试流程。
- [x] 非公开路由默认认证；健康检查显式公开；服务端点不能被普通用户 Token 冒充。
- [x] 控制器只读取统一用户身份，不再依赖名为 `devIdentity` 的请求字段。
- [x] 环境配置明确区分 `development` 与 `oidc`，生产环境禁止 development 模式。
- [x] 身份模块正向、拒绝和边界测试通过。
- [x] `pnpm validate` 通过。

## 方案

1. 定义统一的用户身份与路由元数据，增加全局认证 Guard。
2. 用成熟 JWT/JWKS 库实现 OIDC 验证器，并将供应商声明映射隔离在 identity 基础设施层。
3. 让开发身份中间件仅在 development 模式生效；OIDC 模式由 Guard 建立身份。
4. 将业务控制器迁移到统一请求身份；为健康检查和服务端点添加显式元数据。
5. 补环境示例、回归测试和任务验证证据。

## Review notes

- 已修复共享非生产环境默认落入 development 身份头的问题；现在仅 `NODE_ENV=development/test` 允许开发身份，其他环境默认 OIDC 并要求 HTTPS。
- 已修复 issuer 去尾斜杠导致 `iss` 精确匹配失真的问题；JWKS 默认地址仍从无尾斜杠的 issuer 基址推导。
- 已修复 public 与 service-only 元数据冲突时 public 优先放行的问题；冲突配置现在失败关闭。
- 未发现其余实现级阻塞；依赖审计无 high/critical，3 个既有 moderate 分别来自 Prisma 链路的 `ajv 8.17.1`、`mysql2 3.22.0` 与 ExcelJS 链路的 `uuid 8.3.2`，均不经过本次新增的 `jose 5.10.0`；2026-09-17 用户确认安全边界评审通过。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                          |
| ---------- | ------ | ----- | ------ | --------------------------------------------------------------------------------------------- |
| 2026-09-17 | coding | Codex | —      | 从合并后的 main 建分支，冻结 OIDC 认证第一刀实施边界。                                        |
| 2026-09-17 | review | Codex | —      | OIDC/JWKS、默认拒绝、统一身份与服务端点隔离实现完成；完整门禁通过，待安全边界评审。           |
| 2026-09-17 | fix    | Codex | —      | 修复共享环境开发身份回退、issuer 精确匹配及路由元数据冲突三项 review 问题；完整门禁复验通过。 |
| 2026-09-17 | done   | Codex | —      | 用户确认安全边界评审通过；任务验收、完整门禁与高危依赖审计均完成。                            |
