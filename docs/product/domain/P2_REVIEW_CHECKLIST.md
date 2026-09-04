# P2 切片一 · 评审清单（P2-01~03 + 领域流程/生命周期/契约输入）

> 状态：**评审清单** · v1 · 2026-09-04 · 评审人：刘志高（负责人）。
> 用途：汇总本批 P2 候选文档，逐份给出「要点 / 评审重点 / 待确认项 / 影响后续」，供快速验收。
> 门禁：评审通过前，清单 P2-01~03 复选框保持 `[ ]`；完成后按任务 brief `p2-shipment-import-domain.md` 更新状态。
> 本清单只做**导航与核对**，不复制各文档正文（单一真相，见 `ENGINEERING_RULES` §12）。

## 1. 本批已确认决策（评审时一并核对是否认可）

| # | 决策 | 出处 |
| --- | --- | --- |
| D1 | 导入文件「物流状态」文本列 = 记录**真实当前状态**（`已取消→cancelled` 不折成 not_shipped） | CONTAINER_STATUS_MODEL §6 |
| D2 | 记录主锚 = **备货单号**（备货阶段唯一建档身份；采购阶段=采购订单号 PO） | 各领域文档 |
| D3 | **箱号与实际出运日期迟绑定**（装箱后与外部交换才进入系统）；建档可两者皆无 | CONTAINER_LIFECYCLE / IMPORT_DOMAIN_MODEL |
| D4 | D-聚合 = A：一行 = 一份货柜流转记录整体（ContainerRecord，一单一柜 1:1） | CONTEXT_MAP §3.1 |
| D5 | 交互身份切换：①④ 备货单号、②③ 箱号；卸柜后备货单号重新激活 | CONTAINER_LIFECYCLE §3 |
| D6 | 外部集成边界：备货←计划系统(先导入后直连)、海运段←海关/港口/航司/飞驼、提柜段←运输公司、卸柜后←WMS；手工兜底 | INTEGRATION_BOUNDARIES |
| D7 | 来源权威：手工最高(锁)；导入首次/冲突填充优先，可被 二次导入/手工/API 更新；API 可被三者更新 | INTEGRATION_BOUNDARIES §3.1 |
| D8 | 时间/状态链：单调 `≥`、状态不回退、**密封历史不可回改**、写前验证序列、初建可整链回填 | LIFECYCLE_CONSISTENCY |
| D9 | 阶段链定稿：14 节点主链 + 入库归 WMS（装箱/出运/离港分开、清关单列、卸空独立） | LIFECYCLE_CONSISTENCY §2 |
| D10 | ④ 范围：卸柜后仓库作业（收货/上架/库存）归 WMS，Logix 收卸柜完成/还箱确认 | INTEGRATION_BOUNDARIES |
| D11 | 状态机驱动 + 可配置：货柜全生命周期变化以状态机为核心；状态/转换受控配置；禁死代码分支 | ENGINEERING_RULES §3.3 / CONTAINER_STATUS_MODEL §1.1 |
| D12 | 固定标识 + 映射字典 + 属性标记扩展：代码内状态/事件名固定；外部经映射字典归一；扩展用属性/标记字段而非逐次加列 | ENGINEERING_RULES §3.3 / CONTAINER_STATUS_MODEL §1.1 |
| D13 | 标记→动作触发：多变业务特征（危险品/需植检/含致冷剂/超限等）落在受控标记集合上，标记与动作/校验/卫式/文档绑定数据驱动可配置；新增标记不触发代码改动与加列 | ENGINEERING_RULES §3.3 / [CONTAINER_MARKERS](CONTAINER_MARKERS.md) |
| D14 | 状态推进动作（confirm_*）默认二次确认/可撤销窗口（防 R3 密封误点）——负责人采纳 2026-09-04 | ACTION_CATALOG / 评审 A3 |

## 2. 逐份评审项

