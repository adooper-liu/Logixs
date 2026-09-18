# 云当网推送载荷结构

> 状态：**外部供应商载荷结构（参考，待联调复核）** · 2026-09-18

本文只描述**云当网回调我方地址**的载荷。我方可主动调用的订阅/查询/下载接口见 [API_CATALOG](./API_CATALOG.md)。

## 1. 通用推送契约

1. 推送地址由**我方提供**并交付云当网（文档原文：「请贵司提供接收推送数据的API地址」）。
2. 我方必须同步返回确认信封，否则对方可能重推：

```json
{ "code": 200, "type": "S", "message": "成功", "time": "2026-09-18 10:00:00" }
```

`type` 取 `S`=成功、`W`=警告、`E`=异常。**接收端必须在返回成功前完成耐久化**，解析与业务处理异步执行——与 [ADAPTER_AND_SYNC_DESIGN §接收链](./ADAPTER_AND_SYNC_DESIGN.md) 和同步可靠性契约的要求一致。

3. 时间字段一律为 `"yyyy-MM-dd HH:mm:ss"` 字符串，**无时区**，无值为 `""`。详见 [FIELD_AND_TIME_SEMANTICS](./FIELD_AND_TIME_SEMANTICS.md)。

## 2. 统一的同步状态块

所有数据域的推送载荷**共享同一组同步状态字段**。它们描述的是"云当网的采集进度"，不是业务事实，必须独立存储、不得复用业务枚举：

| 字段                                 | 取值                                                      | 含义                        |
| ------------------------------------ | --------------------------------------------------------- | --------------------------- |
| `status` / `errorDes`                | `B`=订阅中、`S`=订阅成功、`F`=订阅失败                    | 订阅状态                    |
| `endStatus`                          | `''`=未结束、`E`=正常结束、`EF`=强制结束                  | 结束状态                    |
| `endId`                              | `0`=未结束、其他=已结束                                   | 结束标记（雪花 id，内部用） |
| `trackStatus`                        | `T`/`B`=跟踪中、`E`=跟踪结束、`F`=跟踪失败                | 跟踪状态                    |
| `errorStatus` / `errorMessage`       | `T`=提示、`E`=错误、空=正常                               | 异常状态                    |
| `dataStatus`                         | `Y`=有数据、`B`=无数据、`M`=有数据但箱号不存在、空=刚订阅 | 数据状态                    |
| `firstUpdateTime` / `dataUpdateTime` | 时间字符串                                                | 首次/最近数据更新时间       |

**`E`/`EF` 只表示云当网停止更新，不是业务完成**；`dataStatus=B`（无数据）**不得生成否定业务事实，也不得清除既有事件**。

## 3. 海运跟踪推送（id 221743609）

载荷 150 个字段，是覆盖货柜主链最完整的一条。核心结构：

```text
顶层：运单级标识与航次信息
  id(云端运单关键字) · referenceNo(订阅号) · localKey(客户本地关键字,唯一)
  blNo · bkgNo · ctnrNo · carrierCd · vesselName · voyage
  plr/pol/pod/pld(收货地/起运港/目的港/交货地，各有 Cd 代码与名称)
  etd/atd · eta/ata · etaPLD/ataPLD · firstETA · dlptTime(=atd)
  aisETA/aisATA/aisATD            ← 需额外开通船舶轨迹服务
  cyOpenTime/cyCutOffTime         ← 标记为「无效字段」但及时请求接口仍在用
  dschTime                        ← 标记为「无效字段」
  oldVesselName/oldVoyage/changeVslId  ← 换船
  shipRolled(BCL=整票订舱取消) · remark · orgCode
carriges[]   航程节点数组（type: 1=大船 2=驳船 3=陆运）
  polCd/podCd · etd/atd/eta/ata · vesselName/voy · aisAtd/aisAta
oceanNodes[] 关键流程结点数据组（**按节点聚合，非按箱**）
  stateCode · stateDesc · stateDescCN · number(序号)
  count(已发生动态箱数) · total(箱总数)
  planTime / estimateTime / actualityTime   ← 计划/预计/实际三列分离
  aisEstimateTime / aisActualityTime
  place / placeCd · vesselName / voy · isCurrent
ctnrInfos[]  箱子信息数组
  ctnrNo · sealNo · ctnrSize · ctnrType · vgm
  pkgs/gwgt/vgm                   ← 标记为「无效字段」
  currentStatusCd / currentStatus / currentStatusTime / currentPlaceCd / currentPlace
  ctnrStatus[]    该箱动态节点数组（新增与更新）
  deleteStatus[]  该箱删除的动态节点数组
  isRolled(1=甩柜 2=异常)
  chargeDatas[]   chargeType / lfd(免箱期) / freeDayDesc(免费天数) —— 仅 OOCL 船东
```

