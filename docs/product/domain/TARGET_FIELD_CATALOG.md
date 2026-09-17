# 首批目标对象标准字段目录（TARGET_FIELD_CATALOG · V1.2）

> 状态：**正式 V1.0 最小基线（§0.1–§0.4）+ 正式 V1.1 产品明细 + 正式 V1.2 时间事实导入（§0.5–§0.6、§D/§E 子集）+ 扩展候选** · 2026-09-16 · 负责人：刘志高。
> 关键输入（负责人确认）：**匹配主锚 = 备货单号**（备货阶段唯一建档身份；采购阶段=采购订单号 PO）；同一备货单可因多个产品货号出现多行，按单聚合表头并逐行保留产品明细；**箱号与实际出运日期均迟绑定**；来源状态、缺时区时间和推导时间都不能直接成为实际业务事实。
> 上游：`IMPORT_WORKFLOW` §8 跟踪项 #2（首批目标对象定稿）、现状基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §3（真实列）、[GLOSSARY](../GLOSSARY.md) §1「标准字段」。
> 读者：业务管理员/字典维护者、P2-06 数据模型、P2-10 `suggest_import_mapping` 契约、P6 导入切片、P7 评测关键字段口径。
> 用途：本目录是首期导入**目标字段模板的单一权威**（对应 `GLOSSARY`「标准字段 = 字典 + 字段模板」）。§0.1、§0.6 与 §E 标明的字段属于正式运行时字段；扩展候选在逐项确认并进入新版本前不得作为运行时必填或已支持能力。
> 锚点：当前目标对象 = **货柜全流程信息**。来源行粒度由文件决定，产品文件通常一行一产品，不再假定一行一柜；产品明细已在 V1.1 落地，首组时间事实与来源追溯已在 V1.2 落地。

## 0. V1.0 最小可执行基线（正式）

### 0.1 表格可映射字段

| 字段 code       | 中文名   | 类型   | 必填 | 所属对象        | 业务落点                            | 规则                                                                                   | 证实 |
| --------------- | -------- | ------ | ---- | --------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ---- |
| orderNumber     | 备货单号 | string | 是   | ContainerRecord | `container_record.order_number`     | 租户内建档主锚；去除首尾空白后不得为空；命中更新、未命中新建                           | O    |
| containerNumber | 箱号     | string | 否   | ContainerRecord | `container_record.container_number` | 迟绑定且不作建档主锚；空值不覆盖已有值；双方已有且不一致时进入人工冲突处理，不静默覆盖 | O    |

### 0.2 上下文与派生事实

| code/status   | 角色       | V1.0 规则                                                                                      |
| ------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| tenantId      | 请求上下文 | 不是表格映射字段；所有批次、匹配、查询和写入必须在服务端限定租户                               |
| currentStatus | 派生事实   | 不是表格映射字段；不得按来源文本或默认值直接覆盖，只能由合格证据产生规范事件后经状态机合法推进 |
| importBatchId | 来源追踪   | 不是业务字段；每条执行结果必须可追溯到导入批次和原始行                                         |

### 0.3 V1.0 实现门禁

- 人工确认后的有效映射是预检和执行的唯一输入；AI 建议只作不可变参考。
- 同一租户内同一 `orderNumber` 一次执行至多形成一条业务记录；跨租户不得互相命中或更新。
- `containerNumber` 冲突必须产生逐行错误或人工待处理项；不得以后到值静默覆盖已有事实。
- 原始行、有效映射、预检结果、执行结果和操作者必须可追溯；blocker 存在时不得写业务表。
- 未列入 §0.1 的源列可以保留在原始快照，但不得写入业务事实或被宣传为 V1.0 已支持字段。
- V1.1 起同备货单多产品行按单聚合并逐行落产品明细，不再把重复备货单号本身判为 `DUP_ROW`。

### 0.4 版本兼容规则

