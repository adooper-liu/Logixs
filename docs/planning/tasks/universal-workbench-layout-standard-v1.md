---
status: design
branch: worktree-universal-workbench-ui-standard
owner: main
writer: codex
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
  - docs/product/UI_SYSTEM.md
  - apps/web/src/components/workbench/workbenchLayout.types.ts
  - apps/web/src/components/workbench/WorkbenchLayout.vue
  - apps/web/src/components/workbench/WorkbenchLayout.test.ts
  - apps/web/src/components/workbench/WorkbenchResponsibilityBand.vue
  - apps/web/src/components/workbench/WorkbenchResponsibilityBand.test.ts
  - apps/web/src/components/workbench/WorkbenchDecisionStrip.vue
  - apps/web/src/components/workbench/WorkbenchDecisionStrip.test.ts
  - apps/web/src/components/workbench/WorkbenchPane.vue
  - apps/web/src/components/workbench/WorkbenchPane.test.ts
  - apps/web/src/components/workbench/CollapsibleRail.vue
  - apps/web/src/components/workbench/CollapsibleRail.test.ts
  - apps/web/src/components/workbench/WorkbenchPageHeader.vue
  - apps/web/src/components/workbench/WorkbenchPageHeader.test.ts
  - apps/web/src/components/workbench/RoleWorkbenchFrame.vue
  - apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts
  - apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.vue
  - apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts
  - apps/web/src/reference/universal-workbench/UniversalWorkbenchLinkedFeatureReferenceView.vue
  - apps/web/src/reference/universal-workbench/referenceScenarios.ts
  - apps/web/src/modules/reference/routes.ts
  - apps/web/src/modules/registry.ts
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/src/views/MarketSignalsWorkbench.vue
  - apps/web/src/views/MarketSignalsWorkbench.test.ts
  - apps/web/e2e/support/universalWorkbenchReference.ts
  - apps/web/e2e/universal-workbench-reference.visual.spec.ts
  - apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots/**
  - apps/web/e2e/product-selection-workbench.spec.ts
  - apps/web/e2e/workbench-network.spec.ts
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
exclusiveLocks:
  - business-policy:universal-workbench-ui-standard
  - ui-pattern:workbench-layout-v1
  - visual-baseline:workbench-standard-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - doc/cross-border-supply-chain/wisdom-baseline/市场与经营信号.md
  - docs/product/UI_SYSTEM.md
  - docs/product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
uiStructure:
  - PageHeader 固定表达岗位类别、正式名称和唯一主要业务目的；本单元只提供切换与更多功能命名槽，不实现空入口
  - PageHeader 下依次为责任上下文、决策条、左队列 + 中详情 + 右动态上下文的满高办理区
  - 左栏选择对象，中栏选择具体缺口或事项，右栏承接当前事项动作、编辑、结果与恢复
  - 1440x900 三栏并列，1024x768 左窄轨且中右并列，390x844 按队列 → 详情 → 编辑分屏
uiMustStayVisible:
  - 正式工作台名称、主要业务目的、当前对象、当前/下一责任、期限或等待原因
  - 当前结论、消费者提供的真实进展、具体缺口、唯一主动作及不可执行原因
  - 失败、冲突、恢复、落账结果和责任去向
  - 关闭或只读对象的右侧上下文栏位和冻结结论
uiProgressiveDisclosure:
  - 术语定义、口径、图标含义和格式示例可进入 Toptip
  - 已完成事项可折叠下沉，但冻结结果、责任去向和恢复入口仍可达
  - 左右栏由用户显式折叠为满高窄轨，状态变化不得自动折叠
  - 参考页用合成 fixture 按需展示关键状态，且永久标明不是生产记录
uiForbidden:
  - 改变现有颜色系统、主题、字体或复制原型视觉皮肤和演示 CSS
  - 把对象状态提升为整页模式，或因状态删除栏位、改变栏宽和区域顺序
  - 在共享层硬编码 N/8、统一百分比、权限、责任、完成条件或状态映射
  - 实现工作会话持久化、任务档案、协作对话、AI 编排或具体更多功能子功能
  - 把参考页加入生产导航、工作台目录，或用截图全绿代替人工视觉判断
uiViewportEvidence:
  - 1440x900：头部以下三栏共同满高，左右栏可独立或同时折叠为满高窄轨，右栏编辑不推动页面，无横向溢出
  - 1024x768：左栏默认窄轨或抽屉，中栏与右侧动态编辑器并列，保持队列 → 事实/缺口 → 动作因果顺序
  - 390x844：队列、详情、编辑显式分屏，保留当前对象与事项面包屑，返回恢复滚动和焦点，底部动作不遮挡正文
---

# 任务：办理型工作台布局标准 V1

> 本 brief 只实现通用 UI 标准的单元一。设计权威为
> `docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md`。
> 可恢复工作会话、任务全程档案、任务内协作对话和 AI 辅助分别建立后续 brief。

## 路线图位置与核心结果

- **位置**：23 台岗位工作台的共同办理壳第一单元；先由选品立项和市场与经营信号两个真实消费者验真。
- **目标岗位**：在队列中连续选择对象、识别事实与缺口、执行当前允许动作的岗位人员。
- **核心业务结果**：用户在任何目标视口和任务状态下都能沿“定位 → 进展 → 缺口 → 事项 → 动作 → 回执”完成当前工作，页面身份、责任与三栏信息职责保持稳定。
- **优先减少的损失**：减少重复布局造成的视觉漂移；减少状态切换引起的位置丢失；减少中栏事项与右栏动作分离；减少实现者误把统一样式写成统一业务规则。
- **业务主线关系**：本单元只提供界面承接与两个参考消费者，不改变市场或选品的领域状态、权限、契约和完成语义。

## 当前事实与约束

1. 当前选品实现的真实完备度是五个业务区域 `N/5`；原型 `N/8` 不是领域契约。
2. 当前市场实现有自己的六项依据完备度 `N/6` 和验证状态；共享层不得复用选品分母。
3. `RoleWorkbenchFrame` 强绑定货柜、生命周期 rail 和 `hasContext` 删除栏位行为，只能改成兼容适配器，不能直接升级为万能壳。
4. 选品已有办理中与只读状态保持三栏的回归，可作为正面基线；其 1024 和移动端布局仍不符合本标准。
5. 市场关闭态当前会替换责任带、删除右栏并从三栏变两栏，是本单元必须消除的反例；关闭态的只读、禁止补录和关闭缺口摘要仍保留。
6. 当前 Playwright 已有 1440×900、1024×768、390×844 三项目，但没有活跃的 `toHaveScreenshot()` 视觉门禁；旧截图不能作为本单元证据。
7. PageHeader 当前只有通用 `actions` slot；本单元可增加命名展示 slot，但不显示尚未实现的切换或更多功能空按钮。

## 五面映射

| 面       | 本单元承接                                                               | 不越界                                           |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| 岗位任务 | 稳定队列、事实/缺口和动作三责；中栏选择事项，右栏办理                    | 不改变市场或选品优先级、去向和投资门政策         |
| 数据事实 | 原样消费消费者提供的结论、N/5、N/6、缺口、责任和回执                     | 不新增数据库、契约、API 或前端推断值             |
| 前端 UI  | 中性原语、满高三栏、双侧折叠、三视口、状态稳定和可执行视觉契约           | 不换主题、不建万能配置工作台                     |
| 技术底层 | 受控 props/slots/emits、DEV-only 参考路由、Vitest、Playwright 与静态防漂 | 不实现 RouteContext/WorkSession 持久化或业务写入 |
| 权限边界 | 只呈现页面已有服务端投影和动作；参考页无生产 API 请求                    | 不以按钮、slot、菜单或参考场景代替服务端授权     |

## 执行切片与代理交接

### 切片 `L1-governance-and-primitives`

| 项目        | 内容                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 基线        | `58d34d406eb916fa12983e390093db692bc265c7`                                                                                              |
| 执行角色    | 实现执行器：Codex / GPT-5.6                                                                                                             |
| 复审        | 主代理验收；中性组件契约和状态稳定性进入最终独立复审                                                                                    |
| 写入范围    | 本 brief、`UI_SYSTEM.md`、`workbenchLayout.types.ts`、`WorkbenchPane`、`WorkbenchResponsibilityBand`、`WorkbenchDecisionStrip` 及其测试 |
| 禁止范围    | 其他 Vue、数据库、API、契约、主题、单元二至五                                                                                           |
| UI 强制结构 | 引用 frontmatter 全部五项；组件不得拥有消费者业务判断                                                                                   |
| 验证命令    | 定向 Vitest、Web lint/typecheck、`pnpm repo:check`、目标格式检查                                                                        |
| 停止条件    | 失败测试转绿并交回；不得提交，状态 `ready-for-review`                                                                                   |

### 切片 `L2-layout-and-compatibility`

| 项目        | 内容                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ |
| 基线        | `L1` 主代理验收后的当前 SHA                                                                |
| 执行角色    | 实现执行器：Codex / GPT-5.6                                                                |
| 复审        | 主代理验收                                                                                 |
| 写入范围    | `WorkbenchLayout`、`CollapsibleRail`、`WorkbenchPageHeader`、`RoleWorkbenchFrame` 及其测试 |
| 禁止范围    | 两个消费者、参考页、E2E、主题、业务逻辑                                                    |
| UI 强制结构 | 三栏始终存在；折叠只由用户触发；PageHeader 入口未接通时不显示                              |
| 验证命令    | 定向 Vitest、现有 RoleWorkbenchFrame/WorkbenchPageHeader 测试、Web lint/typecheck          |
| 停止条件    | 共享布局与货柜兼容测试转绿并交回；不得提交                                                 |

### 切片 `L3-reference-and-visual-contract`

| 项目        | 内容                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| 基线        | `L2` 主代理验收后的当前 SHA                                                                                          |
| 执行角色    | 实现执行器：Codex / GPT-5.6                                                                                          |
| 复审        | 主代理逐张视觉核对；视觉门禁进入最终独立复审                                                                         |
| 写入范围    | DEV-only 参考页、reference routes、registry、Playwright 支持/视觉 spec/snapshots、Playwright 配置、repo check 与测试 |
| 禁止范围    | 生产导航、业务消费者、生产 API、旧孤儿截图批量清理                                                                   |
| UI 强制结构 | 覆盖默认、折叠、编辑、状态、入口和三视口；参考页只组合生产原语                                                       |
| 验证命令    | 参考页 Vitest；三项目 Playwright 结构与视觉测试；repo check；人工截图清单                                            |
| 停止条件    | 首次截图先交主代理核对，再生成基线；不得把 `--update-snapshots` 当作修复                                             |

### 切片 `L4-product-selection-consumer`

| 项目        | 内容                                                                 |
| ----------- | -------------------------------------------------------------------- |
| 基线        | `L3` 主代理验收后的当前 SHA                                          |
| 执行角色    | 实现执行器：Codex / GPT-5.6                                          |
| 复审        | 主代理验收                                                           |
| 写入范围    | `ProductSelectionWorkbench.vue/.test.ts`、选品 E2E 最小适配          |
| 禁止范围    | 选品 composable/API/领域组件/契约；不得把 N/5 改成 N/8               |
| UI 强制结构 | 保持现有领取、接受、四去向、退回和只读语义；只替换外层布局与动线承接 |
| 验证命令    | 选品定向 Vitest、三个视口 E2E、共享视觉门禁、Web lint/typecheck      |
| 停止条件    | 真实 N/5、缺口直达、状态往返和三视口证据交回；不得提交               |

### 切片 `L5-market-consumer-and-integration`

| 项目        | 内容                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| 基线        | `L4` 主代理验收后的当前 SHA                                                                           |
| 执行角色    | 实现执行器：Codex / GPT-5.6                                                                           |
| 复审        | Codex / GPT-5.6 新开只读会话独立复审；与写入会话分离                                                  |
| 写入范围    | `MarketSignalsWorkbench.vue/.test.ts`、`workbench-network.spec.ts` 最小适配、集成验证证据回写本 brief |
| 禁止范围    | 市场 composable/API/契约/业务政策；不得复用选品分母或改变关闭业务语义                                 |
| UI 强制结构 | archived/voided 保留责任带与右栏，只移除写控件；关闭与办理中网格一致                                  |
| 验证命令    | 市场定向 Vitest、三个视口 E2E、Web 全量门禁、repo/format、人工视觉复核                                |
| 停止条件    | `ready-for-review` 后停手；finding 由主代理裁决，完整门禁后进入最终 PR                                |

## 负责人决策继承

| 决策                 | 本单元执行方式                                               |
| -------------------- | ------------------------------------------------------------ |
| 不改颜色系统与主题   | 仅使用现有 tokens、PageHeader 门面和稳定主题入口             |
| 满高三栏与双侧折叠   | 由 `WorkbenchLayout` / `CollapsibleRail` 统一实现和验收      |
| 中栏选事项、右栏办理 | 原语提供结构；消费者保留领域编辑逻辑                         |
| PageHeader 业务目的  | 继续消费 generated purpose；状态不得覆盖                     |
| 干净界面和 Toptip    | 关键原因就地显示；参考 fixture 不写培训/免责墙               |
| 切换与更多功能       | 本单元只提供命名 slot 和参考形态；真实能力延期，不显示空入口 |
| 视觉防漂             | 线稿/参考页、版本化截图、结构断言、人工核对同批交付          |
| 五个交付单元         | 本 brief 只实现单元一                                        |

## 完成门槛

- 中性组件不含市场/选品/货柜业务码和硬编码分母；
- 参考页在生产构建中不可达、不进入导航、不发生产 API；
- 选品保持真实 `N/5`，市场保持真实 `N/6` 或自身验证状态；
- archived/voided/handed-off 与办理中往返时区域、栏数、栏宽和身份稳定；
- 1440/1024/390 的结构、折叠、焦点、滚动和无溢出验收通过；
- 版本化基准截图逐张通过人工核对；像素绿不替代业务视觉判断；
- Web lint、typecheck、test、test:e2e、build、format 和 `repo:check` 通过；
- 高风险面没有新增数据库/API/权限/公共业务契约变化；
- 独立复审 finding 全部由主代理处置。
