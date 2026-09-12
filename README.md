# Logix

Logix 是一个以物流业务工作流为核心、将 AI 能力嵌入具体业务步骤的工程项目。

当前仓库采用 pnpm Workspace + Turborepo 管理应用和统一质量门禁。实施前请先阅读：

- [编码代理与开发约束](./AGENTS.md)
- [工程规则与纪律](./ENGINEERING_RULES.md)
- [技术文档目录](./docs/README.md)
- [AI 工作流技术架构](./docs/architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md)

项目代码、脚本和基础设施必须遵守上述规则。架构变更应通过 ADR 记录，不能仅在代码或会议中形成隐含决定。

- **文档唯一入口索引**：[docs/INDEX.md](./docs/INDEX.md)。

## 开发入口

环境基线为 Node 22 LTS、pnpm 10、Python 3.11+、uv。所有命令从仓库根目录执行，TS 工具链只保留根 `pnpm-lock.yaml`，Python 工具链用各包 `uv.lock`：

```bash
# 1) TS 依赖（pnpm Workspace + Turborepo）
corepack enable
pnpm install --frozen-lockfile

# 2) 基础设施（业务库 postgres:5433 + Temporal:7233 + UI:8233；镜像经 DaoCloud 可拉）
pnpm infra:up

# 3) 数据库：生成 client + 迁移 + 幂等 seed（一条命令）
pnpm db:setup

# 4) Python 依赖（AI 服务 + AI Worker）
cd apps/ai-service && uv sync && cd ../..
cd workers/ai-worker && uv sync && cd ../..

# 5) 开发运行
pnpm dev                                   # 同时起前端(5173) + API(3000)
pnpm dev:worker                            # 业务 Worker（Temporal，可选）
cd apps/ai-service && uv run uvicorn app.main:app --port 8001   # AI 服务（可选）
cd workers/ai-worker && uv run python worker.py                 # AI Worker（可选）

# 或一键全起（含基础设施 + 数据库 + 全部 5 个服务；依赖已装好时直接这一步即可）
pnpm dev:all
```

> 最小验证只需 1→2→3→`pnpm dev`，即可看到「前端 → API → 数据库」真实链路（`/real-containers` 页）；`pnpm dev:all` 则把基础设施、数据库初始化与 5 个服务（前端/API/业务 Worker/AI 服务/AI Worker）一条命令全部拉起，适合一键起完整环境。

质量门禁：

```bash
pnpm validate          # repo/contract/db/lint/format/typecheck/test/e2e/build（TS 侧）
pnpm contract:drift    # 契约 TS 类型与 JSON Schema 权威源无漂移
pnpm security:audit
```

`validate` 会执行仓库规则检查、契约校验与漂移检查、Prisma 生成、ESLint、Prettier、类型检查、工具与应用测试、桌面/移动 E2E 和生产构建。`repo:check` 额外阻止依赖目录、构建产物、竞争锁文件、日志和真实环境文件进入 Git，并校验任务 brief、`done` 验证证据与 Markdown 相对链接。

> 端口说明：业务 PostgreSQL 用 **5433**（本机旧系统占 5432）、Temporal gRPC **7233**、Temporal UI **8233**、AI 服务 **8001**（旧系统占 8000）。详见 [docker-compose.yml](./docker-compose.yml) 与 `docs/planning/tasks/p3-p4-full-stack-base.md`。
