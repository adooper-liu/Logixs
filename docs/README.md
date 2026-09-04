# 技术文档

## 架构

- [AI 工作流技术架构](./architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md)：系统边界、技术选型、模块划分、AI 治理和实施路线。
- [模块依赖图](./architecture/MODULE_DEPENDENCIES.md)：顶层依赖方向、公共入口与禁止依赖（P1-09）。
- [ADR 索引](./architecture/decisions/README.md)：架构决策记录（状态：proposed/accepted/superseded）。

## 规划

- [项目启动与交付清单](./planning/PROJECT_BOOTSTRAP_CHECKLIST.md)：按阶段推进的任务、产物、负责人和质量门禁。
- [RAID 风险/假设/问题/依赖](./planning/RAID.md)：开放风险、待决策问题与负责人。
- [任务 brief 模板](./planning/tasks/_template.md)：实现类任务的交接载体与状态机（frontmatter `status` 机器可校验；使用约定见 `PROJECT_BOOTSTRAP_CHECKLIST` §1 与 `ENGINEERING_RULES` §10）。
- [P2 切片一 · 一页总览摘要（领域模型+治理，待评审）](./planning/P2_SLICE1_SUMMARY.md)。

## 产品

> P0 产物已确认采用为**初版基线**（2026-09-04），P7/P8 校准前有效；真实输入项（现场观察、黄金样本）按 [RAID](./planning/RAID.md) 占位跟踪。四类负责人已指定为刘志高。`operations/`、`product/` 其余目录按文档纪律随需补全。

- [产品简报](./product/PRODUCT_BRIEF.md)：愿景、目标用户、核心问题、明确不做与首个闭环成功标准。
- [产品原则（可视化/任务闭环/全生命周期/费用·滞港费）](./product/PRINCIPLES.md)：负责人坚持，设计不可漂移。
- [文档人话速查表（DOC_HUMAN_INDEX，每份一句话用途）](./product/DOC_HUMAN_INDEX.md)。
- [统一业务词汇表](./product/GLOSSARY.md)：术语单一真相与负责人。
- [智能导入工作流](./product/workflows/IMPORT_WORKFLOW.md)：首个纵向闭环的定义、异常与审批点。
- [货柜工作台 UX 拆解（全生命周期可视化 + 一键动作，候选）](./product/UX_CONTAINER_WORKBENCH.md)。
- [非功能需求与指标](./product/NON_FUNCTIONAL_REQUIREMENTS.md)：可用性/延迟/容量与 AI 指标基线（候选）。
- **P2 领域设计（切片一 · 候选，任务 brief [p2-shipment-import-domain](./planning/tasks/p2-shipment-import-domain.md)）**
  - [现状系统基线快照（AS-IS）](./product/domain/AS_IS_LEGACY_BASELINE.md)：现网货柜物流状态系统的状态机/字段/导入现状审计快照（Logixs 领域设计输入，单一真相）。
  - [领域上下文与聚合边界（P2-01）](./product/domain/CONTEXT_MAP.md)
  - [货柜状态模型与合法转换（P2-02）](./product/domain/CONTAINER_STATUS_MODEL.md)
  - [导入领域模型（P2-03）](./product/domain/IMPORT_DOMAIN_MODEL.md)
  - [首批目标字段目录 v0.1](./product/domain/TARGET_FIELD_CATALOG.md)
  - [出运全流程分析与模型（ShipmentPlan 顶层对象）](./product/domain/SHIPMENT_FLOW_OVERVIEW.md)
  - [货柜全生命周期管理（备货→装箱→海运→清关→到港→提柜→卸柜→还箱）](./product/domain/CONTAINER_LIFECYCLE.md)
  - [外部数据源与集成边界（计划系统/海关港口航司/运输公司/WMS）](./product/domain/INTEGRATION_BOUNDARIES.md)
  - [时间链与状态链一致性规范（LIFECYCLE_CONSISTENCY）](./product/domain/LIFECYCLE_CONSISTENCY.md)
  - [P2 切片一 · 评审清单（负责人验收用）](./product/domain/P2_REVIEW_CHECKLIST.md)
  - [AS-IS vs TO-BE 差异/漏点/不足/优势（评审输入）](./product/domain/ASIS_TOBE_GAP.md)
  - [货柜标记与动作触发（危险品/植检/致冷剂等弹性打标）](./product/domain/CONTAINER_MARKERS.md)
  - [标记字典初值 v0.1（MARKER_CATALOG）](./product/domain/MARKER_CATALOG.md)
  - [动作目录 v0.1（ACTION_CATALOG，一键动作 actionCode）](./product/domain/ACTION_CATALOG.md)
  - [关键节点 PDCA 闭环分析（计划→派单→Check→改善）](./product/domain/NODE_PDCA.md)
  - [8 关键节点 · 样本回验底稿（种子样例级，含 F1–F8 发现与阈值候选）](./product/domain/NODE_PDCA_VALIDATION.md)
  - [行业规范对标与纠偏（集装箱跟踪节点状态码规范）](./product/domain/INDUSTRY_STANDARDS_ALIGN.md)
  - [方案全面评审·左右互搏（矛盾 A1–A7 / AI 虚幻 H1–H8 / 待裁决）](./product/domain/PROPOSAL_SELF_AUDIT.md)
  - [备货单-货柜关系清洗与校验细则（P2-06 首任务）](./product/domain/DATA_CLEANUP_ORDER_CONTAINER.md)
  - [字段级迁移映射（P2-06 G2 初稿）](./product/domain/FIELD_MIGRATION_MAP.md)
  - [逻辑数据模型（P2-06 初稿）](./product/domain/DATA_MODEL_P2-06.md)
  - [契约草案（P2-08/09 前身：信封/错误码/状态事件码/动作与投影骨架）](./product/domain/CONTRACTS_DRAFT.md)
  - [外部集成冗余与故障转移设计（G1 初稿）](./product/domain/INTEGRATION_REDUNDANCY.md)

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
| [P2 领域设计](./product/domain/CONTEXT_MAP.md)（domain/ 候选） | P2 评审者、领域/数据实现者、迁移实施者 | P2 阶段评审与门禁、开工前（领域依据） |
| [RAID](./planning/RAID.md) | 阶段负责人与责任人 | 每阶段门禁评审与问题升级 |

> 维护纪律见 `ENGINEERING_RULES` §12：无消费者不建、分层管理、过期即清、单一真相不复制。新增 `operations/`、`product/` 等目录时，由创建者在本表补一行。
