# 预检/校验规则清单 v0.1（PRECHECK_RULES · 候选）

> 状态：候选 · 2026-09-05 · 用途：可落"预检规则表/配置"；导入批次写库前确定性校验（IMPORT_DOMAIN_MODEL 预检硬闸）。
> 级别：`blocker`(禁止写库，产品硬约束) · `conflict`(进人工/低置信复核) · `warn`(提示不阻断)。
> 类别：必填 / 字典 / 格式 / 一致性 / 重复·幂等 / 卫式 / 标记 / 费用 / 状态证据。
> 证实度：O=负责人确认 · R=现网样本 · S=外部规范 · C=候选。

| ruleCode | 名称 | 类别 | 级别 | 判断要点 | 落点 | 证实 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ_ORDER | 备货单号必填 | 必填 | blocker | 行缺 orderNumber 拒绝 | 行 | O |
| REQ_TYPE | 箱型必填且字典命中 | 必填·字典 | blocker | 未命中不得静默回退 | 列 | O |
| REQ_PORT | 起/目的港至少其一 | 必填 | blocker | 或承运(船司/船名航次)任一 | 行 | O |
| DICT_MASTER | 主数据未命中进待处理 | 字典 | conflict | 港口/船司/仓库/标记等 | 值 | O·R |
| FMT_TIME | 时间格式/时区 | 格式 | blocker | 按 R0；无时刻须标注 | 列 | O |
| CUR_AMOUNT | 金额带币种 | 格式 | blocker | 缺币种或精度错拒绝 | 列 | O |
| ONE_ORDER_ONE | 一备货单≤一柜 | 重复·幂等 | blocker | 同 orderNumber 多行/多记录判异常 | 行/库 | O |
| MAIN_ORDER_NO_KEY | 主备货单号不作关系 | 一致性 | conflict | 出现跨票关系须清洗 | 库 | O |
| SEALED_GUARD | 密封区不可改 | 卫式 | blocker | R3 | 写端口 | O |
| STATE_VALID | 转换合法 | 卫式 | blocker | R2/状态机 | 写端口 | O |
| TIME_MONO | 实际时间单调 | 一致性 | blocker | R1 下一≥前一 | 节点列 | O |
| EST_ACTUAL | 预计/实际不混 | 一致性 | warn | isEsti 标注 | 事件 | O |
| STATUS_EVIDENCE | 终态需证据 | 状态证据 | conflict | returned_empty 需还箱时间 | 行/状态 | O |
| MARKER_ACT | 标记触发动作/卫式 | 标记 | conflict | 危险品→DG 声明等 | 记录 | O·C |
| FREE_DAYS | 免费期/滞留预警 | 费用 | warn | 剩余≤N 天预警 | 记录 | C |
| DUP_ROW | 文件内重复行 | 重复·幂等 | blocker | 同匹配键只写一条 | 行 | O |
| SRC_AUTH | 来源权威/手工锁 | 卫式 | blocker | D7 冲突拒绝 | 值 | O |

## 关联
- [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[DATA_CLEANUP_ORDER_CONTAINER](./DATA_CLEANUP_ORDER_CONTAINER.md)、[LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[CONTAINER_MARKERS](./CONTAINER_MARKERS.md)。
