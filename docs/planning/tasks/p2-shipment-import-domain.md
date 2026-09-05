---
status: design          # design | coding | review | fix | blocked | done（机器可校验）
branch:                 # git 初始化后填：feat/<任务名>（RAID I-04 / P3-01）
---

# 任务：P2 切片一——货柜/舱单导入闭环领域模型（P2-01~03 + 首批字段模板锚点）

> 唯一交接载体。状态以顶部 frontmatter `status` / `branch` 为准，只改 frontmatter，不另写自由文本状态。
> 同一时刻仅一个进行中任务；`done` 必须附验证证据，未验收不得标 `done`。

## 目标

在写迁移/控制器/页面之前，把首个纵向闭环「智能 Excel 导入与审核」的领域语义定稿为可评审文档。
锚点 = 首批目标对象「货柜全流程信息表」（2026-09-04 已确认货柜/舱单取向），并**以现网系统
`D:/Github/logix`（状态机与货柜字段）为 AS-IS 真实基线**，产出 P2-01（上下文与聚合）、P2-02（货柜状态模型）、
P2-03（导入批次/行/预检/审核）、首批标准字段模板（对应 IMPORT_WORKFLOW §8 跟踪项 #2）。

## 边界 / 不做（本切片不越界）

- 只产出**设计文档**，不建包/代码/迁移/目录骨架（`packages/*` 实例化属 P3-05）。
- P2-04 主数据治理、P2-05 租户/角色/权限、P2-06/07 数据模型与审计、P2-08~11 契约、P2-12 样本——各自独立后续切片。
- AS-IS 内容只做**审计快照**（单一权威在 `AS_IS_LEGACY_BASELINE.md`），不随 Logixs 文档复制扩散。
- 权威约束不得改写：`ENGINEERING_RULES` §3/§7、`AGENTS.md`、架构 §6/§8/§9/§10.3、`MODULE_DEPENDENCIES`、`GLOSSARY`。

## 验收（review 阶段核对）

- [ ] 领域文档与既有基线一致：术语只用 `GLOSSARY` 口径；状态机正文单一权威，跨文档只引用。
- [ ] 真实代码/字段事实只记录在 AS-IS 快照一处；P2 文档引用而非复制；快照头部 commit 留痕有效。
- [ ] 业务事实 / AI 产物 / 审核结果 / 最终执行结果 四类可明确区分并单向追踪（P2 门禁）。
- [ ] 状态模型覆盖 AS-IS 反例修复（取消态、异常折叠、投影 vs 事件、无静默回退）均有落点。
- [ ] 首批字段模板 v0.1 字段带类型/必填/字典或语义来源/关键字段/唯一键；基于真实字段而非臆造。
- [ ] `docs/README.md` 登记新文档与其读者；相对链接可解析（自检）。
- [ ] 设计评审记录与清单 P2-01~03 追踪更新（评审通过前复选框保持 `[ ]`）。

## 方案（design 阶段填写）

### 真实基线（AS-IS）

- 源仓库：`D:/Github/logix` @ `main acfb50a8`（2026-03-03；工作树含未提交改动，以读取时为准）。
- 快照单一真相：`docs/product/domain/AS_IS_LEGACY_BASELINE.md`（三层状态、映射/折叠、推导算法、四类表字段目录、
  Excel 导入现状、反例 A1–A9 与迁移注意）。

### 产物文件