| 文档 | 覆盖 | 内容要点 | 评审重点（请核对） | 待确认项 | 影响后续 |
| --- | --- | --- | --- | --- | --- |
| [AS_IS_LEGACY_BASELINE](AS_IS_LEGACY_BASELINE.md) | 设计输入 | 现网系统审计快照：三层状态/字段目录/导入现状/反例 A1–A9 | 字段目录与真实业务表是否对齐；A 清单是否漏项 | 快照 commit `acfb50a8` 是否仍为最新可用基线 | P2-04/06/12、迁移 |
| [SHIPMENT_FLOW_OVERVIEW](SHIPMENT_FLOW_OVERVIEW.md) | 流程 | 出运计划 ShipmentPlan 顶层；采购(PO)/备货/箱/提单 关系与时序 | 计划→单→箱→提单 关系；ShipmentPlan 是否进首期导入对象 | B/L 归组建模与否；ShipmentPlan/Booking 模块落点 | CONTEXT_MAP、P2-06 |
| [CONTEXT_MAP](CONTEXT_MAP.md) | P2-01 | 上下文图/聚合（ShipmentPlan、ContainerRecord、ImportBatch 等）/端口 | 聚合边界与写端口命名；双键语义 | D-portname；ShipmentPlan 归属 | P3 领域包、P2-06 |
| [CONTAINER_STATUS_MODEL](CONTAINER_STATUS_MODEL.md) | P2-02 | 状态词汇(AS-IS 复用+取消)；转换表；投影 vs 事件；异常正交 | 状态清单/跳步/取消与异常口径；投影策略 | D-proj/D-alert/D-transition-skip | P2-09 契约、阶段二 events |
| [CONTAINER_LIFECYCLE](CONTAINER_LIFECYCLE.md) | 生命周期 | 14 节点阶段链 + 数据锚 + 交互身份切换 + 入库归 WMS | 阶段/状态/时间字段映射；清关放行先于拖卡 | 海铁多段路由；阶段二事件源 | P2-06/09、阶段二 |
| [IMPORT_DOMAIN_MODEL](IMPORT_DOMAIN_MODEL.md) | P2-03 | ImportBatch 聚合/行/预检/审核/对账；匹配键=备货单号 | 行级判定与批次幂等；四类结果区分 | D7/D8（批次次序/升级路径） | P2-06/09、P6 |
| [TARGET_FIELD_CATALOG](TARGET_FIELD_CATALOG.md) | §8 模板锚 | 首批标准字段 v0.2（A–E 分节，真实字段为底） | 字段集/必填硬闸/关键字段(P7) 与真实 Excel 样本核对 | 用 1–2 份真实脱敏样本回验 | P2-04/06/10/12、P7 |
| [INTEGRATION_BOUNDARIES](INTEGRATION_BOUNDARIES.md) | 集成边界 | 外部对象矩阵/渠道分级/来源权威矩阵 | 渠道与权威矩阵；多源到同一字段行为 | 字段级授权细化；对接协议 | P5、阶段二 Adapter |
| [LIFECYCLE_CONSISTENCY](LIFECYCLE_CONSISTENCY.md) | 一致性 | 规范链 L；R1–R6 规则（单调/密封/写前验证/来源相交） | 规则可执行性；密封粒度 | R1 等值 or 严格递增；R3 密封粒度 | P2-06/09、P6 写入校验 |
| [p2-shipment-import-domain.md](../../planning/tasks/p2-shipment-import-domain.md) | 载体 | 任务 brief（状态/方案/决策记录/进度 v1–v13） | 决策记录与验收项是否完备 | — | 评审与门禁 |

## 3. 全局待确认（跨文档开放项）

- **AS-IS 对照发现（2026-09-04）**：现网有适配器故障转移/通用字典别名/WMS 状态字段/HOLD·费用对象/监控资产，评审清单需回查 5 项（集成冗余、字段级迁移映射、来源枚举、扣货费用与出库逆向收边、备货单字段细化）——详见 [ASIS_TOBE_GAP](./ASIS_TOBE_GAP.md)。
- **行业规范纠偏 W1–W8（2026-09-04）**：外部 15 页规范对标后待采纳项（事件信封/isEsti、上下文复合映射键、分域跟踪、港口能力差异、放行查验深化、进口链路里程碑、订阅邮件交付、状态码场景化）——详见 [INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) 附录 B。
- D-portname：Shipment 写端口命名（候选 `applyContainerRecordPlan`）。
- 字段级授权细化（导入/API 是否按字段类型分权，见 INTEGRATION_BOUNDARIES §4）。
- R1 等值时间允许 or 严格递增；R3 密封时间粒度（LIFECYCLE_CONSISTENCY §6）。
- 海铁/中转多段路由表达深度（CONTAINER_LIFECYCLE §6）。
- ShipmentPlan/Booking 是否进首期导入对象、模块落点（默认否/后续切片）。
- 节点 planned/actual 时间字段候选集（随 P2-06 逐节点定）。
- 各字典别名初始化范围与首批外部接入清单（P2-04/P2-12/阶段二）。

### 3.1 AS-IS 对照行动待办（源自 [ASIS_TOBE_GAP](./ASIS_TOBE_GAP.md) §5，负责人可逐条勾选）

