# 三方事件码通用映射机制（EXTERNAL_EVENT_MAPPING）

> 状态：**候选 v0.2（机制设计）** · 2026-09-05 初版 · 2026-09-18 增补 §7 来源信号定级 / §8 更正撤回 · 负责人：刘志高。
> 需求：**事件代号与飞驼等三方 API 代码对齐**，建立一套**适用于任意三方 API 对接**的映射机制。
> 依据：D11–D13（固定内部码+映射字典）、[INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) W2/W11（上下文复合键、歧义消歧）、
> [TIMELINE_MAPPING](./TIMELINE_MAPPING.md)（统一事件信封）、[EVENT_CODES](./EVENT_CODES.md)、[时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)、[INTEGRATION_REDUNDANCY](./INTEGRATION_REDUNDANCY.md)（接入归一）。

## 1. 设计原则

1. **内部语义事件码固定唯一**（代码内常量/契约）；三方码一律经映射字典进入，不散落硬编码（D11）。
2. **原样保留 + 归一并存**：原始码/原始描述/原始地点始终留存（对账、多源、出问题可回溯）；映射后才是我们统一语义。
3. **上下文感知，不做"裸码一一映射"**：同一码在不同场景含义不同（如 `GTOT EMPTY` 提空 vs `GTOT LADEN` 提柜；`RELS YAR/CUS`；US `1H↔1I` 成对扣留/解除）→ 映射键是**复合键**（码 × 类别/类型/方向/主体/EMPTY·LADEN…）。
4. **适配任意三方**：加新供应商 = 加"供应商注册 + 该供应商码表 + 映射条目 + 对拍测试"，核心逻辑不动。
5. **找不到/多义 → 待处理队列**，人工确认后**补一条映射**（映射即数据，一次学习、全局复用）；禁止静默猜。
6. 每个映射可带版本/成熟度/适用方；语义目标一律指到我们已定义的**事件语义/节点/状态证据/异常**，不凭空造义。

## 2. 分层

```text
三方原始事件(raw code/text/place/time, e.g. 飞驼 'DLPT')
  │  [归一/标准化: E*→预计, A*→实际, 大小写/空格, 码前缀等]
  ▼
映射查找(复合键: provider + rawCode + context[category/type/direction/party/laden/placeType…])
  │  命中 → 内部语义事件码 + 属性(isEsti/place/分类/来源等级) ; 未命中 → 待处理
  ▼
内部规范事件信封（字段权威：[时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md) §4）
  ▼
分类落点: L 节点/子里程碑 / 状态证据(推进·密封) / 异常(五主体扣留放行·甩柜) / 单证·费用 …
```

供应商的 `eventTime/isEsti/dbtype` 等原始字段完整保留在接入证据中，但必须映射为内部语义；Adapter 不得把供应商 DTO 直接扩散为领域契约。乱序事件按 `occurredAt` 与领域规则重放投影，更正/撤回追加引用原事件的新记录，不原地改写历史。逐事件来源信号见 §7；供应商发起的更正与撤回的接收形态见 §8。

## 3. 复合映射键与消歧规则

- 键 = `(provider, rawEventCode, context)`；context 建议子键：`mode(运输方式)/category(类别)/itemType(EMPTY|LADEN|BL|BK…)/direction(E|I)/party(主体)/placeType(起始·起运港·中转·目的·目的地)`。
- 消歧规则沉淀为映射数据（非常量代码）：
  - `E*→预计(isEsti=Y)、A*→实际(N)`（如 ETD/ATD、ETA/ATA）；
  - 前缀语义：`I/T/F/R/P`（进口/中转/feeder/rail/port）等作为 context 消歧（W11）；
  - US 海关成对规律：`1H↔1I`、`6H↔6I`（H=扣留中/I=解除）——用规则模板生成映射条目而非逐条硬写；
  - 同一供应商文档歧义/错位（如飞驼页标题错位、码多义）→ 以对拍样例为准并记录（见 §5）。

## 4. 映射条目结构（草案）

`external_event_mapping { provider, provider_version, raw_code, raw_desc_cn/en, context(jsonb), semantic_code, is_estimated_default?, target(node|milestone|evidence|exception|doc|fee), maturity(confirmed|candidate), since, ref(doc/sample id), remarks }`

示例（示意）：

| provider   | raw     | context     | semantic/落点               |
| ---------- | ------- | ----------- | --------------------------- |
| FeiTuo     | STSP    | —           | 提空箱（#2 前操作事件）     |
| FeiTuo     | GITM    | laden=EMPTY | 提空/进场                   |
| FeiTuo     | LOBD    | —           | 装船（#3 出运证据）         |
| FeiTuo     | DLPT    | —           | 离港（#4, atd）             |
| Terminal   | GTOT    | EMPTY       | 提空箱                      |
| Terminal   | GTOT    | LADEN       | 提柜/出场（#10）            |
| US Customs | 1H / 1I | —           | 扣留中 / 解除（五主体异常） |
| EIR        | RELS    | YAR         | 放箱（首节点）              |

> 完整条目以 P2-12 对拍样例 + 各供应商文档为准填充；勿臆造未证实码。

## 5. 防漂移与验证

- **映射即契约数据**：条目变更走评审；semantic_code 必须已在内部语义事件码字典内。
- **对拍/回放测试**：拿供应商文档示例 + 真实样本(P2-12) 逐条对拍；CI 比对"映射条目 ↔ 示例 fixture"（呼应 ENGINEERING §7 Parity 精神）。
- 供应商文档更新/歧义 → 重新对拍并记录差异；码全集以详情枚举/对拍为准（不再臆造数量）。

