---
status: coding
branch: feat/recoverable-work-sessions-v1
verification: not-run
owner: main
writer: main
risk: high
dependsOn:
  - universal-workbench-layout-standard-v1
  - mainline-priority-confirmation-v1
writeScopes:
  - docs/planning/tasks/recoverable-work-sessions-v1.md
  - docs/superpowers/plans/2026-10-14-recoverable-work-sessions.md
  - docs/product/UI_SYSTEM.md
  - packages/contracts/schemas/v1/work-session.schema.json
  - packages/contracts/schemas/v1/product-initiative.schema.json
  - packages/contracts/schemas/v1/index.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - scripts/generate-contracts.mjs
  - database/schema.prisma
  - database/migrations/20261014120000_add_recoverable_work_sessions/migration.sql
  - database/dictionary/dictionary.annotations.json
  - database/dictionary/DATA_DICTIONARY.generated.md
  - database/dictionary/NATIVE_OBJECTS.generated.md
  - apps/api/src/app.module.ts
  - apps/api/src/modules/identity/domain/role-capabilities.ts
  - apps/api/src/modules/identity/domain/role-capabilities.test.ts
  - apps/api/src/modules/work-session/**
  - apps/api/src/modules/product-selection/product-selection.module.ts
  - apps/api/src/modules/product-selection/presentation/product-initiatives.controller.ts
  - apps/api/src/modules/product-selection/presentation/product-initiative.dto.ts
  - apps/api/src/modules/product-selection/presentation/product-initiative-draft.controller.test.ts
  - apps/api/src/modules/product-selection/application/save-product-initiative-draft.service.ts
  - apps/api/src/modules/product-selection/application/product-initiative-draft.services.test.ts
  - apps/api/src/modules/product-selection/domain/product-initiative-draft.ts
  - apps/api/src/modules/product-selection/domain/product-initiative-draft.test.ts
  - apps/api/src/modules/product-selection/domain/product-initiative-draft.repository.ts
  - apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative-draft.repository.ts
  - apps/api/src/modules/product-selection/infrastructure/prisma-product-initiative.repository.ts
  - apps/api/src/modules/product-selection/application/get-product-initiative.service.ts
  - apps/api/src/modules/product-selection/application/decide-product-initiative.service.ts
  - apps/api/src/infrastructure/integration/work-session.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts
  - apps/api/src/infrastructure/integration/product-initiative-migration-upgrade.integration.test.ts
  - apps/web/src/api/workSessions.ts
  - apps/web/src/api/workSessions.test.ts
  - apps/web/src/api/marketSignals.ts
  - apps/web/src/api/marketSignals.test.ts
  - apps/web/src/work-session/**
  - apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue
  - apps/web/src/components/workbench/WorkbenchSessionSwitcher.test.ts
  - apps/web/src/components/workbench/RoleWorkbenchFrame.vue
  - apps/web/src/components/workbench/RoleWorkbenchFrame.test.ts
  - apps/web/src/views/ProductSelectionWorkbench.vue
  - apps/web/src/views/ProductSelectionWorkbench.test.ts
  - apps/web/src/composables/useProductInitiativeDecision.ts
  - apps/web/src/composables/useProductInitiativeDecision.test.ts
  - apps/web/src/views/StuffingWorkbench.vue
  - apps/web/src/views/StuffingWorkbench.test.ts
  - apps/web/src/components/stuffing/StuffingActionPanel.vue
  - apps/web/src/components/stuffing/StuffingSnapshotForm.vue
  - apps/web/src/components/stuffing/StuffingSnapshotForm.test.ts
  - apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.vue
  - apps/web/src/reference/universal-workbench/UniversalWorkbenchReferenceView.test.ts
  - apps/web/src/reference/universal-workbench/referenceScenarios.ts
  - apps/web/e2e/recoverable-work-sessions.spec.ts
  - apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots/**
  - apps/web/e2e/support/recoverableWorkSessions.ts
exclusiveLocks:
  - database-schema
  - database-migrations
  - database-dictionary
  - public-contract:work-session-v1
  - public-contract:product-initiative-v1
  - generated:contracts
  - authz-control-plane
  - ui-pattern:workbench-session-v1
  - visual-baseline:workbench-session-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/选品立项.md
  - doc/cross-border-supply-chain/wisdom-baseline/装箱.md
  - docs/product/UI_SYSTEM.md
  - docs/product/ROLE_WORKBENCH_HUMAN_CENTERED_DESIGN.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - docs/planning/tasks/universal-workbench-layout-standard-v1.md
  - docs/planning/tasks/mainline-priority-confirmation-v1.md
uiStructure:
  - PageHeader 保持岗位类别、正式工作台名称和唯一业务目的；右侧新增“切换”入口，菜单只列当前用户自己的受控工作会话
  - PageHeader 下仍依次保留责任上下文、决策条、左队列 + 中详情 + 右动态上下文；会话状态不得替代业务状态或改变栏位
  - 切换前先在当前右栏处理未保存输入，再重新授权并重读目标对象，版本校验成功后才迁移唯一“当前”并导航
  - 1440x900 保持三栏与切换浮层；1024x768 保持左窄轨及中右并列；390x844 保持队列 → 详情 → 编辑分屏且切换器为不遮挡正文的移动面板
uiMustStayVisible:
  - 当前工作台、当前对象、业务责任、期限或等待原因，以及唯一当前工作会话标识
  - 当前会话是待续办、领域草稿已保存、仅浏览器保留现场、冲突或已关闭；状态须用文字表达
  - 未保存输入的处置选项、保存失败原因、目标无权/不存在/版本冲突和继续留在当前页的恢复入口
  - 切换后的服务端版本、正式领域回执和责任去向；不得用“已切换”冒充领域事实已经保存
uiProgressiveDisclosure:
  - 会话列表、最近打开时间、工作台与对象摘要进入 PageHeader 切换浮层
  - 非当前会话的受控 RouteContext、领域 draftRef/versionSeen 和 UI 锚点详情按需展开，不常驻挤占办理主线
  - 左右折叠、移动分屏、滚动与焦点属于个人界面偏好，可在当前标签页恢复，不进入业务事实
  - 已关闭会话可从默认列表收拢，但关闭原因和重新打开边界仍可检查
uiForbidden:
  - 万能业务草稿 JSON、任意 Vue 状态、自由 URL、Token、证据正文、PII 或前端推断权限进入 WorkSession
  - 把暂停/关闭工作会话等同任务 defer、block、wait、partial、完成、释放 claim、转移责任或暂停 SLA
  - 未经领域正式保存就显示“草稿已保存”，或在装箱无草稿能力时提供伪保存动作
  - 先移动当前标识再授权/重读目标，切换失败后出现两个当前、无当前或页面已变但服务端未变
  - 一次迁移 23 台、复用 OpsAssistantSession、建设任务档案/聊天/AI/更多功能或改变现有主题和业务规则
uiViewportEvidence:
  - 1440x900：选品与装箱真实页面的 PageHeader 可打开切换器；三栏、责任带和主动作保持；切换/冲突/恢复无横向溢出
  - 1024x768：切换器不覆盖当前结论和主动作；左栏保持窄轨/抽屉，中栏与右栏仍并列，保存失败后当前现场不移动
  - 390x844：切换面板可键盘/触屏关闭；未保存处置、目标冲突和恢复动作不被底部动作或系统键盘遮挡；返回后恢复对象、事项、滚动和焦点
---

# 任务：可恢复工作会话 V1

## 路线图位置与岗位结果

- **位置**：通用办理型工作台 UI 标准单元二；单元一已由 PR #167 合入，本单元完成后才允许启动任务全程档案。
- **目标岗位**：需要在多个工作台或任务之间切换、暂停个人办理现场，并在刷新、换设备或跨班次后继续工作的业务岗位。
- **核心结果**：岗位能安全保留并恢复“工作台 → 对象 → 事项 → 右栏模式”的个人现场；恢复前系统重新授权、重读领域事实并比较版本，不能让陈旧按钮或本地状态冒充仍可执行。
- **优先减少的损失**：未保存输入丢失；反复寻找任务与编辑位置；旧版本覆盖新事实；把暂停界面误作暂停业务责任或 SLA。
- **当前消费者**：
  1. `product_selection`：首个有正式服务端领域草稿的消费者；补一个不改变业务去向的中性、类型化草稿保存动作。
  2. `stuffing`：首个无通用草稿、保存即写正式装箱快照的边界消费者；dirty 时只允许放弃、留下或在新标签页保留内存现场，不伪造“已保存”。

## 当前事实与缺口

1. `WorkbenchPageHeader` 已有 `switcher` slot；生产页面尚未提供工作会话切换器。
2. `WorkbenchLayout` 只在当前组件实例内记忆折叠、移动分屏、滚动和焦点；刷新或换设备后不能恢复。
3. 仓库没有 `WorkSession` / `RouteContext` 生产模型、迁移、API 或前端 adapter；`OpsAssistantSession` 属于 AI 对话，禁止复用。
4. 选品的 `unitEconomicsDraft`、`businessCaseDraft`、`riskAssessmentDraft` 已由服务端类型化保存并有版本冲突处理，但现有 `/decisions` 会表达业务去向；会话暂停不得静默调用 `defer`。
5. 装箱表单是组件内状态，提交会立即写版本化 `ContainerStuffingSnapshot`；没有领域草稿端点，也不应为了统一 UI 新造一个。
6. 市场信号虽是较强的“动作即落账”候选，但其智慧基线当前存在用户 WIP，本单元不读取或覆盖；选用装箱作为已定过渡边界消费者，不扩建现场装箱业务模式。
7. `chore/resume-keyword-v1` 是 Claude Code 提示词/任务线治理，不是产品工作会话；不合并、不 cherry-pick，也不计作本单元进度。
8. 旧 worktree 中显示的 `universal-workbench-layout-standard-v1: review`、产品选品 review 等均是落后 `main` 的陈旧快照；当前 `main` 对应 brief 已 `done`。本单元不删除这些 worktree，只记录它们不再占锁。
9. 工作树中的 `市场与经营信号.md`、`.tmp/`、`apps/api/.tmp/` 为未归属 WIP，保持不读、不改、不暂存、不提交。

## 智慧开启基线

| 基线文件与原结论                                                        | 处置       | 依据                                | 本单元落点                                                                       |
| ----------------------------------------------------------------------- | ---------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `全局.md`：跨台责任、权限和恢复口径不能由通用层发明                     | 沿用       | 已批准 UI 标准 §11；AGENTS 五面纪律 | WorkSession 只保存个人恢复指针，领域责任继续由来源模块拥有                       |
| `选品立项.md`：商业论证与投资门；普通缺失可保存，重判和冲突必须保留历史 | 沿用       | `08-role-workbenches.md` §4.2       | 类型化 `ProductInitiativeDecisionDraft`；保存不改变 outcome/destination/责任/SLA |
| `装箱.md`：A 是最终目的，但当前采用 A1，不立即扩建原生现场闭环          | 沿用       | 基线末尾已确认 A1；`08` §七         | 只验证“无领域草稿不伪保存”的 UI 边界，不新增装箱状态、动作或现场政策             |
| `市场与经营信号.md` 当前有未归属 WIP                                    | 存疑且排除 | 工作树保护规则                      | 不读取、不修改、不作为当前消费者或权威写回                                       |

## 业务步骤五面映射

| 业务步骤与岗位结果   | 岗位任务                                   | 数据事实                                                  | 技术保障                                                           | 权限边界                                                           | 界面承接                                            | 验收状态 |
| -------------------- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------- | -------- |
| 打开当前现场         | 进入选品或装箱后定位当前对象和事项         | 类型化 RouteContext、subject/task 引用、domainVersionSeen | open-or-focus 去重；同一 context 不重复建会话                      | 服务端绑定认证 tenant/actor；领域 GET 再授权                       | PageHeader 显示唯一当前；三栏保持                   | 待实现   |
| 暂停并切换           | 先处理当前未保存输入，再选择目标现场       | 选品 draftRef/version；装箱仅浏览器 dirty 标志            | 选品中性草稿保存；装箱只提供放弃/留下/新标签页；原子 activate      | 会话只能由 owner 管理；目标领域 GET 保留原 capability/object scope | 失败不移动当前标识、不导航；原因和恢复入口就地可见  | 待实现   |
| 恢复目标现场         | 重读目标事实并回到事项和右栏模式           | 最新领域版本、受控 activeItem/contextMode、标签页布局锚点 | 先重授权/重读/比较，再切换；409/403/404 失败关闭                   | 不从会话存在或按钮可见性推断权限                                   | 恢复对象、事项、折叠、移动屏、滚动和焦点            | 待实现   |
| 跨标签保留无草稿现场 | 装箱输入不能伪保存时可在原标签保留内存现场 | `browser_held` 会话状态；业务输入仍只在原标签内存         | BroadcastChannel/visibility refresh 同步唯一 current；不序列化表单 | 新标签仍需正式领域读取和授权                                       | 原标签明确“仅浏览器保留”；新标签成功后 current 迁移 | 待实现   |

### 相关数据事实子集（三轨）

| 轨道                 | 字段/事实                                                       | 当前证据/来源                              | 建议承载                                                       | 状态                |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------------- |
| `current_physical`   | 选品类型化草稿、initiative version、route `handoffId`           | ProductInitiative Schema/API/DB/composable | 新增领域专用 decision draft + WorkSession draftRef/versionSeen | structure-confirmed |
| `current_physical`   | 装箱 route `containerId + taskId`、snapshot version；表单仅本地 | Stuffing view/form/API                     | WorkSession 只存引用与已见版本；dirty 输入不落 WorkSession     | structure-confirmed |
| `approved_gap`       | 多现场切换、唯一 current、恢复重授权、版本冲突                  | UI 标准 §4.3/§11/§18.2                     | WorkSession 表、API、前端 adapter/orchestrator                 | approved            |
| `approved_gap`       | 暂停工作会话不得改变业务状态、责任或 SLA                        | UI 标准 §11.5                              | activate 只改 WorkSession；领域写动作分离                      | approved            |
| `industry_candidate` | 跨标签即时同步实现方式                                          | 无业务政策要求；可逆工程选择               | 浏览器 `BroadcastChannel`，不可用时 visibility/focus 重读      | engineering-choice  |

## 权限与安全边界

- 新增稳定 capability `work_session.manage`，只允许管理认证主体自己的工作会话；它不授予任何领域读取或写入。
- 服务端忽略/拒绝 body 中的 tenantId、ownerActorId；这两个值只从认证身份取得。
- 所有查询和更新同时按 tenant + ownerActorId + sessionId 收窄；跨租户或跨 actor 返回不可枚举的 not-found。
- 恢复选品仍要求 `planning.read`，保存选品草稿仍要求 `planning.draft`；恢复装箱仍要求原 container/task 读取能力，保存装箱仍走既有正式动作。
- WorkSession 不保存 Token、证据正文、任意 URL、自由业务 JSON、权限快照、责任/SLA 或领域状态。
- 新 capability 组合进当前能进入产品工作台或现场工作台的既有角色包；不穷举未来角色，不建立运行时权限平台。

## 方案与接口边界

### 1. WorkSession V1

- 服务端字段：`sessionId`、`version`、`status`、`workbenchCode`、封闭联合 `routeContext`、`contextKey`、`subjectRef`、可选 `taskRef`、可选 `draftRef/versionSeen`、`activeItemKey`、`contextMode`、安全显示摘要、`lastOpenedAt/createdAt/updatedAt`。
- 状态：`current | resumable | draft_saved | browser_held | conflict | closed`。业务状态不进入此枚举。
- `(tenantId, ownerActorId)` 最多一个 `current`；同一 canonical context 最多一个未关闭会话；数据库部分唯一索引兜底。
- open-or-focus、更新指针、activate、close 都使用 expected session version；activate 在单事务内把来源降为真实处置状态并把目标设为 current。

### 2. Product Selection adapter

- 新增领域专用、类型化 `ProductInitiativeDecisionDraftV1` 与 `POST /api/product-initiatives/:handoffId/drafts`。
- 草稿是独立版本化记录或等价的领域专用承载，不使用通用 WorkSession JSON；保存不得改变 `outcome`、`currentDestination`、责任、重判期限或交接快照。
- 页面 adapter 暴露 `isDirty`、`saveDraft`、`discardLocal`、`reloadAndCompare`、`capturePointer`、`restorePointer`。
- 正式判断成功后领域草稿关闭/清除；冲突时保留本地输入，重读服务端草稿并进入可比较的 conflict 状态。

### 3. Stuffing adapter

- 不新增装箱草稿 API/列/表。
- `StuffingSnapshotForm` 只向页面报告 dirty 与 discard/reset；正式保存仍写 `ContainerStuffingSnapshot`。
- dirty 切换只允许：放弃本地改动后切换、留在当前页、在新标签页打开目标并把来源标为 `browser_held`。
- 本单元不改变装箱 A1 过渡业务模式、任务状态、VGM 规则或生命周期推进。

## 执行切片

### `WS1-contract-domain-persistence`

- **范围**：本 brief、计划、公共契约、WorkSession/选品草稿 Schema 与迁移、API 领域/仓储/服务/控制器和真实数据库测试。
- **TDD**：先写契约、领域、服务、仓储集成失败测试；再写最小实现。
- **停止条件**：owner/tenant 隔离、去重、唯一 current、乐观锁、中性草稿保存不改变业务状态全部通过。

### `WS2-shared-web-runtime`

- **范围**：RouteContext registry、API client、session orchestrator、switcher、RoleWorkbenchFrame slot、合成参考页。
- **TDD**：先覆盖菜单不导航、失败不迁移、重复 context 聚焦、跨标签同步、键盘与焦点；再实现。
- **停止条件**：共享层不含选品/装箱业务判断，只接受 adapter 协议。

### `WS3-product-selection-consumer`

- **范围**：选品 adapter、composable/view、真实三视口和刷新/冲突路径。
- **停止条件**：dirty 保存后可跨刷新恢复；暂停不改变业务去向；403/404/409 不切换。

### `WS4-stuffing-boundary-consumer`

- **范围**：装箱 dirty 协议、PageHeader switcher、放弃/留下/新标签页路径和三视口证据。
- **停止条件**：无草稿时绝不显示“草稿已保存”；既有正式保存和版本化装箱行为不变。

### `WS5-integration-review`

- **范围**：定向测试、真实 PostgreSQL、Web lint/typecheck/build、三视口 E2E/截图、完整 `pnpm validate`、fresh Claude 只读整体复审、finding 裁决、PR/CI/合并。
- **停止条件**：所有 accepted finding 已修复；外部推送/PR 若被平台权限阻塞则保留本地提交和证据并如实报告。

## 验收

- [ ] 同一用户同一 context 重复打开只返回原会话；不会产生重复现场。
- [ ] 任一 tenant + actor 最多一个 current；并发 activate 不能产生两个 current 或静默丢失 current。
- [ ] 菜单打开不改变页面；目标授权、重读、版本校验全部成功后才迁移 current 和导航。
- [ ] 目标 401/403/404/409、领域草稿保存失败或 WorkSession 版本冲突时，来源 current、路由和本地输入保持。
- [ ] 选品中性保存跨刷新恢复 typed draft，但不改变 outcome、destination、责任、期限、SLA 或交接。
- [ ] 装箱 dirty 路径不伪装服务端草稿；放弃、留下和新标签页三条路径均可验证。
- [ ] 暂停/关闭 WorkSession 不完成、不延期、不释放、不转移任何领域任务。
- [ ] 当前/待续办/草稿已保存/仅浏览器保留/冲突/关闭均有文字，不只靠颜色。
- [ ] 1440×900、1024×768、390×844 的选品与装箱真实页面无横向溢出，切换器、失败、冲突和恢复入口可达。
- [ ] 当前切片相关 API/Web/合同/迁移/字典门禁通过；最终 PR 候选执行一次完整 `pnpm validate`。
- [ ] 高风险 fresh Claude 只读整体复审完成，finding 均有裁决。

## 明确不做

- 不启动任务全程档案、任务内协作对话、AI 辅助与确认执行或海运运营。
- 不启动全链样本 Brief 4，不删除旧 Demo，不做生产数据写入或页面切换。
- 不读取、修改、格式化、暂存或提交市场智慧基线 WIP、`.tmp/`、`apps/api/.tmp/`。
- 不迁移其余 21 台工作台，不重写全仓 router，不统一所有错误信封，不建设万能权限/草稿/Activity 平台。
- 不合并或 cherry-pick `chore/resume-keyword-v1`；它属于 Claude Code 仓库工作流治理，不是产品能力。

## 进度 log

| 日期       | 阶段   | 负责              | commit   | 说明                                                                                                 |
| ---------- | ------ | ----------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| 2026-10-14 | coding | Claude / Opus 4.8 | 4bca8233 | 从负责人固定主线提交建立功能分支；完成权威、真实消费者、旧 worktree 与实现事实核对；未触碰受保护 WIP |
