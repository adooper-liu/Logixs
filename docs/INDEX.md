# 文档唯一入口索引（INDEX）

> 状态：**索引（唯一入口）** · 2026-09-06 · 维护：新增文档必须在本索引登记（文档纪律 ENGINEERING §12）。
> 🗣️ 白话：这里是"所有文档的地图"——按 规则→架构→产品/理念→领域→清单→评审→规划 排好，想看哪块照表点。

## 一、怎么看（按角色/目标给路径）

- **新成员/实现者（先读）**：规则(AGENTS/ENGINEERING) → 产品(PRINCIPLES/VISION/PRODUCT_BRIEF/GLOSSARY) → 架构(架构文档/模块依赖) → 领域(CONTEXT→LIFECYCLE→STATUS→…) → 规划。
- **业务/评审（验收）**：P2_REVIEW_CHECKLIST → PROPOSAL_SELF_AUDIT → 各领域文档核对。
- **逻辑链（事实→清单→可视化→UI）**：事实(AS_IS/LEGACY_DB/回验) → 清单(domain 各 catalog) → 可视化(UX) → UI 交互(UX §组件/现网附录A)。
- **按阶段**：P0 产品定义 → P1 决策(ADR) → P2 领域与数据(本批) → P3+ 底座/实现（见 PROJECT_BOOTSTRAP_CHECKLIST）。

## 二、仓库根 · 规则与纪律

| 文档                                         | 一句话                                 | 状态       |
| -------------------------------------------- | -------------------------------------- | ---------- |
| [根 README](../README.md)                    | 仓库入口                               | 导航       |
| [AGENTS](../AGENTS.md)                       | 给写码人/代理立的规矩                  | 规则(强制) |
| [ENGINEERING_RULES](../ENGINEERING_RULES.md) | 工程纪律总纲(含状态机/清单化/白话纪律) | 规则(强制) |

## 三、docs 导航与架构

| 文档                                                             | 一句话                                 | 状态          |
| ---------------------------------------------------------------- | -------------------------------------- | ------------- |
| [人话导读](./人话导读.md)                                        | 大白话讲全系统+文档地图（新人先读）    | 导航          |
| [docs/README](./README.md)                                       | docs 导航+写作纪律+消费链              | 导航          |
| [架构文档](./architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md) | 目标架构总览(分层/模块/AI/工作流)      | 已接受        |
| [模块依赖图](./architecture/MODULE_DEPENDENCIES.md)              | 模块/包依赖与禁止依赖                  | 已接受(P1-09) |
| [ADR 索引](./architecture/decisions/README.md) + ADR-001~010     | 架构决策记录（含模块化单体限界上下文） | 已接受(P1)    |

## 四、产品/理念/流程

| 文档                                                                          | 一句话                                                                                                             | 状态                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| [VISION](./product/VISION.md)                                                 | 品牌/愿景/节点操作/仓储图谱 → 落地对照                                                                             | 候选                         |
| [PRINCIPLES](./product/PRINCIPLES.md)                                         | 元治理M0 + 十原则P1–P10(时序/权威/确认三档/费用类型/复核/表单即证据) + 主流程/工序任务/工单/动作模型 + 节点七组SOP | 负责人确认(M0 + P1–P10)      |
| [PRODUCT_BRIEF](./product/PRODUCT_BRIEF.md)                                   | 产品定位/当前起点/接入与前端演进                                                                                   | 初版基线                     |
| [GLOSSARY](./product/GLOSSARY.md)                                             | 术语单一真相(含 P2 §5)                                                                                             | 基线+P2 增补 v0.1.6          |
| [NFR](./product/NON_FUNCTIONAL_REQUIREMENTS.md)                               | 数字承诺(待校准)                                                                                                   | 初版基线                     |
| [IMPORT_WORKFLOW](./product/workflows/IMPORT_WORKFLOW.md)                     | 首个闭环流程叙事                                                                                                   | 基线                         |
| [First Mile/清关证据链 7 组](./product/workflows/CUSTOMS_OPERATION_CHAINS.md) | 原表单证据→统一对象→角色视图与非线性闭环                                                                           | 负责人业务规则+候选映射 v0.3 |
| [UX 工作台](./product/UX_CONTAINER_WORKBENCH.md)                              | 已出运入口 + 三状态/三段确认 + 动态任务配方与角色化节点工作区                                                      | 候选 v0.8                    |
| [货柜运营管理框架](./product/OPERATIONS_CONTAINER_LIFECYCLE.md)               | 电商货柜全生命周期运营手册:节点/KPI·SLA/RACI/风险/应急SOP(22 节点管理视图)                                         | 候选 v0.1                    |
| [UI 体系标准](./product/UI_SYSTEM.md)                                         | Operations Shell、页面模板、三状态视觉、token、组件分层与质量门禁                                                  | 设计决策 v1.0                |
| 人话速查                                                                      | 见本 INDEX（每行"一句话+状态"即人话速查）                                                                          | —                            |