| 清单项 | 文档 | 内容 |
| --- | --- | --- |
| — | `AS_IS_LEGACY_BASELINE.md` | 现网系统审计快照（状态机 + 货柜字段 + 导入现状），Logixs 设计输入 |
| P2-01 | `CONTEXT_MAP.md` | 上下文图、聚合（Container 聚合根 + 备货单/批次）、边界理由、公共端口 |
| P2-02 | `CONTAINER_STATUS_MODEL.md` | 货柜状态模型（复用 7 简化层 + 补取消）、合法转换、投影 vs 事件、异常正交 |
| P2-03 | `IMPORT_DOMAIN_MODEL.md` | ImportBatch 聚合、行=一货柜全流程信息、预检/审核/对账、四类结果区分 |
| §8#2 | `TARGET_FIELD_CATALOG.md` | 首批目标对象「货柜全流程信息」标准字段 v0.1（真实字段为底） |
| — | `SHIPMENT_FLOW_OVERVIEW.md` | 出运全流程分析（计划→订舱→装箱→出运）与 ShipmentPlan 顶层对象（负责人确认箱-单关系：一单一柜等） |
| — | `CONTAINER_LIFECYCLE.md` | 货柜全生命周期（备货→装箱→离港→海运→[中转港]→清关→到港→[海铁联运]→提柜→拖卡送仓→卸柜→还箱）阶段链与数据锚 |
| — | `INTEGRATION_BOUNDARIES.md` | 外部数据源与集成边界：备货单←计划系统（先导入后直连）、海运段←海关/港口/航司/飞驼等 API、提柜段←运输公司、卸柜后←WMS；手工兜底；来源权威矩阵（手工锁/导入/API） |
| — | `LIFECYCLE_CONSISTENCY.md` | 时间/状态链一致性：阶段对齐草案 + 单调/密封/写前验证等规则；导入首次优先、手工锁、历史不可回改 |
| — | `P2_REVIEW_CHECKLIST.md` | P2 切片一评审清单：已确认决策 D1–D14、逐份评审项、全局待确认、AS-IS 行动待办 G1–G5、负责人勾选记录 |
| — | `DATA_CLEANUP_ORDER_CONTAINER.md` | 备货单-货柜关系清洗与校验细则（P2-06 首任务）：一备货单≤一柜、主备货单号不作键、提单归组、检测 SQL、受审计清洗步骤 |
| — | `CONTAINER_MARKERS.md` | 货柜标记与动作触发：多变特征落受控标记集合（危险品/植检/致冷剂/超限…），标记→动作/校验/卫式数据驱动绑定，新标记不改代码不加列 |
| — | `docs/product/UX_CONTAINER_WORKBENCH.md` | 货柜工作台 UX 拆解：全生命周期单屏可视化（rail/节点/标记/异常/动作中心）+ 动作推导与一键执行；V1 随 P6 |
| — | `ACTION_CATALOG.md` | 动作目录 v0.1：confirm/标记驱动/指令派单/邮件通知/异常审核 组 A–E 的 actionCode（触发/载荷/权限/二次确认） |
| — | `MARKER_CATALOG.md` | 标记字典初值 v0.1：dangerous_goods/phytosanitary/refrigerant/over_limit/打托/装配/查验 的聚合规则与关联动作 |
| — | `NODE_PDCA.md` | 关键节点 PDCA：通用模板 P/D/C/A + 8 个关键节点（备货就绪/装箱/出运/离港/在途中转/清关/到港提柜/卸空还箱）的要素·动作·输入输出·风险预警 |

### 关键设计决策（已确认 2026-09-04，负责人；未确认项待评审）

已确认：

- D-import-status：文件「物流状态」文本列 = 真实当前状态（CONTAINER_STATUS_MODEL §6）。
- D-write（2026-09-04 细化）：匹配**主锚 = 备货单号**（备货阶段唯一建档身份；采购阶段=采购订单号 PO）；命中→更新，否则新建（IMPORT_DOMAIN_MODEL §6.2 / TARGET_FIELD_CATALOG §3）。
- **箱号与实际出运日期均迟绑定**：装箱后与外部（船司/海关/拖车等）交换数据时才进入系统；建档可两者皆无，备货/订舱阶段仅有预计出运日期（SHIPMENT_FLOW_OVERVIEW §3）。
- D-聚合 = A：一行 = 一份货柜流转记录（ContainerRecord）整体，拖卡/仓库/还箱在聚合内（CONTEXT_MAP §3.1）。
- D-history：同箱多航次建模问题随之解决（记录非物理箱唯一）。
- 业务关系（修正 2026-09-04）：出运计划 1:N 备货单；**备货单 1:1 货柜**（备货单号唯一、先于箱号产生）；多箱 N:1 并成一提单号（B/L 归组候选）；新增 ShipmentPlan 顶层聚合（CONTEXT_MAP §3.2 / SHIPMENT_FLOW_OVERVIEW）；ShipmentPlan 是否进首期导入对象默认否。

仍待评审：

- D-proj / D-alert / D-transition-skip（CONTAINER_STATUS_MODEL §7）。
- D7 / D8（批次状态次序对齐 / 审核升级路径）。
- 字段必填与关键字段口径（TARGET_FIELD_CATALOG §4/§5）。
- D-portname：写端口命名（候选 `applyContainerRecordPlan`）。

### 步骤

