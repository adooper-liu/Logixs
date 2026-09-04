# 领域上下文与聚合边界（P2-01）

> 状态：**候选（初稿，待 P2 评审）** · v0.3 · 2026-09-04 · 负责人：刘志高。
> 关键决策（负责人已确认 2026-09-04）：① 导入文件「物流状态」文本列 = 该记录的**真实当前状态**（经字典归一后直接落 `currentStatus`）；
> ② 写入规则（细化）：匹配**主锚 = 备货单号**（唯一建档身份）命中已有记录则**更新**，否则**新建**；箱号与实际出运日期为迟绑定字段；
> ③ D-聚合 = **A：一行 = 一份货柜流转记录整体**。
> ④ 业务关系（2026-09-04，最新修正）：出运计划 1:N 备货单；**备货单 1:1 货柜**——**备货单号 = 唯一建档身份**（采购阶段为采购订单号 PO，备货阶段产生备货单号，先于箱号）；**箱号与实际出运日期均迟绑定**：装箱后与外部（船司/海关/拖车等）交换数据时才进入系统，备货/订舱阶段仅有预计出运日期；多箱 N:1 并成一个提单号（B/L 归组候选）；新增 ShipmentPlan 顶层聚合（§3.2）。
> 上游：`PRODUCT_BRIEF` / `GLOSSARY` / `IMPORT_WORKFLOW` / 架构 §6、§9、§10.3 / `MODULE_DEPENDENCIES` / 现状基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md)。
> 读者：领域评审者、P2 后续切片执行者、P3 领域包实现者、迁移实施者。

## 1. 目的与边界

给出泛物流首期、以「智能 Excel 导入与审核 → 落货柜流转记录业务事实」为锚点的领域上下文图、聚合清单与边界理由。
术语只使用 [`GLOSSARY`](../GLOSSARY.md) 口径；现状对象/字段以 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) 为准，本文不复制其正文。
依赖方向服从 `ENGINEERING_RULES` §3 与 `MODULE_DEPENDENCIES`：跨上下文只经公共端口、领域事件与共享契约。

## 2. 上下文图（首期切片）

```text
                 ┌──────────────────────────────────────────────┐
                 │              Identity（身份与权限）             │
                 │   租户 / 用户 / 角色权限 / 数据范围   [P2-05 细化] │
                 └──────┬───────────────────────┬──────────────┘
                        │ 用户/租户上下文          │ 授权判定
                        ▼                        ▼
┌──────────────┐   ┌─────────────────────────────────────────────┐
│ AI Governance│──▶│ Import（智能导入闭环）· ImportBatch 聚合根       │
│ 能力注册/    │   │  行=一货柜流转记录：批次/预检/审核/对账            │
│ 审批令牌      │   │  [P2-03]                                     │
│ [P2-11 细化] │   └────────────────────────────┬─────────────────┘
└──────────────┘                                 │ 只经公共端口（导入写入唯一通道）
                                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │ Shipment（货柜流转记录业务事实）· 聚合根          │
                 │  匹配键：备货单号；状态机                       │
                 │  [P2-02 本文]                                  │
                 └──────┬───────────────────────────┬──────────┘
                        │ 读取                       │ 读取
                        ▼                           ▼
                 ┌─────────────────────┐   ┌─────────────────────┐
                 │ Dictionary（主数据）  │   │ Audit（操作审计）      │
                 │ 港口/船司/柜型/仓库/币种│   │ 写操作留痕           │
                 │ /单位·未知值待处理队列   │   │ [P2-07 细化]         │
                 └─────────────────────┘   └─────────────────────┘
```

相邻上下文（本轮只登记边界）：`integration`（外部供应商 Adapter）、`exception-management`（异常处置）、
`notification`、`reporting`、`workflow`（Temporal 代理，应用层能力）。

## 3. 上下文职责与聚合清单

