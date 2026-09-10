# 飞驼官网海关接口证据索引与复合映射表 V1

> 状态：外部供应商映射 V1（实现前基线）  
> 官网取证日期：2026-09-09  
> 供应商：Freightower（飞驼）  
> 适用范围：中国海关、美国海关、海外码头和综合跟踪中的海关事实  
> 领域语义权威：[海关业务契约定稿包 V1](../../product/domain/CUSTOMS_BUSINESS_CONTRACT_V1.md)

## 1. 使用边界

本文以 `doc.freightower.com` 官网页面为供应商契约依据，定稿“飞驼原始组合如何形成 Logixs 规范事件候选及工单事实”。它不是海关法规，也不授权 Adapter 直接修改工单、案卷或主流程。

```text
飞驼原始响应
-> 按接口、方向、主体和原始码匹配本表
-> 保存不可变外部观察
-> 验证对象、时间、证据和映射版本
-> Application 统一用例
-> 工单状态机 / 海关案卷裁决 / 规范事件
-> 生命周期守卫
```

必须区分：

- HTTP/业务成功，例如 `statusCode=20000`，只代表接口调用成功。
- 订阅或查询作业状态，例如 `StatusId`、`status_id`，不代表海关状态。
- 外部业务事实，例如 `PAS`、`1H`、`CUS + Release`。
- Logixs 内部状态，只能由领域规则修改。

## 2. 官网证据索引

