---
status: coding
branch: feat/workbench-network-density-v1
verification: pending
owner: main
writer: codex
risk: medium
dependsOn:
  - workbench-business-purpose-navigation-v1
writeScopes:
  - docs/planning/tasks/workbench-network-density-v1.md
  - docs/planning/tasks/full-chain-sample-v05-compiler-v1.md
  - apps/web/src/views/WorkbenchNetworkView.vue
  - apps/web/src/views/WorkbenchNetworkView.test.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - ui-navigation:workbench-directory-density
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - docs/product/UI_SYSTEM.md
  - docs/planning/tasks/workbench-business-purpose-navigation-v1.md
uiStructure:
  - 页头只保留正式名称和一句全链定位，随后是紧凑业务量与异常入口
  - 状态图例压成一行，详细免责声明进入可展开说明
  - 业务阶段分组和 23 台正式顺序保持不变
  - 每张卡只常驻序号、单一实现状态、正式名称和最多两行核心业务目的
uiMustStayVisible:
  - 工作台正式名称与正式业务目的
  - 每张卡唯一实现状态，且不冒充业务成熟度
  - 业务阶段分组、当前阶段标识和异常中心入口
  - 非零或非正常业务量；未知、无权、未接通不显示成 0
uiProgressiveDisclosure:
  - 技术状态的完整免责声明和 11/23 映射说明进入状态说明 details
  - 技术操作映射继续通过卡内 details 展开，不在首屏平铺
  - 交接名称退出目录首屏，进入工作台或既有详情查看
uiForbidden:
  - 删除、缩写或改写正式业务目的
  - 删除业务阶段分组、工作台、路由或深链
  - 把未知、未接通、无权或错误显示成 0
  - 在卡片同时重复实现状态、未接通文本和交接文案
  - 修改权限、API、工作台内部页面或正式目的投影
uiViewportEvidence:
  - 1440x900：首屏至少完整看到机会与立项、产品与主数据，并看到供应与采购分组起始；无横向溢出
  - 1024x768：顶部说明与图例不形成两条长文案墙；卡片目的不被裁切；无横向溢出
  - 390x844：单列卡片按名称 → 目的 → 必要状态阅读；不显示空指标与交接尾巴；无横向溢出
---

# 任务：业务工作台目录减法

## 目标

让业务工作台目录只回答“有哪些工作台、我应进入哪一个”。保留 23 台正式业务目的和业务顺序，减少顶部技术说明、卡片空指标、重复状态和交接文案造成的首屏文字墙。

## 边界 / 不做

- 不修改 `workbenchPurposes.generated.ts`、正式业务权威或任何工作台内部页。
- 不修改 API、权限、路由、稳定 code、成熟度或业务量契约。
- 不删除技术操作映射详情，只从首屏移入现有渐进披露。
- 不以截断正式目的换取密度；目的最多两行通过布局实现，窄屏允许自然换行。

## 已批准目录结构

```text
业务工作台
一句全链定位
[在办] [本周流转] [阻塞]                         [进入异常中心]
● 已接能力  ◇ 交互样板  ⚑ 框架待接通  [状态说明]

业务阶段
  序号                                  单一状态
  工作台名称
  正式业务目的（最多两行）
  仅当存在真实非零/异常业务量时显示紧凑指标
```

首屏删除：数字来源长说明、状态免责声明长段、卡片重复“未接通”、卡片下方交接尾巴。详细状态解释保留在 `details`；技术操作映射保留原 `details`。

## 执行切片 ND1

| 项目     | 内容                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| 基线     | `36bc07c7`                                                                      |
| 执行角色 | Codex（GPT-5.6）实现执行器                                                      |
| 写入范围 | frontmatter `writeScopes` 中三个 Web 文件；brief 只由主代理写                   |
| 测试先行 | 先修改单测/E2E，证明当前页面仍有长免责声明、空指标和交接尾巴；观察 RED 后改 Vue |
| 禁止范围 | 不改数据目录、生成器、API、路由、权限、目的文案或内部工作台                     |
| 停止条件 | ready-for-review 后返回 `HANDOFF`，不提交                                       |

### RED 验收反证

1. unit：目录不再渲染 `.stage-connector`；每卡恰好一个 `.stage-status`；loading/error/未接通时不显示 `.stage-volume`；真实 count 中仅非零或异常指标显示。
2. unit：长免责声明不再常驻在 `.network-legend > p`，但“状态说明” details 中仍包含业务闭环免责和 11/23 技术映射事实。
3. E2E：目录仍有 20 主链 + 3 支撑、正式目的和全部链接；桌面首屏密度达到 frontmatter 证据要求；三视口无横向溢出。
4. E2E：卡片不再出现“经营机会交接/产品设计发布”等交接尾巴；非零业务量仍可见，未知/未接通不伪造 0。

## 验证

```text
pnpm --filter @logix/web test -- src/views/WorkbenchNetworkView.test.ts
pnpm --filter @logix/web exec playwright test e2e/workbench-network.spec.ts --workers=1
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web lint
pnpm --filter @logix/web build
pnpm --filter @logix/web format:check
pnpm repo:check
git diff --check
```

## 验收

- [ ] 23 台与分组、正式目的、路由全部保留
- [ ] 顶部长技术说明改为一行图例 + 可展开状态说明
- [ ] 卡片只保留一个实现状态，不重复“未接通”
- [ ] 空/未知业务量不占卡片首屏；真实非零或异常量仍显示
- [ ] 交接文案不再出现在目录首屏
- [ ] 三视口截图和无横向溢出数据经主代理人工核对
- [ ] 定向单测/E2E、type/lint/build/format/repo/diff 通过

## 进度 log

| 日期       | 阶段   | 负责        | commit     | 说明                                                  |
| ---------- | ------ | ----------- | ---------- | ----------------------------------------------------- |
| 2026-10-10 | coding | Claude Code | `36bc07c7` | 负责人批准目录减法；建立独立支线，等待 Codex ND1 实现 |
