# 文档唯一入口索引（INDEX）

> 状态：**索引（唯一入口）** · 2026-09-06 · 维护：新增文档必须在本索引登记（文档纪律 ENGINEERING §12）。
> 🗣️ 白话：这里是"所有文档的地图"——按 规则→架构→产品/理念→领域→清单→评审→规划 排好，想看哪块照表点。

## 一、怎么看（按角色/目标给路径）

- **新成员/实现者（先读）**：人话导读（含货柜主链）→ 规则(AGENTS/ENGINEERING) → 产品(PRINCIPLES/VISION/PRODUCT_BRIEF/GLOSSARY) → 架构(架构文档/模块依赖) → 领域(CONTEXT→LIFECYCLE→STATUS→…) → 规划。
- **业务/评审（验收）**：P2_REVIEW_CHECKLIST → PROPOSAL_SELF_AUDIT → 各领域文档核对。
- **逻辑链（事实→清单→可视化→UI）**：事实(AS_IS/LEGACY_DB/回验) → 清单(domain 各 catalog) → 可视化(UX) → UI 交互(UX §组件/现网附录A)。
- **按阶段**：P0 产品定义 → P1 决策(ADR) → P2 领域与数据(本批) → P3+ 底座/实现（见 PROJECT_BOOTSTRAP_CHECKLIST；人话见 PROJECT_BOOTSTRAP_PLAIN_LANGUAGE）。

## 二、仓库根 · 规则与纪律

| 文档                                         | 一句话                                 | 状态       |
| -------------------------------------------- | -------------------------------------- | ---------- |
| [根 README](../README.md)                    | 仓库入口                               | 导航       |
| [AGENTS](../AGENTS.md)                       | 给写码人/代理立的规矩                  | 规则(强制) |
| [ENGINEERING_RULES](../ENGINEERING_RULES.md) | 工程纪律总纲(含状态机/清单化/白话纪律) | 规则(强制) |

## 三、docs 导航与架构

| 文档                                                                                     | 一句话                                                    | 状态                            |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| [人话导读](./人话导读.md)                                                                | 大白话讲全系统+文档地图（新人先读）                       | 导航                            |
| [货柜怎么往前走（人话）](./人话-货柜怎么往前走.md)                                       | 建柜展任务、事实算条件、核验实际才过站                    | 人话对照                        |
| [docs/README](./README.md)                                                               | docs 导航+写作纪律+消费链                                 | 导航                            |
| [架构文档](./architecture/AI_WORKFLOW_TECHNICAL_ARCHITECTURE.md)                         | 目标架构总览(分层/模块/AI/工作流)                         | 已接受                          |
| [模块依赖图](./architecture/MODULE_DEPENDENCIES.md)                                      | 模块/包依赖与禁止依赖                                     | 已接受(P1-09)                   |
| [模块插件约定](./architecture/MODULE_PLUGIN_CONVENTION.md)                               | Odoo 式基础核+增量插件：manifest/目录/权限映射            | 已接受约定                      |
| [增量模块开发手册](./architecture/INCREMENTAL_MODULE_PLAYBOOK.md)                        | 切片提纲+清单；Odoo 可借鉴能力全量采纳与优先序            | 已接受工作纸                    |
| [ADR-011 受控 UI 投影](./architecture/decisions/ADR-011-controlled-ui-projection.md)     | 控件化+schema 投影；拒绝 Studio 选表/任意 JOIN            | 候选(proposed)                  |
| [任务：通知+只读助手](./planning/tasks/p6-notification-ops-assistant.md)                 | 问题通知总线与从通知打开的只读运营助手第一刀              | 已合入 main                     |
| [任务：对象活动流+Activity 投影](./planning/tasks/p6-object-activity-task-projection.md) | 通知挂货柜/任务，并从现有工单投影下一动作                 | 已合入 main                     |
| [任务：只读助手对象上下文](./planning/tasks/p6-assistant-object-context.md)              | 助手会话挂对象上下文，只读投影与追问回退                  | 已合入 main                     |
| [任务：全生命周期统一日期事实](./planning/tasks/p6-unified-lifecycle-date-facts.md)      | API、导入、人工共用日期事实链，核验实际日期才申请过站     | 已完成                          |
| [业务纵向交付路线图](./planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md)                        | 主数据/SKU装载→合规→门禁→岗位工作台；动态后台与自动化后置 | 负责人确认的实施路线 v1         |
| [任务：Product/SKU 稳定身份](./planning/tasks/p6-product-sku-master-identity.md)         | master-data 建立租户内 SKU 稳定身份与幂等公开 Port        | 已完成                          |
| [任务：备货单行 SKU 与货柜装载](./planning/tasks/p6-shipment-cargo-allocation.md)        | 产品行稳定引用 SKU，并版本化保存跨订单实际装载事实        | 已完成                          |
| [任务：Product/SKU 结构化合规档案](./planning/tasks/p6-product-compliance-profile.md)    | 电池、危险品、制冷剂、检验要求及证书版本事实              | 已完成                          |
| [安全威胁模型 V1](./architecture/SECURITY_THREAT_MODEL_V1.md)                            | 租户、文件、AI/Tool 与身份边界的威胁和上线阻断            | 安全基线 V1                     |
| [ADR 索引](./architecture/decisions/README.md) + ADR-001~012                             | 架构决策记录（含受控 UI 投影、外部来源时间确定时刻判定）  | P1 已接受；011 候选、012 已接受 |