| 文档 ID                                                | 官网标题/接口                                     | 官网最后修改         | 本次确认内容                                                           |
| ------------------------------------------------------ | ------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| [7113318m0](https://doc.freightower.com/7113318m0)     | 中国港区与海关节点状态码                          | 页面未显示于本次摘录 | 中国出口/进口码表；港区 `shipmentEventCategory + shipmentDocType` 组合 |
| [318680557e0](https://doc.freightower.com/318680557e0) | `GET /terminal/cn/customs/getBlnoDeclare`         | 2026-07-07 08:08:42  | 按提单查询；`statuscd/noticedate/channelname/entryid`；一提单多报关单  |
| [318680558e0](https://doc.freightower.com/318680558e0) | `GET /terminal/cn/customs/getEntryIDDeclare`      | 2026-07-07 08:08:42  | 按报关单查询；`ieid/blno/entryid/endtime/status[]`                     |
| [318680523e0](https://doc.freightower.com/318680523e0) | `POST /application/v1/query`                      | 2026-08-27 08:15:31  | 综合跟踪 `PASS` 示例；`isEsti/eventTime/source/declarationNo`          |
| [7124374m0](https://doc.freightower.com/7124374m0)     | 美国海关与海外码头节点状态码                      | 页面未显示于本次摘录 | `CUS/SRM/TML × Release/Hold/Inbond`；美国海关码表                      |
| [318680553e0](https://doc.freightower.com/318680553e0) | `POST /terminal/{country}/subscribe`              | 2026-08-13 10:34:21  | 海外码头订阅；箱号、港口、方向和 `subscriptionId`                      |
| [318680554e0](https://doc.freightower.com/318680554e0) | `GET /terminal/{country}/download`                | 2026-05-29 09:37:56  | 以 `subscriptionId` 查询；`holds[]` 结构                               |
| [318680559e0](https://doc.freightower.com/318680559e0) | `POST /terminal/us/customs/getHousesSubscribe`    | 2026-05-29 09:37:56  | 美国海关空/海运订阅；`mot + mbl`；订阅作业标识                         |
| [318680562e0](https://doc.freightower.com/318680562e0) | `POST /terminal/us/customs/getHouses`             | 2026-06-08 08:51:03  | 订阅后查询；Master/House、Holds、Events 和业务日期                     |
| [318680564e0](https://doc.freightower.com/318680564e0) | `POST /terminal/us/customs/getAmericaCustomsData` | 2026-03-11 07:10:31  | 无需订阅的原始数据；`StatusEvents` 与 `abi_master_event_id`            |

页面内容会变化。映射记录必须保存 `mappingVersion=freightower-customs-v1-20260909`，上线前仍须用签约租户的真实脱敏响应对拍。

## 3. 复合映射键

任何映射查找必须使用：

```text
provider=FREIGHTOWER
+ apiVersion/documentId
+ interfaceCode
+ jurisdiction
+ direction
+ subject
+ rawCode
+ qualifier
```

最低原始观察字段：

```text
provider, documentId, interfaceCode, jurisdiction, direction,
subject, rawCode, rawText, qualifier, businessReference,
sourceEventId, occurredAtRaw, providerUpdatedAtRaw, receivedAt,
payloadHash, rawPayloadReference, mappingVersion
```

`documentId` 暂代供应商未显式发布的接口版本。正式接入若取得版本号，必须同时保存版本号和文档 ID。

## 4. 中国海关直接查询映射

接口：

- `/terminal/cn/customs/getBlnoDeclare`
- `/terminal/cn/customs/getEntryIDDeclare`

主体固定为 `customs`，方向来自请求/响应 `ieid`，案卷关联优先使用 `entryid`。事件时间来自 `noticedate`，`endtime` 不得替代单条事件时间。

| 原始码                 | 官网含义              | Logixs 语义                    | 工单/案卷效果                        | V1 决策                          |
| ---------------------- | --------------------- | ------------------------------ | ------------------------------------ | -------------------------------- |
| `BLA`                  | 预配舱单接受申报      | `customs_filed`                | 推进舱单申报工单                     | 批准                             |
| `BLR`                  | 预配舱单提运单放行    | 无通用海关放行映射             | 记录提运单事实                       | 不得映射 `release`               |
| `ASB`                  | 运抵报告退单          | 退单事实                       | 阻断/重开运抵工单                    | 批准为工单事实；规范事件待公共码 |
| `AAD`                  | 运抵报告接受申报      | `customs_filed` 的运抵限定事实 | 推进运抵工单                         | 批准，必须带类型限定             |
| `ASA`                  | 已运抵                | 到达/运抵事实                  | 完成运抵工单                         | 不作为海关放行                   |
| `EDC`                  | 进出口报关入库        | `customs_filed`                | 推进报关申报工单                     | 批准                             |
| `CDC`                  | 报关审结              | 审结事实                       | 推进审结工单                         | 不作为放行                       |
| `CPI`                  | 报关查验              | `inspection`                   | 启动/推进查验工单，案卷进入查验      | 批准                             |
| `PAS`                  | 报关放行              | `release`                      | 完成匹配案卷的放行工单并参与逐票聚合 | 批准                             |
| `DEL`                  | 报关删单              | 删除/作废事实                  | 阻断并进入人工复核                   | 不得映射为正常完成               |
| `CLR`                  | 报关结关              | 结关事实                       | 更新结关工单                         | 不得反向代替缺失的 `PAS`         |
| `BCB/TRB`              | 装载舱单/理货报告退单 | 退单事实                       | 阻断对应工单                         | 不作为货柜级海关放行             |
| `BCA/TRA`              | 装载舱单/理货报告接受 | 接受事实                       | 推进对应工单                         | 不作为货柜级海关放行             |
| `ETC/ETP/ATC/ATP/EDEP` | 出港申报、通过、离港  | 船舶/出境动态                  | 推进相应动态工单                     | 与报关单 `release` 分离          |

硬性条件：

1. `statuscd=null` 时，即使 `note` 出现“允许放行”，V1 也不得自动生成 `release`；进入人工复核。
2. 同一提单返回多个 `entryid` 时逐案卷映射，禁止广播为整柜放行。
3. `PAS` 的工单业务日期取 `noticedate`，接收/补录时间另存。

## 5. 综合跟踪 `PASS`

官网 `/application/v1/query` 示例同时给出：

```text
eventCode=PASS
isEsti=N
eventTime
descriptionCn=海关放行
declarationNo
source=0
```

批准映射条件：

| 复合条件                              | 结果                     |
| ------------------------------------- | ------------------------ |
| `interfaceCode=/application/v1/query` | 锁定接口上下文           |
| `eventCode=PASS`                      | 原始放行码               |
| `isEsti=N`                            | 必须是实际事件           |
| `declarationNo` 非空且唯一关联案卷    | 防止提单级广播           |
| `eventTime` 可解析                    | 工单/案卷实际业务日期    |
| `source`、港口和原始描述保留          | 保存事实来源与审计上下文 |

全部满足时映射为海关主体 `release`，并可自动完成匹配案卷的放行工单。缺少 `declarationNo`、实际时间或方向时进入人工复核。`PASS` 与中国直查 `PAS` 是不同接口中的原始码，只在规范层收敛。

## 6. 海外码头 Holds 映射

官网确认：

- `holdCategory=CUS`：海关。
- `holdCategory=SRM`：船公司。
- `holdCategory=TML`：码头。
- `holdStatus`：`Release | Hold | Inbond`。

| 主体类别 | 原始状态  | Logixs 语义      | 可驱动工单                          |
| -------- | --------- | ---------------- | ----------------------------------- |
| `CUS`    | `Release` | 海关 `release`   | 海关放行工单；仍须关联正确案卷/货柜 |
| `CUS`    | `Hold`    | 海关 `hold`      | 海关扣留/查验处置工单               |
| `CUS`    | `Inbond`  | 保税状态         | 保税/转运工单；不得映射放行         |
| `SRM`    | `Release` | 船公司 `release` | 船司放行工单                        |
| `SRM`    | `Hold`    | 船公司 `hold`    | 船司滞留处置工单                    |
| `TML`    | `Release` | 码头 `release`   | 码头放行工单                        |
| `TML`    | `Hold`    | 码头 `hold`      | 码头滞留处置工单                    |

`holdDate` 是官网响应中的原始时间字段，但其名称同时用于 Release 示例。Adapter 必须原样保留；在时区和真实语义对拍前，将其作为供应商观察时间，不得静默解释为监管机构签发时间。

`subscriptionId` 是订阅/查询关联键，不是业务事件 ID。Holds 数组各主体独立聚合，一个主体 Release 不得清除另一个主体 Hold。

## 7. 美国海关映射

接口方向由 `mot` 区分，官网示例 `O` 为海运；对象至少保留 Master/House BL 类型、号码和 Issuer/Carrier。

### 7.1 申报与里程碑

| 原始码 | 官网含义                          | Logixs 语义     | V1 决策             |
| ------ | --------------------------------- | --------------- | ------------------- |
| `55`   | Carrier bill add，AMS 提交申报    | `customs_filed` | 批准，限定 AMS      |
| `54`   | Carrier bill delete，AMS 删除     | 删除/更正       | 阻断并复核          |
| `69`   | AMS 单已申报完成                  | `customs_filed` | 批准，限定 AMS 完成 |
| `3Z`   | Security Filing on File，ISF 归档 | `customs_filed` | 批准，限定 ISF      |
| `19`   | Actual conveyance arrival         | 到港实际事件    | 不属于海关放行      |
| `1Y`   | MVOCC/NVOCC 提单匹配              | 提单匹配事实    | 不属于海关放行      |

### 7.2 查验、扣留与解除

| 原始码               | 官网含义                                        | Logixs 语义                 | V1 决策                                 |
| -------------------- | ----------------------------------------------- | --------------------------- | --------------------------------------- |
| `1A`                 | Intensive examination required                  | `inspection`                | 启动查验工单                            |
| `1B`                 | Intensive examination completed，官网标注“放行” | `release`，限定深度查验完成 | 可完成该查验链工单；不得清除其他 Hold   |
| `1C`                 | Entered and released: General examination       | `release`                   | 可完成匹配案卷放行工单                  |
| `1F`                 | Inbond destination hold removed                 | `hold_released`             | 不单独推定总放行                        |
| `1H`                 | Customs hold placed                             | `hold`                      | 扣留/查验处置工单                       |
| `1I`                 | CBP hold removed                                | `hold_released`             | 解除 1H，不等于总放行                   |
| `2H..5H,7H..9H`      | USDA/OGA/处理/NII/资料类 Hold                   | `hold`                      | 主体和 hold 类型必须分别保存            |
| 对应 `2I..5I,7I..9I` | 对应 Hold removed                               | `hold_released`             | 只解除匹配 hold，不清除其他 hold        |
| `6H`                 | Do Not Load                                     | `hold`                      | 禁止装船工单/阻断                       |
| `6I`                 | Release of No Load                              | `hold_released`             | 解除 6H、允许装船，不等于进口海关总放行 |
| `4A`                 | Override，官网中文为“禁止放行”                  | 阻断候选                    | 码义需真实响应对拍，暂进人工复核        |

官网查询示例中 `HoldDispositionCode=1I`、`HoldRemoveDate` 有值而 `ReleasedDate=null`，直接证明“解除扣留不等于海关放行”。

### 7.3 唯一键与时间

原始数据接口优先使用 `abi_master_event_id` 作为 `sourceEventId`。无该字段时使用：

```text
mot + carrierCode + BLType + BLNo + SeqNo
+ DispositionCode + EventDate
```

事件时间取 `EventDate/event_date`；`HoldDate`、`HoldRemoveDate`、`ReleasedDate` 分别保存，不互相覆盖。`StatusId`、`status_id` 和 `LastRunTime` 属于供应商查询/同步作业，不得映射为海关案卷状态。

## 8. 外部证据驱动内部工单

| 规范事实                                                | 匹配工单类型   | 自动效果                                         | 不满足条件             |
| ------------------------------------------------------- | -------------- | ------------------------------------------------ | ---------------------- |
| 中国 `PAS` / 综合 `PASS` / 美国 `1B/1C` / `CUS+Release` | 海关放行       | 回填状态、实际日期、外部引用和证据；完成匹配工单 | 人工复核/对账          |
| `CPI/1A/*H`                                             | 查验或扣留处置 | 启动、推进或阻断工单                             | 未映射队列             |
| `*I`                                                    | 对应 Hold 解除 | 完成对应解除/处置工单                            | 不得自动完成海关总放行 |
| `BLA/EDC/55/69/3Z`                                      | 舱单/申报      | 推进或完成对应申报工单                           | 不得自动完成放行工单   |

外部自动回填与人工后补录必须调用同一 Application 命令和工单状态机。二者业务结果一致，只在 `captureSource=external_evidence|manual_backfill`、操作者与审计记录上不同。同一事实组合执行必须幂等合并。

## 9. 明确不映射

以下值不得触发业务状态：

- HTTP 200 或 `statusCode=20000`。
- `subscriptionId`、`AMSQueryId`、`AMSQueryMasterId`、`StatusId`、`status_id`。
- `START/PROCESS/COMPLETE/NODATA/ABNORMAL` 等供应商同步状态。
- `queryResultCode`、`bondTypeCode` 等 Bond 资格结果。
- `statuscd=null` 时从自由文本猜测出的状态。
- 未包含在批准表中的未知码或缺失必要限定字段的裸码。

## 10. 实施与对拍门禁

进入 Adapter 编码前必须取得至少一组脱敏真实响应并验证：

1. 中国提单查询的一提单多案卷、`PAS`、`statuscd=null`。
2. 综合跟踪 `PASS` 的 `declarationNo/isEsti/source/eventTime`。
3. 海外码头三主体 Holds 及 `holdDate` 的时区/语义。
4. 美国同一提单多个并存 Hold、解除一个 Hold、`ReleasedDate` 为空。
5. 重复查询、乱序事件、事件更正和同步失败。
6. 外部自动回填后人工补录同一事实只推进一次。

映射变化属于行为变更。必须版本化映射、保存历史版本、回放受影响样本，并经领域与集成负责人评审；不得静默修改既有事件含义。
