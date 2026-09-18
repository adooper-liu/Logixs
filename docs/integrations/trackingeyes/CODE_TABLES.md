# 云当网状态码与代码表

> 状态：**外部供应商码表（参考，待联调复核）** · 2026-09-18

## 使用规则

落库映射至少包含：`providerCode`、`context`、`direction`、`qualifier`、`meaning`、`evidenceLevel`、`canonicalCandidate`、`lifecyclePolicy`、`verificationStatus`。任何未知码必须显式进入**未映射队列并告警**，禁止用中文描述猜测状态。

供应商原文声明：「动态节点的中文名称仅供参考！可根据您的业务需求，通过代码（CODE列）自行映射所需的中文描述。」——**中文名不是契约，映射目标必须落到 Logixs 内部语义事件码。**

映射条目按 `(provider, rawCode, context)` 建档，与 [飞驼事件码表](../freightower/EVENT_CODE_CATALOG.md) **分别维护**，即使码面相同也不得合并成同一行（见 [README §5](./README.md#5-与飞驼码表的对照重要)）。

## 海运动态码

共 42 个。来源：海运数据 / 海运状态码（doc 5259334）。

| #   | 代码 | 英文描述                                           | 中文名称       | 备注           |
| --- | ---- | -------------------------------------------------- | -------------- | -------------- |
| 01  | BKCF | BOOKED                                             | 订舱           |                |
| 02  | STSP | EMPTY PICKUP                                       | 提空箱         |                |
| 03  | FDLB | FEEDER VESSEL LOADED ON BOARD                      | 支线装船       |                |
| 04  | FDDP | FEEDER DEPRTURED                                   | 支线开航       |                |
| 05  | FDBA | FEEDER ARRIVED                                     | 支线抵港       |                |
| 06  | FDDC | DISCHARGED FROM FEEDER                             | 支线卸船       |                |
| 07  | CGGI | CARGO LOADED                                       | 装箱           |                |
| 08  | CLOD | CONTAINER SEALED                                   | 封箱           |                |
| 09  | ERDP | OB INTERMODAL DEPARTED                             | 铁运发车       |                |
| 10  | ERAR | OB INTERMODAL ARRIVED                              | 铁运到达       |                |
| 11  | FCGI | CARGO RECEIVED FROM YARD                           | 重箱返场/入货  |                |
| 12  | CYTC | GATE OUT FROM YARD                                 | 集港           |                |
| 13  | GITM | GATE IN TO POL TERMINAL                            | 起运港进场     |                |
| 14  | PASS | CUSTOMS RELEASE                                    | 海关放行       | 综合接口才提供 |
| 15  | CUIP | CUSTOMS INSPECTION                                 | 查验           | 综合接口才提供 |
| 16  | SUOT | OUTBOUND CUSTOMS SHUT OUT                          | 退关           | 综合接口才提供 |
| 17  | TMPS | TERMINAL RELEASE                                   | 码头放行       | 综合接口才提供 |
| 18  | TMCL | TERMINAL CANCEL RELEASE                            | 码头取消放行   | 综合接口才提供 |
| 19  | TMUT | OUTBOUND CANCELLED                                 | 退载           |                |
| 20  | LOBD | LOADED ON BOARD AT PORT OF LOADING                 | 装船           |                |
| 21  | DLPT | DEPARTURE FROM PORT OF LOADING                     | 离港/开航      |                |
| 22  | TSBA | ARRIVED AT TRANSHIPMENT PORT                       | 中转抵港       |                |
| 23  | TSDC | DISCHARGED FROM TRANSHIPMENT PORT                  | 中转卸船       |                |
| 24  | TRDP | TRUCK DEPARTURE                                    | 卡车离开       |                |
| 25  | TRAR | TRUCK ARRIVAL                                      | 卡车抵达       |                |
| 26  | TSLB | LOADED ON BOARD AT TRANSHIPMENT PORT               | 中转装船       |                |
| 27  | TSDP | DEPARTURED FROM TRANSHIPMENT PORT                  | 中转开航       |                |
| 28  | BDAR | ARRIVED AT PORT OF DISCHARGE                       | 抵达卸货港     |                |
| 29  | DSCH | DISCHARGED AT PORT OF DISCHARGE                    | 卸货港卸船     |                |
| 30  | DGOT | GATE OUT FROM POD                                  | 卸货港码头出场 |                |
| 31  | DCRL | DESTINATION CUSTOMS RELEASED                       | 卸货港海关放行 |                |
| 32  | IRLB | LOADED ON RAIL AT INBOUND RAIL ORIGIN              | 进口铁运装箱   |                |
| 33  | IRDP | INBOUND RAIL DEPARTURED                            | 进口铁运发车   |                |
| 34  | IRAR | INBOUND RAIL ARRIVED                               | 进口铁运到站   |                |
| 35  | IRDS | UNLOADED FROM RAIL AT INBOUND RAIL DESTINATION     | 进口铁运卸箱   |                |
| 36  | PDAR | ARRIVED ON PLACE OF DELIVERY                       | 抵达目的地     |                |
| 37  | PDDS | DISCHARGED ON PLACE OF DELIVERY                    | 目的地卸箱     |                |
| 38  | PDRC | RECEIVED FOR IMPORT TRANSFER                       | 目的地收货     |                |
| 39  | CGRL | CARRIER CARGO RELEASE                              | 船东放货       |                |
| 40  | CTUP | CONTAINER UNPACKING                                | 集装箱拆箱     |                |
| 41  | STCS | GATE OUT FROM INBOUND CY FOR DELIVERY TO CONSIGNEE | 货主提柜/货    |                |
| 42  | RCVE | EMPTY CONTAINER RETURNED                           | 还空箱         |                |

**必须分开、严禁归并的同族码**：

- `PASS`（海关放行）、`DCRL`（卸货港海关放行）、`TMPS`（码头放行）、`CGRL`（船东放货）是**四个不同主体的放行**，合并成"已放行"会丢掉是谁放的，直接影响可提箱判断。
- `STCS`（货主提柜）、`DGOT`（码头出场）、`CYTC`（集港）描述三个不同动作，不得都映射成"提柜"。
- `DSCH`（卸货港卸船）、`PDDS`（目的地卸箱）、`CTUP`（拆箱）分别对应 Logixs 的到港、卸柜、卸空三个节点，不可合并。

## 报关状态码

共 30 个（通用 6 + 出口 13 + 进口 17）。来源：关务数据 / 报关状态代码表（doc 6311578）。

**通用（6）**

| 代码 | 名称     |
| ---- | -------- |
| CPI  | 查验     |
| CDC  | 审结     |
| EDC  | 入库     |
| PAS  | 放行     |
| CLR  | 结关     |
| CTN  | 关税通知 |

**出口（13）**

| 代码 | 名称                     | 代码 | 名称                        |
| ---- | ------------------------ | ---- | --------------------------- |
| TRA  | 出口理货报告（接受申报） | BLA  | 预配舱单（接受申报）        |
| TRB  | 出口理货报告（退单）     | ETP  | 出港动态预报-海关（已通过） |
| ASA  | 出口运抵报告（接受申报） | ETC  | 出港动态预报-海关（已受理） |
| ASB  | 出口运抵报告（退单）     | ATP  | 出港动态确报-海关（已通过） |
| BCA  | 装载舱单（接受申报）     | ATC  | 出港动态确报-海关（已受理） |
| BCB  | 装载舱单（退单）         | EDEP | 出境确报离港时间            |
| BLR  | 预配舱单（提运单放行）   |      |                             |

**进口（17）**

| 代码 | 名称                        | 代码 | 名称                                    |
| ---- | --------------------------- | ---- | --------------------------------------- |
| EMP  | 进港动态预报-海事（已通过） | BFA  | 进口理货报告（接受申报）                |
| EMC  | 进港动态预报-海事（已受理） | BFB  | 进口理货报告（已申报）                  |
| EFP  | 进港动态预报-海关（已通过） | MFR  | 原始舱单（主要数据）-海关（提运单放行） |
| EFC  | 进港动态预报-海关（已受理） | MFA  | 原始舱单（主要数据）-海关（接受申报）   |
| AFP  | 进港动态确报-海关（已通过） | MFB  | 原始舱单（主要数据）-海关（已申报）     |
| AFC  | 进港动态确报-海关（已受理） | DTE  | 进境确报抵港时间                        |
| ACP  | 进港动态抵港-海关（已通过） | IDEP | 进境实际抵港时间                        |
| ACC  | 进港动态抵港-海关（已受理） |      |                                         |

`PAS`、`BLR`、`CLR`、`ATP` 表示**四个不同事实**，严禁归并成单一"海关完成"。这一组与飞驼中国海关码表存在差异，**不得跨供应商复用映射条目**。

## 空运状态码

共 13 个。来源：空运数据 / 空运状态码（doc 5288533）。

| #   | 代码 | 名称     | 英文描述                     |
| --- | ---- | -------- | ---------------------------- |
| 01  | BKD  | 订舱     | BOOKING                      |
| 02  | RCS  | 收货     | CARGO RECEIVED               |
| 03  | MAN  | 预配     | MANIFESTED                   |
| 04  | DEP  | 起飞     | DEPARTURE                    |
| 05  | TAR  | 中转抵达 | TRANSIT PORT ARRIVAL         |
| 06  | TDE  | 中转起飞 | TRANSIT PORT DEPARTURE       |
| 07  | TRF  | 中转卸货 | CARGO UNLOAD AT TRANSIT PORT |
| 08  | ARR  | 抵达     | ARRIVAL                      |
| 09  | RWB  | 收单     | DOCUMENT RECEIVED            |
| 10  | RCF  | 卸货     | RECEIVE FROM FLIGHT          |
| 11  | CUS  | 清关     | CUSTOMS CLEARANCE            |
| 12  | NFD  | 到货通知 | ARRIVAL DOCUMENT DELIVERED   |
| 13  | DLV  | 提货     | DELIVERED                    |

## 快递主状态码

共 9 个。来源：快递数据 / 主状态代码表（doc 6763487）。子状态码表（doc 6763499）、承运商代码表（doc 6763503，约 10 万字）、承运商集团表（doc 6763508）、特殊承运人代码表（doc 6763511）、国家地区 ISO Alpha-3 代码表（doc 6763454）体量大，按需从文档站查阅，本目录不转写。

| 代码               | 中文释义                                       |
| ------------------ | ---------------------------------------------- |
| Pending            | 暂无数据，待定                                 |
| InfoReceived       | 承运人已收到发货人的请求，即将提货             |
| In Transit         | 承运人已接受或提取托运人的货物，货物正在运输中 |
| OutForDelivery     | 承运人即将交付货物，或者准备提货               |
| AttemptFail        | 承运人试图交付但未成功，通常会留通知并再次交付 |
| Delivered          | 成功交付货物                                   |
| AvailableForPickup | 包裹已到达附近取件点，可供取件                 |
| Exception          | 海关扣留、未交付、退回发件人或任何运输例外     |
| Expired            | 货物 30 天内没有跟踪信息，已过期               |

快递与货柜主链无直接关系；若未来引入末端派送场景，`Exception` 的语义（混合了海关扣留与一般运输异常）必须先拆分再映射。

## 港杂费代码

共 33 个。来源：其他数据接口 / 通用港杂费 / 港杂费代码清单（doc 5701491）。

| 代码               | 费用名称               | 代码           | 费用名称               |
| ------------------ | ---------------------- | -------------- | ---------------------- |
| doc_fee            | 单证费                 | isps_fee       | 安保费                 |
| edoc_fee           | 出口单证费             | cmc_fee        | 集装箱管理费           |
| tlx_fee            | 电放费                 | chc_fee        | 集装箱操作费           |
| info_fee           | 信息传输费             | bkg_fee        | 订舱费/柜              |
| mdf_fee            | 舱单费/票              | epl_fee        | 电子装箱单费/柜        |
| bkf_fee            | 订舱费                 | bko_fee        | 订舱操作费             |
| edi_fee            | EDI 传输费             | eir_n_seal_fee | 箱单费（含铅封）       |
| op_fee             | 操作费                 | doc_c_fee      | 文件费                 |
| dhc_fee            | DHC 文件处理费         | pdoc_fee       | 放箱单证费             |
| bka_fee            | 订舱代理费             | op_c_fee       | 操作费/柜              |
| tra_fee            | 转关费                 | ecr_fee        | 空箱消毒费             |
| othc_fee           | 码头操作费             | soa_fee        | 船东代理费/柜          |
| seal_fee           | 封志费                 | barge_fee      | 驳船综合费             |
| eir_fee            | 设备交接单费           | bl_bkf_fee     | 直线订舱费             |
| tsc_fee            | 场站费                 | eif_fee        | 集装箱设备检查费       |
| psc_fee            | 港杂费                 | qua_fee        | 检疫费                 |
| emf_fee            | 设备管理费             | csc_fee        | 提箱费                 |
| export_service_fee | 出口服务费（MSK 特有） | esf_fee        | 出口服务费（HPL 特有） |
| brf_fee            | 舱位管理费             |                |                        |

港杂费是**询价类参考数据，不是计费事实**。Logixs 的费用真相仍以合同、标准表与账单为准（见 [FEE_DEMURRAGE](../../product/domain/FEE_DEMURRAGE.md)）。

## 动态节点附属枚举

这些枚举出现在每条 `ctnrStatus[]` 动态上，是分类与权威判定的关键上下文，**不得丢弃**。

| 字段                          | 取值                                                      | 用途                                                                             |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `sourceCd`                    | `1`=船东、`2`=码头、`4`=云当计算                          | **直接支撑来源权威判定**：1/2 接近原则权威主体，4 属供应商推断                   |
| `isEstimate`                  | `true`=预计、`false`=实际                                 | 拆分预计与实际；预计不得覆盖已确认实际                                           |
| `transportMode`               | `TRUCK`=卡车、`RAIL`=铁路、`FEEDER`=驳船、`OCEAN`=海运    | 复合映射键的 context 子键；对应铁路/支线段节点                                   |
| `dataState`                   | `add`=新增、`update`=更新、`delete`=删除、空=不变         | 增量语义；`delete` 出现在 `deleteStatus[]` 中                                    |
| `isRolled`                    | `1`=甩柜、`2`=异常、空=无异常                             | 异常类事实，映射到异常而非节点推进                                               |
| `endStatus`                   | `E`=正常结束、`EF`=强制结束、`''`=未结束                  | 同步状态，**不是业务事实**                                                       |
| `trackStatus`                 | `T`/`B`=跟踪中、`E`=跟踪结束、`F`=跟踪失败                | 同步状态                                                                         |
| `errorStatus`                 | `T`=提示、`E`=异常、空=无异常                             | 同步状态                                                                         |
| `dataStatus`                  | `Y`=有数据、`B`=无数据、`M`=有数据但箱号不存在、空=刚订阅 | **`B` 不得生成否定业务事实，也不得清除既有事件**                                 |
| `ieid`                        | `I`=进口、`E`=出口                                        | 复合映射键的 direction 子键                                                      |
| `blType`                      | `BL`=提单号、`CN`=箱号、`BK`=?                            | 订阅对象类型                                                                     |
| `holdCategory` / `holdStatus` | `CUS`/`SRM`/`TML` × `Release`/`Hold`/`Inbond`             | 海外码头扣留：海关/船公司/码头三类**必须独立聚合**，单个 release 不清空其他 hold |