## 6. 接入新三方（步骤清单）

1. 注册 provider（代码空间/文档/订阅模式/密钥）。
2. 导入其原始码表 + 示例 → 与内部语义对拍，产映射条目 + 未覆盖清单。
3. 未覆盖/多义 → 进待处理队列（人工）；确认后补条目（一次学习全局复用）。
4. 编写归一变换（如需）+ 对拍测试 + golden 回放。
5. 上线监控：未命中率/歧义率 → 补映射与告警（P8）。

## 7. 逐事件来源信号与权威定级

供应商可能在**事件实例**上直接给出「这条事实由谁提供」的信号。它决定该事实的权威等级，但不改变语义码：

| 供应商 | 字段       | 取值                                       |
| ------ | ---------- | ------------------------------------------ |
| 云当网 | `sourceCd` | `1`=船东、`2`=码头、`4`=云当计算           |
| 飞驼   | `source=2` | 表示该事件为飞驼自身判断，而非原始权威事实 |

**关键区分：来源信号是事件实例的运行期限定符，既不是映射键，也不进映射条目的固定列。** 同一个 `(provider, rawCode, context)` 在不同实例上可能带不同来源信号——语义码相同，权威等级不同。因此映射条目只回答「这是什么事件」，来源信号回答「这条事实算多权威」，两者必须分开存储。

权威定级按 [证据来源权威契约 V1](./EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md)：

- 船东、码头等**原则权威主体**直接给出的事实，接近 authoritative。
- 供应商计算或推断（如云当网 `sourceCd=4`、飞驼 `source=2`、云当网 `availableStatus` 可提箱状态）只能是 corroborating，**不得单独驱动节点推进**。
- 按该契约 §4，「provider 是承载或聚合数据的供应商，不得自动继承 authority 身份」——**云当网与飞驼本身都不是权威主体**。

强制规则：

1. **来源信号缺失时不得默认为最高等级**，应降级为待核验，而不是按供应商身份推定。
2. 权威判定的落点是该契约 §6 的 `SourceAuthorityPolicyV1` 复合策略，**该策略层尚未实现**；实现前来源信号只做留存与展示，不参与自动推进。
3. 来源信号必须随事件实例一并留存，不得在归一过程中丢弃——丢弃后无法事后重算权威等级。

## 8. 更正、撤回与重放

供应商可能在事后告知「某条已发出的动态被撤销或更正」。不同供应商的表达能力差异很大：

| 供应商 | 更正形态                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 云当网 | 海运跟踪推送用 `ctnrStatus[]`（新增/更新）+ `deleteStatus[]`（删除）双数组，每条带稳定事件 id 与 `dataState`（`add`/`update`/`delete`） |
| 飞驼   | 文档只要求「更正/撤回追加引用原事件的新记录」，**未给出接收形态**，须联调确认                                                           |

对内部语义的要求：

1. **不得原地改写历史。** 更正与撤回一律追加一条引用原事件的新记录，关系取证据来源权威契约 §3 `EvidenceRelationType` 的 `corrects` / `revokes` / `supersedes`，并保留原事件的完整轨迹。
2. **更正信号本身也要映射。** 「事件性质」（新增/更新/删除）是复合键 `context` 的一个维度；未覆盖该维度时，删除事件会被误当作普通事件重复应用。
3. **未知更正信号进未映射队列**，不得按普通事件处理——把撤销当新增，等于把已被否证的事实重新写回。
4. **重放必须记录所用映射版本。** 不得因为"现在知道原映射是错的"而静默改写既有审计事实（见 §5 与证据契约 §11 历史密封）。
5. 更正到达时若目标事件已被后续节点推进越过，**不回溯改写已越过的区间**，进入重放与人工纠偏（证据契约 §11）。

## 9. 落点与待定

- 落点：映射字典表（P2-04/06）、事件契约（P2-09）、归一服务在 INTEGRATION_REDUNDANCY 接入归一阶段二。
- 落点：**供应商知识库**（`docs/integrations/<provider>/`）作为对拍来源与码表权威；已建 [飞驼](../../integrations/freightower/README.md) 与 [云当网](../../integrations/trackingeyes/README.md) 两套。
- 已由两家供应商实证的 context 子键：`transportMode`（云当网 `TRUCK/RAIL/FEEDER/OCEAN`）、`ieid`（进/出口）、`itemType`（`EMPTY`/`LADEN`）、`direction`、`party`、`placeType`，以及来源等级 `sourceCd`（§7）。
- 待定：内部语义事件码全集初值；条目版本与生效/失效机制；**来源信号缺失时的默认等级**（§7 第 1 条）；**更正信号在 context 中的归位**（§8 第 2 条）。

## 10. 关联与维护

- 上链：D11–D13 / [INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) W2/W11 / [TIMELINE_MAPPING](./TIMELINE_MAPPING.md) / [EVENT_CODES](./EVENT_CODES.md) / [时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)。
- 下链：[证据来源权威契约 V1](./EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md)（§4 来源身份 / §6 权威策略 / §11 历史密封）、[ADR-012 外部来源时间确定时刻判定](../../architecture/decisions/ADR-012-external-timestamp-timezone.md)。
- 供应商码表：[飞驼事件与状态码目录](../../integrations/freightower/EVENT_CODE_CATALOG.md)、[云当网状态码与代码表](../../integrations/trackingeyes/CODE_TABLES.md)。
- 两家供应商的海运码表**仅约一半重叠**（42 码中约 23 个同形），且共享码**不得合并成同一条映射**——码集会各自演进，合并后无法表达"只在其中一家新增"。这是复合键按 `provider` 分档的直接依据。
