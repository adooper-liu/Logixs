# 外部数据与接口能力

> 状态分类：统一接入、原文留存、显式映射和来源裁决为已确认原则；连接器配置项为建议方案；每家供应商能力与认证方式待真实接口联调。

## 一、目标

船司、港口、码头、飞驼、云当、清关行、车队、仓库和堆场的接口各不相同，但业务上应通过统一接入过程转化为Logix能够理解和核验的信息。

统一接入不表示所有供应商使用相同协议，也不表示完全不写适配代码。它表示认证、请求、字段映射、代码转换、验证、幂等、错误、监控和来源治理遵循同一框架，供应商差异留在连接器边界内，不进入Shipment和货柜业务模型。

## 二、统一接入过程

```text
接收原始信息
→ 保存来源内容和回执
→ 按供应商规则解释字段和代码
→ 匹配Shipment、提单、货柜、航次或港口
→ 判断来源是谁、是否有资格证明该事实
→ 形成业务候选
→ 自动采用或进入人工复核
```

第三方平台是信息提供渠道，不因“接口返回成功”就成为海关、船司、码头或仓库的权威主体。

例如，聚合平台返回“已到港”，系统仍需知道该事件原始来源、事件定义、对应船舶还是货柜、发生时间和平台接收时间。如果其含义只是船舶抵达港区，就不能映射成货柜卸船或码头可提。

## 三、连接器能力模型

每个连接器先声明能力，而不是在代码里假设所有来源都支持同样接口：

```text
连接器
-> 能力：查询/订阅/文件交换/任务回传
-> 身份与认证
-> 请求模板和分页
-> 响应字段与代码映射
-> 时间、地点和单位归一
-> 验证与来源资格
-> 错误、限流和重试
-> 监控、版本和生效范围
```

同一船司可能支持Track & Trace但不支持订舱，同一港口可能只有网页查询或文件下载。能力目录需要记录可用环境、覆盖国家港口、支持的业务身份、更新频率、合同限制和生效日期。

## 四、可以配置的差异

- 接口地址、认证方式和可用环境。
- 支持哪些查询、推送或文件能力。
- 字段位置、代码映射、时间格式、时区和单位。
- 分页、限流、重试、超时和错误对应关系。
- 覆盖哪些船司、港口、码头、国家及生效时间。

配置需要版本、审核、测试样例和回退能力。

### 映射配置应能表达什么

- 从JSON、XML、CSV或受控文件中读取字段。
- 合并或拆分字段，处理空值和条件分支。
- 将供应商事件、港口、地点和单位映射为内部候选值。
- 按明确时区解析时间，并保留原始文本和精度。
- 校验必填、格式、允许值和业务身份。
- 把外部错误转换为稳定的内部错误类别。

映射发布前用真实脱敏样本回放，显示原始输入、中间转换、最终候选和错误。新版本先在测试或影子模式运行，确认无误后生效；出现异常可以回退旧版本。

## 五、仍然需要少量代码的差异

复杂签名、加密、挑战响应、特殊分页、多阶段交互、非标准文件和供应商缺陷兼容，应由受控适配代码处理。

不能把任意可执行脚本伪装成配置文本在生产运行。允许使用的表达式也必须限制能力、可检查、可审计。

“把少量适配代码包装成可配置文本”只能在受控表达能力内实现。适合配置的是字段路径、常量、条件、日期格式、代码表和简单组合；不适合配置的是任意网络访问、文件系统、动态加载、无限循环和通用脚本执行。

复杂签名或协议仍由经过测试和发布的适配器完成，再向配置层暴露有限参数。这样既保持扩展速度，也避免一段线上文本获得任意执行权限、绕过代码评审和安全控制。

## 六、可靠性和反馈

- 同一次消息重复到达不能重复产生业务结果。
- 内容不同却使用相同业务键时明确冲突。
- 区分已提交、对方技术接收和对方业务接受。
- 失败按规则重试，最终失败进入人工处理队列。
- 长期无更新时提示信息陈旧，不把旧值当作当前事实。

还需要处理乱序和更正。例如先收到实际到港，随后迟到的旧ETA不能把当前结果改回预计；供应商撤回或更正事件时，不删除原事件，而是建立更正关系并重新计算当前投影。

外部调用至少记录追踪身份、连接器版本、请求时间、响应状态、耗时、重试、业务匹配结果和最终是否采用。日志不保存Token、Cookie或无必要个人信息。

## 七、供应商能力目录

系统需要知道每个供应商在什么时间、对哪些船司/港口、支持哪些业务能力。供应商覆盖范围单独维护，不能写成港口或船司本身的固定属性。

### 已调研来源的共同特征

MSC、Maersk、Hapag-Lloyd、ONE、CMA CGM、Evergreen和COSCO等头部船司均在不同程度上提供开发者门户、API或EDI能力，但注册、合同、认证、覆盖业务和版本策略不完全相同。DCSA提供行业标准和参考模型，有助于统一语义，但不能据此假定每家船司已经实现相同版本或完整字段。

飞驼、云当等聚合服务可以降低多船司接入成本，也可能提供清洗后的事件；港口和码头官网则可能更接近本地作业事实。系统应通过能力、来源链和实际样本评价各渠道，而不是预设“直连一定优于聚合”或“接口一定优于官网”。

### 同一能力的多来源策略

一个货柜的ETA可能同时来自船司、聚合平台和港口。系统保留所有观察，根据事件语义、来源资格、时效和历史可靠性选择当前采用值。人工确认或锁定后，较弱来源不能自动覆盖；出现高权威冲突时进入复核并提示影响。

## 八、接入运维

### 官方来源证据目录

下表只记录本次业务分析已提供的官方入口和需要核验的接入事项，不把门户存在推断成某项API已经获权或可用于生产。具体端点、字段、版本、认证和商业条件应在接入任务中以官方文档和真实账户再次验证，并记录访问日期。

