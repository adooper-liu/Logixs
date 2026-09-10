# 行业规范对标与纠偏（INDUSTRY_STANDARDS_ALIGN）

> 状态：**候选（对标底稿）** · 2026-09-04 · 负责人：刘志高。
> 来源：`https://doc.freightower.com/7124212m0`（集装箱综合跟踪系统·节点状态码规范，快照 2026-09-04）。
> 局限：目标页为单页规范（子链接未暴露，页面除一张 apifox 示意图外无导航链接；已两次尝试提取链接无果）→
> 本文以单页要点为准；如需子树其余文档，需补链接清单或改用可浏览工具。以下纠偏 = 外部规范对标 → 对当前项目误区/漂移的修正建议。

## 1. 抓取的规范要点（外部权威）

### 1.1 时间与地点术语

- 前缀：`S`=计划(Scheduled)、`E`=预计(Estimated)、`A`=实际(Actual)；后缀：`TD`=离开、`TA`=抵达。
- 组合：`STD/ETD/ATD`（计划/预计/实际离港）、`STA/ETA/ATA`（计划/预计/实际抵港）。
- 地点类型（places）：起始地/起运港/中转港/目的港/目的地/途径地，每地各自带计划·预计·实际到/离时间。

### 1.2 集装箱海运主线节点

`提空箱 → 装箱 → 进场 → 装船 → 离港 → (中转抵/停/卸/装/离) → 抵港 → 靠泊 → 卸船 → 可提货 → 提柜 → 送仓 → 还空箱`

### 1.3 扣留 / 放行五主体体系

| 主体 | 扣留                  | 放行      | 近似我方现状码 |
| ---- | --------------------- | --------- | -------------- |
| 海关 | 查验滞留 CUIP         | 放行 PASS | CUSTOMS_HOLD   |
| 船司 | 滞留 SRHD / 配载 PRLD | 放行 SRRS | CARRIER_HOLD   |
| 海事 | —                     | 放行 MCRP | （缺，需补）   |
| 码头 | 滞留 TMHD             | 放行 TMPS | TERMINAL_HOLD  |
| 运费 | 滞留 SRSD             | 结清 SRSE | CHARGES_HOLD   |

### 1.4 异常预警大类（含触发规则，供预警阈值对标）

`DELAY 延误 / DUMPING 甩柜 / DETENTION 滞留拥堵 / OVERDUE 超期 / CHANGE 计划变更` 等异常大类（**具体事件码全集与触发值以 API 详情枚举为准，勿臆造数量**；已确认示例 `WGITM`：离港前 48h 未进港；另有 卸船后无新事件、开/截港、到离泊变化、港口变更 等规则线索）。

### 1.5 标准箱型字典（尺寸 × 类型）

尺寸 20/40/45/53 × 类型 `GP、HC/RH（高柜）、FR/FQ（框架）、OT/OQ（开顶）、TK/TQ（罐）、RF（冷藏）、HT/HH（挂衣）`。

## 2. 与当前项目的误区 / 漂移及纠偏

| #   | 当前项目说法/漂移                                                         | 外部规范（对标）                                                  | 纠偏建议（落点）                                                                                                     |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P1  | 时间字段计划/预计/实际称呼漂移（如"计划出运/实际出运"，etd/eta 混计划意） | `S计划 / E预计 / A实际 × TD离 / TA抵` 为标准                      | 契约与 Schema 统一 `std/etd/atd`、`sta/eta/ata`；预计=ETD/ETA 不得当计划用。落 LIFECYCLE_CONSISTENCY / TARGET        |
| P2  | 14 节点链缺"进场/靠泊/放行"；"出运"与"装船/离港"存在口径漂移              | 主线含 进场→装船→离港；抵港→靠泊→卸船→可提                        | 主链状态不变，补充子里程碑 进场/靠泊/放行/可提；"出运"明确=装船离港起点。落 CONTAINER_LIFECYCLE                      |
| P3  | 扣留主体仅 海关/船司/码头/费用 4 类；无"放行"事件族                       | 五主体含 海事(MCRP) + 各主体 扣留/放行 成对                       | 状态模型补 海事放行，并把"清关放行"扩展为"放行体系"（任何主体放行/扣留均进 exception）。落 CONTAINER_STATUS_MODEL §5 |
| P4  | 异常预警阈值多为"临时候选、待 P2-12"                                      | 外部规范给出显式触发规则（进港 N 小时/卸船+N 天等）               | 作为**预警规则对标初值**采纳，再本地校准（NODE_PDCA 阈值 + P8）                                                      |
| P5  | 柜型字典初始码含 `40HQ/20HC/DV` 等别名变体                                | 标准码 `HC/RH/FR/FQ/OT/OQ/TK/TQ/RF/HT/HH`                         | 字典以标准码为主键，HQ/DV 等仅作外部别名（映射字典），补 53′ 与 RH/HT。落 MARKER? no → TARGET/dict                   |
| P6  | 地点仅"港口作业 origin/transit/destination"                               | 地点含 起始地/起运港/中转港/目的港/目的地/途径地，每地带到/离时间 | 评估扩展地点语义（起始地/目的地/途径地），供拖卡/送仓/还箱表达。落 CONTAINER_LIFECYCLE / P2-06                       |

