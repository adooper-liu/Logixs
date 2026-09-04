# 首批目标对象标准字段目录 v0.1（TARGET_FIELD_CATALOG）

> 状态：**候选（初稿，待 P2 评审）** · v0.2 · 2026-09-04 · 负责人：刘志高。
> 关键决策（负责人已确认 2026-09-04，含细化）：物流状态文本列 = 真实当前状态；**匹配主锚 = 备货单号**（备货阶段唯一建档身份；采购阶段=采购订单号 PO）；**箱号与实际出运日期均迟绑定**（装箱后与外部交换才进入；备货/订舱阶段仅预计出运日期）；一行 = 一份货柜流转记录整体（见 [CONTEXT_MAP](./CONTEXT_MAP.md) §3.1 与 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §6.2）。
> 上游：`IMPORT_WORKFLOW` §8 跟踪项 #2（首批目标对象定稿）、现状基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §3（真实列）、[GLOSSARY](../GLOSSARY.md) §1「标准字段」。
> 读者：业务管理员/字典维护者、P2-06 数据模型、P2-10 `suggest_import_mapping` 契约、P6 导入切片、P7 评测关键字段口径。
> 用途：本目录是首期导入**目标字段模板的单一权威初稿**（对应 `GLOSSARY`「标准字段 = 字典 + 字段模板」），评审定稿后将实例化为 `dictionary` 的模板数据与 `packages/contracts` 字段契约。
> 锚点：目标对象 = **货柜全流程信息**（一行 = 一个货柜的一次完整流转），由四个分组节组成（对照 AS-IS 多表结构）。

## 1. 目标对象与分节

```text
货柜全流程信息（目标对象）
├── A 货柜与柜况（≈ AS-IS biz_containers）
├── B 航次/海运/单证（≈ AS-IS process_sea_freight）
├── C 港口作业序列（≈ AS-IS process_port_operations，重复块 origin/transit/destination）
├── D 运营后段（拖卡/仓库卸柜/还空箱 ≈ AS-IS process_trucking_transport + warehouse_operations + empty_returns）
└── 状态证据列（物流状态建议列，见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6）
```

## 2. 字段元数据约定

每字段带：`类型`、`必填`（首期预检判定）、`来源/字典`、`关键字段`（P7 评测关键字段：编号/日期/数量/金额/币种等，见 [NFR](../NON_FUNCTIONAL_REQUIREMENTS.md) §4）、`备注/别名`。
完整列集与来源列名以 AS-IS 快照 §3 与源库 DDL 为准；本目录定**标准语义**，别名（源表头同义词）单独维护于字典别名，不在此复制（单一真相）。

### A 货柜与柜况

| 字段 code | 语义 | 类型 | 必填 | 来源/字典 | 关键 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| containerNumber | 箱号（**迟绑定**：装箱后与外部交换才进入系统） | string | 导入文件✅（装箱后数据通常已带） | 校验（前缀+数字规则候选） | ✅ | 物理箱业务标识；非建档前提，已有时参与一致性判定 |
| containerTypeCode | 箱型 | dictCode | ✅ | 柜型字典；标准码 `GP/HC/RH/FR/FQ/OT/OQ/TK/TQ/RF/HT/HH`（尺寸 20/40/45/53），`40HQ/20DV` 等仅作外部别名 | | 未知不得静默回退；别名映射见 [INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) P5 |
| orderNumber | 备货单号（**备货阶段唯一建档身份**，先于箱号） | string | ✅ | 备货单域 | ✅ | 匹配主锚；采购阶段为采购订单号(PO)，属不同对象；见 [SHIPMENT_FLOW_OVERVIEW](./SHIPMENT_FLOW_OVERVIEW.md) §3 |
| cargoDescription | 品名/货物描述 | string | | | | |
| grossWeight/netWeight | 毛重/净重(kg) | decimal | 候选 | 单位 kg | ✅(毛重) | 定点数 |
| cbm | 体积 | decimal | | | | |
| packages | 件数 | int | | | ✅ | |
| sealNumber | 封号 | string | | | | |
| tareWeight/totalWeight | 皮重/总重(kg) | decimal | | | | AS-IS 外接字段 |
| overLength/overHeight | 超长/超高 | decimal | | | | 危险品等需二次确认候选 |
| dangerClass | 危险品等级 | string | 候选 | 字典候选 | | |
| containerHolder/operator | 持箱人/运营方 | string | | | | AS-IS 外接字段 |
| requiresPallet/requiresAssembly/inspectionRequired | 打托/装配件/查验 | boolean | | | | 语义需业务复核 |
| isRolled | 甩柜标记 | boolean | | | | AS-IS 外接 |

### B 航次/海运/单证