| 上下文 | 职责（Domain 层） | 聚合根（初稿） | 首期细节落点 |
| --- | --- | --- | --- |
| Identity | 租户隔离（A-01）、用户身份引用、角色权限与数据范围 | `Tenant`、`User`、`Role` | P2-05 |
| Dictionary | 港口/船司/柜型/仓库/币种/单位受控字典；别名归一；未知值进待处理队列 | `MasterDictionary`、`DictionaryUnknown` | P2-04 |
| **Shipment** | 拥有业务事实：出运计划 / 备货单 / 货柜流转记录 + 货柜状态机 | `ShipmentPlan`（出运计划）、`ContainerRecord`（货柜流转记录）、`ReplenishmentOrder`（备货单，独立但归属计划，见 §3.1/§3.2） | [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)（P2-02）、[SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md) |
| Import | 上传批次、逐行解析/预检/审核/对账编排域；不拥有业务事实 | `ImportBatch`（子：`ImportRow`、映射建议、预检、审核项） | [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)（P2-03） |
| AI Governance（横切） | AI 能力注册、风险分级/自动化模式、预算与审批令牌 | `AiCapability`、审批策略 | P2-11 |
| Audit（横切） | 写操作审计、前后值摘要 | 审计读模型 | P2-07 |

### 3.1 货柜流转记录聚合（ContainerRecord，D-聚合 = A，负责人已确认）