| 变更类型                         | 版本动作                 | 约束                                              |
| -------------------------------- | ------------------------ | ------------------------------------------------- |
| 新增可选字段或非破坏性元数据     | `V1.x`                   | 同步契约、落点、映射、预检、UI 和测试后才标记支持 |
| 新增字典值或来源别名             | 字典版本升级             | 不改变字段 code 和既有语义；未知值仍进入待处理    |
| 可选改必填、改类型或改变字段语义 | 新主版本（如 `V2`）      | 提供兼容期、迁移和历史数据处理方案                |
| 改名或删除字段                   | 先弃用，后在新主版本移除 | 禁止复用旧 code 表达新含义                        |

> 🗣️ 白话：V1.0 先把“靠什么找到这条货柜记录”和“箱号怎么安全补上”说死。其他列仍可上传并保留原文，但在完成字段归属、字典、校验和落库前，不算系统已经支持。

### 0.5 V1.1/V1.2 已实现规则

| 主题       | 已确认规则                                                                                    | 运行时状态  | 实现门禁                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| 来源行粒度 | 同一备货单的多产品行合法；按 `tenantId + orderNumber` 聚合一个表头，逐行保存产品明细          | V1.1 已实现 | 契约、明细表、事务写端口、逐行结果和回归测试同批交付                                      |
| 数量与包装 | `shippedQuantity + quantityUnit` 是产品明细事实；`packageCount` 是整单/整柜包装汇总，两者独立 | V1.1 已实现 | 单位未知失败或待确认；无装箱换算规则不得互推                                              |
| 清关完成   | 来源清关状态与可核验的实际清关时间必须同时存在，才能形成 actual 时间事实                      | V1.2 已实现 | 缺时间或证据时预检阻断，不以导入时间或当前时间代填；本切片不自动晋升规范事件              |
| 卸柜/卸空  | 现场实际卸柜完成、空箱确认与预计/推导时间分槽                                                 | V1.2 已实现 | 推导值使用 `timeKind=estimated`、`captureSource=system_derived`，不得写 actual 或推进状态 |
| 跨系统时间 | 每个实际时间保留原始值、来源 UTC 偏移、标准化 UTC、来源系统与证据                             | V1.2 已实现 | 来源偏移不明时不得落 actual；IANA/夏令时配置仍待后续切片                                  |

### 0.6 V1.2 时间事实运行时字段

| 字段 code                 | 中文名            | 配套要求                                         | 落点                          |
| ------------------------- | ----------------- | ------------------------------------------------ | ----------------------------- |
| customsClearanceStatus    | 清关完成状态      | 与 `customsClearanceActualAt` 成对且命中完成语义 | `shipment_time_fact` actual   |
| customsClearanceActualAt  | 实际清关完成时间  | 来源系统、UTC 偏移、证据 ID 必填                 | `shipment_time_fact` actual   |
| unloadCompletionStatus    | 卸柜完成状态      | 与 `unloadCompletedActualAt` 成对且命中完成语义  | `shipment_time_fact` actual   |
| unloadCompletedActualAt   | 实际卸柜完成时间  | 来源系统、UTC 偏移、证据 ID 必填                 | `shipment_time_fact` actual   |
| emptyConfirmationStatus   | 空箱确认状态      | 与 `emptyConfirmedActualAt` 成对且命中完成语义   | `shipment_time_fact` actual   |
| emptyConfirmedActualAt    | 实际空箱确认时间  | 来源系统、UTC 偏移、证据 ID 必填                 | `shipment_time_fact` actual   |
| emptyEstimatedAt          | 推导空箱时间      | 来源系统、UTC 偏移和推导规则版本必填             | `shipment_time_fact` estimate |
| timeSourceSystem          | 时间来源系统      | 有任一时间事实时必填                             | 来源追溯                      |
| timeSourceUtcOffset       | 时间来源 UTC 偏移 | V1.2 接受 `UTC/Z` 或 `±HH:MM`，不猜服务器时区    | 来源追溯                      |
| timeEvidenceRef           | 时间证据 ID       | actual 必须是 UUID；事件晋升前仍须核验证据有效性 | 来源追溯                      |
| timeDerivationRuleVersion | 时间推导规则版本  | `emptyEstimatedAt` 必填                          | 来源追溯                      |

