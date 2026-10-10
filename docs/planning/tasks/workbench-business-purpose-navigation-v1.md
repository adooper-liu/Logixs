---
status: coding
branch: worktree-workbench-purpose-navigation
verification: "S1 0daf6087; S2 b5690ceb; S2 gates unit 83/83, requested serial E2E 27/27, related desktop E2E 36/36, type/lint/build/repo/drift/format pass; S3 pending"
owner: main
writer: codex
risk: medium
dependsOn: []
writeScopes:
  - docs/planning/tasks/workbench-business-purpose-navigation-v1.md
  - docs/product/UI_SYSTEM.md
  - docs/product/WORKSPACE_UI_INVENTORY.md
  - apps/web/src/router/index.ts
  - apps/web/src/components/shell/AppSidebar.vue
  - apps/web/src/components/shell/navigation.test.ts
  - apps/web/src/components/shell/AppShell.test.ts
  - apps/web/e2e/shell-layout.spec.ts
  - apps/web/e2e/workbench-purpose-navigation.spec.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:workbench-business-purpose-presentation
  - ui-navigation:workbench-entry-layer
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/市场与经营信号.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - doc/cross-border-supply-chain/wisdom-baseline/产品开发与NPI工作台.md
  - doc/cross-border-supply-chain/wisdom-baseline/商品与物料主数据.md
  - doc/cross-border-supply-chain/wisdom-baseline/寻源与供应商工作台.md
  - doc/cross-border-supply-chain/wisdom-baseline/需求与补货.md
  - doc/cross-border-supply-chain/wisdom-baseline/采购.md
  - doc/cross-border-supply-chain/wisdom-baseline/生产.md
  - doc/cross-border-supply-chain/wisdom-baseline/出运计划.md
  - doc/cross-border-supply-chain/wisdom-baseline/订舱.md
  - doc/cross-border-supply-chain/wisdom-baseline/备货.md
  - doc/cross-border-supply-chain/wisdom-baseline/装箱.md
  - doc/cross-border-supply-chain/wisdom-baseline/出口报关.md
  - doc/cross-border-supply-chain/wisdom-baseline/出运.md
  - doc/cross-border-supply-chain/wisdom-baseline/海运运营工作台.md
  - doc/cross-border-supply-chain/wisdom-baseline/清关.md
  - doc/cross-border-supply-chain/wisdom-baseline/提柜.md
  - doc/cross-border-supply-chain/wisdom-baseline/送仓.md
  - doc/cross-border-supply-chain/wisdom-baseline/卸柜.md
  - doc/cross-border-supply-chain/wisdom-baseline/还箱.md
  - doc/cross-border-supply-chain/wisdom-baseline/合规运营.md
  - doc/cross-border-supply-chain/wisdom-baseline/费用.md
  - doc/cross-border-supply-chain/wisdom-baseline/异常中心.md
  - docs/product/UI_SYSTEM.md
  - docs/product/WORKSPACE_UI_INVENTORY.md
  - docs/planning/tasks/end-to-end-workbench-network-foundation-v1.md
uiStructure:
  - 应用侧栏只承担入口层；工作台完整网络由“业务工作台”目录承载
  - 每台工作台首屏固定顺序为岗位类别、正式名称、核心业务目的，再进入责任、对象、事实缺口、动作和回执
  - 出运等含内部视图的工作台只显示一次整台身份与目的，内部视图降为局部导航或内容标题
uiMustStayVisible:
  - 当前工作台正式名称及由正式业务权威投影的一行核心业务目的
  - 当前责任、当前对象、卡点、允许动作、结果回执与恢复入口继续由各工作台既有固定办理壳承接
  - planned 工作台的成熟度和只读边界，不因目的文案完整而显示虚假队列或生产写动作
uiProgressiveDisclosure:
  - 详细业务边界、历史依据、审计记录和非当前对象信息可进入详情或目录页
  - 七个专业工作台保留路由和目录入口，不再作为一级侧栏常驻捷径
uiForbidden:
  - 直接读取 wisdom-baseline 作为生产运行时文案源
  - 在 Vue 页面、路由 meta、uiCopyCatalog 和工作台目录中分别维护业务目的副本
  - 用登记、上传、推进、关闭、证据数量或阶段变绿冒充工作台业务目的
  - 让对象状态、内部标签页或已完成结果替换整台工作台身份与目的
  - 把侧栏隐藏当作服务端授权，或删除专业工作台路由和深链
  - 继续显示硬编码“工作区 / 已出运”作为全链应用范围
uiViewportEvidence:
  - 1440x900：侧栏入口层简洁；工作台名称和业务目的首屏直接可读；三栏办理壳不被重排；无横向溢出
  - 1024x768：折叠侧栏不重复铺工作台；目的文案不遮挡当前责任、对象和主动作；无横向溢出
  - 390x844：移动抽屉只显示入口层；页面按名称 → 目的 → 当前上下文 → 内容顺序阅读；无页面级横向溢出
---

# 任务：工作台业务目的投影与导航收敛

> 本 brief 是本任务设计、实施、评审和交接的唯一载体，不另建并行规格或第二套工作台定位。
> `wisdom-baseline` 只提供必须继承和核对的非权威决策输入；生产界面只消费已经写入正式业务权威的工作台目的。

## 路线图位置与目标岗位

- **路线图位置**：横跨正式 23 台工作台的统一入口和页面身份层，不改变任何一台的领域状态机、业务动作或成熟度。
- **目标岗位**：进入任一工作台办理业务的操作人员，以及通过侧栏寻找正确工作入口的用户。
- **核心业务结果**：用户进入工作台后先理解“为什么做、最终形成什么业务结果”，再处理当前对象；侧栏只回答“去哪里”，不再平铺目录内的专业工作台。
- **优先减少的损失**：减少因为工作台定位被记录动作、状态文案或内部视图覆盖而造成的错误操作与跨台误解；减少重复一级入口造成的找路成本和错误范围感知。
- **业务主线关系**：本任务只修正业务目的的前端投影与入口层，不声称任一工作台因此达到 `operational`、`validated` 或 WB-B10。

## 已证实事实

1. `doc/cross-border-supply-chain/08-role-workbenches.md` 已列出 23 台正式名称、stable code 和“岗位要完成的结果”，足以生成页面一行目的文案。
2. `wisdom-baseline` 是必读但非权威输入；其中混有已写回结论、负责人已确认但尚未写回的细化、候选、存疑和已降级方案，不能直接成为生产文案源。
3. 前端当前至少有三套目的近似值：`workbenchNetwork.ts.roleResult`、各专用页面硬编码 `summary`、共享 `PlannedWorkbenchView`；多台已经漂移为“登记/记录/推进”等动作说明。
4. 现有 `PageHeader` 的 `summary` 已能承载一行目的，无需把业务权威逻辑放进主题层。
5. 七个专业工作台同时存在于“业务工作台”目录和一级侧栏；侧栏还硬编码“工作区 / 已出运”，与市场至还箱的 23 台全链范围冲突。
6. 菜单可见性只属于前端演示投影，不是生产授权；所有业务动作继续由服务端认证、capability、租户和对象范围约束。

## 已批准方案

负责人于 2026-10-09 选择“正式业务权威生成投影 + 统一页头 + 菜单收敛”。

固定事实链为：

```text
wisdom-baseline 原始决策输入
→ 负责人确认并写回 doc/ 的正式业务权威
→ 生成的前端工作台目的投影
→ 业务工作台目录与各工作台统一页头
```

### 方案边界

- 从 `08-role-workbenches.md` 的正式 23 台表生成 `{ code, title, businessPurpose }`；路由 path、组件和成熟度仍是技术目录事实，不反写成业务权威。
- 生成物必须带来源说明，并提供 check/drift 命令；禁止手工修改生成物。
- 新建薄门面 `WorkbenchPageHeader(stageCode)`，内部读取生成投影并复用现有 `PageHeader.summary`；页面不得覆写 `businessPurpose`。
- 目录卡片和 23 台页面使用同一目的投影。对象状态说明移动或保留在当前上下文，不得替换工作台目的。
- 出运工作台在顶层只显示一次“出运”身份与目的；接管、装船交接、在途风险是内部视图，不再各自冒充整页身份。
- 一级侧栏移除七个目录内重复入口：备货、装箱、出运、进口清关、提柜、送仓、卸柜；保留路由、深链、组件和“业务工作台”目录入口。
- 一级侧栏保留“我的任务、业务工作台、岗位待办、干活、导入货柜”以及其他角色原有的非重复管理/系统入口；本任务不重命名“干活”。
- 删除硬编码“工作区 / 已出运”范围块，不以另一条静态范围文案替代。