## 四、产品/理念/流程

| 文档                                                                          | 一句话                                                                                                             | 状态                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| [VISION](./product/VISION.md)                                                 | 品牌/愿景/节点操作/仓储图谱 → 落地对照                                                                             | 候选                         |
| [PRINCIPLES](./product/PRINCIPLES.md)                                         | 元治理M0 + 十原则P1–P10(时序/权威/确认三档/费用类型/复核/表单即证据) + 主流程/工序任务/工单/动作模型 + 节点七组SOP | 负责人确认(M0 + P1–P10)      |
| [PRODUCT_BRIEF](./product/PRODUCT_BRIEF.md)                                   | 产品定位/当前起点/接入与前端演进                                                                                   | 初版基线                     |
| [GLOSSARY](./product/GLOSSARY.md)                                             | 术语单一真相(含 P2 §5、过站)                                                                                       | 基线+P2 增补 v0.1.10         |
| [NFR](./product/NON_FUNCTIONAL_REQUIREMENTS.md)                               | 数字承诺(待校准)                                                                                                   | 初版基线                     |
| [IMPORT_WORKFLOW](./product/workflows/IMPORT_WORKFLOW.md)                     | 首个闭环流程叙事                                                                                                   | 基线                         |
| [First Mile/清关证据链 7 组](./product/workflows/CUSTOMS_OPERATION_CHAINS.md) | 原表单证据→统一对象→角色视图与非线性闭环                                                                           | 负责人业务规则+候选映射 v0.3 |
| [UX 工作台](./product/UX_CONTAINER_WORKBENCH.md)                              | 已出运入口 + 三状态/三段确认 + 动态任务配方与角色化节点工作区                                                      | 候选 v0.8                    |
| [货柜运营管理框架](./product/OPERATIONS_CONTAINER_LIFECYCLE.md)               | 电商货柜全生命周期运营手册:节点/KPI·SLA/RACI/风险/应急SOP(22 节点管理视图)                                         | 候选 v0.1                    |
| [UI 体系标准](./product/UI_SYSTEM.md)                                         | Operations Shell、页面模板、表面命名 UI-D09、三状态视觉、token、组件分层                                           | 设计决策 v1.0                |
| [作业壳页面清单](./product/WORKSPACE_UI_INVENTORY.md)                         | 当前各页定位/点击边界，以及拿掉后可按投影补回的模块                                                                | 快照 2026-09-13              |
| [作业界面人话对照](./product/UI_COPY_PLAIN_LANGUAGE.md)                       | 屏幕字对照；显示字典 `apps/web/src/data/uiCopyCatalog.ts`                                                          | 定稿工作纸                   |
| 人话速查                                                                      | 见本 INDEX（每行"一句话+状态"即人话速查）                                                                          | —                            |