V1.2 时间事实只是 Shipment 域可审计事实，不直接更新 `currentStatus`。规范事件仍须经证据核验、来源权威、时间单调和生命周期状态机守卫后产生。

## 1. 扩展候选目标对象与分节

```text
已出运货柜全流程信息（当前目标对象）
├── ReplenishmentOrder（备货单表头）
│   └── E ReplenishmentOrderLine（N 条产品明细）
├── A ContainerRecord（货柜与柜况）
├── B 航次/海运/单证（≈ AS-IS process_sea_freight）
├── C 港口作业序列（≈ AS-IS process_port_operations，重复块 origin/transit/destination）
├── D 运营后段（拖卡/仓库卸柜/还空箱 ≈ AS-IS process_trucking_transport + warehouse_operations + empty_returns）
└── F 状态证据列（见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6）
```

## 2. 扩展候选字段元数据约定

以下字段用于规划 `V1.x` 或后续主版本。每字段带：`类型`、`必填`候选、`来源/字典`、`关键字段`（P7 评测关键字段：编号/日期/数量/金额/币种等，见 [NFR](../NON_FUNCTIONAL_REQUIREMENTS.md) §4）、`备注/别名`。
完整列集与来源列名以 AS-IS 快照 §3 与源库 DDL 为准；本目录定**标准语义**，别名（源表头同义词）单独维护于字典别名，不在此复制（单一真相）。

本节重复出现的 `orderNumber`、`containerNumber` 以 §0 为正式权威；其余字段在逐项补齐所属对象、业务落点、规则和证实度并进入新版本前均为候选。

### A 货柜与柜况

| 字段 code                                          | 语义                                           | 类型     | 必填       | 来源/字典                                                                                              | 关键     | 备注                                                                                      |
| -------------------------------------------------- | ---------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| containerNumber                                    | 箱号（**迟绑定**：装箱后与外部交换才进入系统） | string   | 否（V1.0） | 校验（前缀+数字规则候选）                                                                              | ✅       | 物理箱业务标识；非建档前提，已有时参与一致性判定；正式规则见 §0                           |
| containerTypeCode                                  | 箱型                                           | dictCode | ✅         | 柜型字典；标准码 `GP/HC/RH/FR/FQ/OT/OQ/TK/TQ/RF/HT/HH`（尺寸 20/40/45/53），`40HQ/20DV` 等仅作外部别名 |          | 未知不得静默回退；别名映射见 [INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) P5 |
| orderNumber                                        | 备货单号（**备货阶段唯一建档身份**，先于箱号） | string   | 是（V1.0） | 备货单域                                                                                               | ✅       | 匹配主锚；正式规则见 §0；采购阶段为采购订单号(PO)，属不同对象                             |
| cargoDescription                                   | 品名/货物描述                                  | string   |            |                                                                                                        |          |                                                                                           |
| grossWeight/netWeight                              | 毛重/净重(kg)                                  | decimal  | 候选       | 单位 kg                                                                                                | ✅(毛重) | 定点数                                                                                    |
| cbm                                                | 体积                                           | decimal  |            |                                                                                                        |          |                                                                                           |
| packageCount                                       | 整单/整柜包装数                                | int      | 候选       | 装箱/货柜汇总                                                                                          | ✅       | 与产品出运数量独立；无换算规则不得互推                                                    |
| sealNumber                                         | 封号                                           | string   |            |                                                                                                        |          |                                                                                           |
| tareWeight/totalWeight                             | 皮重/总重(kg)                                  | decimal  |            |                                                                                                        |          | AS-IS 外接字段                                                                            |
| overLength/overHeight                              | 超长/超高                                      | decimal  |            |                                                                                                        |          | 危险品等需二次确认候选                                                                    |
| dangerClass                                        | 危险品等级                                     | string   | 候选       | 字典候选                                                                                               |          |                                                                                           |
| containerHolder/operator                           | 持箱人/运营方                                  | string   |            |                                                                                                        |          | AS-IS 外接字段                                                                            |
| requiresPallet/requiresAssembly/inspectionRequired | 打托/装配件/查验                               | boolean  |            |                                                                                                        |          | 语义需业务复核                                                                            |
| isRolled                                           | 甩柜标记                                       | boolean  |            |                                                                                                        |          | AS-IS 外接                                                                                |