**对象事实**沿用 AS-IS（[AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §1.1）：一行导入信息覆盖一个货柜的一次完整流转。
**TO-BE 决策**：一行 = **一份货柜流转记录整体**；同箱号在不同备货单/出运日期下允许存在多条记录（各自独立状态）。

- 聚合根 **`ContainerRecord`（货柜流转记录）**：
  - 记录标识：系统内唯一 id（surrogate）；
  - **业务匹配键 = 主锚 `orderNumber`（备货单号，唯一建档身份）**；`containerNumber` 与**实际出运日期**均为**迟绑定字段**（装箱后与外部交换才进入；备货/订舱阶段仅有预计出运日期），已有时参与一致性判定；导入判定"更新 or 新建"见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §6；
  - 设备属性值对象组：箱号/箱型(→字典)/封号/皮重·总重/超限/危险品/持箱人等（AS-IS `biz_containers` 字段）；
  - `currentStatus`：当前物流状态（状态机正文见 P2-02）。**导入文件「物流状态」文本列 = 真实当前状态**（经字典归一后直接落值，见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6）。
  - 双键语义：领域记录主锚 = 备货单号；**装箱后→卸柜前对外交互以箱号**，卸柜完成后货物作业回到备货单号（详见 [CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md) §2.1）。
  - 属性/标记扩展：多变特征（危险品/需植检/含致冷剂等）用**受控标记集合**承载并触发动作，不逐特征加列（详见 [CONTAINER_MARKERS](./CONTAINER_MARKERS.md)）。
- 聚合内组合（整份不可分离，随记录一起校验/审核/写入/回滚）：
  - **航次上下文**（≈ AS-IS `process_sea_freight`：船司/船名航次/起运·目的港/单证/预计实际时间/费用币种）；
  - **港口作业序列**（≈ AS-IS `process_port_operations`，`origin/transit/destination` + 顺序；各港时间/清关/免费期）；
  - **运营后段**（≈ AS-IS `process_trucking_transport` + `warehouse_operations` + `empty_returns`：拖卡提柜/派送、仓库卸柜/开箱、还空箱）。
- `ReplenishmentOrder`（备货单）：**独立聚合**（订单生命周期独立），与记录以 `orderNumber` 业务编号关联，不做字符串互指（修 AS-IS A9）。
- 物理箱设备主数据（箱号的唯一设备属性）本期**不单列聚合**：设备属性随每条记录冗余；若未来需要资产/堆场管理再拆（评审跟踪项）。

> 相比 AS-IS「一箱一当前航次、箱号唯一」：TO-BE 允许同箱号多条（不同备货单/出运）并放宽唯一约束；这是对现网无"同箱多航次历史"建模的扩展（负责人已确认按匹配键更新/新建）。

### 3.2 出运计划（ShipmentPlan）与全链关系（负责人已确认 2026-09-04）

顶层 **`ShipmentPlan`（出运计划）聚合**把整票串起：1 计划 → N 备货单（`ReplenishmentOrder`，独立聚合但归属计划）→ 每张备货单对应**一条**货柜流转记录（**一单一柜 1:1**：备货单号为备货阶段唯一建档身份，采购阶段为采购订单号 PO；**箱号与实际出运日期均为迟绑定**——装箱后与外部交换才进入，早期仅有预计出运日期）；多箱按票**并成一个提单号**（B/L 归组，候选）。计划另 1:N 订舱（Booking，首期候选）。匹配主锚 = **备货单号**。装箱定稿点产生真实重量/件数/封号 → 同记录走**更新**而非仅新建。流程与状态映射详见 [SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md)；ShipmentPlan 是否进首期导入目标对象默认**否**（首期 = 箱级导入）。

## 4. 聚合边界理由

1. **货柜流转记录 = 状态机与业务事实载体**：`currentStatus` 与整份流转内容同生命周期；Import 只提供入口（建档/更新），不直接改。
2. **ImportBatch 独立聚合根**：一次上传及逐行生命周期共享统一状态机与审批/预检硬闸；批次失败/取消不牵连已落库业务事实。
3. **ReplenishmentOrder 独立**：订单（备货/客户）生命周期与货柜流转相互独立，仅以业务编号关联。
4. **Dictionary 独立演进**：港口/船司/柜型别名与币种/单位规则被 Import（归一）与 Shipment（校验/展示）共用；未知值单列 `DictionaryUnknown`（修 A1/A2）。
5. **Identity 只提供判定**：租户与授权由服务端执行，Domain 仅依赖「当前用户上下文」入参。

跨聚合一律以 ID/业务键引用，禁止跨聚合对象引用；`ImportRow` 持有解析出的匹配键与计划写入内容，而非 `ContainerRecord` 实体引用。

## 5. 公共端口（跨上下文怎么走）

| 调用方 | 端口 | 说明 |
| --- | --- | --- |
| Import → Shipment | Shipment Application 用例（候选名 `applyContainerRecordPlan`） | **导入写入唯一通道**：应用层在「预检通过 + 审核完成 + 幂等确认」后按匹配键执行**更新或新建**（见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §6）。Import 不直接持 Shipment 仓储 |
| Import → Dictionary | 主数据解析/归一端口（code/别名命中，未命中返回 unknown） | AI 仅产建议；确定性归一/校验在 Domain |
| Import/Shipment → Identity | 用户/租户上下文 + 授权判定 | 服务端授权 |
| Shipment → Dictionary | 港口/船司/柜型引用解析端口 | 校验与展示 |
| → AI Governance | AI 调用前置治理 | 业务模块不直连模型供应商 |
| 各写操作 → Audit | 审计端口 | P2-07 细化 |

## 6. 业务事实 / AI 产物 / 审核 / 执行 的可区分与追踪（P2 门禁锚点）

| 概念 | 存放 | 关联 |
| --- | --- | --- |
| AI 产物（映射建议） | `ImportRow` 建议对象 | 源列→标准字段、证据、置信、provenance |
| 审核结果 | 同批次审核项 | 指向 AI 产物；记录操作者/原因 |
| 最终执行结果 | `ImportRow` 执行结果 | 成功行携带记录 id 与业务匹配键（回查） |
| 业务事实 | `ContainerRecord` 聚合 | 由唯一写端口建立/更新；记录来源批次与操作者 |

单向可追踪：任意业务事实 → 来源批次/行 → 审核记录 → AI 产物 →（可选）AI 观测。详见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §7。

## 7. 决策记录与待评审

### 已确认（2026-09-04，负责人）

- D-import-status：导入文件「物流状态」文本列 = 真实当前状态。
- D-write（细化）：匹配主锚 = 备货单号（唯一建档身份）命中 → 更新；否则新建。箱号与实际出运日期迟绑定，见 §3.1/§3.2。
- D-聚合：A（一行 = 一份货柜流转记录整体；拖卡/仓库/还箱在聚合内）。
- 业务关系（修正 2026-09-04）：出运计划 1:N 备货单；**备货单 1:1 货柜**——备货单号为备货阶段唯一建档身份（采购阶段=采购订单号 PO，先于箱号）；**箱号与实际出运日期迟绑定**（装箱后外部交换才进入；早期仅预计出运日期）；多箱 N:1 并成一提单号（归组候选）；新增 ShipmentPlan 聚合（§3.2 / [SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md)）。

### 仍待评审

- D-portname：Shipment 写端口最终命名（候选 `applyContainerRecordPlan`）。
- 预计出运日期（备货/订舱阶段）与实际出运日期（装箱后迟绑定）的分列与采集口径。
- ShipmentPlan / Booking 模块落点与是否进首期导入目标对象（默认否，见 SHIPMENT_FLOW_OVERVIEW §6）。
- 状态口径（取消/投影/跳步）相关：见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §7。

## 8. 关联与维护

- 上链：任务 brief `docs/planning/tasks/p2-shipment-import-domain.md`；P2-01；[AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md)。
- 派生：[SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md)、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)。
- 变更须评审；触发架构 §19 需新增 ADR；维护纪律见 `ENGINEERING_RULES` §12。
