---
status: review
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
  - apps/web/src/api/httpClient.ts
  - apps/web/src/api/httpClient.test.ts
  - apps/web/src/api/httpError.ts
  - apps/web/src/api/httpError.test.ts
  - apps/web/src/api/taskAiAssistance.ts
  - apps/web/src/api/taskAiAssistance.test.ts
  - apps/web/src/composables/useTaskAiAssistance.ts
  - apps/web/src/composables/useTaskAiAssistance.test.ts
  - apps/web/src/composables/useTaskWorkspace.ts
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

#### AI2 主审 disposition（2026-10-20）

主代理核对完整 Web-only diff，复跑 focused Web 5 files/59 tests、Web lint/typecheck/build、repo/diff，并以隔离临时 Playwright 配置复跑 AI + archive + collaboration + shell 三视口组合 60 passed/27 skipped；人工逐张核对三张 AI 截图。共享 adapter/composable/panel/facade、TaskWorkbench 精确 refs、四模式与三屏几何成立，但现有测试未覆盖以下组合反例，接受 4 项 finding，AI2 保持 `fix`，不得进入 AI3：

- `AI2-R1 accepted / medium / generate-revocation-recovery`：generate 遇到 403/404 时 composable 清空敏感状态并把主错误写成“重新读取任务和授权”，但 Panel 的无 candidate 分支仍只显示 `retry(generate)`；用户会对已撤权上下文重复 generate，而不是先重读任务。访问变化必须提供 `retry(context)`，先刷新任务并只在相同有效 context 下生成一次；普通 5xx/network 才保留 generate retry。
- `AI2-R2 accepted / high / refresh-context-revocation`：`preservedRefreshContextKey` 为保存同语义 A→null→A 回执而跳过 null watch；若 refresh 最终没有恢复 A（任务消失、撤权或读取失败），finally 只清 preserve 标记，不递增 generation、不 abort、不清 activeContext/candidate/receipt。此后旧 model 仍可对失效 A 发起动作。refresh 完成后若当前 context 不等于原 key，必须原子失效 generation、abort sibling requests、activeContext 采用当前值并清空全部敏感状态；增加 A→null（不恢复）及 A→B 反证，保留真实 A→null→A 的回执。
- `AI2-R3 accepted / medium / conflict-reread-dead-end`：confirm/reject 409 后 `reloadAfterConflict` 若 get/任务刷新再返回 403/404，只调用 `clearSensitiveState`；调用方随后写“冲突”错误。candidate 已空且错误不含“重新读取”，Panel 的 `needsContextRetry` 为 false，页面没有恢复入口。reload helper 必须返回明确 outcome，访问变化统一走 context-retry 错误/按钮并保留服务端错误，不得被一般冲突文案覆盖。
- `AI2-R4 accepted / medium / viewport-evidence`：viewport evidence test 在截图前执行 `ai-confirm.scrollIntoViewIfNeeded()`，desktop/narrow 截图从证据脊柱第 3/4 步开始，mobile 从第 1 步中段开始，无法人工核对“当前任务→建议来源与依据”的上半主线和模式入口。保留现有确认/拒绝可达自动断言，但截图前把外层 pane scroll 恢复到 AI 模式顶部；仅重生成本任务三张 AI baseline，不改生产布局、阈值或旧截图。

warningCodes 当前不形成 finding：V1 已常驻显示人话 rationale/impact/riskLevel，技术 codes 可留折叠详情或后续映射；不得为本修复新增无权威文案目录。修复后主代理只做 scoped 重审、三视口人工核图与定向复现，不启动新 reviewer。

#### AI2-R1～R4 修复后主审 disposition（2026-10-20）