## 五、领域（docs/product/domain，按逻辑簇）

### 5.1 对象/边界/模型

| 文档                                                                     | 一句话                                                     | 状态      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- | --------- |
| [CONTEXT_MAP](product/domain/CONTEXT_MAP.md)                             | 当前/未来上下文边界与聚合(P2-01)                           | 候选 v0.5 |
| [SHIPMENT_FLOW_OVERVIEW](product/domain/SHIPMENT_FLOW_OVERVIEW.md)       | 已出运数据起点/上游演进/箱单关系                           | 候选 v0.4 |
| [CONTAINER_LIFECYCLE](product/domain/CONTAINER_LIFECYCLE.md)             | 14 节点全生命周期(P2 对象表)                               | 候选 v0.4 |
| [LIFECYCLE_NODE_CATALOG_V1](product/domain/LIFECYCLE_NODE_CATALOG_V1.md) | 14 节点代码、顺序、可选性、所有者和完成口径唯一权威        | 正式 V1   |
| [LIFECYCLE_CONSISTENCY](product/domain/LIFECYCLE_CONSISTENCY.md)         | 时间/状态链规则 R0–R9/A6(加乱序回补/分支合法转换/对账纠偏) | 候选 v0.4 |
| [CONTAINER_STATUS_MODEL](product/domain/CONTAINER_STATUS_MODEL.md)       | 状态码 8 + 合法转换参考；权威见 GC-002                     | 候选 v0.5 |
| [IMPORT_DOMAIN_MODEL](product/domain/IMPORT_DOMAIN_MODEL.md)             | 已出运列表导入/预检/审核/对账(P2-03)                       | 候选 v0.5 |
| [DATA_MODEL_P2-06](product/domain/DATA_MODEL_P2-06.md)                   | 逻辑库图纸 + 事件/来源/可靠提交关系占位                    | 候选 v0.5 |

### 5.2 清单/字典族（可落 Seed/契约）

