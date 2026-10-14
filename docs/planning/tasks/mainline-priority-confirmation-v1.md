---
status: done
branch: docs/mainline-priority-confirmation
verification: "负责人 2026-10-14 明确定案已写回；5 文件 Prettier、定向 Markdown 链接 0 errors、git diff --check 通过。repo:check exit 1，既有 .superpowers/sdd 临时副本失效链接，未修饰为通过。实际演练准备已移除，无业务数据操作；未提交或推送。"
owner: main
writer: main
risk: low
dependsOn: []
writeScopes:
  - AGENTS.md
  - docs/planning/tasks/_template.md
  - docs/planning/tasks/mainline-priority-confirmation-v1.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
exclusiveLocks: []
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - docs/planning/tasks/full-chain-sample-v05-compiler-v1.md
  - docs/planning/tasks/full-chain-demo-backup-purge-dry-run-v1.md
  - docs/planning/tasks/full-chain-rehearsal-domain-adapter-v1.md
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
---

# 任务：负责人固定主线定案写回

## 目标与范围

只把 2026-10-14 负责人已定主线写回现有业务路线图，撤销上一会话误建的实际演练准备草稿，并保留当时 Codex 临时主代理授权的历史记录；该例外已随对应会话结束。唯一业务结论在 [14-roadmap-decisions.md](../../../doc/cross-border-supply-chain/14-roadmap-decisions.md)，本 brief 只记录执行与证据。

不改生产代码、UI、Schema、迁移、公共契约或已完成历史 brief，不操作数据库、对象存储和工作流，不读取或改写 `.tmp/`、`apps/api/.tmp/` 及 `市场与经营信号.md` 的既有 WIP。

## 负责人决策记录

| 决策         | 事实与选项                                                                                  | 负责人结论                                                                 | 权威落点                     |
| ------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------- |
| MAINLINE-D01 | 前轮给出回到业务交付 / 准备 demo 切换两个方向，推荐前者；负责人进一步明确全部顺序和排除范围 | 采用负责人本轮完整定案；不再征询相同事项                                   | 业务路线图“当前固定交付主线” |
| ROLE-D01     | 前轮给出 Codex 临时主代理 / 保持默认映射两个选项，推荐前者；负责人再次授权当时会话          | 当时 Codex 会话临时 main，例外随该会话结束；后续恢复默认 Claude 主代理映射 | 本 brief 历史记录            |

## 已核事实

- Brief 1、2、3 frontmatter 均为 `done`；保持原记录，不把 `actual rehearsal execution: not-run` 改写成已执行。
- UI 单元一 `universal-workbench-layout-standard-v1` 已为 `done`，记录 PR #167 合并；剩余四单元使用已批准标准设计 §11～14、§18.2～18.5。
- 本会话创建的 `full-chain-rehearsal-execution-preparation-v1.md` 和 `full-chain-package-rehearsal.md` 都尚未提交，本轮仅删除这两个自建草稿，不留活动演练准备 brief。
- 当前没有生产文件改动；本轮不宣称 UI 四单元或任何工作台完成。

## 验收

- [x] 现有路线图写明固定顺序与全部排除范围。
- [x] 旧样本设计指向最新定案，不能被读成当前演练或 Brief 4 授权。
- [x] 实际演练准备草稿与占位移除，不占 writer、locks 或当前优先级。
- [x] 角色例外与模板同步，历史署名保持原样。
- [x] 定向格式、链接和 diff 检查完成；仓库门禁若失败如实记录，不删除他人临时副本以取得通过。

## 后续单元

下一单元为“可恢复工作会话”，在其独立 brief 中核对正式服务端草稿消费者和动作即落账消费者，再围绕同一步骤建立五面映射、精确写域、UI 强制结构和风险门禁。本任务不预先建设无消费者的平台，不插入市场 deferred 单元或海运运营实现。

## 验证记录

2026-10-14，本轮五个文件的 `pnpm exec prettier --check` 通过；调用仓库现有 `findBrokenMarkdownLinks` 检查这五个文件，0 errors；`git diff --check` 通过。`pnpm repo:check` exit 1，输出 636 行，已显示的错误位于既有 `.superpowers/sdd/2026-10-13-full-chain-rehearsal-domain-adapter/` 临时副本中的失效链接；这是本次写回前已复现的失败，没有声称全仓门禁通过。不因该无关故障恢复实际演练或改变主线。

分支已改名为 `docs/mainline-priority-confirmation`。本任务只有定案写回，负责人已确认全部政策，定向验证完成后以 `done` 收口并释放锁；未执行 Git 提交、推送或 PR。本轮未变更产品行为，不执行无关单测、集成、E2E 或完整 validate。当时的角色例外由负责人明确授权并已随对应会话结束；后续恢复 `AGENTS.md` 默认 Claude 主代理映射。本轮不提出新业务或安全政策，纯定案写回不另开独立技术复审。