| # | 行动 | 落点文档 / 阶段 | 关闭条件 | 状态 |
| --- | --- | --- | --- | --- |
| G1 | **集成冗余与故障转移设计**：现网 AdapterManager 模式继承 + 统一事件信封 + 订阅/查询双通道 + 降级矩阵 —— 初稿见 [INTEGRATION_REDUNDANCY](./INTEGRATION_REDUNDANCY.md) | INTEGRATION_REDUNDANCY / 阶段二 | 初稿产出；与架构一致后评审 | ◐ 初稿 |
| G2 | **字段级迁移映射 = P2-06 首任务**：现网 6 流程表 + dict 框架 + wms 状态字段 → ContainerRecord/标准字段 的字段级映射表（含币种、DATE/TIMESTAMP→UTC·ISO、迟绑定、source） | P2-06 / [TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md) | 映射表产出并评审；覆盖 A6/A8 | ☐ |
| G3 | **来源枚举绑定 D7**：统一 source 枚举**初值已列**（INTEGRATION §3.2）；D7 权威矩阵逐格绑定；值级来源+引用留审计 | INTEGRATION_BOUNDARIES §3.2 / GLOSSARY / 契约 | 初值列 → 权威化进 GLOSSARY/契约（P2-09） | ◐ 初稿 |
| G4 | **费用/出库逆向收边**：**滞港费费用管理已定为核心（PRINCIPLES P4）**；其余费用（扣货罚款等）与出库/逆向（warehouse OUTBOUND、trucking POST_SHIPMENT）待显式收边 | PRINCIPLES §1 / PRODUCT_BRIEF §4 / exception | 其余费用+出库逆向给出"纳入阶段/明确不做"结论 | ◐ 部分收口 |
| G5 | **备货单/PO 字段细化**：ShipmentPlan→备货单 字段层（customer/country、金额+币种修 A6、PO/wayfair_spo、main_order、期望出运），衔接计划层数据模型与导入模板 | SHIPMENT_FLOW_OVERVIEW / P2-04 / P2-06 | 计划层字段目录产出；币种约束落地 | ☐ |

## 4. 评审记录（负责人勾选）

| 文档 | 结论（请勾） | 备注/待改（对抗评审 A/H 已应用项 + 遗留） | 评审日期 |
| --- | --- | --- | --- |
| AS_IS_LEGACY_BASELINE | ☐ 通过 ☐ 需改 | 已补：sys_/demurrage、身份半成品、ATA 语义注记；待：快照 commit 复核 | |
| SHIPMENT_FLOW_OVERVIEW | ☐ 通过 ☐ 需改 | 已改：箱-单澄清/主备货单号语义、PO 与备货阶段、迟绑定；待：ShipmentPlan/B·L 归属候选 | |
| CONTEXT_MAP（P2-01） | ☐ 通过 ☐ 需改 | 已改：D 决策与澄清同步；待：D-portname、ShipmentPlan 模块落点 | |
| CONTAINER_STATUS_MODEL（P2-02） | ☐ 通过 ☐ 需改 | 已改：五主体含海事 MCRP、取消/投影/异常正交；待：D-proj/D-alert/跳步 | |
| CONTAINER_LIFECYCLE | ☐ 通过 ☐ 需改 | 已改：14 节点/入库归WMS/子里程碑候选；待：海铁多段 | |
| IMPORT_DOMAIN_MODEL（P2-03） | ☐ 通过 ☐ 需改 | 已改：一单一柜不变量、匹配主锚=备货单号；待：D7/D8（批次次序/升级） | |
| TARGET_FIELD_CATALOG | ☐ 通过 ☐ 需改 | 已改：柜型标准码、orderNumber 主锚、迟绑定标注；待：真实样本回验 | |
| INTEGRATION_BOUNDARIES | ☐ 通过 ☐ 需改 | 已改：source 枚举初值(§3.2)、来源权威；待：G1 集成冗余设计 | |
| LIFECYCLE_CONSISTENCY | ☐ 通过 ☐ 需改 | 已改：R0 时间术语、A6 出运/离港语义；待：R1 等值/密封粒度 | |
| 任务 brief / 本清单 | ☐ 通过 ☐ 需改 | 决策 D1–D14、A/H 已闭环、G 初稿并；待：负责人终勾 | |

> 评审通过后动作：按勾选回写各文档结论 → 更新 P2-01~03 清单复选框（附链接）→ GLOSSARY 术语已同步（§5）→ brief 状态推进。
> 注：以上"已改"项均已在评审/澄清过程中应用；勾"通过"即代表认可当前候选版本。

## 5. 关联与维护

- 本清单消费者：负责人（P2 评审）、P2 后续切片执行者。评审完成即更新 §4 并视需回写 §1–§3。
- 维护纪律见 `ENGINEERING_RULES` §12；评审门禁见 §13。