### 3.1 `ctnrStatus[]` 与 `deleteStatus[]`：逐事件的幂等抓手

每条动态（两个数组结构相同）包含：

| 字段                          | 说明                                                  |
| ----------------------------- | ----------------------------------------------------- |
| `id`                          | **动态关键字，雪花 id** —— 逐事件唯一                 |
| `statusCd`                    | 动态代码，须先按 [CODE_TABLES](./CODE_TABLES.md) 映射 |
| `statusDesc` / `statusDescEn` | 供应商描述（中文名仅供参考）                          |
| `eventTime`                   | 状态发生时间                                          |
| `place` / `placeCd`           | 发生地点                                              |
| `vesselName` / `voyage`       | 船名航次                                              |
| `transportMode`               | `TRUCK`/`RAIL`/`FEEDER`/`OCEAN`                       |
| `isEstimate`                  | `true`=预计、`false`=实际                             |
| `sourceCd`                    | `1`=船东、`2`=码头、`4`=云当计算                      |
| `dataState`                   | `add`=新增、`update`=更新、`delete`=删除、空=不变     |
| `dateUpdateTime`              | 数据更新时间                                          |

**`ctnrStatus[].id` 是本知识库中唯一可以直接充当 Inbox 幂等键的字段。** 没有它时，退化为 `运单 id + statusCd + eventTime + ctnrNo + 载荷哈希` 组合——这正是 [ADAPTER_AND_SYNC_DESIGN](../freightower/ADAPTER_AND_SYNC_DESIGN.md) 早已写下的降级规则。

### 3.2 更正与撤回内建

云当网用 `deleteStatus[]` 显式表达"这条动态被删除了"，且 `dataState=delete`。这对应 Logixs 的 `EvidenceRelationType`（`corrects`/`revokes`/`supersedes`）——**不得原地改写历史**，应当追加指向原事件的新记录。这是相对飞驼的一项实质性改善：飞驼的更正语义在文档里没有明确，云当网把它做进了载荷结构。

## 4. 及时请求推送（id 289373000）

外层是 `data[]` 数组。相对海运跟踪推送的差异：

- 保留完整的 `ctnrInfos[].ctnrStatus[]` 动态结构（含 `sourceCd`、`isEstimate`）。
- 增加 `cyOpenTime`（开港日期）、`cyCutOffTime`（截港日期）——这两个在海运跟踪里被标为无效字段，此处仍在用。
- 增加 `requestId`（请求号，唯一）、`batchId`（批次号）、`pickupreference`（提货信息，如 Firms code）、`railcode`（铁路公司代码）、`terminalDtp`/`terminalPld`（目的港/交货地码头）。

`pickupreference` 与 `railcode` 是提柜与铁路段的有用上下文，不要丢弃。

## 5. 中国港区推送（id 228301722）

载荷 77 个字段，结构为**扁平运单级 + `ctnrInfos[]`**，没有逐动态数组，动态信息在箱级字段里：

```text
localKey · id(运单id) · referenceNo(订阅号) · portNo(港区单号)
blType(BL=提单号/CN=箱号) · portCd(港口代码) · ieid(I/E)
dataUpdateTime · firstUpdateTime · endStatus · endId · trackStatus
errorStatus · errorMessage · dataStatus · extendNo
ctnrInfos[] → blNo · ctnrNo · owner · vslName · voy · ieid · csize …
```

**没有事件级 id**，幂等必须靠 `id + dataUpdateTime + ctnrNo` 组合。港区数据的价值在于`海放`/`码放`/`查验`/`VGM`/`拖车号`/`配载`六类信息，但**能力按港口不对称**（详见 [API_CATALOG §2.2](./API_CATALOG.md)）。

## 6. 场站数据推送（id 240827872）

载荷 95 个字段，外层有统一同步块 + `subBills[]` 分单数组。分单字段覆盖 `vslName`/`voy`/`carrierCd`/`depotCd`(场站)/`terminalCd`(码头)/`blNo`/`mblNo`/`declarationNo`(报关单号)/`tspCd`(中转港)/`dtpCd`(目的港)/`podCd`(卸货港)——**单证与地点链完整**，是做对象消歧的好材料。

## 7. 报关状态推送（id 275543902）