## 五、领域（docs/product/domain，按逻辑簇）

### 5.1 对象/边界/模型

| 文档                                                                           | 一句话                                                                                                       | 状态                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| [CONTEXT_MAP](product/domain/CONTEXT_MAP.md)                                   | 当前/未来上下文边界、产品明细与装载分配                                                                      | 已定 v1.2            |
| [SHIPMENT_FLOW_OVERVIEW](product/domain/SHIPMENT_FLOW_OVERVIEW.md)             | 已出运数据起点、版本化箱货关系与上游演进                                                                     | 候选 v0.6            |
| [CONTAINER_LIFECYCLE](product/domain/CONTAINER_LIFECYCLE.md)                   | 14 节点全生命周期(P2 对象表)                                                                                 | 候选 v0.4            |
| [LIFECYCLE_NODE_CATALOG_V1](product/domain/LIFECYCLE_NODE_CATALOG_V1.md)       | 14 流程节点代码、顺序、可选性、所有者和完成口径唯一权威                                                      | 正式 V1              |
| [LIFECYCLE_NODE_IO_CATALOG](product/domain/LIFECYCLE_NODE_IO_CATALOG.md)       | 14 流程节点「一站一张填空表」查阅入口；§2.1 锁定到港/提柜/送仓/卸柜/还箱的计划与实际、ETA、最晚提柜日/还箱日 | 完整性规划           |
| [LIFECYCLE_CONSISTENCY](product/domain/LIFECYCLE_CONSISTENCY.md)               | 时间/状态链规则 R0–R9/A6(加乱序回补/分支合法转换/对账纠偏)                                                   | 候选 v0.4            |
| [CONTAINER_STATUS_MODEL](product/domain/CONTAINER_STATUS_MODEL.md)             | 状态码 8 + 合法转换参考；权威见 GC-002                                                                       | 候选 v0.5            |
| [IMPORT_DOMAIN_MODEL](product/domain/IMPORT_DOMAIN_MODEL.md)                   | 已出运列表导入/预检/审核/对账及装载关系边界                                                                  | 已定 v0.9            |
| [DATA_MODEL_P2-06](product/domain/DATA_MODEL_P2-06.md)                         | 逻辑库图纸 + SKU/装载/合规档案 + 时间溯源与可靠提交                                                          | 候选 v0.9            |
| [COMPLIANCE_MANAGEMENT](product/domain/COMPLIANCE_MANAGEMENT.md)               | 合规横向轨道、规则/评审/证据、14 节点门禁与合规中心规划                                                      | 负责人方向+候选 v0.1 |
| [PRODUCT_ATTRIBUTE_GOVERNANCE](product/domain/PRODUCT_ATTRIBUTE_GOVERNANCE.md) | 强类型核心+结构化合规档案+JSONB 扩展属性+元数据表单边界                                                      | 负责人方向+候选 v0.1 |
| [MASTER_DATA_DICTIONARY](product/domain/MASTER_DATA_DICTIONARY.md)             | 国家角色、港口/设施、船司及服务商主数据与外部候选治理                                                        | 负责人方向+候选 v0.1 |

### 5.2 清单/字典族（可落 Seed/契约）

