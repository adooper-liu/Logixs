---
status: coding
branch: feat/task-collaboration-v1
verification: "TC2 accepted at 23594064 on 2026-10-19 under the fixed review cadence: one main review per slice, one whole-branch independent review only at TC4. Main review verified the repaired subject-scoped GET and consumer-owned collaboration model, focused Web unit 5 files/48 tests, Web lint/format/typecheck/build, Playwright three projects 6 applicable tests, repo/diff checks, and manual review of 1440/1024/390 screenshots. Current slice: TC3-customs-second-consumer."
owner: main
writer: codex
risk: high
dependsOn:
  - task-archive-ui-consumer-v1
  - task-archive-second-consumer-customs-v1
  - recoverable-work-sessions-v1
writeScopes:
  - docs/planning/tasks/task-collaboration-v1.md
  - docs/planning/progress-board.html
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - packages/contracts/schemas/v1/task-collaboration.schema.json
  - packages/contracts/schemas/v1/index.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - scripts/generate-contracts.mjs
  - database/schema.prisma
  - database/migrations/20261018150000_add_task_collaboration/migration.sql
  - database/dictionary/**
  - apps/api/src/app.module.ts
  - apps/api/src/modules/identity/domain/role-capabilities.ts
  - apps/api/src/modules/identity/domain/role-capabilities.test.ts
  - apps/api/src/modules/work-execution/index.ts
  - apps/api/src/modules/work-execution/work-execution.module.ts
  - apps/api/src/modules/document-records/**
  - apps/api/src/modules/task-collaboration/**
  - apps/api/src/infrastructure/integration/task-collaboration.integration.test.ts
  - apps/web/src/api/taskCollaboration.ts
  - apps/web/src/api/taskCollaboration.test.ts
  - apps/web/src/composables/useTaskCollaboration.ts
  - apps/web/src/composables/useTaskCollaboration.test.ts
  - apps/web/src/components/task/TaskContextPanel.vue
  - apps/web/src/components/task/TaskContextPanel.test.ts
  - apps/web/src/components/task/TaskCollaborationPanel.vue
  - apps/web/src/components/task/TaskCollaborationPanel.test.ts
  - apps/web/src/views/TaskWorkbench.vue
  - apps/web/src/views/TaskWorkbench.test.ts
  - apps/web/src/views/CustomsWorkbench.vue
  - apps/web/src/views/CustomsWorkbench.test.ts
  - apps/web/e2e/task-collaboration.spec.ts
  - apps/web/e2e/task-collaboration.spec.ts-snapshots/**
exclusiveLocks:
  - business-policy:task-collaboration-v1
  - database-schema
  - database-migrations
  - database-dictionary
  - public-contract:task-collaboration-v1
  - generated:contracts
  - authz-control-plane
  - ui-pattern:task-context-v1
  - visual-baseline:task-collaboration-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - doc/cross-border-supply-chain/11-external-collaboration.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/业务工作台持续打磨受阻原因.md
  - docs/product/UI_SYSTEM.md
  - docs/product/domain/TASK_WORK_ORDER_CONTRACT_V1.md
  - docs/product/domain/IDENTITY_ACCESS_MODEL_V1.md
  - docs/product/domain/ACTION_PERMISSION_CONTRACT_V1.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - docs/planning/tasks/task-archive-ui-consumer-v1.md
  - docs/planning/tasks/task-archive-second-consumer-customs-v1.md
  - docs/planning/tasks/recoverable-work-sessions-v1.md
uiStructure:
  - 共享 TaskContextPanel 只建一次，固定承接办理、档案、协作三种已实现模式；工作台只能传精确 subjectRef/workRef、可用模式和既有办理/档案 slot，不得复制模式导航、消息线程、composer、焦点或滚动逻辑
  - TaskWorkbench 是首个真实消费者：PageHeader、责任上下文、决策条、左任务队列和中任务详情保持；右栏由单一“任务上下文”承接档案与协作，协作不成为第四栏或独立页面
  - CustomsWorkbench 是第二个差异化消费者：保持 RoleWorkbenchFrame stacked 几何、移动清关上下文锚点和办理表单常驻；共享 TaskContextPanel 原样承接办理、档案、协作，不允许 Customs 自建第二套协作 UI
  - 协作线程固定为当前任务消息流、回复上下文、Mention/EvidenceRef、可见范围、发送区和稳定回执；正式业务动作只通过独立办理入口执行
uiMustStayVisible:
  - 当前工作台、当前对象、当前 NodeTask、人话任务名称、当前责任/期限，以及右栏当前模式“办理/档案/协作”
  - 协作可见范围、消息作者与时间、回复对象、Mention、EvidenceRef 附件引用、发送中/失败/重试和更早消息入口
  - “消息不改变任务状态或责任；EvidenceRef 只是引用，核验状态以正式证据为准”的短边界文字；不得变成免责声明墙
  - 任务/对象切换、撤权、404、分页快照变化或发送失败时，旧线程立即清空且恢复动作可达
uiProgressiveDisclosure:
  - 原始 actorRef、messageId、sourceRef、EvidenceRef ID、visibility code、idempotency key 与技术 trace 进入消息详情，不常驻占用办理主线
  - 回复链只展开当前父消息摘要；V1 不建设任意深度树形楼中楼，服务端保留 parentMessageId 便于追溯
  - 已完成任务的历史线程可按权限只读查看；若负责人选择首版只允许 live task 发言，禁用原因就地显示
  - 更早消息使用稳定 cursor 加载；不自动无限滚动，不让消息区成为第二个嵌套纵向滚动容器
uiForbidden:
  - 每个工作台各自创建消息组件、API adapter、mode state、焦点/滚动记忆或权限判断；禁止 CustomsCollaborationPanel、StuffingChat 等私有复制
  - 复用 OpsAssistantSession/OpsAssistantMessage、OpsNotification、Inbox/Outbox、WorkSession 或 TaskArchive/ObjectActivity 作为可写协作事实
  - 频道、私聊、群聊、任意邀请、presence、已读回执、消息编辑/删除、文件上传、AI 总结、未来模式占位或通用社交 IM
  - Mention 转移责任、消息文字完成任务、文件名冒充证据、已读冒充领取、按钮可见性替代服务端 capability/对象范围授权
  - 把 tenantId、authorActorId、作者名称、任务状态、责任/SLA、任意业务 JSON 或证据正文放进客户端可伪造字段
uiViewportEvidence:
  - 1440x900：三栏宽度与唯一 pane scroll owner 不变；TaskWorkbench 档案/协作和 Customs 办理/档案/协作只切右栏局部，消息、回复、附件和 composer 可见且无横向溢出
  - 1024x768：TaskWorkbench 保持左抽屉/窄轨与中右并列；Customs 保持 stacked 的上方任务/事实、下方全宽上下文；错误、重试、加载更早消息和 composer 可达，无嵌套纵向滚动
  - 390x844：TaskWorkbench 仍为队列→详情→上下文三屏，档案/协作是上下文内模式而非第四屏；Customs 保持任务池→清关事实→任务上下文和移动锚点；软键盘下发送/取消回复/失败恢复可达且无页面横向溢出
---

# 任务：任务内协作对话 V1

## 路线图位置与岗位结果

- **位置**：UI 统一主线单元四。任务档案两个差异化真实消费者、可恢复工作会话和共享办理壳已经收口；本任务完成后才进入 AI 辅助与确认执行。
- **目标岗位**：围绕同一任务协同处理事实、疑问、证据和下一步的内部业务岗位。
- **核心结果**：岗位不离开当前任务即可查看有权限的任务协作、回复同一上下文、提醒已知参与者并引用正式 EvidenceRef；消息可靠落账、失败可恢复，但不改变任务状态、责任、期限、证据核验或正式业务结果。
- **共享组件决定**：负责人 2026-10-18 明确任务内协作是共享可复用组件，禁止每个工作台重新建设。唯一共享实现是 `TaskContextPanel + TaskCollaborationPanel + useTaskCollaboration + task-collaboration API`；`TaskWorkbench` 首个消费，`CustomsWorkbench` 第二个差异化消费并固定接口。
- **完成边界**：V1 证明内部任务协作机制和两个真实消费者，不建设通用 IM，不宣称正式人员目录、外部参与者、自定义群组、完整对象权限平台或任一工作台达到 validated。

## 已证实事实

1. 权威设计已批准：协作线程绑定 `subjectRef + workRef`，支持消息/回复、Mention、可见范围、EvidenceRef 和正式来源引用；Mention/消息/附件/已读均不得改变责任、任务或证据状态。
2. 当前唯一权威任务身份是 `NodeTask.id`；`TaskItem.taskId`、路由 `task/taskId` 只是前端别名。V1 精确引用：`subjectRef={kind:'container',id}`、`workRef={kind:'node_task',id}`；tenant 从认证身份取得。
3. 没有生产任务协作模型、表、迁移、API、capability、消息/回复/Mention/附件模型或前端 adapter。
4. `TaskArchivePanel` 是只读、container-scoped 当前可见来源组合，不是消息存储；当前明确显示协作轨道未接通。
5. `OpsAssistantSession/Message` 是 tenant+actor 私有 AI 会话，消息只有 system/user/assistant；没有共享任务、回复、Mention、可见范围、EvidenceRef、幂等或来源引用，禁止复用。
6. `OpsNotification` 是单向问题通知，Inbox/Outbox 是集成投递，WorkSession 是个人 UI 恢复；三者均不是协作事实。
7. 现有 `WorkExecutionRepository.findTaskInTenant` 能按 tenant 读取任务；本任务需要新增窄公共 port 校验 `NodeTask` 与 container subject 一致，协作模块不得跨包读取 repository 内部路径。
8. 当前没有正式人员/团队目录。Mention V1 只能引用服务端投影的当前 actor 和当前任务已知 assignee actor；任意 displayName、任意 actor ID 或角色字符串不得由客户端自由提交。
9. 现有 guard 只执行 capability，服务端仍须按 tenant + task + subject 父链失败关闭；跨租户、不可见任务、subject/work 不一致统一 not-found，不能枚举。

## 共享架构与固定接口

```text
TaskCollaboration contract + DB aggregate
        ↓
TaskCollaboration API / service-side policy
        ↓
useTaskCollaboration（唯一 API/竞态/分页编排）
        ↓
TaskContextPanel（唯一模式/hidden-inert/焦点/滚动 facade）
        ├── work slot
        ├── archive slot
        └── TaskCollaborationPanel（唯一消息/回复/Mention/EvidenceRef UI）
        ↓
TaskWorkbench → CustomsWorkbench → 后续精确 task 消费者
```

### 1. 任务引用

```ts
type CollaborationSubjectRefV1 = { kind: "container"; id: string };
type CollaborationWorkRefV1 = { kind: "node_task"; id: string };
```

- Thread 唯一键为 tenant + subject kind/id + work kind/id + visibility scope。
- Application 每次读写重新用 work-execution public port 解析 NodeTask，验证 tenant、`task.containerId === subjectRef.id`、任务状态和对象可见性。
- 客户端不传 tenantId、authorActorId、作者名称或 capability。

### 2. 最小持久化

- `task_collaboration_thread`：tenant、immutable subject/work refs、visibility scope/policy version、created actor/time；同一精确 scope 唯一。
- `task_collaboration_message`：thread、author actor、可选 parentMessageId、body、occurred/recorded time、per-author idempotency key、payload hash；V1 append-only。
- `task_collaboration_message_mention`：message + actorRef；只能取服务端返回的 mention options，不授予可见权、不转责任。
- `task_collaboration_message_evidence_ref`：message + EvidenceRecord ID；服务端独立重验 tenant、subject 和 evidence.read，不复制文件名/正文/核验结论。
- `task_collaboration_message_source_ref`：可选正式 action/result/evidence typed reference；只保存引用与可选版本，不嵌业务 payload。

V1 不建 participant membership、订阅、presence、read receipt、edit/delete 或文件 blob。

### 3. API

- `GET /api/node-tasks/:taskId/collaboration?subjectKind=container&subjectId=...&pageSize&cursor`
- `POST /api/node-tasks/:taskId/collaboration/messages`
- 回复仍用同一 POST，通过 `parentMessageId` 表达；不另建工作台专用 endpoint。
- 列表按 `(recordedAt,id)` 稳定 cursor，返回 `asOf`、`nextCursor`、visibility label、server-computed `canPost/postDisabledReason`、mention/evidence options。
- POST 原子校验 task/subject、capability、visibility、parent 同 thread、mention options、EvidenceRef、source refs、idempotency/payload hash；相同 key+payload 返回原消息，不同 payload 稳定冲突。

### 4. 唯一共享 UI API

```ts
type TaskContextMode = "work" | "archive" | "collaboration";

type TaskContextPanelProps = {
  modelValue: TaskContextMode;
  contextKey: string | null;
  modes: readonly TaskContextMode[];
  collaboration: TaskCollaborationPanelModel | null;
};

// slots: anchor? / work? / archive?
// emits: update:modelValue / submit / retry / loadMore
// collaboration 无 slot，由共享组件唯一渲染
```

- 固定人话标签：办理 / 档案 / 协作；不做任意模式配置引擎。
- 未实现或无权的模式不出现在 `modes`，不显示 coming soon。
- contextKey 变化立即清空旧线程、回复、Mention、EvidenceRef 选择、错误与未发送输入；晚到响应不得落入新任务。
- work 保持挂载但 inactive 时 hidden + inert + aria-hidden；每个模式独立恢复滚动/焦点。
- `WorkbenchLayout` 继续只管几何，`RoleWorkbenchFrame` 不变成任务状态机；协作组件不得建立内层纵向 scroll owner。

## 权限与业务政策

### 固定安全不变量

- 认证、tenant、默认拒绝、服务端 capability、任务/对象父链、未知值拒绝、跨租户不可枚举、EvidenceRef 再授权不可关闭。
- Mention 不授予读权；thread 可见不等于 evidence 可见；message body 永远不触发 task/work-order/lifecycle/责任/SLA 状态变化。
- `OpsAssistant`、Notification、Inbox/Outbox、WorkSession、Archive 均不得承载协作写事实。

### `TC-D01` 首版可见与发送政策（负责人已定）

| 选项      | 政策                                                                                                                                                                                                           | 收益                                                             | 成本/风险                                                                 | 可逆性                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| A（推荐） | 内部任务范围：`task.read` + tenant/subject/work coherence 可读；新增 `task.collaborate` 才可发/回。首版 visibility 固定 `task_scope`；Mention 仅当前 actor 与任务已知 assignee；completed 只读，live task 可发 | 最小权限、读写分开、无需人员目录；后续可扩 explicit participants | 不能任意邀请、外部方或团队 Mention；需新增 capability 与角色包            | 高：后续增加 visibility/member policy，不迁移消息语义 |
| B         | 复用 `task.read` 同时读写，visibility 固定 task_scope                                                                                                                                                          | 实现最少                                                         | 读权限静默变写权限，审计/最小权限不成立；未来拆分要迁移角色政策           | 中低                                                  |
| C         | 首版即建 participant membership/invite，只有成员读写                                                                                                                                                           | 精细可见范围                                                     | 当前无人员/团队目录，容易造假 membership；显著扩大 Schema、UI、管理和恢复 | 中                                                    |

**负责人结论：2026-10-18 选择 A。** `task.read` + tenant/subject/work coherence 可读固定 `task_scope`；新增 `task.collaborate` 才可发送/回复；completed 只读；Mention 仅服务端投影的当前 actor 和任务已知 assignee。V1 capability 最小映射：`field_operator / operations_dispatcher / review_supervisor / manager` 增加 `task.collaborate`，`audit_analyst` 保持只读；其他现有角色不因本任务获得任务发言权。外部参与者、团队目录、显式邀请与自定义 visibility 延期。

## 智慧开启基线继承

| 基线结论                                         | 处置 | 依据                             | 本任务落点                                                      |
| ------------------------------------------------ | ---- | -------------------------------- | --------------------------------------------------------------- |
| 全局：状态、责任、权限和交接不能由各页自行发明   | 沿用 | AGENTS 五面/安全纪律             | 消息不改变状态/责任；服务端父链与 capability 授权               |
| 全局：交出去不等于接收，Mention 不能冒充责任主体 | 补强 | UI 标准 §13                      | Mention 只提醒；正式责任仍由 task/work-order/领域动作拥有       |
| 持续打磨受阻：横向平台不能脱离真实消费者         | 沿用 | 现行路线与两个档案消费者经验     | 共享组件与 TaskWorkbench 同片，Customs 第二片验真，不先铺 23 台 |
| 不能宣布 validated 不等于不能推进机制薄片        | 沿用 | 08-role-workbenches 真实样本门禁 | synthetic rehearsal 可验机制；真实岗位只门禁 validated          |

## 执行切片

### `TC0-owner-policy-and-contract`

- **目标**：负责人选定 TC-D01 后，把唯一政策写入本 brief；Codex 测试先行交付公共 JSON Schema/生成类型、DB 模型/迁移、字典与 domain normalization，不接 Controller/UI。
- **TDD**：契约覆盖消息/回复/Mention/EvidenceRef/sourceRef、cursor page、post command/result；domain 测试固定 body 限制、parent 同 thread、visibility 固定值、mention/evidence 去重、idempotency payload hash 和 append-only。
- **契约与持久化边界**：
  - `CollaborationSubjectRefV1.id`、`CollaborationWorkRefV1.id`、thread/message/parent/EvidenceRecord ID 继续使用 UUID；认证 `actorId` 与 `WorkOrder.assigneeId` 沿用 identity/work-execution 的非空字符串身份，长度 `1..128`，不得收窄为 UUID。Mention option 与 POST 的 `mentionActorIds` 使用同一 actor ID 规则。
  - POST command 只允许 `contractVersion / subjectRef / workRef / body / parentMessageId / mentionActorIds / evidenceRecordIds / sourceRefs / idempotencyKey`；runtime domain normalization 必须拒绝所有额外字段，至少直接覆盖 `tenantId`、`authorActorId`、`visibility`，并拒绝错误的 subject/work `kind`，不得静默丢弃或改正客户端伪造值。tenant/author 仍只来自认证身份。
  - `body` trim 后 `1..4000`；Mention/EvidenceRef/sourceRef 各最多 20，规范化后排序去重；idempotency key trim 后 `1..200`；payload hash 只覆盖规范化业务 payload，不含 idempotency key。source kind 固定 `action | result | evidence`，ID trim 后 `1..200`，version 为 `>=1` 的整数或 `null`；数据库唯一性按 `NULLS NOT DISTINCT` 对齐。
  - thread scope 唯一键固定 tenant + container subject + node_task work + `task_scope`；policy version V1 固定从服务端写入正整数。message 幂等唯一键固定 thread + authorActorId + idempotencyKey；同 key/同 payload 重放、同 key/异 payload 冲突由 TC1 persistence 实现。
  - 迁移必须是单事务的 additive migration，显式 `BEGIN` / `COMMIT`；5 张表、索引、复合父消息 FK、nullable source-version 唯一性和 append-only trigger 必须随迁移全成或全不成。Prisma 可表达对象与迁移一致；EvidenceRecord 只做逻辑引用，TC1 每次重验 tenant/subject/evidence.read，不增加类型不兼容 FK。
  - 字典 annotations 必须把本 brief 已定的 5 张表和各字段语义标为已确认实现，引用 `task-collaboration-v1` 权威来源并登记 `task-collaboration` owner module；不得把已定 thread/work/body/actor/parent/Mention/EvidenceRef/sourceRef/visibility/policy 语义留作 `needs_business_confirmation`。
- **TC0 首轮评审 disposition（2026-10-18）**：
  - `TC0-R1 accepted`：ActorRef/mentionActorIds 被错误收窄为 UUID；会拒绝仓库真实身份 `operator-1` / `user-1` 与既有 assignee。按上述 `1..128` 字符串规则修复契约、fixtures、生成类型、domain 测试与实现。
  - `TC0-R2 accepted`：domain normalizer 只拒绝 visibility；实测会静默接受并丢弃伪造 tenant/author，且把错误 kind 改成固定 kind。增加 exact-key runtime 校验和明确拒绝测试。
  - `TC0-R3 accepted`：迁移含 17 个 DDL 对象但无显式事务边界；按数据库迁移原子性要求增加 `BEGIN` / `COMMIT`。
  - `TC0-R4 accepted`：字典生成物将本 brief 已定的大多数新字段标为 `needs_business_confirmation`；补齐字段级语义、来源和 owner 后重新生成全部字典派生产物。
  - `TC0-R5 accepted`：现有 9 个 domain 测试没有覆盖 EvidenceRef/sourceRef 非法值、数组上限、错误 kind、伪造 tenant/author、parent missing/unexpected、duplicate message、mixed-thread append 等失败边界；补齐后再以新总数报告，不得仍以 9/9 作为完整 TC0 domain 证据。
- **验证命令**：先运行新增回归测试确认 RED，再实现并运行 `pnpm --filter @logix/api test -- src/modules/task-collaboration/domain/task-collaboration.test.ts`、`pnpm contract:generate`、`pnpm contract:check`、`pnpm contract:drift`、`pnpm db:generate`、`pnpm exec prisma validate --schema database/schema.prisma`、`pnpm data-dictionary:generate`、`pnpm data-dictionary:check`、`pnpm --filter @logix/api lint`、`pnpm --filter @logix/api typecheck`、`pnpm repo:check`、TC0 文本文件 scoped Prettier check 与 `git diff --check`。不运行全仓 `pnpm validate`，留待 TC4。
- **停止条件**：政策未定；需要任意参与者/外部方；EvidenceRef 无法通过正式 port 验证；设计试图复用 assistant/notification/archive。

### `TC1-service-auth-persistence`

- **目标**：新增独立 `task-collaboration` 模块和两个跨模块窄公共 port；实现 tenant/task/subject coherence、capability、分页、回复、Mention/EvidenceRef/sourceRef、幂等与真实 PostgreSQL，不接 Web/UI。
- **服务端授权**：
  - GET route 绑定 `task.read`；POST route 同时绑定 `task.read + task.collaborate`，继续由全局认证/授权 guard 执行，不做 Controller 角色判断。
  - `field_operator / operations_dispatcher / review_supervisor / manager` 增加 `task.collaborate`；`audit_analyst` 与其他既有角色不获得该 capability。completed task GET 可读、POST 返回稳定只读业务拒绝。
  - task 不存在、跨 tenant、container subject 与 NodeTask 不一致、不可见 EvidenceRef 在协作边界统一 `RESOURCE_NOT_FOUND`，不得枚举是哪一层失败；capability 缺失继续使用全局 403。
- **跨模块公共 port**：
  - work-execution 新增只读 task-collaboration context resolver public port；按 tenant + NodeTask.id 读取，验证 `containerId === subjectRef.id`，只投影 task id/state/containerId 与去重后的非空 `WorkOrder.assigneeId`。`work-execution/index.ts` 只导出 token/type，module 注册并导出 port，collaboration 禁止导入 work-execution 内部 repository/service 路径。
  - document-records 新增窄 EvidenceRef 可读性/coherence public port；输入 tenant + container subject + 精确 evidence IDs，只确认这些 EvidenceRecord 当前属于同 tenant/container 且当前可读。缺失、跨 tenant、跨 subject 或不可见一律失败关闭；不导出 repository，不增加 DB FK，不返回/复制证据正文、文件名或核验结论。
- **Application / persistence**：
  - 独立 `task-collaboration` module 按 Transport → Application → Domain ← Infrastructure 分层；Controller 只解析/映射，Application 每次 GET/POST 重新调用 task context port，POST 再调用 EvidenceRef port 并校验 capability、completed、parent 同 thread、Mention option 和 source refs。
  - mention options 只由当前认证 actor 与 task resolver 返回的已知 assignee 组成，按 actor ID 去重；客户端 displayName、author、tenant、任意 actor ID 或角色字符串均不可信。V1 没有正式人员目录时 label 使用服务端确定的稳定 actor ID，不发明姓名。
  - 列表按 `(recordedAt DESC, id DESC)` keyset，pageSize `1..100`；cursor 必须绑定 tenant、subject、work、`task_scope`、`asOf` 和最后 tuple。所有后续页固定 `recordedAt <= asOf`，cursor 损坏或上下文不符明确 400，不静默回第一页；读取 `pageSize + 1` 判定 nextCursor。
  - POST 单事务：以精确 thread scope 取得 PostgreSQL transaction advisory lock，find-or-create thread，再按 `thread + authorActorId + idempotencyKey` 判定 replay/conflict，并原子写 message、mentions、evidence refs 与 source refs。相同 key + 相同 normalized payload hash 返回原 message；相同 key + 不同 hash 返回稳定 409。唯一约束为并发兜底，处理 Prisma `P2002/P2034`，不得仅靠 upsert。
  - 错误使用稳定应用错误码和现有响应边界；不泄露 Prisma、SQL、栈、其他 tenant/task/evidence 存在性。POST 的 `occurredAt/recordedAt/author` 均由服务端产生，客户端 command 不扩字段。
- **TDD**：
  - role capability 测试覆盖四个 grant、`audit_analyst` deny 及无关角色不扩权；Controller metadata 测试覆盖 GET/POST capability 组合。
  - task context port 覆盖 missing/cross-tenant/null-or-mismatch container、completed state、当前 actor + assignee Mention 投影与公共导出边界。
  - EvidenceRef port 覆盖同 tenant/container 成功，以及 missing/cross-tenant/wrong-container/unreadable 统一失败。
  - service/repository/API 覆盖无 task.read、无 task.collaborate、task/container mismatch、completed POST、invalid parent、invisible Mention/Evidence、same-key same/different payload、malformed/cross-scope cursor、`asOf` snapshot drift。
  - 真实 PostgreSQL integration 覆盖两个 tenant/container/task/assignee/evidence；并发首写得到一个 thread、消息/子引用无孤儿；同 key 并发收敛；数据库复合父 FK、nullable source uniqueness 与五表 append-only trigger 实际生效。
- **精确写入范围**：仅 frontmatter 已授权的 `apps/api/src/app.module.ts`、identity role capability 两文件、work-execution `index.ts/module.ts` 与 `apps/api/src/modules/task-collaboration/**`、`apps/api/src/infrastructure/integration/task-collaboration.integration.test.ts` 可直接用于 TC1。为实现已定 EvidenceRef 再授权，额外允许在 `apps/api/src/modules/document-records/**` 内新增/修改窄 public port、module/index/manifest 和对应测试；不得修改 EvidenceRecord Schema/迁移。若实际路径超出这些范围，先 blocked 交回主代理更新 frontmatter。
- **TC1 首轮评审 disposition（2026-10-18）**：
  - `TC1-R1 accepted`：Controller 把 POST 注册为 `/node-tasks/:taskId/collaboration`，与本 brief 固定的 `/node-tasks/:taskId/collaboration/messages` 不一致，且现有 metadata 测试把错误路径固化。修复 Controller、测试和 authz route 证据；GET 路径保持不变。
  - `TC1-R2 accepted`：当前 GET 只要求 `task.read` 却无条件查询 Evidence options，并通过 presenter 返回历史消息中的全部 EvidenceRef ID；POST 也只要求 `task.read + task.collaborate` 就允许引用 Evidence。违反“thread 可见不等于 evidence 可见”和 EvidenceRef 独立 `evidence.read` 再授权。修复为：线程与消息正文仍按 `task.read` 可读；没有 `evidence.read` 时不查询/不返回 `evidenceOptions`，所有消息的 `evidenceRefs` 服务端按当前请求身份过滤为空；有 `evidence.read` 时才逐页批量重新授权并返回当前仍可读的引用。POST 含非空 `evidenceRecordIds` 时还必须要求 `evidence.read`，缺 capability 返回全局一致的 403；无附件消息仍只需 `task.read + task.collaborate`。
  - `TC1-R3 accepted`：`resolveExact` 使用 repository `findByIds(ids)` 先跨 tenant 读取，再在 Application 内存中过滤；违反用户读写从数据访问边界携带 tenant scope 的安全基线。新增/收窄专用 repository 查询，使 exact IDs 在 SQL/Prisma where 中同时携带 `tenantId + subjectType=container + subjectId + validity=effective + id IN (...)`；不得把通用 `findByIds` 当作协作授权查询。测试必须直接断言 repository 调用带完整 scope，并在 PostgreSQL integration 证明跨 tenant/subject 不返回。
- **验证命令**：先运行新增测试取得 RED；GREEN 后运行 focused API unit、`pnpm --filter @logix/api test:integration -- src/infrastructure/integration/task-collaboration.integration.test.ts`、API lint/typecheck/build、`contract:check`、`contract:drift`、`db:generate`、Prisma validate、dictionary check、`authz:routes`、`repo:check`、TC1 支持文本 scoped Prettier check 与 `git diff --check`。运行 integration 前按仓库契约启动本地 PostgreSQL；全仓 `pnpm validate` 仍留 TC4。
- **不做**：Web/UI、TaskWorkbench/Customs、Mention 任意查询/人员目录、participant membership、notification、ObjectActivity/Archive 投影、频道/私聊/read receipt/edit/delete/file upload/AI；不修改 TC0 migration/domain 语义来迁就 service。
- **停止条件**：只能靠前端隐藏；需要跨写 NodeTask/Evidence；错误泄露他租户存在性；事务无法原子保存 message/mentions/refs；EvidenceRef 无法经正式窄 public port 独立重验。

### `TC2-shared-ui-first-consumer`

- **目标**：一次性建立唯一 Web API adapter、`useTaskCollaboration`、`TaskContextPanel`、`TaskCollaborationPanel`，并在 `TaskWorkbench` 首次真实消费；不修改 Customs 或其他工作台。
- **共享接口与状态所有权**：
  - `taskCollaboration.ts` 只消费 `@logix/contracts` 生成类型并暴露 GET list 与 POST message 两个操作；只提交 subject/work/body/parent/Mention/Evidence/sourceRefs/idempotencyKey，不接受 tenant/author/visibility/capability。路径严格使用 TC1 的 GET `/api/node-tasks/:taskId/collaboration` 与 POST `/api/node-tasks/:taskId/collaboration/messages`。
  - `useTaskCollaboration` 是唯一 API、AbortController、generation guard、cursor/asOf、消息/options、draft、reply、Mention/Evidence 选择、发送/重试/idempotency key 编排者；工作台和组件不得直接调用 adapter 或自行推断权限。
  - context 变化必须在发新请求前同步清空旧 messages/cursor/asOf/error/reply/selections/draft/pending command/key，abort 旧请求，并以 generation + contextKey 丢弃所有晚到 success/error/finally。403/404/撤权、首屏或分页失败清空敏感线程；发送失败仅在同一 context 保留 draft 与完全相同 command/key，用户修改 draft 后生成新 key，切 context 后不可重试旧命令。
  - 首屏固定 `asOf`；更早页只追加同 snapshot、按 messageId 去重。后续页 `asOf` 不同即清空并显示可重试 snapshot-change 错误，不混合快照。
- **共享组件结构**：
  - `TaskContextPanel` 固定模式 `work | archive | collaboration` 和人话标签“办理 / 档案 / 协作”；实现 brief 已定 props/slots/emits，自身唯一渲染 `TaskCollaborationPanel`，collaboration 不开放 consumer slot。未列入 `modes` 的入口不出现，不显示 coming soon。
  - inactive mode 保持挂载时必须同时 `hidden + inert + aria-hidden`，不可被 Tab 聚焦。切 mode 前记录该模式在外层 `WorkbenchPane` 唯一 scroll owner 中的 scroll/focus，`nextTick` 后仅在 context/mode 未变时恢复；找不到旧焦点则聚焦当前可用模式控制。不得创建组件内第二个 `overflow-y` scroll owner。
  - `TaskCollaborationPanel` 唯一渲染当前任务消息、单层父消息摘要、作者/时间、服务端 options、composer、发送中/失败/重试、加载更早；不建递归楼中楼。ID、sourceRef、visibility code、idempotency/trace 等技术值只进折叠详情。
  - 常驻边界文字保持精简：消息不改变任务状态、责任或期限；EvidenceRef 只是当前有权读取的证据引用，不代表已核验。无权或被过滤时不显示附件行、计数、文件名、ID或“隐藏附件”标记，只显示“仅显示当前有权读取的证据引用；未显示不表示不存在”的通用说明，避免泄露存在性。
- **TaskWorkbench 首个消费者**：
  - 只把现有右栏档案组合替换为单一 `TaskContextPanel`；PageHeader、责任上下文、决策条、左队列、中办理/冻结结果、`WorkbenchLayout` 几何不变。移动端仍只有“队列 → 详情 → 上下文”三屏，协作是上下文内模式，不得新增第四屏。
  - subject/work 只能来自当前已解析 `visibleContainer.containerRecordId` 与 `visibleTask.taskId`，contextKey 固定由二者确定；不得直接信任 route query。无当前 task/container 时不显示 collaboration；completed task 仍可进入协作，由服务端 `canPost/postDisabledReason` 决定只读，不由前端 task state 推断。
  - 右栏标题、rail 与移动标签表达“任务上下文”和当前模式；档案与协作分轨，不合并为一条时间线。加载/错误/对象切换必须立即移除旧上下文。
- **TDD**：
  - adapter：URL 编码/query/POST path、生成类型、signal、HTTP 错误、禁止受保护字段。
  - composable：A→B 晚到首屏/分页/POST 全丢弃；context 同步清空；首屏+更早页去重；asOf 漂移/403/404/分页失败清空；成功 append/de-dupe；失败保留同 key，修改 draft 换 key，切 context 删除 retry；完全消费服务端 canPost/options，不自行推断。
  - panels：loading/empty/error/retry/loadMore、reply/Mention/Evidence、read-only reason、失败 draft、hidden/inert/aria-hidden、每 mode scroll/focus、无内层 scroll owner、技术详情默认折叠。
  - TaskWorkbench：六区域与三栏顺序不变；精确 refs/contextKey；live/completed 只切中右局部；loading/error 清旧上下文；移动端仍三屏。
  - E2E：真实生产 `/tasks` 消费路径 mock GET/POST；任务切换竞态、403/404/分页失败清空、同 key retry、回复/Mention/Evidence、无 evidence.read 不泄露 ID、completed read-only；三标准视口截图与 overflow/scroll/focus/键盘可达断言。
- **视口证据**：
  - `1440x900`：三栏同高，协作只切右栏；消息、回复、附件、composer 同屏可达；只有外层 WorkbenchPane 滚动，无横向溢出。
  - `1024x768`：左窄轨/抽屉与中右并列不回退；composer、重试、加载更早可达；无嵌套纵向 scroll。
  - `390x844`：严格三屏；协作在“上下文”内，面包屑保留 container/task；返回详情恢复焦点/scroll；composer、取消回复和失败恢复不被底部或软键盘模拟遮挡，无横向溢出。
  - 使用 `apps/web/e2e/task-collaboration.spec.ts` 与三个版本化 `task-collaboration-*-chromium-win32.png`；只有在主代理人工逐张核对后才更新 snapshot，不用阈值掩盖几何失败。
- **TC2 首轮评审 disposition（2026-10-19）**：
  - `TC2-R1 accepted`：Web GET adapter 只发送 `pageSize/cursor`，遗漏服务端必需的 `subjectKind=container` 与 `subjectId`；真实 TC1 API 会在父链复核前返回 `RESOURCE_NOT_FOUND`，而 unit/E2E mock 把错误 URL 固化并掩盖。adapter 必须接收 typed `subjectRef` 并编码两个 query 字段；composable 每次首屏/分页都传当前 subjectRef；unit 与 E2E route 必须直接断言 query 与当前 task/container 匹配，错误即让测试失败。
  - `TC2-R2 accepted`：`TaskContextPanel` 当前接收 `taskId/subjectRef/workRef/mode` 并在内部调用 `useTaskCollaboration`，偏离 brief 固定的 `modelValue/contextKey/modes/collaboration` facade，导致 API/竞态状态所有权藏进展示组件，TC3 无法把同一共享 model 原样传入。把 `useTaskCollaboration` 上移到 `TaskWorkbench`（TC3 将由 Customs 同样持有），`TaskContextPanel` 只接收 `modelValue/contextKey/modes/collaboration`，emits 固定 `update:modelValue / submit / retry / loadMore`，保留 work/archive slots，内部唯一渲染 `TaskCollaborationPanel`。组件不得 import/call composable 或 adapter；其 context change 只负责 mode/focus/scroll facade，协作清空由传入 model 的 composable generation 负责。
- **验证命令**：focused Vitest 五个文件、Web lint/format/typecheck/build、Playwright `task-collaboration.spec.ts` 的 desktop/narrow/mobile 三项目（`--workers=1`）、`repo:check` 与 `git diff --check`。全仓 `pnpm validate` 留 TC4。
- **不做**：Customs/TC3、其他工作台、后端/契约/数据库修改、显式 redacted count/marker、人员目录、任意邀请、通知、频道/私聊/read receipt/edit/delete/file upload/AI、TaskArchive/ObjectActivity 写投影。
- **停止条件**：页面出现私有消息实现；共享组件读取任务状态/角色推断权限；档案与协作混在同一时间线；移动端新增第四屏或嵌套 scroll；需要扩公共契约才能如实呈现信息。

### `TC3-customs-second-consumer`

- **目标**：Customs 原样消费 TC2 固定的同一个 `TaskContextPanel + TaskCollaborationPanel + useTaskCollaboration`，删除其本地 action/archive mode、focus 与 scroll 复制；共享接口在本片不得再修改。
- **固定接法**：Customs 只在页面层由当前 `selectedContainer + selectedTask` 生成 `subjectRef={kind:'container',id:selectedContainer.id}`、`workRef={kind:'node_task',id:selectedTask.id}` 和稳定 contextKey；页面唯一调用 `useTaskCollaboration(context)`，把 model 传给 `TaskContextPanel`。`CustomsActionPanel` 放入 work slot，现有 `TaskArchivePanel` 放入 archive slot；协作仍由共享 panel 内部唯一渲染。
- **结构不变量**：保留 `RoleWorkbenchFrame responsive-mode='stacked'`、岗位/货柜范围、生命周期轨道、左任务池、中清关事实和右任务上下文的顺序。1440 维持三栏；1024 维持队列+事实在上、右栏跨整行；390 维持任务池→清关事实→任务上下文。协作只切右栏局部，不改变清关事实、案件表单、业务动作或移动锚点。
- **状态与恢复**：`TaskContextPanel` 接管办理/档案/协作模式的 hidden/inert/aria-hidden、focus/scroll 记忆；删除 Customs 本地 `CustomsContextMode`、`actionScrollTop`、`lastActionFocus` 与手写 mode nav。办理表单保持挂载，往返三模式不丢输入；task/container 切换同步清空旧协作并回到 work；无真实 task 时不显示 archive/collaboration，只保留办理上下文。
- **TDD**：证明共享接口文件在 TC3 diff 中零修改；work/archive/collaboration 往返保持清关表单值、当前 container/task/node、focus/scroll；task switch 丢弃旧协作晚到结果；无 task 不请求/不显示协作；completed task 由服务端只读；stacked 三视口几何、移动三段顺序、无横向溢出、无嵌套 scroll owner均不回退。
- **视口证据**：创建 `apps/web/e2e/customs-task-collaboration.spec.ts` 及 1440/1024/390 三张版本化截图；主代理逐张人工核对。TC3 不修改 TC2 的 TaskWorkbench 截图或共享组件截图。
- **评审节奏**：TC3 只做一次主代理真实 diff + 定向验证；无当前范围 finding 即接受并进入 TC4，不启动逐片 fresh reviewer。TC4 才执行一次 whole-branch fresh 独立复审和完整 `pnpm validate`。
- **验证命令**：focused Customs unit、既有 customs archive/flow E2E 加新的 customs collaboration 三项目、Web lint/format/typecheck/build、`repo:check` 与 `git diff --check`；完整门禁留 TC4。
- **停止条件**：为 Customs 新建协作组件/API；修改共享组件/composable/adapter；必须给共享组件增加清关字段；破坏 RoleWorkbenchFrame empty state/stacked 几何；修改清关业务动作。

### `TC4-review-gate-integration`

- **目标**：整体 high-risk fresh 复审、accepted finding 修复、完整门禁、单一 PR/CI/merge；完成后才进入 AI 单元。
- **验收**：contract/schema/migration/dictionary、API unit/integration/authz、Web unit/E2E/三视口、fresh clean `pnpm validate`、fresh Claude no-findings 或全部处置。

## 五面映射

| 业务步骤与岗位结果 | 岗位任务                                              | 数据事实                                                        | 技术保障                                            | 权限边界                                                     | 界面承接                                    | 状态          |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- | ------------- |
| 打开当前任务协作   | 在当前 task/object 下看有权限的最新协作，不重新找对象 | thread、subject/work refs、visibility、asOf/cursor              | tenant/task/subject 重验、稳定分页、晚到丢弃        | read capability + 对象范围；Mention 不提权                   | 共享右栏“协作”模式，当前任务与可见范围常驻  | 待 TC1/TC2    |
| 发送消息或回复     | 写清问题/结论并引用现有证据，失败可重试               | append-only message、parent、mentions、EvidenceRefs、sourceRefs | 事务、幂等、payload hash、并发 thread 唯一          | 独立 post capability；author 来自身份                        | 共享 composer、回复摘要、发送中/失败/回执   | 待 TC0～TC2   |
| 跨模式/工作台继续  | 在办理、档案、协作间往返不丢表单/上下文               | UI focus/scroll/draft，不是业务事实                             | context generation、hidden/inert、每 mode 恢复      | 模式可见性来自服务端能力，不由页面猜                         | TaskWorkbench 首验，Customs stacked 二验    | 待 TC2/TC3    |
| 形成正式结果       | 从消息定位独立正式办理入口，业务动作另行确认落账      | message source ref 与正式 action/result/evidence 各自版本       | 不在消息事务写领域状态；正式 API 自行授权/幂等/版本 | collaboration capability 不授予 task.execute/evidence.verify | 消息边界短文案 + 正式入口引用，不提供假动作 | V1 只承接分轨 |

## 验收

- [ ] 一套共享 API、composable 和 UI 被 TaskWorkbench 与 CustomsWorkbench 原样消费；没有工作台私有协作组件或权限逻辑
- [ ] thread 精确绑定 tenant + container subject + NodeTask work；不匹配、跨租户和不可见统一失败关闭
- [ ] 消息/回复/Mention/EvidenceRef/sourceRef typed、append-only、分页稳定、写入幂等且并发安全
- [ ] Mention、消息、附件、已读均不改变责任、任务、工作单、生命周期、Evidence 核验或 SLA
- [ ] OpsAssistant/Notification/Inbox/Outbox/WorkSession/Archive 未被复用为协作写事实
- [ ] TaskWorkbench 与 Customs 的现有任务办理、冻结结果、档案、表单、焦点、scroll 和三视口几何无回退
- [ ] 加载/空态/撤权/404/冲突/发送失败/分页失败/任务切换/恢复有直接自动化和真实界面证据
- [ ] high-risk fresh 复审、clean full gate、PR CI 和 merge 全部完成后才标 done

## Review Focus

1. 客户端伪造 tenant/author/visibility/mention actor 或 task/container pair。
2. late response、task switch 或分页失败把旧任务消息显示在新任务下。
3. message/mention/evidence link 被误作完成、责任转移或证据核验。
4. idempotency key 同 payload 重试重复写，或不同 payload 被静默接受。
5. Customs 第二消费者为适配而迫使共享组件学习清关字段、破坏 stacked 几何或丢表单。

## 进度 log

| 日期       | 阶段   | 负责              | commit   | 说明                                                                                                                                                                                                               |
| ---------- | ------ | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-18 | design | Claude / Opus 4.8 | 046f7932 | 从最新 main 快进既有空分支；核对路线、任务档案两个消费者、NodeTask 身份、现有消息模型与共享 UI seam；负责人明确只建一套共享协作组件，建立唯一 brief，TC-D01 待定                                                   |
| 2026-10-18 | coding | Claude / Opus 4.8 | 046f7932 | 负责人选择 TC-D01 A：task.read 可读、task.collaborate 可发、completed 只读、Mention 限当前 actor/已知 assignee；写回批准设计与 brief，进入 TC0                                                                     |
| 2026-10-18 | fix    | Claude / Opus 4.8 | none     | 审查 TC0 未提交实现；接受 TC0-R1～R5：actor identity 错收窄 UUID、runtime extra/kind 静默改正、迁移缺显式事务、字典已定字段仍待业务确认、domain 失败边界不足；定向门禁均通过，待 Codex 修复后重审                  |
| 2026-10-18 | coding | Codex / GPT-5     | 52a9d6d5 | 修复 TC0-R1～R5；主代理复跑 domain 33/33、contract 27 schemas/73 fixtures、API lint/typecheck、Prisma validate/generate、dictionary/repo/format/diff 均通过，fresh Claude TC0 重审 no-findings；接受 TC0，进入 TC1 |
| 2026-10-18 | fix    | Claude / Opus 4.8 | none     | 审查 TC1 未提交实现；接受 TC1-R1～R3：POST 路径漏 `/messages`、EvidenceRef 未独立执行 evidence.read 且读取泄露引用、exact Evidence 查询未在数据访问边界携带 tenant/subject；其余定向门禁通过，待 Codex 修复后重审  |
| 2026-10-18 | coding | Codex / GPT-5     | 169e7b49 | 修复 TC1-R1～R3；主代理复跑 focused API 36 files/248 tests、PostgreSQL 11/11、API lint/typecheck/build、contract/Prisma/dictionary/authz/repo/format/diff 均通过；接受 TC1，进入 TC2                               |
| 2026-10-19 | fix    | Claude / Opus 4.8 | none     | 审查 TC2 未提交实现与三视口截图；接受 TC2-R1～R2：GET 漏 subject 父链 query、TaskContextPanel 内部拥有 composable 偏离固定 facade；46 unit、6 applicable E2E 及 Web 门禁通过但未覆盖真实失败，待 Codex 修复        |
| 2026-10-19 | coding | Codex / unknown   | 23594064 | 修复 TC2-R1～R2；负责人要求立即收敛为逐片一次主审 + TC4 一次整体独立复审。主代理按新节奏复跑 48 unit、6 applicable E2E、Web lint/format/typecheck/build、repo/diff 并人工核对三视口截图；接受 TC2，进入 TC3        |