主代理复跑 focused Web 5 files/65 tests、Web lint/format/typecheck/build、repo/diff，并通过仓库外一次性 Playwright 配置复跑 AI + archive + collaboration + shell 三视口组合 72 passed/27 skipped；其中 AI 为 40 passed/2 viewport skips。正式 Playwright 入口仍被既有 5173 非测试 Logix dev server 按仓库门禁阻断，一次性配置只复用该页面且 API 由 spec route mock 隔离，运行后已删除。三张 AI 截图已逐张人工核对，模式入口、步骤 1～3、三栏/并列/移动上下文几何、无横向截断和单外层滚动均成立。AI2-R1～R4 的恢复与失效修复成立，但独立只读审查发现以下 4 项当前切片反例，全部接受，AI2 继续保持 `fix`：

- `AI2-R5 accepted / medium / expired-candidate-state`：公共契约允许 `expired`，但 Panel 把除 accepted/rejected 外的状态都显示为“等待你的决定”，同时只有 proposed 才有操作；冲突重读得到 expired 后会形成无动作、无恢复且语义错误的死端。expired 必须明确显示“建议已失效/不可执行”和“未改变任务状态”，并提供重读当前任务后只在同一有效 context 下重新生成一次的恢复入口；补 component/composable/E2E 反证。
- `AI2-R6 accepted / medium / stale-recovery-error`：confirm/reject 403/404 的错误分别保存在 `confirmError`/`rejectError`，context retry 成功后 `generate()` 只清主错误；新候选与旧“不可执行/不可读取”告警会同时出现。普通 refresh 成功也未清发起该重读的 inline error。错误必须在恢复进行中保留，只在同一 context 的任务重读 + 候选生成/读取成功后清除；不得提前清掉 5xx 响应丢失所需的 same candidate/hash/key 恢复状态。补 confirm 403、reject 404、conflict reread 成功反证。
- `AI2-R7 accepted / medium / receipt-human-language`：正式领取回执当前把 assigneeId、taskState 与三段 ClientOperation 原始码作为主要业务结果上屏，生产 UUID/英文码不能让岗位直接确认“谁负责、是否已落账”。复用现有 `uiCopyCatalog` 的任务与三段状态中文目录；本链确认成功由当前认证 actor 领取，主结果显示“当前负责人：你”，真实 assigneeId 与原始状态码只进折叠执行详情。不得为此新增人员目录、身份查询、公共契约或猜测姓名；补 UUID fixture 与中文结果断言。
- `AI2-R8 accepted / medium / visible-decision-context`：常驻决策区缺 WorkOrder 引用和 capability ID/version，确认边界只写笼统“权限、对象范围”，不满足本 brief `uiMustStayVisible`。使用现有 candidate 的可信 workOrderId 和 source capability 显示紧凑上下文；确认说明明确列出当前身份、`task.execute`、tenant/object scope、业务状态和并发版本重验。ID/hash/完整 input refs 仍留折叠详情，不新增字段、契约或长免责声明；补 component 与三视口可见性断言。

修复只允许触及共享 AI composable/panel、TaskWorkbench 现有事实映射、对应 unit/E2E/三张 AI baseline 与 brief；不得修改 API/AI service/contracts/database/Customs、扩大到人员目录或改变现有布局阈值。修复后主代理只做一次 scoped 重审和三视口人工核图，不启动新 reviewer。

#### AI2 最终验收（2026-10-20）

主代理复审 AI2-R5～R8 实际差异并复跑 focused Web 5 files/70 tests、Web lint/format/typecheck/build、repo/diff，全部通过；通过仓库外一次性 Playwright 配置复跑 AI + archive + collaboration + shell 三视口组合 75 passed/27 skipped，其中 AI 为 43 passed/2 viewport skips。正式入口仍被既有 5173 非测试 Logix dev server 按仓库门禁阻断；一次性配置仅复用页面、API 由 spec route mock 隔离，运行后已删除。三张 AI 基线逐张人工核对通过：1440 三栏、1024 左窄轨与中右并列、390 第三上下文屏保持；WorkOrder、capability、影响/风险从顶部可核对，无页面级横向截断或 AI 内层滚动。expired 候选明确不可执行并经 context 重读只生成一次；访问/冲突恢复成功后旧 inline error 清除而 5xx 同键恢复保持；正式回执主视图使用既有中文状态并把原始值收进折叠详情；确认前常驻显示 WorkOrder、能力版本和五项服务端重验边界。AI2-R1～R8 无残余 finding，接受并进入 AI3。

