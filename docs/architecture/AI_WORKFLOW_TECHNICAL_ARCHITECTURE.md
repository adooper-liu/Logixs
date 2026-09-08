# AI 工作流技术架构

## 1. 文档状态

| 项目     | 内容                                           |
| -------- | ---------------------------------------------- |
| 状态     | 已接受，作为项目底座实施依据                   |
| 适用范围 | Web、业务 API、AI 服务、工作流、数据及基础设施 |
| 架构风格 | 模块化单体 + 持久化工作流 + 独立 AI 能力服务   |
| 核心原则 | AI 参与业务流程，但不拥有业务事实和最终执行权  |

本文件描述当前目标架构。具体版本在工程初始化时通过锁文件固定，不在本文中维护易过期的版本号。

## 2. 建设目标

系统需要在物流导入、数据归一化、异常处置、ETA 预测、文档处理和客户通知等工作流中使用 AI，而不是建设一个与业务割裂的集中式对话窗口。

架构必须同时满足：

- AI 能力可嵌入、组合、审核、暂停、恢复和回放。
- 确定性业务规则与概率性模型输出明确隔离。
- 模型、供应商和 Prompt 可以替换，不污染领域代码。
- 所有 AI 结果具备来源、版本、成本、审批和采用记录。
- 核心业务在模型不可用时可以失败关闭或受控降级。
- 用户始终在业务对象上下文中查看、审核和执行 AI 建议。

## 3. 系统上下文

```text
用户 / 外部系统
       |
       v
Vue 3 Web -- REST / SSE / WebSocket --> NestJS Business API
                                                    |
                    +-------------------------------+-----------------------------------+
                    |                               |                                   |
                    v                               v                                   v
          PostgreSQL + pgvector                 Temporal                  AI Gateway (in Business API)
               MinIO / S3                    Workflow Engine                            |
                                                    |                                   |
                                                    v                                   |
                                      +---------------------------+                     |
                                      |                           |                     |
                                      v                           v                     v
                              TS Business Worker          Python AI Worker     FastAPI AI Service
                                                                                        |
                                                                                        |
                                                                                        v
                                                                                  LiteLLM Proxy
                                                                                        |
                                                                                        v
                                                                                 Model Providers
                                                                          (LLM / Embedding / Reranker / OCR)
```

业务 API 是认证、授权、业务校验和最终写入的唯一入口。AI 服务及 AI Worker 不直接写生产业务表。

调用路径：业务 API 内的 AI Gateway 负责治理并转发，不直接面向模型供应商；所有 AI 能力统一由 FastAPI AI Service 实现，并经 LiteLLM Proxy 调用模型。Temporal 的 Python AI Worker 执行 AI Activity 时同样调用 FastAPI AI Service。OCR、Embedding、Reranker 与通用 LLM 均作为模型供应商接入。

## 4. 最终技术选型

