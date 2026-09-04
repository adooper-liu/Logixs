# 契约草案（P2-08/09 前身）——API/事件/状态码

> 状态：**候选（草案）** · 2026-09-04 · 负责人：刘志高。
> 定位：把已确认决策落成**可评审契约初稿**（固定内部码 + 映射字典 + 统一信封 + 稳定错误码 + 版本策略），
> 作为 P2-08/09/10 与 P3 `packages/contracts` 的输入。物理 Schema/OpenAPI 生成见 P3-05/P3-13；跨语言 Parity 见 ADR-009。
> 依据：D1–D14、R0–R6、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[ACTION_CATALOG](./ACTION_CATALOG.md)、[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[DATA_MODEL_P2-06](./DATA_MODEL_P2-06.md)、[INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md)。

## 1. 统一信封与错误码

- 成功/失败统一信封：`{ code, message, traceId, data }`；列表加 `{ page, pageSize, total }`（分页、最大页、稳定排序）。
- 业务成功码 `0`；非零为稳定业务错误码；HTTP 用于传输语义，业务成败看 `code`（对齐外部规范习惯，但以我方码为准）。
- 错误码族（草案）：

| 族 | code 前缀 | 示例（稳定） |
| --- | --- | --- |
| 校验 | `VAL` | `VAL_REQUIRED`、`VAL_FORMAT`、`VAL_CURRENCY` |
| 认证/授权 | `AUTH` | `AUTH_UNAUTH`、`AUTH_FORBIDDEN`、`AUTH_OBJECT_SCOPE` |
| 业务规则 | `BIZ` | `BIZ_STATE_VIOLATION`、`BIZ_SEALED`、`BIZ_SOURCE_LOCKED`(手工锁)、`BIZ_UNKNOWN_DICT` |
| 幂等/并发 | `IDEM` | `IDEM_DUPLICATE`、`IDEM_CONFLICT`、`IDEM_STALE_VERSION` |
| 未找到 | `NF` | `NF_RECORD` |
| 限流 | `RATE` | `RATE_LIMIT` |
| 外部依赖 | `EXT` | `EXT_DOWN`、`EXT_TIMEOUT` |

- 错误响应不泄露栈/SQL；携带 traceId（AGENTS §5、架构 §14）。

## 2. 状态码与事件码（固定内部单一权威，外部经映射字典）

### 2.1 状态码（简化，主链 + 终态）
固定码：`not_shipped`、`shipped`、`in_transit`、`at_port`、`picked_up`、`unloaded`、`returned_empty`、`cancelled`。
（语义/转换见 [CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)；不得复制正文。）

### 2.2 事件信封（外部/内部统一）
`{ eventCode, eventTime, isEsti(Y预计/N实际), transportMode, placeCode/portCode, terminalName, descriptionCn/En, descriptionOrigin/placeOrigin, source, dbtype(1增/2改/3删), offLoadOfCarrier? }`（对齐 W1/规范，供 P2-09/阶段二）。

### 2.3 源码 → 语义对照初表（映射字典条目，非完整正文）
| 源码示例 | 语义 | 折叠/落点 |
| --- | --- | --- |
| `STSP` 提空 / `GTOT EMPTY` | 提空箱 | 装箱前操作事件 |
| `GITM/GTIN LADEN` 进场/返场 | 进港/返场 | 装箱后·进港子里程碑 |
| `LOBD/LOAD` | 装船 | 出运(#3)证据 |
| `DLPT/DEPA` | 离港 | 离港(#4, atd) |
| `BDAR/ARRI·BRTH/POCA` | 抵港/靠泊 | 目的港·靠泊子里程碑 |
| `DSCH/DISC` | 卸船 | 卸船·可提前 |
| `RELS(PASS/SRRS/TMPS/MCRP)` | 各主体放行 | 放行体系(exception/前提) |
| `HOLD(CUS/SRM/TML)/1H↔1I` | 扣留/解除 | 五主体 exception |
| `DUMP(Y/N)` | 甩柜预计/实际 | 异常+漏装/退关闭环 |
| `GTOT LADEN/STCS/RCVE` 提柜/送仓/还空 | 提柜/送仓/还箱 | K10/11/14 |

## 3. 动作契约骨架（一键确认）
`POST /actions/:code/confirm` 请求：`{ actionCode, contextRef(orderNumber/containerRecordId), confirm(二次确认标志), payloadOverrides? }`
响应走统一信封；服务端校验：可写窗口 R4/密封 R3、来源权威 D7、权限/二次确认（confirm_* 默认需二次确认，D14）、审计留痕。
动作码固定集见 [ACTION_CATALOG](./ACTION_CATALOG.md)（新增=加字典+绑定，不改核心）。

## 4. 只读工作台投影契约骨架
`GET /containers/:orderNumber/workbench`（或按记录 id）返回（草案字段）：
`identity{orderNumber, containerNumber?, carrierB/L?}`、`currentStatus`、`rail(node[], planned/actual, sealed, optional, abnormal)`、
`markers[]`、`exceptions[]`、`nextActions[]{actionCode, reason, severity}`、`timeline[]`。
（前端只消费只读投影；动作另走 §3。）

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
- 物理生成与工具（P3）。

## 8. 关联

- 上链：P2-08/09/10；[ACTION_CATALOG](./ACTION_CATALOG.md)、[IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[DATA_MODEL_P2-06](./DATA_MODEL_P2-06.md)。