载荷 26 个字段 + `customsStatus[]`：

```text
entryId(报关单号) · entDeclNo(检验检疫号) · blNo(订阅号) · ieId(I/E)
customsStatus[] → statusCd(回执状态代码) · channelName(回执状态)
                  note(回执备注) · noticeDate(回执日期) · entryId
```

状态代码见 [CODE_TABLES §报关状态码](./CODE_TABLES.md)。海关回执按 `entryId` 聚合，**同一提单可能对应多个报关单**。

## 8. 美国清关推送（id 444327937）

载荷 109 个字段，主单 MBL + 分单 HBL 双对象。关键字段：

```text
blNo · mblNo · carrierCd · carrier · scac · mot(A=空运/O=海运)
statusCd / status / statusCn           最后处置状态
statusType                             最后处置状态类型
  NOF=未申报 · DSP=海关审核中 · HOLD=海关扣留
  RMHOLD=解除扣留 · RLS=海关放行 · CANCEL=撤销报关
statusDate · vslName · voy · polCd/podCd · atd · ata · piece
```

两条必须落进适配器的规则：

1. **文档明言主单与分单的海关事件码可能不同步**，须以最新时间为准，并分别保留两个对象各自的轨迹。
2. `statusType` 的六个取值中，只有 `RLS` 是放行；`RMHOLD` 是**解除扣留**而非放行——与 [证据来源权威契约 §3](../../product/domain/EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md) 及飞驼知识库对 `1H↔1I` 的处理保持一致：**单个 release 事件不得清空其他扣留**。

## 9. 全球码头数据推送（id 342345965）

载荷 78 个字段，箱级（无动态数组）：

```text
ctnrNo · ctnrType · portCd/port · terminalCd/terminal · ieId(暂不支持出口)
countryCd(US=美国) · blNo · vessel · voyage · carrier/carrierCd(持箱人)
inTime(卸货时间/进场时间) · outTime(提柜时间/出场时间)
lastFreeDay(最后免箱期) · availableDate(可提箱日期)
availableStatus( YES=可提箱 / NO=不可提箱 )
timeZone(时区) —— 「如为空则表示当地时间」
```

两点必须注意：

- **`availableStatus` 是云当网的计算结果，不是码头原始事实。** 按证据权威契约，它属**供应商推断**，只能作为可提箱判断的佐证，不得单独驱动提柜节点。这与飞驼知识库对"可提箱守卫"的处理一致。
- `timeZone` 字段的存在证实了供应商内部有"当地时间"概念，但**载荷只给时区名或空值，不给偏移量**，因此仍无法可靠还原 UTC 时刻。见 [FIELD_AND_TIME_SEMANTICS](./FIELD_AND_TIME_SEMANTICS.md)。

## 10. 船期分页推送（id 231335702 / 403060611）

与其他数据域不同，船期推送是**分页批量**而非增量事件：

- 1.0：按「起运港-目的港」分组，一页 500 条。
- 2.0：一页 200 条；区分船东官方船期与共舱船期（共舱按船名 + ETD 判定）；可配置只推官方船东船期。

分页推送需明确**暂停、续传与重复投递**语义（待供应商确认，见 [API_CATALOG §13](./API_CATALOG.md)）。船期属计划类数据，**不推进任何实际节点**。

## 11. 幂等键选取建议

按可用性从高到低：

| 优先级 | 键                                      | 适用                        |
| ------ | --------------------------------------- | --------------------------- |
| 1      | `ctnrStatus[].id`（动态关键字雪花 id）  | 海运跟踪推送、及时请求推送  |
| 2      | `localKey` + `statusCd` + `eventTime`   | 我方订阅时可自填 `localKey` |
| 3      | 运单 `id` + `dataUpdateTime` + `ctnrNo` | 港区、场站、报关、全球码头  |
| 4      | 载荷稳定哈希                            | 兜底                        |

`localKey`（客户本地关键字，≤38 字符，唯一）是**我方在订阅时自填**的字段，可直接写入 Logixs 的对象引用，从源头省掉一部分对象消歧。**建议把它纳入订阅规范。**

## 12. 待确认

1. 推送的重试策略、超时、最大重试次数与失败告警方式。
2. 推送地址的验签协议（是否有签名头）。
3. 分页推送的暂停/续传/去重语义。
4. `deleteStatus[]` 的触发条件：是供应商纠错，还是业务撤销，两者是否需要区分。
5. 同一运单重复推送时，`ctnrStatus[]` 是全量还是增量。