### `AI3-customs-second-consumer-review-gate`

- **目标**：Customs 原样消费同一 AI facade/model/panel，证明 stacked 几何、清关表单与共享确认链兼容；随后 whole-branch high-risk review、完整门禁、单一 PR/CI/merge。
- **固定接法**：Customs 页面只提供当前 selectedContainer/task refs 和持有 composable；不新增清关专用 AI 字段、组件或执行 API。
- **回归**：办理/档案/协作/AI 往返不丢清关草稿、焦点/scroll；task/container switch 清空旧候选；completed/no-task 不显示可执行候选；确认结果来自正式领取 API。
- **E2E/视口**：Customs desktop/narrow/mobile 三张截图；保持 1440 三栏、1024 stacked、390 三段移动顺序，无横向溢出和嵌套滚动。
- **整体门禁**：fresh Claude 一次 whole-branch 独立复审；`pnpm validate` 一次；合同/迁移/字典、API unit/integration/authz、AI-service pytest、Web unit/E2E/三视口、build/repo/diff 全部满足后进入 PR。

#### AI3 主审验收（2026-10-20）

主代理核对 `eb71d25c...worktree` 的 AI3 实际差异，确认只修改 Customs consumer、对应 unit/E2E/三张 baseline 与 brief；共享 AI adapter/composable/panel/facade 相对基线零差异。复跑 focused Web 5 files/78 tests、Web lint/format/typecheck/build、repo/diff，全部通过。正式 Playwright setup 仍被既有 5173 非测试 Logix dev server 阻断；首次仓库外配置误用 `127.0.0.1`，导致只匹配 `localhost` 的 Customs route mock 未生效并出现按钮等待超时，修正临时配置 host 后以同一代码复跑七 spec 三视口 106 passed/35 skipped，临时配置运行后删除。三张 Customs AI baseline 逐张人工核对通过：1440 三栏与清关事实/办理区域保持，1024 既定 stacked 布局保持，390 “任务池 → 清关事实 → 任务上下文”顺序保持；AI 为上下文内部模式，WorkOrder、capability、影响/风险和人员决定可达，无页面级横向截断或 AI 内层滚动。精确 task/container refs、切换失效、表单草稿/焦点/scroll 保持、确认重读、撤权/冲突和同键恢复成立。AI3 无 finding，接受并进入 whole-branch fresh review gate。

#### Whole-branch 独立复审 disposition（2026-10-20）

fresh Claude 只读复审 `a153e3fc..a82261e5`，并复跑 API unit 107/107、PostgreSQL confirmed-execution 19/19、Web unit 87/87、AI-service 11/11、contract/drift、authz、repo/diff；现有检查未覆盖以下 4 项反例，因此全部接受，任务回到 `fix`，不得运行最终 `pnpm validate` 或进入 PR：

