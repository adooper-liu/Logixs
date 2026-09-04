# 技术文档

## 架构

- [AI 工作流技术架构](./architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md)：系统边界、技术选型、模块划分、AI 治理和实施路线。
- [模块依赖图](./architecture/MODULE_DEPENDENCIES.md)：顶层依赖方向、公共入口与禁止依赖（P1-09）。
- [ADR 索引](./architecture/decisions/README.md)：架构决策记录（状态：proposed/accepted/superseded）。

## 规划

- [项目启动与交付清单](./planning/PROJECT_BOOTSTRAP_CHECKLIST.md)：按阶段推进的任务、产物、负责人和质量门禁。
- [RAID 风险/假设/问题/依赖](./planning/RAID.md)：开放风险、待决策问题与负责人。
- [任务 brief 模板](./planning/tasks/_template.md)：实现类任务的交接载体与状态机（frontmatter `status` 机器可校验；使用约定见 `PROJECT_BOOTSTRAP_CHECKLIST` §1 与 `ENGINEERING_RULES` §10）。

## 产品

> P0 产物已确认采用为**初版基线**（2026-09-04），P7/P8 校准前有效；真实输入项（现场观察、黄金样本）按 [RAID](./planning/RAID.md) 占位跟踪。四类负责人已指定为刘志高。`operations/`、`product/` 其余目录按文档纪律随需补全。

- [产品简报](./product/PRODUCT_BRIEF.md)：愿景、目标用户、核心问题、明确不做与首个闭环成功标准。
- [统一业务词汇表](./product/GLOSSARY.md)：术语单一真相与负责人。
- [智能导入工作流](./product/workflows/IMPORT_WORKFLOW.md)：首个纵向闭环的定义、异常与审批点。
- [非功能需求与指标](./product/NON_FUNCTIONAL_REQUIREMENTS.md)：可用性/延迟/容量与 AI 指标基线（候选）。

## 文档约定

- `architecture/`：当前有效的系统架构和跨模块设计。
- `architecture/decisions/`：架构决策记录（ADR）。
- `planning/`：实施计划、检查清单和阶段验收记录。
- `operations/`：部署、监控、备份、恢复和故障处理手册。
- `product/`：业务术语、流程和统计口径。

文档必须描述当前事实。候选方案、临时调查和已经失效的设计不得混入当前架构文档。

## 文档消费链（谁读、何时读、怎么用）

| 文档 | 谁读 | 何时读 |
| --- | --- | --- |
| [../README.md](../README.md) | 新成员、执行者 | 找当前有效入口、启动与验证方式 |
| [../AGENTS.md](../AGENTS.md)、[../ENGINEERING_RULES.md](../ENGINEERING_RULES.md) | 所有人工开发与编码代理 | 每次开工前；作为纪律裁决依据 |
| 本文档 `docs/README.md` | 文档使用者与维护者 | 导航、核对文档消费链 |
| [架构文档](./architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md) | 架构、跨模块与 AI 变更实施者 | 架构评审、跨模块/AI/数据变更前 |
| [启动清单](./planning/PROJECT_BOOTSTRAP_CHECKLIST.md) | 实施推进者、阶段负责人 | 阶段推进、验收与门禁 |
| [任务 brief](./planning/tasks/_template.md) | 任务执行者与评审者 | 交接、开工、评审、收尾 |
| [产品简报](./product/PRODUCT_BRIEF.md) 等 P0 产品文档 | 产品/业务/数据负责人 | P0 评审与口径、阈值决策（候选稿） |
| [RAID](./planning/RAID.md) | 阶段负责人与责任人 | 每阶段门禁评审与问题升级 |

> 维护纪律见 `ENGINEERING_RULES` §12：无消费者不建、分层管理、过期即清、单一真相不复制。新增 `operations/`、`product/` 等目录时，由创建者在本表补一行。
