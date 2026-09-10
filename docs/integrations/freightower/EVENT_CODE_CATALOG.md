# 飞驼事件与状态码目录

> 状态：**外部供应商码表（参考；批准的海关映射以 CUSTOMS_EVIDENCE_MAPPING_V1 为准）** · 2026-09-10

## 使用规则

落库映射至少包含：`providerCode`、`context`、`direction`、`qualifier`、`meaning`、`evidenceLevel`、`canonicalCandidate`、`lifecyclePolicy`、`verificationStatus`。任何未知码必须显式进入未映射队列并告警，禁止用中文描述猜测状态。

## 综合跟踪

供应商总状态：`START` 开始、`PROCESS` 处理中、`COMPLETE` 完成更新、`NODATA` 无数据、`ABNORMAL` 异常。订舱状态：`Processing`、`Confirmed`、`Cancelled`。

| 分类       | 代码                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| 主事件     | `STSP STUF GITM LOBD DLPT TSBA TSCA TSDC TSLB TSDP BDAR POCA DSCH PCAB STCS STRP RCVE`   |
| 扣留/放行  | `DUMP CUIP PASS SRHD PRLD SRRS MCRP TMHD TMPS SRSD SRSE`                                 |
| 铁路       | `IRLB IRDP IRAR IRDS`                                                                    |
| 支线/驳船  | `FDLB FDDP FDBA FDDC`、`BGLB BGDP BGBA BGDC`                                             |
| 场站及末端 | `GWIT GWOT GTIN GTOT FETA PLFD`                                                          |
| 预警       | `WGITM WDLPT WDUMP WTSBA WPCGI WBDAR WGTOT WETA WSTCS WRCVE WCYOP WCYCL WETB WETD WPORT` |

地点 `type`：1 起始地、2 起运港、3 中转港、4 目的港、5 目的地、10 途经地。`DUMP + isEsti=Y` 为预计甩柜；`isEsti=N` 虽称实际甩柜，但 `source=2` 仍属于飞驼判断，应进入异常核查而非直接执行不可逆转换。

## 港区与 EIR

- 港区示例：`EST + TRANSPORT + ARRI` 预计靠泊；`ACT + EQUIPMENT + GTIN + LADEN` 重箱进港。
- EIR：`RELS+YAR` 放箱，`RELS+CUS` 海关放行（青岛），`RELS+CAR` 装箱单，`RELS+VGM` VGM。
- EIR 箱动态：`GTOT+EMPTY` 提空箱，`GTIN+LADEN` 进场/返场，`GTOT+LADEN` 出场/集港，`GTIN+EMPTY` 还空箱。

## 中国海关

| 阶段           | 代码与含义                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| 舱单/运抵      | `BLA` 预配舱单接受；`ASB` 运抵退单；`AAD` 运抵接受；`ASA` 已运抵                             |
| 申报/查验/放行 | `EDC` 报关入库；`CDC` 审结；`CPI` 查验；`PAS` 放行；`DEL` 删单；`CLR` 结关；`BLR` 提运单放行 |
| 装载/理货      | `BCB/BCA` 装载舱单退单/接受；`TRB/TRA` 理货退单/接受                                         |
| 出港           | `ETC/ETP` 出港预报受理/通过；`ATC/ATP` 出港确报受理/通过；`EDEP` 出境离港                    |
| 进口           | `EMC EMP EFC EFP AFC AFP ACC ACP DTE IDEP MFA MFB MFR BFA BFB`（具体中文语义上线前逐码核验） |

`PAS`、`BLR`、`CLR`、`ATP` 表示不同事实，严禁归并成单一“海关完成”。`statuscd=null` 不得根据 `note` 自动推进。

## 美国海关与海外码头

- 美国海关事件码不在本摘要重复维护；申报、到港、查验、扣留与解除的批准/候选全集以 [CUSTOMS_EVIDENCE_MAPPING_V1 §7](./CUSTOMS_EVIDENCE_MAPPING_V1.md#7-美国海关映射) 为唯一映射表，其中包括 `1A/1B/1F/6H/6I/4A`。任何代码只有在该表及适用版本中均不存在时才判未知。应按提单和 hold 类别构建状态投影，不能因单个 release 事件清空其他扣留。
- 海外码头 `holdCategory`：`CUS` 海关、`SRM` 船公司、`TML` 码头；`holdStatus`：`Release`、`Hold`、`Inbond`。海关接口级批准映射见 [CUSTOMS_EVIDENCE_MAPPING_V1](./CUSTOMS_EVIDENCE_MAPPING_V1.md)。
- 只有对象匹配且有效的 `CUS + Release` 才能成为海关放行候选，仍须通过 Logixs 生命周期守卫。
- Bond `queryResultCode=0..4`、`importerStatus=A/T`、`isSufficient=Y/N` 只描述担保资格，不代表货物放行。

现网界面样本验证（2026-09-08，R）：同一海外码头货柜可同时出现 `SRM + Hold` 和 `TML + Hold`，页面综合可提箱状态为否。两类 Hold 必须独立聚合；`SRM` 不得仅凭业务人员称其为“查验记录”就映射为海关查验，缺少 `CUS` 行也不得推断海关已经 Release。脱敏样本见 [CUSTOMS_BUSINESS_SAMPLE_008](../../product/domain/CUSTOMS_BUSINESS_SAMPLE_008.md)。
