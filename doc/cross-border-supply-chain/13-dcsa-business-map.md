# DCSA标准业务映射

> 状态分类：业务边界和Logix映射原则为已确认方案；Commercial Schedules v1.0.3端点来自已核验OpenAPI；其他标准的完整补丁版本、端点和必填组合属于待验证外部事实。访问日期：2026-09-24。
>
> 本文说明业务用途，不定义接口字段。正式开发前应以DCSA对应版本的OpenAPI、实施指南和一致性场景再次核对。

## 一、标准分别解决什么问题

| 标准                            | 回答的业务问题                         | 在Logix中的用途              |
| ------------------------------- | -------------------------------------- | ---------------------------- |
| Industry Blueprint及Journeys    | 行业参与方、对象和旅程如何衔接         | 统一术语和边界               |
| Commercial Schedules v1         | 订舱前有哪些商业运输方案               | 出运计划、路线比较和路线选择 |
| Operational Vessel Schedules v3 | 船舶当前计划如何运行                   | 港序和ETA/ETD运营基线        |
| Port Call v2                    | 船在港口接受哪些服务、各方如何协调时间 | 靠泊、作业和离泊预测/事实    |
| Track & Trace                   | 某票货或某个设备发生了什么             | 货物和货柜事件候选           |
| Arrival Notice v1               | 到货后收货方需要知道和准备什么         | 清关与提柜资料入口           |
| Verified Gross Mass v1          | 本次装载货柜的核实总重是什么           | 装箱到装船的重量合规交接     |

## 二、从计划到事实

```text
商业路线候选
→ 选择路线和订舱
→ 船舶运营班期
→ 港口挂靠及服务协同
→ 货物/货柜实际事件
→ Logix核验后的生命周期事实
```

每层都应保留自己的记录，不能用一个可反复覆盖的ETA或船期字段代替整条变化历史。

## 三、不能越界推导

- 商业班期不能证明货柜已装船。
- 船舶运营班期不能证明某柜一定在该船上。
- 船已经靠港不能证明某柜已经卸船。
- Arrival Notice不能证明海关已放行或码头已可提。
- VGM被接受不能证明货柜已经装船。

### 一个跨标准场景

计划人员先用Commercial Schedules寻找可选航线和预计时效；订舱确认后，Operational Vessel Schedules提供更具体的航次和挂港预测；Port Call帮助理解船舶在港口的靠泊和作业安排；Track & Trace持续提供Shipment或Equipment执行事件；Arrival Notice带来目的港到货通知和后续办理信息；VGM则证明装船前已提交并接受核实总重。

这些标准围绕同一运输过程协作，但任何一个都不能替代其他标准的业务结论。例如Port Call显示船舶已靠泊，不能据此认定某只柜已卸船；Arrival Notice已经生成，也不能证明海关已经放行或码头已经可提。

- 外部Track & Trace事件未经身份和来源核验不能直接推进流程。

## 四、VGM业务边界

VGM属于本次集装箱装载实例，而不是其中某张备货单。整柜称重和组成项计算是两种不同方法；责任托运人、实际称重方、提交方和接收方需要分开。

提交、船司接受、码头接受和最终装船资格也要分开。更正VGM应保留原版本和回执。

## 五、接入原则

- 保存标准的完整版本，而不只写“v1”或“v2”。
- 分别确认供应商实际支持的能力，不能假设全部实现。
- 通过官方一致性场景和真实联调样本验收。
- 保存DCSA身份引用，同时关联Logix内部稳定身份。
- 计划、预计、请求和实际时间分别保存。

## 六、官方入口

- <https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint>
- <https://reference.dcsa.org/content/standards/releases/arrival-notice/v1>
- <https://reference.dcsa.org/content/standards/releases/commercial-schedules/v1>
- <https://reference.dcsa.org/content/standards/releases/operational-vessel-schedules/v3>
- <https://reference.dcsa.org/content/standards/releases/port-call/v2>
- <https://reference.dcsa.org/content/standards/releases/verified-gross-mass/v1>

## 七、逐标准映射

### 7.1 Industry Blueprint与三类Journey

| 项目      | 说明                                                                      |
| --------- | ------------------------------------------------------------------------- |
| 标准目的  | 用统一参与方、业务对象和旅程说明海运业务如何协作                          |
| 适用阶段  | 从商业准备、订舱、运输执行到设备流转                                      |
| 核心对象  | Shipment、Transport Document、Equipment、Transport Call、Vessel、Location |
| 接口能力  | Blueprint本身是行业语义参考，不代表存在一个统一业务接口                   |
| 身份引用  | 各旅程中的Shipment、设备、运输单证、航次和运输挂靠身份                    |
| 时间语义  | 区分计划、预计、请求和实际；具体定义由相应标准承担                        |
| Logix映射 | 用于校准术语和上下文，不直接替换Logix内部稳定身份                         |
| 当前使用  | 作为对象边界和外部映射参考                                                |
| 未来使用  | 校准跨Booking、Shipping Instructions、Track & Trace等标准的关系           |
| 不能推导  | Blueprint中的流程存在不等于船司已经支持对应接口                           |
| 证据状态  | `current`页面已列为官方入口；具体发布版本和子页面快照待归档               |

三类Journey分别关注：

- Shipment Journey：一票运输业务及其商业、单证和执行过程。
- Equipment Journey：集装箱设备的提取、装载、进出场、卸货和返还。
- Vessel Journey：船舶服务、航次、港序和港口访问。

### 7.2 Commercial Schedules v1

| 项目      | 说明                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| 标准目的  | 在订舱前查询点到点路线、港口班期和船舶班期                                                            |
| 适用阶段  | 出运计划、路线选择、订舱准备                                                                          |
| 核心对象  | Routing Option、Leg、Intermediate Call、Cut-off、Vessel/Port Schedule                                 |
| 接口能力  | `GET /v1/point-to-point-routes`、`GET /v1/port-schedules`、`GET /v1/vessel-schedules`，三项可独立实现 |
| 身份引用  | `routingReference`、`transportCallReference`、服务/航次/船舶和地点引用                                |
| 时间语义  | 商业计划和预计时间，不是实际执行时间                                                                  |
| Logix映射 | 商业班期快照、路线候选、运输区段、截止时间和选定路线                                                  |
| 当前使用  | 为已出运货柜补充计划基线时只作参考，不覆盖实际事实                                                    |
| 未来使用  | 支持出运计划的路线、转运、时效、冷链和排放比较，并衔接Booking                                         |
| 不能推导  | 货柜已订舱、已装船、已离港或已到港                                                                    |
| 证据状态  | OpenAPI 3.0.3、合同版本1.0.3已核验；认证和供应商实现仍需逐家联调                                      |

### 7.3 Operational Vessel Schedules v3

| 项目      | 说明                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| 标准目的  | 交换服务、航次、船舶及港序的运营班期                                           |
| 适用阶段  | 订舱后至航程执行期间                                                           |
| 核心对象  | Service、Vessel、Voyage、Transport Call、Location/Facility、Timestamp          |
| 接口能力  | 按服务、航次、船舶、地点和日期查询运营班期；精确端点及参数组合以v3 OpenAPI为准 |
| 身份引用  | 船司/通用服务引用、进出口航次引用、IMO号、`transportCallReference`             |
| 时间语义  | 计划和预计到离港时间；实际事实须由合格事件或港口证据确认                       |
| Logix映射 | 运营班期快照、船舶航次、运输挂靠和历次ETA/ETD                                  |
| 当前使用  | 清关准备、到港预测和目的港资源预判                                             |
| 未来使用  | 航程变更、换船、跳港和码头变化的影响分析                                       |
| 不能推导  | 某个货柜一定在该船上，或已经卸船/可提                                          |
| 证据状态  | v3发布族和业务语义已确认；当前补丁版本、完整端点和必填组合待OpenAPI归档核验    |

### 7.4 Port Call v2

| 项目      | 说明                                                                   |
| --------- | ---------------------------------------------------------------------- |
| 标准目的  | 支持一次港口访问中的码头、港口服务和JIT时间协同                        |
| 适用阶段  | 船舶进港、靠泊、作业和离港                                             |
| 核心对象  | Port Call、Terminal Call、Port Call Service、Timestamp、Party          |
| 接口能力  | 查询或交换挂靠、码头访问、服务和时间主张；精确读写端点以v2 OpenAPI为准 |
| 身份引用  | Port Call、Terminal Call、Service标识及Transport Call/船舶/航次引用    |
| 时间语义  | 计划、请求、预计和实际时间形成协商链，不是单一ETA字段                  |
| Logix映射 | 港口访问、码头访问、服务、时间版本及回复/替代关系                      |
| 当前使用  | 预测靠泊和卸船窗口，辅助清关和提柜预排                                 |
| 未来使用  | 与港口、码头和服务商双向协同；外部回写需审批和审计                     |
| 不能推导  | 某柜已卸船、海关放行或码头可提                                         |
| 证据状态  | v2发布族和实体层级已确认；补丁版本、端点和枚举待OpenAPI归档核验        |

### 7.5 Track & Trace

| 项目      | 说明                                                                |
| --------- | ------------------------------------------------------------------- |
| 标准目的  | 交换Shipment、Transport和Equipment执行事件                          |
| 适用阶段  | 订舱后至运输和设备流转完成                                          |
| 核心对象  | Shipment Event、Transport Event、Equipment Event及其业务引用        |
| 接口能力  | 事件查询/订阅能力随发布版本和供应商实现确定                         |
| 身份引用  | Shipment、Transport Document、Equipment、Transport Call及事件ID     |
| 时间语义  | 事件发生、记录和提供时间分开；计划/预计/实际不得混用                |
| Logix映射 | 原始事件、规范事件候选、证据、来源权威和生命周期日期事实            |
| 当前使用  | 接收海运及货柜动态，经对象解析和来源裁决进入复核或应用              |
| 未来使用  | 扩展多船司直接订阅、撤回/更正及自动对账                             |
| 不能推导  | 聚合商返回的事件未经身份、映射和权威裁决即可推进状态                |
| 证据状态  | 业务映射原则来自Logix正式来源权威契约；具体DCSA发布版本待选型时锁定 |

### 7.6 Arrival Notice v1