| 文档                                                                                             | 一句话                                                                     | 状态      |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------- |
| [EVENT_CODES](product/domain/EVENT_CODES.md)                                                     | 规范事件代码、版本、角色和节点完成资格唯一权威                             | 正式 V1   |
| [TASK_WORK_ORDER_CONTRACT_V1](product/domain/TASK_WORK_ORDER_CONTRACT_V1.md)                     | 节点任务、作业工单、状态机、聚合和事实应用唯一权威                         | 正式 V1   |
| [EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1](product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) | 证据、来源身份、权威资格、验证、冲突和历史密封唯一权威                     | 正式 V1   |
| [CROSS_MODULE_REFERENCE_CONTRACT_V1](product/domain/CROSS_MODULE_REFERENCE_CONTRACT_V1.md)       | 跨模块对象 ID、所有权、父链与引用完整性唯一权威                            | 正式 V1   |
| [ACTION_PERMISSION_CONTRACT_V1](product/domain/ACTION_PERMISSION_CONTRACT_V1.md)                 | 动作定义、服务端授权、复核、补录和审计唯一权威                             | 正式 V1   |
| [IDENTITY_ACCESS_MODEL_V1](product/domain/IDENTITY_ACCESS_MODEL_V1.md)                           | 租户、角色、能力和数据范围最小实施基线                                     | 正式 V1   |
| [SYNC_RELIABILITY_CONTRACT_V1](product/domain/SYNC_RELIABILITY_CONTRACT_V1.md)                   | 三阶段回执、幂等、Inbox/Outbox、重试、死信和补偿唯一权威                   | 正式 V1   |
| [QUERY_PROJECTION_CONTRACT_V1](product/domain/QUERY_PROJECTION_CONTRACT_V1.md)                   | 生命周期状态、任务工单、时间线、证据、同步及允许动作公共读模型唯一权威     | 正式 V1   |
| [PUBLIC_ERROR_CONTRACT_V1](product/domain/PUBLIC_ERROR_CONTRACT_V1.md)                           | 公共错误信封、稳定码、HTTP、冲突与重试语义唯一权威                         | 正式 V1   |
| [STATUS→](product/domain/CONTAINER_STATUS_MODEL.md)                                              | 状态码枚举(见 5.1)                                                         | —         |
| [ACTION_CATALOG](product/domain/ACTION_CATALOG.md)                                               | 一键动作码(组 A–E)                                                         | 候选      |
| [MARKER_CATALOG](product/domain/MARKER_CATALOG.md)                                               | 货柜标记字典                                                               | 候选      |
| [ERROR_CODES_CATALOG](product/domain/ERROR_CODES_CATALOG.md)                                     | 旧候选错误码兼容导航，权威已迁移至 GC-011                                  | 已取代    |
| [CONTRACTS_DRAFT](product/domain/CONTRACTS_DRAFT.md)                                             | P2-08/09 历史草案；正式契约已拆分至 GC-003/005–011                         | 已取代    |
| [NODE_TIME_FIELDS](product/domain/NODE_TIME_FIELDS.md)                                           | 14 节点日期投影别名；统一事实落库，不建 30 多个可覆盖日期列                | 正式 V1   |
| [PRECHECK_RULES](product/domain/PRECHECK_RULES.md)                                               | 导入聚合、产品数量、时间证据与重复预检规则目录                             | 候选 v0.2 |
| [FIVE_PARTY_CODES](product/domain/FIVE_PARTY_CODES.md)                                           | 五主体扣留/放行/查验码                                                     | 候选      |
| [FEE_DEMURRAGE](product/domain/FEE_DEMURRAGE.md)                                                 | 超期费用三类型分开(P8):起算/免费期/阶梯/日历/账单权威 + 预计·应计·账单分轨 | 候选 v0.3 |
| [TARGET_FIELD_CATALOG](product/domain/TARGET_FIELD_CATALOG.md)                                   | V1.0 建档、V1.1 产品明细及 V1.2 首组时间事实字段目录                       | 正式 V1.2 |
| [CONTAINER_MARKERS](product/domain/CONTAINER_MARKERS.md)                                         | 标记→动作机制                                                              | 候选      |
| [TIMELINE_MAPPING](product/domain/TIMELINE_MAPPING.md)                                           | 不可变事件、乱序重放与状态机关系                                           | 候选 v0.2 |
| [EXTERNAL_EVENT_MAPPING](product/domain/EXTERNAL_EVENT_MAPPING.md)                               | 三方码通用映射机制 + 逐事件来源信号定级 + 更正撤回接收形态                 | 候选 v0.2 |

### 5.3 集成/迁移/现网

