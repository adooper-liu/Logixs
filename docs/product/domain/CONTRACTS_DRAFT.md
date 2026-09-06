# 契约草案（P2-08/09 前身）——API/事件/状态码

> 状态：**候选（草案）** · 2026-09-06 · 负责人：刘志高。
> 定位：把 O/S/R 证据与 C 级映射整理成**可评审契约初稿**（固定内部码 + 映射字典 + 统一信封 + 稳定错误码 + 版本策略），
> 作为 P2-08/09/10 与 P3 `packages/contracts` 的输入。物理 Schema/OpenAPI 生成见 P3-05/P3-13；跨语言 Parity 见 ADR-009。
> 依据：D1–D21 追踪项、R0–R6、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[ACTION_CATALOG](./ACTION_CATALOG.md)、[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[DATA_MODEL_P2-06](./DATA_MODEL_P2-06.md)、[INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md)；追踪项在通过 Decision 门禁前仍是候选契约输入。

## 1. 统一信封与错误码

- 成功/失败统一信封：`{ code, message, traceId, data }`；列表加 `{ page, pageSize, total }`（分页、最大页、稳定排序）。
- 业务成功码 `0`；非零为稳定业务错误码；HTTP 用于传输语义，业务成败看 `code`（对齐外部规范习惯，但以我方码为准）。
- 错误码族（草案）：

| 族        | code 前缀 | 示例（稳定）                                                                                      |
| --------- | --------- | ------------------------------------------------------------------------------------------------- |
| 校验      | `VAL`     | `VAL_REQUIRED`、`VAL_FORMAT`、`VAL_CURRENCY`                                                      |
| 认证/授权 | `AUTH`    | `AUTH_UNAUTH`、`AUTH_FORBIDDEN`、`AUTH_OBJECT_SCOPE`                                              |
| 业务规则  | `BIZ`     | `BIZ_STATE_VIOLATION`、`BIZ_SEALED`、`BIZ_SOURCE_LOCKED`(来源权威/纠偏锁冲突)、`BIZ_UNKNOWN_DICT` |
| 幂等/并发 | `IDEM`    | `IDEM_DUPLICATE`、`IDEM_CONFLICT`、`IDEM_STALE_VERSION`                                           |
| 未找到    | `NF`      | `NF_RECORD`                                                                                       |
| 限流      | `RATE`    | `RATE_LIMIT`                                                                                      |
| 外部依赖  | `EXT`     | `EXT_DOWN`、`EXT_TIMEOUT`                                                                         |

- 错误响应不泄露栈/SQL；携带 traceId（AGENTS §5、架构 §14）。

## 2. 状态码与事件码（固定内部单一权威，外部经映射字典）

### 2.1 状态码（简化，主链 + 终态）

固定码：`not_shipped`、`shipped`、`in_transit`、`at_port`、`picked_up`、`unloaded`、`returned_empty`、`cancelled`。
（语义/转换见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)；不得复制正文。）

### 2.2 内部规范事件信封（外部模型经 Adapter 映射）

外部供应商字段（如 `eventTime/isEsti/dbtype`）止于 Adapter；内部候选事件信封为：

`{ eventId, eventVersion, eventCode, occurredAt, receivedAt, isEstimate, containerRecordId, correlationId, causationId?, sourceSystem, sourceEventId?, ingestionChannel, place, evidenceRefs[], correctionOfEventId?, operation, attributes }`

- `eventId + eventVersion + occurredAt + correlationId` 是内部事件最低契约要求；所有时间按 UTC/ISO 8601 交换。
- `(sourceSystem, sourceEventId)` 或经评审的等价键用于外部事件幂等；没有源事件 ID 时必须定义确定性去重策略。
- `receivedAt` 不覆盖 `occurredAt`；投影按业务发生语义和状态规则处理乱序，不按网络到达顺序推进。
- 外部更正/撤回通过新事件的 `correctionOfEventId + operation` 引用原事件；稳定枚举与具体字段名仍为 C，P2-09 定稿前不得在多端复制。
- 重放只重建允许重建的投影；若更正会使已密封 `currentStatus` 倒退，必须返回不一致/补偿结果并进入受控复核，不能由消费者自行回滚状态。
- 来源是否可推进特定字段/状态由 INTEGRATION_BOUNDARIES D7 的字段/事件级策略决定，不由 `ingestionChannel` 决定。

### 2.3 源码 → 语义对照初表（映射字典条目，非完整正文）