### B 航次/海运/单证

| 字段 code                                         | 语义                                               | 类型              | 必填     | 来源/字典                         | 关键       | 备注                                         |
| ------------------------------------------------- | -------------------------------------------------- | ----------------- | -------- | --------------------------------- | ---------- | -------------------------------------------- |
| bookingNumber / billOfLadingNumber                | 订舱号 / 提单号                                    | string            | 候选     |                                   | ✅         |                                              |
| shippingCompanyCode                               | 船司                                               | dictCode          | 候选     | 船司字典（含 scac/名称别名）      |            | 未知进队列（修 A2）                          |
| vesselName + voyageNumber                         | 船名/航次                                          | string            | 候选     |                                   | ✅(组合)   |                                              |
| portOfLoadingCode / portOfDischargeCode           | 起运港/目的港                                      | dictCode          | ✅       | 港口字典（别名如 `Yantian/盐田`） | ✅         | 未命中未知队列                               |
| transitPortCode                                   | 途经港                                             | dictCode          |          | 港口字典                          |            |                                              |
| freightForwarderCode                              | 货代                                               | dictCode          |          |                                   |            |                                              |
| mblScac+mblNumber / hblScac+hblNumber / amsNumber | 母/子提单 SCAC 与号 / AMS                          | string            |          |                                   | ✅(单证号) |                                              |
| eta/etd/ata/atd                                   | 预计/实际到离港时间                                | datetime(ISO,UTC) | 候选     |                                   | ✅         | AS-IS DATE 列按 UTC/时区规则收口（A8）       |
| shipmentDate                                      | 出运日期（**实际，迟绑定**：装箱后与外部交换产生） | date              |          |                                   | ✅         | 状态证据；备货/订舱阶段的预计值在备货单层    |
| customsClearanceActualAt                          | 实际清关完成/放行时间                              | datetime(ISO,UTC) | 条件必填 | 海关/报关证据                     | ✅         | 清关完成状态存在时必须同时存在；遵守 R10–R12 |
| portOpenDate/portCloseDate                        | 开港/截港时间                                      | datetime          |          |                                   |            |                                              |
| freightCurrency                                   | 海运费币种                                         | dictCode          | 候选     | 币种字典                          | ✅(币种)   | 与金额成对                                   |
| standardFreightAmount                             | 标准海运费金额                                     | decimal           |          |                                   | ✅(金额)   | 定点+币种（修 A6）                           |
| transportMode / routeCode                         | 运输方式/航线代码                                  | string            |          |                                   |            |                                              |
| motherVesselName/motherVoyageNumber               | 母船船名/航次                                      | string            |          |                                   |            | 中转场景候选                                 |

### C 港口作业序列（重复块，最多按 origin/transit/destination 逐港一列组）

| 字段 code                                             | 语义                                 | 类型      | 备注              |
| ----------------------------------------------------- | ------------------------------------ | --------- | ----------------- |
| portType                                              | 港口角色(origin/transit/destination) | enum      | 分组键            |
| portSequence                                          | 顺序                                 | int       | 排序              |
| portCode                                              | 港口                                 | dictCode  | 与 B 港口字典同源 |
| etaDestPort/ataDestPort                               | 目的港预计/实际到港                  | datetime  | 状态证据          |
| transitArrivalDate                                    | 中转港到达                           | datetime  | 状态证据          |
| gateInTime/gateOutTime                                | 进/出闸                              | datetime  | 状态证据          |
| dischargedTime/availableTime                          | 卸船/可提                            | datetime  | 状态证据          |
| customsStatus                                         | 清关状态                             | enum 候选 | exception 输入    |
| freeStorageDays/freeDetentionDays/freeOffTerminalDays | 免堆/场内/场外免箱期                 | int       |                   |