| 层级          | 技术                             | 决策理由                                   |
| ------------- | -------------------------------- | ------------------------------------------ |
| Monorepo      | pnpm Workspace + Turborepo       | 统一 TypeScript 依赖、任务和构建缓存       |
| Python 工具链 | uv                               | 快速、确定性的环境和依赖管理               |
| Web           | Vue 3 + TypeScript + Vite        | 适合密集型运营后台及渐进式模块化           |
| UI            | Element Plus + 业务组件层        | 提供基础控件，业务语义由项目组件封装       |
| 服务端状态    | TanStack Query for Vue           | 管理请求缓存、刷新、失效和异步状态         |
| 客户端状态    | Pinia                            | 仅保存会话、权限和全局偏好                 |
| 业务后端      | NestJS + Fastify                 | 强模块边界、依赖注入、鉴权和高效 HTTP      |
| ORM/迁移      | Prisma                           | 类型化查询和集中迁移工作流                 |
| AI 服务       | Python + FastAPI + Pydantic      | 适配文档、NLP、检索、预测和模型生态        |
| 持久化工作流  | Temporal                         | 支持长流程、人工审批、重试、补偿和恢复     |
| 主数据库      | PostgreSQL                       | 保存业务事实、审计、审批及 AI 元数据       |
| 向量检索      | pgvector                         | 初期复用 PostgreSQL 的事务、权限和运维能力 |
| 缓存          | Redis                            | 仅用于缓存、限流和可丢失短期状态           |
| 对象存储      | S3 API / MinIO                   | 保存原始文档、导入文件和 AI 产物           |
| 模型入口      | LiteLLM Proxy + 业务 AI Gateway  | 分离供应商路由与业务治理                   |
| API 契约      | OpenAPI + JSON Schema            | 生成客户端并校验 Tool 和 AI 输出           |
| AI 可观测性   | Langfuse                         | 记录 Prompt、模型、Token、成本和评测       |
| 全链路观测    | OpenTelemetry                    | 统一 API、Workflow、Activity 和 AI Trace   |
| 监控          | Prometheus + Grafana             | 指标、仪表板和告警                         |
| 日志与 Trace  | Pino + Loki + Tempo              | 结构化日志和跨组件追踪                     |
| 测试          | Vitest + pytest + Testcontainers | 覆盖 TS、Python 和真实基础设施集成         |
| E2E           | Playwright                       | 验证关键业务及人工审核流程                 |
| 身份协议      | OIDC / OAuth 2.1                 | 支持企业身份源及 Keycloak 等实现           |

## 5. 仓库结构

```text
project/
|-- apps/
|   |-- web/                       # Vue 业务工作台（TypeScript）
|   |-- api/                       # NestJS 业务 API——业务服务端（TypeScript）
|   `-- ai-service/                # FastAPI AI 能力服务——AI 边界（Python）
|-- workers/
|   |-- business-worker/           # Temporal 业务 Activity（TypeScript）
|   `-- ai-worker/                 # Temporal AI Activity（Python）
|-- packages/
|   |-- domain/                    # 纯领域规则和状态机
|   |-- contracts/                 # DTO、事件和错误码
|   |-- ai-contracts/              # AI 输入输出和 Tool Schema
|   |-- workflow-contracts/        # 工作流命令和状态
|   |-- api-client/                # OpenAPI 生成客户端
|   |-- config/                    # 共享工程配置
|   `-- testing/                   # Fixture、Factory 和 Mock
|-- database/
|   |-- migrations/                # 唯一迁移入口
|   |-- seeds/
|   `-- schema/
|-- prompts/                       # 版本化 Prompt 源文件
|-- evals/                         # 数据集、评分器和报告
|-- infrastructure/
|   |-- docker/
|   |-- temporal/
|   |-- monitoring/
|   `-- deployment/
`-- docs/
```

TypeScript 包由根 `pnpm-lock.yaml` 锁定。Python 项目使用各自明确的 `pyproject.toml`，由根级工作区和 `uv.lock` 统一管理。

**语言边界：业务服务端与前端为 TypeScript，Python 只用于 AI 边界。** `apps/api`（NestJS 业务 API）、`apps/web`、`workers/business-worker` 以及 `domain`、`contracts`、`workflow-contracts`、`config`、`testing` 等共享包为 TypeScript；`ai-contracts` 等跨语言 Schema 以 JSON Schema / OpenAPI 作中性表示。Python 仅承担 `apps/ai-service`（FastAPI 能力服务）、`workers/ai-worker` 与 `evals`（AI 评测）。业务事实、权限、事务与最终写入只在 TS 侧完成，主服务端不得改用 Python，业务写入逻辑也不得下沉到 Python 侧。跨语言共享契约必须由单一权威源生成或派生，并以 Contract Parity 一致性测试防漂移（见 ENGINEERING_RULES §7、P3-13）。

## 6. 业务后端架构

### 6.1 模块划分