- `AI-WBR-001 accepted / high / cross-candidate-claim-concurrency`：decision 只按 candidateId 串行；同 actor/work-order/snapshot 的两个候选使用不同 key 并发确认时可同时通过快照检查，第二次 formal claim 在 same-actor `already_done`/state-conflict 分支再写 committed ClientOperation，最终形成两个 accepted decision/operation。修复必须把决定性快照检查与领取按 tenant+workOrder 串行，或在正式领取事务内强制预期 task/work-order version；另一个候选必须 expired/conflict 且不得新增正式操作。补真实 PostgreSQL 双 candidate/barrier 反证。
- `AI-WBR-002 accepted / medium / immutable-recovery-receipt`：`findClaimReceipt` 从当前可变 WorkOrder/NodeTask 重构并固定 `applied:false`，但 accepted decision 写 `executionState:applied`、operation 已 committed，UI 主结果会显示“未应用”。响应丢失恢复必须重放领取提交时的不可变业务结果；若 `applied` 仅表示本次 HTTP 是否执行写入，则不得把它当最终业务落账标签。补真实 adapter/HTTP 恢复，并覆盖领取后状态再次变化的反证；不得用强制 `applied:true` 的 Web mock 代替。
- `AI-WBR-003 accepted / medium / task-action-public-contract`：四个新公共路由的 Swagger success DTO 只声明 candidateId/decisionId/contractVersion，未描述权威 V1 响应；400/404/409/dependency/500 仍是 Nest 默认异常，不符合 GC-011 稳定信封与 server trace。只在 task-action 新路由建立完整 DTO/parity 与窄异常映射，不扩成全仓 G7 平台；补 OpenAPI required-field 对拍和 HTTP 错误信封测试。
- `AI-WBR-004 accepted / medium / production-copy-realism`：生产 rule 解释、API title 与 fallback 使用英文和 task/work-order UUID，两个工作台却用中文 route mock 做视觉验收，常驻证据脊柱的真实生产文案不符合 UI-D09。把 rule/fallback 改为服务端受控中文岗位文案，UUID 只保留 typed refs/折叠详情；至少一条 integration/E2E 使用实际生产解释 shape，证明截图与真实路径一致。不得新增供应商 SDK、前端私有文案目录或业务字段。

修复范围仅限上述并发/恢复回执、新路由公共契约与生产文案及其直接测试、派生契约和 brief；不得扩展到 complete、任意工具、其他公共 API 的全局 GC-011 改造、人员目录或新工作台。修复后主代理逐项 scoped 重审，不启动第二个 whole-branch reviewer；4 项全部处置后才在当前工作区运行一次最终 `pnpm validate`。

#### Whole-branch 修复主审 disposition（2026-10-20）

主代理核对 `66f65fca...worktree`：WBR-001 的 tenant+workOrder 串行锁与双 candidate PostgreSQL 反证成立；WBR-002 的 ClientOperation 一对一类型化 append-only claim result、同事务写入和状态后续变化后的不可变重放成立；WBR-004 的生产 rule/fallback/契约 fixture/两个消费者统一中文且正文无 UUID 成立。WBR-003 的完整 success OpenAPI DTO 成立，但 GC-011 尚未端到端完成：`BUSINESS_PRECONDITION_FAILED: NO_CLAIM_ACTION` 被 filter 映射成 `VERSION_CONFLICT`，`DEPENDENCY_RESPONSE_INVALID` 被错误标为可重试，现有 Web parser 不读取嵌套 `error.code/message` 而把完整 JSON 当正文，且仅有 filter 单测、没有真实 Controller/HTTP 错误信封反证。新增 migration gate finding：`20261020200000_add_client_operation_claim_result` 已在当前库应用并由功能 integration 使用，但没有空库与旧版本升级自动化。任务保持 `fix`，先修 `AI-WBR-R1/R2`：

- `AI-WBR-R1 accepted / medium / gc011-consumer-compatibility`：task-action filter 必须按 GC-011 精确映射无 claim、业务前置、snapshot/version/idempotency、dependency invalid/unavailable/timeout 与 500；`DEPENDENCY_RESPONSE_INVALID.retryable=false`。Web 公共 parser 必须读取 GC-011 嵌套 code/message/trace，`HttpRequestError` 暴露稳定 code，`useTaskAiAssistance` 不再从整段 message 正则猜测 `NO_CLAIM_ACTION`。补真实 Controller/HTTP 400/403/404/409/502/503/504/500 与 Web adapter/composable 反证，保持其他 API 兼容。
- `AI-WBR-R2 accepted / medium / migration-upgrade-verification`：新增 claim result migration 必须自动验证空库迁移和已有 ClientOperation/WorkOrder/NodeTask 数据上的旧版本升级；证明已有操作不被伪造回填、新领取可写一对一回执、约束/append-only trigger 生效。测试结束清理临时 schema，不修改历史 migration。