### D 运营后段

| 字段 code                   | 语义                         | 类型          | 备注                                                             |
| --------------------------- | ---------------------------- | ------------- | ---------------------------------------------------------------- |
| pickupActualAt              | 实际提柜时间                 | datetime      | 状态证据；时间四件套                                             |
| deliveryActualAt            | 实际送仓时间                 | datetime      | 状态证据；时间四件套                                             |
| unloadStartedActualAt       | 实际卸柜开始时间             | datetime      | 可选子里程碑；只认现场/WMS 证据                                  |
| unloadCompletedActualAt     | 实际卸柜完成时间             | datetime      | `unloaded` 证据；推导“卸空日期”不得映射                          |
| emptyConfirmedActualAt      | 实际卸净/空箱确认时间        | datetime      | `unstuffed` 证据；只认现场/WMS 证据                              |
| emptyEstimatedAt            | 预计/推导空箱时间            | datetime      | `timeKind=estimated`、`captureSource=system_derived`，带规则版本 |
| returnActualAt              | 实际还空箱时间               | datetime      | `returned_empty` 必须证据                                        |
| notificationReturnDate/time | 通知取空日期/时间            | date/datetime | 通知事实，不等于实际卸空                                         |
| unloadMode                  | 卸柜方式(Drop off/Live load) | enum          | 计划/实际两态候选                                                |

### E 产品明细（正式 V1.1 运行时字段）

| 字段 code                                           | 语义             | 类型      | 必填 | 规则                                                      |
| --------------------------------------------------- | ---------------- | --------- | ---- | --------------------------------------------------------- |
| productNumber                                       | 产品货号         | string    | 是   | 同一备货单可多行；产品号本身不作明细唯一键                |
| shippedQuantity                                     | 产品出运数量     | decimal   | 是   | `> 0`；与单位成对，不等同 `packageCount`                  |
| quantityUnit                                        | 出运数量单位     | dictCode  | 是   | 来源列、版本化来源映射或人工确认提供；禁止静默默认“箱/件” |
| contractNumber                                      | 合同号           | string    | 否   | 同一产品可因合同不同出现多行                              |
| containsBattery / containsRefrigerant               | 带电/含冷媒      | boolean   | 否   | 空值表示未知，不默认否                                    |
| phytosanitaryRequired / commodityInspectionRequired | 植检/商检        | boolean   | 否   | 产品行事实；空值表示未知                                  |
| domesticMarkupAmount + currency                     | 国内加成额       | money     | 否   | 定点金额+币种；`$` 来源列显式映射 USD                     |
| replenishmentFobUnitPrice + currency                | FOB 单价（备货） | money     | 否   | 定点金额+采购币种                                         |
| negotiationFobUnitPrice + currency                  | FOB 单价（议付） | money     | 否   | 币种缺失时不得落金额事实                                  |
| sourceBatchId + sourceRowId                         | 来源追踪         | reference | 是   | 支持重放、对账和明细级幂等                                |

### 状态证据列（F）

| 字段                      | 语义                                                          | 备注                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| logisticsStatusText（源） | 来源方声明的实际状态（不是计划/预计，也不是自动成为最终权威） | 经字典归一、D7 来源权威、证据一致性与状态机合法转换后生成业务事件；通过事件推进 `currentStatus`。未知、出运前或冲突时不得静默进入列表，见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §6 |

## 3. 记录匹配键 / 重复判定（负责人已确认，2026-09-04 细化）

