# P2 切片一 · 一页总览（领域模型 + 治理）

> 状态：**候选·待负责人评审勾选** · 2026-09-04 · 任务载体：`p2-shipment-import-domain.md`。
> 覆盖：P2-01~03 + 流程/生命周期/标记/动作/PDCA/契约草案；本页为对外/向上同步摘要，细节见各链接。

## 1. 四项产品原则（不可漂移）
P1 可视化（单屏全生命周期 + 一键动作）· P2 任务驱动·闭环(PDCA) · P3 货柜全生命周期管理 · **P4 费用管理（滞港费）纳入核心**。

## 2. 关键业务口径（已确认，D1–D14 子集）
- **一备货单 → 一货柜(1:1)；一提单(B/L) → 多货柜**；「主备货单号」= 票级任取代表，**不作键**（曾致误解）。
- 记录主锚 = **备货单号**（备货阶段唯一身份；采购阶段为 PO）；箱号/实际出运日期**迟绑定**（装箱后与外部交换才进入）。
- 生命周期主链 14 节点（备货…装箱·出运·离港·海运·[中转]·清关·到港·[海铁]·拖卡·送仓·卸柜·卸空·还箱）；入库归 WMS。
- 时间标准 `S/E/A × TD/TA`（预计≠计划）；单调+密封：下一节点时间≥前一、越过即不可回改历史。
- 来源权威：手工(锁)最高 → 导入首次/冲突优先 → API；按值记录 source。
- 状态机为核可配置；代码名固定、外部经映射字典；多变特征用受控**标记**（危险品/植检/致冷剂/超限…触发动作）；扩展用属性不逐次加列。

## 3. 评审状态（对抗式自查 已闭环）
- 矛盾 A1–A7：**全部澄清或收口**（箱-单基数=主备货单号误解；阈值=候选；confirm 默认二次确认；出运≤离港…）。
- AI 虚幻 H1–H8：已软化/处理（如"19 种事件码"改按 API 枚举为准）。
- 决策 **D1–D14**；AS-IS 行动 **G1–G5**（G2 字段映射/逻辑模型已厚；G3 source 初值；G4 滞港费核心）；行业纠偏 **W1–W14** 待采纳。

## 4. 文档地图（docs/product/domain + product）
- 模型：CONTEXT_MAP(P2-01) / CONTAINER_STATUS_MODEL(P2-02) / IMPORT_DOMAIN_MODEL(P2-03) / CONTAINER_LIFECYCLE / LIFECYCLE_CONSISTENCY / DATA_MODEL_P2-06 / FIELD_MIGRATION_MAP / DATA_CLEANUP_ORDER_CONTAINER / CONTRACTS_DRAFT
- 能力：CONTAINER_MARKERS / MARKER_CATALOG / ACTION_CATALOG / UX_CONTAINER_WORKBENCH / NODE_PDCA(+VALIDATION) / INTEGRATION_BOUNDARIES
- 治理：GLOSSARY(+§5) / PRINCIPLES / P2_REVIEW_CHECKLIST / PROPOSAL_SELF_AUDIT / ASIS_TOBE_GAP / INDUSTRY_STANDARDS_ALIGN / AS_IS snapshot

## 5. 下一步（P2 后续/进入实现前）
1. 负责人按评审清单 §4 终勾（把候选转正式/标注待改）。
2. GLOSSARY/术语 → P3 `packages/contracts` 契约实例化（含 Parity）。
3. P2-06 schema/迁移 + 箱-单数据清洗（DATA_CLEANUP 首任务）。
4. P2-12 真实脱敏样本采集（回验字段/阈值）。
5. P2-04/05/07 与 P2-08~11 契约切片依序推进。
6. P3 仓库底座（git/pnpm/turborepo/validate），随后 P6 纵向闭环承载 UX V1。

> 门禁：P2 门禁（业务事实/AI 产物/审核/执行四类可区分可追踪）在领域文档已定义，待实现验证。