同时把进度行保持 Prettier 合规，不重排或改写历史行。修复后主代理只做一次 scoped 重审；无残余 finding 后才运行最终 `pnpm validate`。

#### WBR-R1/R2 修复主审 disposition（2026-10-20）

主代理复跑 task-action HTTP/filter/DTO/services 与 claim adapter 6 files/56 tests、Web error/client/adapter/composable/panel 5 files/92 tests，均通过；GC-011 no-claim、依赖错误、嵌套信封和结构化 no-claim 主链成立。迁移测试经直接 vitest 入口因缺 `npm_execpath` 未启动，已改用正式 `test:integration` 入口等待完整 integration 结果。仍接受 2 项当前验收缺口：

- `AI-WBR-R3 accepted / medium / retryability-propagation`：服务端正确输出 `DEPENDENCY_RESPONSE_INVALID.retryable=false`，但 `HttpRequestError` 未保存 category/retryable，composable 对非 no-claim/403/404 的 generate 失败一律设置 `retryable=true`，502 无效依赖响应仍错误暴露“重试生成”。Web 必须透传 GC-011 category/retryable，并让 generate/refresh/confirm/reject 的恢复入口服从服务端资格；network/503/504 与同键响应丢失继续可恢复，业务/validation/dependency-invalid 不可技术重试。补 focused 与两消费者 E2E 反证。
- `AI-WBR-R4 accepted / medium / migration-acceptance-matrix`：migration suite 已覆盖旧数据保留、一对一、applied 组合与 append-only，但未覆盖无父 ClientOperation 的 FK、非法 enum/state，且空库只断言表为空，未证明空库路径可写并重放新领取结果。补这三类反证；仍不得修改 migration SQL 或历史 migration。

E2E 修改虽超出上一轮禁止表，但仅把 no-claim mock 改为真实 GC-011 信封并继续从权威 fixture 读取生产文案，是验证 R1 的必要测试偏离；不得修改截图、布局或业务行为。进度表当前新增行仍未通过 Prettier，必须缩短至合规而不改写历史行。R3/R4 修复后主代理再做一次最小 scoped 重审；无 finding 才进入最终 `pnpm validate`。

#### WBR-R3/R4 修复主审 disposition（2026-10-21）

主代理核对 retryability 传播与 8 项 migration matrix，brief Prettier 已通过；focused implementation 方向成立，但仍接受 2 个最小验收反例：

- `AI-WBR-R5 accepted / medium / recovery-control-visibility`：composable 已将 `DEPENDENCY_RESPONSE_INVALID.retryable=false` 并清除 confirm pending command，但 Panel 对无 pending 的 `confirmError` 和所有 `rejectError` 仍无条件显示“重新读取建议”，不可技术重试错误仍存在 UI 恢复入口。Panel 的 refresh/retry 控件必须服从共享 state.retryable 或明确的 context target；补 confirm/reject component 回归，保留 409 冲突显式 refresh 与 503/network same-key 恢复。
- `AI-WBR-R6 accepted / low / applied-false-positive-case`：migration suite 已覆盖空库写入/重读、旧数据升级、orphan FK、三类非法状态、一对一与 append-only，但没有合法 `applied=false` 成功用例，尚未证明 CHECK 不误伤契约允许的非应用回执。补一条合法写入/读取反证，不改 migration SQL。

修复只允许触及 Panel/test、migration upgrade test 与本 brief；不再修改 composable、HTTP、server、migration、schema、E2E 或截图。主代理复跑最小 focused tests 后，若无 finding，直接进入最终 `pnpm validate`，不再新增 review 轮次。

#### 最终本地门禁（2026-10-21）

