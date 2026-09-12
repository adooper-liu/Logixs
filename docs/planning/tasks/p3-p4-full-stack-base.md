---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: # git 初始化后填：feat/full-stack-base
verification: 本地验证（2026-09-12）：pnpm repo:check/contract:check/contract:drift/db:generate/lint/format:check/typecheck/test/build 全绿（3 TS 包 54 单测）；uv run pytest 2 项通过（ai-service）；端到端：GET /api/containers 返回 3 个真实货柜、GET /api/health database:up、Temporal echo 工作流经 business-worker/ai-worker/API 全链路返回正确结果。未验证项（环境/时机延后）：Redis/MinIO/LiteLLM/Langfuse/OTel 未部署（无消费者）、Python 契约生成与 OpenAPI client 延后（见偏离记录）。
---

# 任务：全栈底层基座（服务 + 数据库 + 前端）

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准；同一时刻仅一个进行中任务。各阶段只有达到对应证据门禁后才能升格。

## 目标

把 ADR 已冻结的 TS 后端、PostgreSQL/Prisma、Python AI 服务、Temporal、双 Worker、LiteLLM 搭成**可运行骨架**，并用一条「薄真实链路」证明「前端 → API → 数据库」端到端打通。以后只在基座上写业务、不再碰技术选型。

## 权威入口

- 计划文件：`.claude/plans/ancient-doodling-goose.md`（本任务执行基线）
- 工程纪律：[ENGINEERING_RULES.md](../../../ENGINEERING_RULES.md)、[AGENTS.md](../../../AGENTS.md)
- 架构选型：ADR-001~010（[索引](../../architecture/decisions/README.md)）
- 模块边界：ADR-010 + [MODULE_DEPENDENCIES.md](../../architecture/MODULE_DEPENDENCIES.md)
- 契约单一权威源：`packages/contracts/schemas/v1/index.json`（GC-001~011）
- 承接 G7：[global-contract-convergence-v1.md](./global-contract-convergence-v1.md) 的 G7（生成器与技术载体实现）

## 边界 / 不做

- 每个技术件只搭到「骨架 + 一条验证通路」，**不写真实业务逻辑**（货柜状态机、工单、费用、AI 映射、导入流程）。
- 不实现身份/OIDC（`identity` 只留骨架，认证属 P5）。
- 不做真实模型调用、真实 RAG、评测集（属 P7）。
- 不迁移 demo 的硬编码数据到真实后端；demo 原样保留作视觉参考。
- 不代签 P2 评审终勾（`p2-shipment-import-domain.md` 仍 `blocked`，解除条件为负责人完成 P2_REVIEW_CHECKLIST §4）。

## 验收

- [x] `pnpm install --frozen-lockfile` 与 `uv sync` 双锁确定性安装成功（TS + Python 均验证）。
- [~] `docker compose up` 一键起核心基础设施（postgres/temporal/temporal-ui）健康全绿；Redis/MinIO/LiteLLM/Langfuse/OTel 无消费者，按偏离记录延后。
- [x] `pnpm contract:drift` 通过：11 份 Schema → TS 类型无漂移；Python/OpenAPI 生成延后（偏离记录）。
- [x] `pnpm validate` 全绿（repo/lint/format/typecheck/test/E2E/build，3 TS 包）。
- [x] 薄真实链路：`GET /containers` → PostgreSQL 返回 3 个真实货柜（非 demo 硬编码）。
- [~] 旁路通路：Temporal echo 工作流经 business-worker/ai-worker/API 全链路返回正确；AI 服务 echo 不调模型（LiteLLM mock 延后）。

## 方案（design 阶段填写）

按计划文件七阶段推进：