## 边界 / 不做

- 不修改数据库、迁移、API、公共业务契约、服务端权限或领域动作。
- 不把基线中尚未写回的优先损失、策略顺序、KPI、完成语义或角色政策带入生产 UI。
- 不删除工作台页面、路由、URL、深链或业务能力。
- 不把 23 台工作台改成统一表单或统一页面模板；统一的只有业务身份和目的投影。
- 不改变各台当前成熟度，不给 `planned` 台增加生产队列或写动作。
- 不建立运行时 Markdown 解析；Markdown 只在仓库生成/校验阶段读取。
- 不在本任务中修复卸空、出口放行、预约归属、费用口径、责任接收等跨台业务缺口。
- 不与当前 NPI A1 的产品代码差异并行写同一文件；S2 在 NPI A1 集成后同步最新 `main` 再开始。

## 智慧开启基线

### 跨台共同基线

| 基线文件与原结论                                    | 处置       | 依据                                          | 落点                                         |
| --------------------------------------------------- | ---------- | --------------------------------------------- | -------------------------------------------- |
| `README.md`：基线必读但不是业务权威                 | 沿用       | README 地位条款；AGENTS 唯一事实链            | 本 brief 与生成器只读基线，不作为运行时源    |
| `全局.md`：跨台交接、时限、费用、角色等口径仍有冲突 | 沿用       | 当前正式权威仍未全部解决                      | 本任务不实现这些政策，只显示已写回的一行目的 |
| `进度.md`：历史记录仍按 20 台描述                   | 与权威冲突 | `08-role-workbenches.md` 当前正式目录为 23 台 | 生成器只认 `08` 当前 23 台表                 |
| 各台详细控制面可以证明业务完成                      | 与权威冲突 | AGENTS 与 `08` 均禁止页面/API/字段冒充闭环    | 页面只显示目标，不显示“已达成”               |

### 23 台逐台继承

下表只决定一行核心目的的来源。各基线内尚未写回的损失顺序、策略、KPI 和完成语义继续保持候选或待决，不进入本任务实现。

| stable code             | 对应基线                 | 核心目的处置                                     | 当前实现边界                         |
| ----------------------- | ------------------------ | ------------------------------------------------ | ------------------------------------ |
| `market_signals`        | `市场与经营信号.md`      | 沿用已写回目的                                   | 直接投影 `08` 第 1 台结果            |
| `product_selection`     | `选品立项.md`            | 沿用已写回目的；优先损失仍存疑                   | 不以填写评审或领取动作替代目的       |
| `product_npi`           | `产品开发与NPI工作台.md` | 沿用已写回的重大投入前决定目的；细化损失仅作候选 | 不因阶段或对象状态改变目的           |
| `master_data`           | `商品与物料主数据.md`    | 沿用已写回宽口径目的；窄口径损失待写回           | 投影五类稳定身份结果                 |
| `sourcing`              | `寻源与供应商工作台.md`  | 沿用已写回目的                                   | 不以收报价或选一家供应商替代结果     |
| `demand_replenishment`  | `需求与补货.md`          | 沿用 `08` 目的；岗位与指标细化存疑               | 只展示缺货/过量之间的获批需求结果    |
| `procurement`           | `采购.md`                | 沿用已写回目的；损失细化待写回                   | 不以建 PO 或催单替代书面承诺结果     |
| `supply_readiness`      | `生产.md`                | 沿用已写回目的；详细损失待写回                   | 投影真实可出运数量、时间窗与限制     |
| `shipment_planning`     | `出运计划.md`            | 沿用已写回目的；三类场景待写回                   | 投影版本化可执行方案结果             |
| `booking`               | `订舱.md`                | 沿用 `08` 目的；详细责任和损失存疑               | planned 状态保持只读                 |
| `cargo_ready`           | `备货.md`                | 沿用已写回目的；损失细化待写回                   | 不以清单勾选或工单完成替代可装产品行 |
| `stuffing`              | `装箱.md`                | 沿用已写回目的；原生现场启用仍待样本/定案        | 目标可见不等于现场能力已启用         |
| `export_customs`        | `出口报关.md`            | 沿用 `08` 目的；责任模式与损失存疑               | planned 状态保持只读                 |
| `dispatch`              | `出运.md`                | 沿用已写回目的；损失策略待写回                   | 三个内部视图共享一次整台目的         |
| `ocean_operations`      | `海运运营工作台.md`      | 沿用已写回目的；完成语义细化待写回               | 不把跟踪 ETA 当最终目的              |
| `customs`               | `清关.md`                | 沿用已写回“进口清关”目的；损失待写回             | stable code 保持 `customs`           |
| `pickup`                | `提柜.md`                | 沿用已写回目的；计划层与窗口策略存疑             | 不以扫码或工单替代可信 Gate Out      |
| `delivery`              | `送仓.md`                | 沿用已写回目的；预约责任仍冲突                   | 不以 GPS/司机扫码替代权威接收        |
| `unloading`             | `卸柜.md`                | 沿用已写回目的；独立确认责任仍存疑               | 文案不冒充当前已具备卸空能力         |
| `empty_return`          | `还箱.md`                | 沿用 `08` 目的；详细损失与指标存疑               | 投影期限、有效场站、EIR 和责任关闭   |
| `compliance_operations` | `合规运营.md`            | 沿用 `08` 目的；详细策略待写回                   | planned 状态保持只读                 |
| `charges`               | `费用.md`                | 沿用已写回目的；职责与阈值存疑                   | 不以录账、请款或争议发起替代金额账本 |
| `exceptions`            | `异常中心.md`            | 沿用已写回目的；损失顺序和首期范围存疑           | 不以案件关闭替代原业务域接受结果     |

## 负责人决策记录

| 决策 ID | 已知事实与未知                                         | 选项、成本/收益/风险/可逆性                                                                    | 推荐与理由                          | 负责人结论                 | 权威落点 / 状态                                                |
| ------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------- | -------------------------------------------------------------- |
| WPN-D01 | 23 台正式目的已在 `08`，前端存在多份漂移文案           | A 逐页修改；B 手工统一目录；C 从正式权威生成投影并统一页头。C 多一个生成门禁，但消除第二套权威 | C；唯一事实链、可检查、可回滚       | 2026-10-09：按推荐方案执行 | S1 先写回 `UI_SYSTEM.md` 并实现生成投影；approved              |
| WPN-D02 | 七台专业工作台同时出现在目录和侧栏；“已出运”范围已过时 | A 保留平铺；B 分组折叠；C 一级侧栏收敛到目录入口并保留深链                                     | C；侧栏负责去哪里，目录负责完整网络 | 2026-10-09：按推荐方案执行 | S3 写回 `UI_SYSTEM.md` / `WORKSPACE_UI_INVENTORY.md`；approved |
| WPN-D03 | 页面目的与当前对象状态混写                             | A 状态继续改 summary；B 固定目的，状态进入上下文；C 双 summary                                 | B；工作台身份固定，避免重复和漂移   | 2026-10-09：按推荐方案执行 | S2 实现；approved                                              |

## 执行切片与代理交接

> 当前 `status: design` 的 `writeScopes` 仅覆盖本 brief，避免与正在当前主 checkout 写入的 NPI A1 冲突。书面规格获负责人复核且 NPI A1 集成后，主代理必须先同步最新 `main`，再把 frontmatter 切换为 `coding`、`writer: codex` 并精确扩展本任务生产写入范围。不得在未更新范围和冲突检查前下发实现 TASK。

### S1：正式目的投影与漂移门禁

| 项目     | 内容                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 让 `08` 的 23 台正式结果成为唯一可生成的前端业务目的投影；先修数据来源，不改页面布局                                                                                                                                                         |
| 预计写入 | `doc/cross-border-supply-chain/08-role-workbenches.md`（仅在生成标记必要时最小调整）、`docs/product/UI_SYSTEM.md`、`scripts/generate-workbench-purposes.mjs`、生成文件、`apps/web/src/data/workbenchNetwork.ts`、对应测试及 root script 入口 |
| 禁止范围 | 不读取基线作为运行时源；不改 Vue；不引入后端、数据库、权限或业务状态                                                                                                                                                                         |
| 测试先行 | 先写 23 code/名称/目的完整性、重复、缺失、未知 code 与 drift 失败测试，确认 RED，再实现生成器和消费映射                                                                                                                                      |
| 验证     | 生成 check、相关 Node 测试、`workbenchNetwork` 单测、Web typecheck/lint、repo check、目标路径格式检查                                                                                                                                        |
| 停止条件 | 生成文件可重复、check 对漂移非零失败、目录只消费生成目的；ready-for-review 后停手，不提交                                                                                                                                                    |

