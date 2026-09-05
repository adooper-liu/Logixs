# 内部事件语义码清单 v0.2（EVENT_CODES · 新规则示范格式）

> 状态：**候选 v0.2（示范格式）** · 2026-09-05 · 负责人：刘志高。
> 📐 本文是**新文档规则的示范样板**：清单(可落库)为主 → 定义与澄清 → 规则与约束/边界 → 流程 → 注意事项 → 白话注解 → 落库映射（见 [ENGINEERING_RULES §12](../../../ENGINEERING_RULES.md)）。
> 定位：事件语义码 = **映射字典的目标侧（单一权威）**；三方码先经 [EXTERNAL_EVENT_MAPPING](./EXTERNAL_EVENT_MAPPING.md) 归一到本表。
> 证实度：`S`=规范证实 · `R`=现网证实 · `O`=负责人原话 · `C`=候选(待对拍)。
> 版本：v0.1（初列，29 行）→ v0.2（按新规则重组格式，码集不变，行列对齐落库）。

## ① 可落库清单（主表 = 就是库里的值）

### A. 起运/陆侧

| 码 | 中文 | 定义(一句话) | 角色 | L节点 | 推进/证据 | 源码示例 | 证实 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| empty_picked_up | 提空箱 | 从堆场/场站提走空箱 | 里程碑 | #2前 | — | STSP / GTOT·EMPTY | S·R |
| stuffed | 装箱完成 | 装柜定稿（真实重量/件数/封号/箱号） | 里程碑+定稿 | #2 | not_shipped 已装 | (导入/手工) | O·R |
| loaded | 装船/装车 | 装载上船/车 | 状态证据 | #3 | shipped | LOBD / LOAD | S |
| departed | 离港/离站 | 实际离开起运港 | 状态证据 | #4 | shipped(离) | DLPT / DEPA·TD | S |
| sailing | 在途航行 | 海运途中 | 里程碑 | #5 | in_transit | SAILING | R |
| gate_in | 进港/进场 | 货柜进码头/场站 | 里程碑 | #2后 | — | GITM / GTIN·LADEN | S·R |

### B. 中转/到港

| 码 | 中文 | 定义(一句话) | 角色 | L节点 | 推进/证据 | 源码示例 | 证实 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| transit_arrived | 中转抵港 | 到中转港 | 里程碑 | #6 | — | TRANSIT_ARRIVED | R |
| transit_departed | 中转离港 | 离中转港 | 里程碑 | #6 | — | TRANSIT_DEPARTED | R |
| arrived | 抵港 | 到达目的港 | 状态证据 | #8 | at_port | ARRIVED / BDAR | S·R |
| berthed | 靠泊 | 靠泊码头 | 里程碑 | #8前 | — | POCA / BRTH·ARRI | S |
| discharged | 卸船 | 卸下船 | 里程碑 | #8后 | — | DSCH / DISC | S·R |
| available | 可提货 | 码头放行可提 | 里程碑 | #10前 | — | AVAILABLE | S·R |

### C. 清关/放行/扣留（五主体）

| 码 | 中文 | 定义(一句话) | 角色 | L节点 | 推进/证据 | 源码示例 | 证实 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| release | 放行 | 主体放行(海关/船司/码头/海事/运费) | 前提+里程碑 | #7前 | — | PASS·SRRS·TMPS·MCRP·SRSE | S |
| hold | 扣留/滞留 | 主体扣留(查验/扣货/费用) | 异常 | — | — | HOLD·1H·CUIP | S·R |
| hold_released | 扣留解除 | 扣留解除 | 异常 | — | — | 1I·6I | S |
| customs_filed | 舱单/申报 | AMS/ISF/报关申报 | 里程碑 | #7 | — | 55/69/3Z·BLA | S |
| inspection | 查验 | 海关查验(X光/尾门/强化) | 异常 | #7 | — | 1A/1B·CES | S |

### D. 提柜/送仓/卸空/还箱

| 码 | 中文 | 定义(一句话) | 角色 | L节点 | 推进/证据 | 源码示例 | 证实 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gate_out | 提柜/出场 | 从码头提走重箱 | 状态证据 | #10 | picked_up | GATE_OUT / GTOT·LADEN | S·R |
| delivered | 送仓/送达 | 拖卡送达仓库 | 里程碑 | #11 | — | DELIVERED | S·R |
| warehouse_arrival | 到仓入库 | 货到仓库 | 里程碑 | #11 | — | WAREHOUSE_ARRIVAL | R |
| unloaded | 卸柜 | 仓库卸货 | 状态证据 | #12 | unloaded | UNLOADED | S·R |
| unstuffed | 卸空 | 箱内卸净(可还箱) | 里程碑 | #13 | — | UNBOXED / STRIPPED | R |
| returned_empty | 还箱 | 空箱归还 | 状态证据(终) | #14 | returned_empty | RETURNED_EMPTY | S·R |

### E. 计划/取消/异常

| 码 | 中文 | 定义(一句话) | 角色 | L节点 | 推进/证据 | 源码示例 | 证实 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dumped | 甩柜 | 甩柜(预计/实际由 isEsti 分) | 异常 | 出运前 | — | DUMP·offLoad | S·R |
| rolled | 漏装/改配 | 甩柜后改船期/漏装 | 异常 | 出运前 | — | 漏装-改船名航次 | S |
| cancelled | 取消 | 运单/记录取消 | 异常→终态 | 计划段 | cancelled | CANCEL·退关 | O·R |
| changed | 计划变更 | 开/截港·到离泊·港口变更 | 里程碑(预计) | 动态 | — | CHANGE 类 | S |
| delay | 延误 | 时间偏差预警 | 异常 | 动态 | — | DELAY 类 | S |
| overdue | 超期 | 滞留/免费期超限 | 异常 | #10–14 | — | OVERDUE/DETENTION | S |

