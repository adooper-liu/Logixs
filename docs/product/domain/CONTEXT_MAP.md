# 领域上下文与聚合边界（CONTEXT_MAP · v1.3）

> 状态：**已定边界 v1.3；Shipment 物理模型待评审** · 2026-09-23 · 负责人：刘志高。
> 一句话：把系统切成几块，说清每块管什么数据、和别块怎么传，谁也不能越界直连。
> 依据：MODULE_DEPENDENCIES（模块→公共入口）、ENGINEERING §3（依赖方向）、GLOSSARY、VISION 产品边界（货柜收端+WMS 对接+控制塔）。
> Shipment 目标模型与当前实现差异见 [`POST_DEPARTURE_CORE_MODEL_GAP_V1`](./POST_DEPARTURE_CORE_MODEL_GAP_V1.md)，本文不复制表字段。

## ① 可落库/关系清单

### A. 核心业务上下文

| 上下文                  | 聚合根/核心对象                      | 业务所有权                                                             |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| Shipment Registry       | Shipment（目标）、ContainerRecord    | 已出运事实、出运货物、运输单证、上游引用、一柜一档身份和版本化装载分配 |
| Lifecycle Control       | FlowInstance、CanonicalEvent         | 14节点、流程状态机和实际事件推进                                       |
| Work Execution          | NodeTask、WorkOrder、ClientOperation | 工序任务、工单、动作与聚合政策                                         |
| Booking & Origin        | Booking/OriginOperation（后续切片）  | 订舱至起运前专业事实                                                   |
| Ocean & Port Visibility | OceanLeg、PortCall                   | 开船、在途、到港和港口事实                                             |
| Customs Compliance      | CustomsCase                          | 申报、换单、缴税、查验与放行                                           |
| Inland Fulfillment      | InlandMove                           | 提柜、派送、卸柜、验箱与还箱                                           |
| Charges Settlement      | ChargeCase                           | 三类超期费用、修箱费、账单和对账                                       |
| Document Records        | DocumentRecord                       | 单证、附件、EIR、证据版本与归档                                        |
| Performance Improvement | ImprovementCase                      | KPI、SLA、绩效、复盘和改善                                             |

### A1. 支撑上下文

Identity、Master Data、Integration Import、Exception Management、Notification、Audit、Workflow、AI Governance。Master Data 拥有 Product/SKU 稳定身份、参考数据、地点设施、业务伙伴及外部别名映射，但不拥有出运交易行、合规决定或生命周期状态；其他支撑上下文同样不拥有专业业务结论。完整职责和依赖见 [ADR-010](../../architecture/decisions/ADR-010-bounded-context-modules.md)、[MODULE_DEPENDENCIES](../../architecture/MODULE_DEPENDENCIES.md) 与 [MASTER_DATA_DICTIONARY](./MASTER_DATA_DICTIONARY.md)。

### A2. 跨上下文执行链

```text
ContainerRecord -> FlowInstance -> NodeTask -> WorkOrder -> ClientOperation
工单结果 -> 工序任务聚合 -> 规范业务事件 -> 主流程合法转换
```

- 每个上下文拥有自己的数据写边界，禁止跨上下文直写表或Repository。
- 同步写链使用Application层同库事务；跨事务使用Outbox和幂等消费者。
- 外部权威事件可以先推进主流程，再创建补录、关闭或对账工单。
- 管理投影只消费事实引用，不反向改写业务底数。

### B. Shipment Registry 聚合组成

| 部分         | 内容                                                          | 备注                                     |
| ------------ | ------------------------------------------------------------- | ---------------------------------------- |
| 已出运事实   | Shipment（目标）· 来源身份 · 路线 · 当前生命周期投影          | 当前核心聚合；尚未落库                   |
| 出运货物     | ShipmentCargoLine（目标）· SKU/数量/件重体/目的仓             | 不依赖备货单存在                         |
| 运输单证     | ShipmentTransportDocument（目标）· Booking/MBL/HBL            | 一票多单证，保留版本                     |
| 上游引用     | ShipmentUpstreamReference（目标）· 计划/备货/装箱/采购身份    | 只引用，不复制上游规则                   |
| 备货兼容     | ReplenishmentOrder / ReplenishmentOrderLine                   | 当前实现；目标中为上游血缘               |
| 货柜身份     | ContainerRecord · containerNumber(迟绑定,非全局唯一)          | 一柜一档；稳定 id 为主锚                 |
| 出运-货柜    | ShipmentContainerLink（目标）                                 | 一票多柜；版本化关系；柜侧活动基数待评审 |
| 实际装载     | ContainerCargoAllocationSet / ContainerCargoAllocation        | 复用版本链，目标引用出运货物行           |
| 航次上下文   | 船司/船名航次/POL·POD/单证/时间(planned·estimated·actual)     | ← sea_freight                            |
| 港口作业序列 | origin/transit/destination × 时间/清关/免费期                 | ← port_operations                        |
| 运营后段     | 拖卡/卸柜/卸空/还箱（记录挂接）                               | ← 三表                                   |
| 状态/时间    | currentStatus(8) · 各节点时间字段；实际值必须带来源时间元数据 | NODE_TIME_FIELDS                         |
| 标记/扩展    | markers/attributes（受控键）                                  | CONTAINER_MARKERS                        |

### C. 公共端口（块与块怎么传，禁直连）