### S2：23 台统一业务目的页头

| 项目        | 内容                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 目标        | 每台工作台首屏固定显示正式名称和一行业务目的，状态与内部视图不再覆盖整台定位                                                               |
| 前置        | S1 验收；NPI A1 已合并并同步最新 `main`；重新核对全部在途 worktree 和实际 diff                                                             |
| 预计写入    | `WorkbenchPageHeader` 及测试、`RoleWorkbenchFrame`、`PlannedWorkbenchView`、12 台专用 live 页面/组合视图、主题契约测试 fixture、参数化 E2E |
| UI 强制结构 | 逐项遵守 frontmatter 五个 UI 数组；出运顶层只显示一次整台 header；planned 页目的与成熟度同屏但不生成动作                                   |
| 禁止范围    | 不改工作台领域内容、动作、API、状态机或布局职责；不把 purpose 重复显示在 header 和正文相邻区块                                             |
| 测试先行    | 先证明 23 route 当前不能稳定显示唯一目的、NPI/选品会随状态漂移、dispatch 内部视图覆盖整台身份；再最小接线                                  |
| 验证        | 相关组件/页面单测、23 route 参数化 E2E、Web typecheck/lint/build、三视口真实截图与人工视觉核对                                             |
| 停止条件    | 23 台每页恰好一个统一来源目的；状态切换与 dispatch 内部视图不改变；ready-for-review 后停手，不提交                                         |

### S3：一级侧栏收敛

| 项目        | 内容                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| 目标        | 侧栏恢复为入口层，完整工作台网络统一从 `/workspaces` 进入                                             |
| 前置        | S2 验收；导航权威已写回 `UI_SYSTEM.md` 和 inventory                                                   |
| 预计写入    | 七个 route 的 nav meta、`AppSidebar.vue`、navigation/shell 单测与 E2E、`WORKSPACE_UI_INVENTORY.md`    |
| UI 强制结构 | 保留入口顺序和移动抽屉可达性；删除静态“已出运”范围；所有专业路由和深链仍存在                          |
| 禁止范围    | 不删除路由/页面，不改服务端授权，不重命名“干活”，不扩建导航分组系统                                   |
| 测试先行    | 先把“侧栏存在七个重复入口”和“静态已出运范围”写成失败反证，再移除 nav meta/范围块                      |
| 验证        | navigation、shell、目录页单测，shell/workbench-network E2E，键盘/移动抽屉，三视口截图与 overflow 数据 |
| 停止条件    | 侧栏仅有一个正式工作台目录入口；23 route 均可由目录或深链访问；ready-for-review 后停手，不提交        |

## 详细实施计划

> **执行要求**：实现执行器必须逐任务遵循 TDD：先写测试并观察预期失败，再做最小实现并观察转绿。
> 每个切片在 `ready-for-review` 停手并返回 `HANDOFF`，不得自行提交、改变业务口径或扩大写入范围。
> 本节只展开前述 S1/S2/S3，不建立新的需求或业务权威。

**目标**：让正式 23 台工作台的核心业务目的成为可生成、可检查、全前端共用的唯一投影，并让侧栏收敛为不重复业务目录的入口层。

**架构**：仓库脚本在构建/校验阶段解析 `08-role-workbenches.md` 第三节的正式 23 台表，生成只读 TypeScript 投影；浏览器不读取 Markdown。技术目录、统一工作台页头和目录卡片只按 stable code 消费该投影；路由继续拥有路径、组件和演示角色等技术事实。一级侧栏通过移除重复 route 的 nav 元数据收敛，不新增隐藏名单或授权逻辑。

**技术栈**：Node.js `node:test`、Prettier、TypeScript、Vue 3、Vitest、Vue Test Utils、Vue Router、Playwright、现有主题门面与 pnpm/Turbo 门禁。

**规格**：本文件从开头至“执行切片与代理交接”是本计划实现的唯一规格；业务内容锚定 `doc/cross-border-supply-chain/08-role-workbenches.md`。

### 全局约束

- 唯一业务目的来源固定为 `doc/cross-border-supply-chain/08-role-workbenches.md` 第三节五列表；生成器不得读取 `wisdom-baseline`。
- 正式目的投影字段固定为 `code`、`title`、`businessPurpose`；path、phase、kind、maturity、surface、ownerRole 和 handoff 仍属于技术目录事实。
- 浏览器 bundle 不引入 `fs`、Markdown parser 或运行时网络请求；生成与 drift check 只在仓库命令执行。
- `PageHeader.summary` 继续作为展示层 API；不把业务语义写进主题组件，也不在 route meta 或 `uiCopyCatalog` 复制 purpose。
- purpose 不接受页面覆写；对象状态、错误、等待、只读、完成和内部视图不得改变工作台 identity。
- 菜单隐藏不构成授权；服务端 capability、租户、账套主体、对象范围和审计均保持不变。
- 三个切片共用本任务集成分支和最终一个 PR；Codex 不提交，主代理验收后按精确路径提交。
- S2 必须等待 NPI A1 合并并同步最新 `main`；如果任何在途 worktree 仍改写重叠文件，S2 保持 blocked。

### Review Focus

1. **权威表出现重复、缺失、未知 stable code 或顺序断裂**：生成/check 必须稳定失败并指出具体 code，不能静默丢行或重排。
2. **权威变更但生成物未更新**：`--check` 必须非零退出且绝不写文件；正常 generate 必须产生确定性字节结果。
3. **工作台对象状态或出运内部视图变化**：正式名称和 purpose 必须保持一份且不变化，当前责任、主动作和回执仍然存在。
4. **planned 工作台**：可显示正式目的与成熟度，但不能因统一页头产生生产队列、写控件或“已完成”暗示。
5. **侧栏快捷入口移除后**：全部 23 条目录链接与深链仍可访问；移动抽屉、键盘关闭和演示角色投影保持可用。

---

### Task S1.1：权威表解析、生成与 drift check

#### S1.1 Files

- Create: `scripts/generate-workbench-purposes.mjs`
- Create: `scripts/generate-workbench-purposes.test.mjs`
- Create/generated: `apps/web/src/data/workbenchPurposes.generated.ts`
- Modify: `package.json`

#### S1.1 Interfaces

- Produces:

```js
export const EXPECTED_WORKBENCH_CODES;
export function parseWorkbenchPurposeTable(markdown);
export function renderWorkbenchPurposeProjection(rows);
export function compareWorkbenchPurposeProjection({ authorityText, committedText });
```

- Generated TypeScript produces:

```ts
export interface WorkbenchPurpose {
  readonly code: WorkbenchCode;
  readonly title: string;
  readonly businessPurpose: string;
}

export const workbenchPurposes: readonly WorkbenchPurpose[];
export const workbenchPurposeByCode: Readonly<
  Record<WorkbenchCode, WorkbenchPurpose>
>;
```

- [ ] **Step 1：先写解析与失败模式测试**

在 `scripts/generate-workbench-purposes.test.mjs` 使用 `node:test` 建立以下测试：

```js
test("parses exactly the approved 23 workbench purposes from the authority table", () => {
  const rows = parseWorkbenchPurposeTable(authorityMarkdown);
  assert.equal(rows.length, 23);
  assert.deepEqual(
    rows.map((row) => row.sequence),
    Array.from({ length: 23 }, (_, index) => index + 1),
  );
  assert.equal(rows[0].code, "market_signals");
  assert.equal(rows.at(-1).code, "exceptions");
  assert.equal(rows.find((row) => row.code === "customs").title, "进口清关");
  assert.ok(
    rows.every((row) => row.title.length > 0 && row.businessPurpose.length > 0),
  );
});

test("rejects duplicate stable codes", () => {
  assert.throws(
    () => parseWorkbenchPurposeTable(markdownWithDuplicate),
    /WORKBENCH_PURPOSE_DUPLICATE_CODE:market_signals/,
  );
});

test("rejects a missing approved stable code", () => {
  assert.throws(
    () => parseWorkbenchPurposeTable(markdownWithoutBooking),
    /WORKBENCH_PURPOSE_MISSING_CODE:booking/,
  );
});

test("rejects an unknown stable code", () => {
  assert.throws(
    () => parseWorkbenchPurposeTable(markdownWithUnknown),
    /WORKBENCH_PURPOSE_UNKNOWN_CODE:unknown_workbench/,
  );
});
```

