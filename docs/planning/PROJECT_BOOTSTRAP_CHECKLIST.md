# 项目启动与交付清单

## 1. 使用方式

本清单是项目从设计进入可持续交付的执行主线。按阶段顺序推进，阶段门禁未通过时，不进入依赖它的后续阶段。

状态约定：

- `[ ]` 未开始
- `[x]` 已完成并通过验收
- `[!]` 受阻，必须记录原因、责任人和解除条件
- `[-]` 经 ADR 确认不适用

每项任务完成时必须附上对应文档、代码、测试或运行记录的链接。不得只修改复选框。

实现类任务（阶段内具体改造，而非清单项本身）以 `docs/planning/tasks/<任务名>.md` 任务 brief 作为交接与进度载体：状态用文件顶部 YAML frontmatter（`design | coding | review | fix | blocked | done`，机器可校验），同一时刻只允许一个进行中任务；无测试/构建等验证证据不得标 `done`。模板见 `docs/planning/tasks/_template.md`，状态校验脚本随 P3-10 建立。

## 2. 当前基线

已完成：

- [x] B-01 建立编码代理和开发执行规则：`AGENTS.md`。
- [x] B-02 建立工程规则与纪律：`ENGINEERING_RULES.md`。
- [x] B-03 确认 AI 工作流型目标架构和技术选型。
- [x] B-04 建立项目及技术文档导航。
- [x] P0 项目定义与成功标准：产品简报/词汇/导入工作流/NFR 初版基线已确认（2026-09-04），见 [P0 清单 §4](#4-p0-项目定义与成功标准) 产物与 [PRODUCT_BRIEF](../product/PRODUCT_BRIEF.md)。
- [x] P1 决策冻结：ADR-001 至 ADR-010 已接受（ADR-010 补充 P1-09 限界上下文）+ P1-09 模块依赖图，见 [ADR 索引](../architecture/decisions/README.md) 与 [MODULE_DEPENDENCIES](../architecture/MODULE_DEPENDENCIES.md)。
- [x] P0-09 四类负责人已指定：刘志高（见 [RAID §1](./RAID.md)）。

尚未完成：P2 数据模型 → P3 底座 → P4 基础设施 → P5 安全 → P6 首个纵向闭环 → P7 评测门禁 → P8 可观测性 → P9 生产就绪。

## 3. 总体推进顺序

```text
P0 项目定义
-> P1 架构决策
-> P2 领域与数据设计
-> P3 工程环境
-> P4 基础设施
-> P5 安全与治理
-> P6 纵向业务切片
-> P7 AI 评测与发布门禁
-> P8 可观测性与运维
-> P9 生产就绪
```

P0 至 P3 是开始规模开发前的必要工作。P6 完成之前，不并行铺开大量业务模块。

## 4. P0 项目定义与成功标准

目标：确定要解决的问题、首个闭环和可量化结果，避免技术底座脱离业务。

- [x] P0-01 定义产品愿景、目标用户、核心问题和明确不做事项 —— [PRODUCT_BRIEF §1–§4](../product/PRODUCT_BRIEF.md)。
- [x] P0-02 绘制当前流程与目标流程，标出人员、系统、等待点和错误点 —— [IMPORT_WORKFLOW §2](../product/workflows/IMPORT_WORKFLOW.md)（真实现状占位，RAID I-02 跟踪）。
- [x] P0-03 选择首个纵向闭环：智能 Excel 导入与审核 —— [PRODUCT_BRIEF §5](../product/PRODUCT_BRIEF.md)。
- [x] P0-04 定义首个闭环的输入、输出、异常路径和人工审批点 —— [IMPORT_WORKFLOW §3–§5](../product/workflows/IMPORT_WORKFLOW.md)。
- [x] P0-05 建立统一业务词汇表：订单、货柜、批次、状态、异常、审核、来源 —— [GLOSSARY](../product/GLOSSARY.md)。
- [x] P0-06 定义功能验收标准和关键示例 —— [IMPORT_WORKFLOW §6](../product/workflows/IMPORT_WORKFLOW.md)。
- [x] P0-07 定义非功能指标：可用性、延迟、吞吐、恢复时间和数据保留期 —— [NFR §1–§3/§5](../product/NON_FUNCTIONAL_REQUIREMENTS.md)。
- [x] P0-08 定义 AI 指标：映射准确率、人工修改率、错误写入率、延迟和单任务成本 —— [NFR §4](../product/NON_FUNCTIONAL_REQUIREMENTS.md)。
- [x] P0-09 确认利益相关方、产品负责人、技术负责人、数据负责人和安全负责人 —— [RAID §1](./RAID.md)，负责人：刘志高。
- [x] P0-10 建立风险、假设、问题和依赖清单（RAID） —— [RAID](./RAID.md)。

阶段产物：

- `docs/product/PRODUCT_BRIEF.md`
- `docs/product/GLOSSARY.md`
- `docs/product/workflows/IMPORT_WORKFLOW.md`
- `docs/product/NON_FUNCTIONAL_REQUIREMENTS.md`
- `docs/planning/RAID.md`

门禁：团队可以用相同语言描述首个业务闭环，并能用数字判断它是否成功。

## 5. P1 架构决策冻结

目标：将关键技术选择转化为可追溯决策，减少实施期反复。

- [x] P1-01 ADR：采用模块化单体作为业务 API 架构 —— [ADR-001](../architecture/decisions/ADR-001-modular-monolith.md)。
- [x] P1-02 ADR：采用 pnpm Workspace、Turborepo 和 uv —— [ADR-002](../architecture/decisions/ADR-002-pnpm-turborepo-uv.md)。
- [x] P1-03 ADR：采用 PostgreSQL、Prisma 和唯一迁移入口 —— [ADR-003](../architecture/decisions/ADR-003-postgresql-prisma.md)。
- [x] P1-04 ADR：采用 Temporal 编排持久化业务工作流 —— [ADR-004](../architecture/decisions/ADR-004-temporal.md)。
- [x] P1-05 ADR：采用独立 Python AI Service 和双 Worker 模型 —— [ADR-005](../architecture/decisions/ADR-005-python-ai-service-workers.md)。
- [x] P1-06 ADR：采用业务 AI Gateway 与 LiteLLM Provider Gateway 分层 —— [ADR-006](../architecture/decisions/ADR-006-ai-gateway-litellm.md)。
- [x] P1-07 ADR：初期使用 pgvector，记录迁移到独立向量库的阈值 —— [ADR-007](../architecture/decisions/ADR-007-pgvector.md)。
- [x] P1-08 ADR：采用 OIDC/OAuth 2.1，并决定身份提供方部署方式 —— [ADR-008](../architecture/decisions/ADR-008-oidc-oauth.md)。
- [x] P1-09 定义模块依赖图、公共入口和禁止依赖 —— [MODULE_DEPENDENCIES](../architecture/MODULE_DEPENDENCIES.md)（权威约束见 ENGINEERING_RULES §3/架构 §6.2；DEPCHECK/lint 强制随 P3-05）。
- [x] P1-10 定义 API、事件、Workflow、Activity 和 Tool 的版本策略 —— [ADR-009](../architecture/decisions/ADR-009-versioning-strategy.md)。

阶段产物：`docs/architecture/decisions/ADR-*.md` 和模块依赖图。

门禁：所有影响底座的选择都有决策、替代方案、风险和撤销条件。

## 6. P2 领域、数据与 AI 契约

目标：在写控制器和页面前建立稳定的业务语义和数据边界。

当前已有多份候选文档及部分公共 JSON Schema，但 P2-01 至 P2-09 的负责人评审、OpenAPI、数据库与运行时验收尚未完成；以下未勾选是门禁状态，不表示没有草案。

- [ ] P2-01 建立物流领域上下文和聚合边界。
- [ ] P2-02 定义货柜状态事件模型及合法状态转换。
- [ ] P2-03 定义导入批次、导入行、预检和审核模型。
- [ ] P2-04 定义主数据治理：港口、船司、仓库及未知值处理。
- [ ] P2-05 定义租户、用户、角色、权限和数据范围模型。
- [ ] P2-06 设计 PostgreSQL 逻辑模型、约束、索引和数据生命周期。
- [ ] P2-07 定义审计模型及需要记录前后值的操作。
- [ ] P2-08 定义首个 API OpenAPI 契约和稳定错误码。
- [ ] P2-09 定义首个 Temporal Workflow、Activity、Signal 和 Query 契约。
- [ ] P2-10 定义 `suggest_import_mapping` 的输入输出 JSON Schema。
- [ ] P2-11 定义 AI 风险等级、审批规则和自动执行阈值。
- [ ] P2-12 准备脱敏的黄金样本、异常样本和对抗样本。

阶段产物：

- `docs/product/domain/`
- `docs/architecture/data-model/`
- `packages/contracts/`
- `packages/ai-contracts/`
- `evals/datasets/`

门禁：业务事实、AI 建议、审核结果和最终执行结果可以被明确区分并追踪。

## 7. P3 工程环境与仓库底座

目标：让所有开发者和 CI 使用相同、可重复的工具链。

- [ ] P3-01 配置主分支保护和 CODEOWNERS（Git、main 与 origin 已存在）。
- [ ] P3-02 固定 Node.js、pnpm、Python 和 uv 版本。
- [x] P3-03 初始化 pnpm Workspace 和 Turborepo。
- [x] P3-04 创建 `apps/web`、`apps/api`、`apps/ai-service` 和 Workers —— [apps/api](../../apps/api)、[apps/ai-service](../../apps/ai-service)、[workers](../../workers)（business-worker + ai-worker）。
- [~] P3-05 创建 contracts、domain、config、testing 等共享包 —— `@logix/contracts` 已建；domain/config/testing 未建（业务领域落库后再抽）。依赖方向门禁已由 `pnpm repo:check` 强制，见 [MODULE_DEPENDENCIES §4](../architecture/MODULE_DEPENDENCIES.md) 与 [任务 brief](./tasks/p3-architecture-dependency-gates.md)。
- [x] P3-06 建立 EditorConfig、格式化、Lint 和严格类型检查。
- [x] P3-07 建立无副作用的 `lint`、`format:check` 和 `validate`。
- [ ] P3-08 配置 pre-commit 轻量检查，不重复执行完整 CI。
- [x] P3-09 建立环境变量 Schema、`.env.example` 和启动时校验 —— [config/env.ts](../../apps/api/src/config/env.ts)、[.env.example](../../.env.example)。
- [ ] P3-10 建立 Conventional Commits、PR 模板、ADR 模板和任务 brief 模板（`docs/planning/tasks/_template.md`），并提供任务状态校验（同一时刻单进行中、`done` 需验证证据）。
- [ ] P3-11 配置依赖更新、许可证检查、秘密扫描和漏洞扫描。
- [x] P3-12 创建最小 CI：安装、格式、Lint、类型、测试和构建。
- [~] P3-13 建立 Contract Parity 一致性测试：TS 契约 ↔ Python Schema ↔ JSON Schema/OpenAPI ↔ 评测数据集由单一权威源生成或派生，CI 对比防漂移，注册项缺失即失败（见 ENGINEERING_RULES §7）。 —— TS 侧已闭环（`contract:generate`/`contract:drift` 纳入 validate）；Python/OpenAPI 生成延后（见 p3-p4-full-stack-base 偏离记录）。
- [ ] P3-14 建立编码代理 SKILL 集（位置 `.claude/skills/<name>/SKILL.md`）：
  - `logix-rules`：开工前加载 AGENTS / ENGINEERING_RULES / 架构文档 / 任务 brief，规范“先理解再改、保持范围、小步验证、改契约必同步文档”。
  - `review-ts`：TS 侧评审清单——NestJS DI/Prisma/事务、Temporal Workflow 确定性（模型/IO/网络全部进 Activity）、金额/UTC/币种规则。
  - `review-python`：Python 侧评审清单——FastAPI/Pydantic/结构化输出校验、解析与检索、AI 治理（L0–L4、最小输入）。
  - `contract-parity`：契约改动流程提醒——单一权威源生成/派生 → 跑一致性测试 → 更新 OpenAPI 与评测集。

阶段产物：可克隆、可安装、可验证的空业务底座。

门禁：全新环境可以依据 README 一次性启动，`validate` 在本地和 CI 结果一致。

## 8. P4 本地基础设施与数据生命周期

目标：提供可运行、可诊断且接近生产语义的开发环境。

- [~] P4-01 建立 PostgreSQL、Redis、MinIO 和 Temporal Compose。 —— PostgreSQL + Temporal(+temporal-db/ui) 已起；Redis/MinIO 无消费者延后（[docker-compose.yml](../../docker-compose.yml)）。
- [ ] P4-02 增加 LiteLLM、Langfuse 和 OpenTelemetry Collector Profile。 —— 按「延后启用」记录（ADR 保留，P5/P6/P8 再启）。
- [x] P4-03 建立容器健康检查、依赖等待和初始化流程。
- [x] P4-04 创建第一条 Prisma 迁移和幂等 Seed —— [database/migrations](../../database/migrations)、[database/seed.ts](../../database/seed.ts)。
- [ ] P4-05 使用 Testcontainers 建立数据库及集成测试基类。
- [ ] P4-06 定义对象存储 Bucket、路径、权限和保留策略。
- [ ] P4-07 定义备份、恢复、本地重置和测试数据生成命令。
- [~] P4-08 验证空库升级和已有版本升级路径。 —— 空库升级已验（migrate 应用成功）；已有版本升级延后。
- [ ] P4-09 为开发环境提供模型 Mock，默认不调用付费模型。
- [ ] P4-10 建立模型凭据、对象存储凭据和数据库凭据的秘密管理方式。

门禁：基础设施可以一条命令启动、健康检查、重置，并通过集成测试。

## 9. P5 安全、权限与 AI 治理

目标：在业务和 AI 写操作出现前建立不可绕过的控制面。

- [ ] P5-01 完成威胁建模：租户隔离、文件上传、提示注入和 Tool 越权。
- [ ] P5-02 接入 OIDC，建立认证、RBAC/ABAC 和对象级授权。
- [ ] P5-03 定义服务身份、Worker 身份和最小数据库权限。
- [ ] P5-04 建立文件类型、大小、病毒检查和隔离解析策略。
- [ ] P5-05 建立 AI 能力注册、模型白名单、预算、超时和限流。
- [ ] P5-06 建立 Prompt、Tool、模型和 Schema 的版本发布流程。
- [ ] P5-07 建立敏感数据分类、脱敏、保留和删除策略。
- [ ] P5-08 建立 L3 审批令牌，禁止 AI 直接执行 L4 操作。
- [ ] P5-09 建立审计日志及防篡改、访问和保留规则。
- [ ] P5-10 编写提示注入、跨租户访问和敏感信息泄漏测试。

门禁：任何模型和 Tool 都不能绕过服务端权限、审批及业务规则。

## 10. P6 首个纵向业务切片

目标：端到端完成“智能 Excel 导入”，验证整个技术架构。

- [ ] P6-01 Web 上传文件并创建导入批次。
- [ ] P6-02 API 校验权限、文件信息和幂等键。
- [ ] P6-03 Temporal 启动 Import Workflow 并持久化流程引用。
- [ ] P6-04 Worker 执行安全解析和确定性列分析。
- [ ] P6-05 AI Activity 生成结构化字段映射建议。
- [ ] P6-06 后端执行 Schema、字典和业务规则校验。
- [ ] P6-07 Web 展示样本、建议、证据、差异和低置信度项。
- [ ] P6-08 用户逐项或批量审核，Signal 恢复 Workflow。
- [ ] P6-09 生成预检报告，未通过时禁止写入业务表。
- [ ] P6-10 事务导入并记录来源、批次和逐行结果。
- [ ] P6-11 自动对账并展示成功、跳过和失败结果。
- [ ] P6-12 支持取消、超时、重试、重复提交和失败恢复。
- [ ] P6-13 打通浏览器到模型与数据库写入的关联 Trace。
- [ ] P6-14 完成单元、集成、Workflow 和 Playwright 测试。

门禁：真实脱敏样本可重复完成导入；AI 不可用时能够人工映射或明确失败，不产生错误写入。

## 11. P7 AI 评测与发布门禁

目标：用可复现指标决定 AI 能力是否可以上线或自动化。

- [ ] P7-01 固定训练禁止使用、评测允许使用的数据边界。
- [ ] P7-02 建立映射准确率、关键字段漏判率和人工修改率评分器。
- [ ] P7-03 建立提示注入、错误 Schema、幻觉字典值和越权 Tool 测试集。
- [ ] P7-04 建立模型 Mock、录制响应和少量真实模型评测分层。
- [ ] P7-05 建立质量、延迟、费用和安全发布阈值。
- [ ] P7-06 在 CI 中运行离线快速评测，在发布流程运行完整评测。
- [ ] P7-07 建立 Prompt/模型变更对比报告和回滚机制。
- [ ] P7-08 建立线上采纳、修改、拒绝和错误反馈闭环。
- [ ] P7-09 定义从人工审核升级为自动执行所需的证据周期。

门禁：未达到质量或安全阈值的能力只能保持建议模式，不得自动执行。

## 12. P8 可观测性与运行手册

目标：系统上线前具备发现、定位和恢复问题的能力。

- [ ] P8-01 统一 Trace ID、业务关联 ID、Workflow ID 和 AI Execution ID。
- [ ] P8-02 建立 API、Workflow、AI、数据库和导入指标。
- [ ] P8-03 配置结构化日志、脱敏和采样策略。
- [ ] P8-04 建立 Grafana 基础仪表板和 SLO 看板。
- [ ] P8-05 建立错误率、积压、成本、审批超时和对账差异告警。
- [ ] P8-06 为每条生产告警编写 Runbook。
- [ ] P8-07 演练模型故障、供应商降级、Worker 崩溃和数据库恢复。
- [ ] P8-08 建立容量基线和负载测试结果。

门禁：关键故障能够被主动发现，并有经过演练的恢复步骤。

## 13. P9 生产就绪

- [ ] P9-01 完成数据保护影响评估和供应商数据处理审查。
- [ ] P9-02 完成安全评审、依赖审计和渗透测试。
- [ ] P9-03 验证生产迁移、备份恢复和回滚。
- [ ] P9-04 建立不可变制品、环境晋级和发布审批。
- [ ] P9-05 完成性能、容量、成本预算和限额配置。
- [ ] P9-06 确认 SLO、值班、告警负责人和事故流程。
- [ ] P9-07 完成用户培训、业务操作手册和支持流程。
- [ ] P9-08 使用受控用户和数据执行灰度发布。
- [ ] P9-09 根据灰度指标决定扩大、暂停或回滚。
- [ ] P9-10 完成发布后复盘并更新后续路线。

门禁：安全、数据、质量、运维和业务负责人共同签署上线结论。

## 14. 横向持续任务

以下事项从开始实施后持续执行，不属于一次性任务：

- [ ] C-01 每个公共行为变更同步更新契约和测试。
- [ ] C-02 每个架构例外记录 ADR、负责人和终止日期。
- [ ] C-03 每次迭代审查依赖、秘密、漏洞和许可证。
- [ ] C-04 每月审查 AI 质量、费用、延迟和人工驳回率。
- [ ] C-05 每季度执行恢复演练、权限审查和数据保留清理。
- [ ] C-06 持续将稳定 AI 判断沉淀为确定性规则。
- [ ] C-07 持续删除失效 Prompt、死代码、无主开关和过期文档。

## 15. 建议立即推进

**P0/P1 已完成（2026-09-04）。** 下一项是 **P2 领域与数据设计**：在写控制器/页面与迁移前定稿业务语义、数据边界与首个契约。

P2 期间并行跟踪（不阻塞）：

1. 真实现状导入流程与错误点现场观察（[RAID](./RAID.md) I-02，负责人：刘志高）。
2. 首批目标对象/字段模板集合在 P2 内定稿（IMPORT_WORKFLOW §8）。
3. 黄金样本与主数据采集（P2-12 / P7）。
