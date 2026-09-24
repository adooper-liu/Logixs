---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: fix/real-sample-only-seed
verification:
  - "2026-09-22 pnpm db:verify:real-replenishment 通过：旧库升级、空库迁移、标准 seed 两次幂等、dev-tenant 货柜为 0、真实样本 2 单/2 柜/15 SKU/15 产品行/1 装载版本/15 分配及 504 件对账。"
  - "2026-09-22 pnpm --filter @logix/web test -- src/api 通过：19 个文件、50 项 API 客户端测试；pnpm --filter @logix/web typecheck、lint、build 通过。"
  - "2026-09-22 pnpm validate 通过：仓库政策、契约校验/漂移、Prisma 生成、lint、格式、类型、全量测试（API 196 文件/934 项、Web 93 文件/278 项、Worker 5 项）、Playwright E2E（77 通过/7 条件跳过）与生产构建。"
  - "2026-09-22 本地 localhost:5433/logix/public 精确删除 3 条旧 dev-tenant 货柜；随后 pnpm db:seed、数据库回查和 GET /api/containers 实际确认仅返回 26DSC01811/HMMU4207629 与 26DSC01812/HMMU4956442。"
---

# 任务：标准 Seed 只写真实备货样本

## 目标

让标准 `pnpm db:seed` 只写入经真实文件验证的备货样本，不再创建早期 `dev-tenant` 三柜合成数据。重复执行仍须幂等，且真实样本数量和 504 件装载对账保持不变。前端开发身份同步指向真实样本租户，使货柜选择器和后续工作台请求读取同一套真实数据。

## 边界 / 不做

- 修改 `database/seed.ts`、真实备货专项验证、前端开发身份配置及其 API 客户端测试；不修改 schema、迁移、fixture 或公共 API。
- 不改变真实样本租户 `demo-real-sample-20260921`，不把单样本观察升级为通用业务规则。
- 不改变正式身份认证设计；这里只统一当前开发期身份头的租户来源。

## 验收

- [x] 空库执行 `pnpm db:seed` 后，`dev-tenant` 的货柜数为 0。
- [x] 真实租户保持 2 张备货单、2 个货柜、15 个 SKU、15 条产品行、1 个装载版本和 15 条分配。
- [x] 真实产品行与装载分配均汇总为 504 件。
- [x] 连续执行两次 seed 不产生重复数据。
- [x] 前端所有 API 客户端的开发租户统一为 `demo-real-sample-20260921`，货柜列表显示 `HMMU4207629 / 26DSC01811` 与 `HMMU4956442 / 26DSC01812`，不再显示旧三柜。
- [x] `pnpm db:verify:real-replenishment`、相关静态检查和风险对应门禁通过。

## 业务与数据协同设计

本任务是开发数据底座与开发身份配置维护，不改 UI 结构。直接消费者是本地开发、数据库专项验证和各工作台 API 客户端；标准 seed 的成功反馈必须报告真实租户及各实体数量，前端请求必须以同一真实租户读取这些数据，不能再以全库货柜总数或旧开发租户掩盖合成数据。

## 方案

1. 在真实备货专项验证中增加 `dev-tenant` 货柜为 0 的数据库断言，先复现旧行为。
2. 删除 `database/seed.ts` 中旧三柜常量和 upsert，只保留真实样本事务入口与明确数量日志。
3. 将前端开发期租户集中为单一配置，默认指向真实样本租户，并由 API 客户端测试约束请求头。
4. 清理本地库中旧三柜，运行数据库专项验证、前端测试、格式、仓库检查和最终差异检查；验证后将 brief 标记为 `done`。

## Review notes

- 旧三柜只在本次已授权的本地库中精确删除；代码不在每次 seed 时执行隐式数据删除。
- 前端开发身份租户集中在 `apps/web/src/api/developmentIdentity.ts`，所有 API 客户端复用；正式 OIDC 身份边界未改变。
- 内置浏览器运行时无可用浏览器实例，未取得手工页面截图；真实数据库、运行中 API、API 客户端测试和全量 Playwright 已覆盖数据链路。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                             |
| ---------- | ------ | ----- | ------ | ---------------------------------------------------------------- |
| 2026-09-22 | coding | Codex | —      | 冻结 `pnpm db:seed` 为唯一公共测试边界，开始 red → green。       |
| 2026-09-22 | coding | Codex | —      | 用户确认前端仍显示旧三柜，范围扩展为统一开发身份并读取真实样本。 |
| 2026-09-22 | done   | Codex | —      | 本地旧三柜清除，真实租户前后端贯通，专项与完整门禁通过。         |