再增加 `renders a deterministic TypeScript projection` 和 `check mode reports projection drift without writing`：同一输入两次输出必须字节相等；check 针对旧内容返回 drift，且旧文件内容不变。

- [ ] **Step 2：运行 RED**

```bash
node --test scripts/generate-workbench-purposes.test.mjs
```

预期：首先因 `generate-workbench-purposes.mjs` 不存在而 `ERR_MODULE_NOT_FOUND`；建立导出骨架后，重复/缺失/未知 code、确定性和 drift 测试仍失败。只有失败原因指向缺少目标行为才进入实现。

- [ ] **Step 3：实现纯解析和渲染函数**

解析器只定位标题 `## 三、当前项目定义的全部 23 个工作台` 后的五列表，跳过表头与分隔线，将 Markdown code 标记去除后解析为：

```js
{
  sequence: 1,
  code: "market_signals",
  title: "市场与经营信号",
  kind: "主链",
  businessPurpose: "把经过最低验证的真实市场信号形成不可变新品候选交接，并披露证据、反证和未决不确定性",
}
```

固定结构白名单必须包含 23 个 stable code；校验顺序连续、code 全集且唯一、title/purpose 非空。稳定错误格式固定为：

```text
WORKBENCH_PURPOSE_DUPLICATE_CODE:<code>
WORKBENCH_PURPOSE_MISSING_CODE:<code>
WORKBENCH_PURPOSE_UNKNOWN_CODE:<code>
WORKBENCH_PURPOSE_SEQUENCE:<actual>
WORKBENCH_PURPOSE_EMPTY_FIELD:<code>
```

渲染器使用项目锁定的 Prettier TypeScript parser，文件首部写入来源路径与“禁止手工修改”。CLI 只提供：

```text
node scripts/generate-workbench-purposes.mjs
node scripts/generate-workbench-purposes.mjs --check
```

默认 generate 覆盖固定生成文件；`--check` 缺文件或内容漂移时设置非零 exit code，绝不写入。

- [ ] **Step 4：生成并运行 GREEN**

```bash
node --test scripts/generate-workbench-purposes.test.mjs
pnpm workbench-purposes:generate
pnpm workbench-purposes:check
```

预期：所有生成器测试通过，生成后 check 输出无漂移。

- [ ] **Step 5：接入标准命令**

在根 `package.json`：

```json
"workbench-purposes:generate": "node scripts/generate-workbench-purposes.mjs",
"workbench-purposes:check": "node scripts/generate-workbench-purposes.mjs --check"
```

把新 Node 测试加入根 `test` 的 `node --test` 列表；把 `pnpm workbench-purposes:check` 加在 `validate` 的 `repo:check` 之后。不得把 generate 放进只读检查命令。

- [ ] **Step 6：重跑命令契约**

```bash
pnpm workbench-purposes:check
pnpm test --filter=logixs
pnpm exec prettier --check package.json scripts/generate-workbench-purposes.mjs scripts/generate-workbench-purposes.test.mjs apps/web/src/data/workbenchPurposes.generated.ts
```

如根 `test` 不支持过滤，则只运行其前置 Node 测试清单，并在 S1 集成门禁运行完整受影响套件；不得伪报未执行命令。

### Task S1.2：技术目录消费生成目的

#### S1.2 Files

- Modify: `apps/web/src/data/workbenchNetwork.ts`
- Modify: `apps/web/src/data/workbenchNetwork.test.ts`
- Modify: `apps/web/src/views/WorkbenchNetworkView.vue`
- Modify: `apps/web/src/views/WorkbenchNetworkView.test.ts`
- Modify: `scripts/check-repository.mjs`
- Modify: `scripts/check-repository.test.mjs`

#### S1.2 Interfaces

- Produces: `WorkbenchStage.businessPurpose`；保留所有现有 path/phase/kind/maturity/surface/ownerRole/handoff 技术字段。

- [ ] **Step 1：先写 catalog 投影测试**

在 `workbenchNetwork.test.ts` 增加：

```ts
it("projects all 23 generated identities into the technical catalog", () => {
  expect(
    workbenchStages.map(({ code, title, businessPurpose }) => ({
      code,
      title,
      businessPurpose,
    })),
  ).toEqual(workbenchPurposes);
});

it("does not keep a handwritten roleResult copy", () => {
  expect(workbenchStages.every((stage) => !("roleResult" in stage))).toBe(true);
});
```

保留并继续断言 23 code/path 唯一、20+3 类型、maturity/surface 和 handoff 关系。

更新 `WorkbenchNetworkView.test.ts`：逐台断言生成 title/purpose 出现在目录卡片中，不再使用旧 `roleResult` 和多余“工作台”后缀。

更新 repository guard 测试：generated title/purpose + 技术 path 组合应通过；duplicate/missing code 和 path drift 仍拒绝；正式 `customs` 名称由生成器测试负责，不再由 AST literal 负责。

- [ ] **Step 2：运行 RED**

```bash
pnpm --filter @logix/web test -- src/data/workbenchNetwork.test.ts src/views/WorkbenchNetworkView.test.ts
node --test scripts/check-repository.test.mjs
```

预期：`WorkbenchStage` 尚无 `businessPurpose`、仍含 `roleResult`，目录文案不一致；若先改变 catalog 构造器，旧 repository guard 会因 AST 参数形状失败。

- [ ] **Step 3：最小接入生成 identity**

`workbenchNetwork.ts` 改为：

```ts
import {
  workbenchPurposeByCode,
  type WorkbenchCode,
} from "./workbenchPurposes.generated";
export type { WorkbenchCode } from "./workbenchPurposes.generated";

export interface WorkbenchStage {
  code: WorkbenchCode;
  title: string;
  businessPurpose: string;
  path: string;
  // 现有技术字段原样保留
}

function identity(code: WorkbenchCode) {
  return workbenchPurposeByCode[code];
}
```

20 个既有 stage 和 3 个 planned stage 的构造调用删除手写 title/roleResult，返回值展开 `...identity(code)`；不得改变 path、phase、kind、sequence、assessmentState、maturity、surface、ownerRole、requiredFacts 或 handoff code。

目录页统一渲染 `stage.businessPurpose`。

- [ ] **Step 4：同步 repository guard**

`check-repository.mjs` 继续验证 23 code/path、20+3 kind、maturity 声明、`/compliance` 独立 route 和 planned 免责声明；只移除对旧构造器 title/roleResult 参数与 `customs` title literal 的依赖。不得削弱路径、数量、重复和 maturity 检查。

- [ ] **Step 5：运行 GREEN**

```bash
pnpm --filter @logix/web test -- src/data/workbenchNetwork.test.ts src/views/WorkbenchNetworkView.test.ts
node --test scripts/check-repository.test.mjs scripts/generate-workbench-purposes.test.mjs
pnpm workbench-purposes:check
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web lint
pnpm repo:check
```

### Task S1.3：写回前端产品规则并收口 S1

#### S1.3 Files

- Modify by main: `docs/product/UI_SYSTEM.md`
- Modify by main: `docs/planning/tasks/workbench-business-purpose-navigation-v1.md`

- [ ] **Step 1：写回已批准规则**

在 `UI_SYSTEM.md` 的壳层与固定办理壳附近补充：

- 工作台正式 identity 为 stable code、正式名称、一行核心业务目的；目的来自 `08` 第三节生成投影。
- `PageHeader` 顺序为岗位类别、正式名称、固定目的；对象状态、内部标签和完成结果不得替换 identity。
- Markdown 只在仓库生成/check 阶段读取；前端运行时不解析业务权威。
- 菜单可见性不是服务端授权；完整 23 台网络由 `/workspaces` 目录承载。

不得复制 23 句正文；只记录投影规则和边界。

- [ ] **Step 2：运行 S1 集成门禁**

```bash
node --test scripts/generate-workbench-purposes.test.mjs scripts/check-repository.test.mjs
pnpm workbench-purposes:check
pnpm --filter @logix/web test -- src/data/workbenchNetwork.test.ts src/views/WorkbenchNetworkView.test.ts
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web lint
pnpm repo:check
pnpm exec prettier --check package.json scripts/generate-workbench-purposes.mjs scripts/generate-workbench-purposes.test.mjs scripts/check-repository.mjs scripts/check-repository.test.mjs apps/web/src/data/workbenchPurposes.generated.ts apps/web/src/data/workbenchNetwork.ts apps/web/src/data/workbenchNetwork.test.ts apps/web/src/views/WorkbenchNetworkView.vue apps/web/src/views/WorkbenchNetworkView.test.ts docs/product/UI_SYSTEM.md docs/planning/tasks/workbench-business-purpose-navigation-v1.md
```