| 调用方 → 端口                              | 用途                                              |
| ------------------------------------------ | ------------------------------------------------- |
| Import → Shipment 写端口（目标契约待评审） | 提交已通过准入的 Shipment、货物、货柜、单证与关系 |
| Import/Dictionary 解析端口                 | 主数据归一，未命中→未知队列                       |
| → Identity 授权                            | 服务端对象级授权                                  |
| Shipment → Dictionary                      | 港口/船司/柜型校验引用                            |
| → AI Governance                            | AI 调用前置治理                                   |
| 各写 → Audit                               | 留痕                                              |

### D. 四对象追踪（P2 门禁）

AI 产物(建议) → 审核结果(人) → 执行结果(行+Shipment 身份) → 业务事实(Shipment/关系/货物/货柜)；来源批次、行、版本和操作者全程留痕。

### E. 关键决策（已确认）

| 决策         | 值                                                                                      |
| ------------ | --------------------------------------------------------------------------------------- |
| 聚合形态     | Shipment=已出运事实+N 货物/单证/上游引用；ContainerRecord=一柜一档；经版本化关系连接    |
| 主锚         | shipmentId 是出运稳定身份；containerId 是柜次稳定身份；orderNumber 仅是上游备货身份     |
| 导入写       | 只经 Shipment 端口，Import 不持其仓储                                                   |
| 当前产品边界 | 可证明的实际出运事实起，至到仓、还箱并关闭；ATD/权威 DEPARTED/授权确认至少满足一种      |
| 接入演进     | 当前 Import 文件适配器；后续 Integration 直连适配器；二者进入同一 Shipment 应用写入边界 |
| 上游边界     | 计划→采购→分仓/装柜→备货→装箱当前只提供稳定引用和适配器，不实现空壳状态机               |
| 产品边界     | Logix 本体=货柜收端+与 WMS 对接+控制塔；仓储内业为扩展线(VISION)                        |

## ② 定义与澄清

- "上下文"≈一块只管自己的事；跨块只走 公共端口/事件/契约，不 import 对方内部。
- Shipment 管“这次已出运事实”；ContainerRecord 管“这个柜次的实情”；ImportBatch 管“这批导入工作”，三者解耦。
- 同一备货单号在源文件中可因多个产品货号出现多行；Import 按备货单聚合表头，并逐行保留产品明细。
- 当前 Import 与后续 Integration 只是不同来源适配器；二者都不能拥有或直接修改 Shipment Registry 的业务事实。
- 相同物理箱号且属于同一运输实例时只建一个 ContainerRecord；多个备货单通过装载分配关联，不按备货单复制货柜记录。

## ③ 规则与约束/边界

- 依赖方向：UI→Application→Domain←Infrastructure；Domain 不碰 ORM/Web。
- 业务 API 是认证/校验/最终写唯一入口；AI Service/Worker 不直写生产表。
- 主备货单号不作键；旧 `orderNumber/replenishmentOrderId` 只作兼容锚，不定义 Shipment 或实际装载基数。
- 装载分配必须版本化、带来源证据和幂等键；一柜可装多备货单，一条明细可按数量拆入多柜，跨柜合计不得超出出运数量。
- 产品明细属于备货单；不得把同备货单多产品行判为货柜重复，也不得把产品数量等同于整柜包装数。
- 产品明细保存 Product/SKU 稳定 ID 和本次交易快照，但不兼任 Product/SKU 主档；稳定身份由 Master Data 公共 Port 提供。
- 当前范围外的计划/采购/分仓/备货/装箱只保留稳定引用和扩展端口，不提前确定其聚合、状态机或作业 UI。

## ④ 流程（怎么用）

新改动先定位 属于哪个上下文 → 走其公共端口/契约 → 影响跨上下文须评审（MODULE_DEPENDENCIES/ADR 规则）。

## ⑤ 注意事项（坑）

- 别跨包 import 内部路径（只走公共入口）。
- 别让 Import/AI 直写业务表。
- 别把"上下文"当成表前缀即完事——依赖方向是硬约束。

## ⑥ 白话注解（🗣️）

🗣️ 系统像几家分工的部门：身份管人、字典管"标准叫法"、货柜这块管"柜子的实情"、导入是"收文件干活的入口"。部门之间只通过"窗口"传东西，不许互相翻抽屉；导数据想动柜子实情，必须走 Shipment 那扇窗，谁都不能抄近道直改。

## ⑦ 落库/实现映射

| 清单         | 落库/包                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| 上下文/聚合  | packages/{domain,contracts,...} 模块划分(P3)                                                                  |
| 端口         | Application 用例/契约(public entry)                                                                           |
| 当前兼容落库 | replenishment_order + replenishment_order_line + container_record + container_cargo_allocation_set/allocation |
| 目标核心     | shipment + shipment_cargo_line + shipment_container_link + transport_document + upstream_reference（待迁移）  |
| 追踪键       | source identity → row → review → result → Shipment/关系/事件 → audit                                          |

## ⑧ 待评审/关联

- 待定：Shipment 写端口、事件主体、状态聚合规则、幂等组合键和 Migration 设计；迁移前不得宣称目标表已存在。
- 关联：ADR-010、MODULE_DEPENDENCIES、IMPORT_DOMAIN_MODEL、CONTAINER_STATUS_MODEL、GLOSSARY、VISION。
