# 海关业务样本 005：西班牙 DUA 通道与 Levante

> 状态：真实脱敏双场景样本 · 待业务确认 · 2026-09-08
>
> 边界：两份 DUA 分别覆盖黄色和红色通道，且都记录 `Levante`。`Levante` 是强放行事实候选，但在适用货柜范围和下游 Hold 未确认前，不直接等同于可提柜。

## 1. 场景矩阵

| 场景 | 文档 | 受理与 Levante | 通道 | 可观察结论 |
|---|---|---|---|---|
| CASE-005-A | DUA / DECLARACION A | 同日 | `Amarillo` | 黄色通道后可以取得 Levante |
| CASE-005-B | DUA / DECLARACION B | 跨日 | `Rojo` | 红色通道不是终态失败，后续仍可取得 Levante |

文档中的真实 CSV、MRN、主体、地址、货柜号、商品、税费和日期未写入本样本。

## 2. 证据语义

| 字段/文档 | 候选语义 | 禁止推断 |
|---|---|---|
| `Admitido` | 申报已受理及其发生时间 | 海关已放行 |
| `Circ.Adu: Amarillo/Rojo` | 风险/查验通道属性 | 货柜永久 Hold 或失败终态 |
| `Levante` | 西班牙管辖区的放行/提货授权事实候选及发生时间 | 码头、船公司和其他主体均已解除 Hold |
| DUA 商品与税费 | 申报和计税明细 | 已付款或最终清算 |

## 3. 候选事件链

```text
DUA admitted
  -> risk channel assigned (yellow or red)
  -> review / inspection work as applicable
  -> Levante recorded
  -> customs.release.confirmed candidate
  -> lifecycle guard checks container scope and non-customs holds
  -> eligible for next node
```

通道是案卷路径属性，不是主链状态。红色或黄色通道可以触发不同工单，但不能把 14 节点主链扩展成管辖区专用节点。

## 4. 规则候选

| 规则 ID | 规则 | 失败处理 |
|---|---|---|
| S005-P01 | `Admitido` 与 `Levante` 分别保存为 acceptedAt 和 releasedAt | 禁止用后者覆盖前者 |
| S005-P02 | 通道保存 raw value 和版本化规范值 | 未知通道进入复核 |
| S005-P03 | 只有非空、可验证的 Levante 及其证据可形成放行候选 | 无时间或来源时不推进 |
| S005-P04 | 放行候选必须关联声明和明确货柜集合 | 适用范围不明时阻塞转移 |
| S005-P05 | 海关放行与码头/承运人/付款 Hold 分开 | 仍有必要 Hold 时不进入可提柜 |
| S005-P06 | 更正、撤销、重复和晚到消息按事件时间与接收时间双轨处理 | 不回退较新的有效裁决，进入对账 |

## 5. 对状态与工单的贡献

| 层级 | 候选处理 |
|---|---|
| 海关案卷 | received/accepted、under_control、released 等语义仍须进入公共契约评审 |
| NodeTask | 通道出现后重新计算所需工单集合 |
| WorkOrder | 黄色/红色通道可分别触发文件复核、查验协调或补件工单 |
| FlowInstance | 只消费经验证的规范放行事件，不消费裸通道文本 |
| SyncRecord | 接收/解析/映射失败独立记录，不改写海关裁决 |

## 6. 待确认

1. DUA `Levante` 的签发主体、真实性校验方式和撤销机制。
2. 一个 DUA 对多个货柜时的放行适用范围。
3. 黄色/红色通道对应的实际工单、必需证据和完成条件。
4. `Levante` 后进入提柜节点还需要哪些码头、承运人或付款守卫。
5. 接口或服务商返回的原始状态码、请求/受理/终态三阶段回执。

## 7. 对契约的贡献

本样本首次提供了可区分 acceptedAt 与 releasedAt 的跨场景放行候选，也证明风险通道不能等同于流程终态。经西班牙业务负责人确认后，可把 `DUA + Levante` 升格为 jurisdiction-specific 的 `customs.release.confirmed` 映射来源。
