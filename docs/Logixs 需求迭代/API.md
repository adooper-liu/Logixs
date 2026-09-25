# API

# 需要建立相应的接口能力：

海运节点、日期事实，通过飞驼、云当等第三方，也可以通过各国港官网、各船司官网获取

需要建立“海运与港口可视化接入平台”，统一接入飞驼、云当、船公司、港口和码头数据。核心原则是：

> 外部供应商提供观测与证据，不直接拥有Logix的生命周期状态。

不能让飞驼状态、云当状态或某船司网页文本直接写入 `Container.currentStatus`。

## 总体架构

```Plain Text
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

## 一、统一接入接口

每个供应商实现同一组Port：

```Plain Text
interface OceanVisibilityProvider {
  providerCode: string;

  queryTracking(
    request: TrackingQuery,
  ): Promise<ProviderTrackingResponse>;

  normalize(
    response: ProviderTrackingResponse,
  ): Promise<NormalizedObservation[]>;

  verifyWebhook?(
    request: WebhookRequest,
  ): Promise<WebhookVerification>;

  acknowledgeWebhook?(
    messageId: string,
  ): Promise<void>;
}
```

查询条件支持：

```Plain Text
柜号
MBL/HBL
订舱号
船名航次
SCAC
起运港/目的港
```

不同供应商的能力不同，应登记能力矩阵：

```Plain Text
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

## 二、来源登记

建立 `ProviderConnection`：

```Plain Text
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

## 三、标准海运观测模型

外部数据先进入统一观测层：

```Plain Text
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

```Plain Text
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

## 四、标准事件目录

海运和港口事件建议覆盖：

```Plain Text
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

## 五、日期事实

统一日期事实至少保存：

```Plain Text
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

```Plain Text
planned
estimated
actual
deadline
```

供应商推算的ETA属于 `estimated`，不能成为 `actual`。网页抓取时间也不能冒充事件发生时间。

## 六、对象识别

外部消息经常只有柜号或提单号，需要对象解析：

```Plain Text
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

## 七、来源权威策略

不同来源对不同事件的权威性不同，需要配置 `SourceAuthorityPolicy`：

策略需要包含：

```Plain Text
允许的来源
优先级
是否要求二次佐证
时间容差
地点要求
冲突动作
自动采信或人工复核
```

供应商中立的数据模型不能等同于“所有来源可信度相同”。

## 八、多来源冲突

例如：

```Plain Text
飞驼 ETA：10月12日
云当 ETA：10月13日
船公司官网：10月14日
港口预计靠泊：10月14日 08:00
```

系统不能使用“最后写入覆盖”。应保存全部观测，并根据权威策略生成当前有效事实：

```Plain Text
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

## 九、Webhook与轮询

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

## 十、官网数据接入

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

```Plain Text
页面URL
查询条件
获取时间
页面版本
原始响应或截图
解析版本
提取位置
```

页面结构变化时应停止自动采信并报警，不能静默产生空值或错误事件。

## 十一、船舶与航次身份

仅凭船名不稳定，需要维护：

```Plain Text
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

## 十二、工作台展示

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

## 十三、异常与监控

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

## 十四、实施顺序

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

# 2

可以采用“配置优先、插件兜底”的集成平台，但需要明确一个现实边界：

> 标准HTTP/API、Webhook、文件和常见认证差异可以配置；特殊加密、验证码、非标准签名、复杂会话和网页自动化仍可能需要少量适配代码。

完全承诺“任何来源都不写代码”会迫使配置系统变成不受控的脚本平台，安全性和维护性更差。

推荐架构：

```Plain Text
连接配置
-> 协议执行器
-> 原始消息信封
-> 提取与转换
-> 标准海运观测
-> 业务对象解析
-> 来源权威裁决
-> 日期事实/规范事件
```

# 一、分层设计

## 通用协议执行器

系统内置少量稳定执行器，不按供应商开发：

```Plain Text
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

## 来源连接配置

```Plain Text
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

# 二、能力矩阵

不同来源的差异先通过能力声明表达：

```Plain Text
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

```Plain Text
supported
requiredInputs
responseProfile
freshnessExpectation
rateLimit
authorityScope
```

调度程序根据能力选择来源，不通过代码判断 `if provider === "xxx"`。

# 三、统一原始消息信封

无论API、Webhook还是文件，都先转换成统一信封：

```Plain Text
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

# 四、配置化提取

支持受控提取器：

- JSONPath或JMESPath；

- XPath；

- CSV/Excel列映射；

- 固定宽度文本；

- 正则表达式，仅用于局部值提取；

- 日期解析器；

- 数值和单位解析器。

示例配置：

```Plain Text
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

# 五、标准化映射

提取后先形成来源中间模型，再映射为标准海运观测：

```Plain Text
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

# 六、行业标准对齐

海运标准模型建议参考和兼容：

- DCSA Track \& Trace事件语义；

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

# 七、个性化差异的扩展点

差异应按层处理。

## 配置即可处理

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

## 受控策略处理

- 某来源只对特定船司权威；

- 某港口来源只负责码头事件；

- 某来源ETA优先级更高；

- 某来源实际事件需要第二来源佐证；

- 时间差超过容差进入复核；

- 特定状态不允许自动推进。

## 插件代码处理

- 非标准加密；

- 专有签名算法；

- 多步登录和Token交换；

- CAPTCHA；

- 网页交互；

- 加密压缩文件；

- 私有二进制协议；

- 需要多次关联请求才能形成一条记录。

插件只能扩展传输、认证或解析能力，不能直接写Shipment或改变状态机。

# 八、配置模型

建议核心对象：

```Plain Text
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

```Plain Text
draft
-> testing
-> approved
-> active
-> deprecated
-> retired
```

已处理消息必须记录使用的配置版本。修改映射不能改变历史解释。

# 九、来源权威配置

事件映射和来源权威不能混成一张表。

事件映射回答：

> 这个外部值是什么意思？

来源权威回答：

> 即使知道它是什么意思，是否允许采用它？

示例：

```Plain Text
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

# 十、对象解析配置

不同来源使用不同身份，应允许配置解析策略：

```Plain Text
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

# 十一、时间语义配置

日期字段映射必须声明：

```Plain Text
事件
节点
时间种类
地点角色
来源时区
是否权威
是否允许推进状态
```

示例：

```Plain Text
timeMapping:
  sourceField: actualDepartureTime
  eventCode: departed
  nodeCode: origin_departure
  timeKind: actual
  timezoneSource: payload
  missingTimezoneAction: block
```

不能只配置“字段A映射到ATD”，却不说明时区、地点和来源权威。

# 十二、配置测试与发布

每份连接配置和映射配置必须有样本测试：

```Plain Text
输入原始载荷
预期提取记录
预期标准事件
预期对象匹配
预期采信结果
预期错误
```

发布流程：

```Plain Text
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

# 十三、配置管理工作台

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

# 十四、安全约束

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

# 十五、运行时可靠性

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

```Plain Text
没有事件发生
来源尚未更新
来源服务异常
对象未匹配
映射未知
来源冲突
```

不能统一显示为“暂无数据”。

# 十六、推荐实施顺序

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

# v3

可以把大部分“少量适配逻辑”包装成可配置文本，但不建议允许管理员直接填写任意 JavaScript、Python 或脚本代码。

正确方向是：

> 使用受控声明式DSL覆盖常见差异；真正特殊的逻辑使用签名、版本化、沙箱化插件。

## 推荐分层

绝大多数API差异应落在L1–L3。

# 一、可以安全配置成文本的能力

## 请求模板

使用Mustache/Liquid一类模板：

```Plain Text
request:
  method: GET
  path: "/tracking/{{containerNumber}}"
  query:
    billNo: "{{billNumber}}"
  headers:
    Accept: "application/json"
```

只允许引用明确输入变量，不允许执行系统命令或读取环境变量。

## 字段提取

使用：

- JSONPath；

- JMESPath；

- XPath；

- CSV列名；

- Excel表头；

- 正则捕获组。

```Plain Text
extract:
  records: "$.data.events[*]"
  fields:
    eventId: "$.id"
    status: "$.status.code"
    eventTime: "$.eventTime"
    locationName: "$.location.name"
```

## 数据转换

采用受控转换函数链：

```Plain Text
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

## 值映射

```Plain Text
valueMappings:
  eventCode:
    "Vessel Departed": departed
    "Loaded on Vessel": loaded
    "Discharged": discharged
```

支持精确、大小写归一、受控正则和默认行为：

```Plain Text
unknownValueAction: review
```

禁止默认映射成某个正常业务状态。

## 条件表达式

可以使用CEL等安全表达式语言：

```Plain Text
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

## 对象构造

使用JSONata或声明式映射模板：

```Plain Text
output:
  externalEventId: "$.id"
  eventCode: "'departed'"
  containerNumber: "$uppercase($.containerNo)"
  rawValue: "$.eventTime"
  evidenceRefs: "[$.documentId]"
```