## 3. 落地（本轮建议改与不动）

- 不改（避免漂移扩大）：14 节点主链、一单一柜、状态码固定集等已定结构保持。
- 建议改（候选，待评审）：
  1. 时间术语标准化 P1 → LIFECYCLE_CONSISTENCY §3/R1 注释 + TARGET 字段语义。
  2. 放行/扣留五主体 P3 → CONTAINER_STATUS_MODEL §5 补注 + exception 映射（含 MCRP/PASS 等）。
  3. 柜型标准码 P5 → TARGET 备注 + 字典初值说明。
  4. 异常预警对标 P4 → NODE_PDCA 阈值候选列加"外部对标值"。
- 待补充：其余子链接规范（危险品/单证/费用标准等）待链接清单后纳入。

## 4. 关联与维护

- 关联 [CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)、[NODE_PDCA](./NODE_PDCA.md)、[P2_REVIEW_CHECKLIST](./P2_REVIEW_CHECKLIST.md)。
- 本文为外部规范对标底稿；纠偏采纳后回写对应文档并在评审清单留痕。

## 附录 A · 文档/接口地图（2026-09-04 抓取；含总览 7121174m0 与其 8 详情子页）

| 页面          | 主题                                | 关键可复用规范 / 对本项目影响                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7124229m0`   | 智能甩柜预测                        | `DUMP` 预计(Y)/实际(N) 双态 + `isEsti`；装船前 36h 预警；漏装(改船名航次)/退关(运单终)闭环；事件模型 `eventCode+eventTime+isEsti+eventPlace+portCode+terminalName+source(2=飞驼预警)`；**标准描述与原始值双轨**                                                                                                                                                                                                                                 |
| `7112094m0`   | 覆盖 ~100 船司                      | 每船司 BK/BL/箱号 查询能力矩阵（√/×）；SCAC、API 传参、SINO 需 BL+箱号 组合、部分"暂不支持"→ 需降级/拦截                                                                                                                                                                                                                                                                                                                                        |
| `7113262m0`   | 中国港区+EIR 覆盖                   | LOCODE 五字码（CNYTN/CNSHK/CNCWN/CNDCB）；关单号/箱号支持、进出口方向、单+箱订阅（天津）→ 港口能力矩阵                                                                                                                                                                                                                                                                                                                                          |
| `7113318m0`   | 港区与海关节点状态码（参考）        | 港区箱 `GTOT/GTIN/LOAD/DISC/DUMP`（EMPTY/LADEN）；单证 `RELS/CUS·TML·MDG 放行/RECE/PRLD/PRER/PLAN/HOLD`；船舶 `DEPA/ARRI/CYOP/CYCL/SICT/CUCT`；海关出口/进口两链路码；**码×类别×方向 三元建模；双体系分域映射；HOLD/DUMP 独立异常**                                                                                                                                                                                                             |
| `318680551e0` | 中国港区订阅 API                    | `POST /terminal/port/event/subscribe`：`businessNumber(关单/箱号)+portCode+ieid(E/I)` → subscriptionId；Bearer；业务码 20000                                                                                                                                                                                                                                                                                                                    |
| `7113281m0`   | 170+ 港•关（海外码头）              | 港口五字码+码头简码复合键；多数"仅支持箱号"；维护中状态位；进口链路字段（Last Free Day、预约提箱、车牌号）                                                                                                                                                                                                                                                                                                                                      |
| `7124374m0`   | 美国海关+海外码头节点码             | 箱字段 `inDate/lastFreeDay/availableStatus/yardLocation/pickupChassis/outDate`；Holds `CUS/SRM/TML × Release/Hold/Inbond`；US 海关码 `55 AMS/69/3Z ISF/19 到港` 与 **`1H↔1I`、`6H↔6I` 扣留/解除成对规律**；Bond/queryResultCode/centerId                                                                                                                                                                                                        |
| `7113285m0`   | 美国 CES 查验站跟踪                 | 查验三类型 X光/尾门/强化 + `A-TCET/MET/CBPA(AQI)`；以 MBL 为键；**邮件交付：总览→分类型明细→账单** 三段；费用核对                                                                                                                                                                                                                                                                                                                               |
| `318680553e0` | 海外码头订阅 API                    | `POST /terminal/{country}/subscribe`：`ctnrno+portCode+ieid` 必填、`blno/terminalCode` 选填（日韩禁 terminalCode）→ subscriptionId；按国家路由                                                                                                                                                                                                                                                                                                  |
| `318680564e0` | 美国海关原始数据查询 API            | `getAmericaCustomsData`：`mot(A/O)+carrierCode(SCAC)+masterBLSerial`；`status_id -9/-19/19`、`MOT 40 空/10 海`、`bl_type H/M`；StatusEvents 时间线（seq/事件/时间）                                                                                                                                                                                                                                                                             |
| `484885970e0` | CBP 进口商 Bond 查询                | `getImporterBond`：EIN/SSN/CBP 号；`queryResultCode 0–4`；bondTypeCode(A/P/E…)、CEE 中心、importer→bonds+addresses 主数据+子集模型                                                                                                                                                                                                                                                                                                              |
| `7132122m0`   | 中国 EIR 覆盖                       | 11 港 EIR 能力、方向差异、`yardCode`（青岛 29 场站 support/pending_upgrade）、单号/箱号键 → 两级支持提示                                                                                                                                                                                                                                                                                                                                        |
| `7132167m0`   | 中国 EIR 节点状态码                 | 单证 `RELS YAR(放箱首节点)/CUS/CAR/VGM`（后三者青岛特有）；箱 `GTOT EMPTY 提空 / GTIN LADEN 进场返场 / GTOT LADEN 出场集港 / GTIN EMPTY 还空`；**每事件带车牌号+箱号**                                                                                                                                                                                                                                                                          |
| `7132276m0`   | 码头船舶计划支持                    | 港区代码表 + 特殊必填（宁波 CNNGB 船名航次必填）→ 按港区配置校验                                                                                                                                                                                                                                                                                                                                                                                |
| `318680519e0` | 码头船舶计划查询 API                | 时间 `ETA/ATA、ETB/ATB(靠泊)、ETD/ATD`；CY Open/Closing 开/截港、Port Close 截单、Customs Close 截关；`E*`=预计 `A*`=实际、后缀 A/B/D=抵/靠/离；上海港航次状态 预报/确报/在港/离港/取消                                                                                                                                                                                                                                                         |
| `9383878m0`   | 全球船舶跟踪（AIS）覆盖与代码       | AIS 岸基 2 分钟/卫星 10 分钟；`shiptype 0–99`(AIS/ITU 分组，70–79 货船)；`navStatus 0–15`(0 在航/1 锚泊/5 靠泊/15 未定义)；aisVesselType 6 类 + shipType 48 细分；危险品 A/B/C/D 子码；两套分类需交叉映射、离失联阈值按源区分                                                                                                                                                                                                                   |
| `7153656m0`   | 散货/RORO 覆盖（~40+ 船司提单跟踪） | 船司主数据"中英全称+CODE"；支持矩阵布尔列；CODE 须全局唯一（GOC 撞码教训）；"船踪全量 + 货踪按承运人"权限模型                                                                                                                                                                                                                                                                                                                                   |
| `9383478m0`   | 散货/RORO 节点状态码                | places type 1–5/10；S/E/A × TA/TD 成对；4 位码：进场 GITM/装船 LOBD/离港 DLPT/抵港 BDAR/靠泊 POCA/卸船 DSCH，中转 TS 前缀；descriptionCn/En 双语                                                                                                                                                                                                                                                                                                |
| `7112218m0`   | 全球集装箱/多式联运覆盖             | 北美铁路 8 家 + 船司 96 + 中国港区 16 + 海外码头；每船司 BK/BL/箱号 支持矩阵与 API 传参归组（ACI→MSK…）；组合/顺序约束（HAS 需 箱号+船名+航次 顺序、SNL BL+箱号）；KANWAY 仅箱号；铁路站点事件（装载/卸载/免用箱/可提/提货/还空）                                                                                                                                                                                                               |
| `7124364m0`   | 海铁联运节点状态码                  | 运单 5 态；订舱 3 态；~60 码按**发生地**分组（起始地/起运港/中转/目的港/目的地）；前缀 `I 进口/T 中转/F feeder/R rail/P`；动作缩写 ST 装箱/GT 闸/LD 装/DP 离/AR 抵/DC 卸/IC 进口清关/TS 中转；4 类异常；COMPLETE 终态含 拆单/取消；SRSD/SRSE 运费与放行联动；歧义码(TSDC/IWOT)须按发生地消歧                                                                                                                                                    |
| `7629026m0`   | 铁路（CIS/中亚 16 国）跟踪          | 车皮/箱号主键；换装后开始、到目的站终；蒙古/乌/土须换装后车号；低频 2–30 条/天 → 追加式入库/低频轮询；预留换装前/后车号别名关联                                                                                                                                                                                                                                                                                                                 |
| `7112150m0`   | 空运覆盖（189 航司）                | AWB 前缀为主键（IATA/ICAO 列错位需清洗）；状态显式 active/temporarily_removed/unsupported（忌空白表可用）；2h 刷新；多前缀归属（DHL 系列）；质量清洗教训（拼写/重复）                                                                                                                                                                                                                                                                           |
| `7121174m0`   | 飞驼可视 API 业务总览               | 覆盖海/铁/散货/RORO/空运；**全程 28 节点**订阅跟踪、可视化 IFRAME 地图（卡车/船舶/铁路位置+港口拥堵+天气）、异常预警推送（海关查验/甩柜/ETD 延误/中转滞留/ETA 延误/码头超期/超期用箱）、AI ETA（3000 万+记录+AIS）、**AUTO 自动识别船司**、全球船期/码头船期计划（开截港/到离泊/截关/截单）；出口工厂装箱与进口送货两场景链路；**子链接=各 API 详情页**                                                                                         |
| `318680523e0` | 集装箱综合跟踪（订阅+查询）主 API   | `POST /application/v1/query`；`billNo+containerNo`（单号权威、箱号过滤）、`carrierCode`(可 AUTO)与 `portCode+isExport` 成对必填、`billCategory` BL/BK、businessNo 禁 `#&?/`；响应 `actualParam` 规范化回显；`source` 0港区>1船司>2飞驼/AIS3；`isEsti` Y/N；statusCategory COMPLETE+`endTime` 终止；places 逐地 `sta/eta/ata std/etd/atd`+AIS 时间；`terminalPlan`(开截港/截单/截关)；`document`(packinglist+vgm)；FCL/LCL；carrier status 0/1/2 |
| `7111884m0`   | 可视化嵌套 IFRAME 地图              | 嵌入 URL+`key(clientId)`（key≠token secret）；**必须先订阅且参数一致**；`hiddenReference` 脱敏、`lang` zh/en/jp、底图三风格；覆盖 海运+卡车送仓/还箱、海运+铁路、轨迹预测；`podCode` 仅展示不参与计算                                                                                                                                                                                                                                           |
| `327653391e0` | 综合跟踪（增量+预警推送）webhook    | 预警规则范式：**计划事件前 N 小时 + 里程碑缺失**（例 `WGITM`：ETD-48h 未进港）；字段 `eventCategory/eventCode/eventTime/portTimeZone/equipmentCode`；`dbtype` 1增/2改/3删增量、`offLoadOfCarrier` 甩柜、`source` 置信度；可选 HmacSHA1 签名头 `x-ft-*`；`endTime` 停止推送                                                                                                                                                                      |
| `318680526e0` | 箱/单智能识别船司                   | `POST /container/match`：`businessNumber`→`matchCategory`(MASTERBILL/CONTAINER/B OOKING)+`matchCarrierCode[]`（可多）；按号码规则自动判定                                                                                                                                                                                                                                                                                                       |
| `318680515e0` | 全球港到港船期查询                  | 直达+中转（transits 每段方式+港+时区+eta/etd）；`routeEtd/Eta` 班期(周几)、`staticEtd/Eta` 计划；截关族 `cyCutoff/siCutoff/vgmCutoff/bookingCutoff/inlandCutoff/cvCutoff`；共舱 shareCabins；`solutionCode` 去重；transportMode 含 VESSEL/TRUCK/RAIL/FEEDER/BARGE；20000/20001                                                                                                                                                                  |
| `318680518e0` | 全球船舶船期（航次挂靠）            | `service(航线)` / `transports(按 locationSequence 挂靠港+码头 POTE/泊位 BRTH)` / `transportEvents(ACT 实际/EST 预计 × ARRI 抵/DEPA 离)`；`voyageGroup` 往返循环；港口 五字码+时区偏移+经纬度；20000/20001                                                                                                                                                                                                                                       |

