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

环境基线为 Node 22 LTS、pnpm 10。所有命令从仓库根目录执行，TypeScript 工具链只保留根 `pnpm-lock.yaml`：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm test:e2e
pnpm validate
pnpm security:audit
```

`validate` 会执行仓库规则检查、ESLint、Prettier、类型检查、工具与应用测试、桌面/移动 E2E 和生产构建。`repo:check` 额外阻止依赖目录、构建产物、竞争锁文件、日志和真实环境文件进入 Git，并校验任务 brief、`done` 验证证据与 Markdown 相对链接。`security:audit` 使用 npm 官方审计端点检查生产依赖，CI 会在完整门禁后单独执行。