需要限制可用函数、输出大小和执行时间。

# 二、认证流程也可以部分配置

标准认证可以配置：

```Plain Text
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

```Plain Text
authentication:
  type: oauth2_client_credentials
  tokenUrl: "https://provider.example.com/oauth/token"
  clientIdRef: "secret://provider/client-id"
  clientSecretRef: "secret://provider/client-secret"
  scopes: ["tracking.read"]
```

常见HMAC也可以提供声明式签名模板：

```Plain Text
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

# 三、多步调用可以配置成流程

部分供应商需要：

```Plain Text
获取Token
-> 查询提单
-> 取得柜列表
-> 逐柜查询事件
```

可以设计有限状态的集成流程DSL：

```Plain Text
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

# 四、不应配置成普通文本的能力

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

# 五、特殊逻辑的安全方案

## 首选：WASM插件

特殊转换可以编译为WebAssembly：

```Plain Text
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

```Plain Text
customTransform:
  pluginCode: carrier-x-event-decoder
  pluginVersion: 1.2.0
  config:
    statusField: event_status
```

## 次选：进程隔离插件

需要供应商SDK时，在隔离Worker中运行：

- 独立进程或容器；

- 最小网络白名单；

- 独立凭据；

- 超时；

- 资源限额；

- 无数据库直写；

- 只返回标准原始信封或标准观测。

插件不能导入Shipment Repository，也不能直接推进状态。

# 六、不要采用“数据库里存JavaScript然后eval”

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

# 七、配置包

建议把一个来源的全部定义打包为版本化配置包：

```Plain Text
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

```Plain Text
providerCode: provider-x
packageVersion: 1.3.0
minimumRuntimeVersion: 1.2.0
supportedInterfaces:
  - container-tracking.v1
configurationSchemaVersion: "1.0"
contentHash: "sha256:..."
```

配置可以存数据库，也可以版本控制；正式发布版本应不可变并具有内容哈希。

# 八、配置文本的测试

每个配置包必须自带脱敏样本：

```Plain Text
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

# 九、建议采用的开源组件

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

```Plain Text
JSONPath：提取
CEL：条件
受控函数流水线：转换
Mustache：请求模板
JSON Schema：校验
WASM：特殊兜底
```

# 十、最终边界

可以实现为：

```Plain Text
约80%来源：
完全配置，无新代码

约15%来源：
新增受控转换函数或认证策略

约5%来源：
WASM或隔离插件
```

因此答案是：少量适配逻辑可以尽量包装成配置文本，但应使用受控DSL，而不是任意脚本。配置解决结构差异，策略解决权威差异，WASM或隔离插件解决真正特殊的技术差异。这样既保持扩展性，也不会把生产系统变成一个不可审计的在线代码执行平台。

# V4

可以，而且用头部船司的实际接入方式反向验证后，现有“配置优先、少量适配代码兜底”的方向是成立的。但需要补充一个关键认识：

**船司官网的公开货柜查询页面，不等于可用于生产系统的正式接口。**
正式接入通常需要客户账号、商务关系、应用审批、API Key/OAuth 凭据，部分能力仍通过 EDI、SFTP 或邮件文件交换提供。

本次环境访问船司官网发生超时，因此下面是基于各船司公开开发者入口及行业接口模式形成的验证结论；认证字段、具体版本和准入条件仍需在取得账号后做二次实测，不能把它们直接当成已经签约可用的接口。

**头部船司验证矩阵**

## 对现有规划的结论

现有架构无需推翻，但建议从“一个船司一个连接器”进一步调整为：

```Plain Text
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

## 配置可以覆盖的部分

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

## 仍可能需要少量代码的部分

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

```Plain Text
executorType: REST
authProfile: OAUTH2_CLIENT_CREDENTIALS
extractor: JSONPATH
transformPipeline: dcsa-track-trace-v2
specialHandler: maersk-signature-v1
```

`specialHandler` 是代码仓库中经过测试、版本化和发布的插件标识，不是任意可执行文本。

## 必须新增的配置模型

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

## 实际验证方法

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

# V5

这个链接比 MSC 的数字化解决方案介绍页更有证明力：

[MSC DCSA Track \& Trace API V2](https://developerportal.msc.com/api-details/#api=DPO-DCSATrackAndTrace-API-V2)

它至少能确认：

- MSC 已将 Track \& Trace 作为正式、版本化的 API 产品提供。

- API 明确采用 DCSA Track \& Trace 语义，而不是仅提供网页货柜查询。

- 我们采用“DCSA 标准事件模型 \+ 船司通道配置”的方向正确。

- MSC 应配置为正式 API 通道，官网查询页只作为人工核查入口。

- 接口配置必须绑定版本，不能简单配置成泛化的 `MSC_TRACKING`。

建议形成如下实例：

```Plain Text
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

```Plain Text
MSC API 报文
  -> DCSA V2 标准事件
  -> Logix 运输日期事实与业务里程碑
```

第一层处理 MSC 的认证、URL、分页和实现差异；第二层才处理业务含义。例如：

需要特别注意：DCSA 事件不能直接覆盖业务表里的日期。正确做法是追加观察事实：

```Plain Text
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

# V6

这个 Maerssk 页面验证的是“接入治理”，与 MSC 的“标准业务接口”形成互补：

- MSC 证明：船司业务事件可以按 DCSA 标准输出。

- Maersk Getting Started 证明：调用接口前还存在开发者注册、应用创建、API 产品订阅、凭据获取及生产授权流程。

因此，系统不能只配置 URL 和字段映射，还必须管理四个相互独立的层次：

```Plain Text
船司 Provider
  -> 开发者应用 Application
  -> API 产品订阅 Subscription
  -> 租户授权 Entitlement
  -> 运行凭据 Credential
```

建议 Maersk 通道按以下方式建模：

```Plain Text
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

例如，拿到 `Consumer-Key` 只能证明应用身份；它未必意味着能查询所有箱号，也不意味着返回 ETA 可以无条件覆盖港口或船司此前提供的实际时间。

## 通用认证配置需要扩展

建议认证类型至少支持：

```Plain Text
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

```Plain Text
{
  "authScheme": "API_KEY_HEADER",
  "parameters": {
    "headerName": "Consumer-Key",
    "secretRef": "vault://integrations/maersk/production/consumer-key"
  }
}
```

数据库只保存 `secretRef`，日志必须屏蔽对应请求头。

## 工作台还需要“接口接入状态”

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

```Plain Text
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

# V7

这个 Hapag\-Lloyd 链接补充验证了一个重要边界：

[Hapag\-Lloyd API Portal](https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html)

我实际访问时，官网返回了需要 JavaScript、Cookie 或验证码的 Managed Security Challenge，而不是 API 产品正文。这说明必须把两个平面分开：

```Plain Text
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

不能抓取开发者门户来获取生产数据，也不应尝试绕过验证码。Hapag\-Lloyd 门户应作为人工接入和证据来源，真正的自动化连接必须使用获批后的数据平面端点。

因此，连接器配置还要增加：

```Plain Text
providerCode: HAPAG_LLOYD

controlPlane:
  portalUrl: https://www.hapag-lloyd.com/en/services-information/data-solutions/api-portal.html
  onboardingMode: MANUAL
  automationAllowed: false

dataPlane:
  baseUrl: null                 # 获批后录入
  apiProductCode: null          # 按具体产品录入
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

- 一定支持 DCSA Track \& Trace；

- 一定支持 Webhook；

- 箱号、提单号、订舱号都可以查询；

- 所有客户都可直接自助开通。

这些结论要由具体产品页、OpenAPI 契约和测试凭据分别确认。

截至目前，三个案例已经验证出较清晰的分层：

这还带来一个产品要求：集成管理工作台不能只显示“接口启用/停用”，而要分别显示 `文档已确认、产品已申请、权限已批准、契约已导入、凭据已配置、连通已验证、生产已启用`。否则很容易把“找到官网入口”误认为“接口已经可用”。

# V8

ONE 页面成功读取到了结构化产品目录，提供了目前最明确的一组验证证据：