- [ ] **Step 3：主代理验收和提交**

核对生成物逐行对应 `08`、`--check` 不写文件、目录不再保存第二份目的。精确暂存 S1 文件并提交：

```text
feat(workbenches): generate authoritative purpose projection
```

在 brief 进度 log 记录实际 commit、检查与未运行项。S1 不单独建 PR。

---

### Task S2.0：等待并同步 NPI A1

#### NPI A1 direct overlap

- `apps/web/src/views/ProductNpiWorkbench.vue`
- `apps/web/src/views/ProductSelectionWorkbench.vue`
- `apps/web/e2e/workbench-network.spec.ts`

#### NPI A1 adjacent validation files

- `apps/web/src/views/ProductNpiWorkbench.test.ts`
- `apps/web/src/views/ProductSelectionWorkbench.test.ts`
- `apps/web/e2e/product-npi-workbench.spec.ts`

- [ ] **Step 1：确认 A1 已集成**

只有在 NPI A1 PR/CI 已合并、其 brief 不再处于 `coding/fix`、所有相关 worktree 的实际 diff 不再改写重叠文件时继续。否则将本任务 S2 标记为 `blocked`，不回退已完成 S1。

- [ ] **Step 2：同步最新 main**

由主代理在本 worktree 合入最新 `origin/main`；不得使用 stash、hard reset 或覆盖式 checkout。记录合并后的 S2 base。

- [ ] **Step 3：重读并验证 A1 当前行为**

重读上述 6 个文件，运行 A1 定向 Web 单测和 NPI E2E。冲突解决只允许替换页头接线；不得改变阶段门、非 MP 发布拒绝、退回选品、mock 数据或主动作语义。

- [ ] **Step 4：扩展 S2 写入范围并下发**

主代理把 brief frontmatter 更新为 `status: coding`、`writer: codex`，只列 S2 精确路径与 UI 锁，提交 brief/base 后再下发 `TASK ...#S2`。

### Task S2.1：统一 `WorkbenchPageHeader` 门面

#### S2.1 Files

- Create: `apps/web/src/components/workbench/WorkbenchPageHeader.vue`
- Create: `apps/web/src/components/workbench/WorkbenchPageHeader.test.ts`
- Modify: `apps/web/src/ui-theme/test-fixtures/ContractTestPageHeader.vue`
- Modify: `apps/web/src/ui-theme/UiThemeProvider.test.ts`

#### S2.1 Interfaces

```ts
interface WorkbenchPageHeaderProps {
  stageCode: WorkbenchCode;
  eyebrow?: string;
  updatedAt?: string;
}
```

Produces existing `PageHeader` help/actions slots; deliberately does not accept `title` or `summary` overrides.

- [ ] **Step 1：先写 facade 测试**

测试名固定为：

- `renders the generated formal title and business purpose for a stage code`
- `keeps the generated purpose stable when surrounding state changes`
- `forwards help and actions slots without accepting title or summary overrides`

给 `product_selection` 时精确断言 generated title/purpose；更新父状态后文案不变；slots 仍存在。主题 fixture 必须实际渲染并断言 eyebrow/summary，避免替代主题静默丢掉目的。

- [ ] **Step 2：运行 RED**

```bash
pnpm --filter @logix/web test -- src/components/workbench/WorkbenchPageHeader.test.ts src/ui-theme/UiThemeProvider.test.ts
```

预期：组件不存在；创建空组件后因 generated identity 与 slot 转发缺失继续失败。

- [ ] **Step 3：实现薄门面**

```vue
<script setup lang="ts">
import { computed } from "vue";
import {
  workbenchPurposeByCode,
  type WorkbenchCode,
} from "../../data/workbenchPurposes.generated";
import PageHeader from "../ui/PageHeader.vue";

const props = withDefaults(
  defineProps<{
    stageCode: WorkbenchCode;
    eyebrow?: string;
    updatedAt?: string;
  }>(),
  { eyebrow: "岗位工作台" },
);
const identity = computed(() => workbenchPurposeByCode[props.stageCode]);
</script>

<template>
  <PageHeader
    :eyebrow="eyebrow"
    :title="identity.title"
    :summary="identity.businessPurpose"
    :updated-at="updatedAt"
  >
    <template v-if="$slots.help" #help><slot name="help" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </PageHeader>
</template>
```

- [ ] **Step 4：运行 GREEN**

```bash
pnpm --filter @logix/web test -- src/components/workbench/WorkbenchPageHeader.test.ts src/ui-theme/UiThemeProvider.test.ts
```

### Task S2.2：共享办理壳与 planned 页面接线

#### S2.2 Files

- Modify: `apps/web/src/components/workbench/RoleWorkbenchFrame.vue`
- Modify: `apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts`
- Modify: `apps/web/src/views/PlannedWorkbenchView.vue`
- Modify: `apps/web/src/views/PlannedWorkbenchView.test.ts`

#### S2.2 Interfaces

```ts
interface RoleWorkbenchFrameProps {
  stageCode: WorkbenchCode;
  contextLabel: string;
  embedded?: boolean;
  // 其余既有非 identity props 原样保留
}
```

`embedded=false` 时渲染统一 header；`embedded=true` 时根元素为 `section` 且不渲染工作台 header，用于出运内部视图。

- [ ] **Step 1：先写 frame/planned 失败测试**

- `RoleWorkbenchFrame`: `derives its immutable page identity from stageCode while preserving the three-pane shell`，断 generated purpose、队列/事实/待办区域顺序与存在性不变。
- `PlannedWorkbenchView`: `shows one generated purpose beside the planned maturity boundary`，断 purpose 精确出现一次、只读 maturity notice 同屏、无写控件。

- [ ] **Step 2：运行 RED**

```bash
pnpm --filter @logix/web test -- src/components/workbench/RoleWorkbenchFrame.test.ts src/views/PlannedWorkbenchView.test.ts
```

预期：frame 仍要求任意 title/summary；planned 的旧 roleResult 在 header 和正文重复。

- [ ] **Step 3：实现最小接线**

删除 frame 的 title/summary props，新增 `stageCode` 与 `embedded`；非 embedded 最前渲染 `WorkbenchPageHeader`，其余 context/queue/primary/secondary DOM 顺序和 CSS 网格不变。planned 页使用 generated header；删除相邻正文中逐字重复的“岗位结果”，保留 owner、maturity、事实、交接和只读边界。

- [ ] **Step 4：运行 GREEN**

```bash
pnpm --filter @logix/web test -- src/components/workbench/RoleWorkbenchFrame.test.ts src/views/PlannedWorkbenchView.test.ts
```

### Task S2.3：12 个 dedicated 工作台统一接线

#### S2.3 Files

- Modify: `apps/web/src/views/MarketSignalsWorkbench.vue`
- Modify: `apps/web/src/views/ProductSelectionWorkbench.vue`
- Modify: `apps/web/src/views/ProductNpiWorkbench.vue`
- Modify: `apps/web/src/views/MasterDataWorkbench.vue`
- Modify: `apps/web/src/views/SourcingWorkbench.vue`
- Modify: `apps/web/src/views/CargoReadyWorkbench.vue`
- Modify: `apps/web/src/views/StuffingWorkbench.vue`
- Modify: `apps/web/src/views/DispatchWorkbench.vue`
- Modify: `apps/web/src/views/CustomsWorkbench.vue`
- Modify: `apps/web/src/views/PickupWorkbench.vue`
- Modify: `apps/web/src/views/WarehouseDeliveryWorkbench.vue`
- Modify: `apps/web/src/views/ContainerUnloadingWorkbench.vue`
- Modify: `apps/web/src/router/index.ts`（只同步七条 dedicated route 的正式 topbar title；S3 才移除 nav meta）
- Create: `apps/web/e2e/workbench-purpose-navigation.spec.ts`
- Modify as required by formal-title assertions: relevant workbench E2E files listed in S2 integration command.

- [ ] **Step 1：先写 23 route 失败 E2E**

在新 spec 从 generated 23 rows 参数化：

