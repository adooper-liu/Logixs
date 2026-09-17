# 预检/校验规则清单 v0.2（PRECHECK_RULES · 候选）

> 状态：候选 · 2026-09-16 · 用途：可落"预检规则表/配置"；导入批次写库前确定性校验（IMPORT_DOMAIN_MODEL 预检硬闸）。
> 级别：`blocker`(禁止写库，产品硬约束) · `conflict`(进人工/低置信复核) · `warn`(提示不阻断)。
> 类别：必填 / 字典 / 格式 / 一致性 / 重复·幂等 / 卫式 / 标记 / 费用 / 状态证据。
> 证实度：O=负责人确认 · R=现网样本 · S=外部规范 · C=候选。

| ruleCode           | 名称                                    | 类别      | 级别             | 判断要点                                                                   | 落点    | 证实 |
| ------------------ | --------------------------------------- | --------- | ---------------- | -------------------------------------------------------------------------- | ------- | ---- |
| REQ_ORDER          | 备货单号必填                            | 必填      | blocker          | 行缺 orderNumber 拒绝                                                      | 行      | O    |
| REQ_TYPE           | 箱型必填且字典命中                      | 必填·字典 | blocker          | 未命中不得静默回退                                                         | 列      | O    |
| REQ_PORT           | 起/目的港至少其一                       | 必填      | blocker          | 或承运(船司/船名航次)任一                                                  | 行      | O    |
| DICT_MASTER        | 主数据未命中进待处理                    | 字典      | conflict         | 港口/船司/仓库/标记等                                                      | 值      | O·R  |
| FMT_TIME           | 时间格式/时区                           | 格式      | blocker          | 按 R0；无时刻须标注                                                        | 列      | O    |
| CUR_AMOUNT         | 金额带币种                              | 格式      | blocker          | 缺币种或精度错拒绝                                                         | 列      | O    |
| ONE_ORDER_ONE      | 一备货单≤一柜                           | 重复·幂等 | blocker          | 同 orderNumber 指向多个不同货柜才异常                                      | 聚合/库 | O    |
| MAIN_ORDER_NO_KEY  | 主备货单号不作关系                      | 一致性    | conflict         | 出现跨票关系须清洗                                                         | 库      | O    |
| SEALED_GUARD       | 密封区不可改                            | 卫式      | blocker          | R3                                                                         | 写端口  | O    |
| STATE_VALID        | 转换合法                                | 卫式      | blocker          | R2/状态机                                                                  | 写端口  | O    |
| TIME_MONO          | 实际时间单调                            | 一致性    | blocker          | R1 下一≥前一                                                               | 节点列  | O    |
| EST_ACTUAL         | 预计/实际不混                           | 一致性    | warn             | isEsti 标注                                                                | 事件    | O    |
| STATUS_EVIDENCE    | 终态需证据                              | 状态证据  | conflict         | returned_empty 需还箱时间                                                  | 行/状态 | O    |
| MARKER_ACT         | 标记触发动作/卫式                       | 标记      | conflict         | 危险品→DG 声明等                                                           | 记录    | O·C  |
| FREE_DAYS          | 免费期/滞留预警                         | 费用      | warn             | 剩余≤N 天预警                                                              | 记录    | C    |
| HEADER_CONFLICT    | 同备货单表头冲突                        | 一致性    | blocker          | 多产品行的箱号/提单等表头值不一致                                          | 聚合    | O    |
| DUP_ROW            | 来源行或业务明细重复                    | 重复·幂等 | blocker          | 按来源行身份/已确认明细键判重，不只看备货单号或产品号                      | 行      | O    |
| REQ_QTY_UNIT       | 产品数量必须带单位                      | 必填·格式 | blocker          | `shippedQuantity` 有值而单位未知时拒绝                                     | 明细    | O    |
| QTY_PACKAGE_SPLIT  | 产品数量与整单包装数分离                | 一致性    | blocker          | 无明确装箱换算规则时禁止互推或以相等证明同口径                             | 聚合    | O    |
| ACTUAL_EVIDENCE    | 完成状态须有实际时间与证据              | 状态证据  | conflict         | 清关/卸柜/卸空等完成声明缺实际时点不得生成实际事件                         | 事件    | O    |
| TIME_PROVENANCE    | 跨系统时间四件套                        | 格式      | blocker          | 原值、来源时区/偏移、UTC、来源证据缺失时不得写 actual                      | 值/事件 | O    |
| DERIVED_NOT_ACTUAL | 推导时间不得冒充实际                    | 一致性    | blocker          | 计算值用 `timeKind=estimated`、`captureSource=system_derived` 并带规则版本 | 值/事件 | O    |
| SRC_AUTH           | 字段/事件来源权威、证据或纠偏权限不满足 | 卫式      | blocker/conflict | 按 D7 拒绝或进入人工复核，不静默覆盖                                       | 值/事件 | O    |
| LAYOUT_MIXED       | 单一工作表的数据粒度必须一致            | 格式      | blocker          | 横向产品明细中混入纵向字段值区块时拒绝；不同实体/粒度应拆 Sheet 或命名区域 | 文件    | O·R  |

## 关联

- [IMPORT_DOMAIN_MODEL](./IMPORT_DOMAIN_MODEL.md)、[DATA_CLEANUP_ORDER_CONTAINER](./DATA_CLEANUP_ORDER_CONTAINER.md)、[LIFECYCLE_CONSISTENCY](./LIFECYCLE_CONSISTENCY.md)、[CONTAINER_MARKERS](./CONTAINER_MARKERS.md)。