[ONE API and EDI Catalog](https://www.one-line.com/all-digital-solutions/one-developer-portal/api-and-edi-catalog)

截至 2026\-09\-23，页面公开的产品包括：

其中还有两个重要事实：

- Track \& Trace 被描述为使用标准化数据模型查询货运状态和位置。

- Reefer Monitoring 明确采用 Push 模式发送 `ReeferEvents`，但不是 DCSA 标准。

## 最重要的架构结论

MSC 是 DCSA Track \& Trace V2，而 ONE 已是 V3\.2。由此可以确认：

**内部领域模型不能直接等同于某一版 DCSA Schema。**

正确结构应是：

```Plain Text
MSC DCSA T&T V2 ──> DCSA V2 Adapter ──┐
                                      │
ONE DCSA T&T V3.2 -> DCSA V3 Adapter ─┼-> Logix 标准运输事件
                                      │
飞驼/云当自有格式 -> Mapping Adapter ──┘
```

否则一旦直接用 DCSA V2 字段建核心表，接入 ONE V3\.2 时就会被迫修改业务表和全部消费者。

建议把配置拆成：

```Plain Text
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

## “是否 DCSA”必须按产品记录

ONE 的同一家供应商中：

- Track \& Trace 是 DCSA；

- 船期接口是 DCSA；

- Reefer Monitoring 不是 DCSA；

- Contract Rate 也不是 DCSA。

因此不能设计成：

```Plain Text
provider.dcsa_compliant = true
```

应该设计成：

```Plain Text
provider_capability.standard_family
provider_capability.standard_version
provider_capability.conformance_status
```

即合规属性属于“供应商 \+ API 产品 \+ 版本”，不属于整个船司。

## 对推送能力的验证

ONE 的冷藏箱监控明确出现 Push 模型，这证明平台必须同时支持：

```Plain Text
PULL：定时查询 Track & Trace、Schedule
PUSH：Webhook 接收冷藏箱或运输事件
FILE：EDI/SFTP 批量交换
```

三者进入相同的原始消息入口：

```Plain Text
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

## 与当前业务的优先级

针对“已出运货柜全生命周期”，ONE 产品中建议：

1. `Track & Trace V3.2`：第一优先，提供运输事件事实。

2. `Vessel Schedule V1.0.9`：用于船舶航次和挂港计划。

3. `Port Schedule V1.0.9`：用于目的港拥堵、到离港计划辅助判断。

4. `Point-to-Point Schedule`：主要服务未来出运计划。

5. `Reefer Monitoring`：只有冷藏箱业务需要时启用。

6. `Contract Rate`：属于未来订舱、采购和成本预测范围。

页面元数据还给出了 OpenAPI 文件名，例如 `OceanNetworkExpress-DCSA_TnT-3.2-normalized-aligned.yaml`。我尝试按页面相对路径下载，但直接访问返回 404，说明下载地址可能由前端动态生成或需要门户会话。因此目前可以确认产品、版本和 DCSA 标识，但认证方案、具体查询参数及订阅端点仍需取得实际 OpenAPI 文件后确认。

ONE 的证据最终确认了三个核心设计原则：**按能力接入、按契约版本映射、内部模型独立于 DCSA 版本。**

# V9

CMA CGM 门户成功读取，公开前端资源包含了相当完整的接入规则。这个案例对我们的规划验证价值很高。

[CMA CGM API Portal](https://api-portal.cma-cgm.com/)

## 已核实的接入机制

CMA CGM 把接口明确分为两类：

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

## 对当前架构的直接修正

### 所有船司调用必须经过后端

```Plain Text
出运工作台浏览器
    -> Logix 后端
    -> 船司连接器
    -> CMA CGM API
```

前端不得持有船司 API Key、Client Secret 或直接调用船司接口。这不仅是安全要求，CMA CGM 本身也明确不支持 CORS。

### Token Manager 必须成为平台公共能力

```Plain Text
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

### 分页策略必须插件化

CMA CGM 使用 HTTP Range，而很多 API 使用 `page/size` 或 cursor。因此分页不能硬编码为一种模式：

```Plain Text
NONE
OFFSET_LIMIT
PAGE_SIZE
CURSOR
HTTP_RANGE
LINK_HEADER
```

CMA CGM 的配置示例：

```Plain Text
pagination:
  type: HTTP_RANGE
  requestHeader: Range
  responseHeader: content-range
  defaultPageSize: 50
  partialStatusCode: 206
```

### 限流必须服从服务端提示

```Plain Text
rateLimit:
  responseStatus: 429
  retryAfterHeader: retry-after
  strategy: SERVER_HINT_THEN_EXPONENTIAL_BACKOFF
  localThrottleEnabled: true
```

`retry-after` 是服务端事实，优先级应高于平台自行计算的退避时间。

### 查询缓存要按业务新鲜度设计

CMA CGM 不鼓励批量反复拉取，因此不同数据不能使用相同轮询频率：

## 接入状态应进一步细分

CMA CGM 证明“已配置凭据”仍不等于“可以上线”：

```Plain Text
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

## 累计验证结果

目前四家船司已经覆盖了接口平台的主要差异：

这进一步确认：大多数船司接入无需专属业务代码，但平台必须内置成熟的通用能力，包括认证策略、Token 管理、分页策略、限流退避、缓存、事件接收、契约版本管理和准入状态管理。船司专属代码只应处理无法配置表达的协议差异。

# V10

这次可以明确修正此前的保守判断：**Evergreen 不只是 ShipmentLink 网页查询，已经提供正式 API Developer Portal，并公开 Swagger 契约。**

[Evergreen ShipmentLink API Portal](https://www.shipmentlink.com/_ec/APIPORTAL_Home)

## 已核实能力

Evergreen 官方列出的 API 包括：

- Track \& Trace

- Booking

- Shipping Instruction

- Transport Document

- eBL Issuance

- eBL Surrender

- Arrival Notice

- Commercial Schedules

其中 eBL 明确表示遵循 DCSA 参与组织制定的通用标准。

## Track \& Trace 契约

[Track \& Trace Specification](https://www.shipmentlink.com/_ec/APIPORTAL_SpecTrackAndTrace) 显示：

- 版本：`2.2`

- 最后更新时间：`2023-11-15`

- 契约格式：Swagger/OpenAPI 2\.0

- 支持 Pull 和 Push 两种模式

- 支持 Shipment、Transport、Equipment 三类事件

Pull 查询主键包括：

- Booking No\.

- Equipment/Container No\.

- B/L No\.

事件范围包括：

## Push 订阅机制

Swagger 中已经明确出现：

```Plain Text
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

```Plain Text
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

## 签名与接收处理

Webhook 入口至少要完成：

```Plain Text
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

## Pull 与 Push 不能二选一

推荐采用混合模式：

```Plain Text
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

## 对配置平台的新验证

Evergreen 契约还暴露了一个非 DCSA 扩展字段：

```Plain Text
carrierContract
```

官方注明这是 Evergreen 自定义属性、并非 DCSA 定义。这证明即使标称 DCSA，也必须支持：

```Plain Text
标准核心字段
+ 提供方扩展字段
+ 扩展字段映射
+ 未识别扩展原样留存
```

另外，Evergreen 使用 Swagger 2\.0，而其他门户可能提供 OpenAPI 3\.x。因此契约导入器至少应支持：

```Plain Text
Swagger 2.0
OpenAPI 3.0
OpenAPI 3.1
```

不能把某种 OpenAPI 文档格式与业务标准版本混为一谈。

## 商务接入流程

Evergreen 官方给出四步：

1. 向 Evergreen 销售代表提交订阅申请并确认范围。

2. 填写 API Requirement Form，用于认证和网关配置。

3. Evergreen 创建测试环境并通知客户测试。

4. 测试环境验证通过后上线。

这再次确认正式状态应是：

```Plain Text
REQUESTED
SCOPE_CONFIRMED
AUTH_FORM_SUBMITTED
SANDBOX_READY
TESTING
TEST_PASSED
PRODUCTION_READY
```

Evergreen 案例是目前最完整的验证样本：它同时证明了 DCSA 2\.2、船司扩展、Pull、Push、订阅管理、回调签名、游标分页、测试环境以及商务准入均需纳入统一平台设计。

# V11

COSCO 这组资料很有价值，因为它展示了一个真正需要“受控适配能力”的船司接口，而不仅是普通 API Key/OAuth2。

- [COSCO COP 门户](https://cop.lines.coscoshipping.com/copPortal/#/)

- [COP GitHub 仓库](https://github.com/cop-cos/COP)

仓库描述为 `Cosco shipping lines Open api Platform`，采用 Apache\-2\.0，并包含 Java/PHP 示例、接口文档和合作协议。但 README 仍包含 “trial operation”“TEST TBD”等历史文字，因此生产准入和最新端点必须以 COP 门户及正式合同为准，不能只依据 GitHub README。

## 已核实的技术形态

COSCO COP 支持：

- HTTP\(S\) 同步调用

- HTTP\(S\) 异步调用

- MQ 异步交互，用于深度集成

- 每个应用独立分配 `apiKey + secretKey`

- 按应用和业务需求授予接口权限

公开文档中的环境地址：

```Plain Text
Production: https://api.lines.coscoshipping.com/service
Test:       https://api-pp.lines.coscoshipping.com/service
```

生产使用前仍需核验这些地址是否保持有效。

## 自定义 HMAC 认证

COSCO 不是普通 API Key，而是自定义 HMAC 签名。公开要求包括：

```Plain Text
X-Coscon-Date
X-Coscon-Content-Md5
X-Coscon-Digest
X-Coscon-Authorization
X-Coscon-Hmac
```

规则包括：

- `X-Coscon-Date` 使用 GMT 格式，误差小于2分钟。

- `X-Coscon-Content-Md5` 是随机 UUID 的 MD5 Hex。

- POST/PUT 必须计算请求体 SHA\-256，再进行 Base64，形成 `X-Coscon-Digest`。

- 使用 Secret Key 对规范化请求字符串执行 HMAC\-SHA1。

- 签名结果 Base64 后写入 `X-Coscon-Authorization`。

- `X-Coscon-Hmac` 与随机值关联。

这意味着服务器时间必须通过 NTP 保持同步，否则接口会间歇性认证失败。

## 是否需要专属代码

不需要写一个完整的 `CoscoConnector`，但需要在公共 HTTP 执行器中提供受控签名器：

```Plain Text
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

## 接口能力

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

```Plain Text
Logix 调度任务
-> 车队移动端执行
-> 提箱校验码/拖车事件
-> COSCO COP
-> 回执或状态
-> Logix 运输执行事实
```

## 频控与约束

公开文档记载：

- HTTP 请求体不超过 1 MB。

- 部分公共接口账号级每天最多1000次。

- 每月最多30000次。

- 入驻审核反馈目标为15个工作日。

- 凭据泄露后应申请重置。

因此平台要支持日/月双周期配额，而不只是每秒限流：

```Plain Text
SECOND
MINUTE
DAY
MONTH
CONTRACT_PERIOD
```

并为每个连接器提供调用预算，避免某个低优先级轮询任务耗尽当天额度。

## MQ 需要独立通道

COSCO 明确支持 MQ 异步模式，因此协议模型应至少包含：

```Plain Text
REST_PULL
REST_COMMAND
WEBHOOK_PUSH
MESSAGE_QUEUE
SFTP_FILE
EDI_FILE
```

MQ 需要另外配置 Broker、Topic/Queue、消费组、确认机制、死信队列和重放策略，不能伪装成 REST Webhook。

## 证据带来的最终判断

COSCO 是对“配置优先”方案的一次压力测试：

- URL、请求、字段、限流、签名参数可以配置；

- HMAC、摘要、规范化请求和 MQ 消费必须由受控执行器实现；

- 公开 Java 示例可作为契约测试参照，但不建议直接依赖其 SDK；

- GitHub 资料可作为技术证据，生产权威仍是正式门户、审批结果及双方确认的接口文档；

- 该仓库存在历史状态文字，因此每项配置必须记录 `documentVersion`、`verifiedAt` 和 `productionConfirmedAt`。

至此，通用平台至少需要 REST/OAuth、REST/API Key、可配置 HMAC、Webhook/DCSA Subscription、HTTP Range/Cursor 分页、MQ 和 EDI/SFTP 七类基础能力，已经能够覆盖目前采样到的头部船司主要接入差异。

# V12

这个 DCSA Reference 站点解决了此前规划中的两个核心问题：

1. 运输生命周期应该参考什么行业语义。

2. 标准代码、参与方身份和版本应该如何采信。

[DCSA Reference Documentation](https://reference.dcsa.org/content)

## 已核实的信息

当前生产站点提供：

- Standard Releases

- Guidelines

- Industry Blueprint

- DCSA Code Lists

- Party Code List Providers

- eBL Solution Providers

当前 Industry Blueprint 版本为：

```Plain Text
2026.Q1
```

并分别描述：

- Shipment Journey

- Equipment Journey

- Vessel Journey

同时提供不可变历史版本 Archive。

网站还明确区分：

```Plain Text
reference.dcsa.org              正式参考资料
*.labs.dcsa.org                 非生产实验环境
staging.reference.dcsa.org      非正式环境
snapshots-staging...            非正式环境
```

系统采信规则应明确禁止自动把 labs/staging 内容提升为生产标准。

## DCSA 标准不能直接作为业务状态机

Industry Blueprint 可以用来校验生命周期覆盖是否完整，但不能直接成为 Logix 的唯一状态机：

```Plain Text
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

## 代码表的版本机制

DCSA 官方说明其维护的代码表采用语义化版本：

- Patch/Minor：同一主版本内向后兼容。

- Major：可能删除已弃用值，供新的标准主版本使用。

- 每次变化应有 Change Log。

这要求代码值不能只有一张覆盖更新的字典表。建议采用：

```Plain Text
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

## 参与方身份必须是组合键

DCSA 明确规定业务参与方不能只保存一个代码，至少需要：

```Plain Text
{
  "partyCode": "MAEU",
  "codeListName": "SCAC",
  "codeListProvider": "NMFTA"
}
```

也支持：

```Plain Text
{
  "partyCode": "98450064A51E0A3DDE93",
  "codeListName": "LEI",
  "codeListProvider": "GLEIF"
}
```

所以不能只设计：

```Plain Text
carrier_code = "MAEU"
```

应设计为：

```Plain Text
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

## “标准发布者”和“代码权威源”要分开

DCSA 的 Party Code List Providers 页面列出了被认可的代码维护方，包括：

- DCSA

- SMDG

- NMFTA

- W3C

- GLEIF

- FMC

- Dun \& Bradstreet

- GSBN 等

但这不表示 DCSA 取代这些机构成为原始代码权威。例如：

DCSA 在这里主要定义“如何声明代码及其提供方”，实际代码有效性仍应由相应注册机构验证。

## 不建议抓取网页同步代码表

DCSA 页面说明，代码表由 DCSA Information Model/Code Lists 仓库维护，然后发布到参考站点。机器同步应优先：

```Plain Text
GitHub 发布物或机器可读文件
-> 校验版本和哈希
-> 预检差异
-> 人工审批
-> 发布为内部参考数据版本
```

不应通过解析 HTML 页面正文维护主数据。

## 标准采信记录

每个映射或合规规则应能引用具体依据：

```Plain Text
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

需要注意的是，当前 Standard Releases 索引只展示 Arrival Notice、Commercial Schedules、Operational Vessel Schedules、Port Call 和 VGM，没有在该索引中展示 Track \& Trace。不能据此认定 Track \& Trace 已废止，因为 MSC、ONE、Evergreen 的正式门户仍在提供不同版本；它更说明**标准索引、船司实现版本和实际生产契约必须分别记录，不能互相替代**。

# V13

截至 2026\-09\-23，对以上船司官网、开发者门户、公开契约及 DCSA 参考站点的返回内容，可归纳如下。

## 证据等级

## 船司汇总

## ONE 返回内容

ONE 官方目录公开了：

关键证明：

- DCSA 合规属性属于“产品 \+ 版本”，不属于整个船司。

- Track \& Trace、船期、价格和冷藏监控应是不同能力。

- 标准接口和船司自有接口会长期并存。

- ONE V3\.2 与其他船司的 DCSA V2/2\.2 已存在明显版本差异。

## CMA CGM 返回内容

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

## Evergreen 返回内容

官方门户和 Swagger 直接确认：

- Track \& Trace 版本为 DCSA 2\.2。

- 支持 Pull 和 Push。

- Pull 可按 Booking No\.、Equipment No\.、B/L No\.查询。

- 包含 Shipment、Transport、Equipment 三类事件。

- 支持船舶、驳船、卡车、铁路运输事件。

- 提供订阅查询、修改、停止等端点。

- 订阅包含 `callbackUrl` 和共享 `secret`。

- 推送使用 `Notification-Signature`。

- 支持游标分页。

- 存在非 DCSA 扩展字段，例如 `carrierContract`。

- 契约采用 Swagger 2\.0。

其他产品包括：

- Booking

- Shipping Instruction

- Transport Document

- eBL Issuance/Surrender

- Arrival Notice

- Commercial Schedules

商务接入流程为：销售申请、填写需求/认证表、测试环境、验证后上线。

## COSCO 返回内容

COP 公开资料确认：

- 生产地址公开为 `https://api.lines.coscoshipping.com/service`。

- 支持 HTTPS 同步/异步和 MQ 异步。

- 每个应用分配 `apiKey + secretKey`。

- 使用自定义 HMAC\-SHA1 签名。

- 请求包含 `X-Coscon-Date`、摘要、随机值和授权头。

- 时间误差要求小于2分钟。

- POST/PUT 请求体需要 SHA\-256 摘要。

- 请求体不超过1 MB。

- 部分公共服务限制每天1000次、每月30000次。

- 公开货物跟踪、船期、单证下载、订单及车队接口。

- 车队接口包括提箱校验码和拖车动态接收。

GitHub 仓库采用 Apache\-2\.0，但 README 仍有试运行、测试环境 TBD 等历史文字，因此只能作为技术参考；生产参数必须重新确认。

## DCSA 返回内容

DCSA Reference 站点确认：

- 当前 Industry Blueprint 为 `2026.Q1`。

- 分为 Shipment、Equipment、Vessel Journey。

- 历史版本以不可变版本保留。

- DCSA 代码表采用语义化版本。

- Party Identity 应由 `partyCode + codeListName + codeListProvider` 共同表达。

- DCSA 指明标准代码的权威维护组织，但不替代 NMFTA、GLEIF、UNECE、SMDG 等原始注册机构。

- 正式域与 labs/staging 非生产域明确区分。

- 内容采用 Apache\-2\.0。

## 综合验证结论

以上官网资料共同证明，合理的接入架构应是：

```Plain Text
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

- Swagger 2\.0、OpenAPI 3\.0/3\.1 契约导入

最终判断是：**配置优先方案可行，但不能追求“所有差异都是字段配置”。** 大约80%至90%的差异可由请求、认证、映射、分页、限流和采信配置解决；签名算法、MQ、EDI及少数异常协议需要经过审核的公共执行器或插件。任何情况下都不应把任意 JavaScript/Python 文本存进数据库直接执行。

# V14 DCSA：数字化集装箱航运协会

这四个 DCSA Industry Blueprint 2026\.Q1 页面把项目领域边界进一步讲清楚了：

**一个货柜全生命周期不是一条单线状态，而是 Shipment、Equipment、Vessel 三条相互关联、独立演进的旅程。**

## 三条旅程

因此不能用一张“货柜表”的单个状态字段表达全部过程。例如：

```Plain Text
shipmentStatus = CUSTOMS_RELEASED
equipmentStatus = DISCHARGED
inlandTaskStatus = PICKUP_SCHEDULED
vesselCallStatus = ARRIVED
```

这些状态可以同时成立。

## Shipment Journey

官方页面覆盖：

- Arrival Notice v1\.0\.0

- Bill of Lading v3\.0\.0

- Shipping Instructions

- Transport Document

- Booking v2\.0\.0

- Booking amendment/cancellation/exception

- 危险品预审核

- Shipment Release

- Customs、付款、单证和码头放行前置条件

- 放货授权与执行

- 后程运输及交付安排

这说明清关与放货必须分开：

```Plain Text
海关是否放行
承运人是否放货
码头是否允许提箱
费用/信用是否结清
提单权利是否确认
```

只有全部满足，才形成可执行的提柜资格。

## Equipment Journey

官方定义为 Pickup\-to\-Return，覆盖：

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

## Vessel Journey

官方页面覆盖：

- Long\-Term Schedule

- Coastal Schedule

- 支线与区域船期

- Commercial Schedules v1\.0\.0

- Operational Vessel Schedules v3\.0\.0

- Load List

- 配载计划和装卸指令

- 开航后装载核对

- 舱单申报及海关响应

- Manifest Corrector

- Port Call v2\.0\.0

- Estimated、Planned、Actual 时间戳

- Move Forecast

- Weekly Berth Planning

这说明 ETA/ETD 不能只有货柜表中的四个日期字段，而应建成可修订的日期事实：

```Plain Text
对象：Shipment / Equipment / Vessel / Port Call
事件：Arrival / Berthing / Discharge / Availability
分类：REQUESTED / ESTIMATED / PLANNED / ACTUAL
来源：船司 / 港口 / 码头 / 聚合商 / 人工
版本：第几次更新
```

智能排柜应主要依赖目的港 `Port Call + Discharge + Availability`，而不能只盯船舶 ETA。

## 对当前工作台的映射

## 数据模型应采用关联聚合

```Plain Text
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

## 对四张导入表的影响

四张 Excel 仍可作为当前最小输入集，但导入后不能只落入一张宽表。应分别形成：

```Plain Text
货柜信息表 -> shipment + equipment + assignment
清关信息表 -> customs_case + shipment_release
物流信息表 -> voyage + port_call + inland_transport_task
仓库信息表 -> facility + facility_visit + unloading事实
```

缺少的上游信息可以为空，但聚合边界应现在建立。以后备货、装箱流程上线时，只需调用相同的出运交接接口，不需要重构货柜主表。

## DCSA 的边界

DCSA 明确说明 Vessel Journey 当前不覆盖海上航行期间活动。因此：

- DCSA Blueprint 适合做流程骨架；

- 船司 Track \& Trace 适合提供在途观察事件；

- 飞驼、云当、AIS、港口和码头数据用于补充可见性；

- Logix 自己负责综合来源、解决冲突并形成可操作事实。

另外，蓝图中只有蓝色流程属于相应 DCSA 标准范围，其他流程可能只是行业相关过程。因此不能看到蓝图里有某个环节，就假设存在对应标准 API。

最终可将项目主线收敛为：

```Plain Text
Shipment：有没有权利和条件放货
Equipment：箱子在哪里、下一步应去哪里
Vessel：船和港口作业进行到哪里
Execution：清关、提、送、卸、还由谁在何时执行
Evidence：每个结论来自什么来源、版本和原始凭证
```

这五个问题共同构成真正稳定的出运后全生命周期。

# V15

对 [DCSA Arrival Notice v1](https://reference.dcsa.org/content/standards/releases/arrival-notice/v1) 及其子链接分析后，可以确认 Arrival Notice 不是一张“到港通知表”，而是一个**可版本化、可推送、可拉取、包含放货与提还箱信息的结构化业务单证**。

当前正式版本是 `1.0.1`，不是笼统的 v1。

## 子链接体系

该版本包含13类正式资料：

另外提供不可变历史版本 Archive，适合用于版本审计。

## 标准范围

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

## 四个业务用例

1. `Send Arrival Notice`：发布方主动发送完整通知。

2. `Update Arrival Notice`：信息变化后发送新版通知。

3. `Retrieve Arrival Notice`：接收方按需查询。

4. `Notify Arrival Notice Availability`：只发送“通知已可用”的轻量消息。

轻量通知通常只包含提单号、ETA、卸货港等关键上下文，**不等于完整 Arrival Notice**。

## 三个标准端点

OpenAPI 3\.0\.3 明确规定：

```Plain Text
GET  /arrival-notices
POST /arrival-notices
POST /arrival-notice-notifications
```

端点责任方向很重要：

订阅注册、身份认证和授权不在 DCSA 标准范围内，仍需按船司配置。

## 查询条件

所有 Publisher 必须支持按：

```Plain Text
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

```Plain Text
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

## 分页规则

Arrival Notice 使用 Cursor 分页：

- 请求参数：`limit`、`cursor`

- 响应头：`Next-Page-Cursor`

- 下一页请求必须保留第一页的所有原始查询条件。

- Cursor 可能不可重复使用。

- 最后一页不再返回 Cursor，也可能返回空数组。

分页任务必须保存查询快照，不能只保存 Cursor。

## 通知版本规则

标准明确要求：

```Plain Text
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

```Plain Text
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

## 三种一致性 Profile

标准定义：

这不是三种 Arrival Notice 类型，而是接口能力档案。某船司可能只支持 BASIC，也可能同时支持 FREIGHTED/FREE\_TIME。

费用字段应受更严格权限控制；`removeCharges=true` 表示结构化数据和 PDF 中均应去除费用，而不是只在界面隐藏。

## 对项目最有价值的字段域

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

- 空箱归还地点、还箱指令、Turn\-in Reference

- 是否收到正本提单

- 是否完成运费放行

- 是否海关放行

- 费用

- 免费期

- PDF 可视化版本

尤其是标准中的 `ReleaseInformation`：

```Plain Text
isOBLReceived
isFreightReleased
freightReleaseDate
isCustomsReleased
carrierInformationForCargoRelease
```

它证明“是否可以提柜”必须由多个条件组合判断，不能只看清关状态。

## 错误处理要点

标准明确：

- 查询无结果必须返回 `200 + arrivalNotices: []`，不能返回404。

- 空结果不能区分“提单不存在、通知未生成、超过保留期、无权限或被过滤”。

- `400` 用于无效参数、不支持的过滤组合、超量引用或无效 Cursor。

- `401` 表示认证失败。

- `403` 表示授权失败。

- 同样查询条件，不同接收方可能因为授权不同得到不同结果。

此外，POST 批量消息可能返回 HTTP 200，但部分通知处理失败。必须解析：

```Plain Text
feedbackElements:
- severity: ERROR | WARN | INFO
- message
- propertyPath
```

不能把 HTTP 200 直接视为整批成功。

## 对工作台的实际影响

收到 Arrival Notice 后，系统应：

```Plain Text
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

## 最终建模建议

Arrival Notice 应作为独立单证聚合：

```Plain Text
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

当前四张 Excel 导入时，可以生成 `LEGACY_IMPORT` 来源的 Arrival Notice 投影视图，但不能声称它符合 DCSA AN 1\.0\.1。未来接入船司 API 后，直接写入同一聚合，并通过来源、版本和原始报文实现无缝切换。

# V16

截至 2026\-09\-23，DCSA Commercial Schedules v1 当前发布版本为 **1\.0\.3**。它定义的是班期查询与运输方案选择标准，核心服务于订舱前和运输计划阶段，不是货物实际执行状态或实际到离港事实。

主页面：[Commercial Schedules v1](https://reference.dcsa.org/content/standards/releases/commercial-schedules/v1)

## 一、链接与子链接结构

该版本页面主要包含：

OpenAPI 文件：

[Commercial Schedules 1\.0\.3 OpenAPI YAML](https://reference.dcsa.org/files/content/standards/releases/commercial-schedules/v1/cs-v1-0-3-openapi-specification/dcsa-cs-v103-release-openapi-specification.yaml)

标准采用：

- OpenAPI 3\.0\.3

- Apache\-2\.0 许可证

- API 契约版本 1\.0\.3

- HTTP GET 拉取模式

- 游标分页

## 二、三类商业班期能力

### Point\-to\-Point Routing

端点：

```Plain Text
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

```Plain Text
CY   Container Yard
SD   Store Door
CFS  Container Freight Station
```

货物类型包括：

```Plain Text
DRY
REEFER
```

结果不只是一个船期，而是完整运输方案：

```Plain Text
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

### Port Schedule

端点：

```Plain Text
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

### Vessel Schedule

端点：

```Plain Text
GET /v1/vessel-schedules
```

用于查询指定船舶、航线、航次或地点对应的航程轮转和港序。

标准范围明确支持从以下维度查询：

- Service

- Voyage

- Vessel

- Location

1\.0\.3 增加了 `responseScope`：

```Plain Text
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

## 三、标准中的数据语义

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

## 四、版本变化

不能只保存“Commercial Schedules v1”，应保存完整语义版本。

### 1\.0\.1

- 增加 `routingReference`

- 支持选定路线向 Booking 流程传递

### 1\.0\.2

- P2P 起运和到达增加 `transportCallReference`

- 增加方案级、区段级排放数据

- 增加区段级截止时间

- 增加可选 `facilityName`

- 增加非结构化 `addressLines`

- 修正游标翻页规则

- 错误代码改为实现方自行管理

### 1\.0\.3

- Vessel Schedule 增加 `responseScope`

- P2P 增加 `co2e`

- P2P 增加 `cargoType`

- P2P 增加 `intermediateCalls`

这说明即使主版本都是 v1，不同小版本的数据能力也有明显差异。

## 五、分页、版本与错误处理

### 游标分页

通用参数：

```Plain Text
limit
cursor
```

响应头：

```Plain Text
Next-Page-Cursor
```

获取下一页时，除了替换游标，还必须保留原始查询条件。例如港口、日期、船舶和航次条件不能丢失。

### API 版本

请求可以携带：

```Plain Text
API-Version: 1
```

响应返回完整版本，例如：

```Plain Text
API-Version: 1.0.3
```

Logix 应同时保存：

- 请求主版本

- 响应完整版本

- 来源供应商

- 拉取时间

- 原始响应摘要或归档引用

### 错误模型

标准错误信息包括：

- HTTP 方法

- 请求 URI

- HTTP 状态

- 供应商关联编号

- 错误时间

- 属性、值和 JSONPath

- 错误代码、文本和说明

但 DCSA 不再要求各实现方使用统一详细错误码。因此应：

```Plain Text
船司原始错误
        ↓
Provider Adapter
        ↓
Logix 稳定内部错误码
```

同时保留供应商原始代码和关联编号，便于对账及排障。

## 六、建议的数据切片

不要建立一张不断覆盖的 `voyage_schedule` 表。建议保存查询快照、方案版本和后续选择关系。

```Plain Text
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

```Plain Text
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

## 七、与 Logix 工作台的关系

当前项目从已出运货柜开始，因此优先级建议如下：

在当前工作台中的应用：

- 清关工作台：根据预计到港窗口安排预审、文件催办和申报

- 提柜工作台：形成预计可提时间的前置参考，但不能等同于“可提柜”

- 智能排柜：把船期变化作为约束输入，不直接产生提柜任务

- 仓库工作台：预测未来到仓压力

- 异常中心：识别航线改变、港序变化、延期或跳港风险

- 出运计划工作台：未来用 P2P 方案进行时效、转运、成本和排放比较

## 八、可配置连接器设计

每家船司可能只实现其中一部分端点，因此能力需要显式配置：

```Plain Text
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

## 最终判断

Commercial Schedules 应在 Logix 中定位为：

> “商业路线与班期候选方案服务”，以及后续执行阶段的计划基线。

它不能替代 Track \& Trace、Arrival Notice、Port Call、码头可提状态或实际生命周期事件。最关键的设计原则，是保存班期快照和完整版本，通过 `routingReference` 将未来的出运计划连接到订舱，再将计划、预计和实际事实分层保存。这样当前从“已出运数据导入”起步，后续向采购、出运计划、订舱和装箱延伸时，不需要推翻已有生命周期模型。

# V17

DCSA Operational Vessel Schedules（OVS）v3 应定位为“船舶实际运营班期交换标准”。它比 Commercial Schedules 更接近执行层，但仍主要表达计划和预计运行安排，不等同于货柜实际物流事件。

主页面：[Operational Vessel Schedules v3](https://reference.dcsa.org/content/standards/releases/operational-vessel-schedules/v3)

说明：本次官方页面读取工具暂时不可用，以下基于 DCSA OVS v3 的标准结构和已确认语义梳理；具体接入时仍应以该页面所附 OpenAPI 文件为契约权威，尤其要再次核定当前补丁版本及端点参数的必填组合。

## 一、子链接体系

OVS v3 发布页面通常按以下内容组织：

这些内容应分成三类使用：

- 业务解释以 Purpose、User Stories、Use Cases 为准。

- 接口开发以 OpenAPI 和 Implementation Guide 为准。

- 供应商验收以 Conformance Scenarios 为准。

## 二、OVS解决什么问题

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

## 三、核心业务对象

### Service

代表定期运营服务或航线，例如亚洲至北欧的一条固定服务。

重要标识一般包括：

- `carrierServiceCode`

- `carrierServiceName`

- `universalServiceReference`

内部应区分：

```Plain Text
船司自己的服务代码
DCSA通用服务引用
Logix内部服务标识
```

船司代码可能改名或重复，不能单独作为永久主键。

### Vessel

代表实际执行航程的船舶，通常使用：

- 船名

- IMO号

- 船旗

- 船舶相关运营信息

IMO号应作为重要业务标识，但历史数据仍需保留当时返回的船名快照。只关联当前船舶主数据，会导致历史展示随主数据修改而变化。

### Voyage

一次航程可能同时存在：

- 船司出口航次号

- 船司进口航次号

- DCSA通用出口航次引用

- DCSA通用进口航次引用

不同港口观察到的进口/出口航次语义可能不同，因此不能只设置一个模糊的 `voyage_no`。

推荐至少拆分为：

```Plain Text
carrier_export_voyage_number
carrier_import_voyage_number
universal_export_voyage_reference
universal_import_voyage_reference
```

### Transport Call

Transport Call 是 OVS 最关键的颗粒度，表示船舶在某地点的一次运输挂靠。

它通常连接：

- 服务

- 航次

- 船舶

- 港口

- 码头或泊位

- 挂靠顺序

- 到港和离港时间

`transportCallReference` 应保留。它可以把班期、Track \& Trace、Port Call 和后续货物记录关联起来。

### Location / Facility

地点层次应区分：

```Plain Text
国家
  └─ 城市或港口：UN/LOCODE
       └─ 码头：SMDG Facility Code
            └─ 泊位或具体设施
```

只有 UN/LOCODE 不足以支持提柜和码头作业。洛杉矶、纽约等港区内存在多个码头，同港不同码头对清关、提柜和车队调度有直接影响。

### Timestamp

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

```Plain Text
transport_call
  ├─ arrival planned
  ├─ arrival estimated
  ├─ departure planned
  └─ departure estimated
```

如果供应商返回实际时间，也必须按实际事实单独保存，不能覆盖预计值。

## 四、与 Commercial Schedules 的区别

两者可以形成：

```Plain Text
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

## 五、与 Track \& Trace、Port Call 的边界

### OVS

表达：

- 船舶当前预计按什么港序运行

- 当前预计何时到港、离港

- 航次或服务班期如何调整

### Track \& Trace

表达：

- 某票货或某个集装箱发生了什么事件

- 已装箱、进港、装船、卸船、出场等

### Port Call

表达：

- 船舶挂靠过程的精细协同

- 引航、泊位、靠泊、移泊、离泊等时间与服务

因此：

> OVS显示船预计到港，不代表本柜一定在船上；船实际靠港，也不代表本柜已经卸船或可以提柜。

提柜工作台不能只依据 OVS 自动生成“可提”结论，还必须结合：

- 货柜 Track \& Trace

- Arrival Notice

- 清关放行

- 船司放货

- 码头卸船和可提状态

- 滞箱费与免箱期

- 预约资格

## 六、建议的数据结构

不要让 OVS 直接更新货柜主表上的单个 ETA/ETD 字段。建议建立不可变快照与归一化事实层：

```Plain Text
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

### `operational_schedule_snapshot`

- 来源连接器

- 提供方

- 标准版本

- 请求条件

- 拉取时间

- Provider关联编号

- 原始报文引用

- 内容哈希

- 同步结果

### `vessel_voyage`

- 船舶IMO号

- 船名快照

- 承运人

- 服务代码

- 通用服务引用

- 进口/出口航次号

- 通用航次引用

### `transport_call`

- `transportCallReference`

- 挂靠顺序

- UN/LOCODE

- 码头代码

- 泊位或设施

- 运输模式

- 是否取消或跳港

- 所属快照

### `transport_call_timestamp`

- 时间类型：到达/离开

- 分类：计划/预计/实际

- 时间值

- 时区

- 来源

- 首次发现时间

- 最近确认时间

- 被替代关系

## 七、日期事实归一化

OVS数据应进入“候选日期事实”，再经过规则映射到货柜生命周期。

例如：

```Plain Text
OVS目的港预计到港
  ↓
候选事实：VESSEL_DESTINATION_ETA
  ↓ 匹配船舶、航次、港口和货柜运输段
货柜预计到港参考时间
```

每个日期事实至少保存：

```Plain Text
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

## 八、匹配与关联策略

OVS返回的是船舶和航次班期，并不天然知道 Logix 中哪个货柜属于该航程。

建议按强弱顺序匹配：

1. `transportCallReference`

2. DCSA通用航次引用

3. 船公司 \+ 服务代码 \+ 航次号

4. IMO号 \+ 起运港 \+ 目的港 \+ 时间窗口

5. 船名 \+ 航次号 \+ 港口 \+ 时间窗口

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

## 九、连接器配置

供应商是否支持 OVS v3、支持哪些过滤条件，应作为能力配置：

```Plain Text
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

## 十、工作台应用

### 出运工作台

展示：

- 当前船名航次

- 服务和航线

- 起运港与目的港

- 港序

- 当前 ETD/ETA

- 上次 ETA

- ETA变化量

- 数据来源和更新时间

### 清关工作台

根据目的港 ETA 倒排：

- 文件齐套期限

- 合规复核

- ISF或预申报期限

- 报关行任务

- Arrival Notice核对

- 预计申报和放行窗口

### 提柜与智能排柜

OVS只作为预测输入：

```Plain Text
ETA变化
  ↓
预计卸船窗口调整
  ↓
预测可提窗口变化
  ↓
重新评估车队、仓库和三方堆场容量
```

正式派车还需要码头可提、清关放行和预约状态。

### 仓库工作台

按航次和目的港聚合未来到仓量，用于：

- 预测入仓峰值

- 识别容量冲突

- 提前启用三方堆场

- 调整卸柜班次

- 评估加班和等待成本

## 十一、异常和告警

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

```Plain Text
ETA变化
  + 清关截止期限
  + 仓库容量
  + 车队已排任务
  + 免箱期
  + 三方堆场成本
  = 业务风险等级
```

## 最终定位

在 Logix 中，OVS v3 应作为：

> 船舶、航次和港口挂靠的运营计划及预计时间来源。

其数据进入运营班期快照和日期事实层，再与具体 shipment/container 进行可解释关联。它可以驱动清关准备、仓库预测和排柜预排，但不能单独产生“已到港”“已卸船”或“可以提柜”等执行结论。

最重要的落地原则有三条：

1. 保留每次 OVS 快照，不覆盖历史 ETA/ETD。

2. 使用标准业务引用和多条件匹配连接具体货柜。

3. 把计划、预计、实际和货柜事件分层保存，避免不同来源互相覆盖。

# V18

DCSA Operational Vessel Schedules（OVS）v3 应定位为“船舶实际运营班期交换标准”。它比 Commercial Schedules 更接近执行层，但仍主要表达计划和预计运行安排，不等同于货柜实际物流事件。

主页面：[Operational Vessel Schedules v3](https://reference.dcsa.org/content/standards/releases/operational-vessel-schedules/v3)

说明：本次官方页面读取工具暂时不可用，以下基于 DCSA OVS v3 的标准结构和已确认语义梳理；具体接入时仍应以该页面所附 OpenAPI 文件为契约权威，尤其要再次核定当前补丁版本及端点参数的必填组合。

## 一、子链接体系

OVS v3 发布页面通常按以下内容组织：

这些内容应分成三类使用：

- 业务解释以 Purpose、User Stories、Use Cases 为准。

- 接口开发以 OpenAPI 和 Implementation Guide 为准。

- 供应商验收以 Conformance Scenarios 为准。

## 二、OVS解决什么问题

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

## 三、核心业务对象

### Service

代表定期运营服务或航线，例如亚洲至北欧的一条固定服务。

重要标识一般包括：

- `carrierServiceCode`

- `carrierServiceName`

- `universalServiceReference`

内部应区分：

```Plain Text
船司自己的服务代码
DCSA通用服务引用
Logix内部服务标识
```

船司代码可能改名或重复，不能单独作为永久主键。

### Vessel

代表实际执行航程的船舶，通常使用：

- 船名

- IMO号

- 船旗

- 船舶相关运营信息

IMO号应作为重要业务标识，但历史数据仍需保留当时返回的船名快照。只关联当前船舶主数据，会导致历史展示随主数据修改而变化。

### Voyage

一次航程可能同时存在：

- 船司出口航次号

- 船司进口航次号

- DCSA通用出口航次引用

- DCSA通用进口航次引用

不同港口观察到的进口/出口航次语义可能不同，因此不能只设置一个模糊的 `voyage_no`。

推荐至少拆分为：

```Plain Text
carrier_export_voyage_number
carrier_import_voyage_number
universal_export_voyage_reference
universal_import_voyage_reference
```

### Transport Call

Transport Call 是 OVS 最关键的颗粒度，表示船舶在某地点的一次运输挂靠。

它通常连接：

- 服务

- 航次

- 船舶

- 港口

- 码头或泊位

- 挂靠顺序

- 到港和离港时间

`transportCallReference` 应保留。它可以把班期、Track \& Trace、Port Call 和后续货物记录关联起来。

### Location / Facility

地点层次应区分：

```Plain Text
国家
  └─ 城市或港口：UN/LOCODE
       └─ 码头：SMDG Facility Code
            └─ 泊位或具体设施
```

只有 UN/LOCODE 不足以支持提柜和码头作业。洛杉矶、纽约等港区内存在多个码头，同港不同码头对清关、提柜和车队调度有直接影响。

### Timestamp

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

```Plain Text
transport_call
  ├─ arrival planned
  ├─ arrival estimated
  ├─ departure planned
  └─ departure estimated
```

如果供应商返回实际时间，也必须按实际事实单独保存，不能覆盖预计值。

## 四、与 Commercial Schedules 的区别

两者可以形成：

```Plain Text
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

## 五、与 Track \& Trace、Port Call 的边界

### OVS

表达：

- 船舶当前预计按什么港序运行

- 当前预计何时到港、离港

- 航次或服务班期如何调整

### Track \& Trace

表达：

- 某票货或某个集装箱发生了什么事件

- 已装箱、进港、装船、卸船、出场等

### Port Call

表达：

- 船舶挂靠过程的精细协同

- 引航、泊位、靠泊、移泊、离泊等时间与服务

因此：

> OVS显示船预计到港，不代表本柜一定在船上；船实际靠港，也不代表本柜已经卸船或可以提柜。

提柜工作台不能只依据 OVS 自动生成“可提”结论，还必须结合：

- 货柜 Track \& Trace

- Arrival Notice

- 清关放行

- 船司放货

- 码头卸船和可提状态

- 滞箱费与免箱期

- 预约资格

## 六、建议的数据结构

不要让 OVS 直接更新货柜主表上的单个 ETA/ETD 字段。建议建立不可变快照与归一化事实层：

```Plain Text
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

### `operational_schedule_snapshot`

- 来源连接器

- 提供方

- 标准版本

- 请求条件

- 拉取时间

- Provider关联编号

- 原始报文引用

- 内容哈希

- 同步结果

### `vessel_voyage`

- 船舶IMO号

- 船名快照

- 承运人

- 服务代码

- 通用服务引用

- 进口/出口航次号

- 通用航次引用

### `transport_call`

- `transportCallReference`

- 挂靠顺序

- UN/LOCODE

- 码头代码

- 泊位或设施

- 运输模式

- 是否取消或跳港

- 所属快照

### `transport_call_timestamp`

- 时间类型：到达/离开

- 分类：计划/预计/实际

- 时间值

- 时区

- 来源

- 首次发现时间

- 最近确认时间

- 被替代关系

## 七、日期事实归一化

OVS数据应进入“候选日期事实”，再经过规则映射到货柜生命周期。

例如：

```Plain Text
OVS目的港预计到港
  ↓
候选事实：VESSEL_DESTINATION_ETA
  ↓ 匹配船舶、航次、港口和货柜运输段
货柜预计到港参考时间
```

每个日期事实至少保存：

```Plain Text
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

## 八、匹配与关联策略

OVS返回的是船舶和航次班期，并不天然知道 Logix 中哪个货柜属于该航程。

建议按强弱顺序匹配：

1. `transportCallReference`

2. DCSA通用航次引用

3. 船公司 \+ 服务代码 \+ 航次号

4. IMO号 \+ 起运港 \+ 目的港 \+ 时间窗口

5. 船名 \+ 航次号 \+ 港口 \+ 时间窗口

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

## 九、连接器配置

供应商是否支持 OVS v3、支持哪些过滤条件，应作为能力配置：

```Plain Text
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

## 十、工作台应用

### 出运工作台

展示：

- 当前船名航次

- 服务和航线

- 起运港与目的港

- 港序

- 当前 ETD/ETA

- 上次 ETA

- ETA变化量

- 数据来源和更新时间

### 清关工作台

根据目的港 ETA 倒排：

- 文件齐套期限

- 合规复核

- ISF或预申报期限

- 报关行任务

- Arrival Notice核对

- 预计申报和放行窗口

### 提柜与智能排柜

OVS只作为预测输入：

```Plain Text
ETA变化
  ↓
预计卸船窗口调整
  ↓
预测可提窗口变化
  ↓
重新评估车队、仓库和三方堆场容量
```

正式派车还需要码头可提、清关放行和预约状态。

### 仓库工作台

按航次和目的港聚合未来到仓量，用于：

- 预测入仓峰值

- 识别容量冲突

- 提前启用三方堆场

- 调整卸柜班次

- 评估加班和等待成本

## 十一、异常和告警

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

```Plain Text
ETA变化
  + 清关截止期限
  + 仓库容量
  + 车队已排任务
  + 免箱期
  + 三方堆场成本
  = 业务风险等级
```

## 最终定位

在 Logix 中，OVS v3 应作为：

> 船舶、航次和港口挂靠的运营计划及预计时间来源。

其数据进入运营班期快照和日期事实层，再与具体 shipment/container 进行可解释关联。它可以驱动清关准备、仓库预测和排柜预排，但不能单独产生“已到港”“已卸船”或“可以提柜”等执行结论。

最重要的落地原则有三条：

1. 保留每次 OVS 快照，不覆盖历史 ETA/ETD。

2. 使用标准业务引用和多条件匹配连接具体货柜。

3. 把计划、预计、实际和货柜事件分层保存，避免不同来源互相覆盖。

# V19

DCSA Verified Gross Mass（VGM）v1 定义了集装箱核实总重的数字化申报、接收和状态管理方式。它位于装箱完成之后、装船许可之前，是装箱工作台向出运执行交接的重要合规数据。

主页面：[Verified Gross Mass v1](https://reference.dcsa.org/content/standards/releases/verified-gross-mass/v1)

由于官方页面读取环境暂时不可用，下面重点解释其稳定的业务语义和 Logix 落地方式；准确补丁版本、端点路径、字段必填性和枚举代码应以页面中的 OpenAPI Specification 为最终依据。

## 一、链接与子链接体系

VGM v1发布页通常包括：

实施时应分别采信：

- SOLAS规则决定业务责任和法律含义。

- DCSA业务文档决定数据语义。

- OpenAPI决定具体接口契约。

- 船司、码头和当地主管部门规则决定具体截止时间及接受条件。

## 二、VGM是什么

VGM是：

> 已装载集装箱的、经过规定方法核实的总重量。

基本构成为：

```Plain Text
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

## 三、SOLAS业务边界

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

## 四、两种核实方法

### 方法一：整柜称重

货柜装箱、封箱后，对完整集装箱称重。

```Plain Text
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

### 方法二：组成项计算

分别计算货物、包装、托盘、加固材料等重量，再加集装箱皮重。

```Plain Text
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

## 五、核心业务对象

### 集装箱设备

至少包括：

- `equipmentReference`，通常为箱号

- 设备类型或ISO尺寸类型

- 集装箱皮重

- 皮重来源

- 封条号

- 所属订舱或货运单

箱号应执行 ISO 6346 格式及校验位校验，但格式正确不代表该箱号一定真实有效。

### 核实总重

至少需要：

- 重量数值

- 重量单位

- 称重方法

- 称重日期时间

- 称重地点

- 数据来源

- 当前申报版本

内部建议统一转换为千克用于计算，同时保存来源原值和单位：

```Plain Text
source_weight_value
source_weight_unit
normalized_weight_kg
```

重量应使用定点十进制，不能使用浮点数。

### 责任参与方

需要明确区分：

- 法律责任托运人

- VGM提交方

- 实际称重方

- 方法二计算方

- 代理人

- 接收船司

- 接收码头

“谁录入系统”和“谁承担VGM法律责任”不是同一个概念。

### 业务引用

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

### 支持文件

可能包括：

- 地磅单

- 称重证书

- 方法二计算明细

- 设备校准或资质文件

- 签名声明

- 船司或码头接收回执

文件应作为版本化文档对象管理，而不是只在VGM表中保存一个不可审计的URL。

## 六、建议的业务状态

应区分内部准备状态与外部接收状态：

```Plain Text
DRAFT
  ↓
READY_TO_SUBMIT
  ↓
SUBMITTED
  ↓
ACCEPTED
```

异常分支：

```Plain Text
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

## 七、更正不能覆盖原记录

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

```Plain Text
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

## 八、建议的数据切片

```Plain Text
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

### `vgm_declaration`

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

### `vgm_measurement`

保存实际称重事实：

- 测量值

- 称重点

- 衡器标识

- 执行方

- 测量时间

- 凭证

- 精度或误差范围

### `vgm_calculation_component`

主要服务于方法二：

- 货物重量

- 包装重量

- 托盘重量

- 加固材料重量

- 集装箱皮重

- 每项来源

- 计算规则版本

### `vgm_submission`

保存每次外部提交：

- 接收方

- 接口连接器

- 标准版本

- 幂等键

- 请求时间

- 请求报文引用

- 处理状态

- 重试次数

### `vgm_response`

保存船司或码头回执：

- 接受、拒绝或警告

- 外部引用号

- 原始错误代码

- Logix内部错误码

- 接收时间

- 错误字段和说明

## 九、与备货、装箱、出运的衔接

完整链路应为：

```Plain Text
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

### 一柜一个备货单

关联比较直接：

```Plain Text
container_loading
  ├─ container
  ├─ stocking_order
  └─ VGM
```

### 一柜多个备货单

VGM必须关联“本次集装箱装载实例”，而不是任选一个备货单：

```Plain Text
container_loading
  ├─ stocking_order A
  ├─ stocking_order B
  ├─ stocking_order C
  └─ 一个整柜VGM
```

VGM是整柜层面的声明，不应为同一柜的每张备货单分别产生一个正式VGM。

## 十、导入阶段如何处理

当前项目从已出运数据导入起步，四张业务表中如果存在重量字段，应先做语义映射。

只有能够确认下列信息时，才能导入为正式VGM：

- 明确是核实总重

- 能关联到本次装载实例

- 有重量单位

- 有称重或申报来源

- 最好有称重方法或提交凭证

若只有“柜重”或“毛重”字段，应导入为：

```Plain Text
IMPORTED_REPORTED_WEIGHT
```

而不是直接标记为：

```Plain Text
VERIFIED_GROSS_MASS
```

建议增加数据质量等级：

推断数据不能用于自动得出合规结论。

## 十一、工作台设计

### 装箱工作台

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

### 出运工作台

重点显示：

- 哪些柜尚无VGM

- 哪些柜接近VGM截止时间

- 哪些申报被拒绝

- 哪些VGM与装箱重量差异异常

- 哪些柜已换箱但VGM未更新

- 哪些柜尚未得到船司或码头确认

应提供按航次、订舱和截港时间聚合的处理队列。

### 合规工作台

应检查：

- 所在法域是否允许方法二

- 方法二主体是否具备所需资质

- 称重设备证书是否有效

- 重量单位和允许误差

- 签署人权限

- VGM截止时间

- 更正是否重新提交

- 凭证是否满足保存期限

## 十二、自动校验规则

推荐至少实施：

```Plain Text
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

```Plain Text
VGM - 装箱货物预计总重 - 皮重
```

是否超过允许差异阈值。差异只能触发复核，不能由系统静默修改重量。

## 十三、外部接口配置

不同船司和码头可能支持不同操作，应按能力配置：

```Plain Text
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

## 十四、与其他DCSA标准的关系

```Plain Text
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

- Track \& Trace显示已装船，可以作为检查VGM流程异常的证据，但不能反向补造VGM声明。

## 最终定位

VGM v1在 Logix 中应定位为：

> 集装箱装载实例的法定重量声明、证明材料、外部提交及接收结果。

它是装箱工作台向出运工作台交接的一个明确质量门：

```Plain Text
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