~~~text
apps/api/src/modules/
|-- shipment-registry/           # 一柜一档身份与关联
|-- lifecycle-control/           # 14节点主流程与状态机
|-- work-execution/              # 工序任务、作业工单与动作
|-- booking-origin/              # 订舱至起运前作业
|-- ocean-port-visibility/       # 海运与港口可视化事实
|-- customs-compliance/          # 报关、换单、缴税与放行
|-- inland-fulfillment/          # 提柜、派送、卸柜、验箱与还箱
|-- charges-settlement/          # 超期费用、账单与对账
|-- document-records/            # 单证、证据与归档
|-- performance-improvement/     # KPI、绩效、复盘与改善
|-- integration-import/          # 导入与外部适配器
|-- exception-management/        # 异常、恢复与升级
|-- identity/                    # 租户、用户、角色与权限
|-- master-data/                 # 港口、船司、仓库等字典
|-- notification/               # 通知编排与发送记录
|-- workflow/                   # Temporal启动、查询与取消
|-- ai-governance/              # AI权限、策略和配额
+-- audit/                       # 操作审计
~~~

模块所有权、公开端口、调用方向和拆分禁令以 [ADR-010](./decisions/ADR-010-bounded-context-modules.md) 与 [MODULE_DEPENDENCIES](./MODULE_DEPENDENCIES.md) 为准。模块数量不代表部署单元数量，当前仍为模块化单体。

### 6.2 分层及依赖

```text
Controller -> Application Use Case -> Domain
                                      ^
                                      |
                         Repository / Adapter Interface
                                      ^
                                      |
                         Infrastructure Implementation
```

- Controller 只处理协议、输入验证和响应转换。
- Application 层负责编排权限、事务、领域能力和工作流。
- Domain 保存状态机、实体、值对象和业务不变量，不依赖 NestJS 或 Prisma。
- Infrastructure 实现数据库、对象存储、模型供应商和外部物流 Adapter。
- 数据库实体不得直接作为 API 响应或 AI 输入输出契约。

## 7. AI 能力架构

### 7.1 能力而非聊天入口

AI 服务以业务能力暴露接口：

```text
suggest_import_mapping
extract_shipping_document
normalize_external_status
explain_container_delay
draft_customer_notification
retrieve_operating_procedure
predict_arrival_window
```

每项能力必须具有稳定标识、版本、风险等级、输入 Schema、输出 Schema、超时、预算、校验器、降级策略和评测集。

能力应面向业务问题设计并尽量通用、参数化：新需求优先通过扩展参数、组合与复用既有能力满足，不为单一口语化说法或单一数据来源新增窄能力；新增能力必须满足上述要素并通过评审。避免能力清单随需求增长而无序膨胀。

### 7.2 AI Gateway

LiteLLM Proxy 负责供应商协议统一、基础模型路由和供应商级统计。FastAPI AI Service 实现各业务能力（见 7.1）并统一发起模型调用。业务 API 中的 AI Gateway 不直接面向模型供应商，只负责治理与转发，承担：

- 用户、租户、业务对象和能力权限校验。
- 输入裁剪、敏感信息处理和数据驻留策略。
- 预算、限流、超时与降级策略执行；模型与供应商路由由 AI Service 内经 LiteLLM Proxy 完成。
- Prompt、Tool、模型和 Schema 版本绑定。
- 结构化输出校验、业务规则复核和引用验证。
- 调用、成本、审批、反馈和最终采用结果审计。

页面、领域模块和 Workflow 不得直接调用模型供应商。

确定性优先与最小输入：批量解析、规则校验、事务写入等可确定步骤一律用代码完成，不让模型参与；AI 能力只接收完成该步骤所需的最小输入，默认限定为表头、抽样样本与低置信度项的上下文。除评测与审计用途外，禁止将整批或全表原始数据送入 Prompt；大批量数据由确定性层按固定行数分块处理后，再选择性送样。禁止采用“把全量数据读入对话 → 由模型改写 → 回写”的处理模式。

### 7.3 Agent 边界

```text
模型提出 Tool Call
-> AI Gateway 校验参数和身份
-> Policy 判断权限、风险和审批要求
-> 业务 API / Activity 执行确定性操作
-> 返回最小必要结果
-> 模型形成结构化建议或说明
```

不得向模型提供任意 SQL、任意 HTTP、任意文件访问或任意代码执行工具。AI 不得自主删除业务事实、变更权限、确认费用、推进关键状态或向未知对象发送通知。