| 来源        | 官方入口                                                                                                        | 当前可确认                                                               | 接入前必须核验                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| MSC         | [Developer Portal](https://developerportal.msc.com/api-details/#api=DPO-DCSATrackAndTrace-API-V2)               | 存在面向开发者的Track & Trace API页面，页面名称指向DCSA Track & Trace V2 | 注册资格、认证、覆盖身份、生产权限、限流、版本和事件样本  |
| Maersk      | [Getting Started](https://developer.maersk.com/support/getting-started-api)                                     | 存在开发者入门和API接入门户                                              | 具体可用产品、订阅审批、OAuth/密钥方式、环境、限流和合同  |
| Hapag-Lloyd | [API Portal](https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html)                | 存在数据解决方案和API门户                                                | 能力目录、DCSA版本、账户权限、Webhook/轮询和覆盖范围      |
| ONE         | [API and EDI Catalog](https://www.one-line.com/all-digital-solutions/one-developer-portal/api-and-edi-catalog)  | 存在Developer Portal及API/EDI目录入口                                    | 各能力的接口/EDI边界、认证、地区限制、版本和样本          |
| CMA CGM     | [API Portal](https://api-portal.cma-cgm.com/)                                                                   | 存在独立API门户                                                          | 可公开查看与需签约能力、认证、环境、配额和DCSA对齐情况    |
| Evergreen   | [ShipmentLink API Portal](https://www.shipmentlink.com/_ec/APIPORTAL_Home)                                      | 存在ShipmentLink API门户入口                                             | 可用查询身份、认证、覆盖船司/地区、数据时效和生产授权     |
| COSCO       | [COP Portal](https://cop.lines.coscoshipping.com/copPortal/#/) / [公开代码仓库](https://github.com/cop-cos/COP) | 存在客户运营平台入口及公开仓库线索                                       | 仓库与生产API的正式关系、许可证、认证、支持能力和维护状态 |
| DCSA        | [Standards Reference](https://reference.dcsa.org/content)                                                       | 提供行业标准、业务蓝图和发布资料，用于语义及一致性参考                   | 项目采用的具体标准版本、船司实现差异、OpenAPI和一致性测试 |

以上“当前可确认”不等于已经完成接口回包验证。没有真实凭据、契约和脱敏样本前，能力状态只能是“目录已发现”或“待联调”，不能标记为可用。

运营人员需要看到连接器健康度、最近成功时间、失败率、限流、积压消息、未知代码和人工复核数量。接口“在线”不表示业务有效：如果连续返回空数据、旧数据或无法匹配身份，也应触发告警。

变更管理至少包括供应商公告、契约或样本变化监测、配置或适配器版本、回归样本、灰度、回退和影响范围。停用连接器时保留历史来源身份和审计记录。

## 九、一个船期更新例子

连接器使用提单号查询船司Track & Trace。响应中包含多个设备事件和新的预计到港时间。系统先保存原始响应，再根据连接器版本解析事件代码、地点、当地时间和设备号；无法识别的港口代码进入映射审核。

新的ETA作为外部候选与当前预测比较。如果变化超过阈值，系统提示受影响的清关、车队和仓库计划；若来源含义和身份匹配可靠，可以自动更新当前预测，但仍保留旧版本。响应中的“vessel arrived”不会被误映射成“container discharged”。

## 十、接入验收

- 有真实脱敏样本和预期结果。
- 未知代码不会静默通过。
- 时间、单位、地点和业务身份能够正确匹配。
- 原始信息、转换过程和最终采用结果可以追溯。
- 接口中断、重复、乱序和更正均有明确处理方式。
- 配置变更经过样本回放、审核和可回退发布。
- 供应商模型和代码不会进入内部业务对象。
- 工作台能够解释当前采用值来自哪里，以及为什么没有采用其他来源。

## 详细业务规格（按原始对话逐项重建）

本节保存形成业务基线时的完整分析，不以摘要代替论证。已去除工具日志、重复生成记录和无效文件引用，并按主题归入唯一文档。技术契约仍由 docs/ 负责。

### 海运接口平台、配置映射与船司验证

> 追溯范围：原始对话第 6726-9677 行。建议仍为建议；已确认规则以本文前部、12号文档和业务ADR为准。

#### 总体架构

```text
飞驼 API/Webhook ─┐
云当 API/Webhook ─┤
船公司 API/官网 ──┤
港口/码头 API ────┤
AIS/其他数据源 ───┘
        ↓
Provider Adapter
        ↓
原始消息与证据留存
        ↓
对象识别与关联
        ↓
字段/事件标准化
        ↓
来源权威与冲突裁决
        ↓
LifecycleDateFact / CanonicalEvent
        ↓
状态机合法应用
        ↓
工作台、预警和任务
```

#### 一、统一接入接口

每个供应商实现同一组Port：

```ts
interface OceanVisibilityProvider {
  providerCode: string;

  queryTracking(request: TrackingQuery): Promise<ProviderTrackingResponse>;

  normalize(
    response: ProviderTrackingResponse,
  ): Promise<NormalizedObservation[]>;

  verifyWebhook?(request: WebhookRequest): Promise<WebhookVerification>;

  acknowledgeWebhook?(messageId: string): Promise<void>;
}
```

查询条件支持：

```text
柜号
MBL/HBL
订舱号
船名航次
SCAC
起运港/目的港
```

不同供应商的能力不同，应登记能力矩阵：

```text
是否支持柜号查询
是否支持提单查询
是否支持Webhook
覆盖哪些船公司
覆盖哪些港口
是否提供AIS
是否提供码头事件
是否提供原始事件时间
是否提供预测ETA
历史数据范围
调用频率与限流
```

#### 二、来源登记

建立 `ProviderConnection`：

```text
providerCode
connectionType
tenantScope
supportedRegions
supportedCarriers
supportedPorts
credentialRef
rateLimitPolicy
pollingPolicy
webhookPolicy
enabledState
healthState
```

密钥只保存到密钥管理系统，数据库保存引用，不保存明文。

同一租户可以启用多个来源；系统不能写死“飞驼优先”。

#### 三、标准海运观测模型

外部数据先进入统一观测层：

```text
OceanObservation
- observationId
- providerCode
- interfaceCode
- sourceMessageId
- receivedAt
- observedAt
- subjectType
- subjectReference
- rawEventCode
- rawStatus
- rawLocation
- rawTime
- payloadHash
- rawPayloadRef
- mappingVersion
```

标准化后形成：

```text
NormalizedObservation
- canonicalEventCandidate
- containerNumber
- billNumber
- bookingNumber
- vesselName
- imoNumber
- voyageNumber
- locationType
- unlocode
- terminalCode
- timeKind
- occurredAtUtc
- sourceUtcOffset
- confidence
- evidenceRefs
```

标准化结果仍只是“候选事实”，不是最终状态。

#### 四、标准事件目录

海运和港口事件建议覆盖：

```text
booking_confirmed
empty_released
empty_picked_up
stuffed
gate_in_origin
loaded
departed
transit_arrived
transit_departed
arrived_destination
discharged
available_for_pickup
customs_hold
customs_released
terminal_hold
terminal_released
gate_out_destination
empty_returned
```

需要区分：

- 业务主节点；
- 港口子里程碑；
- 异常或Hold；
- 计划、预计和实际时间；
- 状态文本与事件事实。

`customs_hold`不能简单覆盖主生命周期状态，应作为阻断或异常轨道。

#### 五、日期事实

统一日期事实至少保存：

```text
nodeCode
eventCode
timeKind
occurredAtUtc
rawValue
sourceUtcOffset
locationTimezone
providerCode
sourceSystem
sourceEventId
mappingVersion
verificationState
confidenceState
authorityPolicyRef
evidenceRefs
receivedAt
```

`timeKind`严格区分：

```text
planned
estimated
actual
deadline
```

供应商推算的ETA属于 `estimated`，不能成为 `actual`。网页抓取时间也不能冒充事件发生时间。

#### 六、对象识别

外部消息经常只有柜号或提单号，需要对象解析：

```text
resolved
ambiguous
not_found
conflict
```

匹配优先级：

1. 供应商外部对象ID映射；
2. 当前运输实例中的柜号；
3. 提单及柜号组合；
4. 订舱号及柜号组合；
5. 船名航次、港口和时间辅助；
6. 仍不确定则进入人工队列。

不能只凭柜号永久关联，因为物理柜号会在不同运输中重复使用。

#### 七、来源权威策略

不同来源对不同事件的权威性不同，需要配置 `SourceAuthorityPolicy`：

| 事实         | 优先来源示例              |
| ------------ | ------------------------- |
| 船舶实际离港 | 港口/码头、船公司正式事件 |
| ETA          | 船公司、港口、可信聚合商  |
| 实际到港     | 港口/码头、船公司         |
| 实际卸船     | 码头事件                  |
| 可提柜       | 码头/船公司放货系统       |
| 清关放行     | 海关、清关行正式回执      |
| Gate Out     | 码头EIR、车队证据         |
| 还空箱       | 还箱场站EIR               |

策略需要包含：

```text
允许的来源
优先级
是否要求二次佐证
时间容差
地点要求
冲突动作
自动采信或人工复核
```

供应商中立的数据模型不能等同于“所有来源可信度相同”。

#### 八、多来源冲突

例如：

```text
飞驼 ETA：10月12日
云当 ETA：10月13日
船公司官网：10月14日
港口预计靠泊：10月14日 08:00
```

系统不能使用“最后写入覆盖”。应保存全部观测，并根据权威策略生成当前有效事实：

```text
全部来源观测
-> 适用性与时效判断
-> 权威来源排序
-> 当前有效事实
-> 与上一事实比较
-> 产生ETA变化和风险预警
```

工作台应显示：

- 当前采用值；
- 来源；
- 更新时间；
- 前一版本；
- 其他来源；
- 差异；
- 选择依据。

#### 九、Webhook与轮询

优先级建议：

1. 官方Webhook或事件订阅；
2. 官方API；
3. 第三方聚合API；
4. 批量文件；
5. 经授权的官网自动查询；
6. 人工录入。

Webhook需要：

- 签名验证；
- 消息ID；
- 幂等；
- 时间戳和重放保护；
- 原始载荷留存；
- 快速确认；
- 异步处理；
- 重试和死信。

轮询需要：

- 按生命周期调整频率；
- 限流；
- 指数退避；
- 抖动；
- 缓存；
- 超时；
- 断路器；
- 任务锁；
- 批量查询；
- 供应商健康监控。

例如即将到港或异常柜提高频率，已还箱柜停止轮询。

#### 十、官网数据接入

船公司和港口官网通常存在三种情况：

- 提供正式API；
- 提供登录后查询；
- 只有公开网页。

应优先寻求正式API或合作授权。自动化网页查询前必须核验：

- 网站使用条款；
- robots政策；
- 数据许可；
- 登录和验证码限制；
- 调用频率；
- 个人数据；
- 数据再利用权限；
- 页面结构变化风险。

不建议将未经授权的网页抓取作为核心生产来源。

如果确实允许官网自动查询，应使用独立浏览器/页面适配器，并保存：

```text
页面URL
查询条件
获取时间
页面版本
原始响应或截图
解析版本
提取位置
```

页面结构变化时应停止自动采信并报警，不能静默产生空值或错误事件。

#### 十一、船舶与航次身份

仅凭船名不稳定，需要维护：

```text
Vessel
- imoNumber
- mmsi
- vesselName
- nameHistory

VoyageCall
- carrier
- voyageNumber
- vesselId
- portCall
- terminal
- planned/estimated/actual arrival
- planned/estimated/actual departure
```

AIS可以提供船位和推测，但AIS位置不自动等于“到港、靠泊、卸船或可提柜”。

#### 十二、工作台展示

出运详情页需要显示“海运可视化”：

- 当前船名航次；
- 船舶位置；
- 路线和港序；
- 当前有效ETA；
- ETA变化；
- 最新权威事件；
- 数据最后更新时间；
- 来源健康；
- 多来源冲突；
- 缺失跟踪条件；
- 需要人工复核的事实。

清关、排柜和仓库工作台消费的是已裁决事实：

- 清关使用预计/实际到港；
- 排柜使用可提时间、最后免费日和Gate Out；
- 仓库使用到仓预测；
- 费用模块使用权威事件确定免费期起点。

#### 十三、异常与监控

运营监控需要覆盖：

- 供应商不可用；
- 凭据失效；
- 限流；
- Webhook签名失败；
- 重复消息；
- 消息乱序；
- 未识别事件码；
- 对象无法匹配；
- 同一事件时间冲突；
- 页面解析失败；
- 长时间无更新；
- 来源延迟；
- 状态回退；
- 数据时间在未来或明显异常。

这些问题进入集成运维队列，不能混进普通货柜业务异常。

#### 十四、实施顺序

建议：

1. 冻结标准事件、日期事实和对象身份契约。
2. 建立统一Provider Adapter接口。
3. 完善原始载荷、幂等、对象解析和来源权威。
4. 以现有飞驼能力作为第一个Adapter验证。
5. 接入云当作为第二来源，验证供应商中立和冲突裁决。
6. 接入一个船公司官方API。
7. 接入一个目的港/码头官方来源。
8. 建立来源健康、死信和人工复核工作台。
9. 将有效事实提供给清关、智能排柜、费用和通知模块。
10. 最后评估经授权的官网自动查询，不把网页抓取作为第一条路径。

最终边界应保持稳定：

> 飞驼、云当、港口、船公司和AIS都只产生版本化观测；经过对象解析、映射、来源权威、证据和时序校验后，才能成为Logix的日期事实或规范事件。新增或替换供应商时，不改变Shipment、Container和生命周期模型。

> 要将对接接口设计成可配置与映射的，不需要针对每个来源单独建代码，但要考虑不同来源的个性化差异，可以扩展配置，请结合合行业最佳实践规划

可以采用“配置优先、插件兜底”的集成平台，但需要明确一个现实边界：

> 标准HTTP/API、Webhook、文件和常见认证差异可以配置；特殊加密、验证码、非标准签名、复杂会话和网页自动化仍可能需要少量适配代码。

完全承诺“任何来源都不写代码”会迫使配置系统变成不受控的脚本平台，安全性和维护性更差。

推荐架构：

```text
连接配置
-> 协议执行器
-> 原始消息信封
-> 提取与转换
-> 标准海运观测
-> 业务对象解析
-> 来源权威裁决
-> 日期事实/规范事件
```

### 一、分层设计

#### 1. 通用协议执行器

系统内置少量稳定执行器，不按供应商开发：

```text
HTTP REST Pull
HTTP Webhook Push
SFTP File
Object Storage File
Email Attachment
Message Queue
Authorized Browser Adapter
Manual Upload
```

飞驼、云当、船公司和港口只是这些执行器的配置实例。

执行器负责：

- 连接；
- 认证；
- 超时；
- 重试；
- 限流；
- 分页；
- 游标；
- 增量同步；
- Webhook验签；
- 原始载荷保存；
- 技术错误处理。

执行器不理解“到港”“卸船”或“可提柜”等业务语义。

#### 2. 来源连接配置

```text
IntegrationProvider
IntegrationConnection
IntegrationEndpoint
IntegrationCredentialRef
IntegrationSchedule
IntegrationCapability
```

配置内容包括：

- 来源代码和名称；
- 协议类型；
- Base URL；
- 请求方法和路径模板；
- 请求头；
- 查询参数；
- 超时和重试；
- 认证方式；
- 分页方式；
- 增量游标；
- Webhook路径和签名策略；
- 限流；
- 覆盖船司、港口和国家；
- 支持的查询身份；
- 服务时间和SLA。

密钥值不进入配置正文，只保存密钥系统引用。

### 二、能力矩阵

不同来源的差异先通过能力声明表达：

```text
query_by_container
query_by_bill_of_lading
query_by_booking
query_by_vessel_voyage
supports_webhook
supports_history
supports_prediction
supports_terminal_events
supports_customs_events
supports_location_coordinates
supports_document_download
```

每项能力包含：

```text
supported
requiredInputs
responseProfile
freshnessExpectation
rateLimit
authorityScope
```

调度程序根据能力选择来源，不通过代码判断 `if provider === "xxx"`。

### 三、统一原始消息信封

无论API、Webhook还是文件，都先转换成统一信封：

```json
{
  "specVersion": "1.0",
  "messageId": "external-message-id",
  "providerCode": "provider-code",
  "connectionId": "connection-id",
  "interfaceCode": "container-tracking",
  "occurredAt": "2026-09-23T08:00:00Z",
  "receivedAt": "2026-09-23T08:00:05Z",
  "contentType": "application/json",
  "subjectRefs": {
    "containerNumber": "MEDU7620177"
  },
  "payloadRef": "object-storage-key",
  "payloadHash": "sha256..."
}
```

可以参考CloudEvents的信封思想，但不需要把供应商原始业务内容强行改成CloudEvents字段。

### 四、配置化提取

支持受控提取器：

- JSONPath或JMESPath；
- XPath；
- CSV/Excel列映射；
- 固定宽度文本；
- 正则表达式，仅用于局部值提取；
- 日期解析器；
- 数值和单位解析器。

示例配置：

```yaml
extraction:
  recordsPath: "$.data.events[*]"
  fields:
    externalEventId:
      path: "$.eventId"
      type: string
    containerNumber:
      path: "$.containerNo"
      transform: normalize_container_number
    rawEventCode:
      path: "$.eventCode"
    rawLocation:
      path: "$.location"
    rawOccurredAt:
      path: "$.eventTime"
    sourceUtcOffset:
      path: "$.timezone"
```

转换函数必须来自受控函数目录，禁止在配置里执行任意JavaScript、SQL或Shell。

### 五、标准化映射

提取后先形成来源中间模型，再映射为标准海运观测：

```text
ProviderExtractedRecord
-> ProviderValueMapping
-> NormalizedOceanObservation
```

配置化映射包括：

- 来源事件码 → 标准事件码；
- 来源状态 → 标准状态候选；
- 港口名称 → UN/LOCODE；
- 船公司名称 → SCAC或内部船司ID；
- 柜型别名 → 标准柜型；
- 来源时间字段 → planned/estimated/actual/deadline；
- 来源位置类型 → origin/transit/destination/terminal；
- 来源错误码 → 稳定内部错误码。

未知值必须进入待映射队列，不能默认成“其他”或直接丢弃。

### 六、行业标准对齐

海运标准模型建议参考和兼容：

- DCSA Track & Trace事件语义；
- DCSA标准设备、运输和港口事件；
- UN/LOCODE地点代码；
- ISO 6346集装箱号及校验位；
- ISO柜型代码；
- IMO船舶编号；
- SCAC等承运人代码；
- ISO 8601/RFC 3339时间；
- IANA时区；
- CloudEvents式消息信封；
- OpenAPI描述同步API；
- AsyncAPI描述Webhook和消息事件；
- JSON Schema描述配置和标准载荷。

“参考DCSA”不等于直接把DCSA对象当成内部领域模型。内部生命周期仍保持自己的稳定语义。

### 七、个性化差异的扩展点

差异应按层处理。

#### 配置即可处理

- 字段名不同；
- JSON嵌套不同；
- 事件码不同；
- 日期格式不同；
- 时区表达不同；
- 分页方式不同；
- 查询参数不同；
- 港口和船司别名；
- 错误码不同；
- Webhook载荷结构不同；
- 数据新鲜度不同。

#### 受控策略处理

- 某来源只对特定船司权威；
- 某港口来源只负责码头事件；
- 某来源ETA优先级更高；
- 某来源实际事件需要第二来源佐证；
- 时间差超过容差进入复核；
- 特定状态不允许自动推进。

#### 插件代码处理

- 非标准加密；
- 专有签名算法；
- 多步登录和Token交换；
- CAPTCHA；
- 网页交互；
- 加密压缩文件；
- 私有二进制协议；
- 需要多次关联请求才能形成一条记录。

插件只能扩展传输、认证或解析能力，不能直接写Shipment或改变状态机。

### 八、配置模型

建议核心对象：

```text
ProviderDefinition
ConnectionProfile
EndpointDefinition
AuthenticationProfile
CapabilityProfile
ExtractionMapping
ValueMappingSet
EventMappingPolicy
ObjectResolutionPolicy
SourceAuthorityPolicy
PollingPolicy
WebhookPolicy
RetryPolicy
ErrorMappingPolicy
```

全部版本化：

```text
draft
-> testing
-> approved
-> active
-> deprecated
-> retired
```

已处理消息必须记录使用的配置版本。修改映射不能改变历史解释。

### 九、来源权威配置

事件映射和来源权威不能混成一张表。

事件映射回答：

> 这个外部值是什么意思？

来源权威回答：

> 即使知道它是什么意思，是否允许采用它？

示例：

```yaml
authority:
  eventCode: arrived_destination
  scopes:
    carriers: ["MSC", "HLCU"]
    ports: ["USLAX", "USNYC"]
  allowedProviders:
    - provider: terminal_official
      priority: 100
      autoAccept: true
    - provider: carrier_official
      priority: 90
      autoAccept: true
    - provider: aggregator_a
      priority: 60
      requiresCorroboration: true
  conflictToleranceMinutes: 120
  conflictAction: review
```

### 十、对象解析配置

不同来源使用不同身份，应允许配置解析策略：

```yaml
resolution:
  attempts:
    - keys: [providerObjectId]
    - keys: [containerNumber, billNumber]
    - keys: [containerNumber, bookingNumber]
    - keys: [containerNumber, vesselImo, voyageNumber]
  ambiguousAction: review
  notFoundAction: unmatched_queue
```

匹配结果必须保存，不得每次重新猜测。

### 十一、时间语义配置

日期字段映射必须声明：

```text
事件
节点
时间种类
地点角色
来源时区
是否权威
是否允许推进状态
```

示例：

```yaml
timeMapping:
  sourceField: actualDepartureTime
  eventCode: departed
  nodeCode: origin_departure
  timeKind: actual
  timezoneSource: payload
  missingTimezoneAction: block
```

不能只配置“字段A映射到ATD”，却不说明时区、地点和来源权威。

### 十二、配置测试与发布

每份连接配置和映射配置必须有样本测试：

```text
输入原始载荷
预期提取记录
预期标准事件
预期对象匹配
预期采信结果
预期错误
```

发布流程：

```text
编辑配置
-> JSON Schema校验
-> 使用脱敏样本测试
-> 显示新旧版本差异
-> 回放历史样本
-> 检查未知值和行为变化
-> 双人审批
-> 灰度启用
-> 监控
-> 全量启用
```

映射发布后发现问题时，回滚到前一版本；历史消息保留原映射版本，可受审计地重放。

### 十三、配置管理工作台

管理员需要看到：

- 来源连接健康；
- 最近成功时间；
- API延迟和错误率；
- 限流情况；
- 待映射外部值；
- 对象匹配失败；
- 多来源冲突；
- 映射版本；
- 配置测试结果；
- 受影响事件数量；
- 死信和重放；
- 凭据即将过期。

配置界面应使用表单、映射表和测试预览，不允许直接编辑任意代码。

### 十四、安全约束

配置系统必须防止其成为远程执行平台：

- URL域名白名单；
- 禁止访问内网元数据地址；
- 凭据与配置分离；
- 请求头敏感字段脱敏；
- 响应大小限制；
- 文件类型限制；
- 超时和限流；
- 禁止任意脚本；
- 禁止配置SQL；
- Webhook验签；
- 配置变更审批；
- 全量审计；
- 测试环境和生产连接隔离。

### 十五、运行时可靠性

每个来源独立运行：

- 一个来源失败不阻塞其他来源；
- 原始消息先落证据再处理；
- Inbox幂等；
- Outbox投递；
- 指数退避；
- 熔断；
- 死信；
- 手工重放；
- 乱序处理；
- 映射失败隔离；
- 供应商健康评分；
- 数据新鲜度预警。

业务工作台应区分：

```text
没有事件发生
来源尚未更新
来源服务异常
对象未匹配
映射未知
来源冲突
```

不能统一显示为“暂无数据”。

### 十六、推荐实施顺序

1. 定义标准海运观测和事件目录。
2. 定义配置JSON Schema和版本生命周期。
3. 实现REST Pull、Webhook、SFTP/File三类执行器。
4. 实现JSONPath、表格列和受控转换函数。
5. 实现值映射、对象解析和来源权威策略。
6. 将现有飞驼接入迁移为第一个配置实例。
7. 用云当验证无需修改核心代码即可新增来源。
8. 用一个船公司官方接口验证官方来源。
9. 用一个港口/码头接口验证地点事件。
10. 最后增加插件SDK处理真正的特殊差异。

最终应达到：

> 大多数新来源只需创建连接、能力、提取、值映射和权威策略配置；特殊协议通过受限插件扩展。无论来源如何变化，标准观测、生命周期事实、工作台和业务规则都不改变。

> 少量适配代码 可不可以也 包装成成可配置的文本？

可以把大部分“少量适配逻辑”包装成可配置文本，但不建议允许管理员直接填写任意 JavaScript、Python 或脚本代码。

正确方向是：

> 使用受控声明式DSL覆盖常见差异；真正特殊的逻辑使用签名、版本化、沙箱化插件。

#### 推荐分层

| 层级 | 方式                         | 是否需要发布代码 |
| ---- | ---------------------------- | ---------------: |
| L1   | 字段路径、请求模板、值映射   |               否 |
| L2   | 受控表达式和转换流水线       |               否 |
| L3   | 声明式状态机、分页、认证流程 |               否 |
| L4   | 沙箱化WASM插件               | 是，但不改主系统 |
| L5   | 原生适配器插件               | 是，仅极少数来源 |

绝大多数API差异应落在L1–L3。

### 一、可以安全配置成文本的能力

#### 请求模板

使用Mustache/Liquid一类模板：

```yaml
request:
  method: GET
  path: "/tracking/{{containerNumber}}"
  query:
    billNo: "{{billNumber}}"
  headers:
    Accept: "application/json"
```

只允许引用明确输入变量，不允许执行系统命令或读取环境变量。

#### 字段提取

使用：

- JSONPath；
- JMESPath；
- XPath；
- CSV列名；
- Excel表头；
- 正则捕获组。

```yaml
extract:
  records: "$.data.events[*]"
  fields:
    eventId: "$.id"
    status: "$.status.code"
    eventTime: "$.eventTime"
    locationName: "$.location.name"
```

#### 数据转换

采用受控转换函数链：

```yaml
transform:
  containerNumber:
    from: containerNo
    pipeline:
      - trim
      - uppercase
      - validate_iso6346

  occurredAt:
    from: eventTime
    pipeline:
      - parse_datetime:
          format: "yyyy-MM-dd HH:mm:ss"
      - apply_timezone:
          fromField: timezone
      - to_utc
```

函数由平台实现并登记，配置只能组合，不能定义任意函数体。

#### 值映射

```yaml
valueMappings:
  eventCode:
    "Vessel Departed": departed
    "Loaded on Vessel": loaded
    "Discharged": discharged
```

支持精确、大小写归一、受控正则和默认行为：

```yaml
unknownValueAction: review
```

禁止默认映射成某个正常业务状态。

#### 条件表达式

可以使用CEL等安全表达式语言：

```yaml
when: >
  payload.eventType == "DEPARTURE"
  && payload.actual == true
  && has(payload.eventTime)
```

CEL适合：

- 布尔判断；
- 字符串和数字比较；
- 集合操作；
- 日期范围；
- 字段存在性；
- 受控函数调用。

它不支持任意文件、网络、线程或系统调用，安全性明显好于JavaScript。

#### 对象构造

使用JSONata或声明式映射模板：

```yaml
output:
  externalEventId: "$.id"
  eventCode: "'departed'"
  containerNumber: "$uppercase($.containerNo)"
  rawValue: "$.eventTime"
  evidenceRefs: "[$.documentId]"
```

需要限制可用函数、输出大小和执行时间。

### 二、认证流程也可以部分配置

标准认证可以配置：

```text
API Key
Basic Auth
OAuth 2.0 Client Credentials
OAuth 2.0 Authorization Code
JWT Client Assertion
HMAC签名
固定Token
mTLS
```

示例：

```yaml
authentication:
  type: oauth2_client_credentials
  tokenUrl: "https://provider.example.com/oauth/token"
  clientIdRef: "secret://provider/client-id"
  clientSecretRef: "secret://provider/client-secret"
  scopes: ["tracking.read"]
```

常见HMAC也可以提供声明式签名模板：

```yaml
signature:
  algorithm: HMAC-SHA256
  canonicalText:
    - request.method
    - request.path
    - request.timestamp
    - request.bodyHash
  outputEncoding: hex
  headerName: X-Signature
```

不允许在模板中直接暴露密钥值。

### 三、多步调用可以配置成流程

部分供应商需要：

```text
获取Token
-> 查询提单
-> 取得柜列表
-> 逐柜查询事件
```

可以设计有限状态的集成流程DSL：

```yaml
steps:
  - id: authenticate
    use: oauth_token

  - id: resolveContainers
    request: container_list
    input:
      billNumber: "{{input.billNumber}}"

  - id: fetchEvents
    foreach: "{{steps.resolveContainers.items}}"
    concurrency: 5
    request: container_events
    input:
      containerNumber: "{{item.containerNumber}}"
```

DSL必须限制：

- 最大步骤数；
- 最大循环次数；
- 最大并发；
- 总执行时间；
- 响应大小；
- 允许调用的已登记Endpoint；
- 禁止递归；
- 禁止动态目标域名。

### 四、不应配置成普通文本的能力

以下内容不适合普通DSL：

- 专有二进制协议；
- 复杂加密算法；
- CAPTCHA；
- 浏览器反自动化处理；
- 复杂PDF版面解析；
- 长连接私有协议；
- 依赖本地证书硬件；
- 需要第三方SDK；
- 复杂流式解压；
- 不规则网页交互。

如果强行支持，DSL会逐渐变成一门危险且难以测试的编程语言。

### 五、特殊逻辑的安全方案

#### 首选：WASM插件

特殊转换可以编译为WebAssembly：

```text
输入：标准JSON字节
输出：标准JSON字节
```

限制：

- 无默认网络访问；
- 无文件系统访问；
- 内存限制；
- CPU时间限制；
- 输出大小限制；
- 明确的宿主函数白名单；
- 插件签名；
- 内容哈希；
- 版本；
- 审批和灰度；
- 可回滚。

配置只引用插件：

```yaml
customTransform:
  pluginCode: carrier-x-event-decoder
  pluginVersion: 1.2.0
  config:
    statusField: event_status
```

#### 次选：进程隔离插件

需要供应商SDK时，在隔离Worker中运行：

- 独立进程或容器；
- 最小网络白名单；
- 独立凭据；
- 超时；
- 资源限额；
- 无数据库直写；
- 只返回标准原始信封或标准观测。

插件不能导入Shipment Repository，也不能直接推进状态。

### 六、不要采用“数据库里存JavaScript然后eval”

这种方案短期灵活，长期风险很高：

- 远程代码执行；
- 密钥泄露；
- 任意网络访问；
- 无限循环；
- 内存耗尽；
- 难以静态检查；
- 依赖版本不可控；
- 调试困难；
- 历史行为无法重现；
- 配置人员实际上变成生产程序员；
- 一次错误可能影响所有租户。

即使使用JavaScript沙箱，也存在逃逸、依赖和资源隔离风险，不应作为默认能力。

### 七、配置包

建议把一个来源的全部定义打包为版本化配置包：

```text
ProviderPackage
├── manifest.yaml
├── capabilities.yaml
├── connections.yaml
├── endpoints.yaml
├── extraction-mappings.yaml
├── value-mappings.yaml
├── authority-policies.yaml
├── error-mappings.yaml
├── fixtures/
└── tests/
```

Manifest包含：

```yaml
providerCode: provider-x
packageVersion: 1.3.0
minimumRuntimeVersion: 1.2.0
supportedInterfaces:
  - container-tracking.v1
configurationSchemaVersion: "1.0"
contentHash: "sha256:..."
```

配置可以存数据库，也可以版本控制；正式发布版本应不可变并具有内容哈希。

### 八、配置文本的测试

每个配置包必须自带脱敏样本：

```yaml
tests:
  - name: actual vessel departure
    inputFixture: departed.json
    expected:
      eventCode: departed
      timeKind: actual
      unlocode: CNSHA

  - name: unknown status
    inputFixture: unknown-status.json
    expected:
      outcome: review_required
      reasonCode: EXTERNAL_VALUE_UNMAPPED
```

发布前自动执行：

- Schema校验；
- 模板变量校验；
- Endpoint白名单；
- 凭据引用校验；
- 样本转换；
- 未知值测试；
- 超时测试；
- 输出契约验证；
- 历史样本回放；
- 与上一版本差异比较。

### 九、建议采用的开源组件

可以组合：

- JSON Schema：配置和输出验证；
- JSONPath/JMESPath：字段提取；
- JSONata：对象转换；
- CEL：安全条件表达式；
- Liquid/Mustache：请求模板；
- Ajv：JSON Schema运行时校验；
- Rego/OPA：复杂策略判断，可选；
- WASM/WASI：隔离特殊插件。

不要同时开放多套功能重叠的表达式语言。建议最小组合：

```text
JSONPath：提取
CEL：条件
受控函数流水线：转换
Mustache：请求模板
JSON Schema：校验
WASM：特殊兜底
```

### 十、最终边界

可以实现为：

```text
约80%来源：
完全配置，无新代码

约15%来源：
新增受控转换函数或认证策略

约5%来源：
WASM或隔离插件
```

因此答案是：少量适配逻辑可以尽量包装成配置文本，但应使用受控DSL，而不是任意脚本。配置解决结构差异，策略解决权威差异，WASM或隔离插件解决真正特殊的技术差异。这样既保持扩展性，也不会把生产系统变成一个不可审计的在线代码执行平台。

> 可以从网站获取头部船司接口方式，来验证规划

可以，而且用头部船司的实际接入方式反向验证后，现有“配置优先、少量适配代码兜底”的方向是成立的。但需要补充一个关键认识：

**船司官网的公开货柜查询页面，不等于可用于生产系统的正式接口。**
正式接入通常需要客户账号、商务关系、应用审批、API Key/OAuth 凭据，部分能力仍通过 EDI、SFTP 或邮件文件交换提供。

本次环境访问船司官网发生超时，因此下面是基于各船司公开开发者入口及行业接口模式形成的验证结论；认证字段、具体版本和准入条件仍需在取得账号后做二次实测，不能把它们直接当成已经签约可用的接口。

**头部船司验证矩阵**

| 来源                 | 官方入口                                                                                        | 常见正式能力                         | 接入形态                               | 对规划的验证                                 |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- | -------------------------------------------- |
| Maersk               | [Developer Portal](https://developer.maersk.com/)                                               | 船期、订舱、货件/箱动态等            | REST API，应用凭据，部分能力需客户授权 | 通用 REST 执行器 + 凭据配置可以覆盖          |
| Hapag-Lloyd          | [Developer Portal](https://developer.hlag.com/)                                                 | Track & Trace、船期、报价及相关服务  | REST API，开发者注册与授权             | 同一执行器可用，但权限范围必须配置化         |
| CMA CGM              | [API Portal](https://api-portal.cma-cgm.com/)                                                   | 船期、追踪、订舱及客户服务接口       | API Portal，订阅产品后授权             | 需要“API 产品订阅/审批状态”管理              |
| MSC                  | [API & EDI Solutions](https://www.msc.com/en/solutions/digital-solutions/api-and-edi-solutions) | 追踪、订舱、运输指令、EDI 数据交换   | API + EDI，通常需要商务接入            | 仅 REST 不够，必须保留 EDI/SFTP 执行器       |
| ONE                  | [ONE eCommerce](https://ecomm.one-line.com/)                                                    | 船期、货物追踪及客户电子服务         | 门户、API/EDI 能力依地区和客户开放     | 能力不能只按“船司”配置，还需按地区和租户配置 |
| Evergreen            | [ShipmentLink](https://www.shipmentlink.com/)                                                   | 公开追踪、船期及客户电子服务         | Web 门户为主，正式数据交换需另行确认   | 公开网页只能作为人工查询或受控补偿通道       |
| COSCO SHIPPING Lines | [E-Business](https://elines.coscoshipping.com/)                                                 | 追踪、船期、订舱及客户电子服务       | 门户、API/EDI/客户协作方式需商务确认   | 必须允许“同一来源多种协议并存”               |
| DCSA                 | [Track & Trace 标准](https://dcsa.org/standards/track-and-trace)                                | 标准事件语义、设备/运输/货物事件模型 | 标准 API 规范，不是实际数据供应商      | 可作为标准化映射依据，不能代替船司接入授权   |

#### 对现有规划的结论

现有架构无需推翻，但建议从“一个船司一个连接器”进一步调整为：

```text
数据提供方
  -> 接入通道实例
  -> 通用协议执行器
  -> 原始报文留存
  -> 来源版本对应的提取映射
  -> 标准运输事件
  -> 业务对象匹配
  -> 来源采信策略
  -> 出运生命周期日期事实
```

其中要严格拆开三个概念：

1. **提供方 Provider**
   例如 Maersk、MSC、飞驼、港口官网。

2. **接入通道 Channel**
   同一家船司可能同时存在 REST API、Webhook、EDI、SFTP 文件和网页查询。

3. **能力 Capability**
   例如按箱号查询、按提单查询、船期查询、增量事件订阅、历史回溯。

这能避免以后出现“已经配置了某船司，所以默认所有接口都能用”的错误假设。

#### 配置可以覆盖的部分

以下内容适合完全配置化：

- 请求 URL、HTTP 方法、请求头、查询参数
- API Key、OAuth2 Client Credentials 等认证策略
- 箱号、提单号、订舱号、船名航次等查询主键
- JSONPath/XML XPath/CSV/EDI 字段提取
- 外部事件代码到内部事件类型的映射
- 港口代码、时区、日期格式和精度
- 分页、游标、水位线、轮询频率
- 重试、超时、限流和熔断
- Webhook 验签规则
- 来源优先级和字段采信策略
- API 版本、配置版本及生效时间
- 原始报文脱敏、保留期限和审计策略

#### 仍可能需要少量代码的部分

以下差异不应强行塞进普通字段映射：

- 特殊请求签名或厂商加密算法
- OAuth 之外的交互式登录流程
- 复杂 EDI 报文解析
- 验证码、动态令牌和反自动化机制
- 非标准压缩、加密、证书双向认证
- 极不规则的嵌套事件合并
- 供应商 SDK 或专用消息中间件
- 网页结构变化频繁的受控浏览器适配

这些可以封装成受控插件，但不能把 JavaScript/Python 文本存入数据库后直接 `eval`。推荐配置引用已审核能力：

```text
executorType: REST
authProfile: OAUTH2_CLIENT_CREDENTIALS
extractor: JSONPATH
transformPipeline: dcsa-track-trace-v2
specialHandler: maersk-signature-v1
```

`specialHandler` 是代码仓库中经过测试、版本化和发布的插件标识，不是任意可执行文本。

#### 必须新增的配置模型

建议每个通道至少保存：

- `providerCode`
- `channelCode`
- `protocolType`
- `environment`
- `region`
- `tenantScope`
- `capabilities`
- `authenticationProfile`
- `requestTemplateVersion`
- `responseMappingVersion`
- `eventStandardVersion`
- `supportsPolling`
- `supportsWebhook`
- `supportsHistoricalBackfill`
- `rateLimitPolicy`
- `termsOfUseReference`
- `dataAuthorityPolicy`
- `effectiveFrom/effectiveTo`
- `lastVerifiedAt`
- `verificationStatus`

特别是 `lastVerifiedAt` 和 `verificationStatus`。船司接口升级、客户权限变化或门户改版后，系统必须知道某项能力是否仍然有效。

#### 实际验证方法

不能只看官网宣传页，应为每个候选来源建立“接入认证包”：

1. 保存官方接口文档版本和准入条件。
2. 取得测试或生产凭据。
3. 用同一批真实箱号、提单号进行查询。
4. 保存原始响应作为脱敏 fixture。
5. 验证预计/实际时间、地点、事件类型和时区。
6. 验证晚到事件、重复事件、事件撤销和时间修正。
7. 对比船司、聚合商、港口三个来源的差异。
8. 测试限流、超时、凭据失效和 API 升级。
9. 确认许可条款是否允许存储、再分发和长期留存。
10. 验证通过后才将来源状态改为 `PRODUCTION_APPROVED`。

最终结论是：**头部船司的现实接入方式支持当前配置化平台方向，但平台至少要同时支持 REST、Webhook、EDI/SFTP 和受控人工补录；公共网页抓取不应成为主要生产链路。** DCSA 应作为标准语义层使用，而不是假设所有船司都提供完全一致的 DCSA 接口。

> [https://developerportal.msc.com/api-details/#api=DPO-DCSATrackAndTrace-API-V2](https://developerportal.msc.com/api-details/#api=DPO-DCSATrackAndTrace-API-V2)

这个链接比 MSC 的数字化解决方案介绍页更有证明力：

[MSC DCSA Track & Trace API V2](https://developerportal.msc.com/api-details/#api=DPO-DCSATrackAndTrace-API-V2)

它至少能确认：

- MSC 已将 Track & Trace 作为正式、版本化的 API 产品提供。
- API 明确采用 DCSA Track & Trace 语义，而不是仅提供网页货柜查询。
- 我们采用“DCSA 标准事件模型 + 船司通道配置”的方向正确。
- MSC 应配置为正式 API 通道，官网查询页只作为人工核查入口。
- 接口配置必须绑定版本，不能简单配置成泛化的 `MSC_TRACKING`。

建议形成如下实例：

```yaml
providerCode: MSC
channelCode: MSC_DCSA_TRACK_TRACE_V2
protocolType: REST
standardFamily: DCSA_TRACK_AND_TRACE
standardVersion: V2
capabilities:
  - EVENT_QUERY
authenticationProfile: MSC_DEVELOPER_PORTAL
requestMappingVersion: msc-dcsa-tt-v2-request-1
responseMappingVersion: dcsa-tt-v2-response-1
authorityScope:
  - EQUIPMENT_EVENT
  - TRANSPORT_EVENT
  - SHIPMENT_EVENT
```

其中 `authenticationProfile` 目前只能作为待核验配置，不能提前假设是 API Key、OAuth2 或二者组合。

这个案例也说明了需要采用“两层映射”：

```text
MSC API 报文
  -> DCSA V2 标准事件
  -> Logix 运输日期事实与业务里程碑
```

第一层处理 MSC 的认证、URL、分页和实现差异；第二层才处理业务含义。例如：

| DCSA 信息                    | Logix 用途                 |
| ---------------------------- | -------------------------- |
| `eventType`                  | 区分运输、设备、货运事件   |
| `eventClassifierCode`        | 区分计划、预计、实际事件   |
| `eventDateTime`              | 形成带精度与来源的日期事实 |
| `equipmentReference`         | 匹配集装箱号               |
| `transportDocumentReference` | 匹配提单                   |
| `carrierBookingReference`    | 匹配订舱                   |
| `UNLocationCode`             | 标准化港口或作业地点       |
| `transportCall`              | 匹配船舶、航次和挂港       |
| `eventID`                    | 去重和追踪事件修订         |

需要特别注意：DCSA 事件不能直接覆盖业务表里的日期。正确做法是追加观察事实：

```text
external_event
    -> lifecycle_date_observation
    -> authority/conflict evaluation
    -> lifecycle_date_fact
```

这样同一个 ETA 被 MSC、飞驼、港口官网多次更新时，可以保留变化轨迹、来源和采信理由。

当前还需要从该产品页或其 OpenAPI 文件核实：

- 实际 DCSA 小版本，如 `2.0/2.1/2.2`
- 支持的查询主键
- 是否支持订阅/Webhook，还是仅轮询查询
- 认证及 Token 生命周期
- 分页、限流和历史查询窗口
- 事件撤销、修订和重复发送机制
- 测试环境及生产准入条件
- MSC 是否对标准字段作了扩展或裁剪

我尝试直接读取该页面，但当前环境对 MSC 网站连接被重置，内置浏览器进程也异常退出，因此没有把这些未读取到的细节冒充成已核验事实。若能从门户下载 OpenAPI JSON/YAML，它将是下一步最有价值的验证材料：可以直接生成契约测试，并判断 MSC 接入究竟能做到纯配置，还是需要一个很薄的认证适配插件。

> [https://developer.maersk.com/support/getting-started-api](https://developer.maersk.com/support/getting-started-api)

这个 Maerssk 页面验证的是“接入治理”，与 MSC 的“标准业务接口”形成互补：

- MSC 证明：船司业务事件可以按 DCSA 标准输出。
- Maersk Getting Started 证明：调用接口前还存在开发者注册、应用创建、API 产品订阅、凭据获取及生产授权流程。

因此，系统不能只配置 URL 和字段映射，还必须管理四个相互独立的层次：

```text
船司 Provider
  -> 开发者应用 Application
  -> API 产品订阅 Subscription
  -> 租户授权 Entitlement
  -> 运行凭据 Credential
```

建议 Maersk 通道按以下方式建模：

```yaml
providerCode: MAERSK
channelCode: MAERSK_API
protocolType: REST

application:
  externalApplicationId: secret-ref
  environment: PRODUCTION

subscription:
  productCode: configured-per-api
  approvalStatus: PENDING | APPROVED | SUSPENDED
  effectiveFrom: null
  effectiveTo: null

authentication:
  scheme: configured-from-api-definition
  apiKeyHeader: Consumer-Key
  apiKeySecretRef: vault://maersk/consumer-key
  oauthProfileRef: null

entitlement:
  scopeType: TENANT_CUSTOMER
  externalCustomerReferences: []
```

这里有一个重要设计修正：**认证成功不等于有权读取某票货物。**

系统需要分别判断：

| 层次                 | 回答的问题                         |
| -------------------- | ---------------------------------- |
| Credential           | 调用者是谁，凭据是否有效           |
| API Subscription     | 该应用是否订阅了这个 API 产品      |
| Customer Entitlement | 该应用可以访问哪些客户、订舱或提单 |
| Data Authority       | 返回的数据能否成为某类内部事实     |
| Mapping              | 外部字段如何转成标准字段           |

例如，拿到 `Consumer-Key` 只能证明应用身份；它未必意味着能查询所有箱号，也不意味着返回 ETA 可以无条件覆盖港口或船司此前提供的实际时间。

#### 通用认证配置需要扩展

建议认证类型至少支持：

```text
NONE
API_KEY_HEADER
API_KEY_QUERY
OAUTH2_CLIENT_CREDENTIALS
OAUTH2_AUTHORIZATION_CODE
API_KEY_PLUS_OAUTH2
MUTUAL_TLS
SIGNED_REQUEST
```

凭据本身不能进入普通配置表，应保存为密钥引用：

```json
{
  "authScheme": "API_KEY_HEADER",
  "parameters": {
    "headerName": "Consumer-Key",
    "secretRef": "vault://integrations/maersk/production/consumer-key"
  }
}
```

数据库只保存 `secretRef`，日志必须屏蔽对应请求头。

#### 工作台还需要“接口接入状态”

管理员应能看到：

- 开发者账号是否建立
- 应用是否创建
- API 产品是否已申请
- 沙箱/生产权限是否批准
- 凭据是否即将到期
- 最近一次连通测试
- 最近一次成功拉取
- 最近的 `401/403/429/5xx`
- 当前允许查询的客户或业务范围
- API 条款及文档版本
- 负责人和续期日期

状态应区分：

```text
DOCUMENTED
SANDBOX_READY
PRODUCTION_PENDING
PRODUCTION_APPROVED
SUSPENDED
CREDENTIAL_EXPIRED
DEPRECATED
```

因此，Maersk 案例进一步证明：**字段与请求可以高度配置化，但开发者应用、产品订阅、租户数据授权和密钥生命周期必须成为平台的一等对象。**

当前环境访问该站点仍然超时，所以 Maersk 各具体 API 是否只需 `Consumer-Key`、是否叠加 OAuth、以及客户数据授权方式，应以对应 API 产品页/OpenAPI 定义为准，不能从 Getting Started 页面统一推断。

> [https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html](https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html)

这个 Hapag-Lloyd 链接补充验证了一个重要边界：

[Hapag-Lloyd API Portal](https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html)

我实际访问时，官网返回了需要 JavaScript、Cookie 或验证码的 Managed Security Challenge，而不是 API 产品正文。这说明必须把两个平面分开：

```text
控制平面：开发者门户
- 查看产品
- 注册应用
- 申请权限
- 获取文档和凭据
- 接受条款

数据平面：正式 API
- 系统间调用
- 认证与限流
- 查询或接收运输事件
- 返回结构化报文
```

不能抓取开发者门户来获取生产数据，也不应尝试绕过验证码。Hapag-Lloyd 门户应作为人工接入和证据来源，真正的自动化连接必须使用获批后的数据平面端点。

因此，连接器配置还要增加：

```yaml
providerCode: HAPAG_LLOYD

controlPlane:
  portalUrl: https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html
  onboardingMode: MANUAL
  automationAllowed: false

dataPlane:
  baseUrl: null # 获批后录入
  apiProductCode: null # 按具体产品录入
  apiVersion: null
  protocolType: REST
  authenticationProfileRef: null

verification:
  status: DOCUMENTED
  contractVerified: false
  credentialsVerified: false
  connectivityVerified: false
```

目前仅能确认它存在官方 API Portal，不能根据这个入口页擅自认定：

- 一定采用 OAuth2 或 API Key；
- 一定支持 DCSA Track & Trace；
- 一定支持 Webhook；
- 箱号、提单号、订舱号都可以查询；
- 所有客户都可直接自助开通。

这些结论要由具体产品页、OpenAPI 契约和测试凭据分别确认。

截至目前，三个案例已经验证出较清晰的分层：

| 船司证据                  | 验证重点                                     |
| ------------------------- | -------------------------------------------- |
| MSC DCSA Track & Trace V2 | 标准化运输事件契约                           |
| Maersk Getting Started    | 应用、订阅、凭据和授权流程                   |
| Hapag-Lloyd API Portal    | 控制平面与数据平面隔离，门户不可作为采集接口 |

这还带来一个产品要求：集成管理工作台不能只显示“接口启用/停用”，而要分别显示 `文档已确认、产品已申请、权限已批准、契约已导入、凭据已配置、连通已验证、生产已启用`。否则很容易把“找到官网入口”误认为“接口已经可用”。

> [https://www.one-line.com/all-digital-solutions/one-developer-portal/api-and-edi-catalog](https://www.one-line.com/all-digital-solutions/one-developer-portal/api-and-edi-catalog)

ONE 页面成功读取到了结构化产品目录，提供了目前最明确的一组验证证据：

[ONE API and EDI Catalog](https://www.one-line.com/all-digital-solutions/one-developer-portal/api-and-edi-catalog)

截至 2026-09-23，页面公开的产品包括：

| 产品                    |   版本 |        DCSA 合规 | 状态        |
| ----------------------- | -----: | ---------------: | ----------- |
| Track & Trace           |   V3.2 |               是 | 可用        |
| Point-to-Point Schedule | V1.0.9 |               是 | 可用        |
| Vessel Schedule         | V1.0.9 |               是 | 可用        |
| Port Schedule           | V1.0.9 |               是 | 可用        |
| Reefer Monitoring       |   V2.5 | 否，ONE 自有规范 | Coming Soon |
| Contract Rate           |   V1.3 |               否 | 可用        |

其中还有两个重要事实：

- Track & Trace 被描述为使用标准化数据模型查询货运状态和位置。
- Reefer Monitoring 明确采用 Push 模式发送 `ReeferEvents`，但不是 DCSA 标准。

#### 最重要的架构结论

MSC 是 DCSA Track & Trace V2，而 ONE 已是 V3.2。由此可以确认：

**内部领域模型不能直接等同于某一版 DCSA Schema。**

正确结构应是：

```text
MSC DCSA T&T V2 ──> DCSA V2 Adapter ──┐
                                      │
ONE DCSA T&T V3.2 -> DCSA V3 Adapter ─┼-> Logix 标准运输事件
                                      │
飞驼/云当自有格式 -> Mapping Adapter ──┘
```

否则一旦直接用 DCSA V2 字段建核心表，接入 ONE V3.2 时就会被迫修改业务表和全部消费者。

建议把配置拆成：

```yaml
providerCode: ONE
channelCode: ONE_TRACK_TRACE_V3_2
capabilityCode: TRACK_AND_TRACE
protocolType: REST

externalContract:
  family: DCSA_TRACK_AND_TRACE
  version: "3.2"
  providerExtension: ONE
  specificationHash: null

normalization:
  targetModel: LOGIX_TRANSPORT_EVENT
  mappingVersion: one-dcsa-tnt-3.2-to-logix-1

lifecycle:
  status: DOCUMENTED
  contractImported: false
  credentialsVerified: false
  productionApproved: false
```

#### “是否 DCSA”必须按产品记录

ONE 的同一家供应商中：

- Track & Trace 是 DCSA；
- 船期接口是 DCSA；
- Reefer Monitoring 不是 DCSA；
- Contract Rate 也不是 DCSA。

因此不能设计成：

```text
provider.dcsa_compliant = true
```

应该设计成：

```text
provider_capability.standard_family
provider_capability.standard_version
provider_capability.conformance_status
```

即合规属性属于“供应商 + API 产品 + 版本”，不属于整个船司。

#### 对推送能力的验证

ONE 的冷藏箱监控明确出现 Push 模型，这证明平台必须同时支持：

```text
PULL：定时查询 Track & Trace、Schedule
PUSH：Webhook 接收冷藏箱或运输事件
FILE：EDI/SFTP 批量交换
```

三者进入相同的原始消息入口：

```text
raw_integration_message
- provider
- channel
- capability
- contract_version
- delivery_mode
- external_message_id
- received_at
- payload_hash
- raw_payload_reference
- processing_status
```

这样数据来自轮询、Webhook 还是 EDI，不影响后面的标准化、去重、采信和生命周期计算。

#### 与当前业务的优先级

针对“已出运货柜全生命周期”，ONE 产品中建议：

1. `Track & Trace V3.2`：第一优先，提供运输事件事实。
2. `Vessel Schedule V1.0.9`：用于船舶航次和挂港计划。
3. `Port Schedule V1.0.9`：用于目的港拥堵、到离港计划辅助判断。
4. `Point-to-Point Schedule`：主要服务未来出运计划。
5. `Reefer Monitoring`：只有冷藏箱业务需要时启用。
6. `Contract Rate`：属于未来订舱、采购和成本预测范围。

页面元数据还给出了 OpenAPI 文件名，例如 `OceanNetworkExpress-DCSA_TnT-3.2-normalized-aligned.yaml`。我尝试按页面相对路径下载，但直接访问返回 404，说明下载地址可能由前端动态生成或需要门户会话。因此目前可以确认产品、版本和 DCSA 标识，但认证方案、具体查询参数及订阅端点仍需取得实际 OpenAPI 文件后确认。

ONE 的证据最终确认了三个核心设计原则：**按能力接入、按契约版本映射、内部模型独立于 DCSA 版本。**

> [https://api-portal.cma-cgm.com/](https://api-portal.cma-cgm.com/)

CMA CGM 门户成功读取，公开前端资源包含了相当完整的接入规则。这个案例对我们的规划验证价值很高。

[CMA CGM API Portal](https://api-portal.cma-cgm.com/)

#### 已核实的接入机制

CMA CGM 把接口明确分为两类：

| 接口类型                  | 认证方式                                 | 准入方式                                   |
| ------------------------- | ---------------------------------------- | ------------------------------------------ |
| Public API                | API Key，门户文档称为 `keyId`            | 新用户可获得30天免费试用，但有调用额度限制 |
| Private API               | OAuth 2.0 Client Credentials，Bearer JWT | 需要签署合同并完成客户配置                 |
| Transactional Private API | OAuth2 + 客户权限                        | 订舱请求等接口还必须完成 UAT 配置          |

其他已读取到的规则：

- OAuth2 使用 `client_credentials`。
- Token 有效期为 **5分钟**，需要自动缓存和提前刷新。
- 私有 API 按 `scope` 授权。
- API Key 和 Client Secret 均被视为密码。
- 支持申请密钥轮换。
- 默认分页返回前50条。
- 更多数据使用 HTTP `206 Partial Content`。
- 分页采用 `Range` 请求头和 `content-range` 响应头。
- 限流返回 `429 Too Many Requests` 和 `retry-after`。
- CMA CGM 明确不支持 CORS，不能从浏览器前端直接调用。
- 官方不鼓励周期性全量批量抓取，建议事务式调用并在本地缓存。
- 订阅申请后，官方说明通常会在48个工作小时内联系提供合同方案。
- 门户路由中分别存在 API Applications 和 Event Applications，说明请求接口与事件接入是分开治理的；具体事件产品仍需查看产品目录确认。

#### 对当前架构的直接修正

##### 1. 所有船司调用必须经过后端

```text
出运工作台浏览器
    -> Logix 后端
    -> 船司连接器
    -> CMA CGM API
```

前端不得持有船司 API Key、Client Secret 或直接调用船司接口。这不仅是安全要求，CMA CGM 本身也明确不支持 CORS。

##### 2. Token Manager 必须成为平台公共能力

```yaml
authentication:
  type: OAUTH2_CLIENT_CREDENTIALS
  tokenEndpoint: configured
  clientIdSecretRef: vault://cma-cgm/client-id
  clientSecretRef: vault://cma-cgm/client-secret
  scopes: []
  tokenTtlObservedSeconds: 300
  refreshBeforeExpirySeconds: 60
```

并发请求不能各自获取 Token，需要单实例刷新锁或分布式锁，避免产生 Token 风暴。

##### 3. 分页策略必须插件化

CMA CGM 使用 HTTP Range，而很多 API 使用 `page/size` 或 cursor。因此分页不能硬编码为一种模式：

```text
NONE
OFFSET_LIMIT
PAGE_SIZE
CURSOR
HTTP_RANGE
LINK_HEADER
```

CMA CGM 的配置示例：

```yaml
pagination:
  type: HTTP_RANGE
  requestHeader: Range
  responseHeader: content-range
  defaultPageSize: 50
  partialStatusCode: 206
```

##### 4. 限流必须服从服务端提示

```yaml
rateLimit:
  responseStatus: 429
  retryAfterHeader: retry-after
  strategy: SERVER_HINT_THEN_EXPONENTIAL_BACKOFF
  localThrottleEnabled: true
```

`retry-after` 是服务端事实，优先级应高于平台自行计算的退避时间。

##### 5. 查询缓存要按业务新鲜度设计

CMA CGM 不鼓励批量反复拉取，因此不同数据不能使用相同轮询频率：

| 数据               | 建议策略                       |
| ------------------ | ------------------------------ |
| 已发生的实际事件   | 长期缓存，原则上不重复全量拉取 |
| ETA/ETD            | 接近节点时提高刷新频率         |
| 船期               | 按航次和版本缓存               |
| 已完结货柜         | 停止高频轮询，只做低频校验     |
| 异常货柜           | 临时提升查询优先级             |
| Webhook 已覆盖事件 | 降低轮询，仅作补偿检查         |

#### 接入状态应进一步细分

CMA CGM 证明“已配置凭据”仍不等于“可以上线”：

```text
TRIAL_ACTIVE
SUBSCRIPTION_REQUESTED
CONTRACT_PENDING
PRIVATE_API_CONFIGURING
UAT_REQUIRED
UAT_PASSED
PRODUCTION_APPROVED
CREDENTIAL_ROTATION_REQUIRED
RATE_LIMITED
SUSPENDED
```

同时需要记录：

- Public/Private 分类
- 合同及商业套餐
- API Scope
- 试用到期时间
- 调用额度
- UAT 状态
- Token 获取状态
- 密钥轮换时间
- 最近一次 `401/403/429`
- 本地缓存命中率

#### 累计验证结果

目前四家船司已经覆盖了接口平台的主要差异：

| 船司        | 已验证的核心特征                                                       |
| ----------- | ---------------------------------------------------------------------- |
| MSC         | DCSA Track & Trace V2                                                  |
| Maersk      | 开发者应用与 API 产品订阅                                              |
| Hapag-Lloyd | 门户控制平面与数据平面隔离                                             |
| ONE         | DCSA V3.2、多能力版本、Push 模型与非 DCSA 产品并存                     |
| CMA CGM     | Public API Key、Private OAuth2、Scope、UAT、Range 分页、限流和事件应用 |

这进一步确认：大多数船司接入无需专属业务代码，但平台必须内置成熟的通用能力，包括认证策略、Token 管理、分页策略、限流退避、缓存、事件接收、契约版本管理和准入状态管理。船司专属代码只应处理无法配置表达的协议差异。

> [https://www.shipmentlink.com/\_ec/APIPORTAL\_Home](https://www.shipmentlink.com/_ec/APIPORTAL_Home)

这次可以明确修正此前的保守判断：**Evergreen 不只是 ShipmentLink 网页查询，已经提供正式 API Developer Portal，并公开 Swagger 契约。**

[Evergreen ShipmentLink API Portal](https://www.shipmentlink.com/_ec/APIPORTAL_Home)

#### 已核实能力

Evergreen 官方列出的 API 包括：

- Track & Trace
- Booking
- Shipping Instruction
- Transport Document
- eBL Issuance
- eBL Surrender
- Arrival Notice
- Commercial Schedules

其中 eBL 明确表示遵循 DCSA 参与组织制定的通用标准。

#### Track & Trace 契约

[Track & Trace Specification](https://www.shipmentlink.com/_ec/APIPORTAL_SpecTrackAndTrace) 显示：

- 版本：`2.2`
- 最后更新时间：`2023-11-15`
- 契约格式：Swagger/OpenAPI 2.0
- 支持 Pull 和 Push 两种模式
- 支持 Shipment、Transport、Equipment 三类事件

Pull 查询主键包括：

- Booking No.
- Equipment/Container No.
- B/L No.

事件范围包括：

| 事件类型  | 示例                                                 |
| --------- | ---------------------------------------------------- |
| Equipment | Gate-In、Gate-Out、Load、Discharge                   |
| Transport | 船舶、驳船、卡车、铁路的计划及实际事件               |
| Shipment  | Booking、SI、Transport Document、Arrival Notice 状态 |

#### Push 订阅机制

Swagger 中已经明确出现：

```text
/tnt/v2/event-subscriptions
/tnt/v2/event-subscriptions/{subscriptionID}
/tnt/v2/events
```

订阅支持：

- 查询现有订阅
- 根据 `subscriptionID` 查询
- 修改订阅
- 停止订阅
- 配置 `callbackUrl`
- 通过筛选条件订阅指定事件
- 使用共享 `secret` 计算 `Notification-Signature`

可订阅条件包括：

- `carrierBookingReference`
- `transportDocumentReference`
- `equipmentReference`
- `eventType`
- 设备/运输/货运事件代码
- `carrierServiceCode`
- `exportVoyageNumber`
- `vesselIMONumber`
- `UNLocationCode`
- `transportCallID`

这证明 Webhook 不能只是连接器的一个布尔属性，必须建立正式的订阅实体：

```text
external_event_subscription
- provider_channel_id
- external_subscription_id
- callback_endpoint_id
- filter_definition
- signing_secret_ref
- contract_version
- status
- activated_at
- last_delivery_at
- last_verified_at
```

#### 签名与接收处理

Webhook 入口至少要完成：

```text
接收原始请求
-> 根据订阅找到密钥
-> 验证 Notification-Signature
-> 保存不可变原始报文
-> 幂等去重
-> 快速返回接收结果
-> 异步标准化
-> 更新生命周期观察事实
```

签名失败不能进入业务事件表，但必须形成安全审计记录。回调 URL 中也不能放敏感凭据；Swagger 示例允许查询参数，但只能放不可猜测的订阅标识。

#### Pull 与 Push 不能二选一

推荐采用混合模式：

```text
Push：实时接收新增事件
Pull：初始化历史、断流补偿、定期对账
```

系统需要维护：

- 最近成功推送时间
- 最近成功拉取水位
- 事件创建时间游标
- Push/Pull 重复事件识别
- 订阅失效检测
- 漏事件补偿任务

#### 对配置平台的新验证

Evergreen 契约还暴露了一个非 DCSA 扩展字段：

```text
carrierContract
```

官方注明这是 Evergreen 自定义属性、并非 DCSA 定义。这证明即使标称 DCSA，也必须支持：

```text
标准核心字段
+ 提供方扩展字段
+ 扩展字段映射
+ 未识别扩展原样留存
```

另外，Evergreen 使用 Swagger 2.0，而其他门户可能提供 OpenAPI 3.x。因此契约导入器至少应支持：

```text
Swagger 2.0
OpenAPI 3.0
OpenAPI 3.1
```

不能把某种 OpenAPI 文档格式与业务标准版本混为一谈。

#### 商务接入流程

Evergreen 官方给出四步：

1. 向 Evergreen 销售代表提交订阅申请并确认范围。
2. 填写 API Requirement Form，用于认证和网关配置。
3. Evergreen 创建测试环境并通知客户测试。
4. 测试环境验证通过后上线。

这再次确认正式状态应是：

```text
REQUESTED
SCOPE_CONFIRMED
AUTH_FORM_SUBMITTED
SANDBOX_READY
TESTING
TEST_PASSED
PRODUCTION_READY
```

Evergreen 案例是目前最完整的验证样本：它同时证明了 DCSA 2.2、船司扩展、Pull、Push、订阅管理、回调签名、游标分页、测试环境以及商务准入均需纳入统一平台设计。

> [https://cop.lines.coscoshipping.com/copPortal/#/](https://cop.lines.coscoshipping.com/copPortal/#/)  [https://github.com/cop-cos/COP](https://github.com/cop-cos/COP)

COSCO 这组资料很有价值，因为它展示了一个真正需要“受控适配能力”的船司接口，而不仅是普通 API Key/OAuth2。

- [COSCO COP 门户](https://cop.lines.coscoshipping.com/copPortal/#/)
- [COP GitHub 仓库](https://github.com/cop-cos/COP)

仓库描述为 `Cosco shipping lines Open api Platform`，采用 Apache-2.0，并包含 Java/PHP 示例、接口文档和合作协议。但 README 仍包含 “trial operation”“TEST TBD”等历史文字，因此生产准入和最新端点必须以 COP 门户及正式合同为准，不能只依据 GitHub README。

#### 已核实的技术形态

COSCO COP 支持：

- HTTP(S) 同步调用
- HTTP(S) 异步调用
- MQ 异步交互，用于深度集成
- 每个应用独立分配 `apiKey + secretKey`
- 按应用和业务需求授予接口权限

公开文档中的环境地址：

```text
Production: https://api.lines.coscoshipping.com/service
Test:       https://api-pp.lines.coscoshipping.com/service
```

生产使用前仍需核验这些地址是否保持有效。

#### 自定义 HMAC 认证

COSCO 不是普通 API Key，而是自定义 HMAC 签名。公开要求包括：

```text
X-Coscon-Date
X-Coscon-Content-Md5
X-Coscon-Digest
X-Coscon-Authorization
X-Coscon-Hmac
```

规则包括：

- `X-Coscon-Date` 使用 GMT 格式，误差小于2分钟。
- `X-Coscon-Content-Md5` 是随机 UUID 的 MD5 Hex。
- POST/PUT 必须计算请求体 SHA-256，再进行 Base64，形成 `X-Coscon-Digest`。
- 使用 Secret Key 对规范化请求字符串执行 HMAC-SHA1。
- 签名结果 Base64 后写入 `X-Coscon-Authorization`。
- `X-Coscon-Hmac` 与随机值关联。

这意味着服务器时间必须通过 NTP 保持同步，否则接口会间歇性认证失败。

#### 是否需要专属代码

不需要写一个完整的 `CoscoConnector`，但需要在公共 HTTP 执行器中提供受控签名器：

```yaml
authentication:
  type: CANONICAL_REQUEST_HMAC
  algorithm: HMAC_SHA1
  apiKeySecretRef: vault://cosco/api-key
  secretKeySecretRef: vault://cosco/secret-key

  date:
    header: X-Coscon-Date
    format: RFC_1123_GMT
    maxClockSkewSeconds: 120

  nonce:
    source: UUID_V4
    transform: MD5_HEX
    headers:
      - X-Coscon-Content-Md5
      - X-Coscon-Hmac

  bodyDigest:
    requiredMethods: [POST, PUT]
    algorithm: SHA256
    encoding: BASE64
    prefix: "SHA-256="
    header: X-Coscon-Digest

  signature:
    canonicalTemplateId: COSCON_V1
    outputEncoding: BASE64
    authorizationHeader: X-Coscon-Authorization
```

这里的 `COSCON_V1` 应是经过测试的内置签名模板，不是数据库里的任意 JavaScript/Python。COSCO 证明了“少量适配代码可以高度参数化”，但不能全部变成可执行文本。

#### 接口能力

GitHub README 公开列出的能力包括：

- 货物跟踪
- 船期查询
- 订舱确认书下载
- 签收单链接查询
- 运单下载
- 订单信息查询
- 订单变更查询
- 车队提箱校验码
- 拖车动态接收

其中后两项对未来“提柜、送仓、卸柜、还箱”协同很重要。说明车队交互不应仅设计成 Logix 自有手机门户，还要预留船司车队接口：

```text
Logix 调度任务
-> 车队移动端执行
-> 提箱校验码/拖车事件
-> COSCO COP
-> 回执或状态
-> Logix 运输执行事实
```

#### 频控与约束

公开文档记载：

- HTTP 请求体不超过 1 MB。
- 部分公共接口账号级每天最多1000次。
- 每月最多30000次。
- 入驻审核反馈目标为15个工作日。
- 凭据泄露后应申请重置。

因此平台要支持日/月双周期配额，而不只是每秒限流：

```text
SECOND
MINUTE
DAY
MONTH
CONTRACT_PERIOD
```

并为每个连接器提供调用预算，避免某个低优先级轮询任务耗尽当天额度。

#### MQ 需要独立通道

COSCO 明确支持 MQ 异步模式，因此协议模型应至少包含：

```text
REST_PULL
REST_COMMAND
WEBHOOK_PUSH
MESSAGE_QUEUE
SFTP_FILE
EDI_FILE
```

MQ 需要另外配置 Broker、Topic/Queue、消费组、确认机制、死信队列和重放策略，不能伪装成 REST Webhook。

#### 证据带来的最终判断

COSCO 是对“配置优先”方案的一次压力测试：

- URL、请求、字段、限流、签名参数可以配置；
- HMAC、摘要、规范化请求和 MQ 消费必须由受控执行器实现；
- 公开 Java 示例可作为契约测试参照，但不建议直接依赖其 SDK；
- GitHub 资料可作为技术证据，生产权威仍是正式门户、审批结果及双方确认的接口文档；
- 该仓库存在历史状态文字，因此每项配置必须记录 `documentVersion`、`verifiedAt` 和 `productionConfirmedAt`。

至此，通用平台至少需要 REST/OAuth、REST/API Key、可配置 HMAC、Webhook/DCSA Subscription、HTTP Range/Cursor 分页、MQ 和 EDI/SFTP 七类基础能力，已经能够覆盖目前采样到的头部船司主要接入差异。

> [https://reference.dcsa.org/content](https://reference.dcsa.org/content)

这个 DCSA Reference 站点解决了此前规划中的两个核心问题：

1. 运输生命周期应该参考什么行业语义。
2. 标准代码、参与方身份和版本应该如何采信。

[DCSA Reference Documentation](https://reference.dcsa.org/content)

#### 已核实的信息

当前生产站点提供：

- Standard Releases
- Guidelines
- Industry Blueprint
- DCSA Code Lists
- Party Code List Providers
- eBL Solution Providers

当前 Industry Blueprint 版本为：

```text
2026.Q1
```

并分别描述：

- Shipment Journey
- Equipment Journey
- Vessel Journey

同时提供不可变历史版本 Archive。

网站还明确区分：

```text
reference.dcsa.org              正式参考资料
*.labs.dcsa.org                 非生产实验环境
staging.reference.dcsa.org      非正式环境
snapshots-staging...            非正式环境
```

系统采信规则应明确禁止自动把 labs/staging 内容提升为生产标准。

#### DCSA 标准不能直接作为业务状态机

Industry Blueprint 可以用来校验生命周期覆盖是否完整，但不能直接成为 Logix 的唯一状态机：

```text
DCSA Shipment Journey
DCSA Equipment Journey
DCSA Vessel Journey
          ↓
Logix 标准运输事件
          ↓
清关、提柜、送仓、卸柜、还箱等业务状态
```

例如 `Equipment Gate-Out` 是运输事实，但它是否表示“提柜完成”，还取决于场站类型、箱状态、关联运输任务以及业务规则。

因此应保留：

- DCSA 原始事件类型
- Logix 标准事件类型
- Logix 业务节点状态
- 二者映射版本

#### 代码表的版本机制

DCSA 官方说明其维护的代码表采用语义化版本：

- Patch/Minor：同一主版本内向后兼容。
- Major：可能删除已弃用值，供新的标准主版本使用。
- 每次变化应有 Change Log。

这要求代码值不能只有一张覆盖更新的字典表。建议采用：

```text
reference_dataset
- dataset_code
- owner
- authority_level
- source_url

reference_release
- dataset_id
- semantic_version
- published_at
- effective_from
- artifact_hash
- source_environment
- immutable

reference_value
- release_id
- code
- name
- description
- status
- deprecated_at
- replaced_by_code
```

历史业务数据必须能解释“当时采用的是哪一版代码”，不能因为代码表升级而改变历史事件含义。

#### 参与方身份必须是组合键

DCSA 明确规定业务参与方不能只保存一个代码，至少需要：

```json
{
  "partyCode": "MAEU",
  "codeListName": "SCAC",
  "codeListProvider": "NMFTA"
}
```

也支持：

```json
{
  "partyCode": "98450064A51E0A3DDE93",
  "codeListName": "LEI",
  "codeListProvider": "GLEIF"
}
```

所以不能只设计：

```text
carrier_code = "MAEU"
```

应设计为：

```text
party_identifier
- party_id
- code
- code_list_name
- code_list_provider
- valid_from
- valid_to
- verification_status
```

这样才能区分 SCAC、LEI、DUNS、DID 或企业内部编码。

#### “标准发布者”和“代码权威源”要分开

DCSA 的 Party Code List Providers 页面列出了被认可的代码维护方，包括：

- DCSA
- SMDG
- NMFTA
- W3C
- GLEIF
- FMC
- Dun & Bradstreet
- GSBN 等

但这不表示 DCSA 取代这些机构成为原始代码权威。例如：

| 数据          | 优先权威源                          |
| ------------- | ----------------------------------- |
| SCAC          | NMFTA                               |
| LEI           | GLEIF                               |
| UN/LOCODE     | UNECE                               |
| 船舶 IMO 编号 | IMO/认可船舶登记数据源              |
| SMDG 码       | SMDG                                |
| DCSA 自有枚举 | DCSA Information Model / Code Lists |

DCSA 在这里主要定义“如何声明代码及其提供方”，实际代码有效性仍应由相应注册机构验证。

#### 不建议抓取网页同步代码表

DCSA 页面说明，代码表由 DCSA Information Model/Code Lists 仓库维护，然后发布到参考站点。机器同步应优先：

```text
GitHub 发布物或机器可读文件
-> 校验版本和哈希
-> 预检差异
-> 人工审批
-> 发布为内部参考数据版本
```

不应通过解析 HTML 页面正文维护主数据。

#### 标准采信记录

每个映射或合规规则应能引用具体依据：

```text
standard_citation
- authority: DCSA
- document_family: INDUSTRY_BLUEPRINT
- edition: 2026.Q1
- section_anchor
- source_url
- retrieved_at
- content_hash
- license: Apache-2.0
- environment: PRODUCTION
- status: ACTIVE
```

这与之前的合规评审模块可以共用“权威来源、版本、引用位置、内容哈希、生效区间、采信状态”框架。

需要注意的是，当前 Standard Releases 索引只展示 Arrival Notice、Commercial Schedules、Operational Vessel Schedules、Port Call 和 VGM，没有在该索引中展示 Track & Trace。不能据此认定 Track & Trace 已废止，因为 MSC、ONE、Evergreen 的正式门户仍在提供不同版本；它更说明**标准索引、船司实现版本和实际生产契约必须分别记录，不能互相替代**。

> 对上船司网址返回内容总结

截至 2026-09-23，对以上船司官网、开发者门户、公开契约及 DCSA 参考站点的返回内容，可归纳如下。

#### 证据等级

| 等级 | 含义                                            |
| ---- | ----------------------------------------------- |
| A    | 已直接读取官网正文、Swagger、公开契约或仓库文件 |
| B    | 已确认官方产品入口，但详细契约未成功读取        |
| C    | 入口存在，但当前访问被安全验证或网络限制阻断    |

#### 船司汇总

| 船司        | 证据 | 已确认的接口特征                                                                      | 主要结论                                                            |
| ----------- | ---: | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| MSC         |    B | 官方产品地址明确为 `DCSA Track & Trace API V2`                                        | 支持 DCSA V2 的方向成立；认证、查询条件、订阅能力仍待读取契约       |
| Maersk      |    C | 官方 Getting Started API 入口存在                                                     | 需进一步核实应用创建、产品订阅、Consumer Key/OAuth 和客户数据授权   |
| Hapag-Lloyd |    C | 官方 API Portal 存在，但返回 Managed Security Challenge                               | 门户只能人工办理接入，不能抓取门户作为生产数据来源                  |
| ONE         |    A | Track & Trace V3.2；三类船期 V1.0.9；冷藏箱 Push；Contract Rate                       | 同一船司不同产品可能采用不同标准；内部模型不能绑定某版 DCSA         |
| CMA CGM     |    A | Public API Key；Private OAuth2 Client Credentials；Scope；UAT；事件应用               | 需要完整的认证、Token、分页、限流、试用、合同及 UAT 管理            |
| Evergreen   |    A | DCSA T&T 2.2；Pull + Push；订阅管理；回调签名；Booking、eBL、Arrival Notice、Schedule | 是目前最完整的 DCSA Pull/Push 样本；此前“仅网页查询”的判断应修正    |
| COSCO       |    A | REST、异步 HTTP、MQ；自定义 HMAC；货物跟踪、船期及车队接口                            | 通用 HTTP 执行器必须支持受控签名插件和 MQ；公开文档部分内容可能陈旧 |

#### ONE 返回内容

ONE 官方目录公开了：

| 产品                    |   版本 |                       DCSA |
| ----------------------- | -----: | -------------------------: |
| Track & Trace           |   V3.2 |                         是 |
| Point-to-Point Schedule | V1.0.9 |                         是 |
| Vessel Schedule         | V1.0.9 |                         是 |
| Port Schedule           | V1.0.9 |                         是 |
| Reefer Monitoring       |   V2.5 | 否，Push 模式，Coming Soon |
| Contract Rate           |   V1.3 |                         否 |

关键证明：

- DCSA 合规属性属于“产品 + 版本”，不属于整个船司。
- Track & Trace、船期、价格和冷藏监控应是不同能力。
- 标准接口和船司自有接口会长期并存。
- ONE V3.2 与其他船司的 DCSA V2/2.2 已存在明显版本差异。

#### CMA CGM 返回内容

官方门户公开信息确认：

- Public API 使用 API Key。
- Private API 使用 OAuth2 Client Credentials 和 Bearer JWT。
- Token 有效期为5分钟。
- 私有接口按 Scope 授权。
- 订舱等事务接口上线前需要 UAT。
- 新用户可获得30天公共 API 试用，但额度受限。
- 默认返回50条。
- 分页采用 `Range`、`content-range` 和 HTTP `206`。
- 限流返回 `429` 和 `retry-after`。
- 不支持 CORS，禁止浏览器前端直接调用。
- 官方建议事务式调用和本地缓存，不鼓励周期性全量抓取。
- 门户分别管理 API Applications 和 Event Applications。

关键证明：认证、授权、商务订阅、UAT、分页、限流和缓存必须是平台公共能力。

#### Evergreen 返回内容

官方门户和 Swagger 直接确认：

- Track & Trace 版本为 DCSA 2.2。
- 支持 Pull 和 Push。
- Pull 可按 Booking No.、Equipment No.、B/L No.查询。
- 包含 Shipment、Transport、Equipment 三类事件。
- 支持船舶、驳船、卡车、铁路运输事件。
- 提供订阅查询、修改、停止等端点。
- 订阅包含 `callbackUrl` 和共享 `secret`。
- 推送使用 `Notification-Signature`。
- 支持游标分页。
- 存在非 DCSA 扩展字段，例如 `carrierContract`。
- 契约采用 Swagger 2.0。

其他产品包括：

- Booking
- Shipping Instruction
- Transport Document
- eBL Issuance/Surrender
- Arrival Notice
- Commercial Schedules

商务接入流程为：销售申请、填写需求/认证表、测试环境、验证后上线。

#### COSCO 返回内容

COP 公开资料确认：

- 生产地址公开为 `https://api.lines.coscoshipping.com/service`。
- 支持 HTTPS 同步/异步和 MQ 异步。
- 每个应用分配 `apiKey + secretKey`。
- 使用自定义 HMAC-SHA1 签名。
- 请求包含 `X-Coscon-Date`、摘要、随机值和授权头。
- 时间误差要求小于2分钟。
- POST/PUT 请求体需要 SHA-256 摘要。
- 请求体不超过1 MB。
- 部分公共服务限制每天1000次、每月30000次。
- 公开货物跟踪、船期、单证下载、订单及车队接口。
- 车队接口包括提箱校验码和拖车动态接收。

GitHub 仓库采用 Apache-2.0，但 README 仍有试运行、测试环境 TBD 等历史文字，因此只能作为技术参考；生产参数必须重新确认。

#### DCSA 返回内容

DCSA Reference 站点确认：

- 当前 Industry Blueprint 为 `2026.Q1`。
- 分为 Shipment、Equipment、Vessel Journey。
- 历史版本以不可变版本保留。
- DCSA 代码表采用语义化版本。
- Party Identity 应由 `partyCode + codeListName + codeListProvider` 共同表达。
- DCSA 指明标准代码的权威维护组织，但不替代 NMFTA、GLEIF、UNECE、SMDG 等原始注册机构。
- 正式域与 labs/staging 非生产域明确区分。
- 内容采用 Apache-2.0。
