# 五主体 放行/扣留/查验 码清单 v0.1（FIVE_PARTY_CODES · 候选）

> 状态：候选 · 2026-09-05 · 用途：放行体系（含清关放行是其子集）落为 内部事件语义码(EVENT_CODES) + 现网/规范码映射。
> 规则：扣留=异常(exception)；放行=前提/里程碑；`hold_released` 解除；查验为海关子类型。
> 语义码引用 [EVENT_CODES](./EVENT_CODES.md)（release/hold/hold_released/customs_filed/inspection）。

| 主体 | 扣留(语义) | 放行(语义) | 其它/查验                      | 现网·规范码示例                      | 卫式/影响                   |
| ---- | ---------- | ---------- | ------------------------------ | ------------------------------------ | --------------------------- |
| 海关 | `hold`     | `release`  | `customs_filed` · `inspection` | CUIP/HOLD·PASS·1H↔1I·查验(1A/1B·CES) | 放行先于提柜；扣货进异常    |
| 船司 | `hold`     | `release`  | 配载(PRLD)/漏装甩柜            | SRHD·SRRS · DUMP/offLoad             | 出运/放行前                 |
| 海事 | `hold`     | `release`  | —                              | MCRP                                 | 到港段放行                  |
| 码头 | `hold`     | `release`  | 可提(AVAILABLE)/预约           | TMHD·TMPS · AVAIL                    | 提柜前；含免费期(Last Free) |
| 运费 | `hold`     | `release`  | 结清                           | SRSD·SRSE · Charges                  | 运费与放行联动(滞港费 P4)   |

## 说明

- 语义统一为 4 事件：`hold`(扣留)、`hold_released`(解除)、`release`(放行)、`inspection/customs_filed`(海关专项)；主体由 `context.party` 区分（EXTERNAL_EVENT_MAPPING 复合键），不各造一套码。
- 放行体系影响：到港→提柜 链路的前提集合（全部相关主体放行才可提柜），纳入 PRECHECK/卫式。
- 现网遗留 4 类码（CUSTOMS/CARRIER/TERMINAL/CHARGES_HOLD）归入本表主体，`费用→运费`。

## 关联

- [EVENT_CODES](./EVENT_CODES.md)、[CONTAINER_STATUS_MODEL](./CONTAINER_STATUS_MODEL.md) §5、[CONTAINER_MARKERS](./CONTAINER_MARKERS.md)（危险品/植检与海关查验联动）。