| 项目      | 说明                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| 标准目的  | 向收货相关方传递到货、货物、费用和提货准备信息                                  |
| 适用阶段  | 预计到港前后至提货准备                                                          |
| 核心对象  | Arrival Notice、Shipment/Document Reference、Party、Equipment、Charge、Location |
| 接口能力  | 通知内容和交换方式以v1发布页及OpenAPI/实施指南为准                              |
| 身份引用  | 提单/运输单证、Shipment、箱号、通知和参与方引用                                 |
| 时间语义  | 通知生成/发送时间、预计到港及相关截止时间分别表达                               |
| Logix映射 | 到货通知版本、接收方、文件、费用候选和清关/提柜准备信息                         |
| 当前使用  | 与导入的到货通知、提单和目的港资料对账                                          |
| 未来使用  | 船司直连后驱动资料准备和缺口任务                                                |
| 不能推导  | 海关放行、船司放货、码头可提或货柜已经卸船                                      |
| 证据状态  | v1发布族和业务边界已确认；补丁版本、子链接和完整字段待归档核验                  |

### 7.7 Verified Gross Mass v1

| 项目      | 说明                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| 标准目的  | 交换本次集装箱装载实例的核实总重声明和处理结果                                  |
| 适用阶段  | 装箱完成后、装船许可前                                                          |
| 核心对象  | Equipment、VGM Declaration、Measurement/Calculation、Party、Submission/Response |
| 接口能力  | 提交、查询、更正、撤销和回执能力以供应商实现及v1 OpenAPI为准                    |
| 身份引用  | 本次装载实例、箱号、订舱/Shipping Instructions及提交引用                        |
| 时间语义  | 称重、提交、接收、更正和接受时间分开                                            |
| Logix映射 | VGM版本、方法、责任方、凭证、外部提交和船司/码头回执                            |
| 当前使用  | 校验已出运数据中的重量语义，不把普通毛重自动升级为VGM                           |
| 未来使用  | 装箱工作台生成、复核并提交VGM，作为装船条件之一                                 |
| 不能推导  | 货柜已进港、已装船或已经离港                                                    |
| 证据状态  | v1发布族、SOLAS业务边界和装载实例关系已确认；补丁版本及端点待OpenAPI归档核验    |

### 7.8 Booking与Shipping Instructions

| 项目      | Booking                                                     | Shipping Instructions                       |
| --------- | ----------------------------------------------------------- | ------------------------------------------- |
| 目的      | 申请、确认和变更运输服务                                    | 向承运人提供制单和运输所需货物/参与方信息   |
| 阶段      | 出运计划至订舱确认                                          | 订舱后至运输单证签发                        |
| Logix映射 | Booking及版本、选定路线、设备需求、确认/拒绝                | 指示版本、货物、参与方、箱货关系和单证要求  |
| 当前使用  | 作为导入的外部业务引用和运输上下文                          | 作为单证来源和对账引用                      |
| 未来使用  | 从选定商业路线无重录进入订舱协同                            | 从产品、装载和交易资料生成并回传            |
| 不能推导  | Booking确认不等于已装船                                     | 指示已提交不等于VGM接受、提单签发或海关放行 |
| 证据状态  | 本轮未核验具体发布版本和OpenAPI，全部接口细节待后续专项研究 |

## 八、接入前证据门禁

每个标准正式实施前必须补齐：完整SemVer、OpenAPI归档、实施指南、子链接目录、一致性场景、许可证、供应商能力、认证方式、真实脱敏报文和字段对拍。未补齐内容保持“待验证外部事实”，不得升级为公共契约。

## 详细业务规格（按原始对话逐项重建）

本节保存形成业务基线时的完整分析，不以摘要代替论证。已去除工具日志、重复生成记录和无效文件引用，并按主题归入唯一文档。技术契约仍由 docs/ 负责。

### DCSA蓝图及逐项标准详细解读

> 追溯范围：原始对话第 9678-12443 行。建议仍为建议；已确认规则以本文前部、12号文档和业务ADR为准。

#### 综合验证结论

以上官网资料共同证明，合理的接入架构应是：

```text
Provider
-> Capability
-> Channel
-> Contract Version
-> Generic Executor
-> Raw Message
-> Versioned Normalization
-> Logix Canonical Event
-> Authority Evaluation
-> Lifecycle Fact
```

必须内置的通用执行能力包括：

- REST Pull
- REST Command
- Webhook Push
- DCSA Subscription
- API Key
- OAuth2 Client Credentials
- 可配置 HMAC
- Cursor/Page/HTTP Range 分页
- 限流与调用预算
- MQ
- EDI/SFTP
- Swagger 2.0、OpenAPI 3.0/3.1 契约导入

最终判断是：**配置优先方案可行，但不能追求“所有差异都是字段配置”。** 大约80%至90%的差异可由请求、认证、映射、分页、限流和采信配置解决；签名算法、MQ、EDI及少数异常协议需要经过审核的公共执行器或插件。任何情况下都不应把任意 JavaScript/Python 文本存进数据库直接执行。