1. 建 brief（本文档）；固定 AS-IS 源 commit。
2. 产 AS-IS 快照 → CONTEXT_MAP → CONTAINER_STATUS_MODEL → IMPORT_DOMAIN_MODEL → TARGET_FIELD_CATALOG，交叉引用不复制正文。
3. `docs/README.md` 登记新文档与消费链。
4. 一致性 + markdownlint 自检；提交 review 评审（不自行标 done）。

## Review notes（review 阶段填写，只读不改代码）

（待评审）

## 进度 log（谁改谁 append，一行一条）

| 日期 | 阶段 | 负责 | commit | 说明 |
| --- | --- | --- | --- | --- |
| 2026-09-04 | design | Claude | — | 初稿 v1：锚点确认（货柜/舱单）；产出 CONTEXT_MAP / CONTAINER_STATUS_MODEL / IMPORT_DOMAIN_MODEL 臆造状态集 |
| 2026-09-04 | design | Claude | — | v2 按真实代码重写：固定 D:/Github/logix @ acfb50a8；新增 AS-IS 快照 + TARGET_FIELD_CATALOG；三份 P2 文档改以真实状态/字段为基 |
| 2026-09-04 | design | Claude | — | v3 负责人确认三项决策：①物流状态文本列=真实当前状态；②行级匹配键=箱号+备货单号+出运日期（命中更新/否则新建）；③D-聚合=A（一行=一份货柜流转记录整体）。已同步写入 CONTEXT_MAP / CONTAINER_STATUS_MODEL / IMPORT_DOMAIN_MODEL / TARGET_FIELD_CATALOG；待确认 D-date-key |
| 2026-09-04 | design | Claude | — | v4 业务流程分析与模型：负责人补述全流程（出运计划→备货单→订舱→提空箱→装箱→出运）；确认箱-单关系；新增 SHIPMENT_FLOW_OVERVIEW + CONTEXT_MAP 补 ShipmentPlan 顶层聚合；预出运阶段状态列入状态模型待评审 |
| 2026-09-04 | design | Claude | — | v5 箱-单关系修正：备货单号=唯一编号、**一单一柜(1:1)**、单号先于箱号产生、多箱并成一提单号（B/L 归组候选）。同步 CONTEXT_MAP / SHIPMENT_FLOW_OVERVIEW / IMPORT_DOMAIN_MODEL / TARGET_FIELD_CATALOG / brief |
| 2026-09-04 | design | Claude | — | v6 箱号迟绑定：箱号在备货单装箱后与外部（船司/海关/拖车等）交换数据时才进入系统；建档可无箱号，匹配主锚=备货单号+出运日期，箱号参与一致性判定。同步五份文档 |
| 2026-09-04 | design | Claude | — | v7 术语修正：采购阶段=采购订单号(PO)；备货单号=备货阶段建档身份。SHIPMENT_FLOW_OVERVIEW 措辞同步 |
| 2026-09-04 | design | Claude | — | v8 出运日期迟绑定确认：实际出运日期与箱号一样装箱后外部交换才产生；匹配主锚收敛为**备货单号**（不再含出运日期）；预计/实际出运分列。同步 CONTEXT_MAP / IMPORT_DOMAIN_MODEL / SHIPMENT_FLOW_OVERVIEW / TARGET_FIELD_CATALOG；D-date-key 撤销 |
| 2026-09-04 | design | Claude | — | v10 交互身份切换规则（负责人）：装箱后→卸柜前对外交互只能用**箱号**（备货单号不可用）；卸柜完成进上架/库存后备货单号重新激活；隐含货物/订单与设备/运输两条子生命周期。落 CONTAINER_LIFECYCLE §2.1 与 CONTEXT_MAP §3.1 |
| 2026-09-04 | design | Claude | — | v14 AS-IS vs TO-BE 对照审计（ASIS_TOBE_GAP）：识别现网可复用资产（适配器主备/故障转移、通用字典别名、来源枚举、WMS 状态字段、HOLD/费用对象、监控）与 TO-BE 漏点 5 项；已并入评审清单 §3 待复核 |
| 2026-09-05 | design | Claude | — | v48 UX_CONTAINER_WORKBENCH 增 1.1–1.3：聚焦对象单界面全览(不碎片)；按时间链+状态机构视觉路径所见即所得；节点 正常/预警/风险 三态 + 行动建议 + 闭环操作；全局→中观→微观 三层可视化层级与渐进披露不淹没 |