- **匹配主锚 = `orderNumber`（备货单号，唯一建档身份）**：与库内记录一致命中 → 更新；未命中 → 新建（见 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) §6.2）。
- `containerNumber` 与**实际出运日期**均为**迟绑定字段**：装箱后与外部交换时才进入系统；双方已有时须一致（不一致转人工）。
- 同文件内多行命中同一备货单号 → 聚合一个表头并逐行保存产品明细；仅在来源行重放或已确认业务明细键完全重复时标 `duplicate`。
- 同一备货单多行中的表头字段不一致 → `HEADER_CONFLICT`，不静默取第一行或最后一行。
- 批次级幂等键 = 来源 + 文件指纹（同文件重复上传不重复处理）。
- 预计出运日期（备货/订舱阶段）与实际出运日期（装箱后）分列字段，不用迟绑定值作身份。
- 当前模板只形成已到出运节点或合法后继节点的列表；出运前数据留待未来上游前端/接入范围处理，不得靠默认状态混入。

## 4. 必填 / 预检

- V1.1 硬闸：`orderNumber`、`productNumber` 必填，`shippedQuantity` 必须为正且带明确 `quantityUnit`；同单多产品行合法，表头冲突和完全相同的业务明细重复才阻断。
- `packageCount` 与产品数量保持独立，当前切片不接收也不互相代填。
- 实际时间硬闸：清关、卸柜、卸空等完成状态缺实际时间/证据，或来源时区未知时，不得生成规范实际事件；推导时间只用 `estimated + system_derived`。
- 扩展候选硬闸：`containerTypeCode`、起运港或目的港任一、承运（船司或船名航次）；进入正式版本前不得作为 V1.0 已定规则。
- `containerNumber`：箱号在装箱后才绑定，因此不能作为永久主键；V1.0 允许为空且不阻断建档。“缺失时进入待补/复核”属于扩展候选，须经真实样本评审后进入新版本。
- 已出运边界预检：状态未知、仍在出运前或状态与实际出运证据冲突时，至少转人工且不得静默进入列表；哪些情形直接 blocker 待真实样本评审。
- 冲突类进低置信/人工而非直接失败：同义词歧义、状态文本与时间证据冲突、币种缺失（金额存在时）。

## 5. 关键字段口径（P7 评测）

按 [NFR](../NON_FUNCTIONAL_REQUIREMENTS.md) §4「编号/日期/数量/金额/币种」归类：表 A/B/C/D 中标 `关键 ✅` 字段为漏提率统计范围；清单定稿须与 P7 评分器一致。

## 6. 决策记录与待评审

### 已确认（2026-09-04，负责人）

- 匹配主锚 = 备货单号（唯一建档身份）；箱号与实际出运日期迟绑定——§3。
- 物流状态文本列声明实际状态语义；能否成为内部事实由字段权威、证据与状态机校验决定——§2-E。
- 2026-09-16：冻结 §0 为正式 V1.0 最小基线；扩展字段继续候选，按 §0.4 受控升级。
- 2026-09-16：负责人确认同备货单多产品行、数量/包装分离、完成状态与实际时间成对、推导时间不冒充实际、跨系统时间四件套；目标规则见 §0.5。

### 仍待评审

- 分节字段集是否覆盖首期真实业务表（建议以 1–2 份真实脱敏样本核对，连接 P2-12 采集）。
- 必填硬闸与冲突降级清单（§4）。
- 各字典（柜型/港口/船司/币种）别名初始化范围（从 AS-IS 别名表迁移，P2-04/P2-12）。
- 各来源系统的 IANA 时区/偏移配置、夏令时歧义处理与历史数据待补流程。
- 已出运准入所需的最小证据集，以及缺失/冲突时 blocker 与人工复核的分界。

## 7. 关联与维护

- 上链：任务 brief `p2-shipment-import-domain.md`；[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)；基线 [AS_IS_LEGACY_BASELINE](./AS_IS_LEGACY_BASELINE.md) §3。
- 派生：P2-04 字典、P2-06 数据模型、P2-10 契约、P6。
- §0 的运行时契约仍须实例化到 `packages/contracts`；扩展候选逐项评审后按 §0.4 进入新版本。本文件继续作为字段目录单一权威。
