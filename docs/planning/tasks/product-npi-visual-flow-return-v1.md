---
status: coding
branch: feat/product-npi-non-mp-release-hard-stop
verification: "E1 merged via PR #150 at 6b034955; A1 pending"
owner: main
writer: codex
risk: high
dependsOn:
  - product-selection-applicable-risk-assessment-v1
writeScopes:
  - docs/planning/tasks/product-npi-visual-flow-return-v1.md
  - apps/api/src/modules/product-selection/domain/product-definition.ts
  - apps/api/src/modules/product-selection/domain/product-definition.test.ts
  - apps/api/src/modules/product-selection/domain/product-initiative-npi-return.ts
  - apps/api/src/modules/product-selection/domain/product-initiative-npi-return.test.ts
  - apps/api/src/modules/product-selection/domain/product-initiative.repository.ts
  - apps/api/src/modules/product-selection/application/return-product-initiative-from-npi.service.ts
  - apps/api/src/modules/product-selection/application/product-npi.services.test.ts
  - apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/web/src/composables/useProductNpiWorkbench.ts
  - apps/web/src/composables/useProductNpiWorkbench.test.ts
  - apps/web/src/composables/useProductInitiativeDecision.ts
  - apps/web/src/composables/useProductInitiativeDecision.test.ts
  - apps/web/src/components/product-npi/ProductNpiReturnAction.vue
  - apps/web/src/components/product-npi/ProductDefinitionAdvancePanel.vue
  - apps/web/src/components/product-npi/ProductDefinitionAdvancePanel.test.ts
  - apps/web/src/views/ProductNpiWorkbench.vue
  - apps/web/src/views/ProductNpiWorkbench.test.ts
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/e2e/product-npi-workbench.spec.ts
  - apps/web/e2e/workbench-network.spec.ts
exclusiveLocks:
  - business-policy:product-npi-return-redecision
  - business-policy:product-npi-release-gate
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/产品开发与NPI工作台.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
uiStructure:
  - 保持选品与 NPI 既有固定办理壳；A1 只在当前阶段事实和动作区纠正发布入口，不重排工作台
uiMustStayVisible:
  - 当前 NPI 阶段、规格与合规缺口、服务端拒绝原因、允许的阶段动作和退回选品入口
uiProgressiveDisclosure:
  - 非 MP 阶段不提供发布动作；历史旧交接与旧领取记录只读展开，不占据当前办理主线
uiForbidden:
  - 覆盖旧快照、原地复活旧 handoff、复制第二套立项结论、把到达 MP 冒充 MP 已通过、扩写完整五阶段 NPI
uiViewportEvidence:
  - 1440x900：非 MP 阶段无发布主动作，当前阶段和可执行动作清晰，无横向溢出
  - 1024x768：阶段事实、现有门槛和允许动作可达，动作不遮挡
  - 390x844：当前阶段 → 现有缺口 → 允许动作 → 拒绝或成功回执顺序连续，无页面级横向溢出
---

# 任务：产品开发与 NPI 五阶段工作闭环