| 文档                                                                                             | 一句话                                                                     | 状态      |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------- |
| [EVENT_CODES](product/domain/EVENT_CODES.md)                                                     | 规范事件代码、版本、角色和节点完成资格唯一权威                             | 正式 V1   |
| [TASK_WORK_ORDER_CONTRACT_V1](product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)                     | 节点任务、作业工单、状态机、聚合和事实应用唯一权威                         | 正式 V1   |
| [EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1](product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) | 证据、来源身份、权威资格、验证、冲突和历史密封唯一权威                     | 正式 V1   |
| [CROSS_MODULE_REFERENCE_CONTRACT_V1](product/domain/CROSS_MODULE_REFERENCE_CONTRACT_V1.md)       | 跨模块对象 ID、所有权、父链与引用完整性唯一权威                            | 正式 V1   |
| [ACTION_PERMISSION_CONTRACT_V1](product/domain/ACTION_PERMISSION_CONTRACT_V1.md)                 | 动作定义、服务端授权、复核、补录和审计唯一权威                             | 正式 V1   |
| [SYNC_RELIABILITY_CONTRACT_V1](product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)                   | 三阶段回执、幂等、Inbox/Outbox、重试、死信和补偿唯一权威                   | 正式 V1   |
| [QUERY_PROJECTION_CONTRACT_V1](product/domain/QUERY_PROJECTION_CONTRACT_V1.md)                   | 生命周期状态、任务工单、时间线、证据、同步及允许动作公共读模型唯一权威     | 正式 V1   |
| [PUBLIC_ERROR_CONTRACT_V1](product/domain/PUBLIC_ERROR_CONTRACT_V1.md)                           | 公共错误信封、稳定码、HTTP、冲突与重试语义唯一权威                         | 正式 V1   |
| [STATUS→](product/domain/CONTAINER_STATUS_MODEL.md)                                              | 状态码枚举(见 5.1)                                                         | —         |
| [ACTION_CATALOG](product/domain/ACTION_CATALOG.md)                                               | 一键动作码(组 A–E)                                                         | 候选      |
| [MARKER_CATALOG](product/domain/MARKER_CATALOG.md)                                               | 货柜标记字典                                                               | 候选      |
| [ERROR_CODES_CATALOG](product/domain/ERROR_CODES_CATALOG.md)                                     | 旧候选错误码兼容导航，权威已迁移至 GC-011                                  | 已取代    |
| [CONTRACTS_DRAFT](product/domain/CONTRACTS_DRAFT.md)                                             | P2-08/09 历史草案；正式契约已拆分至 GC-003/005–011                         | 已取代    |
| [NODE_TIME_FIELDS](product/domain/NODE_TIME_FIELDS.md)                                           | 14 节点 planned/actual 字段                                                | 候选      |
| [PRECHECK_RULES](product/domain/PRECHECK_RULES.md)                                               | 预检/校验规则行 17                                                         | 候选      |
| [FIVE_PARTY_CODES](product/domain/FIVE_PARTY_CODES.md)                                           | 五主体扣留/放行/查验码                                                     | 候选      |
| [FEE_DEMURRAGE](product/domain/FEE_DEMURRAGE.md)                                                 | 超期费用三类型分开(P8):起算/免费期/阶梯/日历/账单权威 + 预计·应计·账单分轨 | 候选 v0.3 |
| [TARGET_FIELD_CATALOG](product/domain/TARGET_FIELD_CATALOG.md)                                   | 已出运货柜首批标准字段                                                     | 候选 v0.4 |
| [CONTAINER_MARKERS](product/domain/CONTAINER_MARKERS.md)                                         | 标记→动作机制                                                              | 候选      |
| [TIMELINE_MAPPING](product/domain/TIMELINE_MAPPING.md)                                           | 不可变事件、乱序重放与状态机关系                                           | 候选 v0.2 |
| [EXTERNAL_EVENT_MAPPING](product/domain/EXTERNAL_EVENT_MAPPING.md)                               | 三方码通用映射机制                                                         | 候选      |

### 5.3 集成/迁移/现网

| 文档                                                                           | 一句话                                         | 状态                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------- |
| [AS_IS_LEGACY_BASELINE](product/domain/AS_IS_LEGACY_BASELINE.md)               | 现网系统快照(状态/字段/反例)                   | 快照                 |
| [LEGACY_DB_CATALOG](product/domain/LEGACY_DB_CATALOG.md)                       | 老库表/字典家底                                | 快照                 |
| [FIELD_MIGRATION_MAP](product/domain/FIELD_MIGRATION_MAP.md)                   | 老字段→新库映射                                | 候选                 |
| [DATA_CLEANUP_ORDER_CONTAINER](product/domain/DATA_CLEANUP_ORDER_CONTAINER.md) | 箱-单关系清洗细则(P2-06 首任务)                | 候选                 |
| [INTEGRATION_BOUNDARIES](product/domain/INTEGRATION_BOUNDARIES.md)             | 导入→直连边界/字段与事件级来源权威             | 候选 v0.4            |
| [INTEGRATION_REDUNDANCY](product/domain/INTEGRATION_REDUNDANCY.md)             | 集成冗余/故障转移                              | 候选                 |
| [ASIS_TOBE_GAP](product/domain/ASIS_TOBE_GAP.md)                               | 现网 vs 新设计差距                             | 评审输入             |
| [飞驼知识库](integrations/freightower/README.md)                               | 飞驼接口、事件码、字段、同步与安全             | 外部供应商核验知识库 |
| [飞驼海关证据映射 V1](integrations/freightower/CUSTOMS_EVIDENCE_MAPPING_V1.md) | 官网海关接口证据索引、复合码映射与工单驱动规则 | 外部供应商映射 V1    |

### 5.4 治理/评审/对照

