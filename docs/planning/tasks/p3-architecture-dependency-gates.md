---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: # git 初始化后填：feat/architecture-dependency-gates
verification: 本地验证（2026-09-12）：node --test scripts/check-repository.test.mjs 12 项通过；npx eslint scripts --max-warnings=0 通过；prettier --check 受影响脚本/任务 brief 通过；node scripts/check-repository.mjs 通过（含架构依赖方向扫描）。未执行：完整 pnpm validate（typecheck/e2e/build 与本次脚本门禁无关）。
---

# 任务：架构依赖方向门禁（P3-05 DEPCHECK）

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准；同一时刻仅一个进行中任务。

## 目标

把 [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) 已接受的禁止依赖写成 `repo:check` 可失败门禁，避免第一批业务代码绕开模块化单体边界。

## 权威入口

- [AGENTS.md](../../../AGENTS.md)、[ENGINEERING_RULES.md](../../../ENGINEERING_RULES.md) §3
- [ADR-010](../../architecture/decisions/ADR-010-bounded-context-modules.md)
- [MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md)

## 边界 / 不做

- 不新写一部业务开发规范，不复制 ENGINEERING_RULES 条文。
- 不引入 dependency-cruiser 等重复工具；检查落在现有 `scripts/check-repository.mjs` 链路。
- 不实现身份、状态机、导入业务或 CODEOWNERS / PR 模板（分属 P5 / P6 / P3-01 / P3-10）。

## 验收

- [x] 跨模块内部路径、Domain 引用框架/Prisma、Web 直连 API/数据库、packages 依赖 apps、AI 面写业务库、业务模块直连模型供应商、非 workflow/worker 引用 Temporal，均被拒绝。
- [x] 现有合法骨架（composition root、shipment-registry 分层、workflow Temporal、AI echo）继续通过。
- [x] 成功、拒绝、边界用例进入 `scripts/check-repository.test.mjs`。
- [x] `node --test scripts/check-repository.test.mjs` 与 `pnpm repo:check` 通过。

## 方案（design 阶段填写）

在 `scripts/check-architecture-boundaries.mjs` 解析 import/from/require，按导入方路径套用 MODULE_DEPENDENCIES §2–§3；由 `runRepositoryChecks` 扫描 apps/workers/packages 源文件。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先，每条对应文件/行号或 commit）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明                                                                                      |
| ---------- | ------ | ---- | ------ | ----------------------------------------------------------------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：补 P3-05 依赖方向门禁                                                               |
| 2026-09-12 | done   | —    | —      | 门禁接入 repo:check；12 项脚本测试与真实树扫描通过；Windows 盘符/尾斜杠路径归一化一并修复 |