| 文档                                                                           | 一句话                                               | 状态                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------- |
| [AS_IS_LEGACY_BASELINE](product/domain/AS_IS_LEGACY_BASELINE.md)               | 现网系统快照(状态/字段/反例)                         | 快照                 |
| [LEGACY_DB_CATALOG](product/domain/LEGACY_DB_CATALOG.md)                       | 老库表/字典家底                                      | 快照                 |
| [FIELD_MIGRATION_MAP](product/domain/FIELD_MIGRATION_MAP.md)                   | 老字段→新库映射                                      | 候选                 |
| [DATA_CLEANUP_ORDER_CONTAINER](product/domain/DATA_CLEANUP_ORDER_CONTAINER.md) | 旧一单一柜假设下的历史清洗调查；当前不得作为目标模型 | 已过时               |
| [INTEGRATION_BOUNDARIES](product/domain/INTEGRATION_BOUNDARIES.md)             | 导入→直连边界/字段与事件级来源权威                   | 候选 v0.4            |
| [INTEGRATION_REDUNDANCY](product/domain/INTEGRATION_REDUNDANCY.md)             | 集成冗余/故障转移                                    | 候选                 |
| [ASIS_TOBE_GAP](product/domain/ASIS_TOBE_GAP.md)                               | 现网 vs 新设计差距                                   | 评审输入             |
| [飞驼知识库](integrations/freightower/README.md)                               | 飞驼接口、事件码、字段、同步与安全                   | 外部供应商核验知识库 |
| [飞驼海关证据映射 V1](integrations/freightower/CUSTOMS_EVIDENCE_MAPPING_V1.md) | 官网海关接口证据索引、复合码映射与工单驱动规则       | 外部供应商映射 V1    |
| [云当网知识库](integrations/trackingeyes/README.md)                            | 云当网 67 接口、42 码表、推送载荷与两供应商码表对照  | 外部供应商核验知识库 |

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
| [代码怎么往前推（人话）](./planning/PROJECT_BOOTSTRAP_PLAIN_LANGUAGE.md)                       | 用白话说明启动清单：阶段门禁 ≠ 货柜 14 站                            | 人话对照                    |
| [RAID](./planning/RAID.md)                                                                     | 风险/假设/问题/依赖                                                  | 跟踪                        |
| [P2 一页总览](./planning/P2_SLICE1_SUMMARY.md)                                                 | 本批摘要(对外)                                                       | 候选                        |
| [节点资源约束拆解表](./planning/RESOURCE_CONSTRAINT_DECOMPOSITION.md)                          | 14 节点共用的资源/门槛/约满比价工作纸；送仓+卸柜为样例               | 候选工作纸                  |
| [收资源约束工作纸](./planning/tasks/p6-resource-constraint-worksheet.md)                       | 把候选工作纸收入规划目录，不建产能模块                               | 已完成                      |
| [提送卸还联立计划引擎](./planning/INLAND_FOUR_NODE_PLANNING_ENGINE.md)                         | 以 ETA 正排并倒推清关必完日；能配的一律参数或策略，拒绝硬编码        | 候选规划                    |
| [内陆计划第一刀](./planning/tasks/p6-inland-plan-first-slice.md)                               | 按配置起草提送卸还；缺配置失败，不硬编码                             | 已完成                      |
| [超期截止日](./planning/tasks/p6-overdue-lfd-deadlines.md)                                     | 按标准算最晚提柜/还箱日；计划只读，不算钱                            | 已完成                      |
| [超期预计应计](./planning/tasks/p6-overdue-accrual.md)                                         | 同一核按阶梯逐日求和；预计/应计只换钟，不算进账单                    | 已完成                      |
| [作业壳人话第一刀](./planning/tasks/p6-ui-copy-plain-language.md)                              | 任务五问 + 现场用词落到作业壳                                        | 已完成                      |
| [14流程节点填空表](./planning/tasks/p6-lifecycle-node-io-catalog.md)                           | 一站一张作业表：正式口径 + 行业完整性规划                            | 已完成                      |
| [任务 brief](./planning/tasks/p2-shipment-import-domain.md)                                    | P2 切片一交接单                                                      | 已完成                      |
| [P3-01 主分支保护](./planning/tasks/p3-01-branch-protection.md)                                | CODEOWNERS + main 禁止强推，合入须 PR 与 quality                     | 已完成                      |
| [P5 威胁与访问模型](./planning/tasks/p5-threat-access-model.md)                                | 威胁、上线阻断与最小角色/能力/范围基线                               | 已完成                      |
| [P6 导入第一刀](./planning/tasks/p6-import-first-slice.md)                                     | 上传→预检→写端口→对账的首个可写库闭环                                | 已完成                      |
| [智能导入导航入口](./planning/tasks/p6-import-navigation-entry.md)                             | 三个演示角色都可从主导航进入“导入货柜”                               | 已完成                      |
| [导入目标字段目录 V1](./planning/tasks/p6-target-field-catalog-v1.md)                          | 冻结最小建档字段，扩展字段继续按版本治理                             | 已完成                      |
| [产品明细与时间事实规则](./planning/tasks/p6-shipment-line-truth-rules.md)                     | 冻结多产品行、数量/包装分离及实际时间证据目标规则                    | 已完成                      |
| [导入时间事实与来源追溯](./planning/tasks/p6-import-time-provenance.md)                        | 清关/卸柜/卸空时间分槽并保留原值、偏移、来源与证据                   | 已完成                      |
| [导入原始文件留存](./planning/tasks/p6-import-source-file-retention.md)                        | MinIO/S3 留存原文件，批次保存校验元数据与失败补偿                    | 已完成                      |
| [P6 导入第一刀实施规格](./planning/specs/p6-import-first-slice.md)                             | integration-import 与 shipment-registry 写端口的排期规格             | 设计稿                      |
| [P6 智能导入切片（已并入）](./planning/tasks/p6-smart-import-slice.md)                         | 四阶段 MVP 草案，已并入导入第一刀                                    | blocked                     |
| [任务 brief-管理视图](./planning/tasks/p2-web-management-kpi-raci.md)                          | 补看板 KPI + RACI 管理投影                                           | 已完成                      |
| [全局公共契约收敛 V1](./planning/tasks/global-contract-convergence-v1.md)                      | 依次定稿全局契约、Schema 权威源及多技术载体生成                      | 已完成                      |
| [全栈底层基座](./planning/tasks/p3-p4-full-stack-base.md)                                      | TS/Python/DB/Temporal 骨架与薄真实读链路                             | 已完成                      |
| [架构依赖方向门禁](./planning/tasks/p3-architecture-dependency-gates.md)                       | MODULE_DEPENDENCIES 禁止依赖写入 repo:check                          | 已完成                      |
| [work-execution 第一刀](./planning/tasks/p6-work-execution-first-slice.md)                     | 节点任务 + required 工单 + 聚合，不推进主流程                        | 已完成                      |
| [work-execution 第二刀](./planning/tasks/p6-work-execution-emit-event.md)                      | 装箱任务完成后经公开端口申请 stuffed，不直写流程                     | 已完成                      |
| [建柜展开管道任务池](./planning/tasks/p6-pipeline-task-pool.md)                                | 建柜自动启动流程、全管道任务池、事实条件投影                         | 实施中                      |
| [节点进入激活工单](./planning/tasks/p6-activate-next-node-task.md)                             | 规范事件完成后为下一节点幂等建 NodeTask                              | 已完成                      |
| [出运申请 loaded](./planning/tasks/p6-dispatch-emit-loaded.md)                                 | 出运工单完成后申请 loaded，并激活离港任务                            | 已完成                      |
| [离港申请 departed](./planning/tasks/p6-departure-emit-departed.md)                            | 离港工单完成后申请 departed，并激活海运在途任务                      | 已完成                      |
| [完成响应带回激活任务](./planning/tasks/p6-complete-return-activated-task.md)                  | 工单完成后把下一节点任务 id 带回 complete 响应                       | 已完成                      |
| [按货柜列节点任务](./planning/tasks/p6-list-node-tasks-by-container.md)                        | 按 containerId 游标分页列出节点任务                                  | 已完成                      |
| [可选节点适用性](./planning/tasks/p6-set-node-applicability.md)                                | SetNodeApplicability：N/A 可选节点激活时跳过                         | 已完成                      |
| [写接口开发期身份](./planning/tasks/p6-write-endpoint-dev-identity.md)                         | 工单/生命周期 HTTP 强制 X-Tenant-Id / X-Operator-Id                  | 已完成                      |
| [货柜对象租户范围](./planning/tasks/p6-tenant-container-scope.md)                              | 工单/生命周期按 container.tenantId 拒绝跨租户                        | 已完成                      |
| [货柜列表租户范围](./planning/tasks/p6-list-containers-tenant-scope.md)                        | GET /api/containers 按 X-Tenant-Id 过滤                              | 已完成                      |
| [货柜列表游标分页](./planning/tasks/p6-list-containers-page.md)                                | GET /api/containers 按 GC-010 游标分页                               | 已完成                      |
| [证据登记与适用性核验](./planning/tasks/p6-evidence-first-slice.md)                            | document-records 首刀；适用性命令核验 evidenceRefs                   | 已完成                      |
| [规范事件与工单完成证据](./planning/tasks/p6-lifecycle-event-evidence.md)                      | 申请事件/发事件工单完成前核验 evidenceRefs                           | 已完成                      |
| [证据核验 append-only 裁决](./planning/tasks/p6-evidence-verification-decision.md)             | verify 追加不可变决定行，不再只改状态                                | 已完成                      |
| [证据拒绝与撤销](./planning/tasks/p6-evidence-reject-revoke.md)                                | rejected/revoked 命令与原决定引用                                    | 已完成                      |
| [生命周期事件 Outbox 第一刀](./planning/tasks/p6-lifecycle-outbox-first-slice.md)              | 规范事件与 Outbox pending 同事务插入，不做发布器                     | 已完成                      |
| [Outbox 发布器第一刀](./planning/tasks/p6-outbox-publisher-first-slice.md)                     | 领取 pending/过期租约，占位投递后标 published                        | 已完成                      |
| [Outbox 重试与死信](./planning/tasks/p6-outbox-retry-dead-letter.md)                           | 暂时失败 retry_wait，不可重试/用尽 dead_letter                       | 已完成                      |
| [Outbox 死信人工重放](./planning/tasks/p6-outbox-dead-letter-replay.md)                        | 新 eventId + causationId 重放，不改原死信                            | 已完成                      |
| [死信重放同键异载荷](./planning/tasks/p6-outbox-replay-payload-conflict.md)                    | 同键异哈希冲突；可选修正载荷仍用新 eventId                           | 已完成                      |
| [按租户列死信](./planning/tasks/p6-list-dead-letters.md)                                       | GET /api/outbox/dead-letters 按 GC-010 游标分页                      | 已完成                      |
| [本租户到期 Outbox 排空](./planning/tasks/p6-outbox-publish-due.md)                            | 循环领取到期 pending/retry_wait，不做 Temporal 调度                  | 已完成                      |
| [本租户 Outbox Temporal 周期调度](./planning/tasks/p6-outbox-temporal-schedule.md)             | workflow 保证 Schedule，worker Activity HTTP 调 publish-due          | 已完成                      |
| [服务身份跨租户 Outbox 系统排空](./planning/tasks/p6-outbox-system-drain.md)                   | 服务身份列出到期租户并逐个 publish-due，用户头不能扫库               | 已完成                      |
| [系统排空 Temporal 周期调度](./planning/tasks/p6-outbox-system-temporal-schedule.md)           | 服务身份保证系统 Schedule，Activity 不把密钥写入工作流               | 已完成                      |
| [死信操作台第一刀](./planning/tasks/p6-dead-letter-ops-ui.md)                                  | 计划/管理列死信并人工重放，不展示载荷正文                            | 已完成                      |
| [Inbox 接收第一刀](./planning/tasks/p6-inbox-first-slice.md)                                   | 服务身份接收 Inbox，同键幂等，不做 broker/消费                       | 已完成                      |
| [Inbox processing 租约第一刀](./planning/tasks/p6-inbox-processing-lease.md)                   | 领取 received/过期租约，写入 processing，不做业务消费                | 已完成                      |
| [Inbox 占位消费第一刀](./planning/tasks/p6-inbox-process-first-slice.md)                       | 领取后占位消费并标 processed，失败保留租约                           | 已完成                      |
| [Inbox 消费/死信与 ClientOperation](./planning/tasks/p6-inbox-consume-client-operation.md)     | 三阶段操作 + Inbox 真消费同事务 Outbox + 重试/死信                   | 已完成                      |
| [Inbox 死信列表与重放](./planning/tasks/p6-inbox-dead-letter-replay.md)                        | 并入现有死信页；新 messageId + causationId，不改原死信               | 已完成                      |
| [云当网事件候选归一化](./planning/tasks/p6-trackingeyes-event-candidate.md)                    | 原始码形成不可自动过站的规范事件候选                                 | 已完成                      |
| [云当网接入、Inbox 与来源裁决](./planning/tasks/p6-trackingeyes-ingestion-authority.md)        | 原始载荷、消息幂等与来源资格裁决同事务留痕                           | 已完成                      |
| [工单完成写入 ClientOperation](./planning/tasks/p6-work-execution-client-operation.md)         | 完成工单落三阶段回执，work-execution 拥有                            | 已完成                      |
| [任务台接真实完成与三段回执](./planning/tasks/p6-task-workbench-complete-receipt.md)           | /real-tasks 完成工单，动作旁显示三阶段                               | 已完成                      |
| [本地迁移改为 deploy 对齐](./planning/tasks/p6-migrate-deploy-local.md)                        | db:migrate 走 deploy，避开影子库重放旧迁移                           | 已完成                      |
| [E2E 开发服务器回环对齐](./planning/tasks/p6-e2e-dev-server-loopback.md)                       | Vite 听全部回环；探测 127.0.0.1 与 localhost                         | 已完成                      |
| [EchoAiWorkflow 入参对齐](./planning/tasks/p6-echo-ai-workflow-input.md)                       | 入参改为 { message }，避免 Temporal 把对象当成 str                   | 已完成                      |
| [E2E 对齐真实任务导航](./planning/tasks/p6-e2e-visual-real-task-nav.md)                        | 侧栏「真实任务」用语义断言；壳层覆盖 /real-tasks                     | 已完成                      |
| [Inbox 死信重放修正载荷](./planning/tasks/p6-inbox-replay-payload-conflict.md)                 | 按 inbox/{id} 引用修正；新 messageId，不改原死信                     | 已完成                      |
| [补偿记录第一刀](./planning/tasks/p6-compensation-first-slice.md)                              | 已落账 ClientOperation 登记 pending 补偿，不执行反向事件             | 已完成                      |
| [补偿状态推进](./planning/tasks/p6-compensation-resolve.md)                                    | pending 推进到终态；失败可进人工复核                                 | 已完成                      |
| [按原操作列/读补偿](./planning/tasks/p6-list-compensations.md)                                 | 游标分页列出补偿，并可按 id 读取                                     | 已完成                      |
| [按租户列 ClientOperation](./planning/tasks/p6-list-client-operations.md)                      | GET /api/client-operations 按 GC-010 游标分页                        | 已完成                      |
| [同步操作薄页](./planning/tasks/p6-client-operation-ops-ui.md)                                 | /real-operations 列三阶段操作并展开补偿                              | 暂停                        |
| [作业 UI 与真实 API 合并](./planning/tasks/p6-workspace-api-ui-merge.md)                       | /tasks /containers 默认吃 API；演示仅 ?demo=1                        | 已完成                      |
| [作业壳人话与空模块](./planning/tasks/p6-workspace-ui-clarity.md)                              | 按职务命名；总览/流转去掉空 KPI 与空 RACI                            | 已完成                      |
| [货柜表空筛选回归](./planning/tasks/p6-container-list-empty-filter.md)                         | 无「全部」快筛时不得把已有货柜滤空                                   | 已完成                      |
| [作业壳页面清单登记](./planning/tasks/p6-workspace-ui-inventory.md)                            | 把页面定位与可补回块写成快照                                         | 已完成                      |
| [作业壳表面命名](./planning/tasks/p6-ui-surface-naming.md)                                     | UI-D09：干活/看档等表面用名                                          | 已完成                      |
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