LangGraph 只允许用于单个、边界明确的复杂 AI Activity，不得代替 Temporal 或成为全局业务编排器。普通抽取、分类和生成优先直接使用模型 SDK 的结构化输出。

## 8. 工作流架构

### 8.1 Temporal 职责

Temporal 管理业务流程的状态、等待、重试、超时、人工信号和补偿。业务数据库只保存业务事实及面向用户的流程摘要，不得在其中另行维护一套与 Temporal 平行的流程状态机。

Workflow 代码必须保持确定性。模型调用、数据库访问、网络请求、文件解析和随机操作全部放入 Activity。

### 8.2 标准 AI 步骤

```typescript
interface AiWorkflowStep<I, O> {
  id: string;
  version: string;
  riskLevel: "L0" | "L1" | "L2" | "L3" | "L4"; // 执行时自动化模式由 §9 分级推导
  inputSchema: Schema<I>;
  outputSchema: Schema<O>;
  requiredPermissions: string[];
  timeoutMs: number;
  maxCost: number;
  execute(input: I, context: WorkflowContext): Promise<O>;
  validate(output: O): ValidationResult;
  fallback(input: I, error: Error): Promise<O | null>;
}
```

### 8.3 首批工作流

#### 智能导入

```text
上传文件
-> 确定性解析
-> AI 识别列语义
-> 建议标准字段映射
-> 确定性数据验证
-> 等待低置信度项审核
-> 生成预检报告
-> 事务导入
-> 自动对账
```

#### 异常处置

```text
规则检测计划偏差
-> AI 汇总上下文和相似案例
-> 生成原因与处置建议
-> 人员审核
-> 创建任务或升级
-> 跟踪处理结果
```

#### 客户通知

```text
业务事件触发
-> 系统确定收件人与允许披露数据
-> AI 生成多语言草稿
-> 事实校验
-> 按审批策略发送：AI 不自主发送，命中低风险白名单项由确定性规则发出，其余等待审批
-> 保存发送内容和依据
```

## 9. AI 风险分级

| 等级 | 定义                         | 处理方式                      |
| ---- | ---------------------------- | ----------------------------- |
| L0   | 摘要、翻译、解释             | 可直接展示，标识 AI 生成      |
| L1   | 抽取、分类和映射建议         | Schema 校验，低置信度人工确认 |
| L2   | 异常判断、ETA 和处置建议     | 必须提供证据、范围或影响因子  |
| L3   | 修改数据、发送通知、触发同步 | 必须审批，由业务 API 执行     |
| L4   | 删除、付款、权限及合规决定   | 禁止 AI 自主执行              |

执行时的自动化模式（`assist` / `review` / `automatic` / `prohibited`）由风险分级推导，不允许独立配置，也不得突破上表处置要求：

- `assist`（展示建议）：对应 L0–L1，结果须标识 AI 生成，低置信度项转 `review`。
- `review`（人工确认）：对应 L2–L3；L2 必须提供证据、范围或影响因子，L3 必须审批并由业务 API 执行。
- `automatic`（自动执行）：仅允许满足全部条件的 L1 项——能力进入自动执行白名单、通过评测与规则校验阈值、可回滚且全程可审计；L2 及以上禁止 `automatic`。
- `prohibited`（禁止执行）：对应 L4，AI 不得以任何模式执行。

风险分级与自动化模式冲突时，以更严格者为准。

置信度不能仅采用模型自报数值，必须结合规则、历史评测、字段类型和证据完整度形成决策。

## 10. 数据与 RAG

### 10.1 存储边界

- PostgreSQL：业务事实、审批、审计、AI 元数据和流程引用。
- pgvector：带租户、权限、来源和版本信息的知识片段。
- Redis：缓存、限流和短期协调，不保存权威状态。
- MinIO/S3：原始文件、解析产物、导出和大型 AI 产物。
- Temporal：流程执行历史，不代替业务数据库。
- Langfuse：AI 调用观测，不代替合规审计。

### 10.2 RAG 管线