> 本文件是 NPI 闭环的唯一活动实现 brief，吸收原“视觉动线、齐/半/缺与退回选品”范围，
> 不另建第三份 NPI 业务规格。业务目标、阶段交付和门槛只认
> [岗位工作台第五节](../../../doc/cross-border-supply-chain/08-role-workbenches.md#五产品开发与-npi-工作台product_npi)。
> 已完成的 `product-npi-intake-v1` 和 `product-definition-npi-release-v1` 只证明历史 V1
> 实现及当时验证，不证明当前五阶段闭环已经完成。

## 智慧开启基线

本任务恢复实现前已先读取 `wisdom-baseline/README.md`、`全局.md`、
`产品开发与NPI工作台.md`，并把 `选品立项.md` 仅作为跨台退回与再交接参考。
基线不是业务权威；实现只采用已经由负责人确认且已写回正式业务权威的内容。

| 基线结论                                                        | 处置             | 本任务依据与边界                                                                           |
| --------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `F1` 增量投资决策台                                             | 沿用             | 正式权威已把岗位结果写为重大投入扩大前作继续、返工、暂停或终止决定；阶段完整度不是产品目标 |
| `OWN1` 单一结果负责人 + 专业任务负责人                          | 沿用方向         | A1 不改组织或权限映射；现有身份与授权继续生效                                              |
| `INV1` 项目级重大承诺前作决定                                   | 沿用             | 后续主流程必须围绕真实承诺事件，不按 EVT/DVT/PVT/MP 名称机械制造投资门                     |
| `DEC1` 结果负责人建议、资源负责人批准                           | 存疑             | 正式权威尚未完整落定组织映射；A1 不实现该政策                                              |
| `MET1` / `MEAS1` 晚发现实际损失                                 | 沿用为结果方向   | A1 只阻断已证实的过早发布，不新增指标模型                                                  |
| `SAMP1` 两个真实或脱敏对照项目                                  | 沿用为新设计门禁 | 缺样本阻止新的字段、状态、契约、算法和 UI 设计，不阻止按现行权威修复缺陷                   |
| 前半段 `B/T1/G1/I1/C1/E1/P1/H1/M1/W1/O1` 与 `V1`～`L1` 细化方案 | 修正为历史候选   | 未经真实样本与正式权威再确认，不作为 A1 或后续自动扩建依据                                 |
| 非 MP 或 MP 未通过仍可发布                                      | 与权威冲突       | 正式权威明确禁止；A1 先修复“非 MP 可发布”这一无需新增事实即可判定的缺陷                    |
| 到达 MP 即视为 MP 通过                                          | 禁止             | 当前没有可信的 MP 通过事实；A1 不把自由文本结论或阶段值冒充通过决定                        |

因此当前不自动执行旧方案中的完整 A→B→C→D 平台扩建。先以 A1 停止非 MP
越级发布并跑通现有主路径；其后只从 `F1 → 重大承诺 → 投资决定 → 结果回执`
选择经真实样本证明必要的下一薄片。

## 目标

让产品负责人从选品概念交接开始，在一个岗位工作台内完成 EVT、DVT、PVT、MP 的
计划、验证、证据、问题、决定和交接；MP 通过后才允许“发布并交主数据建档”。

阶段名不是完成标准。每一阶段必须有结构化交付物、有效证据、问题责任、门槛决定、
不可变快照和返工恢复路径。系统负责验证完整性和允许动作，人员负责业务判断。

## 权威来源与本轮边界

| 类型           | 权威来源                                                       | 本任务如何使用                                 |
| -------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| 业务流程和门槛 | `doc/cross-border-supply-chain/08-role-workbenches.md` 第五节  | 决定各阶段要完成什么、怎样返工和何时发布       |
| 共同工作台要求 | 同文件 `WB-B01`～`WB-B10`                                      | 决定主动作、责任、分轨、交接、AI 和验收        |
| 技术实现约束   | `docs/product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md`         | 将业务决定映射为服务端动作、UI 和测试          |
| 共享契约权威   | `packages/contracts/schemas/v1/product-definition.schema.json` | 当前 V1 事实来源；新语义必须版本化、生成并校验 |
| 当前运行事实   | product-selection 模块、Vue NPI 工作台、Prisma 和测试          | 只描述已实现状态，不反推业务政策               |

本任务包含五阶段闭环、DVT 后变更控制、NPI 退回选品、MP 发布门槛和主数据交接。
不包含主数据建档内部流程、实验室或工厂系统建设、完整 PLM/MES/QMS 替代，也不把
产品特定的样机数、良率或认证项目写成全局固定值。

## 当前技术事实

### 已实现

- NPI 待办队列、领取、租户隔离、乐观锁和幂等写已有历史验证。
- 页面已有“概念 → EVT → DVT → PVT → MP”阶段轨；概念来自立项目标的只读投影。
- 产品定义保存通用规格、合规假设和阶段结论；发布会冻结现有定义快照并交主数据。
- `stageOutcomes` 追加保存历史结论，没有覆盖旧记录。
- 本地工作树有 NPI 退回选品的 API、迁移、契约和 Vue 未提交 WIP；必须原样协同，不能覆盖或把它冒充已验证结果。

### 已证实的严重差距

1. `NpiStageOutcomeV1` 只有阶段、自由文本结论和证据引用，没有阶段计划、交付物、决定、问题、责任或冻结信息。
2. 领域规则只检查当前阶段是否写过结论；一句话即可从 EVT 推到 DVT，不能证明完成任何验证闭环。
3. `prepareProductDefinitionRelease()` 只检查规格和合规假设；当前不要求位于 MP，也不要求 MP 通过。
4. 页面让所有阶段共用同一规格、合规假设和结论输入框，发布区在各阶段都出现。
5. “齐/半/缺”只由自由文本和证据数量推导，无法说明具体缺口，也不能作为阶段门槛。
6. DVT 后没有设计冻结、变更原因、影响评估、回开阶段和再验证规则。
7. 没有结构化阻断问题、当前和下一责任人、截止时间、等待原因或外部结果采信状态。
8. PVT 批次是否可售、MP 爬坡是否稳定和发布后版本关系都没有可执行规则。

因此当前页面只能称为阶段展示和 V1 记录工具，不能称为 NPI 闭环。

## 业务步骤到实现的强制映射

| 业务步骤与岗位结果 | 界面必须提供                                   | 服务端允许动作                         | 权威事实与保存方式                             |
| ------------------ | ---------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| 接受概念交接       | 立项快照、待补、来源、版本、发送和接收责任     | 领取、接受；缺口待补；实质问题退回选品 | 原立项交接不可变；接受或退回事实追加保存       |
| 制定本阶段计划     | 当前阶段适用交付物、门槛、责任、期限和证据要求 | 建立或修订阶段计划；开始后修订须留原因 | 阶段计划版本化；产品级数值门槛不写入全局代码   |
| 登记验证结果       | 受控样机或批次、测试项、结果、来源和版本       | 批量预检后登记；逐条处理错误和冲突     | 外部观测与已采信事实分开；来源和发生时间可追溯 |
| 处理问题           | 严重度、阻断性、责任人、期限、处置和再验证     | 新建、分派、处置、驳回处置、关闭或重开 | 问题历史追加；关闭必须有关联处置和再验证证据   |
| 提交阶段评审       | 交付物状态、证据、开放问题、具体缺口和影响     | 通过、返工、暂停或终止；服务端检查门槛 | 决定人和时间可信；通过产生不可变阶段快照       |
| DVT 后变更         | 冻结版本、变更原因、影响对象、再验证范围       | 提交变更、批准或拒绝、回开受影响阶段   | 变更和影响评估版本化；旧基线与旧快照不改写     |
| 返工与恢复         | 原失败、当前责任、恢复条件和新版结果           | 回开、补证、再验证、重新提交评审       | 记录从哪个阶段版本回开以及重新通过版本         |
| MP 后发布          | 可发布版本、MP 决定、全部阻断和交接预览        | 仅 MP 通过后发布；暂缓或终止另行决定   | 同一事务写发布版本和不可变主数据交接快照       |
| 主数据退回待补     | 接收方反馈、缺口、责任和原发布版本             | 补齐并发布新版本；不得修改已发送快照   | 新旧发布版本可追溯，接收和同步状态分轨         |

## 目标领域模型

### 阶段状态与决定

- 阶段顺序继续使用稳定 wire value：`evt → dvt → pvt → mp`。
- `concept` 只投影选品交接和 NPI 接受事实，不加入可编辑 NPI 阶段枚举，避免复制概念权威。
- 工作状态固定区分未开始、进行中、等待、待评审和已通过；它与阶段决定和发布终态分轨。
- 阶段决定固定为通过、返工、暂停、终止；只有通过能够进入下一阶段。
- 历史阶段快照单向追加；受控回开改变当前工作阶段，但不能删除或改写旧快照。

### 需要可靠保存的对象

1. 阶段计划版本：适用交付物、产品级门槛、责任和期限。
2. 阶段交付物：稳定 code、适用性、状态、证据引用和完成责任。
3. 验证结果：受控样机或批次、测试项、结果、来源、执行人与时间。
4. 问题登记：严重度、是否阻断、责任人、期限、处置、再验证和状态历史。
5. 阶段评审：决定、结论、决定人、版本和不可变快照。
6. 变更请求：冻结基线、原因、影响分析、批准、回开阶段和再验证范围。
7. 发布与交接：发布版本、MP 通过快照、发送方、接收队列、待补和同步状态。

`stageOutcomes` 可继续作为历史 V1 只读数据，但旧自由文本结论不得自动升级为新阶段通过。
需要参与队列排序、责任、期限、并发更新和恢复的阶段事项、问题与变更不能只塞入一个
无约束 JSON；不可变阶段快照和发布快照可以使用结构化 JSON 保存当时全貌。

## 契约与兼容策略

这是公共契约和业务语义变化，分类为 **行为变化且对旧写客户端不兼容**：旧客户端即使
结构合法，也无法提交新门槛所需信息。实施必须遵循以下策略：

1. JSON Schema 仍是共享类型的单一权威，禁止在 API 和 Web 各手写一份阶段清单。
2. 保留 V1 历史读取；新增 V2 阶段计划、交付物、问题、评审、变更和发布命令。已知写消费者在同一发布中迁移，V1 写路径不得继续绕过新门槛。
3. 不改变 `evt/dvt/pvt/mp` 既有 wire value，不把 `concept` 塞进当前存量字段。
4. 新发布命令必须由服务端拒绝“非 MP、MP 未通过、阻断未关闭、版本冲突和未授权”。
5. 数据映射显式区分实体、公共 DTO 和不可变快照；API 返回服务端计算的具体缺口和允许动作。
6. 同一改动生成 `contracts.d.ts`，运行 schema 校验和 drift 检查，并覆盖 API 与 Web 消费者。

## 技术取舍

| 决策     | 采用方案与理由                                                                      | 成本                              | 收益                                         | 未采用方案及代价                                       |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| 契约演进 | 新增 V2 写契约，V1 历史只读；新门槛无法由 V1 载荷表达                               | 同期修改 API、Web、测试和生成类型 | 不静默重解释旧数据，旧结论不会误升为通过     | 给 V1 加可选字段改动小，但旧客户端仍能绕过门槛         |
| 数据保存 | 可查询、会变化的计划、问题、责任和变更使用受约束记录；阶段与发布快照使用结构化 JSON | 增加迁移、映射和集成测试          | 队列、期限、并发和审计可靠，同时保留当时全貌 | 全塞 JSON 初期快，但约束、查询、恢复和并发会形成技术债 |
| 页面结构 | 一个稳定 NPI 工作区按当前阶段换内容                                                 | 需要阶段模板和可复用组件          | 用户不用在五套页面间找资料，规则也不重复     | 每阶段独立页面直观但会复制动作、权限和状态判断         |
| 数值门槛 | 全局提供门槛类型，具体值由项目在阶段开始前批准                                      | 需要计划配置与审批记录            | 适应不同品类、市场和风险，不伪造行业统一数字 | 硬编码样机数或良率更快，但会错误放行或阻断产品         |
| 推进判断 | 服务端计算缺口和允许动作，前端只呈现                                                | API 读模型更完整                  | 多端一致，不能靠改前端绕过阶段门             | 前端判断开发快，但不是安全或业务边界                   |

## 界面结构

### 队列

- 主选择源只有 NPI 项目队列，默认按阻断风险、截止时间和等待时长排序。
- 列表直接显示当前阶段、当前主动作、首要缺口、当前责任人、下一责任人、截止时间和等待原因。
- 分组至少能区分可执行、等待外部、待评审、返工、冲突和已结束；不能按颜色或百分比让用户猜。

### 当前项目

1. 顶部：立项目标、当前阶段、冻结级别、责任与期限、当前唯一主动作。
2. 阶段轨：只作导航和摘要；已通过阶段打开不可变快照，未来阶段显示计划和前置缺口。
3. 当前阶段工作区：交付物、证据、问题和门槛决定，按“先补哪个缺口”组织。
4. 变更区：DVT 起始终可见当前冻结基线和受控变更入口。
5. 活动与交接：人员决定、外部观测、同步结果和 AI 建议分轨显示。
6. 底部动作条：一个主动作；退回、暂停、终止或回开为次要动作并先显示影响。

原“齐/半/缺”可保留为非门槛摘要，但必须由结构化交付物计算，并同时给出具体缺口；
不得再按“一段文字 + 一个附件”显示为齐。禁止阶段百分比。

## A1：非 MP 发布硬阻断（当前切片）

### 业务结果与边界

当前运行实现允许在 EVT、DVT、PVT 发布，与正式权威直接冲突。本片只关闭这条已证实的
越级发布路径，使产品/NPI 结果负责人必须先走到 MP，才可能进入现有发布准备；它不把
“到达 MP”解释成“MP 已通过”，也不新增尚无可信事实承载的 MP 通过模型。

### 五面承接

| 面       | 当前切片承接                                                                  |
| -------- | ----------------------------------------------------------------------------- |
| 岗位任务 | 非 MP 阶段只能处理当前阶段或退回，不得误把未完成验证的产品发布给主数据        |
| 数据事实 | 只读取现有 `npiStage`；不制造 MP 通过、证据完整或阻断已关闭事实               |
| 前端 UI  | EVT/DVT/PVT 不呈现发布动作；当前阶段、现有规格/合规缺口和允许动作继续可见     |
| 技术底层 | 领域发布准备函数默认拒绝非 MP；直接 API 调用不能绕过；稳定错误写入回归测试    |
| 权限边界 | 保留现有服务端 capability、租户和对象范围；阶段门是领域业务前置，不与授权混合 |

### 明确不做

- 不新增 Schema、迁移、公共契约或阶段决定状态。
- 不把 `npiStage === mp`、自由文本结论或证据数量冒充 MP 已通过。
- 不建设完整阶段计划、交付物、问题、冻结、变更或通用控制面。
- 不修改选品、主数据、寻源及跨台交接政策。
- 不更换固定办理壳，不把页面改造成字段卡墙或通用后台。

### 测试先行与验收反证

1. 先以领域回归测试证明 EVT、DVT、PVT 当前错误地允许发布；实现后均返回稳定拒绝。
2. MP 仍进入既有规格和合规假设门槛；测试不得断言到达 MP 即代表 MP 已通过。
3. 组件测试证明非 MP 没有发布动作，MP 仍按既有缺口呈现。
4. 原“DVT 直接发布成功”E2E 改为反证，再推进到 MP 验证现有主路径可继续。
5. 三视口按 frontmatter 的 `uiViewportEvidence` 截图并人工核对；测试文字或 bounding box 不替代视觉判断。

### 切片顺序

`A1a 失败回归 → A1b 最小领域门 → A1c UI/E2E 主流程 → 主代理验收 → fresh Codex 独立复审 → 最终门禁/PR`。

## 实施切片

### A. 先锁住错误推进

- 先写领域回归测试：一句结论不能推进；非 MP 不能发布；MP 未通过不能发布；阻断未关闭不能推进。
- 新 V2 契约、服务端缺口和允许动作投影；V1 历史只读兼容。
- 加法迁移建立阶段计划、交付物、问题和评审的可靠存储及必要索引与约束。

### B. EVT 到 MP 阶段工作区

- 服务端按阶段模板实例化适用交付物，但产品级数值门槛由有权限人员在阶段开始前确认。
- Web 新建阶段工作区和问题登记，不继续把所有职责塞进 `ProductDefinitionAdvancePanel`。
- 正常结果支持批量预检，异常、冲突和阶段决定逐条处理。

### C. 冻结、变更和回开

- DVT 形成设计冻结版本；之后修改规格必须提交原因和影响评估。
- 变更决定回开到受影响的最早阶段，保留旧快照并产生新版本。
- 覆盖并发、重放、拒绝、再验证和重新通过。

### D. MP 发布和主数据交接

- 发布入口只在 MP 通过后出现并由服务端再次校验。
- 发布与不可变交接同一事务；重复请求幂等，版本冲突明确失败。
- 主数据待补通过新版本恢复，不反写旧交接。

### E. 退回选品与现有 WIP 收口

- 审查并保留本地退回实现的正确部分；理由必填、同事务回推选品队列、旧交接可审计。
- 解决 `returned_from_npi` 生成类型与 Web 消费者的一致性，不手改生成文件掩盖 drift。
- 联合选品完成退回、重判、重新交接和 NPI 重新接受的端到端路径。

### E1. 先跑通 NPI 退回后的再交接

- NPI 当前领取人填写原因退回；理由、责任和旧 handoff 保持可审计。
- 选品在同一立项记录上看到退回原因并重新办理，不把 NPI 退回误当成退回市场。
- 选品再次通过现有投资门时追加新 handoff；新 handoff ID/version 与旧版不同，旧快照不变。
- NPI 队列只把当前新版作为待领取事项，旧版保留只读审计但不重复进入待办；队列查询、按 ID 读取和领取都必须校验 `handoff.version === initiative.version`，不能只看 initiative 当前去向；集成测试须在再立项后直接对旧 handoff 执行读取和领取并证明拒绝。
- 真实 PostgreSQL 集成和三视口 E2E 跑通 `退回 → 重判 → 新 handoff → NPI 新版待办`。
- 本片只先跑通，不要求 NPI 显式“重新接受”回执，不扩写 EVT～MP 五阶段结构。

### E1F1. 跑通浏览器回程并修复移动回执

- `E1-BLOCK-001 accepted`：同一条三视口 E2E 必须先在 NPI 退回，再进入选品工作台读取退回原因、执行现有重判/再次立项动作，最后回到 NPI 工作台看到新 handoff；禁止在 return mock 中直接把队列切成新版冒充重判。
- E2E 可继续使用当前仓库的全链 mock，但 mock 必须承接真实页面请求与命令：选品页面提交成功后才创建新版 handoff，并断言请求体经过现有严格投资门；不要求本片把浏览器接入真实 PostgreSQL。
- `E1-BLOCK-002 accepted`：移动端截图必须清楚显示退回回执/原因；若 receipt 被固定壳裁切，最小修复页面反馈布局，不改变业务状态或设计系统。
- 三视口重新生成 `NPI 退回 → 选品重判 → NPI 新版待办` 证据，人工核对回执、原因、新旧版本和无横向溢出。

- [ ] 概念只读承接选品权威，缺口可待补，实质问题可退回并以新版本重新交接
- [ ] EVT、DVT、PVT、MP 各自具备计划、交付物、证据、问题、决定和不可变阶段快照
- [ ] 只写自由文本结论不能推进；具体缺口、责任人、期限和恢复方式可见
- [ ] 阻断问题未关闭、门槛未满足或评审未通过时，服务端拒绝前进
- [ ] DVT 后规格变化必须走变更、影响评估、回开和再验证，旧冻结版本不被覆盖
- [ ] PVT 批次是否可售使用独立放行事实，不因阶段完成自动变成库存
- [ ] 发布只在 MP 已通过时允许；发布不是第六阶段
- [ ] 发布同事务形成不可变主数据交接，接收方待补通过新发布版本恢复
- [ ] 阶段轨不以标题、颜色、齐半缺或百分比冒充阶段闭环
- [ ] AI 不生成测试事实、不关闭问题、不决定阶段、不确认责任、不执行发布
- [ ] V1 历史可读，V2 契约生成和消费者一致，旧结论不自动升级为通过
- [ ] 正常、等待、拒绝、冲突、返工、恢复以及 DVT 后变更、PVT 失败、MP 禁止发布均由真实或脱敏样本验收
- [ ] 契约、迁移、授权、领域、API、Web、真实 PostgreSQL 集成和关键 E2E 按高风险门禁通过

## 验证计划

实现时由窄到宽执行：

1. product-definition 领域测试及新增阶段门、问题、变更测试。
2. product-selection 应用和控制器测试；授权、幂等、版本冲突和租户隔离。
3. `pnpm contract:generate`、`pnpm contract:check`、`pnpm contract:drift`。
4. Web 数据与组件测试、类型检查、相关构建和 NPI E2E。
5. 启动本地 PostgreSQL 后运行相关集成测试、迁移空库和旧库升级验证。
6. 高风险完整门禁 `pnpm validate`；任何环境阻断或失败如实记录。

## 进度 log

| 日期       | 阶段    | 负责        | commit     | 说明                                                                                                                                                                                                                             |
| ---------- | ------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | design  | —           | —          | 原视觉动线与退回 brief 建立                                                                                                                                                                                                      |
| 2026-09-29 | coding  | Cursor      | —          | 阶段轨和退回写路径产生本地 WIP                                                                                                                                                                                                   |
| 2026-09-29 | blocked | Codex       | —          | 负责人曾将寻源规格缺口调整为第一优先，WIP 原样保留                                                                                                                                                                               |
| 2026-09-29 | design  | Codex       | —          | 负责人重新聚焦 NPI；扩展为五阶段业务闭环，完成现状与技术差距审查                                                                                                                                                                 |
| 2026-09-29 | blocked | Codex       | —          | 共享控制面和默认拒绝授权定案前暂停实现；本地退回 WIP 保留                                                                                                                                                                        |
| 2026-10-09 | fix     | Claude Code | —          | E1a 验收：退回期间旧 handoff 已隐藏且不可领取，但再立项后旧、新两个 handoff 同时回到 NPI 队列；PostgreSQL 反证为 expected 1 / received 2，继续收窄修复当前版本过滤。                                                             |
| 2026-10-09 | review  | Claude Code | —          | E1 当前版本过滤已覆盖队列、按 ID 读取和领取；PostgreSQL 37/37、API unit 14/14、API/Web typecheck/lint、三视口 E2E 3/3 与人工截图通过，进入独立复审。                                                                             |
| 2026-10-09 | fix     | Claude Code | —          | 独立复审接受 E1-BLOCK-001/002：浏览器用例必须实际经过选品重判再生成新 handoff；移动端必须完整显示退回回执与原因，不以 mock 队列切换或裁切截图冒充通过。                                                                          |
| 2026-10-09 | review  | Claude Code | —          | E1F1 已让三视口浏览器实际经过 NPI 退回、选品重判/approve 和新版 NPI 待办；E2E 9/9，移动回执可读，定向单测/typecheck/lint/format/diff 通过。                                                                                      |
| 2026-10-09 | review  | Codex       | —          | fresh GPT-5.6 scoped re-review：E1-BLOCK-001/002 均已关闭，`verdict: pass`、`findings: []`、`writes: none`；窄屏标题紧凑仅为非阻塞观察。                                                                                         |
| 2026-10-09 | review  | Claude Code | `6b034955` | E1/E1F1 经 PR #150 合入 `main`；CI `changes/static/unit/build/e2e/quality` 成功，dictionary/security 按变更规则跳过。此证据只关闭 E1，不关闭整份 NPI brief。                                                                     |
| 2026-10-09 | coding  | Claude Code | —          | 恢复前补读 NPI 智慧基线：F1/OWN1/INV1 等当前有效结论已登记，旧完整控制台细化降为候选；启动 A1，只修复非 MP 可发布的权威冲突。                                                                                                    |
| 2026-10-09 | coding  | Codex       | —          | A1 实现：服务端发布准备拒绝 EVT/DVT/PVT，Web 仅在 MP 显示发布按钮；领域、应用、控制器、组件回归与类型/lint/format 通过。NPI Playwright 因 5173 已被非测试 Logix 进程占用未运行，待主代理在可控服务器环境复核。                   |
| 2026-10-10 | review  | Codex       | —          | fresh GPT-5.6 scoped review：`verdict: pass`、`findings: []`、`writes: none`；记录 release mock 未模拟非 MP API 拒绝和当轮未生成新三视口截图两项验证缺口。                                                                       |
| 2026-10-10 | review  | Claude Code | —          | A1 验收：可控 5173/5174 测试服务器下 NPI Playwright 三视口 9/9；补充 DVT 发布隐藏、暂缓/终止、退回选品和 MP 发布动作的定向截图并人工核对，无页面级或内容区横向溢出。                                                             |
| 2026-10-10 | review  | Claude Code | —          | A1 最终门禁：完整 `validate` 仅因 `apps/ai-service/.pytest_cache` 的既知 EPERM 在全仓 `format:check` 中断；A1 定向格式通过，API/Web 单测 1478/701、PostgreSQL 集成 195、E2E 175 通过（7 跳过），全仓 typecheck/lint/build 通过。 |