> 注：总览页锚点与详情页主题存在个别错位（总览把 7124229m0 标为“智能ETA预测”，其实际内容为甩柜预测），以详情页实际内容为准。

## 附录 B · 综合纠偏（对当前项目新增/细化，候选）

| #   | 纠偏                                                                                                                                                                                                      | 落到                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| W1  | **外部事件载荷共性**：供应商常见 `eventCode + eventTime + isEsti + place + source`；原始载荷保留为 R/S 证据，经 Adapter 映射到 GC-003/GC-004 的内部规范事件，不能直接成为我方共享契约                     | INTEGRATION / LIFECYCLE R0 / 事件契约                                |
| W2  | **映射字典键是上下文复合键**（码×类别×方向/主体），非扁平码——如 GTOT EMPTY/LADEN、RELS YAR/CUS、`1H↔1I` 成对                                                                                              | D12/映射字典、P2-04、P2-09                                           |
| W3  | **双体系/分域跟踪**：码头作业、海关监管、陆侧 EIR、船舶计划各自独立事件域，按源分域映射，不强行合并                                                                                                       | INTEGRATION / 状态模型（异常域）                                     |
| W4  | **港口/船司能力与差异规则**（LOCODE 五字码、方向 E/I、单号/箱号/组合查询、按港必填如 CNNGB 船名航次、yardCode 两级、暂不支持位）→ 港口/船司能力矩阵 + 按区域校验配置                                      | P2-04 字典、导入校验、INTEGRATION                                    |
| W5  | **扣留/放行/查验深化**：五主体×Release/Hold/Inbond + US `1H↔1I` 成对 + AMS/ISF/Bond/查验(CES: X光/尾门/强化·TCET/MET/CBPA) 分轨                                                                           | CONTAINER_STATUS_MODEL §5、MARKER(phytosanitary→CBPA/AQI)、exception |
| W6  | **进口链路子里程碑**：AMS 55→69、ISF 3Z、到港 19、各方放行→提柜 outDate；陆侧 YAR 放箱首节点→提空/集港/返场/还空（车牌+箱号必带）                                                                         | CONTAINER_LIFECYCLE 子里程碑、K6/K7、K2(车牌)                        |
| W7  | **订阅/查询/邮件交付模式**：async subscribe→subscriptionId 轮询/回调、按国家路由、businessNo 回显、20000 业务码、Bond 查询合规；邮件式服务交付（对齐一键转发）                                            | INTEGRATION、action 邮件、P5 合规                                    |
| W8  | **状态码语义随场景复用**：校验须带 上下文类型/方向 而非裸码映射                                                                                                                                           | 状态机映射、P2-09                                                    |
| W9  | **时间/船期字段命名对齐**：ETA/ATA、**ETB/ATB(靠泊)**、ETD/ATD；CY Open/Closing 开/截港、Port Close 截单、Customs Close 截关；`E*` 预计/`A*` 实际 + A/B/D 后缀；上海式航次状态枚举                        | LIFECYCLE R0、TARGET、港口作业 C                                     |
| W10 | **承运人/码头能力矩阵与路由**：每船司 BK/BL/箱号支持、API 传参归组（MSK/CMA…）、组合/顺序必填（HAS/SNL）、仅箱号（KANWAY/多数海外码头）；承运人码全局唯一约束（GOC 教训）                                 | P2-04 字典、导入校验配置、INTEGRATION                                |
| W11 | **多式联运事件按发生地分组 + 码前缀**（I 进口/T 中转/F feeder/R rail/P port）+ 动作缩写 ST/GT/LD/DP/AR/DC/IC/TS；**歧义码按发生地消歧**（TSDC/IWOT）；SRSD/SRSE 运费与放行联动                            | 映射字典（扩展 W2）、exception、G4                                   |
| W12 | **换装/改号与低频事件**：换装前后车号别名关联（铁路）、低频追加式入库/低频轮询阈值（2–30 条/天）                                                                                                          | INTEGRATION、P2-12 采集节奏                                          |
| W13 | **跨模式数据质量纪律**：前缀为主键、状态显式三态而非空白、多前缀归属、拼写/列错位清洗（空运教训）→ 我方承运人/字典主数据校验                                                                              | P2-04、导入清洗                                                      |
| W14 | **可视化/ETA/预警外部补充**：28 节点跟踪、可视化 IFRAME（位置/拥堵/天气）、AI ETA、AUTO 自动识别船司、异常预警分类、全球/码头船期计划均可作为外部能力补充或对标（可嵌入我方工作台），子链接=各 API 详情页 | UX 工作台、ETA/预警、INTEGRATION（V3）                               |

> 以上均候选；建议下一轮把 W1–W8 并入评审清单（§3.1 后）并按需回写各领域文档。