> [https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint-shipment-journey](https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint-shipment-journey)  [https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint-equipment-journey](https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint-equipment-journey)  [https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint-vessel-journey](https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint-vessel-journey)  [https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint](https://reference.dcsa.org/content/standards/industry-blueprint/current/industry-blueprint)

这四个 DCSA Industry Blueprint 2026.Q1 页面把项目领域边界进一步讲清楚了：

**一个货柜全生命周期不是一条单线状态，而是 Shipment、Equipment、Vessel 三条相互关联、独立演进的旅程。**

#### 三条旅程

| 旅程              | DCSA 定义            | 项目中的核心对象                                           |
| ----------------- | -------------------- | ---------------------------------------------------------- |
| Shipment Journey  | Booking-to-Payment   | 订舱、提单、单证、清关、放货、费用                         |
| Equipment Journey | Pickup-to-Return     | 集装箱、提空箱、装箱、进港、装船、卸船、提柜、卸柜、还空箱 |
| Vessel Journey    | Departure-to-Arrival | 船舶、航次、挂港、靠泊、装卸、到离港时间                   |

因此不能用一张“货柜表”的单个状态字段表达全部过程。例如：

```text
shipmentStatus = CUSTOMS_RELEASED
equipmentStatus = DISCHARGED
inlandTaskStatus = PICKUP_SCHEDULED
vesselCallStatus = ARRIVED
```

这些状态可以同时成立。

#### Shipment Journey

官方页面覆盖：

- Arrival Notice v1.0.0
- Bill of Lading v3.0.0
- Shipping Instructions
- Transport Document
- Booking v2.0.0
- Booking amendment/cancellation/exception
- 危险品预审核
- Shipment Release
- Customs、付款、单证和码头放行前置条件
- 放货授权与执行
- 后程运输及交付安排

这说明清关与放货必须分开：

```text
海关是否放行
承运人是否放货
码头是否允许提箱
费用/信用是否结清
提单权利是否确认
```

只有全部满足，才形成可执行的提柜资格。

#### Equipment Journey

官方定义为 Pickup-to-Return，覆盖：

1. 指定堆场和分配空箱。
2. 空箱提取。
3. 承运人拖车任务。
4. 集装箱状态监控。
5. VGM 申报及修正。
6. 装箱、出口、装船、卸船、拆箱等物理过程。
7. 指定空箱还箱点。
8. 空箱归还及箱况等级更新。

这与项目的“提、送、卸、还”智能排柜直接吻合，但要补充：

- 提的是重箱还是空箱；
- 起点和终点设施类型；
- 箱状态；
- 还箱地点是否已指定；
- 还箱截止时间；
- 空箱归还是否被场站接收；
- 归还后的箱况；
- 每次移动对应的运输任务和承运车队。

三方堆场应作为设备旅程中的设施节点，不是仓库备注字段。

#### Vessel Journey

官方页面覆盖：

- Long-Term Schedule
- Coastal Schedule
- 支线与区域船期
- Commercial Schedules v1.0.0
- Operational Vessel Schedules v3.0.0
- Load List
- 配载计划和装卸指令
- 开航后装载核对
- 舱单申报及海关响应
- Manifest Corrector
- Port Call v2.0.0
- Estimated、Planned、Actual 时间戳
- Move Forecast
- Weekly Berth Planning

这说明 ETA/ETD 不能只有货柜表中的四个日期字段，而应建成可修订的日期事实：

```text
对象：Shipment / Equipment / Vessel / Port Call
事件：Arrival / Berthing / Discharge / Availability
分类：REQUESTED / ESTIMATED / PLANNED / ACTUAL
来源：船司 / 港口 / 码头 / 聚合商 / 人工
版本：第几次更新
```

智能排柜应主要依赖目的港 `Port Call + Discharge + Availability`，而不能只盯船舶 ETA。

#### 对当前工作台的映射

| 工作台     | 主要旅程                     | 应负责的业务结果                               |
| ---------- | ---------------------------- | ---------------------------------------------- |
| 出运工作台 | 三条旅程汇总                 | 建立货柜、订舱、提单、航次、路线和来源关联     |
| 清关工作台 | Shipment + Vessel            | 舱单、申报、查验、放行、改单及证据管理         |
| 提柜工作台 | Equipment + Shipment Release | 确认具备提柜资格并执行重箱提取                 |
| 送仓工作台 | Equipment                    | 车队运输、预约、到仓、等待及异常               |
| 卸柜工作台 | Equipment                    | 开始卸柜、完成拆箱、差异及仓库接收             |
| 还箱工作台 | Equipment                    | 还箱点、截止期、空箱归还、场站接收和箱况       |
| 智能排柜   | Equipment + Vessel           | 根据可提时间、免费期、车辆、仓容和堆场能力排程 |

#### 数据模型应采用关联聚合

```text
shipment
booking
transport_document
shipment_release
customs_case

equipment
shipment_equipment_assignment
equipment_movement
inland_transport_task
facility_visit
empty_return_instruction

vessel
transport_service
voyage
port_call

external_event
lifecycle_date_observation
lifecycle_date_fact
```

`shipment_equipment_assignment` 很重要，因为货柜、提单、订舱并非永远一对一。

#### 对四张导入表的影响

四张 Excel 仍可作为当前最小输入集，但导入后不能只落入一张宽表。应分别形成：

```text
货柜信息表 -> shipment + equipment + assignment
清关信息表 -> customs_case + shipment_release
物流信息表 -> voyage + port_call + inland_transport_task
仓库信息表 -> facility + facility_visit + unloading事实
```

缺少的上游信息可以为空，但聚合边界应现在建立。以后备货、装箱流程上线时，只需调用相同的出运交接接口，不需要重构货柜主表。

#### DCSA 的边界

DCSA 明确说明 Vessel Journey 当前不覆盖海上航行期间活动。因此：

- DCSA Blueprint 适合做流程骨架；
- 船司 Track & Trace 适合提供在途观察事件；
- 飞驼、云当、AIS、港口和码头数据用于补充可见性；
- Logix 自己负责综合来源、解决冲突并形成可操作事实。

另外，蓝图中只有蓝色流程属于相应 DCSA 标准范围，其他流程可能只是行业相关过程。因此不能看到蓝图里有某个环节，就假设存在对应标准 API。

最终可将项目主线收敛为：

```text
Shipment：有没有权利和条件放货
Equipment：箱子在哪里、下一步应去哪里
Vessel：船和港口作业进行到哪里
Execution：清关、提、送、卸、还由谁在何时执行
Evidence：每个结论来自什么来源、版本和原始凭证
```

这五个问题共同构成真正稳定的出运后全生命周期。

> [https://reference.dcsa.org/content/standards/releases/arrival-notice/v1](https://reference.dcsa.org/content/standards/releases/arrival-notice/v1) 链接与子链接

对 [DCSA Arrival Notice v1](https://reference.dcsa.org/content/standards/releases/arrival-notice/v1) 及其子链接分析后，可以确认 Arrival Notice 不是一张“到港通知表”，而是一个**可版本化、可推送、可拉取、包含放货与提还箱信息的结构化业务单证**。

当前正式版本是 `1.0.1`，不是笼统的 v1。

#### 子链接体系

该版本包含13类正式资料：

| 子资料                 | 作用                             |
| ---------------------- | -------------------------------- |
| Introduction           | 标准介绍                         |
| Purpose & Scope        | 参与方、货物类型和功能边界       |
| User Stories           | 岗位需求                         |
| Use Cases              | 发送、更新、获取、轻量通知       |
| Endpoint Overview      | 用例到 API 端点的映射            |
| Business Process Model | Arrival Notice BPMN 流程         |
| Data Overview          | 字段、必填性、过滤条件           |
| Conformance Scenarios  | 一致性测试                       |
| Glossary               | 标准术语                         |
| Implementation Guide   | 幂等、版本、分页、错误和运维要求 |
| Information Model      | 对象关系和 Java 信息模型         |
| Technical Appendix     | 技术行为说明                     |
| OpenAPI Specification  | OpenAPI 3.0.3 YAML 契约          |

另外提供不可变历史版本 Archive，适合用于版本审计。

#### 标准范围

参与方不只是船司和收货人。

Publisher 可以是：

- Carrier
- Freight Forwarder

Receiver 可以是：

- Consignee
- Notify Party
- Customs Broker
- Freight Forwarder
- Collect Invoice Payer
- Warehouse Personnel
- Trucker

支持：

- 普通干货
- 冷藏货
- 危险品
- 集装箱货物

这说明 Arrival Notice 数据会同时被清关、提柜、仓库、财务和车队使用，不能归属于某一个工作台私有。

#### 四个业务用例

1. `Send Arrival Notice`：发布方主动发送完整通知。
2. `Update Arrival Notice`：信息变化后发送新版通知。
3. `Retrieve Arrival Notice`：接收方按需查询。
4. `Notify Arrival Notice Availability`：只发送“通知已可用”的轻量消息。

轻量通知通常只包含提单号、ETA、卸货港等关键上下文，**不等于完整 Arrival Notice**。

#### 三个标准端点

OpenAPI 3.0.3 明确规定：

```http
GET  /arrival-notices
POST /arrival-notices
POST /arrival-notice-notifications
```

端点责任方向很重要：

| 端点                                 | 实现方              | Logix 角色                   |
| ------------------------------------ | ------------------- | ---------------------------- |
| `GET /arrival-notices`               | 船司等 Publisher    | Logix 主动拉取               |
| `POST /arrival-notices`              | Logix 等 Subscriber | 接收完整通知                 |
| `POST /arrival-notice-notifications` | Logix 等 Subscriber | 接收轻量通知，再决定是否拉取 |

订阅注册、身份认证和授权不在 DCSA 标准范围内，仍需按船司配置。

#### 查询条件

所有 Publisher 必须支持按：

```text
transportDocumentReferences
```

查询。其他条件均可能是船司可选能力：

- `equipmentReferences`
- `portOfDischarge`
- `vesselIMONumber`
- `vesselName`
- `carrierImportVoyageNumber`
- `universalImportVoyageReference`
- `carrierServiceCode`
- `universalServiceReference`
- `portOfDischargeArrivalDateMin/Max`
- `includeVisualization`
- `removeCharges`
- `limit`
- `cursor`

因此能力配置应细到过滤参数：

```yaml
capabilities:
  requiredFilters:
    - transportDocumentReferences
  optionalFilters:
    - equipmentReferences
    - portOfDischarge
  maxTransportDocumentReferences: 1
  supportsPagination: true
  supportsVisualization: true
  supportsRemoveCharges: false
```

#### 分页规则

Arrival Notice 使用 Cursor 分页：

- 请求参数：`limit`、`cursor`
- 响应头：`Next-Page-Cursor`
- 下一页请求必须保留第一页的所有原始查询条件。
- Cursor 可能不可重复使用。
- 最后一页不再返回 Cursor，也可能返回空数组。

分页任务必须保存查询快照，不能只保存 Cursor。

#### 通知版本规则

标准明确要求：

```text
业务身份：
transportDocumentReference + typeLabel

版本顺序：
issueDateTime
```

不能按照：

- 接收时间
- 处理时间
- 消息到达顺序
- 导入顺序

判断哪个版本最新。

因此建议结构为：

```text
arrival_notice
- transport_document_id
- type_label
- current_version_id

arrival_notice_version
- arrival_notice_id
- issue_date_time
- received_at
- source_channel_id
- standard_version
- profile
- payload_hash
- raw_message_id
- superseded_by_id
```

旧版本不得覆盖删除，应保留审计。

#### 三种一致性 Profile

标准定义：

| Profile   | 要求               |
| --------- | ------------------ |
| BASIC     | 不要求费用和免费期 |
| FREIGHTED | 必须包含费用       |
| FREE_TIME | 必须包含免费期     |

这不是三种 Arrival Notice 类型，而是接口能力档案。某船司可能只支持 BASIC，也可能同时支持 FREIGHTED/FREE_TIME。

费用字段应受更严格权限控制；`removeCharges=true` 表示结构化数据和 PDF 中均应去除费用，而不是只在界面隐藏。

#### 对项目最有价值的字段域

Arrival Notice 覆盖了当前四张表中的大量关键数据：

- 提单号及运输单证
- 船司代码和代码表提供方
- 船司联系人
- 收货人、通知方、清关行、仓库、车队等参与方
- 卸货港、交付地及设施
- 船名、IMO、进口航次、服务代码
- 预计/计划/实际日期
- 集装箱号、箱型、封条
- 冷藏箱设置
- 海关引用
- 提柜信息
- 空箱归还地点、还箱指令、Turn-in Reference
- 是否收到正本提单
- 是否完成运费放行
- 是否海关放行
- 费用
- 免费期
- PDF 可视化版本

尤其是标准中的 `ReleaseInformation`：

```text
isOBLReceived
isFreightReleased
freightReleaseDate
isCustomsReleased
carrierInformationForCargoRelease
```

它证明“是否可以提柜”必须由多个条件组合判断，不能只看清关状态。

#### 错误处理要点

标准明确：

- 查询无结果必须返回 `200 + arrivalNotices: []`，不能返回404。
- 空结果不能区分“提单不存在、通知未生成、超过保留期、无权限或被过滤”。
- `400` 用于无效参数、不支持的过滤组合、超量引用或无效 Cursor。
- `401` 表示认证失败。
- `403` 表示授权失败。
- 同样查询条件，不同接收方可能因为授权不同得到不同结果。

此外，POST 批量消息可能返回 HTTP 200，但部分通知处理失败。必须解析：

```text
feedbackElements:
- severity: ERROR | WARN | INFO
- message
- propertyPath
```

不能把 HTTP 200 直接视为整批成功。

#### 对工作台的实际影响

收到 Arrival Notice 后，系统应：

```text
保存原始通知及版本
-> 匹配提单、货柜、航次和卸货港
-> 更新日期观察事实
-> 提取清关、费用、免费期、提还箱信息
-> 检查数据缺口与版本冲突
-> 重新计算提柜准备度
-> 通知清关/提柜/仓库/财务相关岗位
```

但收到 Arrival Notice 本身不能自动标记：

- 已清关
- 已放货
- 已可提柜
- 已预约仓库

这些都需要独立事实确认。

#### 最终建模建议

Arrival Notice 应作为独立单证聚合：

```text
arrival_notice
arrival_notice_version
arrival_notice_party
arrival_notice_equipment
arrival_notice_transport
arrival_notice_charge
arrival_notice_free_time
arrival_notice_release_information
arrival_notice_notification
arrival_notice_feedback
```

当前四张 Excel 导入时，可以生成 `LEGACY_IMPORT` 来源的 Arrival Notice 投影视图，但不能声称它符合 DCSA AN 1.0.1。未来接入船司 API 后，直接写入同一聚合，并通过来源、版本和原始报文实现无缝切换。

> [https://reference.dcsa.org/content/standards/releases/commercial-schedules/v1](https://reference.dcsa.org/content/standards/releases/commercial-schedules/v1) 链接与子链接解读

截至 2026-09-23，DCSA Commercial Schedules v1 当前发布版本为 **1.0.3**。它定义的是班期查询与运输方案选择标准，核心服务于订舱前和运输计划阶段，不是货物实际执行状态或实际到离港事实。

主页面：[Commercial Schedules v1](https://reference.dcsa.org/content/standards/releases/commercial-schedules/v1)

#### 一、链接与子链接结构

该版本页面主要包含：

| 子页面                                | 主要内容                   | 对 Logix 的价值        |
| ------------------------------------- | -------------------------- | ---------------------- |
| Introduction                          | 标准背景、参与方和总体定位 | 确定系统边界           |
| Purpose & Scope                       | 三类班期服务及适用范围     | 划分计划事实与执行事实 |
| User Stories                          | 承运人、货主、货代的需求   | 指导工作台设计         |
| Use Cases                             | 三类标准查询流程           | 转换为应用用例         |
| Endpoint Overview                     | API端点总览                | 建立连接器能力目录     |
| Business Process Model                | 查询和响应流程             | 设计接口编排           |
| Data Overview                         | 核心实体和关系             | 建立内部标准模型       |
| P2P Conformance Scenarios             | 点到点路线一致性测试       | 供应商接入验收         |
| Port Schedule Conformance Scenarios   | 港口班期一致性测试         | 港口班期接入验收       |
| Vessel Schedule Conformance Scenarios | 船舶班期一致性测试         | 船舶班期接入验收       |
| Implementation Guide                  | 请求、分页、版本等规则     | 指导适配器实现         |
| OpenAPI Specification                 | 完整机器可读契约           | 生成客户端和契约测试   |
| Changelog                             | 各小版本字段变化           | 版本兼容与升级管理     |

OpenAPI 文件：

[Commercial Schedules 1.0.3 OpenAPI YAML](https://reference.dcsa.org/files/content/standards/releases/commercial-schedules/v1/cs-v1-0-3-openapi-specification/dcsa-cs-v103-release-openapi-specification.yaml)

标准采用：

- OpenAPI 3.0.3
- Apache-2.0 许可证
- API 契约版本 1.0.3
- HTTP GET 拉取模式
- 游标分页

#### 二、三类商业班期能力

##### 1. Point-to-Point Routing

端点：

```http
GET /v1/point-to-point-routes
```

用于查询起点到终点的一种或多种运输方案，主要发生在出运计划、路线选择和订舱之前。

必填条件：

- `placeOfReceipt`：收货地点，UN/LOCODE
- `placeOfDelivery`：交付地点，UN/LOCODE

重要可选条件：

- `departureStartDate`
- `departureEndDate`
- `arrivalStartDate`
- `arrivalEndDate`
- `maxTranshipment`
- `receiptTypeAtOrigin`
- `deliveryTypeAtDestination`
- `cargoType`
- `limit`
- `cursor`

场站交接类型包括：

```text
CY   Container Yard
SD   Store Door
CFS  Container Freight Station
```

货物类型包括：

```text
DRY
REEFER
```

结果不只是一个船期，而是完整运输方案：

```text
Routing Option
  ├─ routingReference
  ├─ 起运与到达信息
  ├─ 有序运输区段 legs
  ├─ 中间挂靠 intermediateCalls
  ├─ 截止时间 cut-offs
  └─ 预计排放数据
```

排放字段包括：

- `co2`
- `co2e`
- `sox`
- `nox`
- `pm10`

需要特别注意：DCSA 在这里所说的“转运”主要指船到船的换装。公路、铁路或驳船转换到海运，不一定计为一次转运。

`routingReference` 是最有价值的衔接字段。用户选定路线后，可以把该引用继续传入未来的 Booking 流程，避免再次人工录入路线。

##### 2. Port Schedule

端点：

```http
GET /v1/port-schedules
```

核心查询条件：

- `UNLocationCode`
- `date`

用于回答：

> 从某一天开始，哪些船舶将在指定港口或码头到达、靠泊、离港？

结果通常包括：

- 港口
- 码头
- 船舶
- 航次或服务
- 预计抵港时间
- 预计离港时间
- 码头设施信息

同一港口有多个码头时，可用 SMDG Facility Code 标识具体码头。

它适合：

- 预判港口作业窗口
- 验证船名航次
- 辅助目的港资源准备
- 构造初始班期基线
- 为未来出运计划提供可选船期

但它不是某个具体货柜已经上船、到港或卸船的证明。

##### 3. Vessel Schedule

端点：

```http
GET /v1/vessel-schedules
```

用于查询指定船舶、航线、航次或地点对应的航程轮转和港序。

标准范围明确支持从以下维度查询：

- Service
- Voyage
- Vessel
- Location

1.0.3 增加了 `responseScope`：

```text
FULL_VOYAGE    返回完整航程
MATCHED_CALLS  只返回匹配的挂靠
```

未传入时，为保持向后兼容，按 `FULL_VOYAGE` 处理。

这一能力适合在 Logix 中用于：

- 获取完整港序
- 判断上一港、下一港
- 建立预计到离港基线
- 识别航线调整或跳港
- 支撑目的港清关、提柜和仓库容量预判

具体供应商可能只支持部分查询组合，因此不应假定所有船司都实现完全相同的必填过滤器。接入时需要依据其 OpenAPI 和一致性测试建立能力声明。

#### 三、标准中的数据语义

Commercial Schedules 表达的是：

> 承运人当前对市场提供的商业运输方案和预计班期。

它不等于：

- 货柜实际已装船
- 船舶实际开航
- 货物实际到港
- 海关已放行
- 码头已卸船
- 货柜已经可提
- 最终提柜、送仓、卸柜、还柜事实

因此不能使用商业班期直接覆盖生命周期事实。

建议明确区分：

| 数据类别             | 含义                         | 典型来源             |
| -------------------- | ---------------------------- | -------------------- |
| Commercial Schedule  | 商业可售班期                 | Commercial Schedules |
| Selected Route       | 企业选择的路线               | 出运计划/订舱        |
| Operational Schedule | 船司当前运行计划             | 船司运营接口         |
| Tracking Event       | 货物或货柜状态事件           | Track & Trace        |
| Port Call Timestamp  | 船舶挂靠时间事实             | Port Call            |
| Shipment Date Fact   | 本票货物的计划/预计/实际日期 | 多源归一化结果       |

#### 四、版本变化

不能只保存“Commercial Schedules v1”，应保存完整语义版本。

##### 1.0.1

- 增加 `routingReference`
- 支持选定路线向 Booking 流程传递

##### 1.0.2

- P2P 起运和到达增加 `transportCallReference`
- 增加方案级、区段级排放数据
- 增加区段级截止时间
- 增加可选 `facilityName`
- 增加非结构化 `addressLines`
- 修正游标翻页规则
- 错误代码改为实现方自行管理

##### 1.0.3

- Vessel Schedule 增加 `responseScope`
- P2P 增加 `co2e`
- P2P 增加 `cargoType`
- P2P 增加 `intermediateCalls`

这说明即使主版本都是 v1，不同小版本的数据能力也有明显差异。

#### 五、分页、版本与错误处理

##### 游标分页

通用参数：

```text
limit
cursor
```

响应头：

```text
Next-Page-Cursor
```

获取下一页时，除了替换游标，还必须保留原始查询条件。例如港口、日期、船舶和航次条件不能丢失。

##### API 版本

请求可以携带：

```http
API-Version: 1
```

响应返回完整版本，例如：

```http
API-Version: 1.0.3
```

Logix 应同时保存：

- 请求主版本
- 响应完整版本
- 来源供应商
- 拉取时间
- 原始响应摘要或归档引用

##### 错误模型

标准错误信息包括：

- HTTP 方法
- 请求 URI
- HTTP 状态
- 供应商关联编号
- 错误时间
- 属性、值和 JSONPath
- 错误代码、文本和说明

但 DCSA 不再要求各实现方使用统一详细错误码。因此应：

```text
船司原始错误
        ↓
Provider Adapter
        ↓
Logix 稳定内部错误码
```

同时保留供应商原始代码和关联编号，便于对账及排障。

#### 六、建议的数据切片

不要建立一张不断覆盖的 `voyage_schedule` 表。建议保存查询快照、方案版本和后续选择关系。

```text
commercial_schedule_snapshot
routing_option
routing_leg
intermediate_call
schedule_cutoff
schedule_footprint
selected_route
booking
transport_plan
port_call_observation
lifecycle_date_fact
```

关键关系可以设计为：

```text
商业班期快照
  ├─ 点到点运输方案
  │    ├─ 多个运输区段
  │    ├─ 中间挂靠
  │    ├─ 截止时间
  │    └─ 排放估算
  ├─ 港口班期
  └─ 船舶航程班期

运输方案
  ↓ 选择
selected_route
  ↓ routingReference
booking / shipment plan
  ↓
实际货运与货柜生命周期
```

所有时间记录至少需要携带：

- 时间语义：计划、预计或实际
- 业务节点
- 数据来源
- 来源记录标识
- 标准及版本
- 获取时间
- 生效时间
- 时区
- 是否被新版本替代

#### 七、与 Logix 工作台的关系

当前项目从已出运货柜开始，因此优先级建议如下：

| 能力                   | 当前阶段                   | 后续阶段                 |
| ---------------------- | -------------------------- | ------------------------ |
| Vessel Schedule        | 高：建立航程与港序基线     | 航线选择、订舱           |
| Port Schedule          | 中高：到港和目的港资源预判 | 出运计划、港口选择       |
| Point-to-Point Routing | 中低：用于历史路线补充     | 核心：路线比较与出运计划 |

在当前工作台中的应用：

- 清关工作台：根据预计到港窗口安排预审、文件催办和申报
- 提柜工作台：形成预计可提时间的前置参考，但不能等同于“可提柜”
- 智能排柜：把船期变化作为约束输入，不直接产生提柜任务
- 仓库工作台：预测未来到仓压力
- 异常中心：识别航线改变、港序变化、延期或跳港风险
- 出运计划工作台：未来用 P2P 方案进行时效、转运、成本和排放比较

#### 八、可配置连接器设计

每家船司可能只实现其中一部分端点，因此能力需要显式配置：

```yaml
standardFamily: DCSA_COMMERCIAL_SCHEDULES
standardVersion: 1.0.3

capabilities:
  pointToPointRoutes: true
  portSchedules: true
  vesselSchedules: false

pagination:
  type: CURSOR
  cursorRequestField: cursor
  cursorResponseHeader: Next-Page-Cursor
  preserveOriginalFilters: true

versioning:
  requestHeader: API-Version
  requestValue: "1"
  captureResponseVersion: true
```

船司个性化部分继续通过配置或受控适配逻辑处理：

- 认证方式
- Base URL
- 限流
- 必填查询组合
- 设施编码差异
- 时间格式和时区
- 错误映射
- 字段缺失
- 支持的标准小版本

#### 最终判断

Commercial Schedules 应在 Logix 中定位为：

> “商业路线与班期候选方案服务”，以及后续执行阶段的计划基线。

它不能替代 Track & Trace、Arrival Notice、Port Call、码头可提状态或实际生命周期事件。最关键的设计原则，是保存班期快照和完整版本，通过 `routingReference` 将未来的出运计划连接到订舱，再将计划、预计和实际事实分层保存。这样当前从“已出运数据导入”起步，后续向采购、出运计划、订舱和装箱延伸时，不需要推翻已有生命周期模型。

> [https://reference.dcsa.org/content/standards/releases/operational-vessel-schedules/v3](https://reference.dcsa.org/content/standards/releases/operational-vessel-schedules/v3) 链接与子链接解读

DCSA Operational Vessel Schedules（OVS）v3 应定位为“船舶实际运营班期交换标准”。它比 Commercial Schedules 更接近执行层，但仍主要表达计划和预计运行安排，不等同于货柜实际物流事件。

主页面：[Operational Vessel Schedules v3](https://reference.dcsa.org/content/standards/releases/operational-vessel-schedules/v3)

说明：本次官方页面读取工具暂时不可用，以下基于 DCSA OVS v3 的标准结构和已确认语义梳理；具体接入时仍应以该页面所附 OpenAPI 文件为契约权威，尤其要再次核定当前补丁版本及端点参数的必填组合。

#### 一、子链接体系

OVS v3 发布页面通常按以下内容组织：

| 子页面                 | 内容                       | Logix 用途             |
| ---------------------- | -------------------------- | ---------------------- |
| Introduction           | 标准背景和目标             | 确定业务定位           |
| Purpose & Scope        | 标准覆盖及排除范围         | 划分运营班期和实际事件 |
| User Stories           | 船司、港口、码头、货主需求 | 形成查询与订阅场景     |
| Use Cases              | 班期获取和更新场景         | 转换为应用用例         |
| Endpoint Overview      | API能力及查询入口          | 建立连接器能力配置     |
| Business Process Model | 生产者与消费者交互         | 设计同步任务           |
| Data Overview          | 服务、航次、船舶、挂靠关系 | 建立内部数据模型       |
| Conformance Scenarios  | 标准一致性测试场景         | 接入验收               |
| Implementation Guide   | 分页、版本和查询规则       | 适配器实现依据         |
| OpenAPI Specification  | 机器可读接口契约           | 客户端生成与契约测试   |
| Changelog              | 补丁版本变化               | 兼容性管理             |

这些内容应分成三类使用：

- 业务解释以 Purpose、User Stories、Use Cases 为准。
- 接口开发以 OpenAPI 和 Implementation Guide 为准。
- 供应商验收以 Conformance Scenarios 为准。

#### 二、OVS解决什么问题

OVS主要回答：

> 某条服务、某一航次或某艘船，在当前运营计划下，将按什么港序、在什么时间到达和离开哪些港口或码头？

典型参与方包括：

- 班期生产者：船公司、联盟、船舶运营方
- 班期消费者：货主、货代、港口、码头、物流平台
- 数据服务商：班期聚合和可视化平台

典型查询维度包括：

- 船公司服务代码
- DCSA通用服务引用
- 船公司航次号
- DCSA通用航次引用
- 船舶IMO号
- UN/LOCODE
- 起止日期

具体必填组合必须按 v3 OpenAPI 校验，不能假设每个船司都支持任意条件组合。

#### 三、核心业务对象

##### 1. Service

代表定期运营服务或航线，例如亚洲至北欧的一条固定服务。

重要标识一般包括：

- `carrierServiceCode`
- `carrierServiceName`
- `universalServiceReference`

内部应区分：

```text
船司自己的服务代码
DCSA通用服务引用
Logix内部服务标识
```

船司代码可能改名或重复，不能单独作为永久主键。

##### 2. Vessel

代表实际执行航程的船舶，通常使用：

- 船名
- IMO号
- 船旗
- 船舶相关运营信息

IMO号应作为重要业务标识，但历史数据仍需保留当时返回的船名快照。只关联当前船舶主数据，会导致历史展示随主数据修改而变化。

##### 3. Voyage

一次航程可能同时存在：

- 船司出口航次号
- 船司进口航次号
- DCSA通用出口航次引用
- DCSA通用进口航次引用

不同港口观察到的进口/出口航次语义可能不同，因此不能只设置一个模糊的 `voyage_no`。

推荐至少拆分为：

```text
carrier_export_voyage_number
carrier_import_voyage_number
universal_export_voyage_reference
universal_import_voyage_reference
```

##### 4. Transport Call

Transport Call 是 OVS 最关键的颗粒度，表示船舶在某地点的一次运输挂靠。

它通常连接：

- 服务
- 航次
- 船舶
- 港口
- 码头或泊位
- 挂靠顺序
- 到港和离港时间

`transportCallReference` 应保留。它可以把班期、Track & Trace、Port Call 和后续货物记录关联起来。

##### 5. Location / Facility

地点层次应区分：

```text
国家
  └─ 城市或港口：UN/LOCODE
       └─ 码头：SMDG Facility Code
            └─ 泊位或具体设施
```

只有 UN/LOCODE 不足以支持提柜和码头作业。洛杉矶、纽约等港区内存在多个码头，同港不同码头对清关、提柜和车队调度有直接影响。

##### 6. Timestamp

时间不是一个裸日期字段，而应包含：

- 到达或离开
- 计划、预计或实际分类
- 港口、码头或泊位
- 时区
- 来源
- 获取时间
- 所属快照
- 是否被后续版本替代

逻辑模型可表示为：

```text
transport_call
  ├─ arrival planned
  ├─ arrival estimated
  ├─ departure planned
  └─ departure estimated
```

如果供应商返回实际时间，也必须按实际事实单独保存，不能覆盖预计值。

#### 四、与 Commercial Schedules 的区别

| 维度             | Commercial Schedules       | Operational Vessel Schedules          |
| ---------------- | -------------------------- | ------------------------------------- |
| 核心目的         | 路线选择、询价、订舱前规划 | 已运营服务和船舶班期更新              |
| 主要对象         | 点到点运输方案             | 服务、航次、船舶和挂靠                |
| 生命周期位置     | 出运计划之前               | 订舱后至航程执行中                    |
| 路线选择         | 支持多个商业方案           | 通常不负责报价和方案选择              |
| 变化频率         | 商业方案发布时变化         | 运营调整时持续变化                    |
| 是否代表实际发生 | 否                         | 仍不必然代表实际发生                  |
| 主要衔接键       | `routingReference`         | `transportCallReference`、航次和IMO号 |

两者可以形成：

```text
Commercial Schedule
  ↓ 选定路线
Booking / Shipment Plan
  ↓ 确定服务、航次和船舶
Operational Vessel Schedule
  ↓ 持续修订预计班期
Track & Trace / Port Call
  ↓
实际执行事件
```

#### 五、与 Track & Trace、Port Call 的边界

##### OVS

表达：

- 船舶当前预计按什么港序运行
- 当前预计何时到港、离港
- 航次或服务班期如何调整

##### Track & Trace

表达：

- 某票货或某个集装箱发生了什么事件
- 已装箱、进港、装船、卸船、出场等

##### Port Call

表达：

- 船舶挂靠过程的精细协同
- 引航、泊位、靠泊、移泊、离泊等时间与服务

因此：

> OVS显示船预计到港，不代表本柜一定在船上；船实际靠港，也不代表本柜已经卸船或可以提柜。

提柜工作台不能只依据 OVS 自动生成“可提”结论，还必须结合：

- 货柜 Track & Trace
- Arrival Notice
- 清关放行
- 船司放货
- 码头卸船和可提状态
- 滞箱费与免箱期
- 预约资格

#### 六、建议的数据结构

不要让 OVS 直接更新货柜主表上的单个 ETA/ETD 字段。建议建立不可变快照与归一化事实层：

```text
operational_schedule_snapshot
service_schedule
vessel_voyage
transport_call
transport_call_location
transport_call_timestamp
schedule_revision
shipment_transport_link
lifecycle_date_fact
```

关键字段建议：

##### `operational_schedule_snapshot`

- 来源连接器
- 提供方
- 标准版本
- 请求条件
- 拉取时间
- Provider关联编号
- 原始报文引用
- 内容哈希
- 同步结果

##### `vessel_voyage`

- 船舶IMO号
- 船名快照
- 承运人
- 服务代码
- 通用服务引用
- 进口/出口航次号
- 通用航次引用

##### `transport_call`

- `transportCallReference`
- 挂靠顺序
- UN/LOCODE
- 码头代码
- 泊位或设施
- 运输模式
- 是否取消或跳港
- 所属快照

##### `transport_call_timestamp`

- 时间类型：到达/离开
- 分类：计划/预计/实际
- 时间值
- 时区
- 来源
- 首次发现时间
- 最近确认时间
- 被替代关系

#### 七、日期事实归一化

OVS数据应进入“候选日期事实”，再经过规则映射到货柜生命周期。

例如：

```text
OVS目的港预计到港
  ↓
候选事实：VESSEL_DESTINATION_ETA
  ↓ 匹配船舶、航次、港口和货柜运输段
货柜预计到港参考时间
```

每个日期事实至少保存：

```text
fact_type
time_value
classifier
source_type
source_provider
source_record_id
standard_family
standard_version
observed_at
effective_from
supersedes_fact_id
confidence
```

页面可显示一个“当前 ETA”，数据库必须保留历次 ETA。这样才能计算：

- 延误天数
- ETA调整次数
- 调整发生时间
- 清关准备提前量
- 仓库容量冲突
- 车队计划稳定性
- 滞港风险变化

#### 八、匹配与关联策略

OVS返回的是船舶和航次班期，并不天然知道 Logix 中哪个货柜属于该航程。

建议按强弱顺序匹配：

1. `transportCallReference`
2. DCSA通用航次引用
3. 船公司 + 服务代码 + 航次号
4. IMO号 + 起运港 + 目的港 + 时间窗口
5. 船名 + 航次号 + 港口 + 时间窗口

低置信度匹配不得静默写入正式生命周期事实，应进入人工确认队列。

尤其要处理：

- 船名拼写变化
- 共舱和联盟服务
- 换船
- 航次号复用
- 港序改变
- 跳港
- 码头变更
- 同名船舶
- 实际承运人与签约承运人不同

#### 九、连接器配置

供应商是否支持 OVS v3、支持哪些过滤条件，应作为能力配置：

```yaml
standardFamily: DCSA_OPERATIONAL_VESSEL_SCHEDULES
standardMajorVersion: 3

capabilities:
  serviceSchedule: true
  vesselSchedule: true
  locationFilter: true
  dateRangeFilter: true
  incrementalPull: false

identity:
  serviceReference: true
  voyageReference: true
  transportCallReference: true
  vesselIMONumber: true

pagination:
  type: CURSOR
  preserveOriginalFilters: true

synchronization:
  mode: POLLING
  normalIntervalMinutes: 360
  nearArrivalIntervalMinutes: 60
  overlapWindowHours: 24

retention:
  preserveSnapshots: true
  preserveRawPayload: true
```

认证、Base URL、限流、字段路径和错误映射可以配置；复杂的签名算法、特殊分页和非标准报文仍应放在受版本控制的适配器代码中，不能用任意可执行文本替代。

#### 十、工作台应用

##### 出运工作台

展示：

- 当前船名航次
- 服务和航线
- 起运港与目的港
- 港序
- 当前 ETD/ETA
- 上次 ETA
- ETA变化量
- 数据来源和更新时间

##### 清关工作台

根据目的港 ETA 倒排：

- 文件齐套期限
- 合规复核
- ISF或预申报期限
- 报关行任务
- Arrival Notice核对
- 预计申报和放行窗口

##### 提柜与智能排柜

OVS只作为预测输入：

```text
ETA变化
  ↓
预计卸船窗口调整
  ↓
预测可提窗口变化
  ↓
重新评估车队、仓库和三方堆场容量
```

正式派车还需要码头可提、清关放行和预约状态。

##### 仓库工作台

按航次和目的港聚合未来到仓量，用于：

- 预测入仓峰值
- 识别容量冲突
- 提前启用三方堆场
- 调整卸柜班次
- 评估加班和等待成本

#### 十一、异常和告警

建议从 OVS 修订中识别：

- ETA延后或提前
- ETD变化
- 船舶替换
- 航次变更
- 港序变化
- 跳港
- 新增转运港
- 码头变更
- 更新长时间中断
- 同一来源出现冲突数据

告警不能只看“字段发生变化”，而应结合业务影响：

```text
ETA变化
  + 清关截止期限
  + 仓库容量
  + 车队已排任务
  + 免箱期
  + 三方堆场成本
  = 业务风险等级
```

#### 最终定位

在 Logix 中，OVS v3 应作为：

> 船舶、航次和港口挂靠的运营计划及预计时间来源。

其数据进入运营班期快照和日期事实层，再与具体 shipment/container 进行可解释关联。它可以驱动清关准备、仓库预测和排柜预排，但不能单独产生“已到港”“已卸船”或“可以提柜”等执行结论。

最重要的落地原则有三条：

1. 保留每次 OVS 快照，不覆盖历史 ETA/ETD。
2. 使用标准业务引用和多条件匹配连接具体货柜。
3. 把计划、预计、实际和货柜事件分层保存，避免不同来源互相覆盖。

> [https://reference.dcsa.org/content/standards/releases/port-call/v2](https://reference.dcsa.org/content/standards/releases/port-call/v2) 链接与子链接解读

DCSA Port Call v2 是一套面向港口挂靠协同和 Just-in-Time Arrival 的标准。它描述的不只是“船什么时候到港”，而是一次港口访问中，船舶、码头、引航、拖轮、系泊、装卸等参与方如何交换计划、请求、预计和实际时间。

主页面：[Port Call v2](https://reference.dcsa.org/content/standards/releases/port-call/v2)

说明：官方网页读取环境本轮仍不可用，因此以下以 Port Call v2 已公开的领域模型和标准语义为基础；当前补丁版本、完整端点路径、字段必填性和枚举全集，实施时必须以该页面的 OpenAPI Specification 为最终权威。

#### 一、子链接应如何阅读

Port Call v2 发布页一般包含以下部分：

| 子页面                 | 主要内容                     | Logix用途            |
| ---------------------- | ---------------------------- | -------------------- |
| Introduction           | 港口协同及JIT背景            | 理解标准目标         |
| Purpose & Scope        | 覆盖范围和非覆盖范围         | 划分船舶与货柜事实   |
| User Stories           | 船方、港口、码头、服务商需求 | 提炼岗位任务         |
| Use Cases              | 建立挂靠、安排服务、交换时间 | 形成应用用例         |
| Endpoint Overview      | 资源及操作端点               | 配置连接器能力       |
| Business Process Model | 挂靠协同和时间协商过程       | 设计状态流转         |
| Data Overview          | 核心实体及关联关系           | 建立内部数据模型     |
| Conformance Scenarios  | 一致性测试场景               | 第三方接入验收       |
| Implementation Guide   | 调用、分页、版本等约束       | 指导适配器实现       |
| OpenAPI Specification  | 完整机器可读契约             | 生成客户端和契约测试 |
| Changelog              | 小版本变化                   | 管理兼容性           |

阅读优先级建议：

1. 用 Purpose、Use Cases 理解业务边界。
2. 用 Data Overview 建立内部模型。
3. 用 OpenAPI 确认端点、字段和枚举。
4. 用 Conformance Scenarios 验证供应商是否真正兼容。

#### 二、Port Call v2解决的问题

它主要回答：

> 一艘船在一次港口访问中，要去哪个码头、接受哪些服务，各参与方请求、承诺、预计和实际在什么时间完成？

典型参与方包括：

- 船公司或船舶运营方
- 船舶代理
- 港口管理机构
- 码头运营方
- 引航服务商
- 拖轮服务商
- 系泊服务商
- 装卸作业方
- 港口社区系统
- 数据平台

与一般船期接口相比，它更关注：

- 港口访问
- 码头访问
- 具体港口服务
- 参与方时间协商
- 服务执行结果
- JIT到港协调

#### 三、核心实体层次

Port Call的数据层级不是一张“到港记录表”，而是：

```text
Port Call
  └─ Terminal Call
       └─ Port Call Service
            └─ Timestamp
```

##### 1. Port Call

表示船舶对某一港口的一次访问。

通常包含：

- `portCallID`
- 港口访问引用
- 船舶IMO号
- 船名
- UN/LOCODE
- 港口访问状态
- 船舶进出港相关信息
- 创建和更新时间

业务含义：

> 船舶本次来到这个港口。

同一艘船多次访问同一港口，必须形成不同的 Port Call，不能只按 IMO号和港口覆盖更新。

##### 2. Terminal Call

表示一次 Port Call 中对具体码头或设施的访问。

通常关联：

- `terminalCallID`
- `portCallID`
- 码头或设施
- 靠泊顺序
- 服务代码
- 进口/出口航次
- 航线或服务引用

业务含义：

> 船舶本次港口访问中，进入某个具体码头作业。

一次 Port Call 可能包含多个 Terminal Call，例如：

- 多码头挂靠
- 港内移泊
- 先补给后装卸
- 同港不同作业设施

因此，Logix不能把“港口”和“码头”压缩为同一个字段。

##### 3. Port Call Service

表示在 Terminal Call 中执行的一项具体服务。

可能涉及：

- 引航
- 拖轮
- 系泊
- 靠泊
- 离泊
- 装卸作业
- 加油
- 供水
- 废物处理
- 船舶补给
- 其他港口服务

通常包含：

- `portCallServiceID`
- `terminalCallID`
- 服务类型
- 服务执行方
- 服务状态
- 服务相关位置
- 关联时间信息

业务含义：

> 在本次码头访问中，由谁提供哪项服务。

对于 Logix，最重要的通常是靠泊、装卸和离泊相关服务，而不是所有航海服务都进入核心货柜生命周期。

##### 4. Timestamp

Timestamp不是普通更新时间，而是参与方围绕某个服务事件提交的时间主张。

基本结构是：

```text
某项服务事件
  + 时间值
  + 时间分类
  + 提交方
  + 提交时间
  + 回复或关联关系
```

它可能表达：

- 计划时间
- 请求时间
- 预计时间
- 实际时间

常见分类语义包括：

| 分类      | 含义                 |
| --------- | -------------------- |
| Planned   | 原始或基准计划       |
| Requested | 服务需求方请求的时间 |
| Estimated | 当前预计时间         |
| Actual    | 实际发生时间         |

必须以 v2 OpenAPI 中的正式枚举代码为准，不能根据显示名称自行发明接口值。

#### 四、时间不是一个字段，而是协商链

Port Call最有价值的部分，是把“时间变化”建模为多方协作过程。

例如：

```text
码头提出可用靠泊时间
        ↓
船方返回预计到达时间
        ↓
引航方确认服务安排
        ↓
天气或拥堵导致时间调整
        ↓
船舶实际到达、靠泊和离泊
```

数据库不能只保留：

```text
eta = 2026-09-25 10:00
```

而应保存：

```text
timestamp_id
service_event_type
classifier
event_time
provider
provided_at
reply_to_timestamp_id
supersedes_timestamp_id
reason_code
remark
```

这样才能还原：

- 谁提出了什么时间
- 谁回复了该时间
- 时间为什么改变
- 当前采用的是哪个时间
- 最终实际发生时间是什么
- 哪次调整影响了后续业务

#### 五、与 OVS 的区别

| 维度       | Operational Vessel Schedules | Port Call                  |
| ---------- | ---------------------------- | -------------------------- |
| 关注对象   | 航线、航次、港序             | 单次港口访问及港口服务     |
| 时间粒度   | 到港、离港班期               | 引航、靠泊、装卸、离泊等   |
| 参与方     | 主要是船舶运营方             | 船方、港口、码头和服务商   |
| 时间机制   | 发布运营计划和预计           | 多方请求、预计、确认和实际 |
| 主要用途   | 航程预测                     | 港口资源与JIT协同          |
| 与货柜关系 | 间接                         | 仍然间接，但更接近卸船作业 |

二者关系可以表达为：

```text
OVS运输挂靠计划
       ↓
创建或匹配 Port Call
       ↓
拆分 Terminal Call
       ↓
安排 Port Call Services
       ↓
多方交换 Timestamp
       ↓
形成实际港口作业结果
```

OVS中的 `transportCallReference` 与 Port Call 标识之间应建立显式关联，不应通过覆盖字段实现合并。

#### 六、与货柜生命周期的边界

Port Call仍是船舶和港口作业层面的事实，并不直接证明某一个货柜的状态。

例如：

| Port Call事实  | 不能直接推导的货柜结论 |
| -------------- | ---------------------- |
| 船舶已到港     | 本柜一定在该船上       |
| 船舶已靠泊     | 本柜已经卸船           |
| 装卸服务已开始 | 本柜已经完成卸船       |
| 船舶已离港     | 本柜可以提取           |
| 码头作业结束   | 本柜已经海关放行       |

要确认货柜可提，还需要：

- 集装箱 Track & Trace事件
- Arrival Notice
- Manifest或提单关联
- 海关放行
- 船司放货
- 码头卸船状态
- 码头可提状态
- 费用和Hold状态
- 提柜预约条件

因此 Port Call 应作为强预测信号和船舶级事实，不应越级变成货柜级实际事件。

#### 七、建议的数据模型

建议保留 Port Call 原始层、协同层和货柜派生层：

```text
port_call
terminal_call
port_call_service
port_call_timestamp
timestamp_relation
port_call_party
port_call_location
port_call_snapshot
shipment_port_call_link
container_operational_projection
lifecycle_date_fact
```

##### `port_call`

建议包含：

- 内部ID
- `portCallID`
- 港口访问引用
- 船舶IMO号
- UN/LOCODE
- 来源提供方
- 标准版本
- 当前状态

##### `terminal_call`

建议包含：

- `terminalCallID`
- 所属 Port Call
- 码头和设施代码
- 泊位信息
- 访问顺序
- 航线和航次引用

##### `port_call_service`

建议包含：

- `portCallServiceID`
- 所属 Terminal Call
- 服务类型
- 服务提供方
- 服务事件类型
- 当前状态

##### `port_call_timestamp`

建议包含：

- 来源时间戳ID
- 服务ID
- 事件类型
- 分类：PLN/REQ/EST/ACT等
- 时间值
- 时区
- 提交参与方
- 提交时间
- 原因
- 备注
- 回复对象
- 替代对象

#### 八、接口同步方式

Port Call标准可能包含资源查询和状态交换能力，但不同提供方不一定实现全部端点。接入配置应按资源和动作声明，而不是简单写一个 `supportsPortCall: true`。

```yaml
standardFamily: DCSA_PORT_CALL
standardMajorVersion: 2

capabilities:
  portCalls:
    read: true
    write: false
  terminalCalls:
    read: true
    write: false
  portCallServices:
    read: true
    write: false
  timestamps:
    read: true
    write: false
  timestampReplies: false

synchronization:
  pull:
    enabled: true
    mode: INCREMENTAL
    overlapWindowMinutes: 120
  push:
    enabled: false
  webhook:
    enabled: false

identity:
  portCallID: true
  terminalCallID: true
  portCallServiceID: true
  transportCallReference: true
  vesselIMONumber: true
```

必须额外配置：

- 供应商支持的查询过滤器
- 时间分类枚举映射
- 服务类型映射
- 身份认证
- 限流
- 重试和超时
- 幂等键
- 并发版本
- 错误转换
- 原始报文保留策略

如果未来 Logix 要向港口参与方回写 Timestamp，则属于外部业务承诺，必须增加：

- 服务端授权
- 双向身份验证
- 幂等写入
- 乐观并发控制
- 操作人审计
- 草稿与审批
- 撤销或更正机制
- 失败补偿

不能把第三方回写设计成普通字段编辑。

#### 九、进入Logix后的事实分层

推荐分为四层：

```text
第一层：供应商原始报文
第二层：DCSA Port Call标准对象
第三层：Logix统一港口作业事实
第四层：对货柜生命周期的预测或证据
```

例如：

```text
Port Call靠泊预计时间
  ↓
标准Timestamp：EST
  ↓
统一事实：VESSEL_BERTHING_ESTIMATED
  ↓
货柜派生预测：预计卸船窗口
```

派生结果必须记录：

- 依据哪些来源事实
- 推导规则版本
- 推导时间
- 置信度
- 是否被人工确认
- 是否被后续实际事件替代

#### 十、工作台如何使用

##### 清关工作台

Port Call可以支持：

- 预计靠泊和卸船窗口
- 申报优先级排序
- 文件齐套倒计时
- 报关行任务提前分配
- 港口拥堵风险提示
- 实际到港后的申报触发

但海关放行必须来自海关、报关行或受控人工确认。

##### 提柜工作台

适合作为：

- 预计卸船时间输入
- 可提时间预测依据
- 车队预排依据
- 预约资源预判依据

不适合作为最终派车唯一条件。

建议区分：

```text
预排：可以使用Port Call预计时间
锁定：需要码头可提和清关状态
派车：需要预约、车队和放货条件齐备
```

##### 智能排柜

Port Call能显著改善排柜预测：

```text
预计靠泊
  ↓
预计装卸开始
  ↓
预计卸船完成
  ↓
预测码头可提窗口
  ↓
匹配车队、仓库和三方堆场资源
```

当靠泊、装卸或离泊时间发生变化时，系统应计算影响范围，而不是立即重排全部货柜：

- 哪些柜尚未锁定
- 哪些车队任务可调整
- 哪些仓库时段超载
- 哪些柜可能产生滞港费
- 哪些柜适合转入三方堆场

##### 异常中心

建议识别：

- 到港时间连续变化
- 请求时间与预计时间偏差过大
- 靠泊时间长期未确认
- 码头或泊位变更
- 港口服务取消
- 装卸开始延迟
- 实际时间迟迟缺失
- 多来源时间冲突
- Port Call与OVS航次不一致

#### 十一、状态与日期不能混用

Port Call的时间戳分类不应直接成为 Logix 货柜状态。

错误做法：

```text
收到ACT时间
→ container.status = AVAILABLE
```

正确做法：

```text
收到 Port Call ACT 时间
→ 保存船舶/服务实际事实
→ 检查该事实与货柜的关联强度
→ 更新卸船或可提预测
→ 等待货柜事件或码头可提事实
→ 再推进货柜状态
```

状态负责表达“当前可以做什么”，日期事实负责表达“什么时候计划、预计或实际发生”。

#### 十二、实施优先级

结合 Logix 当前从已出运货柜开始的范围：

##### 第一阶段：只读接入

- 拉取 Port Call、Terminal Call和Timestamp
- 保存不可变快照
- 建立船舶、航次、港口和码头匹配
- 展示靠泊、装卸、离泊时间线
- 不向外部系统回写

##### 第二阶段：业务预测

- 推导卸船窗口
- 预测可提窗口
- 驱动清关优先级
- 驱动车队和仓库预排
- 建立时间变化影响分析

##### 第三阶段：双向协同

- 与码头或港口社区系统交换时间
- 支持服务请求和时间回复
- 建立审批、授权和审计
- 处理冲突、拒绝、更正与补偿

#### 最终定位

Port Call v2在 Logix 中应定位为：

> 船舶进入港口后，围绕码头访问、港口服务及其计划、请求、预计和实际时间形成的协同事实层。

它位于 OVS 和货柜 Track & Trace 之间：

```text
OVS：船将如何运行
Port Call：船在港口如何协同作业
Track & Trace：货物或货柜实际发生了什么
```

最关键的设计要求是保留完整时间协商链，把 Port Call、Terminal Call、Service 和 Timestamp 分层建模，并且禁止将船舶级港口事实直接等同于货柜已卸、已放行或可提。

> [https://reference.dcsa.org/content/standards/releases/verified-gross-mass/v1](https://reference.dcsa.org/content/standards/releases/verified-gross-mass/v1) 链接与子链接

DCSA Verified Gross Mass（VGM）v1 定义了集装箱核实总重的数字化申报、接收和状态管理方式。它位于装箱完成之后、装船许可之前，是装箱工作台向出运执行交接的重要合规数据。

主页面：[Verified Gross Mass v1](https://reference.dcsa.org/content/standards/releases/verified-gross-mass/v1)

由于官方页面读取环境暂时不可用，下面重点解释其稳定的业务语义和 Logix 落地方式；准确补丁版本、端点路径、字段必填性和枚举代码应以页面中的 OpenAPI Specification 为最终依据。

#### 一、链接与子链接体系

VGM v1发布页通常包括：

| 子页面                 | 内容                      | Logix用途            |
| ---------------------- | ------------------------- | -------------------- |
| Introduction           | VGM背景及SOLAS要求        | 理解法律依据         |
| Purpose & Scope        | 标准覆盖与排除范围        | 确定系统边界         |
| User Stories           | 托运人、船司、码头等需求  | 设计岗位流程         |
| Use Cases              | 提交、接收、修改和处理VGM | 建立应用用例         |
| Endpoint Overview      | 接口资源与操作            | 建立连接器能力       |
| Business Process Model | VGM信息交换流程           | 设计状态和责任链     |
| Data Overview          | 重量、设备、参与方等对象  | 建立数据模型         |
| Conformance Scenarios  | 一致性测试场景            | 外部接入验收         |
| Implementation Guide   | 版本、调用及错误处理      | 指导适配器开发       |
| OpenAPI Specification  | 机器可读接口契约          | 契约测试和客户端生成 |
| Changelog              | 小版本变化                | 版本兼容管理         |

实施时应分别采信：

- SOLAS规则决定业务责任和法律含义。
- DCSA业务文档决定数据语义。
- OpenAPI决定具体接口契约。
- 船司、码头和当地主管部门规则决定具体截止时间及接受条件。

#### 二、VGM是什么

VGM是：

> 已装载集装箱的、经过规定方法核实的总重量。

基本构成为：

```text
货物重量
+ 包装材料
+ 托盘及加固材料
+ 集装箱皮重
= VGM
```

它不是以下任一字段的别名：

- 货物净重
- 货物毛重
- 包装后货物重量
- 集装箱皮重
- 提单申报重量
- 地磅单上的任意称重结果

这些重量可能相互关联，但业务语义和责任不同，不能只保留一个 `grossWeight` 字段。

#### 三、SOLAS业务边界

VGM源于 SOLAS 第 VI 章关于装载集装箱重量核实的要求。核心规则是：

- 托运人通常对提供VGM负责。
- VGM需要在船舶配载所要求的截止时间之前提交。
- 没有合规VGM的集装箱原则上不得装船。
- 船长和码头代表需要能够获得VGM。
- 各国家或地区主管机关可规定方法二的认证要求和允许误差。
- 船司、码头可能设置更具体的业务截止时间及格式要求。

因此，DCSA标准解决的是数据交换，不代替：

- 国家法规判断
- 计量设备认证
- 称重机构资质审核
- 船司VGM截止规则
- 码头装船放行决定

#### 四、两种核实方法

##### 方法一：整柜称重

货柜装箱、封箱后，对完整集装箱称重。

```text
装载完成并封箱
  ↓
整柜进入合规衡器
  ↓
取得总重量
  ↓
形成VGM
```

优点：

- 结果直观
- 数据链较短
- 更容易保留称重凭证

需要记录：

- 称重设备或称重点
- 称重日期时间
- 称重结果
- 单位
- 凭证
- 执行方
- 设备资质或校准信息

##### 方法二：组成项计算

分别计算货物、包装、托盘、加固材料等重量，再加集装箱皮重。

```text
货物及包装重量合计
+ 集装箱皮重
= VGM
```

方法二通常需要托运人获得所在地主管机关认可或满足当地制度要求。

需要额外记录：

- 各重量组成项
- 计算方法
- 数据来源
- 集装箱皮重来源
- 计算公式版本
- 认证或资质
- 操作人员

不能只保存最终VGM，否则无法证明计算过程。

#### 五、核心业务对象

##### 1. 集装箱设备

至少包括：

- `equipmentReference`，通常为箱号
- 设备类型或ISO尺寸类型
- 集装箱皮重
- 皮重来源
- 封条号
- 所属订舱或货运单

箱号应执行 ISO 6346 格式及校验位校验，但格式正确不代表该箱号一定真实有效。

##### 2. 核实总重

至少需要：

- 重量数值
- 重量单位
- 称重方法
- 称重日期时间
- 称重地点
- 数据来源
- 当前申报版本

内部建议统一转换为千克用于计算，同时保存来源原值和单位：

```text
source_weight_value
source_weight_unit
normalized_weight_kg
```

重量应使用定点十进制，不能使用浮点数。

##### 3. 责任参与方

需要明确区分：

- 法律责任托运人
- VGM提交方
- 实际称重方
- 方法二计算方
- 代理人
- 接收船司
- 接收码头

“谁录入系统”和“谁承担VGM法律责任”不是同一个概念。

##### 4. 业务引用

VGM需要与运输业务建立明确关系，例如：

- 集装箱号
- 船司订舱号
- Shipping Instruction引用
- 提单引用
- Shipment引用
- 船名航次
- 装货港
- 码头

其中箱号和订舱关系是核心，但不能仅凭箱号长期匹配，因为同一集装箱会循环使用。

##### 5. 支持文件

可能包括：

- 地磅单
- 称重证书
- 方法二计算明细
- 设备校准或资质文件
- 签名声明
- 船司或码头接收回执

文件应作为版本化文档对象管理，而不是只在VGM表中保存一个不可审计的URL。

#### 六、建议的业务状态

应区分内部准备状态与外部接收状态：

```text
DRAFT
  ↓
READY_TO_SUBMIT
  ↓
SUBMITTED
  ↓
ACCEPTED
```

异常分支：

```text
SUBMITTED → REJECTED
SUBMITTED → PENDING_CONFIRMATION
ACCEPTED  → CORRECTION_REQUIRED
任意有效版本 → SUPERSEDED
未生效申报 → CANCELLED
```

不要把“已提交”直接等同于“船司已接受”，也不要把“船司已接受”直接等同于“已经装船”。

推荐分别保存：

- `preparationStatus`
- `submissionStatus`
- `carrierAcceptanceStatus`
- `terminalAcceptanceStatus`
- `loadingEligibility`

最终能否装船可能还受订舱、进港、海关和码头Hold等条件影响。

#### 七、更正不能覆盖原记录

VGM可能因为以下原因修改：

- 重称
- 方法二计算错误
- 皮重使用错误
- 箱号关联错误
- 单位错误
- 船司拒绝后重新提交
- 换箱
- 装箱内容变化

建议采用不可变版本：

```text
vgm_declaration
  ├─ version 1：原始提交
  ├─ version 2：更正提交
  └─ version 3：最终接受
```

每个版本记录：

- 版本号
- 当前值
- 原因
- 修改人
- 修改时间
- 替代的版本
- 外部提交时间
- 外部回执
- 是否当前有效版本

不能使用普通 `UPDATE weight = ...` 抹掉原申报。

#### 八、建议的数据切片

```text
vgm_declaration
vgm_measurement
vgm_calculation_component
vgm_party
vgm_business_reference
vgm_document
vgm_submission
vgm_response
vgm_rule_evaluation
equipment_weight_profile
```

##### `vgm_declaration`

保存业务声明：

- 内部VGM ID
- 集装箱装载实例ID
- 箱号
- VGM数值和单位
- 称重方法
- 称重时间
- 称重地点
- 责任托运人
- 当前版本
- 状态

##### `vgm_measurement`

保存实际称重事实：

- 测量值
- 称重点
- 衡器标识
- 执行方
- 测量时间
- 凭证
- 精度或误差范围

##### `vgm_calculation_component`

主要服务于方法二：

- 货物重量
- 包装重量
- 托盘重量
- 加固材料重量
- 集装箱皮重
- 每项来源
- 计算规则版本

##### `vgm_submission`

保存每次外部提交：

- 接收方
- 接口连接器
- 标准版本
- 幂等键
- 请求时间
- 请求报文引用
- 处理状态
- 重试次数

##### `vgm_response`

保存船司或码头回执：

- 接受、拒绝或警告
- 外部引用号
- 原始错误代码
- Logix内部错误码
- 接收时间
- 错误字段和说明

#### 九、与备货、装箱、出运的衔接

完整链路应为：

```text
备货单
  ↓
装箱任务
  ↓
货物装入集装箱
  ↓
确认箱号、封条号和装箱明细
  ↓
执行方法一称重或方法二计算
  ↓
生成VGM声明
  ↓
提交船司/码头
  ↓
收到接受结果
  ↓
满足装船条件
```

##### 一柜一个备货单

关联比较直接：

```text
container_loading
  ├─ container
  ├─ stocking_order
  └─ VGM
```

##### 一柜多个备货单

VGM必须关联“本次集装箱装载实例”，而不是任选一个备货单：

```text
container_loading
  ├─ stocking_order A
  ├─ stocking_order B
  ├─ stocking_order C
  └─ 一个整柜VGM
```

VGM是整柜层面的声明，不应为同一柜的每张备货单分别产生一个正式VGM。

#### 十、导入阶段如何处理

当前项目从已出运数据导入起步，四张业务表中如果存在重量字段，应先做语义映射。

只有能够确认下列信息时，才能导入为正式VGM：

- 明确是核实总重
- 能关联到本次装载实例
- 有重量单位
- 有称重或申报来源
- 最好有称重方法或提交凭证

若只有“柜重”或“毛重”字段，应导入为：

```text
IMPORTED_REPORTED_WEIGHT
```

而不是直接标记为：

```text
VERIFIED_GROSS_MASS
```

建议增加数据质量等级：

| 等级     | 条件                    |
| -------- | ----------------------- |
| VERIFIED | 有正式VGM及接收证据     |
| DECLARED | 明确为VGM，但缺外部回执 |
| INFERRED | 根据现有字段推断        |
| UNKNOWN  | 无法判断重量语义        |

推断数据不能用于自动得出合规结论。

#### 十一、工作台设计

##### 装箱工作台

操作人员需要看到：

- 箱号及校验结果
- 箱型
- 封条号
- 装箱明细
- 货物和包装重量
- 集装箱皮重
- 当前VGM
- VGM方法
- 截止时间
- 缺失资料
- 船司或码头接收状态

允许动作：

- 选择称重方法
- 录入或接收称重结果
- 导入地磅数据
- 查看方法二计算明细
- 上传凭证
- 发起复核
- 提交VGM
- 更正并重新提交

##### 出运工作台

重点显示：

- 哪些柜尚无VGM
- 哪些柜接近VGM截止时间
- 哪些申报被拒绝
- 哪些VGM与装箱重量差异异常
- 哪些柜已换箱但VGM未更新
- 哪些柜尚未得到船司或码头确认

应提供按航次、订舱和截港时间聚合的处理队列。

##### 合规工作台

应检查：

- 所在法域是否允许方法二
- 方法二主体是否具备所需资质
- 称重设备证书是否有效
- 重量单位和允许误差
- 签署人权限
- VGM截止时间
- 更正是否重新提交
- 凭证是否满足保存期限

#### 十二、自动校验规则

推荐至少实施：

```text
箱号格式和校验位有效
VGM > 集装箱皮重
VGM <= 集装箱最大总重
重量单位可识别
称重时间不晚于提交时间
方法一必须有称重事实
方法二必须有组成项及计算过程
责任托运人不能为空
换箱后原VGM不得继续有效
重新装箱后必须重新评估VGM
当前有效版本只能有一个
提交操作必须幂等
```

还应检查：

```text
VGM - 装箱货物预计总重 - 皮重
```

是否超过允许差异阈值。差异只能触发复核，不能由系统静默修改重量。

#### 十三、外部接口配置

不同船司和码头可能支持不同操作，应按能力配置：

```yaml
standardFamily: DCSA_VERIFIED_GROSS_MASS
standardMajorVersion: 1

capabilities:
  submit: true
  retrieve: true
  replace: true
  cancel: false
  acknowledgement: true

weight:
  acceptedUnits: [KGM]
  normalizeTo: KGM
  supportsMethod1: true
  supportsMethod2: true

submission:
  idempotency: true
  cutoffSource: CARRIER
  requireDocument: false
  requireSignature: true

retention:
  preserveVersions: true
  preserveRawPayload: true
  preserveAcknowledgements: true
```

供应商差异可能包括：

- 认证方式
- 引用号要求
- 是否接受磅或仅接受千克
- 是否必须提供称重方法
- 是否接受更正或要求撤销重报
- VGM截止规则
- 签名字段
- 错误代码
- 回执是同步还是异步

#### 十四、与其他DCSA标准的关系

```text
Booking
  ↓ 确定订舱及设备需求
Shipping Instructions
  ↓ 提供货物、托运人和单证信息
装箱
  ↓ 形成箱号、封条和装载明细
VGM
  ↓ 确认核实总重
Track & Trace
  ↓ 记录进港、装船等执行事件
Electronic Bill of Lading
  ↓ 形成运输单证
```

VGM与这些对象可以共享业务引用，但必须保持独立状态：

- Shipping Instructions已提交，不代表VGM已提交。
- VGM已接受，不代表海关已放行。
- VGM已接受，不代表货柜已进港。
- VGM已接受，不代表货柜已装船。
- Track & Trace显示已装船，可以作为检查VGM流程异常的证据，但不能反向补造VGM声明。

#### 最终定位

VGM v1在 Logix 中应定位为：

> 集装箱装载实例的法定重量声明、证明材料、外部提交及接收结果。

它是装箱工作台向出运工作台交接的一个明确质量门：

```text
装箱完成
+ 箱号和封条确认
+ VGM生成
+ 必要凭证齐全
+ 船司/码头接受
= 满足VGM维度的装船条件
```

最关键的设计原则是：

1. VGM关联“本次装载实例”，不能只关联箱号或某一张备货单。
2. 原始重量、核实总重及方法二组成项分开保存。
3. 托运责任人、录入人、称重人和提交人分开建模。
4. 更正形成新版本，不覆盖历史申报和回执。
5. 对历史导入重量先做语义分级，不能把普通毛重自动认定为VGM。
