---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: main
verification: 本地（2026-09-12）：node --test scripts/check-repository.test.mjs 13 项通过；node scripts/check-repository.mjs 通过。远端：GitHub Ruleset protect-main id=23014320，enforcement=active，规则 deletion/non_fast_forward/pull_request/required_status_checks(quality)。https://github.com/adooper-liu/Logixs/rules/23014320
---

# 任务：P3-01 主分支保护与 CODEOWNERS

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准；同一时刻仅一个进行中任务。

## 目标

让 `main` 不能被直接强推或无检查合入，并用 CODEOWNERS 标明契约、迁移和规则文件的责任人，避免业务写入开始后无法回滚。

## 权威入口

- [ENGINEERING_RULES.md](../../../ENGINEERING_RULES.md) §9 / §10
- [PROJECT_BOOTSTRAP_CHECKLIST.md](../PROJECT_BOOTSTRAP_CHECKLIST.md) P3-01
- [ADR-001](../../architecture/decisions/ADR-001-modular-monolith.md)（依赖 lint + CODEOWNERS 防泥球）

## 边界 / 不做

- 不实现 P3-08 pre-commit、P3-10 PR 模板、P3-11 密钥扫描。
- 不要求第二人审批（当前单一负责人）；CODEOWNERS 用于指派，不设为合入硬阻挡。
- 不修改业务模块、契约 Schema 或数据库。
- 不强制修复当前 `main` 上已失败的 CI；保护规则仍要求此后合入必须过 `quality`。

## 验收

- [x] `.github/CODEOWNERS` 存在，覆盖契约、迁移、工程规则和 CI。
- [x] `main` 禁止强制推送与删除；合入必须经过 Pull Request。
- [x] 合入必须通过 GitHub Checks 中的 `quality`。
- [x] `pnpm repo:check` 通过；清单 P3-01 回填并附链接。

## 方案（design 阶段填写）

1. 新增 `.github/CODEOWNERS`，默认与敏感路径指向 `@adooper-liu`。
2. 用 GitHub Ruleset 保护 `refs/heads/main`：禁止删除/非快进、要求 PR、要求 `quality` 状态检查。
3. `repo:check` 校验 CODEOWNERS 文件存在。
4. 回填 `PROJECT_BOOTSTRAP_CHECKLIST` 与 `docs/INDEX.md`。

## Review notes（review 阶段填写，只读不改代码）

无缺陷。已知限制：当前 `main` 历史 CI 仍有失败；Ruleset 只约束此后合入。单一负责人可自合并 0 审批的 PR，但不能绕过 `quality` 或强推。

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明                                                                        |
| ---------- | ------ | ---- | ------ | --------------------------------------------------------------------------- |
| 2026-09-12 | coding | —    | —      | 开工：P3-01 主分支保护与 CODEOWNERS                                         |
| 2026-09-12 | done   | —    | —      | CODEOWNERS + repo:check 门禁落地；Ruleset protect-main (23014320) 已 active |
