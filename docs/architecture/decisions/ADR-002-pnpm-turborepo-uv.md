---
status: accepted
date: 2026-09-04
decider: 刘志高
---

# ADR-002：pnpm Workspace + Turborepo + uv

> 状态：`accepted` · 日期：2026-09-04 · 决定人：刘志高（2026-09-04 接受）

## 背景

仓库是多语言（TypeScript 多包 + Python）Monorepo。需要确定性的依赖安装、任务编排与缓存，且两套语言生态要由同一仓库统一管理、只保留根锁文件。

## 决策

- TypeScript 侧：**pnpm Workspace**（只保留根 `pnpm-lock.yaml`）管理 `apps/` 与 `packages/` 的依赖；**Turborepo** 做任务编排与缓存（`lint/typecheck/test/build` 共享缓存）。
- Python 侧：各 Python 项目使用 `pyproject.toml`，由根级工作区与 **uv**（`uv.lock`）统一管理；`apps/ai-service`、`workers/ai-worker`、`evals` 属 Python。
- 两条工具链并行存在，互不依赖；跨语言共享面只走契约（JSON Schema / OpenAPI）而非共享运行时代码。

## 后果

- 正面：确定性安装、增量缓存、跨包编排清晰；uv 大幅降低 Python 环境成本。
- 代价：双锁文件（pnpm + uv）与双任务入口，CI 需分别安装；工具链版本需冻结（P3-02）。
- 连锁：影响 P3-03（初始化 Workspace）与 P3-04/05 脚手架；标准命令契约（AGENTS §8）最终映射到根脚本。

## 备选方案

| 方案 | 取舍 | 为何未选 |
| --- | --- | --- |
| npm workspaces | 生态原生 | pnpm 在严格性与磁盘/安装确定性上更优 |
| Yarn Berry | PnP 高效 | 与 Turborepo/CI 集成成本更高，团队不熟悉 |
| 仅用单包（非 Monorepo） | 简单 | 无法共享契约/domain，多语言联动困难 |
| Conda/Pipenv 管 Python | 成熟 | 锁文件与确定性不如 uv，环境速度差 |

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 双锁文件漂移导致 CI 与本地不一致 | `validate` 与 CI 同时以锁文件确定性安装；P3 建立无副作用门禁 |
| 工具链升级波及全局 | 版本冻结并纳入依赖更新节奏（P3-11） |

## 迁移与撤销条件

若锁文件漂移频繁、或某工具链生态明显占优可评估收敛为单一包管理器——仅当仓库只保留单一语言/生态时才可能；当前双栈事实使该撤销不现实，作为长期观察项。
