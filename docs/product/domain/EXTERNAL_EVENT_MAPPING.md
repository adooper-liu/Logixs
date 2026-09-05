# 三方事件码通用映射机制（EXTERNAL_EVENT_MAPPING）

> 状态：**候选（机制设计）** · 2026-09-05 · 负责人：刘志高。
> 需求：**事件代号与飞驼等三方 API 代码对齐**，建立一套**适用于任意三方 API 对接**的映射机制。
> 依据：D11–D13（固定内部码+映射字典）、[INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) W2/W11（上下文复合键、歧义消歧）、
> [TIMELINE_MAPPING](./TIMELINE_MAPPING.md)（统一事件信封）、[CONTRACTS_DRAFT](./CONTRACTS_DRAFT.md)、[INTEGRATION_REDUNDANCY](./INTEGRATION_REDUNDANCY.md)（接入归一）。

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
  │  命中 → 内部语义事件码 + 属性(isEsti/place/分类) ; 未命中 → 待处理
  ▼
统一事件信封(code/time/isEsti/place/source/provenance/dbtype)   ← TIMELINE/事件模型
  ▼
分类落点: L 节点/子里程碑 / 状态证据(推进·密封) / 异常(五主体扣留放行·甩柜) / 单证·费用 …
```

## 3. 复合映射键与消歧规则

- 键 = `(provider, rawEventCode, context)`；context 建议子键：`mode(运输方式)/category(类别)/itemType(EMPTY|LADEN|BL|BK…)/direction(E|I)/party(主体)/placeType(起始·起运港·中转·目的·目的地)`。
- 消歧规则沉淀为映射数据（非常量代码）：
  - `E*→预计(isEsti=Y)、A*→实际(N)`（如 ETD/ATD、ETA/ATA）；
  - 前缀语义：`I/T/F/R/P`（进口/中转/feeder/rail/port）等作为 context 消歧（W11）；
  - US 海关成对规律：`1H↔1I`、`6H↔6I`（H=扣留中/I=解除）——用规则模板生成映射条目而非逐条硬写；
  - 同一供应商文档歧义/错位（如飞驼页标题错位、码多义）→ 以对拍样例为准并记录（见 §5）。

## 4. 映射条目结构（草案）

`external_event_mapping { provider, provider_version, raw_code, raw_desc_cn/en, context(jsonb), semantic_code, is_estimated_default?, target(node|milestone|state_evidence|exception|doc|fee), maturity(confirmed|candidate), since, ref(doc/sample id), remarks }`

示例（示意）：
| provider | raw | context | semantic/落点 |
| --- | --- | --- | --- |
| FeiTuo | STSP | — | 提空箱（#2 前操作事件） |
| FeiTuo | GITM | laden=EMPTY | 提空/进场 |
| FeiTuo | LOBD | — | 装船（#3 出运证据） |
| FeiTuo | DLPT | — | 离港（#4, atd） |
| Terminal | GTOT | EMPTY | 提空箱 |
| Terminal | GTOT | LADEN | 提柜/出场（#10） |
| US Customs | 1H / 1I | — | 扣留中 / 解除（五主体异常） |
| EIR | RELS | YAR | 放箱（首节点） |

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

## 7. 落点与待定

- 落点：映射字典表（P2-04/06）、事件契约（P2-09）、归一服务在 INTEGRATION_REDUNDANCY 接入归一阶段二。
- 待定：内部语义事件码全集初值；context 子键集合；条目版本与生效/失效机制。

## 8. 关联与维护

- 上链：D11–D13 / [INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md) W2/W11 / [TIMELINE_MAPPING](./TIMELINE_MAPPING.md) / [CONTRACTS_DRAFT](./CONTRACTS_DRAFT.md)。
