---
status: fix
branch: fix/full-chain-landing-prisma-injection-v1
verification: "FCLPI1 GREEN: full-chain rehearsal integration 6/6 and full-chain landing unit 63/63; API lint/typecheck, board, repo, format and diff checks passed"
owner: main
writer: codex
risk: low
dependsOn: []
writeScopes:
  - docs/planning/tasks/full-chain-landing-prisma-injection-v1.md
  - docs/planning/progress-board.html
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts
  - apps/api/src/infrastructure/integration/full-chain-rehearsal-domain-adapter.integration.test.ts
exclusiveLocks:
  - integration-test:full-chain-rehearsal-domain-adapter
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
  - docs/planning/tasks/recoverable-work-sessions-v1.md
---

# 任务：Full-chain landing Prisma 显式注入修复 V1

## 目标

恢复 `PrismaFullChainLandingRepository` 的显式 `PrismaService` 注入，使 full-chain rehearsal 真实集成路径不再因 repository 的 `prisma` 为 `undefined` 而统一返回 HTTP 400，并解除 `recoverable-work-sessions-v1` 最终 `pnpm validate` 的范围外阻塞。

## 已证实根因

1. `apps/api/src/infrastructure/integration/full-chain-rehearsal-domain-adapter.integration.test.ts` 定向复现为 3/6 失败：正常 apply 返回 400、首写并发等待 180 秒超时、MinIO receipt 注入前返回 400。
2. 直接调用 `ApplyFullChainPackageService.execute()` 得到原始异常：`TypeError: Cannot read properties of undefined (reading 'fullChainLandingRun')`，锚定 `PrismaFullChainLandingRepository.findByPackage()`。
3. 包 fixture 校验独立通过；隔离 snapshot 独立通过，因此失败不在包契约、PostgreSQL/MinIO/Temporal 健康或所有权盘点。
4. `ccd1f2b1` 为第二构造参数增加 `@Optional()` 时，同时删除了第一参数的 `@Inject(PrismaService)`。该 repository 的更早版本、当前 WorkSession repository 和仓库多数 Prisma repository 都显式注入 `PrismaService`。
5. 当前失败在 WorkSession 候选提交之外稳定复现；不得修改 WorkSession 产品代码或用重跑掩盖。

## 切片 `FCLPI1-explicit-prisma-injection`

| 项目     | 内容                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线     | `2d84c5675b0a2859b87577d784771bdc5a1e81e3`                                                                                                                  |
| 执行角色 | Codex Code 实现执行器；HANDOFF 如实登记实际模型                                                                                                             |
| 写入范围 | 本 brief、派生进度板、`prisma-full-chain-landing.repository.ts`；只有测试先行确需新反证时才改现有 `full-chain-rehearsal-domain-adapter.integration.test.ts` |
| 禁止范围 | 不改 WorkSession、full-chain 业务规则、包契约、Schema、迁移、MinIO/Temporal 策略、超时、断言、fixture 或门禁配置；不读取/修改/暂存 `.tmp/`                  |
| TDD      | 先用现有定向集成测试保存失败反证；最小实现仅恢复第一参数 `@Inject(PrismaService)`，保留第二参数 `@Optional()` 与 test hook 行为                             |
| 验证命令 | 定向 full-chain rehearsal integration；full-chain landing 相关 unit；API lint/typecheck；`pnpm repo:check`、格式和 `git diff --check`                       |
| 停止条件 | 定向集成 6/6 通过且无范围外差异；不在本分支运行或声称 recoverable final validate 通过，最终完整门禁回到原验收分支执行                                       |

实现任务：

```text
TASK docs/planning/tasks/full-chain-landing-prisma-injection-v1.md#FCLPI1-explicit-prisma-injection base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/full-chain-landing-prisma-injection-v1.md#FCLPI1-explicit-prisma-injection base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=main workspace=D:\Logixs commit=<sha|none>
```

## 验收

- [x] 现有定向集成测试保存 3/6 失败反证，正常 apply 的原始异常明确为 repository Prisma 注入缺失
- [x] `PrismaService` 显式注入恢复，`testHooks` 继续可选且已有故障注入行为不变
- [x] full-chain rehearsal 集成 6/6 通过，包括正常 apply、并发 exactly-once 和 MinIO receipt 恢复
- [x] full-chain landing 相关单元测试、API lint/typecheck 通过
- [x] `pnpm repo:check`、目标格式与 `git diff --check` 通过
- [x] 实际差异无 WorkSession、业务规则、契约、Schema、迁移、fixture、超时或断言修改

## 进度 log

| 日期       | 阶段 | 负责              | commit   | 说明                                                                                       |
| ---------- | ---- | ----------------- | -------- | ------------------------------------------------------------------------------------------ |
| 2026-10-18 | fix  | Claude / Opus 4.8 | 2d84c567 | 从 recoverable fresh validate 稳定失败追到 repository 显式注入回归，建立独立低风险修复切片 |
| 2026-10-18 | fix  | Codex / GPT-5     | pending  | 恢复 PrismaService 显式注入；定向集成 6/6、相关单元测试 63/63、API lint/typecheck 通过     |
