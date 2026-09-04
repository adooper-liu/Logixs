# 文档人话速查表（DOC_HUMAN_INDEX）

> 状态：**索引** · 2026-09-04 · 给"人"看的导航：每份文档一句话讲清"它是干嘛的、什么时候去翻"。
> 用法：先按类别找名字 → 点链接看正文；正文保持单一真相，本表只说人话不抄正文。
> 说明：P2 切片一文档已封板，本表随新增/废弃文档维护（ENGINEERING_RULES §12）。

## 一、仓库级（规则——写代码前必读）

| 文档 | 一句话人话 |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | 给写代码的人（含 AI）立规矩：先看懂再动手、别越界、别乱删。 |
| [ENGINEERING_RULES.md](../../ENGINEERING_RULES.md) | 工程纪律总纲：状态机单一、未知值不蒙混、字段不乱加，违规不能上线。 |
| [根 README](../../README.md) / [docs/README](../README.md) | 项目导航：新人从哪看起、每份文档给谁看。 |

## 二、产品层（做什么）

| 文档 | 一句话人话 |
| --- | --- |
| [PRODUCT_BRIEF](./PRODUCT_BRIEF.md) | 产品一句话：用 AI+人工审核帮你把乱 Excel 可靠导进系统。 |
| [PRINCIPLES](./PRINCIPLES.md) | 四条铁律不许改：可视化、任务闭环、货柜全生命周期、滞港费费用管理。 |
| [GLOSSARY](./GLOSSARY.md) | 术语词典：一个词只能一个意思（备货单/采购单/主备货单别混）。 |
| [NON_FUNCTIONAL_REQUIREMENTS](./NON_FUNCTIONAL_REQUIREMENTS.md) | 数字承诺：多快/多大/多稳（现为初值待校准）。 |
| [IMPORT_WORKFLOW](./workflows/IMPORT_WORKFLOW.md) | 首个闭环流程说明：上传→解析→AI 建议→人工确认→预检→导入→对账。 |
| [UX_CONTAINER_WORKBENCH](./UX_CONTAINER_WORKBENCH.md) | "一个屏看一柜全貌 + 点一下干一步"的界面设计。 |

## 三、领域层（怎么建模型）

| 文档 | 一句话人话 |
| --- | --- |
| [AS_IS snapshot](./domain/AS_IS_LEGACY_BASELINE.md) | 把老系统的表/状态/毛病照实拍下来作对照。 |
| [CONTEXT_MAP（P2-01）](./domain/CONTEXT_MAP.md) | 系统分哪些板块、谁管什么、板块间怎么传。 |
| [CONTAINER_STATUS_MODEL（P2-02）](./domain/CONTAINER_STATUS_MODEL.md) | 货柜处于哪阶段、怎么合法地变，别人都引用它。 |
| [IMPORT_DOMAIN_MODEL（P2-03）](./domain/IMPORT_DOMAIN_MODEL.md) | 导入内部结构：批次/行/预检/审核/结果，可追到谁干的。 |
| [CONTAINER_LIFECYCLE](./domain/CONTAINER_LIFECYCLE.md) | 一柜从备货到还箱的 14 段流程 + 每段记什么。 |
| [LIFECYCLE_CONSISTENCY](./domain/LIFECYCLE_CONSISTENCY.md) | 保顺序规则：时间只往后、过了的节点不能回改。 |
| [CONTAINER_MARKERS](./domain/CONTAINER_MARKERS.md) | "给柜打标签(危险品/植检…)"与触发动作的机制。 |
| [MARKER_CATALOG](./domain/MARKER_CATALOG.md) | 标签初值字典（危险品/植检/致冷剂/超限…）。 |
| [ACTION_CATALOG](./domain/ACTION_CATALOG.md) | 一键动作码字典（确认/派拖/转发/预警…）。 |
| [NODE_PDCA](./domain/NODE_PDCA.md) | 每个关键环节走 计划→派活→检查→改善；列 8 个关键环节要素与风险。 |
| [FIELD_MIGRATION_MAP](./domain/FIELD_MIGRATION_MAP.md) | 老字段往新系统哪搬（含币种/时间口径/迟绑定）。 |
| [DATA_CLEANUP_ORDER_CONTAINER](./domain/DATA_CLEANUP_ORDER_CONTAINER.md) | 新旧交替前清脏数据细则（一单一柜、主备货单号不作键）。 |
| [DATA_MODEL_P2-06](./domain/DATA_MODEL_P2-06.md) | 新库逻辑长相：对象关系 + 关键约束。 |
| [CONTRACTS_DRAFT](./domain/CONTRACTS_DRAFT.md) | 对外接口雏形：统一信封/错误码/状态事件码/动作骨架。 |
| [INTEGRATION_BOUNDARIES](./domain/INTEGRATION_BOUNDARIES.md) | 与外部(海关/船司/飞驼/拖车/WMS)在哪对接、谁说了算。 |
| [INTEGRATION_REDUNDANCY](./domain/INTEGRATION_REDUNDANCY.md) | 一个外部源挂了怎么顶上，不让系统停摆。 |

## 四、评审/治理层（纠错与验收）

| 文档 | 一句话人话 |
| --- | --- |
| [ASIS_TOBE_GAP](./domain/ASIS_TOBE_GAP.md) | 老系统有啥可复用、新设计漏了啥。 |
| [INDUSTRY_STANDARDS_ALIGN](./domain/INDUSTRY_STANDARDS_ALIGN.md) | 对照行业规范把叫法/字段往行话上掰正。 |
| [PROPOSAL_SELF_AUDIT](./domain/PROPOSAL_SELF_AUDIT.md) | 自我找茬记录：哪些矛盾、哪些 AI 想当然、怎么处理。 |
| [P2_REVIEW_CHECKLIST](./domain/P2_REVIEW_CHECKLIST.md) | 负责人验收勾选清单。 |
| [NODE_PDCA_VALIDATION](./domain/NODE_PDCA_VALIDATION.md) | 用老系统种子/真实调查记录回验 8 关键环节（发现与阈值候选）。 |
| [P2 一页总览](../planning/P2_SLICE1_SUMMARY.md) | 给外人/上级看的本批设计摘要。 |
| [任务 brief](../planning/tasks/p2-shipment-import-domain.md) | 当前这摊活的交接单（进度 v37）。 |

**一句话总括**：这批文档 = 把掰扯清楚的业务规则（一单一柜、全生命周期、打标、滞港费、来源权威）变成以后照着写代码、不会写歪的图纸与验收清单。