| 文档                                                                   | 一句话                                                                  | 状态         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ |
| [P2_REVIEW_CHECKLIST](product/domain/P2_REVIEW_CHECKLIST.md)           | D1–D21 追踪、V1–V4 样本与 Decision 门禁                                 | 载体 v1.4    |
| [GLOBAL_CONTRACT_REGISTRY](product/domain/GLOBAL_CONTRACT_REGISTRY.md) | 11 项全局公共契约的唯一治理入口：门禁、所有者、权威文档、阻断与下一动作 | 治理基线 V1  |
| [公共 JSON Schema V1](../packages/contracts/README.md)                 | GC-001～011 的 Draft 2020-12 Schema、目录与 fixtures 单一入口           | 已实例化 D4  |
| [PROPOSAL_SELF_AUDIT](product/domain/PROPOSAL_SELF_AUDIT.md)           | 对抗评审 A/H                                                            | 记录         |
| [NODE_PDCA](product/domain/NODE_PDCA.md)                               | 七组完整性检查 + 动态任务定义 + 14 节点任务拆分 + 非线性闭环            | 候选 v0.8    |
| [NODE_PDCA_VALIDATION](product/domain/NODE_PDCA_VALIDATION.md)         | 历史外部样本回验 F1–F8；当前证据源不可复现                              | 历史评审输入 |
| [INDUSTRY_STANDARDS_ALIGN](product/domain/INDUSTRY_STANDARDS_ALIGN.md) | 行业规范对标 W1–W14                                                     | 对标         |
| [OPERATIONS_ALIGNMENT](product/domain/OPERATIONS_ALIGNMENT.md)         | 22个运营环节→14节点主链映射及工序任务/工单执行模型                      | 已定 v1.0    |
| [CATALOGIZATION_AUDIT](product/domain/CATALOGIZATION_AUDIT.md)         | 清单化盘点+人话重构队列                                                 | 盘点         |

## 六、规划/路线/任务

