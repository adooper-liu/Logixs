# 云当网知识库

## 1. 文档定位

本目录集中保存 TrackingEyes（云当网）接口、状态码、字段语义、覆盖能力及接入约束，作为 Logixs 供应商适配器的设计和核验依据。

云当网是继飞驼之后整理的第二家第三方证据供应商。本目录的存在本身就是对「供应商中立 Port/Adapter + 复合映射」设计假设的一次检验：两家供应商的业务域大量重叠，但**码表只重叠约一半**（见 §5），这决定了映射条目必须按供应商分别维护，而不能指望一张通用表。

本文档集不是 Logixs 领域状态机的权威定义。云当网返回值必须依次经过原始证据留存、供应商映射、规范事件转换和生命周期守卫，才可影响主流程：

```text
云当网原始载荷 -> 云当网码表/字段映射 -> Logixs 规范事件 -> 生命周期守卫 -> 流程状态
```

文档状态：外部供应商核验知识库（review input）。接口行为、覆盖范围和码表可能随供应商版本变化；上线前须以已签约租户的最新云当网文档及联调结果复核。**本目录内容摘自 2026-09-18 的公开文档站快照，未经联调验证。**

## 2. 与 Logixs 主流程的关系

与飞驼完全同构，不因供应商不同而分叉：

```text
ContainerRecord -> FlowInstance -> NodeTask -> WorkOrder(s)
-> ClientOperation -> 数据/证据/同步回执
-> WorkOrder 状态 -> NodeTask 聚合 -> 规范事件
-> 生命周期转换 -> 下一节点
```

- 云当网适配器只产生外部证据、同步回执和规范事件候选，不直接修改 `FlowInstance`。
- 云当网的推送模式（平台回调我方地址）与 Logixs 的 Inbox 接收链天然同形，但**载荷必须先归一**：Inbox 收的是规范事件（`containerId`/`eventCode`/`occurredAt`/`evidenceRefs`/`idempotencyKey`），不是云当网的 `statusCd`。
- 云当网的 `sourceCd`（1=船东、2=码头、4=云当计算）是**逐事件的来源信号**，可直接支撑来源权威判定，不得丢弃。

## 3. 内容导航

- [API_CATALOG.md](./API_CATALOG.md)：67 个接口的能力域目录与三件套（订阅/推送/下载）标注。
- [CODE_TABLES.md](./CODE_TABLES.md)：海运 42 码、报关状态码、空运 13 码、快递主状态码、港杂费代码。
- [PUSH_PAYLOAD_STRUCTURE.md](./PUSH_PAYLOAD_STRUCTURE.md)：各数据域推送载荷结构、双数组更正机制与幂等抓手。
- [FIELD_AND_TIME_SEMANTICS.md](./FIELD_AND_TIME_SEMANTICS.md)：字段、标识符、时间语义与已确认的契约冲突。
- [AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md)：签名、token、限流、密钥与运维约束。
- [ADAPTER_AND_SYNC_DESIGN.md](./ADAPTER_AND_SYNC_DESIGN.md)：云当网特定适配细节（通用同步语义仍以 [同步可靠性契约 V1](../../product/domain/SYNC_RELIABILITY_CONTRACT_V1.md) 为准）。

## 4. 状态分层

与飞驼知识库一致，以下状态必须独立存储，不得复用同一枚举：

1. API 调用状态：HTTP/业务响应是否成功，例如 `code=200` 仅表示接口调用成功。
2. 供应商同步状态：`trackStatus`（T/B 跟踪中、E 跟踪结束、F 跟踪失败）、`endStatus`（E 正常结束、EF 强制结束）、`dataStatus`（Y 有数据、B 无数据、M 有数据但箱号不存在）。**`E`/`EF` 只表示云当网停止更新，不是业务事实。**
3. 事件时间性质：`isEstimate`（true=预计、false=实际）与 `planTime`/`estimateTime`/`actualityTime` 三列。
4. 业务事实状态：`statusCd` 所描述的实际事件（装船、离港、卸船、提柜、还箱等）。
5. Logixs 生命周期状态：由领域规则和守卫统一决定。

## 5. 与飞驼码表的对照（重要）

两家供应商的对同一业务域使用**部分重叠**的海运动态码。按 42 个云当网码与飞驼目录逐条比对：

- **约 23 个码两边同形同名**，可直接共用一条语义映射（如 `STSP` 提空箱、`LOBD` 装船、`DLPT` 离港、`BDAR` 抵达卸货港、`STCS` 货主提柜、`RCVE` 还空箱、`IRLB/IRDP/IRAR/IRDS` 铁路四码）。
- **云当网独有约 19 个**：`BKCF`（订舱）、`CGGI`（装箱）、`CLOD`（封箱）、`ERDP/ERAR`（铁运发车/到达）、`FCGI`（重箱返场）、`CYTC`（集港）、`SUOT`（退关）、`TMCL`（码头取消放行）、`TMUT`（退载）、`TRDP/TRAR`（卡车离开/抵达）、`DGOT`（卸货港码头出场）、`DCRL`（卸货港海关放行）、`PDAR/PDDS/PDRC`（目的地三段）、`CGRL`（船东放货）、`CTUP`（集装箱拆箱）。
- **飞驼独有**（云当网状态码表未列）：`STUF`、`TSCA`、`POCA`、`PCAB`、`STRP`、`GWIT/GWOT/GTIN/GTOT`、`FETA`、`PLFD`、`BGLB/BGDP/BGBA/BGDC`、`DUMP` 及预警类 `W*`。

**结论**：映射条目按 `(provider, rawCode, context)` 分别建档，共享的 23 个码可以互相参考但**不得合并成同一行**——两家的码集会各自演进，合并后无法表达"只在其中一家新增"的情况。这正是 [EXTERNAL_EVENT_MAPPING §3](../../product/domain/EXTERNAL_EVENT_MAPPING.md) 复合键设计的用途。

另外，云当网状态码表自带免责声明：「动态节点的中文名称仅供参考！可根据您的业务需求，通过代码（CODE列）自行映射所需的中文描述」——供应商自己也确认了中文名不是契约，映射目标必须是我们内部的语义事件码。

## 6. 来源索引

资料来自公开文档站 `https://trackingeyes-cn.apifox.cn/`，底层数据接口为 Apifox 的公开文档 API：

```text
projectId = 5270552      中文分支 branchId = 4938908
目录树  GET https://api.apifox.com/api/v1/published-projects/5270552/http-api-tree?branchId=4938908
接口详情 GET .../published-projects/5270552/http-apis/{apiId}
文档正文 GET .../published-projects/5270552/doc/{docId}
```

2026-09-18 快照共采集 105 个节点：**接口 67 个、文档 38 篇**。各接口与文档的 ID 已就近登记在 [API_CATALOG](./API_CATALOG.md) 与 [CODE_TABLES](./CODE_TABLES.md) 的表格中，便于按 ID 回溯原文。

重新采集时须记录采集日期与分支 ID；供应商文档更新后应重新对拍并在此登记差异。
