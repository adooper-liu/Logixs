---
status: coding
branch: feat/task-ai-assisted-confirmed-execution-v1
owner: main
writer: codex
risk: high
dependsOn:
  - task-collaboration-v1
  - task-archive-ui-consumer-v1
  - task-archive-second-consumer-customs-v1
  - recoverable-work-sessions-v1
writeScopes:
  - docs/planning/tasks/task-ai-assisted-confirmed-execution-v1.md
  - docs/planning/progress-board.html
  - packages/contracts/schemas/v1/ops-assistant.schema.json
  - packages/contracts/schemas/v1/index.json
  - packages/contracts/fixtures/v1/schema-instances.json
  - packages/contracts/generated/contracts.d.ts
  - scripts/generate-contracts.mjs
  - database/schema.prisma
  - database/migrations/**
  - database/dictionary/**
  - apps/api/src/modules/ai-governance/**
  - apps/api/src/modules/notification/**
  - apps/api/src/modules/ops-assistant/**
  - apps/api/src/modules/work-execution/**
  - apps/api/src/infrastructure/integration/ops-assistant-confirmed-execution.integration.test.ts
  - apps/ai-service/app/**
  - apps/ai-service/tests/**
  - apps/web/src/api/taskAiAssistance.ts
  - apps/web/src/api/taskAiAssistance.test.ts
  - apps/web/src/composables/useTaskAiAssistance.ts
  - apps/web/src/composables/useTaskAiAssistance.test.ts
  - apps/web/src/components/task/TaskAiAssistancePanel.vue
  - apps/web/src/components/task/TaskAiAssistancePanel.test.ts
  - apps/web/src/components/task/TaskContextPanel.vue
  - apps/web/src/components/task/TaskContextPanel.test.ts
  - apps/web/src/views/TaskWorkbench.vue
  - apps/web/src/views/TaskWorkbench.test.ts
  - apps/web/src/views/CustomsWorkbench.vue
  - apps/web/src/views/CustomsWorkbench.test.ts
  - apps/web/e2e/task-ai-assisted-execution.spec.ts
  - apps/web/e2e/task-ai-assisted-execution.spec.ts-snapshots/**
  - apps/web/e2e/customs-task-ai-assisted-execution.spec.ts
  - apps/web/e2e/customs-task-ai-assisted-execution.spec.ts-snapshots/**
exclusiveLocks:
  - business-policy:task-ai-confirmed-execution-v1
  - public-contract:ops-assistant-v2
  - database-schema
  - database-migrations
  - database-dictionary
  - module:ops-assistant
  - authz-control-plane
  - ui-pattern:task-context-v1
  - visual-baseline:task-ai-assisted-execution-v1
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
  - doc/cross-border-supply-chain/08-role-workbenches.md
  - doc/cross-border-supply-chain/14-roadmap-decisions.md
  - doc/cross-border-supply-chain/wisdom-baseline/README.md
  - doc/cross-border-supply-chain/wisdom-baseline/全局.md
  - doc/cross-border-supply-chain/wisdom-baseline/业务工作台持续打磨受阻原因.md
  - docs/product/UI_SYSTEM.md
  - docs/product/domain/TASK_WORK_ORDER_CONTRACT_V1.md
  - docs/product/domain/IDENTITY_ACCESS_MODEL_V1.md
  - docs/product/domain/ACTION_PERMISSION_CONTRACT_V1.md
  - docs/product/domain/PUBLIC_ERROR_CONTRACT_V1.md
  - docs/superpowers/specs/2026-10-11-universal-workbench-ui-standard-design.md
  - docs/planning/tasks/task-collaboration-v1.md
  - docs/planning/tasks/recoverable-work-sessions-v1.md
uiStructure:
  - TaskContextPanel 继续是唯一右栏模式 facade；固定模式扩为 work / archive / collaboration / ai，标签“办理 / 档案 / 协作 / AI 辅助”，未实现或不可用的 ai 模式不出现
  - TaskWorkbench 是首个真实消费者：PageHeader、责任带、决策条、左队列、中详情和右任务上下文几何不变；AI 只切右栏局部，不新增第四栏、独立页面或移动第四屏
  - AI 视图按“当前任务与动作 → 建议与依据 → 影响/风险 → 用户决定 → 正式执行回执/恢复”顺序；建议卡不替代办理表单或服务端允许动作
  - CustomsWorkbench 是第二个差异化消费者：保持 stacked 几何、清关事实和办理表单常驻；只传精确 task/container/work-order 上下文并复用同一 AI model/panel/确认链
  - 视觉签名是单条“证据脊柱”：把建议依据、当前快照、风险和正式回执沿一条纵向因果线连接；沿用现有主题令牌和字体，不做独立 AI 渐变、聊天气泡或营销式视觉
uiMustStayVisible:
  - 当前工作台、container、NodeTask、WorkOrder、人话动作“领取”、当前责任/期限、候选生成时点与当前状态
  - 建议来源 kind（rule/model/fallback）、能力 ID/版本、输入事实快照时间、依据摘要、影响和风险；未采信时明确“不改变任务状态”
  - “确认领取”与“拒绝建议”分开；确认前说明服务端会重新验证身份、task.execute、tenant/object scope、业务状态和并发版本
  - 确认后的正式 ClientOperation 回执、是否实际应用、当前 assignee/task state、拒绝/冲突原因、重读与同键恢复入口
  - task/container 切换、撤权、404、候选过期/失配、冲突或响应丢失时，旧候选和旧回执立即清空或进入明确的不可执行历史态
uiProgressiveDisclosure:
  - candidateId、candidateHash、snapshotHash、schema/prompt/model 版本、idempotency key、ClientOperation ID、traceId 与 input refs 进入“建议详情/执行详情”折叠区
  - 模型解释原文、确定性 fallback 原文和完整服务端判定轨迹按需展开；常驻区只显示岗位作决定所需摘要
  - 已拒绝、已失效和历史执行候选可在当前任务 AI 历史中按需展开；首版不建设任意跨任务 AI 会话搜索
  - 只读问答历史按需展开，不让 AI 面板成为第二个纵向 scroll owner
uiForbidden:
  - AI 直接调用任意 SQL、HTTP、文件、代码工具或由模型自由选择任意 actionCode/target/payload；V1 只允许服务端从当前正式 allowed action 固定生成 claim_work_order 候选
  - 把用户点击确认、AI 文本、候选状态或前端按钮可见性当作授权；确认时必须重新执行正式服务端认证、能力、范围、父链、状态、幂等和并发校验
  - 新建第二套领取状态机、复制 ClaimWorkOrderService、从 ops-assistant 直接写 work_order/node_task、或用自由 JSON 保存业务命令
  - 每个工作台自建 AI 组件/composable/API、CustomsAiPanel、通用 Tool Runner、模型供应商 SDK、自动执行、批量 AI 执行、任意工具白名单、未来 complete 动作占位
  - 独立 AI 页面、第四栏、移动第四屏、紫色渐变/机器人头像/聊天气泡式通用 AI 模板、嵌套纵向滚动或以长免责声明替代清晰边界
uiViewportEvidence:
  - 1440x900：TaskWorkbench 三栏和 Customs 三栏不变；AI 模式中当前任务、建议依据、风险、确认/拒绝和回执在右栏可达，无横向溢出且只有外层 pane 滚动
  - 1024x768：TaskWorkbench 左窄轨与中右并列、Customs stacked 布局不回退；建议详情、确认、冲突恢复和回执可达，无内层纵向滚动
  - 390x844：TaskWorkbench 仍为队列→详情→上下文三屏，Customs 仍为任务池→清关事实→任务上下文；AI 是上下文内模式，确认弹层/就地确认、取消、失败恢复不被底部遮挡
---

# 任务：任务 AI 辅助与确认执行 V1

## 路线图位置与岗位结果

- **位置**：UI 统一主线单元五。任务档案、任务内协作与两个真实消费者已完成；本任务完成后才进入完整标准逐台扩散，再进入海运运营。
- **目标岗位**：在当前 NodeTask/WorkOrder 上需要判断下一步并执行正式动作的内部岗位；首个动作是领取当前可领取工单。
- **核心结果**：岗位在当前任务上下文中看到可追溯、结构化、可拒绝的领取建议；只有用户明确确认后，服务端才重新授权并调用正式领取用例，返回可恢复的正式回执。未采信、拒绝、失配、无权和冲突均不得改变业务状态。
- **首版消费者**：TaskWorkbench 首验；CustomsWorkbench 作为 stacked、保留业务表单的差异化二验。
- **完成边界**：V1 只证明 `work_execution.claim_work_order` 的建议 + 确认执行控制链，不开放自动执行、任意工具、完成工单、业务状态写入、费用/证据决定或通用 Agent 平台。

## 为什么从领取动作开始

1. 正式 API、`task.execute`、tenant/父链、状态守卫、幂等、并发和 ClientOperation 回执已经存在。
2. 领取不要求 EvidenceRef，不直接形成任务终态或专业业务事实，失败可重读恢复。
3. 当前 OpsAssistant 已能只读投影 `claim_work_order`，但只能跳转办理；缺结构化候选、采信轨迹、确认重授权和正式执行关联。
4. 完成工单涉及证据、完成资格、任务聚合和生命周期结果，留到领取链验真后的后续切片，不在 V1 预建占位。

## 既有能力与真实缺口

| 轨道     | 当前事实                                                                                  | V1 补强                                                                             |
| -------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 正式动作 | `POST /work-orders/:id/claim` + `ClaimWorkOrderService` 已实现幂等/并发/ClientOperation   | 不复制；经窄公共 port 调用同一用例                                                  |
| AI 读取  | OpsAssistant 可按 tenant+actor 读取 container、节点和 next actions                        | 增加精确 subject/task/work-order 快照和快照哈希                                     |
| AI 输出  | 只有自由文本问答，AI Gateway 失败时确定性摘要                                             | 增加 schema-bound 结构化候选；目标和 actionCode 由服务端固定，模型只能补解释        |
| 治理     | readOnlyPolicy 固定 `assistantCanExecute=false`                                           | 变为“AI 永不执行；用户确认后 Application 调正式动作”，并保存来源/采信/结果轨迹      |
| UI       | 独立 OpsAssistantPanel 出现在通知中心/MicroWorkbench；TaskContextPanel 只有办理/档案/协作 | 建立唯一 TaskAiAssistancePanel/useTaskAiAssistance，AI 成为任务上下文第四种内部模式 |
| 持久化   | 私有 session/message，只存 container 和自由文本                                           | task/work 绑定的不可变候选 + 用户决定 + ClientOperation 执行关联                    |

## 智慧开启基线继承

| 基线原结论                                       | 处置 | 依据                          | 本任务落点                                                  |
| ------------------------------------------------ | ---- | ----------------------------- | ----------------------------------------------------------- |
| 全局：AI 建议、人工决定和执行结果必须分开        | 沿用 | ADR-014、UI 标准 §14          | 候选/决定/正式 ClientOperation 分表分轨                     |
| 全局：任务完成或按钮点击不能冒充业务事实         | 沿用 | ADR-006、GC-008               | 领取回执只说明工单责任变化，不冒充任务完成                  |
| 持续打磨：横向能力必须由真实动作与真实消费者验真 | 沿用 | AGENTS §1.1、路线图           | claim_work_order + TaskWorkbench/Customs 两消费者同任务交付 |
| 持续打磨：UI 不做技术链末端                      | 补强 | 五面协同纪律                  | 契约/持久化/服务端/共享 UI/两个消费者按连续切片收口         |
| 真实样本只门禁 validated，不阻塞机制开发         | 沿用 | `08-role-workbenches.md` §3.1 | synthetic rehearsal 可验控制链；不宣称岗位 validated        |

## 已定架构

```text
正式 task/work-order 当前快照
        ↓（tenant + subject + task + actor scope）
服务端固定可建议动作 = claim_work_order
        ↓
provider-neutral AI Gateway：只补依据/影响/风险说明
        ↓（失败则 deterministic fallback）
不可变 ActionCandidate + SourceEnvelope + snapshotHash
        ↓
TaskAiAssistancePanel 展示建议 / 拒绝 / 明确确认
        ↓
确认 API 重新读取身份、task.execute、对象父链、状态和候选哈希
        ↓
WorkExecution 公共 port → 原 ClaimWorkOrderService
        ↓
ClientOperation 正式回执 + CandidateDecision/Execution link
        ↓
任务重读；档案中的 AI 建议轨与正式业务结果分轨
```

### 1. 公共契约

V1 在既有 `ops-assistant.schema.json` 增加：

```ts
type TaskAssistantContextRefV1 = {
  subjectRef: { kind: "container"; id: string };
  workRef: { kind: "node_task"; id: string };
};

type TaskActionCandidateV1 = {
  candidateId: string;
  context: TaskAssistantContextRefV1;
  workOrderId: string;
  actionCode: "work_execution.claim_work_order";
  actionVersion: 1;
  title: string;
  rationale: string;
  impact: string;
  riskLevel: "low";
  warningCodes: string[];
  status: "proposed" | "accepted" | "rejected" | "expired";
  source: {
    kind: "rule" | "model" | "fallback";
    capabilityId: "task.claim-assistance";
    capabilityVersion: 1;
    schemaVersion: 1;
    promptVersion: string | null;
    modelId: string | null;
    inputSnapshotHash: string;
    inputRefs: Array<{ kind: string; id: string; version: number | null }>;
    generatedAt: string;
  };
};
```

- 候选生成请求只接收 contractVersion + subjectRef + workRef；客户端不传 actionCode、workOrderId、tenant、actor、capability、风险或业务 payload。
- 确认请求只接收 contractVersion + candidateId + candidateHash + idempotencyKey；拒绝请求接收 candidateId + 可选 reason（长度受限）。
- 执行响应包含 candidate decision、原 ClaimWorkOrderResult 和 `idempotencyReplay`；不得复制第二套业务回执。
- 结构化 AI 输出只允许 rationale/impact/warnings；服务端决定 target/action/version/risk，并对模型输出做 schema 校验。模型输出无效或服务不可用时使用明确 `fallback`，不静默伪装 model。

### 2. 持久化与恢复

- `ops_assistant_action_candidate`：tenant、actor、immutable subject/work/workOrder/action refs、candidateHash、source envelope、rationale/impact/warnings、snapshotHash、generatedAt；append-only。
- `ops_assistant_action_decision`：candidate、decidedBy、accept/reject、reason、idempotencyKey、decidedAt、可选 clientOperationId/traceId/result state；同 candidate 只允许一个终局人员决定，响应丢失可按 idempotencyKey 重放。
- 候选不保存任意命令 payload，不保存 token/cookie，不复制任务或工单正文；inputRefs 只保存 typed refs/version。
- task/container 切换只清客户端当前候选；历史候选不可变。确认时 snapshotHash 或当前 action 不再匹配，候选原子标为 expired/返回稳定冲突，不执行领取。
- 确认响应丢失后，相同 candidate+actor+idempotencyKey 返回同一 ClientOperation/领取结果；不同 key 不得重复执行已接受候选。

### 3. 权限与正式执行

- 打开任务 AI 与生成候选要求 `task.read`，并逐次验证 tenant + container subject + NodeTask coherence；不可见统一 404。
- 确认领取同时要求 `task.read + task.execute`；候选生成时可执行不等于确认时有权。
- actor/tenant 来自认证身份；候选只属于生成它的 actor，其他 actor 即使同租户也不能确认或读取私有 AI 历史。
- 确认 Application 重新解析 candidate 当前 task/work-order，验证 candidateHash、当前 `allowedAction=claim`、对象范围、状态和并发；然后经 `TASK_ASSISTANT_CLAIM_EXECUTION` 公共 port 调用原 `ClaimWorkOrderService`。
- OpsAssistant 不直接导入 work-execution repository/service 内部路径，不写 NodeTask/WorkOrder，不创造新 capability。
- UI 可见性、模型建议或 candidate status 均不是安全边界；GC-008 固定授权顺序保持成立。

### 4. provider-neutral AI 边界

- 仓库现有 Gateway/AI service 保持 provider-neutral；本任务不得引入 `@anthropic-ai/sdk`、OpenAI-compatible shim 或任一模型供应商 SDK。
- 首片允许确定性 `rule` 候选作为业务控制链基线；AI service 只为同一个服务端固定候选生成结构化解释，失败使用 deterministic `fallback`。
- V1 不允许工具调用；候选生成不是 tool use，确认执行由普通 Application 用例完成。
- 模型/Prompt/Schema 版本只记录实际使用值；rule/fallback 时 modelId/promptVersion 为 null，不伪造。

## 执行切片

### `AI0-contract-persistence`

- **目标**：测试先行增加 task-bound candidate/decision/result 契约、Prisma 模型/迁移、字典和 ops-assistant repository；不接 Controller/UI，不执行业务动作。
- **TDD RED**：契约拒绝客户端伪造 tenant/actor/action/workOrder/risk/payload；candidate hash 对 immutable normalized payload 稳定；candidate/decision append-only；同 candidate 只能一个人员终局决定；跨 tenant/actor 查询失败关闭。
- **边界**：source envelope 精确区分 rule/model/fallback；input refs typed；不保存任意业务 JSON、token、prompt 原文或证据正文。
- **验证**：focused contract/domain/repository unit、真实 PostgreSQL 约束/append-only integration、contract generate/check/drift、Prisma validate/generate、dictionary、API lint/typecheck/build、repo/format/diff；不跑全仓 validate。

#### AI0 主审 disposition（2026-10-19）

主代理核对完整工作区差异并复跑 focused unit 60/60、PostgreSQL 9/9、contract/drift、dictionary、Prisma validate、API lint/typecheck/build、repo/diff，结果均通过；这些测试未覆盖下列反证，因此接受 4 项 finding，AI0 保持 `fix`，不得进入 AI1：

- `AI0-R1 accepted / high / candidate-hash-semantics`：`normalizeTaskActionCandidate` 当前把随机 `candidateId`、物理 `status` 和 `generatedAt` 纳入 `candidateHash`，同一业务候选在不同 ID/生成时刻不会得到稳定 hash；数据库同时把 hash 设为全局 unique。修复为：hash 只覆盖规范化业务候选与来源快照语义，排除 candidateId、status、generatedAt/recordedAt；数据库不以全局 unique 阻止同一 actor 对同一快照重新生成历史候选。若需要生成重放，应在 AI1 以显式请求幂等设计，不借 hash 唯一约束制造 P2002。
- `AI0-R2 accepted / high / tenant-task-coherence`：candidate repository 直接使用调用方 tenantId，现有 FK 只验证 NodeTask/WorkOrder ID 与 work-order/task 关系，不能阻止 tenant B candidate 绑定 tenant A NodeTask。新增 tenant-scoped 数据边界：候选持久化必须在数据库关系或同事务精确查询中证明 `candidate.tenantId === NodeTask.tenantId`，并继续证明 WorkOrder 属于该 NodeTask；增加真实 PostgreSQL 跨租户创建反证。
- `AI0-R3 accepted / high / client-operation-coherence`：decision 的可选 ClientOperation FK 只验证 ID 存在，可把候选关联到其他 tenant、其他 actor、其他 action 或其他 target 的正式操作。appendDecision 在同一事务中若携带 clientOperationId，必须验证 operation 的 tenantId、actorId、`actionCode=work_execution.claim_work_order`、`targetId=candidate.workOrderId`；任何不匹配失败关闭且不写 decision。增加四类 PostgreSQL 反证。
- `AI0-R4 accepted / medium / decision-normalization`：AI0 没有 decision exact-key/typed-ref/cross-field normalization 或权威 `decisionHash` 计算，repository 信任调用方任意 64 位 hash，重放一致性没有稳定语义。新增唯一 domain normalizer：规范化 accepted/rejected、reason、idempotencyKey、clientOperation/trace/executionState、排序去重 resultRefs，并从规范化决定业务载荷计算 decisionHash；排除 decisionId、decidedAt/recordedAt 等重试噪音。repository 只接收 normalized decision，测试覆盖顺序稳定、业务变化敏感、额外字段/非法组合/任意 hash 拒绝。

修复不得扩大到 Controller、AI service、Web 或正式动作执行；迁移尚未提交/共享，可原地修正当前新增 migration 与 schema/字典派生物。修复后主代理只做一次 scoped 重审与定向复现，不启动第二个 fresh reviewer。

#### AI0 最终验收（2026-10-19）

主代理复审 AI0-R1～R4 实际差异并复跑 ops-assistant unit 83/83、PostgreSQL 11/11、contract 27 schemas / 82 fixtures、contract drift、dictionary、Prisma validate、API lint/typecheck/build、repo/diff，全部通过。candidateHash 已改为业务白名单且允许重复历史候选；createCandidate 同事务关闭 tenant/container/task/work-order scope；appendDecision 同候选锁内关闭 ClientOperation tenant/actor/action/target；decision 唯一 normalizer 与 hash 语义成立。AI0 无残余 finding，接受并进入 AI1。

### `AI1-task-context-confirmed-claim`

- **目标**：新增 task-bound candidate generate/get/reject/confirm API；服务端固定生成 `claim_work_order` 候选，确认经窄公共 port 调原领取用例。
- **TDD RED**：task/container mismatch、无 task.read、候选属于他 actor、客户端伪造 target、确认时失去 task.execute、工单已被他人领取、task switch/snapshot drift、candidateHash 变化、same-key replay、different-key second confirm、响应丢失恢复、AI 输出非法/failure fallback。
- **生成规则**：当前精确 task 的 server-projected nextAction 必须是 claim；否则不返回候选/给稳定不可建议原因。模型不能改变 action/target/risk。
- **执行原子性**：candidate 决定与 ClientOperation 跨模块恢复协议必须能处理“领取已提交但候选决定回执丢失”；不得新增第二套领取事务。
- **AI service**：新增严格结构化解释 capability 或等价 provider-neutral adapter；确定性 fallback 同 schema，错误不泄露内部 prompt/stack。
- **验证**：focused API/AI-service unit、真实 PostgreSQL integration、authz routes、API/AI lint/typecheck/build、contract/dictionary/repo/format/diff。

#### AI1 主审 disposition（2026-10-20）

主代理核对完整 AI1 diff 并复跑 focused API 28 files/269 tests、PostgreSQL 19/19、AI service 11/11 + compileall、authz routes 147/0、API lint/typecheck/build、repo/diff，结果通过；确认固定 claim、scope/snapshot 重验、candidate 终局串行、confirm/reject 竞争、同键恢复和 provider-neutral strict fallback 主链成立。接受以下 2 项当前切片 finding，AI1 保持 `fix`，不得进入 AI2：

- `AI1-R1 accepted / medium / replay-trace-coherence`：领取已提交但 decision/响应丢失后，重试可能生成新的 traceId；`findClaimReceipt` 只返回 ClientOperation ID/状态，不返回正式 operation.traceId，随后 accepted decision 会把新 traceId 与旧 ClientOperation 关联。修复为正式 receipt 始终携带原 ClientOperation.traceId；新领取使用服务端可信 trace，响应丢失恢复必须在 decision 与正式 operation 中记录同一个原 trace。新增首请求/重试使用不同输入 trace 的 PostgreSQL 回归，断言 recovered decision.traceId === ClientOperation.traceId。客户端 `x-trace-id` 不得成为可信来源；沿用仓库服务端生成 trace 的安全纪律。
- `AI1-R2 accepted / medium / module-permission-manifest`：`ops-assistant` 新增 task.read/task.execute 路由，但 module manifest 仍只声明 notification.read。同步 manifest permissions 为实际最小集合 `notification.read / task.read / task.execute`，增加 manifest/public-boundary 回归，防止路由 capability 与模块声明漂移。

修复只允许触及 trace receipt/服务端 trace 生成、相关 Controller/Application/port/adapter/tests、ops-assistant manifest 与 brief；不得扩大到 Web/AI2、契约业务语义、数据库迁移或模型能力。修复后主代理只做 scoped 重审，不启动新 reviewer。

#### AI1 最终验收（2026-10-20）

主代理复审 AI1-R1/R2 实际差异并复跑 focused API 29 files/264 tests、PostgreSQL 19/19、authz routes 147/0、API lint/typecheck/build、repo/diff，全部通过。Controller 不再信任客户端 trace；首次领取和响应丢失恢复均从正式 ClientOperation 回读原 trace，decision 与 operation trace 一致，公共 claim 回执不泄露内部 trace；ops-assistant manifest 与两个 Controller 的 capability union 自动对拍。AI1 无残余 finding，接受并进入 AI2。

### `AI2-shared-ui-task-consumer`

- **目标**：一次性建立 `taskAiAssistance.ts + useTaskAiAssistance + TaskAiAssistancePanel`，扩展 TaskContextPanel 固定 AI mode，并在 TaskWorkbench 首次真实消费。
- **状态所有权**：composable 唯一拥有 API、AbortController/generation、candidate、decision、confirm command/idempotency key、receipt、retry。context 变化同步 abort 并清空旧状态；晚到响应不得落入新任务。
- **确认语义**：候选生成不自动确认；用户点击“确认领取”前必须看到依据/影响/风险。普通生成失败可重试；确认 403/404 清空敏感上下文并要求重读；409 显示冲突并重读；5xx/network 保留完全相同 candidate/hash/key 以恢复。
- **共享 UI**：TaskContextPanel 新增固定 `ai` mode 与 `ai` model/emits，自身唯一渲染 TaskAiAssistancePanel；consumer 不得提供 AI slot 或直接调用 adapter。
- **TaskWorkbench**：精确 context 来自 visible container/task；AI 只在服务端支持且当前 task 存在时出现。确认成功后重读任务，显示正式回执；不由前端推断动作是否仍可执行。
- **视口**：新增 task AI desktop/narrow/mobile E2E 和三张版本化截图，覆盖未采信、确认成功、撤权、冲突、响应丢失同键恢复、task switch 晚到丢弃、焦点/scroll、无内层 scroll/overflow。

### `AI3-customs-second-consumer-review-gate`

- **目标**：Customs 原样消费同一 AI facade/model/panel，证明 stacked 几何、清关表单与共享确认链兼容；随后 whole-branch high-risk review、完整门禁、单一 PR/CI/merge。
- **固定接法**：Customs 页面只提供当前 selectedContainer/task refs 和持有 composable；不新增清关专用 AI 字段、组件或执行 API。
- **回归**：办理/档案/协作/AI 往返不丢清关草稿、焦点/scroll；task/container switch 清空旧候选；completed/no-task 不显示可执行候选；确认结果来自正式领取 API。
- **E2E/视口**：Customs desktop/narrow/mobile 三张截图；保持 1440 三栏、1024 stacked、390 三段移动顺序，无横向溢出和嵌套滚动。
- **整体门禁**：fresh Claude 一次 whole-branch 独立复审；`pnpm validate` 一次；合同/迁移/字典、API unit/integration/authz、AI-service pytest、Web unit/E2E/三视口、build/repo/diff 全部满足后进入 PR。

## 五面映射

| 业务步骤与岗位结果   | 岗位任务                                       | 数据事实                                                                  | 技术保障                                              | 权限边界                         | 界面承接                                   | 状态        |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------- | ------------------------------------------ | ----------- |
| 查看当前任务领取建议 | 理解为何现在可领取、对象/责任/期限和不采纳影响 | task/work-order 当前快照、allowed action、typed input refs、snapshot hash | tenant/task/subject 重验、结构化输出、确定性 fallback | task.read + 对象范围；模型不提权 | AI 模式证据脊柱展示建议/依据/影响/风险     | 待 AI0～AI2 |
| 拒绝或明确确认       | 人员拒绝或确认同一候选，不让 AI 代决定         | immutable candidate + append-only decision                                | candidate hash、单终局决定、actor-bound、幂等         | 确认需 task.execute；拒绝不执行  | 分离“拒绝建议/确认领取”，未采信常驻说明    | 待 AI0～AI2 |
| 正式领取并确认回执   | 确认后看到是否真实领取、谁负责、失败如何恢复   | 原 ClientOperation、WorkOrder/NodeTask current state                      | 正式 ClaimWorkOrderService、并发/同键恢复、重读       | 服务端重授权 + tenant/父链/状态  | 正式回执与 AI 轨迹分轨，冲突/撤权/重试可达 | 待 AI1～AI2 |
| 跨工作台复用         | 在 Task/Customs 上用同一模式且不丢原办理现场   | UI mode/focus/scroll/draft 非业务事实                                     | generation/abort、hidden/inert、外层 scroll owner     | consumer 不自建权限判断          | Task 首验、Customs stacked 二验            | 待 AI2～AI3 |

## 相关数据事实子集

| 轨道               | 事实                                                       | 对应步骤与消费者       | 当前证据                       | 承载决定                                    | 状态          |
| ------------------ | ---------------------------------------------------------- | ---------------------- | ------------------------------ | ------------------------------------------- | ------------- |
| `current_physical` | server-projected next action 含 claim/complete refs        | 建议生成；Task/Customs | ops-assistant contract/service | 只使用 claim；complete 延期                 | confirmed     |
| `current_physical` | ClaimWorkOrderService + ClientOperation 幂等/并发/租户父链 | 确认执行               | work-execution code/tests      | 经窄公共 port 复用                          | confirmed     |
| `current_physical` | assistant session/message 只存 container + free text       | AI 历史                | Prisma/schema                  | 加法扩展 task candidate/decision            | confirmed gap |
| `approved_gap`     | 建议/采信/正式执行分轨、确认时重授权                       | 全链                   | UI 标准 §14、GC-008            | candidate + decision + ClientOperation link | approved      |
| `approved_gap`     | 能力/Prompt/Schema/输入快照与来源 kind                     | 建议追溯               | UI 标准 §14.3                  | source envelope；rule/fallback 不伪造 model | approved      |
| `deferred`         | complete_work_order、任意工具、自动执行、外部参与者        | 后续消费者             | 明确非目标                     | 不建占位字段/入口                           | deferred      |

## 权限、安全与错误语义

- 固定不变量：认证、tenant、默认拒绝、task.read/task.execute、subject/task/work 父链、actor-bound 私有候选、确认时重授权、幂等/并发、未知值拒绝、日志不含 Token/prompt 敏感正文。
- 可演进政策：未来动作、风险等级、confirmation/four-eyes、模型供应商和工具白名单；没有真实消费者时不建设。
- 业务前置：当前 nextAction 必须是 claim，WorkOrder 可领取，NodeTask 状态允许；这些由 work-execution 决定，AI 不复制。
- 稳定错误：不可见/跨租户/错 actor/错 task 统一 not-found；缺 capability 403；snapshot/action changed 与他人领取 409；非法 schema 400；5xx/network 可同键恢复。

## 验收

- [ ] AI 只能从服务端当前 allowed action 生成固定 claim 候选，不能自由指定 action/target/payload
- [ ] 候选未采信、被拒绝或已失效时，WorkOrder/NodeTask/ClientOperation 零变化
- [ ] 确认时重新验证身份、task.execute、tenant/object scope、父链、状态、candidate hash 和幂等键
- [ ] 同键响应丢失恢复同一正式回执，不重复领取；不同 actor/key/hash 不能复用候选
- [ ] candidate/source/decision/ClientOperation 可追溯，rule/model/fallback 不混淆，AI 正文不冒充事实
- [ ] TaskWorkbench 与 CustomsWorkbench 复用唯一 API/composable/panel/facade，无私有 AI 实现
- [ ] AI 是右栏上下文内模式；两台既有办理、档案、协作、表单、焦点/scroll 和三视口几何无回退
- [ ] 加载、空态、未建议、未采信、拒绝、撤权、404、冲突、网络失败、响应丢失、task switch 和恢复有直接自动化
- [ ] whole-branch fresh review、一次完整门禁、PR CI 和 merge 完成后才标 done

## Review Focus

1. 模型/客户端能否伪造 actionCode、target、tenant、actor、risk、capability 或 command payload。
2. 候选生成后 task/work-order/权限变化，确认是否仍错误执行旧动作。
3. 响应丢失或双击确认是否重复领取、产生重复决定或不一致 ClientOperation。
4. task/container 切换或晚到响应是否把旧候选/回执显示在新任务下。
5. AI 建议、人员采信、正式业务回执是否在数据和 UI 中被混成一个“成功”。

## 明确不做

- 不引入 Anthropic/OpenAI/任一供应商 SDK，不迁移模型，不建设通用 Agent/Tool Runner。
- 不实现 complete_work_order、证据核验、费用、权限、生命周期、SQL/HTTP/file/code tool 或自动执行。
- 不新增角色/capability/账套主体，不等待 P6 三道安全门整体完成；只使用当前 claim 动作已成立的安全边界。
- 不修改协作消息语义，不把 AI 建议写进 collaboration message，不用消息确认执行。
- 不逐台迁移其他 21 台，不拆多个 PR，不把 synthetic rehearsal 冒充 validated。

## 进度 log

| 日期       | 阶段            | 负责              | commit   | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------- | ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | design          | Claude / Opus 4.8 | f7758906 | 继承 UI 单元五、GC-008/身份边界与既有 OpsAssistant/claim 实现；选定 claim 作为首个正式动作、TaskWorkbench 首验、Customs 二验，建立唯一 brief；无负责人新增待决项，进入 AI0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-19 | AI0 RED/GREEN   | Codex / GPT-5     | none     | RED：focused unit 2 files failed、PostgreSQL integration 1 file failed，均因 candidate domain/repository 尚不存在；GREEN：focused ops-assistant unit 60/60、PostgreSQL integration 9/9，contract generate/check/drift、Prisma format/generate/validate、dictionary generate/check、API lint/typecheck/build 通过；无 Controller/UI/正式动作/capability 改动                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-19 | AI0-R1～R4 修复 | Codex / GPT-5     | none     | RED：新增回归后 domain 23 fail / 50 pass，复现 candidate status/hash 含物理字段与 decision normalizer 缺失；PostgreSQL 3 fail / 8 pass，复现 hash 全局唯一、tenant/task/container 父链未关闭、ClientOperation scope 未关闭。GREEN：candidate/decision hash 改为服务端规范化业务白名单，decision exact-key/typed-ref/组合校验完成；createCandidate 同事务锁定 tenant+container+NodeTask+WorkOrder，appendDecision 同事务验证 operation tenant+actor+claim action+target；focused ops-assistant unit 83/83、PostgreSQL 11/11，contract generate/check/drift、Prisma format/generate/validate、dictionary fresh-schema generate/check 通过；AI0 保持 fix 待主代理复审。                                |
| 2026-10-20 | AI1 RED/GREEN   | Codex / GPT-5     | none     | RED：focused API 3 files failed（Application/Controller 缺失，Gateway 5 个结构化解释行为失败），AI service pytest 在严格解释类型缺失处 collection error；模块 DI 回归随后复现 `GenerateTaskActionCandidateService` 未解析依赖。GREEN：新增 task-bound generate/get/reject/confirm、provider-neutral rule/model/fallback、确认时 task.read+task.execute/快照重验、work-execution 窄 port 与 candidate advisory-lock 终局协议；focused API 269/269、AI service 11/11、PostgreSQL 19/19（含 confirm-confirm、confirm-reject、响应丢失恢复）通过。偏离：真实 PostgreSQL AI1 barrier 测试在锁协议实现后补齐，首次运行即 GREEN，未伪报 RED；无 contract、Prisma schema/migration 或 dictionary 语义变化。 |
| 2026-10-20 | AI1-R1/R2 修复  | Codex / GPT-5     | none     | RED：focused trace/manifest 回归 4 fail / 18 pass，分别复现客户端 `x-trace-id` 被下传、decision 使用请求 trace、正式 receipt 缺 trace、manifest 未声明 task capability；PostgreSQL 1 fail / 18 pass，复现响应丢失恢复结果缺原 ClientOperation trace；首次 API typecheck 发现内部 receipt trace 不在公共确认回执契约中，新增“不暴露 trace”回归后 1 fail / 17 pass。GREEN：Controller 不再消费客户端 trace；ops-assistant 注入服务端 trace factory；adapter 从正式 ClientOperation 回读 trace，decision 与 receipt 沿用同一 trace；公共 claim 回执经白名单映射保持原契约；manifest 与 Controller capability 集合对拍；focused ops-assistant/work-execution 264/264、PostgreSQL 19/19 通过。           |
