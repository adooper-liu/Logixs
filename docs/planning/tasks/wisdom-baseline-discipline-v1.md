---
status: review
branch: docs/wisdom-baseline-v1
owner: main
writer: cursor
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/wisdom-baseline-discipline-v1.md
  - AGENTS.md
  - docs/planning/tasks/_template.md
  - doc/cross-border-supply-chain/INDEX.md
  - doc/cross-border-supply-chain/wisdom-baseline/**
  - .prettierignore
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
exclusiveLocks:
  - repository-governance
  - root-tooling
sharedIntegrationScopes:
  - AGENTS.md
  - docs/planning/tasks/_template.md
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
---

# 任务：智慧开启基线继承纪律

## 目标

把负责人此前逐台智慧开启的结论原文纳入仓库作为必读基线，并写入智慧开启与建 brief 纪律：后续智慧开启和工作台 brief
必须在已有结论之上批判求真，只能更准确、更完整，不得另起炉灶、AI 造假或漂移。

## 边界 / 不做

- 基线原文逐字导入，不修正、不删减、不格式化；基线不成为业务权威，不改变 `doc/`、ADR、契约或任何工作台的业务结论。
- 不追溯改写已完成的 brief；进行中的工作台 brief 在下次恢复 `coding` 前补“智慧开启基线”一节。
- 不改代码、Schema、API 或界面；检查器只增加基线原文的链接检查豁免。

## 负责人决策记录

| 决策 ID | 已知事实与未知                                                              | 选项、成本/收益/风险/可逆性                                                                                                                   | 推荐与理由                   | 负责人结论                                                                                                                                                                                                                                                     | 权威落点 / 状态                       |
| ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| WBL-001 | 负责人 2026-10-04 指示                                                      | —                                                                                                                                             | —                            | 原话：“D:\Logixs docs 这个文件夹的内容，是对每个工作台单独智慧开启的一些结论，后续智慧开启时，一定要在此文件夹已有内容上，批判求真，不要再重新创造了，不要AI造假，不要漂移，一定要在已有内容之上进行，只可以更好，更优，不要脱离，要写入智慧开启与建brief纪律” | `AGENTS.md` §1.2.1 第 13 条、§2；模板 |
| WBL-002 | 源文件夹在仓库外，26 个文件约 1.1MB；`全局.md` 指出部分“已定”项无负责人原话 | A 纳入仓库，标非权威（可追溯、所有代理可读；原文错误一并入库）/ B 留在仓库外写绝对路径（无版本、CI 与其他机器读不到）/ C 先引用外部路径后纳入 | A：防漂移需要版本历史        | A                                                                                                                                                                                                                                                              | 本 brief，已执行                      |
| WBL-003 | 规则文字约束后续全部会话                                                    | 走 PR + GPT-5.6 只读复审 / 只走 PR                                                                                                            | 走 PR + 复审：主代理写入规则 | 走 PR + GPT-5.6 只读复审                                                                                                                                                                                                                                       | 本 brief                              |

## 方案

1. 原样复制 26 个基线文件到 `doc/cross-border-supply-chain/wisdom-baseline/`，新增目录 `README.md` 说明地位、使用纪律与文件—工作台对应；`.prettierignore` 排除原文、保留 README。
2. `AGENTS.md` §1.2.1 新增第 13 条“基线继承”；§2 新增工作台 brief 必须登记基线处置。
3. `_template.md` 新增“智慧开启基线”一节，处置取值 `沿用` / `修正` / `补强` / `存疑` / `与权威冲突`。
4. `scripts/check-repository.mjs` 对基线原文豁免链接检查（原文含当时本机绝对路径链接），README 仍受检查；补测试。
5. `doc/cross-border-supply-chain/INDEX.md` 参考资料登记基线目录。

## 验收

- [x] 26 个原文与源文件除行尾外逐字一致（主代理复制后哈希比对 26/26 一致，Git 按 `eol=lf` 规范化行尾）
- [x] `node --test scripts/check-repository.test.mjs` 66/66；`pnpm docs:check`、`pnpm repo:check` 通过
- [x] `prettier --check doc docs scripts AGENTS.md` 通过；eslint 检查器两文件通过；`git diff --check` 通过
- [ ] 本机全仓 `pnpm format:check` 被既有 `apps/ai-service/.pytest_cache` 权限问题阻塞（EPERM），以 PR CI 为准
- [ ] GPT-5.6 fresh 只读复审
- [ ] PR CI 通过

## 进度

- 2026-10-04：负责人定案 WBL-001～003；主代理在主目录分支 `docs/wisdom-baseline-v1` 完成方案 1～5 与上述本地检查，进入复审。
- 2026-10-04：负责人要求把仓库内新建的 `业务工作台持续打磨受阻原因.md` 收进本 PR；原样收存，README 登记来源与对应关系；此前派出的复审未覆盖该提交，另派 fresh GPT-5.6 复审最新提交。