| 源码示例                              | 语义           | 折叠/落点                |
| ------------------------------------- | -------------- | ------------------------ |
| `STSP` 提空 / `GTOT EMPTY`            | 提空箱         | 装箱前操作事件           |
| `GITM/GTIN LADEN` 进场/返场           | 进港/返场      | 装箱后·进港子里程碑      |
| `LOBD/LOAD`                           | 装船           | 出运(#3)证据             |
| `DLPT/DEPA`                           | 离港           | 离港(#4, atd)            |
| `BDAR/ARRI·BRTH/POCA`                 | 抵港/靠泊      | 目的港·靠泊子里程碑      |
| `DSCH/DISC`                           | 卸船           | 卸船·可提前              |
| `RELS(PASS/SRRS/TMPS/MCRP)`           | 各主体放行     | 放行体系(exception/前提) |
| `HOLD(CUS/SRM/TML)/1H↔1I`             | 扣留/解除      | 五主体 exception         |
| `DUMP(Y/N)`                           | 甩柜预计/实际  | 异常+漏装/退关闭环       |
| `GTOT LADEN/STCS/RCVE` 提柜/送仓/还空 | 提柜/送仓/还箱 | K10/11/14                |

## 3. 动作契约骨架（一键确认）

`POST /actions/:code/confirm` 请求：`{ clientOperationId, taskId?, actionCode, contextRef(orderNumber/containerRecordId), confirm(二次确认标志), payloadOverrides? }`
响应走统一信封并返回提交结果；该结果至少能表达“请求已接收、业务已接受/拒绝、业务事实已落账/未落账”及各自时间/原因/结果引用，并关联 `clientOperationId`、幂等结果与 `traceId`。具体字段名与枚举待 P2-08/09 定稿，不将本句示例当作物理 Schema。服务端校验：可写窗口 R4/密封 R3、来源权威 D7、权限/二次确认（confirm\_\* 默认需二次确认，D14）、审计留痕。
动作码固定集见 [ACTION_CATALOG](./ACTION_CATALOG.md)（新增=加字典+绑定，不改核心）。

### 3.1 三种状态的契约边界（负责人确认，具体枚举待设计）

- `currentStatus`：货柜业务状态，唯一权威仍为 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)，只由合法事件/证据推进。
- `taskStatus`：任务作业状态，必须拥有独立状态机；不得复用 `currentStatus`。具体状态码、领取并发与异常恢复转换待任务领域模型定稿。
- `syncStatus`：客户端根据本地待提交记录与服务端提交结果表达确认进度，不写成货柜或任务业务结果；至少区分请求接收、业务决定和事实落账，超时只表示相应阶段“未确认”，不得推定失败或成功。
- 扫描/报工类命令至少关联 `clientOperationId + taskId + contextRef + evidence + occurredAt`，重复提交返回同一幂等结果并可用 `traceId` 追踪。

#### 3.1.1 提交结果的最小确认链

| 阶段                  | 契约必须提供的语义                                        | 失败/重试语义                                                                       |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 请求已接收            | 可查询的操作标识、服务端接收时间、幂等判定                | 未确认时客户端用同一 `clientOperationId` 幂等重试；已确认后查询原操作，不生成新操作 |
| 业务已接受/拒绝       | 明确决定、稳定业务原因、决定时间                          | 拒绝由用户修正业务输入或升级处理，不归类为网络同步失败                              |
| 业务事实已落账/未落账 | 事务结果、业务事实/事件引用、版本或等价并发证据、落账时间 | 已接受但未落账由服务端重试、补偿或转人工；客户端不得自行宣称完成                    |

- 同步事务可以一次返回三段结果，不要求制造可见中间状态；异步/跨事务时才要求中间阶段可查询、可恢复。
- 只有造成不同重试、补偿、权限、SLA、审计或用户动作的差异才进入公共契约；队列分区、内部步骤等实现细节不得成为业务枚举。
- 幂等重放必须返回同一次操作已经达到的最高确认结果及同一业务结果引用，不能重复落账。
- `occurredAt` 表示现场业务发生时间；接收、业务决定与落账时间表示系统处理证据。离线补报或延迟回调时必须同时保留，契约不得用落账时间覆盖业务发生时间。
- 任务报工、外部里程碑、单证传送、异常关闭和费用确认等相似语义统一引用 [PRINCIPLES §1.1](../PRINCIPLES.md) 的适度拆分判据；本草案不提前生成对应状态枚举。

### 3.2 三层映射的契约边界（负责人确认，具体字段待设计）

- 管理层以维度查询/聚合，不产生另一套业务事实；任何指标行必须能定位其统计时点/周期及对应的货柜、节点与动作集合。
- 主流程以生命周期节点引用（候选字段 `nodeKey`）与事件时序承载信息、数据和货柜状态；节点枚举与顺序引用 LIFECYCLE_CONSISTENCY，不在契约中复制。
- 作业以 `taskId + actionCode` 关联 `contextRef + nodeKey`；扫描、报工、异常、任务结果和同步回执沿此关联回到主流程节点，具体引用字段随任务契约定稿。
- 投影应区分原始数据/证据与派生信息，并保留状态、发生时间、提交时间、确认时间和来源，具体 Schema 待 P2-08/09 定稿。
- 每个节点投影必须覆盖 [PRINCIPLES §1.6](../PRINCIPLES.md) 的七组 SOP，并以引用关联计划、任务、事件、时间、费用、异常、人工复核和会议决议；具体字段名待定，不得把七组实现成七份互相复制的货柜事实。

## 4. 只读工作台投影契约骨架

`GET /containers/:orderNumber/workbench`（或按记录 id）返回（草案字段）：
`identity{orderNumber, containerNumber?, carrierB/L?}`、`currentStatus`、`rail(node[], planned/actual, sealed, optional, abnormal)`、
`taskSummary{taskId, taskStatus, assignee, dueAt, evidenceSummary}`、`submissionProgress{最小三段确认投影，字段待定}`、`nodeSopSummary{七组引用与适用性，字段待定}`、`markers[]`、`exceptions[]`、
`nextActions[]{actionCode, reason, severity}`、`timeline[]`。
（前端只消费只读投影；动作另走 §3。）

### 4.1 受控动态字段投影（候选）

大量普通只读字段采用 `DisplayFieldSet{schema, values}` 投影，避免每个页面重复声明字段模板。这里的
`schema` 是服务端生成并按租户、角色、对象范围裁剪的 **UI 展示契约**，不是数据库 schema、ORM
实体或任意 DTO 的序列化结果：

- `schema{schemaId, schemaVersion, groups[], fields[]}`；分组包含稳定 `code`、显示 `label` 和
  `order`，字段包含稳定 `code`、显示 `label`、`groupCode`、受控 `type`、`order`，可选
  `priority`、`span`、`emptyLabel`、`unit`、`description`、`timeZone`。
- `values` 仅以字段码承载当前对象的已授权值；客户端只读取 `schema.fields` 已声明的键，额外键即使
  意外返回也不得展示。字段级授权、脱敏和对象范围校验必须在服务端完成，前端隐藏不是安全边界。
- V1 受控类型仅为 `text`、`identifier`、`date`、`datetime`、`number`、`decimal`、`currency`、
  `boolean`；禁止 HTML、脚本、组件名、表达式、任意格式化函数或远程资源 URL。
- 金额值使用 `{ amount: decimal-string, currency: ISO-4217-code }`，禁止转为浮点数；时间继续按
  UTC/ISO 8601 交换，`timeZone` 只决定用户展示。
- 非法 schema、重复字段码、未知类型和类型不匹配必须显式失败或标记格式错误；不得静默猜测、
  自动降级为文本或回退到数据库字段名。
- 该投影只适用于普通只读标量事实。货柜/任务/同步三状态、动作能力、提交三段确认、生命周期、
  异常处置、证据操作、费用计算和指标口径继续使用正式领域契约及专用组件。
- `schemaVersion` 用于兼容缓存和演进；破坏性变化遵守 §6。正式 OpenAPI/JSON Schema 与生成客户端
  仍属 P3，当前 Vue 类型只是候选契约的演示实现，不是跨端单一权威。

## 5. 导入契约骨架（AI 建议/审核）

沿用 [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md) 四类对象区分：
`AiMappingSuggestion{sourceColumn→targetField, evidence[], confidence, isLowConfidence, provenance}`、
`ReviewDecision{decision(approved/modified/rejected), operator, reason}`、
`RowExecutionResult{success/skipped/failed/duplicate, orderNumber}`（schema 于 P2-10 细化）。

## 6. 版本与演进（ADR-009）

- 契约语义化版本；破坏性变更走兼容期/新版本；OpenAPI/JSON Schema 由单一权威生成并 Parity 防漂移（P3-13）。
- 事件/状态/动作码新增走字典配置；代码内只留固定码常量（D11–D13）。

## 7. 待评审

- 错误码全集与 HTTP 映射；事件码全集（对齐规范详情页枚举后再补，勿臆造数量）。
- 投影字段集/动作中心推导规则输入（接 LIFECYCLE_CONSISTENCY R4、NODE_PDCA）。
- 任务状态码/转换、物料与扫描证据 Schema、异常阻塞/恢复以及同步回执错误映射。
- 内部事件信封字段、去重键、更正/撤回操作码、乱序窗口和投影重放契约；当前为行为变化候选，尚无运行时消费者或生成物。
- 管理维度目录、节点/动作映射键与指标下钻契约。
- 节点七组 SOP 的适用性、计划/费用/复核/会议引用与权限契约。
- 最小三段确认的字段名、同步/异步事务边界、超时查询、服务端补偿和终态错误映射。
- 物理生成与工具（P3）。

## 8. 关联

- 上链：P2-08/09/10；[ACTION_CATALOG](./ACTION_CATALOG.md)、[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[DATA_MODEL_P2-06](./DATA_MODEL_P2-06.md)。