```text
文件安全检查
-> 原文件进入对象存储
-> 解析 / OCR
-> 分段及元数据标注
-> 继承租户与文档权限
-> Embedding
-> pgvector
-> 权限过滤检索
-> 可选 Reranker
-> 生成带引用的结构化结果
```

检索权限必须在服务端执行。删除或降权源文档时，其文本、向量和缓存必须同步失效。证据不足时系统必须返回无法判断，不得生成无来源的确定性结论。

### 10.3 AI 元数据

至少建立以下领域记录：

- `ai_capability`：能力版本、风险和启用策略。
- `ai_execution`：模型、Prompt、Token、延迟、费用和结果状态。
- `ai_artifact`：抽取、映射、解释或草稿产物。
- `ai_review`：批准、修改、拒绝和原因。
- `ai_feedback`：用户采纳结果和质量反馈。
- `tool_execution`：Tool 参数摘要、权限判定和执行结果。
- `prompt_version`：可发布的 Prompt 版本。
- `evaluation_run`：评测版本和指标。

敏感原始载荷不得无期限保存在普通日志或 AI 观测平台。

## 11. 前端业务集成

```text
apps/web/src/features/
|-- imports/                     # 映射建议和导入审核
|-- shipments/                   # 延误解释和 ETA
|-- exceptions/                  # 处置建议
|-- documents/                   # 抽取结果与原文定位
|-- notifications/               # 草稿审核
`-- workflows/                   # 进度、审批和失败恢复
```

AI 结果必须紧邻业务对象展示，并包含原始值、建议值、差异、证据、状态和最终执行结果。聊天组件只用于确有多轮探索价值的局部场景，不能成为所有 AI 能力的统一入口。

统一状态为：

```text
pending -> running -> awaiting_validation -> awaiting_review
        -> approved -> executing -> completed