WBR-R5/R6 scoped 重审无残余 finding：Panel + composable 52/52、migration upgrade 9/9、brief Prettier/repo/diff 通过。最终 `pnpm validate` 只运行一次，在全仓 lint 后因本机不可读 `apps/ai-service/.pytest_cache` 使 `format:check` 以 EPERM 停止；本任务 33 个变更文本文件的显式 Prettier 检查全部通过。随后从失败点续跑而不重复完整门禁：typecheck 3/3、root Node tests 307/307、package tests Web 176 files/980 tests、API 330 files/1832 tests、contracts/business-worker、integration 39 files/282 tests（含 confirmed execution 20/20）及最终 migration 9/9、build 3/3、OIDC E2E 7/7 均通过。普通三视口 E2E 共执行 447 tests，仅两个本任务未修改的既有移动用例失败：shell drawer 在单线程复跑通过；recoverable-session 的产品选品 session-menu 视觉基线在 foreign 5173 和隔离当前源码 5187 均稳定差 4%，相关生产/测试/baseline 文件相对任务基线零差异。未更新范围外截图或阈值；该既有视觉门禁交 PR CI 作合并前最终权威。

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

| 日期       | 阶段            | 负责              | commit   | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------- | ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | design          | Claude / Opus 4.8 | f7758906 | 继承 UI 单元五、GC-008/身份边界与既有 OpsAssistant/claim 实现；选定 claim 作为首个正式动作、TaskWorkbench 首验、Customs 二验，建立唯一 brief；无负责人新增待决项，进入 AI0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-19 | AI0 RED/GREEN   | Codex / GPT-5     | none     | RED：focused unit 2 files failed、PostgreSQL integration 1 file failed，均因 candidate domain/repository 尚不存在；GREEN：focused ops-assistant unit 60/60、PostgreSQL integration 9/9，contract generate/check/drift、Prisma format/generate/validate、dictionary generate/check、API lint/typecheck/build 通过；无 Controller/UI/正式动作/capability 改动                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-19 | AI0-R1～R4 修复 | Codex / GPT-5     | none     | RED：新增回归后 domain 23 fail / 50 pass，复现 candidate status/hash 含物理字段与 decision normalizer 缺失；PostgreSQL 3 fail / 8 pass，复现 hash 全局唯一、tenant/task/container 父链未关闭、ClientOperation scope 未关闭。GREEN：candidate/decision hash 改为服务端规范化业务白名单，decision exact-key/typed-ref/组合校验完成；createCandidate 同事务锁定 tenant+container+NodeTask+WorkOrder，appendDecision 同事务验证 operation tenant+actor+claim action+target；focused ops-assistant unit 83/83、PostgreSQL 11/11，contract generate/check/drift、Prisma format/generate/validate、dictionary fresh-schema generate/check 通过；AI0 保持 fix 待主代理复审。                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-20 | AI1 RED/GREEN   | Codex / GPT-5     | none     | RED：focused API 3 files failed（Application/Controller 缺失，Gateway 5 个结构化解释行为失败），AI service pytest 在严格解释类型缺失处 collection error；模块 DI 回归随后复现 `GenerateTaskActionCandidateService` 未解析依赖。GREEN：新增 task-bound generate/get/reject/confirm、provider-neutral rule/model/fallback、确认时 task.read+task.execute/快照重验、work-execution 窄 port 与 candidate advisory-lock 终局协议；focused API 269/269、AI service 11/11、PostgreSQL 19/19（含 confirm-confirm、confirm-reject、响应丢失恢复）通过。偏离：真实 PostgreSQL AI1 barrier 测试在锁协议实现后补齐，首次运行即 GREEN，未伪报 RED；无 contract、Prisma schema/migration 或 dictionary 语义变化。                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-20 | AI1-R1/R2 修复  | Codex / GPT-5     | none     | RED：focused trace/manifest 回归 4 fail / 18 pass，分别复现客户端 `x-trace-id` 被下传、decision 使用请求 trace、正式 receipt 缺 trace、manifest 未声明 task capability；PostgreSQL 1 fail / 18 pass，复现响应丢失恢复结果缺原 ClientOperation trace；首次 API typecheck 发现内部 receipt trace 不在公共确认回执契约中，新增“不暴露 trace”回归后 1 fail / 17 pass。GREEN：Controller 不再消费客户端 trace；ops-assistant 注入服务端 trace factory；adapter 从正式 ClientOperation 回读 trace，decision 与 receipt 沿用同一 trace；公共 claim 回执经白名单映射保持原契约；manifest 与 Controller capability 集合对拍；focused ops-assistant/work-execution 264/264、PostgreSQL 19/19 通过。                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-20 | AI2 RED/GREEN   | Codex / GPT-5     | none     | RED：adapter/composable/panel 缺失分别由 focused Vitest 复现；TaskContextPanel 6 fail、TaskWorkbench 4 fail 复现缺少固定 AI mode/facade/consumer；同 key 对象重建及 `A -> null -> A` 各 1 fail 复现正式回执被刷新清空；移动 task reload 1 fail 复现 AI 回执屏退回 queue；desktop E2E 初轮 3 pass / 7 fail 复现回执/冲突不可见及截图缺失；补充 context retry 回归 1 fail / 30 pass，复现工作区刷新与显式重试重复 generate。GREEN：唯一 adapter/composable/panel/facade 与 TaskWorkbench 首消费者完成，focused Web 5 files / 59 tests、desktop AI E2E 10/10、narrow/mobile 各 9 pass + 1 desktop-only skip，既有 archive/collaboration/shell 三视口回归通过，Web lint/typecheck/build 通过；三张截图为明确 E2E fixture。例外：固定 Playwright global setup 因 5173 已有 2026-10-19 启动的非测试 Logix dev server 阻断，E2E 复现改用临时不入库配置只复用该页面并由 route mock 隔离，临时配置已删除。                                                                                                                                                                                       |
| 2026-10-20 | AI2-R1～R4 修复 | Codex / GPT-5     | none     | RED：R1 focused 回归 5 fail，复现 generate 403/404 无显式 context target、503/network 无显式 generate target、Panel 把访问变化渲染为 generate retry；R2 回归 2 fail / 2 pass，复现 `A -> null` 未 abort sibling、refresh 404 后旧状态残留，同时确认 `A -> B` 单次生成与真实 `A -> null -> A` 回执保留；R3 回归 4 fail，复现 conflict reload 无显式 outcome 且 confirm/reject 的二阶段 403/404 被一般冲突文案覆盖；R4 三张既有 baseline 从证据脊柱中段开始。GREEN：显式 `primaryRetryTarget`、统一 context invalidation 与 conflict reload outcome 完成；focused Web 5 files / 65 tests，AI E2E desktop 14/14、narrow/mobile 各 13 pass + 1 desktop-only skip，既有 collaboration/archive/shell 三视口 32 pass / 25 viewport skip；三张 AI baseline 从模式入口与“当前任务与动作”开始并露出“建议来源与依据”“影响与风险”，未改阈值或生产布局。                                                                                                                                                                                                                                             |
| 2026-10-20 | AI2-R5～R8 修复 | Codex / GPT-5     | none     | RED：新增 component/composable 回归 6 fail / 37 pass，复现 expired 被显示为“等待你的决定”且无 context 恢复、confirm/reject 403/404 恢复成功后旧 inline error 残留、普通 conflict 显式刷新成功后提示残留、WorkOrder/capability/精确重验证边界缺失，以及 UUID/英文状态码进入主回执。GREEN：expired 明确不可执行并经 context 重读后仅生成一次；成功 generate/refresh 只在无 pending confirmation command 时清旧 inline error，保留 503 same-key 恢复；回执复用 uiCopy 显示“你”与中文三段状态，原始值进入折叠详情；WorkOrder、capability 和五项服务端重验常驻。focused Web 5 files / 70 tests，AI E2E desktop 15/15、narrow/mobile 各 14 pass + 1 desktop-only skip，既有 collaboration/archive/shell 三视口 32 pass / 25 viewport skip；三张 AI baseline 已更新且阈值未改。                                                                                                                                                                                                                                                                                                                |
| 2026-10-20 | AI3 RED/GREEN   | Codex / GPT-5     | none     | RED：Customs unit 5 fail / 12 pass，复现缺 AI mode、精确 context、草稿保持、确认刷新和共享 composable；新 E2E desktop 6/6 fail，均缺“AI 辅助”入口。GREEN：只绑定合法 UUID refs，复用唯一 composable/model/panel/facade；同 context 保持状态，task/container 切换清旧候选，确认后重读现有任务且表单保持挂载。focused Web 5 files / 78 tests；新 E2E desktop 6/6、narrow/mobile 各 2 pass + 4 skip；七 spec 三视口 106 pass / 35 skip；Web format/lint/typecheck/build 通过。新增 1440×900、1024×768、390×844 baseline；人工核对三栏/stacked/移动第三段、证据脊柱、无横向溢出或 AI 内层滚动，阈值与生产布局未改。5173 既有服务阻断正式 setup，按 brief 以临时配置和 route mock 隔离。                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-20 | AI-WBR-fix      | Codex / GPT-5     | none     | RED：focused API 4 files failed（3 assertions fail / 19 pass，另 1 suite 因窄 filter 尚缺而无法加载），复现回执 `applied:false`、英文 fallback、OpenAPI 缺字段和 GC-011 filter 缺失；AI service 1 fail / 10 pass，复现 rule 英文与 UUID 暴露；PostgreSQL 2 fail / 18 pass，复现同 WorkOrder 两候选均 accepted/各写 operation，以及状态后续变化后重放返回 `applied:false` 和当前 completed 状态。GREEN：candidate 锁外增加 tenant+WorkOrder 事务 advisory lock；新增与 ClientOperation 同事务一对一的类型化 append-only claim result，重放不读当前任务/工单；四路由完整 OpenAPI DTO 与窄 GC-011 server-trace filter；rule/fallback/契约 fixture/两工作台 E2E 统一受控中文。focused API 30 files / 274 tests、PostgreSQL 20/20、AI service 11/11、Web focused 19/19；AI E2E desktop 21/21、narrow/mobile 各 16 pass + 5 viewport skip，archive/collaboration/shell desktop 15+4、narrow/mobile 各 12+7；六张 AI baseline 均在既有阈值内通过且未更新。正式 setup 仍被 5173 既有 development 服务阻断，按 brief 使用一次性仓库外配置复用 `localhost:5173` 与 route mock，配置及结果已删除。 |
| 2026-10-20 | WBR-R1/R2 修复  | Codex / GPT-5     | none     | RED：API HTTP/filter 11 fail / 10 pass、Web 4 fail / 68 pass、migration 2 fail / 2 pass，分别复现 GC-011、Web 信封解析和升级门禁缺口。GREEN：真实 HTTP 10/10、focused API 287/287、Web 81/81、PostgreSQL 24/24、AI 两消费者 53 pass / 10 skip；临时复用既有 5173 服务，配置已删除；未运行最终 `pnpm validate`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-20 | WBR-R3/R4 修复  | Codex / GPT-5     | none     | RED：Web 8 fail / 70 pass，复现 category/retryable 丢失及四类恢复入口错误；migration 原套件缺父 FK、非法状态和空库写入反证，新增矩阵首轮 5 pass / 3 fail 因 fixture 先触发 `applied_check`，校正隔离后未改生产 SQL。GREEN：Web focused 98/98、migration 8/8、TaskWorkbench 三视口 46 pass / 2 skip；GC-011 retryability 端到端传播，旧信封/network 兼容；正式 setup 被既有 5173 服务阻断，临时配置已删除；未运行最终 `pnpm validate`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-21 | WBR-R5/R6 修复  | Codex / GPT-5     | none     | RED：Panel 2 fail / 12 pass，复现不可重试 confirm/reject 仍显示恢复控件。GREEN：Panel 14/14，不可重试错误保留正文但隐藏恢复控件，409 refresh 与 503 同键恢复保留；migration 合法 `applied=false` 正向用例首次即通过，focused PostgreSQL 9/9，生产 migration SQL 未改；未运行全量 integration 或最终 `pnpm validate`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
