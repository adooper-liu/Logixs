---
status: review
branch: test/recoverable-work-sessions-acceptance-v1
verification: "Final acceptance candidate f99cff8d includes WS6R1-R6 plus full-chain Prisma injection fix; fresh Claude incremental review of WS6R6 returned no-findings. Direct acceptance evidence now covers failure preservation, typed-draft refresh neutrality, six textual states, OIDC 401, closed/browser-held lifecycle, pagination, concurrency and three viewports. On 2026-10-18 one clean detached pnpm validate at f99cff8d passed repo/purpose/contracts/dictionary/db generation/lint/format/typecheck, then exited 1 during root pnpm test; output truncation did not preserve a failing test name. The same untouched checkout immediately completed full pnpm test with exit 0 (Turbo 4/4; API 313 files/1628 tests). Integration/E2E/build were not reached in the single validate, so status remains review and no full-gate pass is claimed."
owner: main
writer: codex
risk: high
dependsOn:
  - universal-workbench-layout-standard-v1
  - mainline-priority-confirmation-v1
  - full-chain-landing-prisma-injection-v1
writeScopes:
  - docs/planning/tasks/recoverable-work-sessions-v1.md
  - docs/planning/progress-board.html
  - docs/superpowers/plans/2026-10-14-recoverable-work-sessions.md
  - docs/product/UI_SYSTEM.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - docs/planning/tasks/mainline-priority-confirmation-v1.md
  - docs/superpowers/specs/2026-10-06-full-chain-sample-rebuild-design.md
  - scripts/check-repository.mjs
  - scripts/check-repository.test.mjs
  - scripts/task-brief-state.mjs
  - scripts/task-brief-state.test.mjs
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
  - database/dictionary/database-data-dictionary.xlsx
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
  - apps/api/src/modules/product-selection/application/product-initiative-errors.ts
  - apps/api/src/modules/product-selection/application/product-initiative.services.test.ts
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
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts
  - docs/planning/tasks/full-chain-landing-prisma-injection-v1.md
  - apps/web/src/api/workSessions.ts
  - apps/web/src/api/workSessions.test.ts
  - apps/web/src/api/marketSignals.ts
  - apps/web/src/api/marketSignals.test.ts
  - apps/web/src/work-session/**
  - apps/web/src/components/workbench/WorkbenchLayout.vue
  - apps/web/src/components/workbench/WorkbenchLayout.test.ts
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
  - apps/web/e2e/product-selection-workbench.spec.ts
  - apps/web/e2e/stuffing-workbench.spec.ts
  - apps/web/e2e/universal-workbench-reference.visual.spec.ts
  - apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots/reference-default-mobile-chromium-win32.png
  - apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots/reference-edit-mobile-chromium-win32.png
  - apps/web/e2e/universal-workbench-reference.visual.spec.ts-snapshots/reference-mobile-detail-mobile-chromium-win32.png
  - apps/web/e2e/recoverable-work-sessions.spec.ts
  - apps/web/e2e/recoverable-work-sessions.oidc.spec.ts
  - apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots/**
  - apps/web/e2e/support/recoverableWorkSessions.ts
  - apps/web/e2e/support/oidcIdentityProvider.ts
  - apps/web/e2e/support/testServers.ts
  - apps/web/playwright.config.ts
exclusiveLocks:
  - database-schema
  - database-migrations
  - database-dictionary
  - public-contract:work-session-v1
  - public-contract:product-initiative-v1
  - generated:contracts
  - root-tooling
  - authz-control-plane
  - ui-pattern:workbench-session-v1
  - visual-baseline:workbench-session-v1
sharedIntegrationScopes:
  - apps/api/src/modules/full-chain-sample-landing/infrastructure/prisma-full-chain-landing.repository.ts
  - docs/planning/tasks/full-chain-landing-prisma-injection-v1.md
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

### `WS6-acceptance-closeout`

| 项目        | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基线        | `2d84c5675b0a2859b87577d784771bdc5a1e81e3`（当前 `main`，包含 PR #190/#191 的共享工作台壳修复）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 执行角色    | Codex Code 实现执行器；`HANDOFF.model` 如实登记实际模型                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 主代理审查  | Claude Code 主代理核对实际 diff、RED/GREEN 证据、三视口截图和 fresh checkout 门禁；不直接修改实现文件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 独立复审    | 若测试暴露并修正生产行为，全部修复后由 fresh Claude Code 只读复审新增风险差异；纯测试/证据无生产行为变化时不机械重复 2026-10-14 的整体复审                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 写入范围    | `docs/planning/tasks/recoverable-work-sessions-v1.md`；`docs/planning/progress-board.html`；`apps/web/e2e/recoverable-work-sessions.spec.ts`；`apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots/**`；`apps/web/src/components/workbench/WorkbenchSessionSwitcher.test.ts`；`apps/web/src/work-session/useWorkSessions.test.ts`；`apps/web/src/composables/useProductInitiativeDecision.test.ts`；`apps/web/src/views/ProductSelectionWorkbench.test.ts`；`apps/api/src/infrastructure/integration/work-session.integration.test.ts`；`apps/api/src/infrastructure/integration/product-initiative-flow.integration.test.ts`；仅当新增失败测试证明真实缺陷时，允许最小修改 `apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue`、`apps/web/src/work-session/useWorkbenchSessionSwitcher.ts`、`apps/web/src/work-session/useWorkSessions.ts`、`apps/web/src/composables/useProductInitiativeDecision.ts`、`apps/web/src/views/ProductSelectionWorkbench.vue`、`apps/web/src/views/StuffingWorkbench.vue` |
| 禁止范围    | 不改公共契约、Schema、迁移、字典、权限政策、领域 outcome/destination/责任/期限/SLA；不新增通用草稿、关闭/重开流程、任务内协作、聊天或 AI；不读取、修改、暂存或提交 `.tmp/`；不使用 `--update-snapshots` 接受 Stuffing mobile 漂移                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UI 强制结构 | 继承 frontmatter 全部 `uiStructure` / `uiMustStayVisible` / `uiProgressiveDisclosure` / `uiForbidden` / `uiViewportEvidence`；状态只补真实文字与恢复证据，不改变固定办理壳、三栏顺序或主动作                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 验证命令    | 先逐项运行新增 Web/API 定向测试并保存预期 RED，再做最小 GREEN；随后运行相关 Web lint/typecheck/unit/E2E、API unit/integration（如有 API 测试改动）、`pnpm board:build`、`pnpm repo:check`、本 brief 与派生板格式检查；最终在干净 fresh checkout、5173/5174 无外部 owner、PostgreSQL/Chromium 就绪且不更新截图的条件下只运行一次 `pnpm validate`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 停止条件    | 四项验收均有直接证据且 `pnpm validate` 单命令退出 0 才可回到 `review`/`done`；实际 OIDC 401 若重定向导致未保存内存输入丢失，或 `closed` 在真实产品路径不可检查，则返回 `blocked` 并给出失败反证，不得把开发认证、注入假数据或纯映射单测冒充通过                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

TDD 与验收顺序：

1. **失败保持矩阵**：先写会失败的真实页面验收，分别覆盖目标读取 `401/403/404/409`、领域草稿保存 `500/409`、WorkSession activate `409`。每例同时断言来源 session 仍是唯一 `aria-current`、URL/当前对象/事项与右栏 mode 不变、未保存 typed 输入逐字保留；目标读取或草稿失败不得调用 activate，activate 409 只能调用一次且不得导航。实际 OIDC 401 必须单列，不得只用 development-auth 的抛错替代。
2. **Typed draft 跨刷新**：Web 测试必须让 GET 返回非空 `decisionDraft`，证明保存后刷新/重建 composable 可恢复 objective、review points、business case、risk、unit economics 与右栏指针；正式 `outcome/currentDestination/responsibility/targetDate/nextDecisionAt/reconsiderationAt` 必须继续来自 formal initiative 且前后相同。真实 PostgreSQL 集成测试同时断言 typed draft round-trip，正式事实、交接和 Outbox 不变。
3. **六状态文字矩阵**：真实组件渲染并逐项断言 `当前 / 待续办 / 领域草稿已保存 / 仅此标签保留 / 冲突 / 已关闭`，同时验证状态不只靠颜色。E2E 至少证明 Product Selection 的 `draft_saved`、Stuffing 新标签后的 `browser_held`、目标版本变化后的 `conflict`。`closed` 若因默认查询过滤而只能由人工注入组件 fixture，则不能单凭该 fixture 勾选真实界面验收；需证明产品内可检查的收拢入口，或明确返回 blocker 由主代理裁决原需求与实现边界。
4. **视觉与回归**：在 `1440×900`、`1024×768`、`390×844` 复跑真实选品/装箱页面，核对当前标识、状态真实性、冲突/恢复入口、主动作和页面级无横向溢出。Stuffing mobile 必须人工比较 PR #179 原基线与当前 main 基线，记录队列内容变化的业务原因；不得因像素门禁方便而更新基线。
5. **单命令门禁**：最终候选在 fresh checkout 记录 commit、clean status、Node/pnpm/Playwright 版本、infra health 与 5173/5174 空闲事实；只接受一条 `pnpm validate` 从 `repo:check` 顺序跑到 `build` 且 exit 0。分轨成功、历史 CI 或当前 checkout 的诊断运行不能替代该证据。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6-acceptance-closeout base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6-acceptance-closeout base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=main workspace=D:\Logixs commit=<sha|none>
```

### `WS6R1-closed-and-oidc-evidence`

主代理对首次 `blocked` HANDOFF 的裁决：

```yaml
protocol: logix-disposition/v1
slice: WS6-acceptance-closeout
decisions:
  - finding: WS6-CLOSED-01
    status: accepted
    reason: closed 在契约、服务端 close 命令和状态文案中已定义，但默认 list 排除且前端无归档入口，真实产品路径无法检查；这违反本 brief 已批准的“默认收拢但原因和重新打开边界仍可检查”，不是组件测试可以补齐的证据缺口。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R1-closed-and-oidc-evidence
  - finding: WS6-OIDC-01
    status: accepted
    reason: oidc-chromium 只匹配 auth-session.spec.ts，当前验收 spec 无法运行真实 401；这是测试配置/写域缺口。401 保持口径不得要求未保存内存跨整页 OIDC 重定向魔法保存，而应遵循既有业务边界：选品先中性保存 typed draft，再重登回原路由并从服务端草稿恢复；装箱无草稿时仍只能留在原标签页或放弃。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R1-closed-and-oidc-evidence
next: fix
```

修复边界：

1. **Closed 真实入口**：测试先行地让 list 支持显式 `includeClosed`（默认仍排除），前端切换器提供收拢的“已关闭工作现场”检查区。每个关闭项必须显示 `工作现场已关闭`，明确“关闭现场不等于业务完成/延期/责任转移”，并提供“重新进入该对象会新建受控现场、仍须重新授权和重读”的边界文字。V1 不新增 reopen 命令，不新增 close reason 字段，不把 closed 行设为可激活；如需产生 closed fixture，必须通过真实 close API/服务端路径而非手工注入组件数组。
2. **关闭动作**：已有 close API 只允许关闭非 current 会话；切换器可对非 current 行提供“关闭此工作现场”，成功后从默认列表移入收拢区。失败保持当前、路由和本地输入不变，并显示可行动错误。不得关闭 current，不得改变领域任务、责任、期限、SLA 或业务状态。
3. **OIDC 真实 401**：新增 OIDC 专用 recoverable-session E2E（或将专用文件加入 `oidc-chromium` 的 testMatch），复用现有 OIDC IdP/API 支持。选品流程先通过正式 typed-draft 保存取得服务端恢复点，再让目标读取返回一次 401，证明只重登一次、回到原路由、来源仍 current、目标未 activate，并从正式 draft 恢复输入；服务端持续 401 时显示会话无效且不发生切换。不得把任意业务表单放入 sessionStorage/localStorage。
4. **原矩阵继续执行**：完成上述 RED/GREEN 后继续 `WS6` 的 403/404/409、draft 500/409、activate 409、typed draft 刷新、六状态文字、三视口与 fresh-checkout `pnpm validate`；不得因本次修复只验证两个 blocker 就交回完成。

追加写入范围：

- `packages/contracts/schemas/v1/work-session.schema.json`
- `packages/contracts/fixtures/v1/schema-instances.json`
- `packages/contracts/generated/contracts.d.ts`
- `scripts/generate-contracts.mjs`
- `apps/api/src/modules/work-session/application/list-work-sessions.service.ts`
- `apps/api/src/modules/work-session/application/work-session.services.test.ts`
- `apps/api/src/modules/work-session/infrastructure/prisma-work-session.repository.ts`
- `apps/api/src/modules/work-session/infrastructure/prisma-work-session.repository.test.ts`
- `apps/api/src/modules/work-session/presentation/work-session.dto.ts`
- `apps/api/src/modules/work-session/presentation/work-sessions.controller.ts`
- `apps/api/src/modules/work-session/presentation/work-sessions.controller.test.ts`
- `apps/api/src/infrastructure/integration/work-session.integration.test.ts`
- `apps/web/src/api/workSessions.ts`
- `apps/web/src/api/workSessions.test.ts`
- `apps/web/src/work-session/useWorkSessions.ts`
- `apps/web/src/work-session/useWorkSessions.test.ts`
- `apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue`
- `apps/web/src/components/workbench/WorkbenchSessionSwitcher.test.ts`
- `apps/web/e2e/recoverable-work-sessions.oidc.spec.ts`
- `apps/web/e2e/support/oidcIdentityProvider.ts`
- `apps/web/e2e/support/testServers.ts`
- `apps/web/playwright.config.ts`

除上述追加外，其余范围、UI 强制结构、TDD、禁止项、验证与停止条件继续继承 `WS6-acceptance-closeout`。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R1-closed-and-oidc-evidence base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R1-closed-and-oidc-evidence base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=main workspace=D:\Logixs commit=<sha|none>
```

### `WS6R2-review-findings-and-final-gate`

主代理对 `WS6R1` HANDOFF 的审查与裁决：

```yaml
protocol: logix-review/v1
slice: WS6R1-closed-and-oidc-evidence
baseline: 2d84c5675b0a2859b87577d784771bdc5a1e81e3
reviewed: workspace-diff
verdict: findings
findings:
  - id: WS6R1-RESTORE-01
    severity: high
    type: confirmed
    evidence: apps/web/src/work-session/useWorkbenchSessionSwitcher.ts:73-105,270-281
    scopeBasis: 当前对象、事项和右栏现场必须保持；后台同步不得覆盖当前标签页尚未持久化的个人操作位置
    impact: load 同时由 mounted、focus、visibilitychange、BroadcastChannel 和关闭后刷新调用；每次都 restorePointer，用户在当前标签页刚切到的新 gap/右栏 mode 会被服务端旧指针拉回
    acceptanceProbe: 服务端 current 指针为 A，用户本地切到 B 后触发 focus/visibility/Broadcast reload，仍保持 B；首次重建页面时才恢复 A
    currentSliceNecessity: 本次为修复刷新恢复新增该行为，直接改变核心恢复语义
    suggestedDisposition: accepted
  - id: WS6R1-BROWSER-HELD-CLOSE-01
    severity: high
    type: confirmed
    evidence: apps/web/src/components/workbench/WorkbenchSessionSwitcher.vue:230-273
    scopeBasis: browser_held 是装箱无服务端草稿时对原标签未保存输入的唯一恢复指针
    impact: 所有非 current 会话都显示关闭动作，包括 browser_held；用户可无处置确认地关闭唯一恢复指针，随后关闭原标签即失去未保存输入
    acceptanceProbe: browser_held 行不提供关闭动作，close helper 也必须失败关闭；resumable/draft_saved/conflict 仍可关闭
    currentSliceNecessity: 直接违背本任务优先减少“未保存输入丢失”的核心结果
    suggestedDisposition: accepted
  - id: WS6R1-CLOSE-RESULT-01
    severity: medium
    type: confirmed
    evidence: apps/web/src/work-session/useWorkSessions.ts:38-49
    scopeBasis: 操作结果必须反映服务端真实落账，并区分成功与刷新失败
    impact: close API 已成功但随后 reload 失败时，catch 返回“关闭失败”；服务端已关闭、界面仍显示可关闭，重试只会得到版本冲突
    acceptanceProbe: close 成功且 reload 拒绝时返回“已关闭但列表刷新失败”的真实结果，不得显示“关闭失败”，本地不得继续把该行当可关闭现场
    currentSliceNecessity: 新增关闭入口的真实回执错误
    suggestedDisposition: accepted
  - id: WS6R1-REOPEN-HISTORY-01
    severity: medium
    type: confirmed
    evidence: apps/web/src/work-session/useWorkbenchSessionSwitcher.ts:108-135
    scopeBasis: closed 默认收拢但重新进入后仍可检查历史边界
    impact: 同 context 只有 closed 行时，open 成功后的本地合并按 contextKey 删除所有旧行，导致刚刚重进对象后关闭历史暂时从检查区消失，直到下一次服务端 load
    acceptanceProbe: 重进 closed context 后同时保留新 live 会话与原 closed 历史行
    currentSliceNecessity: 本次 accepted closed 产品路径的直接验收要求
    suggestedDisposition: accepted
unknowns: []
verificationGaps:
  - 非 OIDC 浏览器矩阵尚无“保存 typed draft -> 切走 -> 回到选品并显式 page.reload -> 恢复完整 typed 字段和右栏指针”的直接 E2E；composable 单测和 OIDC 重登仅提供部分证据
  - fresh-checkout pnpm validate 尚未 exit 0
writes: none
```

```yaml
protocol: logix-disposition/v1
slice: WS6R1-closed-and-oidc-evidence
decisions:
  - finding: WS6R1-RESTORE-01
    status: accepted
    reason: 新增的通用 load 恢复会把后台同步变成强制 UI 回滚；恢复只能发生在页面首次重建、成功导航到目标或明确重新进入上下文时
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate
  - finding: WS6R1-BROWSER-HELD-CLOSE-01
    status: accepted
    reason: browser_held 没有服务端领域草稿，关闭其唯一恢复指针会制造未保存输入丢失风险；V1 直接禁止关闭该状态
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate
  - finding: WS6R1-CLOSE-RESULT-01
    status: accepted
    reason: close 与 reload 是两个事实，不能把已落账关闭误报为关闭失败
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate
  - finding: WS6R1-REOPEN-HISTORY-01
    status: accepted
    reason: 新 live 会话和旧 closed 历史具有不同身份，应同时保留；只替换同 context 的未关闭副本
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate
  - finding: WS6R1-TYPED-REFRESH-E2E-01
    status: accepted
    reason: 负责人要求 typed draft 刷新恢复 E2E；现有单元与 OIDC 测试未在普通产品路径显式 reload 后验证完整 typed 字段和右栏指针
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate
  - finding: WS6R1-STUFFING-MOBILE-BASELINE-01
    status: accepted
    reason: 主代理逐图核对确认实际图是 PR #190/#191 后可办理队列，旧基线仍显示任务池加载失败；新图当前标识、可执行主任务、关闭动作和面板均可见，无横向溢出，差异属于已批准业务修复而非视觉回归
    writeback: apps/web/e2e/recoverable-work-sessions.spec.ts-snapshots/stuffing-mobile-chromium-session-menu-mobile-chromium-win32.png
  - finding: WS6R1-VALIDATE-TIMEOUT-01
    status: rejected
    reason: purge-dry-run 文件、依赖和脚本不在当前 diff；定向重跑 7/7 通过且子进程约 1.05 秒，完整 API 单测 312 文件/1617 项也通过。单次 5.07 秒命中既有固定 5 秒边界，不支持扩大本业务切片修改 full-chain-demo；修复当前 finding 后从 fresh checkout 重跑 validate，只有再次复现才另立低风险测试稳定性修复
    writeback: none
next: fix
```

修复与最终门禁要求：

1. `load` 只刷新服务端会话集合和唯一 current；首次页面重建单独恢复 current 指针。focus、visibility、BroadcastChannel、close 后 reload 不得覆盖当前标签页更新后的 `activeItemKey/contextMode`。成功切换仍在导航后恢复目标指针。
2. `browser_held` 不显示关闭动作，关闭 helper 同样失败关闭；组件隐藏不能代替应用层保护。其余非 current 且非 closed 状态保持可关闭。
3. close 成功与 reload 失败分轨：保留 close 返回的 closed 服务端记录，立即让本地行进入 closed 检查区；刷新失败显示“工作现场已关闭，但列表刷新失败，请重新加载”，不得显示“关闭失败”或允许重复关闭。close 请求本身失败仍保持原现场并显示失败。
4. 重进 closed context 时保留旧 closed 历史，只替换/去重同 context 的未关闭行；新增自动化反证。
5. 在普通 `recoverable-work-sessions.spec.ts` 增加 desktop 真实浏览器路径：填入 objective、review point、business case、risk、unit economics 和右栏指针，正式保存并切走，再回到选品执行 `page.reload()`，GET 返回正式非空 `decisionDraft`；逐项断言 typed 字段和右栏恢复，同时正式 outcome/destination/责任/期限不变。
6. 主代理已人工核对 Stuffing mobile expected/actual/diff；只更新 `stuffing-mobile-chromium-session-menu-mobile-chromium-win32.png` 为当前已批准实际图，不改阈值、不更新其他截图。更新后单测该截图两次以确认稳定。
7. 完成定向回归后，在最终候选的干净 fresh checkout、5173/5174 空闲、PostgreSQL/Chromium 就绪条件下重新运行一次 `pnpm validate`。若仍只在 `purge-dry-run.cli.test.ts` 的固定 5 秒边界失败，交回完整输出并停止，不在本切片修改 `full-chain-demo/**`。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R2-review-findings-and-final-gate base=2d84c5675b0a2859b87577d784771bdc5a1e81e3 role=main workspace=D:\Logixs commit=<sha|none>
```

### `WS6R3-independent-review-findings`

fresh Claude 对集成候选 `2d84c567..7e0ea889` 的复审裁决：

```yaml
protocol: logix-disposition/v1
slice: WS6R2-review-findings-and-final-gate
decisions:
  - finding: WS6R2-BROWSER-HELD-SERVER-CLOSE-01
    status: accepted
    reason: 前端虽拒绝 browser_held，但服务端 close 只拒绝 current；直接或陈旧客户端可关闭装箱未保存输入的唯一恢复指针。安全边界必须在 Application/Repository 服务端执行。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R2-PAGINATED-SESSION-LOSS-01
    status: accepted
    reason: includeClosed 与 live 混排且客户端只读第一页并忽略 nextCursor，51+ mixed rows 时 live/resumable 或 closed history 可不可达；V1 无总数上限，恢复列表必须消费完整分页。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R2-TYPED-REVIEW-POINT-PROOF-01
    status: rejected
    reason: 生产 UI 的“历史四项评审”是只读兼容信息，不存在可编辑 review-point 控件；要求用户编辑它会发明产品能力。保留其 typed draft round-trip 证据：普通 refresh E2E 使用区别于 formal initiative 的 draft reviewPoint 并在 reload 后断言 draft 值即可。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6-FAILURE-HOLD-MATRIX-PROOF-01
    status: accepted
    reason: 现有矩阵只断言 URL、current 和 objective；brief 还要求当前对象/事项/右栏 mode 保持。每个错误码可共用 before/after helper，但必须直接断言 activeItemKey/contextMode 与当前对象/任务。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6-VISUAL-STATE-EVIDENCE-01
    status: accepted
    reason: 六张 normal 菜单截图不能证明 conflict/closed/browser_held/失败恢复控件未遮挡。按原计划补代表性桌面状态截图，并在 1024x768/390x844 对这些状态执行可达与 overflow 断言；不机械生成每状态×三视口的脆弱基线。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R2-CLOSED-TERMINAL-01
    status: accepted
    reason: includeClosed 让 closed ID/version 可检查后，现有 pointer PATCH 可把 closed 改回 resumable/browser_held/conflict；V1 没有 reopen 命令，closed 必须保持终态，重新进入只能由 openOrFocus 新建会话。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R2-INITIAL-LOAD-RECOVERY-01
    status: accepted
    reason: initialize 首次 list 失败后永久返回，后续 focus/visibility/Broadcast 只 load 不 ensure/restore；必须让任意首次成功 load 执行恰好一次初始化恢复，之后后台加载保持 pointer-neutral。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R2-CLOSE-STALE-LOAD-01
    status: accepted
    reason: 关闭前已发出的 list 可晚到并覆盖服务端已确认的 closed 本地事实；加载必须有 generation/序列化保护，确认 mutation 前启动的响应不得覆盖 mutation 结果。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R1-INCLUDE-CLOSED-VALIDATION-01
    status: accepted
    reason: 新增 public query 对非法或重复 includeClosed 抛普通 Error，HTTP 边界可能变成 500；应稳定返回 400 且不调用 repository。
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings
  - finding: WS6R3-OLD-CANDIDATE-VALIDATE
    status: rejected
    reason: 对 7e0ea889 启动的 validate 在 fresh review finding 确认后由主代理停止；候选将改变，旧结果无论成功失败都不能作为最终证据。
    writeback: none
next: fix
```

修复要求：

1. 服务端 `CloseWorkSessionService` 和 repository 双层拒绝 `browser_held`，返回稳定 409 码 `WORK_SESSION_BROWSER_HELD_CLOSE_REQUIRES_ORIGINAL_TAB`；已有 tenant/actor/version/current 检查保持。先写 service 与真实 PostgreSQL 失败反证，前端文案使用服务端错误。
2. 客户端加载 WorkSession 时循环消费 `nextCursor`，每页请求 `pageSize=100`，合并所有页后再确定唯一 current、closed inspection 与 live sessions；对重复 cursor/异常循环失败关闭。增加 51+ mixed rows 的 API-client/orchestrator 测试，证明第二页 live resumable 与 closed history 均可达。不得移除服务端分页上限。
3. 普通 typed refresh E2E 的 `decisionDraft.reviewPoints` 设置为区别于 formal initiative 的只读历史值；reload 后同时在 UI/GET 断言 draft 值，证明 typed round-trip，不新增编辑控件。
4. 失败保持矩阵为 target 403/404/409、draft 500/409、activate 409 建立统一 before/after 证据：当前 route、subject/object、task/item、`activeItemKey/contextMode`、唯一 current、typed input 均不变；401 继续由专用 OIDC 路径证明。
5. 补代表性桌面状态截图：至少 `draft_saved`、`conflict`、`closed inspection`、`browser_held`、一个失败保持状态；1024x768 与 390x844 不新增每状态像素基线，但逐项断言状态文字、错误/恢复动作可见且页面/面板无横向溢出、主动作未遮挡。主代理逐张人工核对后才可接受。
6. closed 保持服务端终态：`UpdateWorkSessionService` 与 repository 双层拒绝对 closed 的任何 pointer/status 更新，使用稳定 409；真实 service/HTTP/PostgreSQL 测试证明 closed 不能 PATCH 复活，而同 context 的重新进入通过 `openOrFocus` 新建不同 sessionId 并保留旧历史。重复 close 已关闭行也必须稳定拒绝，不增加版本。
7. 初始化恢复改为“首次成功 load 恰好一次”：mount 首次失败后，后续 focus/visibility/Broadcast 任一成功加载必须执行 ensure current + restore pointer 一次；之后所有后台加载不得重复恢复。用 first fail → background success 测试固定。
8. 为列表加载增加 generation/串行保护：在 close/activate/update 等已确认 mutation 后，使更早启动的 list 响应失效；测试延迟旧 GET → close 成功 → 新 GET 失败 → 旧 GET 晚到时 closed 仍保留且不可再次关闭。
9. `includeClosed` HTTP 边界只接受单个 `true|false` 或省略；非法 `yes`、空值和重复 query 稳定返回 400，repository 未调用。使用真实 Controller/HTTP 反证，不只测 service 抛错。
10. 修复后重跑定向门禁与 fresh Claude 增量复审；再创建新的 detached clean checkout，只运行一次最终 `pnpm validate`。旧 checkout `7e0ea889` 的被停止运行不计证据。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings base=7e0ea889b52834fd993e82a11d327ba5f30cf602 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R3-independent-review-findings base=7e0ea889b52834fd993e82a11d327ba5f30cf602 role=main workspace=D:\Logixs commit=<sha|none>
```

### `WS6R4-concurrent-first-success-recovery`

主代理对 `WS6R3` 候选 `f8a416f7..475e522f` 的增量审查：

```yaml
protocol: logix-review/v1
slice: WS6R3-independent-review-findings
baseline: f8a416f71e947269ced217af8bc458ad4e9114c5
reviewed: f8a416f7..475e522f
verdict: findings
findings:
  - id: WS6R3-CONCURRENT-FIRST-SUCCESS-01
    severity: high
    type: recoverability
    evidence: apps/web/src/work-session/useWorkbenchSessionSwitcher.ts:74-107
    scopeBasis: 首次成功 load 必须执行恰好一次 ensure/restore；后台并发又不得让 mutation 前响应覆盖已确认写入
    impact: 请求 A 先启动，随后同一 mutation epoch 的请求 B 启动；B 失败、A 成功。A 因 sequence != latestLoad 被丢弃，B 无数据，导致唯一成功响应未建立/恢复当前现场，直到另一次事件或整页刷新
    acceptanceProbe: mount 首次失败后并发触发 focus A 与 visibility B，先让 B 失败再让 A 成功；必须应用 A 并完成一次恢复。mutation 发生后，mutation 前 A 即使成功仍必须丢弃
    currentSliceNecessity: WS6R3 为首次失败恢复和陈旧响应保护引入的竞态回归，直接影响核心恢复结果
    suggestedDisposition: accepted
unknowns: []
verificationGaps:
  - fresh 增量 reviewer 未在限定时间内返回完整报告；主代理已复现 API 26/26、Web 105/105、PostgreSQL 46/46、OIDC 2/2、三视口 61 passed/2 expected skips，并独立确认上述并发反例
  - 最终 clean detached pnpm validate 尚未运行；旧候选运行已在 finding 确认后停止，不计证据
writes: none
```

```yaml
protocol: logix-disposition/v1
slice: WS6R3-independent-review-findings
decisions:
  - finding: WS6R3-CONCURRENT-FIRST-SUCCESS-01
    status: accepted
    reason: 仅按全局 latest sequence 接受响应会把“较新失败、较旧成功”的唯一成功结果丢弃；同一 mutation epoch 内应串行/合并加载，而 mutation 必须开启新一代并使之前响应失效
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R4-concurrent-first-success-recovery
next: fix
```

修复要求：

1. 同一 `mutationEpoch` 内的并发 `load()` 必须串行或共享同一个 in-flight 请求，不允许后发失败请求仅凭 sequence 使先发成功响应失效。
2. close/activate/update/open 确认 mutation 后必须开启新一代加载；mutation 前启动的任何响应即使成功也不得覆盖 mutation 结果，也不得被 mutation 后 load 复用。
3. 首次成功加载仍只对当前 context 执行一次 `ensureCurrent + restorePointer`；失败不消耗机会，后续后台成功可以完成；完成后后台加载 pointer-neutral。
4. 新增两个确定性 deferred-promise 测试，不使用任意 sleep：
   - 同 epoch：A 先启动、B 调用 load、B 共享/排队；唯一请求成功后所有调用完成，session 应用且 restore 一次；若实现为串行队列，则覆盖较新尝试失败后较早成功仍被采用的等价行为。
   - 跨 epoch：A 在 mutation 前启动，mutation 确认后 B 启动；A 晚到必须丢弃，B 的结果或已确认本地 mutation 保持。
5. 不改服务端生命周期、分页、HTTP 校验、视觉基线或已通过 E2E；完成后复跑受影响 Web 单测及所有 WS6R3 定向门禁，再发起 fresh 增量复审。无 finding 后才创建新 detached checkout 执行唯一一次 `pnpm validate`。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R4-concurrent-first-success-recovery base=475e522f5ca3697abe4ceaeb9ed4569882575a29 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R4-concurrent-first-success-recovery base=475e522f5ca3697abe4ceaeb9ed4569882575a29 role=main workspace=D:\Logixs commit=<sha|none>
```

### `WS6R5-activated-local-failure-truth`

fresh Claude 对增量 `a185fedf..64d769e0` 的复审与主代理裁决：

```yaml
protocol: logix-review/v1
slice: WS6R4-concurrent-first-success-recovery
baseline: a185fedf73dfff70534fce1e0822e8b4bdadf9cd
reviewed: a185fedf..64d769e0
verdict: findings
findings:
  - id: WS6R4-ACTIVATE-EPOCH-01
    severity: high
    type: recoverability
    evidence: apps/web/src/work-session/useWorkbenchSessionSwitcher.ts:185-214; apps/web/src/work-session/useWorkSessions.ts:81-112
    scopeBasis: server activate 一旦确认即为权威 mutation，必须立刻切换 epoch；后续导航或 pointer 恢复失败不得让 mutation 前 list 覆盖服务端 current
    impact: activateWorkSession 已成功把 B 设为 current，但 router.replace 或 restorePointer 随后失败；switchWorkSession 返回普通 failed，外层不推进 epoch、不启动 mutation 后 load，旧 flight 可应用 A=current/B=resumable，界面与服务端真相相反
    acceptanceProbe: 延迟 mutation 前 list A，activate B 成功，随后让 navigate 或 restorePointer 拒绝，再让 A 返回旧 current；必须丢弃 A，并从新 epoch 重读 B=current，同时显示“服务端已切换但本地恢复失败”的真实反馈
    currentSliceNecessity: WS6R4 明确要求 activate 确认后新 epoch 且 mutation 前响应失效；现有跨 epoch 测试只覆盖 close
    suggestedDisposition: accepted
unknowns: []
verificationGaps:
  - 现有 focused 17/17 通过，但无 activate 成功后 navigate/restore 失败且旧 list pending 的测试
writes: none
```

```yaml
protocol: logix-disposition/v1
slice: WS6R4-concurrent-first-success-recovery
decisions:
  - finding: WS6R4-ACTIVATE-EPOCH-01
    status: accepted
    reason: activate API 成功与本地导航/恢复是两个事实；不能用最终 switched 才推进 epoch，也不能把服务端已切换误报为完全未切换
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R5-activated-local-failure-truth
next: fix
```

修复要求：

1. `switchWorkSession` 或其调用协议必须区分：
   - activate 请求失败：服务端 mutation 未确认，保持原 epoch/现场；
   - activate 已成功但 navigate 失败；
   - activate 与 navigate 已成功但 restorePointer 失败。
2. activate API 成功返回的同一时刻，外层必须推进 `mutationEpoch`，使所有 mutation 前 list flight 失效；不得等到最终 `kind: switched`。
3. activate 确认后必须发布跨标签变更并启动/安排新 epoch authoritative load。navigate/restore 后续失败时，新 load 仍须执行，最终 sessions/current 以服务端为准。
4. 本地反馈必须真实区分：`服务端已切换工作现场，但本页导航/恢复失败，请按当前工作现场重新进入`；不得显示成普通“切换失败”而暗示服务端未变。
5. 成功路径只能推进 epoch 一次，不得重复 Broadcast/load；new-tab 路径已有直接 activate 流程，保持相同 mutation 时点并避免双增。
6. 新增确定性 deferred 测试：
   - mutation 前 list A pending；activate B 成功；navigate 拒绝；A 返回旧 current。断言 A 丢弃、mutation 后 load 读取 B=current、结果标明 server activated/local failed、current 不回退。
   - 同上但 navigate 成功、restorePointer 拒绝。
   - activate API 本身拒绝时不推进 epoch、不发布变更、不启动 mutation 后 load，旧 A 仍可作为原现场有效结果。
   - 正常成功路径 epoch/Broadcast/load 各恰好一次。
7. 不改服务端生命周期、分页、HTTP 校验、视觉基线、OIDC 或业务语义。修复后运行 Web 定向单测、lint/typecheck、repo/format/diff；fresh 增量复审无 finding 后才创建新 detached checkout 执行唯一一次 `pnpm validate`。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R5-activated-local-failure-truth base=64d769e0704628d695d1ebf8602efa2a874d94f0 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R5-activated-local-failure-truth base=64d769e0704628d695d1ebf8602efa2a874d94f0 role=main workspace=D:\Logixs commit=<sha|none>
```

### `WS6R6-single-pointer-restore-owner`

fresh Claude 对增量 `58d15586..53fd8066` 的复审与主代理裁决：

```yaml
protocol: logix-review/v1
slice: WS6R5-activated-local-failure-truth
baseline: 58d155862fcdff27eb5833793dbad76ccca33b8c
reviewed: 58d15586..53fd8066
verdict: findings
findings:
  - id: WS6R5-RESTORE-RACE-01
    severity: medium
    type: concurrency/recoverability
    evidence: apps/web/src/work-session/useWorkbenchSessionSwitcher.ts:189-228,353-357; apps/web/src/work-session/useWorkSessions.ts:94-141
    scopeBasis: 正常成功路径 restorePointer 必须恰好一次；post-activation load 与 route watcher 不能和显式 switch restore 竞争
    impact: post-activation load 先返回 B=current，随后 router.replace 提交 B route；currentContext watcher 调用 ensureAndRestoreCurrent 并 restore B，switchWorkSession 在 navigate 后又显式 restore B，造成两次恢复。非幂等恢复可重复滚动/聚焦/模式切换，任一调用失败还会产生误导反馈
    acceptanceProbe: 延迟 router.replace，先让 post-activation list 返回 B=current，再提交 B context；最终 switched 且 restorePointer(B) 只能调用一次
    currentSliceNecessity: WS6R5 要求正常路径 activate/navigate/restore 各一次；现有测试只覆盖 route 先于 list，没有覆盖 list 先于 route
    suggestedDisposition: accepted
unknowns: []
verificationGaps:
  - focused 3 files/31 tests passed，但缺 post-list-before-route 的确定性测试
writes: none
```

```yaml
protocol: logix-disposition/v1
slice: WS6R5-activated-local-failure-truth
decisions:
  - finding: WS6R5-RESTORE-RACE-01
    status: accepted
    reason: activate 成功后的显式 switch 流程与 route watcher 必须共享同一 context restore ownership；不能靠执行先后碰巧避免双恢复
    writeback: docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R6-single-pointer-restore-owner
next: fix
```

修复要求：

1. activate 确认后，为目标 context 建立“显式切换恢复进行中”的 ownership/promise，覆盖 navigate + explicit restore 阶段。route watcher 若看到同一 context，必须共享/等待该 ownership，不得另起 `ensureAndRestoreCurrent`。
2. explicit restore 成功后把 context 加入 `restoredContextKeys`，清理 ownership；后续 background/route watcher pointer-neutral。
3. explicit restore 失败时清理 ownership但不要永久标记 restored；本次仍返回 `activated-local-failed stage=restore`，服务端 current 由 post-mutation load 保持。后续明确重新进入/路由重建必须仍有恢复机会。
4. navigate 失败时没有 route watcher；清理 ownership，不标记 restored，保持 `activated-local-failed stage=navigate` 与服务端 current 真相。
5. 新增确定性 deferred 测试：
   - **list-before-route**：post-activation list 先返回 B=current，router.replace 后提交 B context，再允许 explicit restore 完成；断言 restore B 恰好一次、结果 switched、epoch/Broadcast/load 各一次。
   - **route-before-list**：保留现有顺序也恰好一次。
   - **restore failure retryability**：第一次 explicit restore 拒绝并返回 activated-local-failed；ownership 被清理且未标记 restored，随后明确重新进入 B context 可再 restore 一次并成功。
   - **navigate failure**：不残留 ownership，不标记 restored，新 epoch current 仍为 B。
6. 不改结果协议、服务端/API、分页、HTTP、OIDC、typed draft、截图或业务语义。完成后运行 focused/affected Web、lint/typecheck、repo/format/diff，并做 fresh 增量复审；`no-findings` 后才创建新 detached checkout 执行唯一一次 `pnpm validate`。

实现任务：

```text
TASK docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R6-single-pointer-restore-owner base=53fd80666790e2b26604c82add264bf3976d7867 role=implementer workspace=D:\Logixs
```

交回：

```text
HANDOFF docs/planning/tasks/recoverable-work-sessions-v1.md#WS6R6-single-pointer-restore-owner base=53fd80666790e2b26604c82add264bf3976d7867 role=main workspace=D:\Logixs commit=<sha|none>
```

## 验收

- [x] 同一用户同一 context 重复打开只返回原会话；不会产生重复现场。
- [x] 任一 tenant + actor 最多一个 current；并发 activate 不能产生两个 current 或静默丢失 current。
- [x] 菜单打开不改变页面；目标授权、重读、版本校验全部成功后才迁移 current 和导航。
- [x] 目标 401/403/404/409、领域草稿保存失败或 WorkSession 版本冲突时，来源 current、路由和本地输入保持。
- [x] 选品中性保存跨刷新恢复 typed draft，但不改变 outcome、destination、责任、期限、SLA 或交接。
- [x] 装箱 dirty 路径不伪装服务端草稿；放弃、留下和新标签页三条路径均可验证。
- [x] 暂停/关闭 WorkSession 不完成、不延期、不释放、不转移任何领域任务。
- [x] 当前/待续办/草稿已保存/仅浏览器保留/冲突/关闭均有文字，不只靠颜色。
- [x] 1440×900、1024×768、390×844 的选品与装箱真实页面无横向溢出，切换器、失败、冲突和恢复入口可达。
- [ ] 当前切片相关 API/Web/合同/迁移/字典门禁通过；最终 PR 候选执行一次完整 `pnpm validate`。
- [x] 高风险 fresh Claude 只读整体复审完成，finding 均有裁决。

## 明确不做

- 不启动任务全程档案、任务内协作对话、AI 辅助与确认执行或海运运营。
- 不启动全链样本 Brief 4，不删除旧 Demo，不做生产数据写入或页面切换。
- 不读取、修改、格式化、暂存或提交市场智慧基线 WIP、`.tmp/`、`apps/api/.tmp/`。
- 不迁移其余 21 台工作台，不重写全仓 router，不统一所有错误信封，不建设万能权限/草稿/Activity 平台。
- 不合并或 cherry-pick `chore/resume-keyword-v1`；它属于 Claude Code 仓库工作流治理，不是产品能力。

## 进度 log

| 日期       | 阶段   | 负责              | commit   | 说明                                                                                                                                                                                                                       |
| ---------- | ------ | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14 | coding | Claude / Opus 4.8 | 4bca8233 | 从负责人固定主线提交建立功能分支；完成权威、真实消费者、旧 worktree 与实现事实核对；未触碰受保护 WIP                                                                                                                       |
| 2026-10-18 | fix    | Claude / Opus 4.8 | 2d84c567 | 核对四项缺口后建立 `WS6-acceptance-closeout`：只补直接验收证据，测试暴露真实缺陷时才允许最小生产修复；切换到最新 main 的专用验收分支                                                                                       |
| 2026-10-18 | fix    | Codex / unknown   | none     | `WS6` 首次交回 blocked：确认 closed 被列表过滤且无真实 UI 证据，OIDC 项目不匹配验收 spec；主代理复核后 accepted 并下发 `WS6R1`                                                                                             |
| 2026-10-18 | fix    | Codex / GPT-5     | 5037ebba | `WS6R2` 完成 4 项行为修复、普通 typed refresh E2E、OIDC、六状态与单张视觉基线；候选定向门禁全绿，但 fresh validate 稳定失败于范围外 full-chain rehearsal 集成                                                              |
| 2026-10-18 | fix    | Claude / Opus 4.8 | 5037ebba | 主代理定向复现同一 full-chain 文件 3/6 失败并追到 `PrismaFullChainLandingRepository.prisma` 为 undefined；`ccd1f2b1` 加 `@Optional()` 时误删首参 `@Inject(PrismaService)`，单独修复后再回到本分支最终门禁                  |
| 2026-10-18 | fix    | Claude / Opus 4.8 | 7e0ea889 | 串行集成 full-chain 注入修复后 fresh 复审发现 browser_held/closed 服务端终态、完整分页、首次成功恢复、陈旧列表竞态、includeClosed HTTP 校验及验收证据缺口；按实际只读 UI 边界驳回 review-point“可编辑”前提，统一转 `WS6R3` |
| 2026-10-18 | fix    | Codex / GPT-5     | 475e522f | `WS6R3` 修复服务端终态/400-409 边界、完整分页、首次成功恢复、旧响应竞态与验收视觉证据；主代理复现 API 26、Web 105、PostgreSQL 46、OIDC 2、E2E 61 通过                                                                      |
| 2026-10-18 | fix    | Claude / Opus 4.8 | 475e522f | 增量审查确认同 mutation epoch 并发 load 的“较新失败、较旧成功”会丢弃唯一成功响应；接受 `WS6R3-CONCURRENT-FIRST-SUCCESS-01`，下发 `WS6R4`                                                                                   |
| 2026-10-18 | fix    | Codex / GPT-5     | 64d769e0 | `WS6R4` 以 mutation epoch authoritative promise 修复同 epoch 并发首次成功丢失；主代理复现 focused 17/17、Web lint/typecheck、repo/diff 通过                                                                                |
| 2026-10-18 | fix    | Claude / Opus 4.8 | 64d769e0 | fresh 增量复审确认 activate 已成功但 navigate/restore 失败时未推进 epoch，旧 list 可回退 current；接受 `WS6R4-ACTIVATE-EPOCH-01`，下发 `WS6R5`                                                                             |
| 2026-10-18 | fix    | Codex / GPT-5     | 53fd8066 | `WS6R5` 在 activate 确认时推进 epoch、广播并启动 pointer-neutral reload；导航/恢复失败返回服务端已切换的分阶段事实，旧 list 不再回退 current；四场景 deferred 回归与受影响 Web 113/113 通过                                |
| 2026-10-18 | fix    | Claude / Opus 4.8 | 53fd8066 | fresh 增量复审确认 post-activation list 先于 route 提交时 route watcher 与显式流程会双重 restore；接受 `WS6R5-RESTORE-RACE-01`，下发 `WS6R6`                                                                               |
| 2026-10-18 | fix    | Codex / GPT-5     | 379c9053 | `WS6R6` 为显式切换建立按 context 隔离的 restore owner；list/route 两种顺序都只恢复一次，失败清理后仍可明确重入恢复；受影响 Web 116/116 通过                                                                                |
| 2026-10-18 | review | Claude / Opus 4.8 | 379c9053 | fresh 增量复审 `f768b20d..379c9053` 返回 `no-findings`，独立复现 focused 26/26、Web lint/typecheck、diff check；进入最终 clean detached 单命令门禁                                                                         |
| 2026-10-18 | review | Claude / Opus 4.8 | f99cff8d | clean detached `pnpm validate` 仅运行一次：静态阶段通过，root test exit 1 且输出未保留失败名；同 checkout 完整 `pnpm test` 诊断重跑 exit 0。未到达 integration/E2E/build，不声称门禁通过                                   |

## WS6R3 实现证据（2026-10-18）

- **服务端 RED**：`pnpm --filter @logix/api test -- src/modules/work-session` 为 15 passed / 11 failed，closed pointer 与 browser-held/重复 closed close 均继续写 repository；修正 HTTP 夹具后专项为 3 passed / 5 failed，非法或重复 `includeClosed` 返回 500，两个终态冲突也返回 500。真实 PostgreSQL `work-session.integration.test.ts` 为 5 passed / 2 failed，browser-held 被关闭、closed 被 PATCH 复活。
- **服务端 GREEN**：WorkSession unit/HTTP 26/26；真实 PostgreSQL WorkSession + product initiative flow 46/46；`includeClosed` 仅接受省略、单个 `false|true`，browser-held close 与 closed pointer/重复 close 均稳定 409，closed context 只能由 `openOrFocus` 新建不同 sessionId 且保留历史。
- **客户端 RED**：API/composable 定向测试为 5 passed / 7 failed，证明只取第一页、重复 cursor 未拒绝、mount 首次失败后不恢复、新 context 不恢复、旧 GET 晚到会把 closed 改回 resumable；失败态桌面面板实测 `scrollWidth=437 > clientWidth=358`。
- **客户端 GREEN**：每页固定 100 并消费完整 cursor，首屏 100 + 第二页 live/closed 可达且 sessionId 去重，循环 cursor 失败关闭；首次成功 load 按 context 恢复一次，后续后台 load pointer-neutral；close/activate/update/open 确认后使旧 list epoch 失效；失败长文案可在面板内换行。受影响 Web 单测 105/105。
- **业务与 OIDC 证据**：403/404/409、draft 500/409、activate 409 的统一 before/after 快照直接比较 URL、subjectRef、taskRef、服务端 `activeItemKey/contextMode`、界面当前事项/模式、唯一 current 与 typed 输入。typed refresh 使用正式 review point A 与服务端 decisionDraft review point B，刷新后 UI/GET 恢复 typed draft，formal outcome/destination/责任/期限保持。OIDC 2/2 证明单次 401 只重登一次，持续 401 显示“会话无效”且不 activate、不循环重登。
- **视口与截图**：`recoverable-work-sessions.spec.ts` 在 1440×900、1024×768、390×844 为 61 passed / 2 desktop-only skips；新增 desktop `draft_saved`、`conflict`、closed inspection、`browser_held`、失败恢复五张基线，逐张人工核对状态文字、唯一 current、关闭边界、恢复动作和遮挡；窄屏/移动端逐状态验证面板/页面无横向溢出且动作可达。未使用 `--update-snapshots`，原有基线未改。

## WS6R4 实现证据（2026-10-18）

- **同 epoch RED**：`pnpm --filter @logix/web test -- src/work-session/useWorkbenchSessionSwitcher.test.ts src/work-session/useWorkSessions.test.ts` 为 1 failed / 16 passed；mount 的 deferred A 未完成时后发 `load()` 启动 B，B 失败后返回 `false`，A 随后成功仍因 sequence 失效，唯一成功结果没有建立 current 或执行首次 restore。
- **跨 epoch 基线**：新增的双 deferred A/B 用例在生产修改前已通过，证明 WS6R3 的 mutation epoch 隔离原本有效；该项是必须保留的回归护栏，不伪造第二个 RED。close 确认后 B 独立启动，A 最后返回旧 current/resumable 集合时 closed 不复活、current 不回退、restore 不增加。
- **最小实现**：`load()` 在每个 mutation epoch 内只创建一个 authoritative in-flight promise；同 epoch 调用共享结果，mutation 后因 epoch 不同创建新 flight。只有当前 flight 可写 loading/error，旧 flight 不能清除新 flight 的状态。
- **GREEN**：同一 focused 命令为 2 files / 17 tests passed；同 epoch 唯一成功结果被采用且首次 restore 恰好一次，后续后台成功 pointer-neutral；跨 epoch A 晚到仍被丢弃。Web lint 与 typecheck 均通过；未修改 `useWorkSessions`、API、契约、分页、OIDC、E2E 或截图。

## WS6R5 实现证据（2026-10-18）

- **协议 RED**：`pnpm --filter @logix/web test -- src/work-session/useWorkSessions.test.ts src/work-session/useWorkbenchSessionSwitcher.test.ts src/components/workbench/WorkbenchSessionSwitcher.test.ts` 为 6 failed / 25 passed；activate 后未调用确认回调，navigate/restore 异常均错误返回普通 `failed`，组件不显示服务端已切换事实。
- **四场景 RED/GREEN**：双 deferred 旧/新 list 覆盖导航失败、恢复失败、activate 失败和正常成功。前两项 RED 均收到普通失败且旧 epoch 仍可能生效；修复后四项证明 activate 成功时新 list 各 1 次、Broadcast 各 1 次，旧 list 被丢弃且 B 保持唯一 current；activate 失败时新 list 0 次、Broadcast 0 次，原 epoch 的 A=current 正常采用；成功路径 activate/navigate/restore 各 1 次。
- **重复恢复 RED/GREEN**：路由先更新且新 epoch list 在显式 restore 完成前返回时，focused 测试 RED 为 1 failed / 11 passed，`restorePointer` 实际 2 次；将 activate 后的 authoritative reload 标记为 pointer-neutral 后为 3 files / 31 tests passed，restore 严格 1 次，只有显式恢复成功才登记目标 context 已恢复。
- **真实反馈**：新增 `activated-local-failed` 结果，区分 `navigate` 与 `restore`，并分别显示“服务端已切换工作现场，但本页导航/恢复失败，请按当前工作现场重新进入”；activate API 失败继续返回原错误，不推进 epoch、不广播、不导航或恢复。
- **受影响回归**：API client、session helpers、switcher composable/component、typed decision composable 与选品工作台合计 6 files / 113 tests passed；Web lint 与 typecheck 通过。未修改 API、公共契约、Schema、迁移、分页、OIDC、typed draft、E2E 或截图。

## WS6R6 实现证据（2026-10-18）

- **竞争 RED**：`pnpm --filter @logix/web test -- src/work-session/useWorkbenchSessionSwitcher.test.ts src/work-session/useWorkSessions.test.ts` 为 2 failed / 24 passed。post-mutation list 在 pending navigation 前先写入 B=current 后，route watcher 与显式流程都调用 `restorePointer(B)`；成功与首次 restore 失败场景均在重入前实际调用 2 次。
- **顺序 GREEN**：list-before-route 与 route-before-list 都保持 activate 1 次、Broadcast 1 次、post-mutation list 1 次、`restorePointer(B)` 1 次并返回 `switched`；mutation 前 list 最后返回时不覆盖 B=current。focused 为 2 files / 26 tests passed。
- **失败清理与重试**：首次 explicit restore 拒绝时只调用 1 次并保持 `activated-local-failed / stage=restore`，B 仍为 current；owner 清理且 B 不进入 restored 集合，随后 context 明确离开再进入时允许第 2 次 restore 成功，后续 background load 不产生第 3 次。navigate 拒绝时本次 restore 为 0，后续进入 B 恢复 1 次且后台不重复。
- **最小实现**：activate 确认时为目标 context 登记只解析、不拒绝的短期 owner promise；同 context watcher 只等待 owner，其他 context 仍使用既有 `contextRecoveries`。`try/finally` 在成功、navigate 失败和 restore 失败后按 identity 清理 owner；只有显式 restore 成功才登记 `restoredContextKeys`。
- **受影响回归**：API client、session helpers、switcher composable/component、typed decision composable与选品工作台合计 6 files / 116 tests passed；Web lint 与 typecheck 通过。未修改 `useWorkSessions`、组件文案、API、公共契约、Schema、迁移、分页、OIDC、typed draft、E2E 或截图。
- **fresh 增量复审**：独立只读复审 `f768b20d..379c9053` verdict 为 `no-findings`；复审方独立运行 focused 2 files / 26 tests、Web lint/typecheck 与 `git diff --check` 均通过，确认 ownership 按 context 隔离、成功后登记 restored、navigate/restore 失败清理且可重试，new-tab 与结果协议未变化。

## 最终候选验证记录（2026-10-18）

- 候选 `f99cff8d` 在新的 detached clean checkout `D:\Logixs-ws6-final-f99cff8d` 验证；Node `v22.22.3`、pnpm `10.15.1`、Playwright `1.63.0`，PostgreSQL/MinIO/Temporal/Temporal DB 健康，5173/5174 无监听。
- 严格只启动一次 `pnpm validate`。该命令依次通过 `repo:check`、workbench purposes、contract check/drift、dictionary、Prisma generate、lint、format 和 typecheck；随后在 root `pnpm test` 阶段 exit 1，未到达 integration、E2E 和 build。
- 首次失败输出因终端截断未保留具体失败测试名。为诊断而非替代门禁，在同一未修改 checkout 单独运行完整 `pnpm test`，结果 exit 0：仓库脚本全部通过、Turbo 4/4，API 313 文件/1628 项通过；未形成可复现的业务代码或单一测试失败反证。
- 不以分段诊断通过冒充 `pnpm validate` 通过，不盲目放宽 timeout，不启动第二次 `validate`。单命令门禁继续未勾选，task 保持 `review`。

## 最终验证记录（2026-10-14）

- API lint/typecheck/build 通过；API 单元测试 311 文件、1611 项通过。
- Web lint/typecheck/build 通过；Web 单元测试 161 文件、764 项通过。
- 真实 PostgreSQL 全量 integration 35 文件、224 项通过；其中 WorkSession 4 项、选品流程 38 项、迁移升级 14 项。
- 可恢复工作会话三视口 E2E 12/12 通过；选品与装箱在 1440×900、1024×768、390×844 共 6 张像素基线经人工核对通过，无页面横向溢出。
- contract:check、contract:drift、data-dictionary:check、db:generate、root lint/typecheck/build、workbench-purposes:check 和 git diff --check 通过。
- repository walker 已经 TDD 修复为只排除 git-ignored 的 `.superpowers/sdd/**` 执行 workspace，其他 `.superpowers/**` 仍受检查；clean clone 的 `repo:check` 通过。当前 checkout 只因受保护市场基线 WIP 不属于本 brief 而正确阻断 scope。
- 最终 committed HEAD 的 clean clone 中，repo/purpose/contracts/dictionary/db/lint/format/typecheck/test/integration/build 全部通过；API 311 文件/1611 项、Web 161 文件/764 项、PostgreSQL integration 35 文件/224 项。
- 标准 `pnpm validate` 在 E2E 阶段因另一个会话占用 5173 且指纹不同而失败关闭；未终止该服务。等价分轨门禁通过：非 OIDC E2E 241 passed / 26 viewport skips，OIDC 5/5，reference visual 18 passed / 15 viewport skips。未声称单命令 validate 通过。
- fresh Claude 整体复审已完成；9 项 findings 全部 accepted 并在唯一修复批次处置，当前回到 `review`；PR #179 已创建并等待最终 CI。

## 独立复审裁决（2026-10-14）

- `WS-REV-001 accepted/fixed`：activate 要求 source 是真实 current 且 source != target；真实 PostgreSQL 并发 A→B / A→C 只有一人成功，另一人稳定冲突，数据库仍恰好一个 current。
- `WS-REV-002 accepted/fixed`：来源指针与 sourceStatus 并入 activate 同一事务，前端不再先 PATCH 来源；目标拒绝或冲突不产生来源部分提交。
- `WS-REV-003 accepted/fixed`：两个消费者重读后比较 `domainVersionSeen`；不一致先把目标标为 conflict 并显示 seen/latest，未进入 write context。
- `WS-REV-004 accepted/fixed`：装箱 `new-tab` 预开真实标签页、验证目标、原子 activate 后导航；Playwright 证明原标签和未保存 seal 保留，目标进入新标签页。
- `WS-REV-005 accepted/fixed`：Open/Update/Activate/Close 对 top-level keys、contractVersion、RouteContext/subject/task 一致性、状态和版本做运行时失败关闭；客户端 draftRef 被拒绝，`draft_saved` 只在事务内绑定真实领域草稿。
- `WS-REV-006 accepted/fixed`：接入 BroadcastChannel、window focus、visibilitychange 与 sessionStorage active pointer；每次变更发布并重读服务端唯一 current。
- `WS-REV-007 accepted/fixed`：关闭 current 固定 409，必须先切换；不会留下零 current。
- `WS-REV-008 accepted/fixed`：切换器补 Tab/Shift+Tab 循环、Escape/关闭后焦点返回，并在打开时令工作区 inert。
- `WS-REV-009 accepted/fixed`：撤回未直接验真的验收勾选；修复后证据更新为 API 1611、Web 764、integration 224、E2E 12/12，完整 validate 仍如实记录为本机 5173 外部会话冲突，等价 clean-clone/分轨门禁通过。

所有 accepted finding 均已用失败反证转绿并完成相关全套回归；按执行纪律不发起第二轮 reviewer。无 deferred minor。

## 集成收口（2026-10-16）

- PR #179 已于 2026-10-14 合并到 `main`，merge commit `2ed5f9b2`。
- 最终 CI run `38528039982` 中 `changes`、`static`、`unit`、`build`、`e2e`、`dictionary`、`quality` 成功；`security` 由路径分类器跳过。
- 代码已合入不等于本 brief 验收完成；2026-10-16 只更新 merge/CI 事实并保持 `review`。2026-10-18 已按四项缺口建立 `WS6-acceptance-closeout` 并转为 `fix`；401/403/404/409 失败保持、typed draft 跨刷新、全状态文字和单命令 `validate` 仍未勾选，必须由当前切片直接验真。