| 字段 code | 语义 | 类型 | 必填 | 来源/字典 | 关键 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| bookingNumber / billOfLadingNumber | 订舱号 / 提单号 | string | 候选 | | ✅ | |
| shippingCompanyCode | 船司 | dictCode | 候选 | 船司字典（含 scac/名称别名） | | 未知进队列（修 A2） |
| vesselName + voyageNumber | 船名/航次 | string | 候选 | | ✅(组合) | |
| portOfLoadingCode / portOfDischargeCode | 起运港/目的港 | dictCode | ✅ | 港口字典（别名如 `Yantian/盐田`） | ✅ | 未命中未知队列 |
| transitPortCode | 途经港 | dictCode | | 港口字典 | | |
| freightForwarderCode | 货代 | dictCode | | | | |
| mblScac+mblNumber / hblScac+hblNumber / amsNumber | 母/子提单 SCAC 与号 / AMS | string | | | ✅(单证号) | |
| eta/etd/ata/atd | 预计/实际到离港时间 | datetime(ISO,UTC) | 候选 | | ✅ | AS-IS DATE 列按 UTC/时区规则收口（A8） |
| shipmentDate | 出运日期（**实际，迟绑定**：装箱后与外部交换产生） | date | | | ✅ | 状态证据；备货/订舱阶段的预计值在备货单层 |
| customsClearanceDate | 清关日期 | date | | | | |
| portOpenDate/portCloseDate | 开港/截港时间 | datetime | | | | |
| freightCurrency | 海运费币种 | dictCode | 候选 | 币种字典 | ✅(币种) | 与金额成对 |
| standardFreightAmount | 标准海运费金额 | decimal | | | ✅(金额) | 定点+币种（修 A6） |
| transportMode / routeCode | 运输方式/航线代码 | string | | | | |
| motherVesselName/motherVoyageNumber | 母船船名/航次 | string | | | | 中转场景候选 |

### C 港口作业序列（重复块，最多按 origin/transit/destination 逐港一列组）

| 字段 code | 语义 | 类型 | 备注 |
| --- | --- | --- | --- |
| portType | 港口角色(origin/transit/destination) | enum | 分组键 |
| portSequence | 顺序 | int | 排序 |
| portCode | 港口 | dictCode | 与 B 港口字典同源 |
| etaDestPort/ataDestPort | 目的港预计/实际到港 | datetime | 状态证据 |
| transitArrivalDate | 中转港到达 | datetime | 状态证据 |
| gateInTime/gateOutTime | 进/出闸 | datetime | 状态证据 |
| dischargedTime/availableTime | 卸船/可提 | datetime | 状态证据 |
| customsStatus | 清关状态 | enum 候选 | exception 输入 |
| freeStorageDays/freeDetentionDays/freeOffTerminalDays | 免堆/场内/场外免箱期 | int | |

### D 运营后段

| 字段 code | 语义 | 类型 | 备注 |
| --- | --- | --- | --- |
| pickupDate（trucking） | 提柜时间 | datetime | 状态证据 |
| deliveryDate（trucking） | 派送时间 | datetime | |
| unloadDate（warehouse） | 仓库卸柜时间 | datetime | 状态证据 |
| unboxingTime（warehouse） | 开箱时间 | datetime | |
| returnTime（emptyReturn） | 还空箱时间 | datetime | `returned_empty` 必须证据 |
| notificationReturnDate/time | 通知取空日期/时间 | date/datetime | |
| unloadMode | 卸柜方式(Drop off/Live load) | enum | 计划/实际两态候选 |

### 状态证据列（E）

| 字段 | 语义 | 备注 |
| --- | --- | --- |
| logisticsStatusText（源） | 物流状态文本列（**真实当前状态**，负责人已确认） | 经字典归一后直接落 `currentStatus`；`returned_empty` 等需证据口径做强校验，冲突走低置信/人工，见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6 |

## 3. 记录匹配键 / 重复判定（负责人已确认，2026-09-04 细化）

- **匹配主锚 = `orderNumber`（备货单号，唯一建档身份）**：与库内记录一致命中 → 更新；未命中 → 新建（见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §6.2）。
- `containerNumber` 与**实际出运日期**均为**迟绑定字段**：装箱后与外部交换时才进入系统；双方已有时须一致（不一致转人工）。
- 同文件内多行命中同一备货单号 → 标 `duplicate`，只写一条。
- 批次级幂等键 = 来源 + 文件指纹（同文件重复上传不重复处理）。
- 预计出运日期（备货/订舱阶段）与实际出运日期（装箱后）分列字段，不用迟绑定值作身份。

## 4. 必填 / 预检初稿（候选）

- 必填硬闸（建议首期）：`orderNumber`（备货单号）、`containerTypeCode`、起运港或目的港任一、承运（船司或船名航次）。
- `containerNumber`：装箱后数据应带；缺失不阻断建档（迟绑定），标记待补。
- 冲突类进低置信/人工而非直接失败：同义词歧义、状态文本与时间证据冲突、币种缺失（金额存在时）。

## 5. 关键字段口径（P7 评测）

按 [NFR](../NON_FUNCTIONAL_REQUIREMENTS.md) §4「编号/日期/数量/金额/币种」归类：表 A/B/C/D 中标 `关键 ✅` 字段为漏提率统计范围；清单定稿须与 P7 评分器一致。

## 6. 决策记录与待评审

### 已确认（2026-09-04，负责人）

- 匹配主锚 = 备货单号（唯一建档身份）；箱号与实际出运日期迟绑定——§3。
- 物流状态文本列 = 真实当前状态——§2-E。

### 仍待评审

- 分节字段集是否覆盖首期真实业务表（建议以 1–2 份真实脱敏样本核对，连接 P2-12 采集）。
- 必填硬闸与冲突降级清单（§4）。
- 各字典（柜型/港口/船司/币种）别名初始化范围（从 AS-IS 别名表迁移，P2-04/P2-12）。
- 时间列口径（DATE vs 时刻、时区）逐字段定稿。

## 7. 关联与维护

- 上链：任务 brief `p2-shipment-import-domain.md`；[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)；基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §3。
- 派生：P2-04 字典、P2-06 数据模型、P2-10 契约、P6。
- 评审定稿后本目录转为字典模板数据与 `packages/contracts`，本文件保留为指针/说明。