1. **契约生成底座（G7/P3-13）**：`packages/contracts` 增加 TS 类型、OpenAPI、Python Pydantic 三端生成 + 漂移门禁。
2. **TS 后端底座**：NestJS 模块化单体（ADR-010 的 18 个空模块）+ PostgreSQL/Prisma 唯一迁移入口 + 横切面（env、异常、校验、日志、health）。
3. **前端真实链路**：从 OpenAPI 生成 `packages/api-client`，薄真实切片 `GET /containers` + 最小真实货柜列表页。
4. **Python AI 服务 + LiteLLM**：FastAPI 骨架 + Pydantic 模型 + echo 能力 + LiteLLM mock。
5. **Temporal + 双 Worker**：Temporal compose + business-worker(TS) + ai-worker(Python) echo 通路。
6. **基础设施 compose + CI**：docker-compose（Postgres/Redis/MinIO/Temporal/LiteLLM/Langfuse/OTel）+ 契约 parity/迁移验证纳入 validate。
7. **收口**：回填 PROJECT_BOOTSTRAP_CHECKLIST P3/P4，标记 G7 done。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先，每条对应文件/行号或 commit）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------ | ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-11 | design | —    | —      | 初稿；承接 global-contract-convergence-v1 的 G7，按七阶段推进                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-11 | coding | —    | —      | 阶段 1（契约生成底座·TS 侧）完成：新增 scripts/generate-contracts.mjs（jstt 打包 11 份 Schema → 去重 TS 类型），生成 packages/contracts/generated/contracts.d.ts（1489 行），@logix/contracts 增加 types/exports 与 contract:generate/contract:drift，漂移门禁纳入 validate；contract:check + contract:drift 均通过。Python Pydantic 生成按「数据库字段优先」延后至 AI 服务阶段。                                                                                                                                                                                                                                                  |
| 2026-09-12 | coding | —    | —      | 阶段 2（数据库字段优先）起步：新增 database/schema.prisma（container_record 主记录 + ContainerStatus enum(8)，字段依据 DATA_MODEL_P2-06/状态模型，迟绑定与物理形态待评审项显式 TODO）、prisma.config.ts（Prisma 7 配置 + 迁移路径 database/migrations）、.env.example；prisma/@prisma/client 固定 7.10.0；schema 校验通过，离线 migrate diff 生成初始 DDL 正确。global-contract-convergence-v1 标记 done（G7 移交本任务）。                                                                                                                                                                                                        |
| 2026-09-12 | coding | —    | —      | 阶段 2 主体：新增 apps/api（NestJS 11 模块化单体，CommonJS），18 个限界上下文模块（ADR-010 空骨架）+ PrismaModule/HealthController；shipment-registry 薄真实切片按 Port/Adapter 分层（Controller→UseCase→Port←Prisma 适配器）；新增 docker-compose.yml（PostgreSQL/pgvector）、database/migrations/20260912000000_init（首个迁移 SQL + lock）、database/seed.ts（幂等 seed）、db:generate/db:migrate/db:seed 脚本并接入 validate。全门禁绿：repo/lint/format/typecheck/test/build；API 冒烟测试通过（18 模块加载、无 DB 时配置清晰报错）。未验证：live 迁移/种子/GET /containers 端到端（本机 Docker Hub 不可达，无 PostgreSQL）。 |
| 2026-09-12 | coding | —    | —      | 端到端验证通过：定位并绕过本机端口冲突（旧系统 WSL Ubuntu-24.04 原生 PostgreSQL 占 5432，本项目改用 5433；Docker 镜像经 DaoCloud 源拉取 postgres:16）。`db:migrate` 应用首个迁移、`db:seed` 写入 3 行、API 启动后 `GET /api/health` 返回 database:up、`GET /api/containers` 返回 3 个真实货柜（含 containerNumber=null 迟绑定样本）。「前端 → API → 数据库」读链路已通；前端列表页尚未接（阶段 3）。                                                                                                                                                                                                                               |
| 2026-09-12 | coding | —    | —      | 阶段 3（前端接线）完成：web 增加 Vite 代理 `/api`→localhost:3000、`@logix/contracts` 依赖、`src/api/containers.ts`（复用契约 ContainerLifecycleState 类型）、`RealContainerList.vue`（加载/错误/空态 + 状态中文映射）与路由 `/real-containers`（demo 视图原样保留）。验证：web typecheck/lint/format/test/build 全绿；直连 3000 与经 Vite 5173 代理均返回 3 个真实货柜。                                                                                                                                                                                                                                                           |
| 2026-09-12 | coding | —    | —      | 阶段 4（Python AI 服务骨架）完成：新增 apps/ai-service（FastAPI + uv + pyproject.toml），能力注册表 + `GET /health` + `GET /capabilities` + `POST /capabilities/echo`（不调模型）；pytest 2 项通过；apps/api 的 ai-governance 模块增加治理端口占位（AiGovernancePort：授权/预算/审计，不实现）。端口 8001（本机 8000 被旧系统占用）。LiteLLM compose 与 Pydantic 契约生成延后至阶段 6/收口。                                                                                                                                                                                                                                       |
| 2026-09-12 | coding | —    | —      | 阶段 5（Temporal + 双 Worker）完成：docker-compose 增 temporal（auto-setup + postgres12 驱动 + 独立 temporal-db）与 temporal-ui；workers/business-worker（TS，echo 工作流 + 确定性 Activity，经 DaoCloud 拉镜像、补 @swc/core/protobufjs 构建脚本白名单）；workers/ai-worker（Python，echo 工作流 + 调 ai-service 的 Activity，工作流与 Activity 分离以过沙箱）；apps/api 的 workflow 模块（@temporalio/client，POST /workflows/echo + GET /workflows/:id）。端到端验证通过：business-worker echo 返回 echo:…；ai-worker echo 经 ai-service 返回；API→Temporal→worker 全链路 POST/GET 均返回正确结果。                             |
| 2026-09-12 | done   | —    | —      | 阶段 6/7 收口：docker-compose 已含 postgres/temporal/temporal-ui（核心基础设施）；Redis/MinIO/LiteLLM/Langfuse/OTel 因无消费者按「延后启用」记录（ADR 保留，P5/P6/P8 再启）；repo:check 增加 .venv/**pycache** 忽略。任务标记 done。偏离记录：①LiteLLM 与 Temporal 实际部署延后至 P6（用户确认 ADR 保留但时机后移）；②API 用 CommonJS（NestJS 稳路径，非 ADR 明确项）；③业务 Postgres 用 5433、Temporal 用 7233、AI 服务用 8001（避本机旧系统占用 8000/5432）；④Python 契约生成（datamodel-code-generator）与 OpenAPI client 延后，当前 TS 契约生成已闭环。                                                                        |