任意阶段可以进入 failed、rejected、cancelled 或 expired。
```

TanStack Query 保存服务端数据；Pinia 不得复制完整服务端实体，只保存会话、权限和用户偏好。

## 12. 安全与合规边界

- 所有 AI 能力均继承业务对象和租户权限。
- Prompt 或外部文档中的指令不能改变系统权限。
- 外部文档始终作为不可信数据处理，防止提示注入。
- 写操作必须有幂等键；高风险写入必须有审批记录。
- 模型不可用时，核心业务继续运行或明确失败关闭。
- 日志不得记录密码、Token、Cookie、私钥或不必要的个人信息。
- 模型供应商的数据保留、训练使用和区域必须可配置、可审计。
- 跨供应商降级必须符合数据驻留规则，不能只依据价格或可用性切换。

## 13. 测试与 AI 评测

### 13.1 工程测试

- Vitest：Domain、Application、Vue 组件和 TypeScript Worker。
- pytest：AI 能力、解析器、检索和 Python Worker。
- Testcontainers：PostgreSQL、Redis 及集成边界。
- Playwright：导入审核、异常处置和通知审批等完整流程。
- 模拟 Provider：CI 默认不得依赖真实模型或产生外部费用。

### 13.2 AI 评测

| 能力     | 核心指标                             |
| -------- | ------------------------------------ |
| 字段抽取 | 逐字段准确率、召回率、关键字段漏提率 |
| 字段映射 | Top-1 准确率、人工修改率、错误写入率 |
| RAG      | 检索召回率、引用正确率、答案忠实度   |
| 分类     | 混淆矩阵、关键类别漏判率             |
| ETA      | MAE、分位误差、不同路线分层表现      |
| Tool     | 选择正确率、参数正确率、越权率       |
| 运营     | 延迟、失败率、单任务成本、人工驳回率 |

Prompt、模型、Tool、Embedding、切分器或检索策略变更必须运行对应回归评测。上线判定依据固定数据集和阈值，不得只依赖人工主观体验。

## 14. 可观测性

每个请求必须使用关联 ID 串联：

```text
浏览器操作
-> API Request
-> Temporal Workflow
-> Activity
-> AI Gateway
-> Model Provider
-> Tool Execution
-> Business Write
```

最小指标集包括：

- API 吞吐、延迟、错误率和依赖健康度。
- Workflow 启动、运行、等待、重试、失败和积压。
- AI 能力成功率、延迟、Token、费用及降级次数。
- 审核等待时间、采纳率、修改率和拒绝率。
- 导入成功率、对账差异及错误写入率。

生产告警必须指向处理手册，不能只描述技术指标。

## 15. 部署拓扑

本地和初期环境使用 Docker Compose：

```text
web
api
business-worker
ai-service
ai-worker
postgres
redis
minio
temporal
litellm
langfuse
otel-collector
prometheus
grafana
loki
tempo
```

生产使用容器化部署。达到独立扩缩容、多副本调度和高可用需求后再迁移 Kubernetes。初期不引入服务网格、Kafka 或独立向量数据库。

## 16. 延后引入的技术

| 技术                     | 当前决定   | 引入条件                                  |
| ------------------------ | ---------- | ----------------------------------------- |
| Kubernetes               | 延后       | 多服务高可用及独立扩缩容成为实际需求      |
| Kafka                    | 延后       | 出现高吞吐事件流、多消费者和长期回放需求  |
| 独立向量数据库           | 延后       | pgvector 无法满足规模、延迟或混合检索需求 |
| Elasticsearch/OpenSearch | 延后       | PostgreSQL 全文检索无法满足明确业务指标   |
| TimescaleDB              | 延后       | 事件规模和时间桶查询证明需要时序扩展      |
| LangGraph                | 按能力采用 | 单个 AI Activity 确需有限多步推理         |
| 自训练模型平台           | 延后       | 累积可靠标注数据并证明通用模型不足        |
| 微服务拆分               | 延后       | 存在团队、部署、故障或扩缩容隔离证据      |

## 17. 分阶段实施

### 阶段一：工程底座

- 建立 Workspace、Web、API、AI Service 和共享契约。
- 建立 PostgreSQL、Redis、MinIO 和统一身份边界。
- 接入 Temporal、OpenTelemetry 和本地 Compose。
- 建立无副作用的 `validate`、集成测试和 CI。

### 阶段二：首批业务闭环

- 智能 Excel 映射、预检、审核、导入和对账。
- 货柜异常解释、证据展示和处置建议。
- 多语言通知草稿、事实校验、审批和发送。
- 建立 AI Execution、Review、Feedback 和评测数据集。

### 阶段三：能力扩展

- 外部状态归一化和稳定规则沉淀。
- 物流文档抽取及权限感知 RAG。
- ETA 专用预测模型及 LLM 解释。
- 根据观测数据优化自动化阈值、模型路由和成本。

### 阶段四：按证据演进

- 根据容量和组织边界决定服务拆分。
- 根据检索指标决定是否迁移向量数据库。
- 根据事件吞吐决定是否引入 Kafka。
- 根据部署复杂度决定是否采用 Kubernetes。

## 18. 架构验收标准

底座完成必须满足：

- Web、API、Workflow 和 AI Activity 具有端到端关联追踪。
- AI Provider 可以替换，业务模块不引用供应商 SDK。
- AI 输出经过结构和业务双重校验。
- L3 操作不能绕过审批和后端授权。
- 模型不可用不会破坏已有业务事实。
- 导入流程可暂停、恢复、取消、重试和对账。
- CI 不调用真实付费模型，固定评测可重复运行。
- 所有数据库变更只通过统一迁移入口完成。
- Prompt、模型、Tool 和评测结果具有版本关联。
- 前端在具体业务流程中呈现 AI 能力，而非依赖统一聊天窗口。

## 19. 架构变更规则

以下变更必须新增 ADR：

- 替换数据库、工作流引擎、主后端或前端框架。
- 引入新的模型网关、Agent 框架或向量数据库。
- 允许 AI 执行新的 L3/L4 类型操作。
- 拆分微服务或引入 Kafka、Kubernetes。
- 改变数据驻留、模型供应商或敏感信息处理策略。

ADR 必须记录背景、决策、替代方案、风险、迁移方式和撤销条件。
