# 关键节点 · 作战清单（NODE_PDCA · v0.2 人话重构示范）

> 状态：**候选 v0.2** · 2026-09-05 · 负责人：刘志高。
> 示范点：可落库清单/表为主 + 一句话白话；叙述只作注释（ENGINEERING §12 / EVENT_CODES v0.2 同款）。
> 需求：每节点 = 作战台（每天知道该干嘛→能一键办→办完能确认），对应 VISION D1「节点操作灵魂」。
> 证实度：S=规范 · R=现网 · O=负责人 · C=候选(待对拍/待业务补)。PDCA＝计划→派单→Check→改善 内嵌在各行。

## ① 节点作战模型（模板，套到每个关键节点）

| 步 | 名称 | 要回答 | 产出/动作 | 落点 |
| --- | --- | --- | --- | --- |
| 1 | 起点 | 今天必须处理什么？ | 今日红灯清单 | 每日待办视图 + 工单 |
| 2 | 准备 | 基础信息对了吗？ | 维护 planned/字典引用(GIGO) | 节点字段维护 |
| 3 | 盯 | 有没有断点/异常？ | 传递监控/查验/预警 | 事件流+PRECHECK 规则 |
| 4 | 做 | 怎么解决？ | 一键动作(ACTION_CATALOG) | 动作中心 |
| 5 | 核 | 办完了吗？对没对？ | 状态推进+实际时间+审计 | 状态机/审计 |
| 6 | 规则 | 何时系统自动做？ | 触发规则清单 | TriggerRules 配置 |

## ② 范例：清关节点作业清单（真实 SOP，R/O）

| 问 | 判断 | 动作 | 产出 |
| --- | --- | --- | --- |
| 1 计划清关日期今天或已过？ | 是=红灯 | 优先处理 | 红灯清单 |
| 2 清关状态未完成/异常？ | 是 | 联系清关/补资料 | 跟进 |
| 3 单据传递未全/失败/重传？ | 是 | 重新/手动传递；查附件齐否 | 断点修复 |
| 4 需换单/待确认？ | 是 | 联系货代/船司 | 换单进度 |
| 5 ISF 未申报/失败？ | 是 | 补充重申报 | 申报确认 |
| 6 有异常原因？ | 是(⚠) | 评估影响/升级 | 处置 |

- 独立事件：清关状态=查验/开箱 → 开《查验记录》跟进度→放行→置已清关（`inspection`→`release`）。
- 闭环：确认"已清关"+实际清关日期（EVENT_CODES release / NODE_TIME #7 actual）。
- 自动规则：附件(出运+14天,提单zip≤10MB)、定时发送、货柜同步、最晚清关日期（D2/D6 待入规则清单）。

## ③ 8 关键节点作战清单（v0.1 初版；除 K6 外多 C 级，待业务/样本填充）

| 节点 | 为何关键 | 今日红灯问题(初版) | 一键动作码 | 闭环确认 | 风险→例外 | 证实 |
| --- | --- | --- | --- | --- | --- | --- |
| K1 备货就绪 | 货量/船期前提 | 备货就绪时间到点未完成？ | 确认就绪 | ready_actual | 备货延期 | R·C |
| K2 装箱定稿 | 数据定稿+标记 | 重量/体积超限？标记(危险品等)未处理？缺箱号待补？ | confirm_stuffing | stuffing_actual+标记 | 超限 blocker/未标 | R·O |
| K3 出运确认 | 承运/船期进入 | 船期变更/甩柜倾向？航次与备货不符？ | confirm 出运 | ship_actual | delay/dumped | C |
| K4 离港 | 不可逆+密封 | atd 晚于 ETD？截关文件未齐？危险品卫式未达？ | confirm_departure | depart_actual | delay | C |
| K5 在途/中转 | 变更延误高发 | ETA 漂移？中转滞留？甩柜？ | notify_arrival/派单 | 事件 | delay/dumped/overdue | C |
| K6 清关 | 单证+放行前提 | 见②六问 | issue_dg/request_phytosanitary/forward_document | release+实际清关 | inspection/hold | R·O |
| K7 到港→提柜 | 免费期计时+派单 | 免费期将尽？清关放行未达？派拖超时？ | confirm_arrival/order_trucking_pickup | pickup_actual | overdue/detention | R·C |
| K8 卸空→还箱 | 交接对账 | 卸空与 WMS 收货不一致？还箱超期？空箱未返？ | confirm_unstuffed/schedule_empty_return | returned_empty | 对账/overdue | R·C |

## ④ 规则/约束（引用，不复制）

- 转换/密封/单调：LIFECYCLE R1–R4；预检：PRECHECK；来源：D7；五主体放行前提见 FIVE_PARTY。
- 每个"今日红灯问题"应可编码为 **TriggerRules 行**（问题→判断→动作→闭环），逐步覆盖 ③，减少纯人肉判断。

## ⑤ 白话注解（🗣️）

🗣️ 一句话：**把每个关键节点都做成"班前看一遍就知道今天该办啥、点一下就能办、办完系统告诉你对没对"的作战台**；清关那张 6 问表就是第一个活例子，其余 7 个节点照着填。

## ⑥ 待办

- ③ K 节点问题/动作/阈值：由负责人+业务逐节点补成 ② 同款（K6 已全，其余 C）。
- 每节点 TriggerRules 落地为规则行（D2/D6）；对接 UX 每日待办(红灯)视图（D1）。
- 真实样本回验（P2-12）后转 S/R。

## 关联

- [CONTAINER_LIFECYCLE](./CONTAINER_LIFECYCLE.md)、[EVENT_CODES](./EVENT_CODES.md)、[ACTION_CATALOG](./ACTION_CATALOG.md)、[PRECHECK_RULES](./PRECHECK_RULES.md)、[FIVE_PARTY_CODES](./FIVE_PARTY_CODES.md)、[LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[VISION](../VISION.md)(D1)。