| 文档                                                                                           | 一句话                                                               | 状态                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| [启动清单](./planning/PROJECT_BOOTSTRAP_CHECKLIST.md)                                          | P0–P9 推进主线                                                       | 进行中                      |
| [RAID](./planning/RAID.md)                                                                     | 风险/假设/问题/依赖                                                  | 跟踪                        |
| [P2 一页总览](./planning/P2_SLICE1_SUMMARY.md)                                                 | 本批摘要(对外)                                                       | 候选                        |
| [任务 brief](./planning/tasks/p2-shipment-import-domain.md)                                    | P2 切片一交接单                                                      | 已完成                      |
| [P3-01 主分支保护](./planning/tasks/p3-01-branch-protection.md)                                | CODEOWNERS + main 禁止强推，合入须 PR 与 quality                     | 已完成                      |
| [P6 导入第一刀](./planning/tasks/p6-import-first-slice.md)                                     | 上传→预检→写端口→对账的首个可写库闭环                                | design                      |
| [P6 导入第一刀实施规格](./planning/specs/p6-import-first-slice.md)                             | integration-import 与 shipment-registry 写端口的排期规格             | 设计稿                      |
| [P6 智能导入切片（已并入）](./planning/tasks/p6-smart-import-slice.md)                         | 四阶段 MVP 草案，已并入导入第一刀                                    | blocked                     |
| [任务 brief-管理视图](./planning/tasks/p2-web-management-kpi-raci.md)                          | 补看板 KPI + RACI 管理投影                                           | 已完成                      |
| [全局公共契约收敛 V1](./planning/tasks/global-contract-convergence-v1.md)                      | 依次定稿全局契约、Schema 权威源及多技术载体生成                      | 已完成                      |
| [全栈底层基座](./planning/tasks/p3-p4-full-stack-base.md)                                      | TS/Python/DB/Temporal 骨架与薄真实读链路                             | 已完成                      |
| [架构依赖方向门禁](./planning/tasks/p3-architecture-dependency-gates.md)                       | MODULE_DEPENDENCIES 禁止依赖写入 repo:check                          | 已完成                      |
| [任务模板](./planning/tasks/_template.md)                                                      | 任务载体模板                                                         | 规范                        |
| [模块实施规格模板](./planning/tasks/_module-implementation-spec-template.md)                   | 限界上下文的数据、规则、接口、前端、测试与验收统一模板               | 规范                        |
| [海关放行纵向切片](./product/domain/CUSTOMS_RELEASE_VERTICAL_SLICE.md)                         | 四模块贯通的首个可执行工序任务/工单/权威事件闭环                     | 设计稿                      |
| [海关业务样本 001](./product/domain/CUSTOMS_BUSINESS_SAMPLE_001.md)                            | ISF、海运单、发票和装箱单的脱敏对象关联与证据缺口                    | 真实脱敏样本·待确认         |
| [海关业务样本 002](./product/domain/CUSTOMS_BUSINESS_SAMPLE_002.md)                            | 美国进口申报资料、HTS 估价和最终用途声明对账                         | 真实脱敏样本·待确认         |
| [海关业务样本 003](./product/domain/CUSTOMS_BUSINESS_SAMPLE_003.md)                            | 三票 CBP Form 7501 字段、税费结构及非放行边界                        | 真实脱敏批量样本·待确认     |
| [海关业务样本 004](./product/domain/CUSTOMS_BUSINESS_SAMPLE_004.md)                            | 意大利 H1 申报、税费和货代关税借记的证据边界                         | 真实脱敏批量样本·待确认     |
| [海关业务样本 005](./product/domain/CUSTOMS_BUSINESS_SAMPLE_005.md)                            | 西班牙 DUA 黄色/红色通道及 Levante 放行候选                          | 真实脱敏双场景样本·待确认   |
| [海关业务样本 006](./product/domain/CUSTOMS_BUSINESS_SAMPLE_006.md)                            | 英国 CDS Customs Cleared 批量放行候选                                | 真实脱敏批量样本·待确认     |
| [海关业务样本 007](./product/domain/CUSTOMS_BUSINESS_SAMPLE_007.md)                            | 中国出口报关平台的分票、明细聚合、对账与状态边界                     | 真实脱敏现网界面样本·待确认 |
| [海关业务样本 008](./product/domain/CUSTOMS_BUSINESS_SAMPLE_008.md)                            | 飞驼海外码头多类别 Hold 与可提箱守卫                                 | 真实脱敏现网界面样本·待确认 |
| [业务样本 009](./product/domain/CUSTOMS_BUSINESS_SAMPLE_009.md)                                | 飞驼船公司跟踪的部分数据、空数据和投影结构                           | 真实脱敏现网界面样本·待确认 |
| [海关业务样本 010](./product/domain/CUSTOMS_BUSINESS_SAMPLE_010.md)                            | 出口商检申请、工厂装箱和箱况检查的证据边界                           | 真实脱敏局部样本·待确认     |
| [业务样本 011](./product/domain/CUSTOMS_BUSINESS_SAMPLE_011.md)                                | LMS 八国清关单据矩阵、生成传递规则和状态拆分                         | 真实需求工作簿·评审输入     |
| [海关业务样本 012](./product/domain/CUSTOMS_BUSINESS_SAMPLE_012.md)                            | 中国出口双报关单审核放行、CIF 单证和议付费用边界                     | 真实脱敏纵向样本·待确认     |
| [费用与对账业务样本 013](./product/domain/COST_SETTLEMENT_BUSINESS_SAMPLE_013.md)              | 七类费用引出、货柜/费目/SKU 多粒度及标准、审核、分摊、请款、支付分轨 | 真实脱敏样本·待确认         |
| [海关业务契约定稿包 V1](./product/domain/CUSTOMS_BUSINESS_CONTRACT_V1.md)                      | 海关案卷、证据、事件、任务/工单、同步和主链守卫的实现前基线          | 业务契约 V1·待负责人评审    |
| [海关公共契约实例化设计 V1](./product/domain/CUSTOMS_PUBLIC_CONTRACT_DESIGN_V1.md)             | 海关状态枚举、事件信封、DTO、错误码与 JSON Schema 对照               | 公共契约设计 V1·待实现      |
| [海关数据库结构与迁移设计 V1](./product/domain/CUSTOMS_DATABASE_MIGRATION_DESIGN_V1.md)        | 案卷、观察、证据、事实应用、回执、幂等、Outbox 与审计的物理设计      | 数据库设计 V1·待迁移实现    |
| [货柜生命周期时间线契约 V1](./product/domain/CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)      | 统一事实事件信封、时间语义、14节点推进、纠偏与当前投影               | 正式 V1·负责人批准          |
| [货柜生命周期状态机契约 V1](./product/domain/CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md) | 主流程、节点实例、货柜状态投影、转换守卫、阻断与纠偏                 | 正式 V1·负责人批准          |

## 七、维护

- 本索引=唯一入口：新增文档先在此登记并给"一句话+状态"。
- 状态口径：`规则/基线/负责人确认`(定) · `候选 vX`(待评审) · `快照`(现网) · `评审/回验/对标/盘点`(过程)。