## ② 定义与澄清

- **事件码 ≠ 状态码 ≠ 动作码 ≠ 标记码**：事件码是"路上发生的每一件事"（证据/里程碑），状态码是"货柜当前到哪一步"，动作码是"人能一键点的事"，标记码是"这柜带不带某特征"。别混。
- **预计/实际不拆码**：用 `isEsti` 表达——同一条码既可能是"预计离港"也可能是"实际离港"。
- **码是"目标侧"**：三方给你 `DLPT`、`DEPA`、`DEPARTED` 这些不同叫法，最终都要翻译成本表的同一个 `departed`。
- 角色说明：`状态证据`＝能推动 currentStatus 变化；`里程碑`＝只记录进度、不直接改状态；`异常`＝进 exception，不占主链；`前提`＝某节点放行的必要条件。

## ③ 规则与约束/边界

- 码只增不减；删码须评审并处理历史数据。
- 新增/改名 = 评审；语义不可与现有码重复或含义重叠。
- 只有**实际**(isEsti=N)事件可 推进/密封(R3)；**预计**只预告、不密封。
- 每个码必须有：中文名、一句话定义、角色、归属(L 节点或段)、来源示例、证实度；缺定义不得入表。
- 源码 → 本表 不得"裸码一一对应"：歧义须复合键消歧后再指到码（EXTERNAL_EVENT_MAPPING §3）。
- 码全集**不得臆造**；未由 规范/现网/负责人 证实的一律 `C`，P2-12 对拍后转 `S/R`。

## ④ 流程（怎么用这个清单）

1. **对接三方**：拉取对方事件码 → 与本表对拍 → 写映射条目（补 EXTERNAL_EVENT_MAPPING 示例表）。
2. **发布前**：本表 C 级码 → 用真实样本(P2-12)对拍 → 标 S/R；未覆盖码进待处理。
3. **实现**：本表转 `internal_event_code` Seed；事件信封 `eventCode` 取值域 = 本表码集（CONTRACTS_DRAFT）。
4. **演进**：新事件 → 评审加行(补定义/角色/归属/证实) → Seed 更新 → 影响契约/前端文案。

## ⑤ 注意事项（坑）

- 别把三方码当内部码存（会漏掉别名/大小写/版本差异）；**原样+归一并存**。
- 别为"状态文本/展示文案"造事件码；展示用中文名，别改码。
- 留意供应商文档错位/漂移（已见：飞驼总览页把某 ID 标成 ETA 预测实为甩柜）；**以详情页+对拍为准**。
- 同一码多义（GTOT 空/重、RELS YAR/CUS）必须带 context 消歧，否则会推错状态。
- 预计事件也会进库（作预告），但要带 `isEsti=Y`，不能当作实际去密封。
- 删除/下线一个语义时，先查它在 映射条目/契约/前端 的所有引用。

## ⑥ 白话注解（🗣️）

> **这批码是干嘛的**：就是一柜子货从"备货装箱"到"还箱结束"，一路上发生的每一件大事，都用**固定的词**记下来；外面各家的乱叫法（海关、船司、码头的代号）都翻译成这些词。每个词都有一句话解释、归到哪一步、能不能推动状态，以及是"规范/现网/你说的/还是我猜的"。这样谁来了都能看懂、能改，而且能直接变成数据库里的一张小表。
>
> **一个例子帮理解**：飞驼发来 `DLPT`，码头发来 `DEPA`，字面不同——在我们这儿都记成一条 `departed`（离港）。前端只显示"已离港"，后端只认 `departed`。这样换任何一家数据源，页面和规则都不用改。

## ⑦ 落库映射（示例）

| 清单列 | 落库 | 示例值 |
| --- | --- | --- |
| 码 | `internal_event_code.code`(PK,固定) | `departed` |
| 中文 | `.name_cn` | 离港 |
| 定义 | `.definition` | 实际离开起运港 |
| 角色 | `.role`(milestone/evidence/exception/prerequisite) | evidence |
| 归属 | `.node`(L # 或段) | #4 |
| 推进到 | `.advances_to`(可空) | shipped |
| 源码示例 | 映射表(EXTERNAL_EVENT_MAPPING) 引用 | DLPT / DEPA·TD |
| 证实度 | `.provenance`(S/R/O/C) | S |
| isEsti | 事件信封字段，不入本表 | — |

## ⑧ 待对拍（P2-12）与变更

- C 级行：见上表 `C`；对拍真实样本后转 S/R。
- v0.1→v0.2：仅格式重组（新规则示范），码集与定义未变；后续变更在此追加。

## ⑨ 沿链去向（可视化 → UI）

- 本表码 → 事件信封 `eventCode` → 入库 `internal_event_code` Seed（P2-06）。
- → 可视化：工作台 rail 显示推进到状态、TimelineDrawer 按事件流展示本表事件、异常码上挂 exception 红点。
- → UI 交互：事件即"证据"供 PDCA Check 展示；动作中心按缺失事件推导下一步一键动作（UX V1/V2）。

## 关联

- [EXTERNAL_EVENT_MAPPING](./EXTERNAL_EVENT_MAPPING.md)（目标侧）、[TIMELINE_MAPPING](./TIMELINE_MAPPING.md)、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md)、[FIVE_PARTY_CODES](./FIVE_PARTY_CODES.md)。