```ts
test("all 23 workbench routes render exactly one generated business purpose", async ({
  page,
}) => {
  for (const workbench of workbenchPurposes) {
    await page.goto(workbenchPathByCode[workbench.code]);
    await expect(
      page.getByRole("heading", { level: 1, name: workbench.title }),
    ).toBeVisible();
    await expect(
      page.getByText(workbench.businessPurpose, { exact: true }),
    ).toHaveCount(1);
  }
});
```

另测选品/NPI 在待领取、我负责、只读/完成状态间 purpose 不变；booking/export_customs/compliance_operations 同时显示 purpose 与 planned 边界，且无生产写控件。

- [ ] **Step 2：运行 RED**

```bash
pnpm --filter @logix/web exec playwright test e2e/workbench-purpose-navigation.spec.ts --project=desktop-chromium
```

预期：多台仍显示硬编码动作说明；选品 summary 随对象状态变化；planned purpose 重复；正式标题后缀漂移。

- [ ] **Step 3：替换专用页面 identity 接线**

市场、选品、NPI、主数据、寻源的直接 `PageHeader` 改成固定 `WorkbenchPageHeader stage-code`，保留 eyebrow/help/actions/updatedAt，删除动态或手写 summary。六个 `RoleWorkbenchFrame` 页面只传 stageCode，删除 title/summary；slots、队列、当前对象、动作、回执和 CSS 不变。

七个 dedicated route 的 `meta.title` 从 `workbenchPurposeByCode[code].title` 取得正式名称；暂时保留 navLabel/navIcon/navOrder 到 S3。

- [ ] **Step 4：运行初步 GREEN**

```bash
pnpm --filter @logix/web exec playwright test e2e/workbench-purpose-navigation.spec.ts --project=desktop-chromium
```

### Task S2.4：出运顶层唯一 identity

#### S2.4 Files

- Modify: `apps/web/src/views/DispatchWorkbench.vue`
- Modify: `apps/web/src/views/DispatchWorkbench.test.ts`
- Modify: `apps/web/src/components/dispatch/PreDepartureDispatchWorkbench.vue`
- Modify: `apps/web/src/components/shipment-handoff/PostDepartureHandoffWorkbench.vue`
- Modify: `apps/web/src/views/ShipmentRiskWorkbench.vue`
- Modify: `apps/web/e2e/dispatch-workbench.spec.ts`

- [ ] **Step 1：先写出运失败测试**

测试名：

- `renders one dispatch identity across intake loading and risk views`
- `switching dispatch views does not replace the workbench purpose`

对默认、`?view=loading`、`?view=risk` 断言唯一 H1 为“出运”、唯一 generated purpose；局部标题分别为“接管已出运数据 / 装船交接历史 / 在途风险”，只能是 H2；`WorkbenchFlowContext` 仍只有一份。

- [ ] **Step 2：运行 RED**

```bash
pnpm --filter @logix/web test -- src/views/DispatchWorkbench.test.ts
```

预期：顶层没有统一出运 header，三个子视图各自渲染整页 PageHeader。

- [ ] **Step 3：实现顶层壳**

```vue
<main class="dispatch-workbench page-frame">
  <WorkbenchPageHeader stage-code="dispatch" />
  <WorkbenchFlowContext ... />
  <nav aria-label="出运工作台内部视图">...</nav>
  <component :is="currentView" />
</main>
```

三个子视图删除整页 PageHeader 和重复 view-switch，根改为局部 `section`；loading 使用 `RoleWorkbenchFrame stage-code="dispatch" embedded`；risk 局部 H2 固定为“在途风险”。不得改变 API、选择状态、mock、出运事实或风险动作。

- [ ] **Step 4：运行 GREEN**

```bash
pnpm --filter @logix/web test -- src/views/DispatchWorkbench.test.ts src/components/workbench/RoleWorkbenchFrame.test.ts
pnpm --filter @logix/web exec playwright test e2e/dispatch-workbench.spec.ts e2e/workbench-purpose-navigation.spec.ts --project=desktop-chromium
```

### Task S2.5：S2 集成门禁、视觉证据与提交

- [ ] **Step 1：运行 S2 自动化门禁**

```bash
pnpm workbench-purposes:check
pnpm --filter @logix/web test -- src/components/workbench/WorkbenchPageHeader.test.ts src/components/workbench/RoleWorkbenchFrame.test.ts src/views/PlannedWorkbenchView.test.ts src/views/DispatchWorkbench.test.ts src/data/workbenchNetwork.test.ts src/views/WorkbenchNetworkView.test.ts
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web lint
pnpm --filter @logix/web build
pnpm --filter @logix/web exec playwright test e2e/workbench-purpose-navigation.spec.ts e2e/workbench-network.spec.ts e2e/cargo-ready-workbench.spec.ts e2e/stuffing-workbench.spec.ts e2e/dispatch-workbench.spec.ts e2e/customs-workbench.spec.ts e2e/pickup-workbench.spec.ts e2e/warehouse-delivery-workbench.spec.ts e2e/container-unloading-workbench.spec.ts --project=desktop-chromium
pnpm repo:check
pnpm --filter @logix/web format:check
```

- [ ] **Step 2：生成三视口本地证据**

`workbench-purpose-navigation.spec.ts` 按 `testInfo.project.name` 写入以下未跟踪路径：

```text
.tmp/workbench-purpose-navigation-v1/<project>/workbench-directory.png
.tmp/workbench-purpose-navigation-v1/<project>/dispatch-risk.png
.tmp/workbench-purpose-navigation-v1/<project>/planned-booking.png
.tmp/workbench-purpose-navigation-v1/<project>/overflow.json
```

项目固定为 `desktop-chromium`、`narrow-chromium`、`mobile-chromium`。`overflow.json` 记录 documentElement 与 `.app-content` 的 clientWidth/scrollWidth，并自动断言 `scrollWidth <= clientWidth + 1`。

- [ ] **Step 3：主代理人工审图**

逐张核对：

- 1440x900：名称/目的首屏可读，三栏办理壳未重排。
- 1024x768：目的不遮当前责任、对象和主动作。
- 390x844：名称 → 目的 → 当前上下文 → 内容顺序连续。
- 三视口：planned 目的与成熟度同屏但无写动作；出运内部视图不冒充整页；无相邻重复 purpose；无横向溢出。

- [ ] **Step 4：主代理提交 S2**

Codex 返回未提交 HANDOFF 后，主代理核对没有夹带 NPI A1 行为修改，精确提交：

```text
feat(workbenches): unify authoritative purpose headers
```

---

### Task S3.1：侧栏 route meta 与静态范围清理

#### S3.1 Files

- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/components/shell/AppSidebar.vue`
- Modify: `apps/web/src/components/shell/navigation.test.ts`
- Modify: `apps/web/src/components/shell/AppShell.test.ts`
- Modify by main: `docs/product/UI_SYSTEM.md`
- Modify by main: `docs/product/WORKSPACE_UI_INVENTORY.md`

- [ ] **Step 1：先写 navigation/shell 失败测试**

`navigation.test.ts`：

```ts
it("keeps formal workbenches behind the single business-workbench directory entry", () => {
  for (const role of demoRoles) {
    const items = navigationForRole(router.getRoutes(), role);
    expect(items.filter((item) => item.to === "/workspaces")).toHaveLength(1);
    expect(
      items.filter(
        (item) =>
          item.to.startsWith("/workspaces/") &&
          item.to !== "/workspaces/work-inbox",
      ),
    ).toEqual([]);
  }
});
```

继续断言 23 个 workbench path 已注册，并断“我的任务、业务工作台、岗位待办、干活、导入货柜”按其既有角色投影保留；不得错误要求每个角色都看见“我的任务”。

`AppShell.test.ts` 增加 `does not render an obsolete static workspace scope`：`.workspace-switcher` 不存在，“工作区 / 已出运”和旧 tooltip 不出现，移动 drawer 仍可导航。

- [ ] **Step 2：运行 RED**

```bash
pnpm --filter @logix/web test -- src/components/shell/navigation.test.ts src/components/shell/AppShell.test.ts
```

预期：七个专业 route 仍在 nav，AppSidebar 仍渲染旧静态范围块。

- [ ] **Step 3：最小清理生产代码**

从 `cargo_ready`、`stuffing`、`dispatch`、`customs`、`pickup`、`delivery`、`unloading` 七条 route 只删除 `navLabel`、`navIcon`、`navOrder`；保留 path/component/title/section/roles。

`AppSidebar.vue` 删除 InfoTooltip import、`.workspace-switcher` DOM 与只为该区块服务的 CSS；不以新静态文案替代。`navigation.ts` 不改，不新增 formal-workbench blacklist。

- [ ] **Step 4：运行 GREEN**

```bash
pnpm --filter @logix/web test -- src/components/shell/navigation.test.ts src/components/shell/AppShell.test.ts
```

- [ ] **Step 5：写回导航权威和 inventory**

`UI_SYSTEM.md` 明确：侧栏只承担入口层，完整 23 台网络由 `/workspaces` 目录承载，菜单可见性不代表授权。`WORKSPACE_UI_INVENTORY.md` 把七台的“侧栏名”修正为目录/深链可达，并删除“已出运”作为全应用当前工作区的陈述；保留真实 route、组件和 API 事实。

### Task S3.2：导航深链 E2E 与最终视觉证据

#### S3.2 Files

- Modify: `apps/web/e2e/shell-layout.spec.ts`
- Modify: `apps/web/e2e/workbench-purpose-navigation.spec.ts`
- Modify: `apps/web/e2e/workbench-network.spec.ts` only if existing assertions assume shortcuts.

- [ ] **Step 1：先写 E2E 失败反证**

增加：

- `sidebar exposes one workbench directory entry and no formal workbench shortcuts`
- `all 23 workbench deep links remain reachable after sidebar convergence`
- `mobile drawer preserves entry order and closes after navigation`

宽屏直接检查 nav；移动端打开 drawer；断 `/workspaces` 唯一、七个旧快捷项为 0。逐 route goto 后正式 H1 + purpose 可见。键盘 Escape 和点击目录后 drawer 正常关闭。

- [ ] **Step 2：运行 RED（若 S3.1 测试已先改实现，则在同一 TDD 批次先提交测试或保留 RED 输出）**

```bash
pnpm --filter @logix/web exec playwright test e2e/shell-layout.spec.ts e2e/workbench-purpose-navigation.spec.ts
```

预期：实现前侧栏仍有七个快捷项和静态范围块。执行器必须在修改生产代码前保存该 RED 结果；不得事后补测并声称测试先行。

- [ ] **Step 3：运行 S3 GREEN**

```bash
pnpm --filter @logix/web test -- src/components/shell/navigation.test.ts src/components/shell/AppShell.test.ts
pnpm --filter @logix/web typecheck
pnpm --filter @logix/web lint
pnpm --filter @logix/web build
pnpm --filter @logix/web exec playwright test e2e/shell-layout.spec.ts e2e/workbench-purpose-navigation.spec.ts e2e/workbench-network.spec.ts
pnpm repo:check
pnpm --filter @logix/web format:check
```

不指定 Playwright project，让现有三项目覆盖 1440x900、1024x768、390x844。

- [ ] **Step 4：更新三视口证据并人工审图**

复用 S2 证据路径，重点核对：宽屏侧栏只剩入口层；窄屏 folded rail 不重复铺台；移动 drawer 只显示入口；工作台目录仍能进入 23 台；无横向溢出。

- [ ] **Step 5：主代理提交 S3**

精确提交：

```text
feat(navigation): converge workbench entry layer
```

---

### Task Final：复审、完整门禁与单 PR 收口

- [ ] **Step 1：fresh Codex 只读复审**

复审范围为任务基线至当前 HEAD，重点检查：权威解析稳健性、生成物漂移、23 台唯一 purpose、状态不变性、planned 边界、dispatch identity、深链可达、菜单与授权分离、三视口证据。reviewer 固定 `writes: none`。

- [ ] **Step 2：主代理裁决 findings**

逐项写入 `logix-disposition/v1`；只有 `accepted` 且已写回本 brief、现有权威或契约的 finding 才进入 fix。范围外重构、未来权限平台和逐台业务完善不得阻止当前收口。

- [ ] **Step 3：启动基础设施并运行一次完整门禁**

```bash
pnpm infra:up
pnpm workbench-purposes:check
pnpm validate
git diff --check
git status --short
```

`validate` 包含 repo/contract/drift/data dictionary/db generate、lint、format、typecheck、unit、真实 PostgreSQL integration、三项目 E2E 和 build。失败时记录准确命令、用例和环境原因，不隐藏或伪报。

- [ ] **Step 4：最终人工验收**

主代理逐张复核 `.tmp/workbench-purpose-navigation-v1/` 三项目截图与 overflow JSON；抽查市场、选品、NPI、出运、planned 订舱和移动目录。确认原责任、对象、缺口、主动作、回执和恢复入口未丢失。

- [ ] **Step 5：brief 与 Git 收口**

仅在 CI/验证事实具备时勾选验收、填写 `verification`、将 status 改为 `done`。精确暂存 brief 验证记录，提交后推送功能分支、创建单一 PR，等待必需 CI 通过后合并。不得删除用户 worktree、强推、绕过钩子或直接写 main。

### 计划自检结果

- **规格覆盖**：S1 覆盖权威投影与 drift，S2 覆盖统一页头、状态不变和出运组合，S3 覆盖侧栏入口层、路由/深链与旧范围清理，Final 覆盖复审、三视口和完整门禁；未发现遗漏的批准需求。
- **占位检查**：计划不含 TBD/TODO、“稍后实现”或无测试的泛化步骤；所有生产变更都有明确 RED/GREEN 命令。
- **类型一致性**：统一使用 generated `WorkbenchCode`、`WorkbenchPurpose.businessPurpose`、`workbenchPurposeByCode`、`WorkbenchPageHeader.stageCode` 和 `RoleWorkbenchFrame.stageCode/embedded`。
- **Review Focus 覆盖**：五类风险分别由 S1.1、S1.2、S2.1～S2.4、S2.3 planned E2E、S3.1～S3.2 测试固定。

### S2F1 验收 finding 修复

S2 主实现通过定向测试后，主代理按真实截图和代码核对形成以下当前切片 findings；四项必须一次性关闭后才能接受 S2：

1. **S2-BLOCK-001 主题契约丢目的**：`ContractTestPageHeader.vue` 仍不渲染 `eyebrow/summary`，`UiThemeProvider.test.ts` 未证明替代主题保留工作台目的。先增加会失败的契约断言，再让 fixture 渲染这两个字段。
2. **S2-BLOCK-002 出运内部导航脱离设计系统**：新增 `dispatch-view-switch` 没有组件样式，三视口截图显示浏览器默认描边按钮。先增加 class/aria-current 的组件断言和截图基线反证，再使用既有 token 实现紧凑、可换行、44px 移动触控的局部导航；不得复制旧 view-switch 的 `!important` 或阴影反例。
3. **S2-BLOCK-003 跨状态不变性证据不足**：现有 E2E 只 reload fresh render，没有覆盖选品 `returnPending`、legacy read-only、冻结结果和 NPI 已领取/已发布状态。必须复用现有 mock 场景或扩展专门 E2E，逐状态断言同一 generated purpose 恰好一条，并确认状态说明仍在上下文/结果区。
4. **S2-BLOCK-004 overflow 证据不完整**：`overflow.json` 只记录 documentElement；frontmatter 要求页面与内容区无溢出。扩展为同时记录并断言 `documentElement` 与 `.app-content` 的 `clientWidth/scrollWidth`，重新生成三视口 JSON 与截图。
5. **S2-BLOCK-005 选品跨状态 E2E 未建立有效页面状态**：新增 `product-selection-workbench.spec.ts` 在首个 legacy 场景中 `<main>` 为空，目的断言为 0；串行运行还出现未拦截 API 代理错误。必须先修正 route matcher、请求 query/分页响应和 fixture 契约，使页面正式标题先可见，再逐一证明 legacy read-only、return-pending、frozen 三状态中 generated purpose 恰好一条且状态说明仍可见。不得通过延长超时、删除状态或只断 fresh render 关闭此 finding。
6. **S2-BLOCK-006 相关 E2E 仍锁定旧标题**：S2 正式标题从权威投影收敛后，`cargo-ready`、`stuffing`、`customs`、`pickup`、`delivery`、`unloading` 和 `workbench-network` 相关 E2E 仍期待带“工作台”后缀的旧 H1，导致完整相关桌面套件失败。仅把这些页面身份断言改为 generated 正式 title 或准确新标题；不得全局替换侧栏 `navLabel`、内部局部标题或 S3 才处理的 shell 导航文案。修改后必须重跑完整相关桌面 E2E 列表并保持业务动作断言通过。

修复边界：不改 API、领域状态、权限、NPI 发布门、工作台业务动作或 S3 侧栏入口；不重排固定办理壳。完成后重跑 S2 全部单测、三项目 E2E、负责人指定的三个 E2E 文件单 worker、完整相关桌面 E2E、typecheck/lint/build/repo/format，并重新提交三视口证据供主代理人工复核。

## 业务步骤五面映射

| 业务步骤与岗位结果 | 岗位任务来源/状态                     | 相关数据事实子集                           | 技术保障                                | 权限边界                                | 界面承接                             | 验收证据/状态    |
| ------------------ | ------------------------------------- | ------------------------------------------ | --------------------------------------- | --------------------------------------- | ------------------------------------ | ---------------- |
| 识别工作台存在目的 | `08` 23 台结果；approved              | stable code、正式名称、业务目的            | build-time 生成、唯一 code、drift check | 公开展示已定目的；不表达动作授权        | 固定 PageHeader 一行目的             | S1/S2 待实现     |
| 进入正确业务入口   | foundation brief 与 WPN-D02；approved | route path、目录关系、当前角色演示投影     | 保留路由/深链；菜单来源仍为 route meta  | 菜单隐藏不代替服务端授权                | 侧栏入口层 → 业务工作台目录 → 专业页 | S3 待实现        |
| 在当前对象上办理   | 各台既有 brief/实现；本任务不改       | 当前责任、对象、状态、缺口、允许动作、回执 | 既有 API/状态机/幂等/冲突处理保持不变   | 既有 capability、租户、对象范围保持不变 | 目的下方继续现有固定办理壳           | 回归不变性待验证 |

### 相关数据事实子集（三轨）

| 轨道                 | 字段/事实                    | 对应业务步骤与消费者 | 当前证据/来源                       | 适用理由           | 收益           | 实施与维护成本    | 不采用风险             | 可逆性/退出方案      | 建议承载方式        | 决策 ID | 决策与实现状态     |
| -------------------- | ---------------------------- | -------------------- | ----------------------------------- | ------------------ | -------------- | ----------------- | ---------------------- | -------------------- | ------------------- | ------- | ------------------ |
| `current_physical`   | 23 台 code/title/result      | 页头与目录           | `08` 第三节；前端已有手工 catalog   | 已是正式业务范围   | 单一目的事实链 | 生成脚本与检查    | 文案持续漂移           | 删除生成消费即可回退 | 派生投影            | WPN-D01 | approved / pending |
| `current_physical`   | route path 与 nav meta       | 侧栏、目录、深链     | router/modules/workbench-network    | 技术入口事实       | 保留可达性     | 调整测试          | 删除入口或重复入口     | nav meta 可回滚      | 操作规则            | WPN-D02 | approved / pending |
| `approved_gap`       | 工作台目的固定、状态不得替换 | 23 台页面            | `UI_SYSTEM.md` 固定办理壳 + WPN-D03 | 保持岗位定位       | 降低误解和重复 | 统一 wrapper 接线 | 状态化文案继续覆盖目的 | 可逐页回滚           | 派生投影 + 界面规则 | WPN-D03 | approved / pending |
| `industry_candidate` | 基线中的详细损失/KPI/策略    | 后续各台产品设计     | 23 份 wisdom baseline               | 可能影响队列和动作 | 尚未统一评估   | 需要逐台样本/写回 | 错把候选当政策         | 不进入当前实现       | `undecided`         | none    | pending            |

## 23 台共同最低可用线影响

| 基线                                      | 本任务承接                             | 状态边界                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------ |
| `WB-B01` 岗位结果、主选择源、主动作       | 只统一展示已经正式确定的岗位结果       | 部分承接；不改变选择源或主动作 |
| `WB-B02` 上游交接、本岗新建、批量导入     | 不改                                   | 不适用                         |
| `WB-B03` 回退/重开、作废/归档、受限删除   | 不改                                   | 不适用                         |
| `WB-B04` 当前/下一责任、截止、等待原因    | 必须保持在目的下方现有上下文中可见     | 回归保障，不新增事实           |
| `WB-B05` 事实、缺口、异常、观测、同步分轨 | 不改                                   | 不适用                         |
| `WB-B06` 正常批量、异常逐条恢复           | 不改                                   | 不适用                         |
| `WB-B07` 不可变交接快照与版本             | 不改                                   | 不适用                         |
| `WB-B08` 结果与流动效率指标               | 不把目的文案冒充结果达成               | 防误声明                       |
| `WB-B09` AI 辅助边界                      | 不使用 AI 运行时生成工作台目的         | 静态已定投影                   |
| `WB-B10` 六类真实路径验收                 | 不因本任务完成宣称任何工作台 validated | 明确排除                       |

## 验收

- [ ] 23 个 stable code 均从正式业务权威生成且只对应一个正式名称和一行业务目的
- [ ] 生成 check 能在权威与生成物漂移、重复、缺失、未知 code 时非零失败
- [ ] 目录卡片和工作台页面消费同一目的投影，不再维护第二份 `roleResult` 或页面硬编码目的
- [ ] 23 台页面标题下恰好显示一条固定业务目的；空态、等待、失败、冲突、只读和完成状态不改变它
- [ ] 出运内部视图切换不替换整台工作台身份和目的
- [ ] planned 工作台显示目的和成熟度，但没有虚假队列或生产写动作
- [ ] 侧栏删除七个目录内重复工作台捷径和硬编码“工作区 / 已出运”范围块
- [ ] 侧栏仍保留“我的任务、业务工作台、岗位待办、干活、导入货柜”及角色原有非重复入口
- [ ] 全部 23 个 route、目录链接和深链仍可访问；菜单隐藏未被用作授权
- [ ] 页面原有责任、对象、事实缺口、动作、结果反馈和恢复入口未因页头接线丢失或重排
- [ ] `1440x900`、`1024x768`、`390x844` 真实截图和无横向溢出数据已生成并由主代理逐张人工核对
- [ ] 相关单测、E2E、Web lint/typecheck/build、repo/format 检查通过；最终 PR 候选按风险运行完整门禁
- [ ] 独立 Codex fresh 只读复审无未处置的当前范围 blocking finding
- [ ] 未把页面存在、目的可见或 CI 通过宣称为任一工作台业务闭环

## 工作台避坑检查

- [x] 首屏从岗位结果解释为什么存在，不从表、接口、字段或状态枚举生成文案
- [x] 业务目的来自正式权威；当前状态和动作仍来自各台真实运行事实
- [x] 目的文案不要求用户录入任何内部 ID 或重复事实
- [x] 本任务不改变待补/阻断语义
- [x] 目的保持固定，不产生第二选择源或第二主动作
- [x] 生命周期、完整度、异常和外部观测不并入目的文案
- [x] 本任务不新增待办或持久状态
- [x] 本任务不改变批量/逐条处理方式
- [x] 本任务不改变服务端回读、拒绝、失败或冲突处理

## 进度 log

| 日期       | 阶段    | 负责        | commit     | 说明                                                                                                                                       |
| ---------- | ------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-09 | design  | Claude Code | —          | 负责人批准推荐方案；建立独立 worktree，继承 23 台智慧基线并形成 S1/S2/S3 唯一实施 brief；等待书面规格复核                                  |
| 2026-10-10 | coding  | Claude Code | `d9254ac8` | 负责人批准规格与计划并要求不再重复确认；主代理写回 UI identity/navigation 规则，S1 切换为 Codex 唯一实现写入者。                           |
| 2026-10-10 | blocked | Claude Code | `23ae9684` | 转发实现会话实际为 Claude Opus 4.8，按 AGENTS 角色映射在写入前阻断；工作树无产品差异，等待实际 GPT-5.6 Codex 从同一 base 接续。            |
| 2026-10-10 | fix     | Claude Code | `bf2aadd6` | 收到实际 S1 差异并通过定向门禁；验收发现 planned 页仍读已移除的 `roleResult`、legacy 源仍手写 identity，进入 S1F1 根因修复。               |
| 2026-10-10 | blocked | Claude Code | `7965c2dd` | S1 主体形成 WIP checkpoint；planned 定向测试稳定失败，S1F1 转发会话仍为 Claude，等待实际 GPT-5.6 Codex 从干净 WIP 基线接续。               |
| 2026-10-10 | review  | Claude Code | `0daf6087` | S1F1 消除 planned 数据源断链和 legacy 手写 identity；生成/仓库 75/75、Web 全套 148 文件/700 测试及 lint/typecheck/format/repo check 通过。 |
| 2026-10-10 | coding  | Claude Code | —          | NPI A1 已经 PR #151 合并且必需 CI 全绿；S2 前置解除，开始同步最新 `main` 并保护非 MP 发布门行为。                                          |
